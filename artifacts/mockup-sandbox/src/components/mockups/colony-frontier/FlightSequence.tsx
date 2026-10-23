import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Stars } from "@react-three/drei";
import * as THREE from "three";
import { ArrowDown, ArrowUp, Check, Compass, Crosshair, Gauge, Glasses, Radio, Rocket, ShieldCheck, Timer, TriangleAlert } from "lucide-react";
import { loadPendingMission } from "./missionRuntime";

type Stage = "approach" | "boarding" | "startup" | "ascent" | "orbit" | "transfer" | "landing" | "crashed" | "landed" | "outside" | "entering";
type FlightState = {
  stage: Stage; walkDistance: number; walkX: number; walkZ: number; yaw: number; heading: number; pitch: number; throttle: number;
  altitude: number; speed: number; verticalSpeed: number; orbitSeconds: number; transferSeconds: number;
  boardingSeconds: number; telemetrySeconds: number; elapsedSeconds: number; burnStarted: boolean;
};
type XRSessionHandle = Parameters<THREE.WebGLRenderer["xr"]["setSession"]>[0];
type XRSystemHandle = {
  isSessionSupported: (mode: "immersive-vr") => Promise<boolean>;
  requestSession: (mode: "immersive-vr", options: {
    optionalFeatures: string[];
    domOverlay?: { root: HTMLElement };
  }) => Promise<XRSessionHandle>;
};
const makeFlight = (): FlightState => ({
  stage: "approach", walkDistance: 0, walkX: 0, walkZ: PAD_APPROACH_DISTANCE - 2.5, yaw: 0, heading: 0, pitch: 90, throttle: 0, altitude: 0,
  speed: 0, verticalSpeed: 0, orbitSeconds: 0, transferSeconds: 0, boardingSeconds: 0,
  telemetrySeconds: 0, elapsedSeconds: 0, burnStarted: false,
});
const clamp = THREE.MathUtils.clamp;
const MOON_HEADING = 24;
const ORBIT_ALTITUDE = 160;
const ORBIT_SPEED = 7.8;
const PAD_APPROACH_DISTANCE = 127;
const labels: Record<Stage, string> = {
  approach: "CREW TRANSFER", boarding: "HATCH CYCLE", startup: "FLIGHT SYSTEMS", ascent: "POWERED ASCENT",
  orbit: "EARTH ORBIT", transfer: "TRANSLUNAR INJECTION", landing: "POWERED DESCENT",
  crashed: "FLIGHT INCIDENT", landed: "LUNAR TOUCHDOWN", outside: "SURFACE EXPLORATION", entering: "HABITAT AIRLOCK",
};
const titles: Record<Stage, string> = {
  approach: "Walk to the vehicle", boarding: "Boarding the spacecraft", startup: "Flight deck",
  ascent: "Climb into orbit", orbit: "Stable orbit achieved", transfer: "Translunar injection",
  landing: "Land on the Moon", crashed: "Landing aborted", landed: "Touchdown confirmed",
  outside: "The lunar surface", entering: "Entering the habitat",
};
const details: Record<Stage, string> = {
  approach: "A clear morning at Kennedy Space Center. Walk up the service ramp to the open crew hatch.",
  boarding: "Crew hatch cycling. Cabin sealing and guidance alignment in progress.",
  startup: "Your launch is in your hands. Review the flight cues, then ignite the engines.",
  ascent: "Balance pitch and thrust to reach a 160 km orbit at 7.8 km/s.",
  orbit: "Stable low Earth orbit achieved. Find the Moon and line up the translunar burn.",
  transfer: "Hold the lunar heading and pitch through the transfer burn. The descent starts on arrival.",
  landing: "Manage descent rate, vertical attitude and engine thrust all the way to touchdown.",
  crashed: "The landing envelope was exceeded. Restart the approach and try a gentler, better-aligned descent.",
  landed: "Engines shut down. Step outside and walk to the illuminated habitat airlock.",
  outside: "The crew habitat is ahead. Walk to its airlock to begin the surface mission.",
  entering: "Pressurising the airlock and handing off to the surface mission simulation.",
};

function LaunchVehicle({ position = [0, 0, -2.5], scale = [3, 6, 3], stage = "approach" }: {
  position?: [number, number, number]; scale?: [number, number, number]; stage?: Stage;
}) {
  const exhaust = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!exhaust.current) return;
    exhaust.current.visible = stage === "ascent";
    exhaust.current.scale.y = 1.2 + Math.sin(clock.elapsedTime * 18) * 0.12;
  });
  return <group position={position} scale={scale}>
    <mesh position={[0, 5.3, 0]} castShadow><cylinderGeometry args={[0.72, 0.8, 8.8, 48]} /><meshStandardMaterial color="#e6e9e3" metalness={0.52} roughness={0.34} /></mesh>
    <mesh position={[0, 10, 0]} rotation={[Math.PI, 0, 0]} castShadow><coneGeometry args={[0.72, 1.2, 48]} /><meshStandardMaterial color="#f4f2e8" metalness={0.46} roughness={0.27} /></mesh>
    <mesh position={[0, 0.88, 0]} castShadow><cylinderGeometry args={[0.8, 0.8, 0.15, 48]} /><meshStandardMaterial color="#303a3b" metalness={0.8} roughness={0.28} /></mesh>
    <mesh position={[0, 3.1, 0]} castShadow><cylinderGeometry args={[0.805, 0.805, 0.12, 48]} /><meshStandardMaterial color="#c0c4bc" metalness={0.74} roughness={0.32} /></mesh>
    <mesh position={[0, 6.1, 0]} castShadow><cylinderGeometry args={[0.81, 0.81, 0.16, 48]} /><meshStandardMaterial color="#c0c4bc" metalness={0.74} roughness={0.32} /></mesh>
    <mesh position={[0, 8.65, 0]} castShadow><cylinderGeometry args={[0.75, 0.81, 0.48, 48]} /><meshStandardMaterial color="#4d5756" metalness={0.83} roughness={0.29} /></mesh>
    <mesh position={[0, 9.05, 0]} castShadow><cylinderGeometry args={[0.72, 0.73, 0.08, 48]} /><meshStandardMaterial color="#c88e4b" metalness={0.56} roughness={0.33} /></mesh>
    <mesh position={[0, 7.1, 0.72]} castShadow><cylinderGeometry args={[0.36, 0.38, 1.5, 32]} /><meshPhysicalMaterial color="#163d54" metalness={0.62} roughness={0.12} clearcoat={1} /></mesh>
    {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[0, 8.05 - i * 0.64, 0.81]}><boxGeometry args={[1.05, 0.045, 0.035]} /><meshStandardMaterial color={i % 2 ? "#a6b1ae" : "#d5a348"} metalness={0.64} roughness={0.32} /></mesh>)}
    {[-1, 1].map((side) => <group key={side} position={[side * 0.52, 0, 0]}>
      <mesh position={[0, 4.8, 0]}><boxGeometry args={[0.035, 7.2, 0.035]} /><meshStandardMaterial color="#8d9994" metalness={0.8} roughness={0.32} /></mesh>
      {Array.from({ length: 10 }, (_, i) => <mesh key={i} position={[0, 1.3 + i * 0.68, 0.018]}><sphereGeometry args={[0.045, 8, 8]} /><meshStandardMaterial color="#c5c7be" metalness={0.72} roughness={0.3} /></mesh>)}
    </group>)}
    <mesh position={[0, 0.34, 0]} castShadow><cylinderGeometry args={[0.88, 0.98, 0.65, 40]} /><meshStandardMaterial color="#59666a" metalness={0.8} roughness={0.3} /></mesh>
    {[-0.44, 0, 0.44].map((x) => <group key={x} position={[x, 0, 0]}><mesh position={[0, -0.48, 0]}><cylinderGeometry args={[0.18, 0.26, 0.42, 20]} /><meshStandardMaterial color="#303a3d" metalness={0.65} /></mesh></group>)}
    <group ref={exhaust} position={[0, -0.82, 0]} visible={false}>
      {[-0.44, 0, 0.44].map((x, i) => <mesh key={x} position={[x, -0.55 - (i === 1 ? 0.25 : 0), 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[i === 1 ? 0.28 : 0.2, i === 1 ? 1.8 : 1.35, 20]} /><meshBasicMaterial color={i === 1 ? "#fff0a6" : "#ff9c4d"} toneMapped={false} /></mesh>)}
    </group>
    {[-1, 1].map((side) => <mesh key={side} position={[side * 0.72, 1.2, 0]} rotation={[0, 0, -side * 0.18]}><boxGeometry args={[0.68, 1.9, 0.2]} /><meshStandardMaterial color="#b84c38" metalness={0.4} roughness={0.42} /></mesh>)}
    <mesh position={[0, 11.01, 0]}><coneGeometry args={[0.21, 0.09, 48]} /><meshStandardMaterial color="#3a4647" metalness={0.78} roughness={0.3} /></mesh>
  </group>;
}

function FacilitySign({ first, second, size = [24, 5], position = [0, 0, 0] }: {
  first: string; second: string; size?: [number, number]; position?: [number, number, number];
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to create launch-complex sign texture.");
    ctx.fillStyle = "#243a43";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#d8ded7";
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    ctx.fillStyle = "#f2f1e8";
    ctx.textAlign = "center";
    ctx.font = "bold 48px Arial, sans-serif";
    ctx.fillText(first, canvas.width / 2, 104);
    ctx.font = "bold 60px Arial, sans-serif";
    ctx.fillText(second, canvas.width / 2, 200);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [first, second]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={position}>
    <planeGeometry args={size} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}

function LaunchComplex() {
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow><planeGeometry args={[640, 640]} /><meshStandardMaterial color="#77847a" roughness={0.92} /></mesh>
    <mesh position={[0, -0.035, -2.5]}><boxGeometry args={[30, 0.12, 28]} /><meshStandardMaterial color="#a7aaa1" roughness={0.84} /></mesh>
    {[-12, 12].map((x) => <mesh key={x} position={[x, 0.035, -2.5]}><boxGeometry args={[0.22, 0.018, 27]} /><meshBasicMaterial color="#ecc35b" /></mesh>)}
    {Array.from({ length: 11 }, (_, i) => <mesh key={i} position={[-4.5 + i * 0.9, 0.035, 9]}><boxGeometry args={[0.54, 0.02, 0.11]} /><meshBasicMaterial color="#f0eee1" /></mesh>)}
    <mesh position={[0, -0.01, 31]}><boxGeometry args={[28, 0.06, 86]} /><meshStandardMaterial color="#898f88" roughness={0.82} /></mesh>
    {[-11, 11].map((x) => <mesh key={x} position={[x, 0.035, 31]}><boxGeometry args={[0.18, 0.018, 86]} /><meshBasicMaterial color="#e7c45e" /></mesh>)}
    <group position={[0, -0.12, -12]}>
      <mesh position={[0, -0.18, 0]}><boxGeometry args={[9, 0.16, 31]} /><meshStandardMaterial color="#333b39" roughness={0.92} /></mesh>
      {[-4.2, 4.2].map((x) => <mesh key={x} position={[x, -0.12, 0]}><boxGeometry args={[0.28, 0.3, 31]} /><meshStandardMaterial color="#aeb4ab" metalness={0.42} roughness={0.54} /></mesh>)}
    </group>
    <group position={[4.4, 0, -2.4]} scale={[1.1, 6.2, 1.1]}>
      {[-2, 2].map((x) => <mesh key={x} position={[x, 5.5, 0]}><boxGeometry args={[0.55, 11, 0.7]} /><meshStandardMaterial color="#657d83" metalness={0.72} roughness={0.36} /></mesh>)}
      <mesh position={[0, 10.9, 0]}><boxGeometry args={[4.5, 0.55, 0.8]} /><meshStandardMaterial color="#657d83" metalness={0.72} /></mesh>
      <mesh position={[-0.5, 6.7, 0.42]}><boxGeometry args={[3.1, 0.22, 0.22]} /><meshStandardMaterial color="#d8a84e" metalness={0.54} /></mesh>
      {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[-1.45 + (i % 4) * 0.95, 1.3 + Math.floor(i / 4) * 2.4, 0]}><boxGeometry args={[0.16, 1.8, 0.16]} /><meshStandardMaterial color="#84979a" metalness={0.68} /></mesh>)}
    </group>
    {[-1, 1].map((side) => <group key={side} position={[side * 21, 0, -25]} scale={[5, 5, 5]}><mesh position={[0, 2.6, 0]}><boxGeometry args={[8, 5.2, 6]} /><meshStandardMaterial color="#b7c0ba" /></mesh><mesh position={[0, 5.5, 0]}><boxGeometry args={[8.5, 0.3, 6.5]} /><meshStandardMaterial color="#626f6c" metalness={0.34} /></mesh></group>)}
    {Array.from({ length: 5 }, (_, i) => <mesh key={i} position={[-32 + i * 17, 7 + i % 2, -66]} scale={[1.8 + i % 3, 2 + i % 2, 1]}><sphereGeometry args={[1, 20, 16]} /><meshStandardMaterial color="#93a793" /></mesh>)}
    <group position={[-90, 0, -95]}>
      <mesh position={[0, 76, 0]} castShadow><boxGeometry args={[82, 152, 68]} /><meshStandardMaterial color="#b6beb8" roughness={0.8} /></mesh>
      <mesh position={[0, 153.5, 0]}><boxGeometry args={[84, 3, 70]} /><meshStandardMaterial color="#818e8a" metalness={0.3} roughness={0.6} /></mesh>
      {[-37, -24, -11, 11, 24, 37].map((x) => <mesh key={x} position={[x, 76, 34.2]}><boxGeometry args={[1.1, 148, 0.8]} /><meshStandardMaterial color="#d5d9d2" metalness={0.18} roughness={0.65} /></mesh>)}
      {[-1, 1].map((side) => <mesh key={`bay-${side}`} position={[side * 5.2, 52, 34.8]}><boxGeometry args={[7.2, 98, 0.8]} /><meshStandardMaterial color="#85908b" metalness={0.22} roughness={0.74} /></mesh>)}
      {Array.from({ length: 19 }, (_, i) => <mesh key={i} position={[0, 5 + i * 8, 34.5]}><boxGeometry args={[80, 0.65, 0.55]} /><meshStandardMaterial color={i % 3 === 0 ? "#9ea9a4" : "#ced4cf"} metalness={0.2} roughness={0.7} /></mesh>)}
      <mesh position={[0, 74, 34.65]}><boxGeometry args={[19, 17, 0.7]} /><meshStandardMaterial color="#66716e" roughness={0.8} /></mesh>
      <FacilitySign first="NASA · KENNEDY SPACE CENTER" second="VEHICLE ASSEMBLY BUILDING" size={[22, 8]} position={[0, 128, 35]} />
      <mesh position={[0, 6, 34.7]}><planeGeometry args={[20, 8]} /><meshBasicMaterial color="#4d5b5c" /></mesh>
      <mesh position={[0, 6, 34.5]}><planeGeometry args={[17, 5]} /><meshBasicMaterial color="#d7ddd4" /></mesh>
      <mesh position={[0, 6, 34.4]}><planeGeometry args={[15, 3.7]} /><meshBasicMaterial color="#253c45" /></mesh>
      <mesh position={[0, 6, 34.3]}><planeGeometry args={[13, 2.8]} /><meshBasicMaterial color="#e6e7dc" /></mesh>
    </group>
    <group position={[4.4, 0, -2.4]} scale={[1.1, 6.2, 1.1]}>
      {[-2.7, 2.7].map((x) => <mesh key={x} position={[x, 4.7, 0.2]}><boxGeometry args={[0.18, 9.2, 0.18]} /><meshStandardMaterial color="#d1a64d" metalness={0.62} roughness={0.32} /></mesh>)}
      {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[0, 1.4 + i * 1.15, 0.2]}><boxGeometry args={[5.5, 0.1, 0.14]} /><meshStandardMaterial color="#d1a64d" metalness={0.55} roughness={0.36} /></mesh>)}
      {[-2.45, 2.45].map((x) => <mesh key={x} position={[x, 5, 0.2]} rotation={[0, 0, -0.42]}><boxGeometry args={[0.1, 1.3, 0.12]} /><meshStandardMaterial color="#d1a64d" metalness={0.55} /></mesh>)}
      {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[-2.3 + i * 0.92, 6.4, 0.34]}><boxGeometry args={[0.08, 0.65, 0.08]} /><meshStandardMaterial color="#929b95" metalness={0.68} /></mesh>)}
      {[-1, 1].map((side) => <mesh key={side} position={[side * 3.45, 5.4, 0]}><boxGeometry args={[1.35, 0.3, 0.8]} /><meshStandardMaterial color="#c7ceca" metalness={0.36} /></mesh>)}
    </group>
    <group position={[0, -0.02, -2.5]}>
      <mesh position={[0, -0.01, -14]}><boxGeometry args={[11, 0.1, 4]} /><meshStandardMaterial color="#4c4f4a" roughness={0.94} /></mesh>
      {[-4.2, 4.2].map((x) => <mesh key={x} position={[x, -0.12, -14]}><boxGeometry args={[0.42, 0.25, 5]} /><meshStandardMaterial color="#252b2a" metalness={0.42} roughness={0.68} /></mesh>)}
      {[-1, 1].map((side) => <mesh key={side} position={[side * 8.8, 0.03, -2]}><boxGeometry args={[0.13, 0.025, 25]} /><meshBasicMaterial color="#f2ead0" /></mesh>)}
      {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[-7.2 + i * 2.05, 0.04, 7.6]}><boxGeometry args={[0.12, 0.025, 0.8]} /><meshBasicMaterial color="#e2e1d4" /></mesh>)}
    </group>
    {[-1, 1].map((side) => <group key={`tank-${side}`} position={[side * 41, 0, -16]}>
      <mesh position={[0, 10, 0]}><cylinderGeometry args={[3, 3, 20, 24]} /><meshStandardMaterial color="#c3c9c1" roughness={0.54} /></mesh>
      <mesh position={[0, 20, 0]}><sphereGeometry args={[3, 24, 16]} /><meshStandardMaterial color="#d5d9d1" roughness={0.54} /></mesh>
      <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.28, 0.42, 1.2, 16]} /><meshStandardMaterial color="#677570" metalness={0.56} /></mesh>
    </group>)}
  </group>;
}

function Earth({ altitude }: { altitude: number }) {
  const ref = useRef<THREE.Group>(null);
  const land = [[-2.7, 1.4, 0.7], [-1, 2.6, 0.9], [1.5, 1.8, 1.1], [2.3, -0.3, 0.7], [-1.4, -1.1, 0.75], [0.2, -2.4, 0.9], [3.1, 2.4, 0.6]];
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.008;
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, -1 - altitude * 0.065, dt, 0.7);
    ref.current.scale.setScalar(THREE.MathUtils.mapLinear(clamp(altitude, 0, 160), 0, 160, 1, 0.74));
  });
  return <group ref={ref} position={[0, -1, -42]}>
    <mesh><sphereGeometry args={[9.2, 64, 48]} /><meshStandardMaterial color="#176bb0" roughness={0.86} /></mesh>
    {land.map(([x, y, size], i) => <mesh key={i} position={[x, y, Math.sqrt(Math.max(0, 9.15 ** 2 - x ** 2 - y ** 2))]} rotation={[0, 0, (i * 0.7) % 2]} scale={[size * 1.4, size, 0.12]}><sphereGeometry args={[1, 24, 18]} /><meshStandardMaterial color={i % 2 ? "#65935b" : "#3e8054"} roughness={0.95} /></mesh>)}
    <mesh scale={1.016}><sphereGeometry args={[9.2, 48, 36]} /><meshBasicMaterial color="#68baff" transparent opacity={0.12} side={THREE.BackSide} depthWrite={false} /></mesh>
  </group>;
}

function Habitat() {
  return <group position={[1.5, 0, -15]}>
    <mesh position={[0, 1.25, 0]} castShadow><cylinderGeometry args={[2.1, 2.25, 2.5, 48]} /><meshStandardMaterial color="#bbc5c5" metalness={0.46} roughness={0.4} /></mesh>
    <mesh position={[0, 2.5, 0]}><sphereGeometry args={[2.1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#dce0dc" metalness={0.3} roughness={0.4} /></mesh>
    <mesh position={[0, 1.15, 2.12]}><boxGeometry args={[1.32, 1.35, 0.07]} /><meshPhysicalMaterial color="#0e3547" metalness={0.55} roughness={0.12} clearcoat={1} /></mesh>
    <mesh position={[0, 0.55, 2.35]}><boxGeometry args={[1.1, 0.07, 0.04]} /><meshBasicMaterial color="#85e6c0" toneMapped={false} /></mesh>
    {[-1.45, -0.72, 0, 0.72, 1.45].map((x) => <mesh key={x} position={[x, 0.2, 1.25]}><cylinderGeometry args={[0.065, 0.09, 0.42, 12]} /><meshStandardMaterial color="#58696d" metalness={0.74} /></mesh>)}
    {[-1, 1].map((side) => <group key={side} position={[side * 4.7, 0, -1]}>
      <mesh position={[0, 0.85, 0]}><boxGeometry args={[3.1, 1.7, 0.22]} /><meshStandardMaterial color="#364f63" metalness={0.42} /></mesh>
      {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[-1.25 + i * 0.5, 0.85, 0.14]}><boxGeometry args={[0.44, 1.36, 0.025]} /><meshStandardMaterial color="#234c72" metalness={0.55} emissive="#143c61" emissiveIntensity={0.22} /></mesh>)}
    </group>)}
    <mesh position={[-2.8, 0.65, 0.2]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.48, 0.48, 1.7, 24]} /><meshStandardMaterial color="#d1d5d0" metalness={0.56} /></mesh>
    <mesh position={[-2.8, 1.55, 0.2]}><cylinderGeometry args={[0.035, 0.035, 1.9, 10]} /><meshStandardMaterial color="#7f8986" metalness={0.72} /></mesh>
    <mesh position={[-2.8, 2.55, 0.2]}><sphereGeometry args={[0.18, 20, 16]} /><meshBasicMaterial color="#6de4c4" toneMapped={false} /></mesh>
    <mesh position={[0, 0.12, 3.7]}><boxGeometry args={[2.7, 0.12, 2.5]} /><meshStandardMaterial color="#686f6c" metalness={0.38} /></mesh>
  </group>;
}

function MoonSurface({ stage }: { stage: Stage }) {
  const rocks = useMemo(() => Array.from({ length: 85 }, (_, i) => ({ x: ((i * 43) % 61) - 30, z: -35 + ((i * 29) % 54), size: 0.08 + ((i * 17) % 42) / 100 })), []);
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, -5]}><planeGeometry args={[180, 180, 64, 64]} /><meshStandardMaterial color={stage === "outside" || stage === "entering" ? "#aaa79e" : "#77776e"} roughness={1} /></mesh>
    {rocks.map((r, i) => <mesh key={i} position={[r.x, -0.08 + r.size * 0.2, r.z]} rotation={[i * 0.16, i * 0.48, i * 0.09]} scale={[r.size * 1.6, r.size * 0.75, r.size]}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={i % 3 ? "#85847c" : "#b0a99c"} roughness={1} /></mesh>)}
    {[-7.5, 8].map((x, i) => <mesh key={x} position={[x, -0.02, -13]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.2 + i, 2.7 + i, 48]} /><meshStandardMaterial color="#53534e" roughness={1} /></mesh>)}
    <mesh position={[0, 0.015, -8]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[4.4, 64]} /><meshStandardMaterial color="#929087" roughness={0.94} /></mesh><Habitat />
    <group position={[-4, 0, -2]}>
      <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.8, 0.95, 1.8, 8]} /><meshStandardMaterial color="#d4d5cd" metalness={0.48} roughness={0.42} /></mesh>
      <mesh position={[0, 2.55, 0]}><coneGeometry args={[0.8, 0.4, 8]} /><meshStandardMaterial color="#e0dfd5" metalness={0.4} roughness={0.4} /></mesh>
      <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.35, 0.7, 0.55, 12]} /><meshStandardMaterial color="#4e5b5b" metalness={0.68} roughness={0.32} /></mesh>
      {[-1, 1].map((side) => <group key={side} position={[side * 0.75, 0.45, 0]}>
        <mesh position={[side * 0.22, -0.25, 0]} rotation={[0, 0, -side * 0.45]}><cylinderGeometry args={[0.045, 0.055, 0.8, 10]} /><meshStandardMaterial color="#aab3ab" metalness={0.76} /></mesh>
        <mesh position={[side * 0.47, -0.61, 0]}><boxGeometry args={[0.56, 0.08, 0.34]} /><meshStandardMaterial color="#65706b" metalness={0.58} /></mesh>
      </group>)}
      <mesh position={[0, -0.02, 0]}><coneGeometry args={[0.32, 0.78, 20]} /><meshBasicMaterial color="#ed9b53" /></mesh>
    </group>
  </group>;
}

function FlightDisplay({ flight, kind }: { flight: FlightState; kind: "attitude" | "systems" | "navigation" }) {
  const screen = useRef<THREE.Mesh>(null);
  const canvas = useMemo(() => document.createElement("canvas"), []);
  const texture = useMemo(() => {
    canvas.width = 640;
    canvas.height = 360;
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    return map;
  }, [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current < 0.12) return;
    elapsed.current = 0;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#0a171b");
    background.addColorStop(1, "#13282a");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(130,180,166,.11)";
    ctx.lineWidth = 1;
    for (let x = 16; x < width; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 16; y < height; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.fillStyle = "#a7c3b9";
    ctx.font = "600 19px monospace";
    ctx.fillText(kind === "attitude" ? "ATTITUDE / FLIGHT DIRECTOR" : kind === "systems" ? "VEHICLE SYSTEMS" : "NAVIGATION / TRACK", 22, 31);
    ctx.fillStyle = "#5d8178";
    ctx.font = "14px monospace";
    ctx.fillText("CFV • PRIMARY FLIGHT DISPLAY", 22, 54);

    if (kind === "attitude") {
      const cx = 320;
      const cy = 204;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 116, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(cx, cy);
      ctx.rotate(-THREE.MathUtils.degToRad(flight.heading) * 0.1);
      const horizon = THREE.MathUtils.mapLinear(flight.pitch, -90, 90, 85, -85);
      ctx.fillStyle = "#1b5670";
      ctx.fillRect(-150, -150 + horizon, 300, 150);
      ctx.fillStyle = "#514a38";
      ctx.fillRect(-150, horizon, 300, 150);
      ctx.strokeStyle = "#e1e8d7";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-150, horizon); ctx.lineTo(150, horizon); ctx.stroke();
      ctx.strokeStyle = "rgba(230,239,221,.78)";
      ctx.lineWidth = 2;
      for (const offset of [-60, -30, 30, 60]) {
        ctx.beginPath(); ctx.moveTo(-45, horizon + offset); ctx.lineTo(45, horizon + offset); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = "#e2c77f";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, 117, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 46, cy); ctx.lineTo(cx - 14, cy); ctx.moveTo(cx + 14, cy); ctx.lineTo(cx + 46, cy); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();
      ctx.fillStyle = "#e9d38c";
      ctx.font = "bold 28px monospace";
      ctx.fillText(`${Math.round(flight.pitch)}°`, 26, 330);
      ctx.fillText(`${Math.round(flight.heading).toString().padStart(3, "0")}°`, 504, 330);
      ctx.fillStyle = "#8be0ba";
      ctx.font = "17px monospace";
      ctx.fillText("ATT HOLD", 264, 345);
    } else if (kind === "systems") {
      const rows = [
        ["GUIDANCE COMPUTER", flight.stage === "crashed" ? "ABORT" : "NOMINAL"],
        ["CABIN PRESSURE", "101.3 kPa"],
        ["THERMAL LOOP", "21.4 °C"],
        ["OXYGEN RESERVE", "98.6 %"],
        ["RCS MANIFOLD", "2.84 MPa"],
        ["MAIN ENGINE", `${Math.round(flight.throttle)} %`],
      ];
      rows.forEach(([label, value], i) => {
        const y = 91 + i * 40;
        ctx.fillStyle = "#91aaa1"; ctx.font = "16px monospace"; ctx.fillText(label, 24, y);
        ctx.textAlign = "right";
        ctx.fillStyle = flight.stage === "crashed" && i === 0 ? "#f09b83" : "#89dfb4";
        ctx.fillText(value, width - 24, y);
        ctx.textAlign = "left";
        ctx.strokeStyle = "rgba(130,180,166,.2)"; ctx.beginPath(); ctx.moveTo(24, y + 11); ctx.lineTo(width - 24, y + 11); ctx.stroke();
      });
      const minutes = Math.floor(flight.elapsedSeconds / 60);
      const seconds = Math.floor(flight.elapsedSeconds % 60).toString().padStart(2, "0");
      ctx.fillStyle = "#e2c77f"; ctx.font = "15px monospace"; ctx.fillText(`MISSION ELAPSED  T+${minutes}:${seconds}`, 24, 322);
      ctx.fillStyle = "#89dfb4"; ctx.font = "13px monospace"; ctx.fillText("XR: LEFT STICK WALK / THROTTLE   RIGHT STICK ATTITUDE", 24, 344);
    } else {
      const cx = 318; const cy = 205; const radius = 116;
      ctx.strokeStyle = "rgba(133,190,166,.5)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, radius * 0.66, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy); ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius); ctx.stroke();
      for (let angle = 0; angle < 360; angle += 30) {
        const rad = THREE.MathUtils.degToRad(angle - flight.heading);
        const x = cx + Math.sin(rad) * radius * 0.8;
        const y = cy - Math.cos(rad) * radius * 0.8;
        ctx.fillStyle = "#91b3a6"; ctx.font = "15px monospace"; ctx.textAlign = "center";
        ctx.fillText(String(angle / 10), x, y + 5);
      }
      ctx.textAlign = "left";
      const moonX = cx + Math.sin(THREE.MathUtils.degToRad(MOON_HEADING - flight.heading)) * radius * 0.68;
      const moonY = cy - Math.cos(THREE.MathUtils.degToRad(MOON_HEADING - flight.heading)) * radius * 0.68;
      ctx.fillStyle = "#ddc982"; ctx.beginPath(); ctx.arc(moonX, moonY, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#eff2d8"; ctx.beginPath(); ctx.moveTo(cx, cy - 16); ctx.lineTo(cx + 12, cy + 13); ctx.lineTo(cx - 12, cy + 13); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = "#e2c77f"; ctx.font = "bold 24px monospace"; ctx.fillText(`HDG ${Math.round(flight.heading).toString().padStart(3, "0")}°`, 25, 337);
      ctx.fillStyle = "#89dfb4"; ctx.font = "16px monospace"; ctx.fillText("EARTH  ·  MOON", 434, 337);
    }
    texture.needsUpdate = true;
    if (screen.current) screen.current.rotation.y = 0;
  });
  return <mesh ref={screen} position={[0, 0, 0.045]}>
    <planeGeometry args={[1.28, 0.72]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}

function Cockpit({ stage, flight }: { stage: Stage; flight: FlightState }) {
  const toggles = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    x: -2.55 + (i % 8) * 0.73,
    z: 1.22 + Math.floor(i / 8) * 0.33,
    active: i % 5 === 0,
  })), []);
  return <group>
    <mesh position={[0, 4.35, -1.55]}><boxGeometry args={[6.65, 0.18, 0.34]} /><meshStandardMaterial color="#202a2b" metalness={0.58} roughness={0.38} /></mesh>
    <mesh position={[-3.25, 2.75, -1.55]}><boxGeometry args={[0.18, 3.15, 0.34]} /><meshStandardMaterial color="#202a2b" metalness={0.58} roughness={0.38} /></mesh>
    <mesh position={[3.25, 2.75, -1.55]}><boxGeometry args={[0.18, 3.15, 0.34]} /><meshStandardMaterial color="#202a2b" metalness={0.58} roughness={0.38} /></mesh>
    <mesh position={[0, 1.18, -1.55]}><boxGeometry args={[6.65, 0.18, 0.34]} /><meshStandardMaterial color="#202a2b" metalness={0.58} roughness={0.38} /></mesh>
    <mesh position={[0, 2.76, -1.72]}><planeGeometry args={[6.3, 2.94]} /><meshPhysicalMaterial color="#8db9c4" transparent opacity={0.1} roughness={0.12} metalness={0.16} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    {[-2.25, 0, 2.25].map((x) => <mesh key={x} position={[x, 2.77, -1.57]}><boxGeometry args={[0.055, 2.95, 0.12]} /><meshStandardMaterial color="#344246" metalness={0.74} roughness={0.32} /></mesh>)}
    <mesh position={[0, 2.78, -1.49]}><boxGeometry args={[0.035, 2.85, 0.08]} /><meshStandardMaterial color="#acb5ab" metalness={0.66} roughness={0.28} /></mesh>

    {[-3.53, 3.53].map((x) => <mesh key={x} position={[x, 2.35, 1.8]}><boxGeometry args={[0.24, 4.5, 8]} /><meshStandardMaterial color="#192327" metalness={0.44} roughness={0.48} /></mesh>)}
    <mesh position={[0, 4.46, 1.8]}><boxGeometry args={[7.15, 0.24, 8]} /><meshStandardMaterial color="#192327" metalness={0.44} roughness={0.48} /></mesh>
    <mesh position={[0, 0.16, 1.8]}><boxGeometry args={[7.08, 0.24, 8]} /><meshStandardMaterial color="#202a29" metalness={0.38} roughness={0.56} /></mesh>
    <mesh position={[0, 2.35, 5.78]}><boxGeometry args={[7.08, 4.5, 0.24]} /><meshStandardMaterial color="#252e2d" metalness={0.38} roughness={0.54} /></mesh>
    <mesh position={[0, 2.5, 5.64]}><boxGeometry args={[1.75, 2.45, 0.035]} /><meshStandardMaterial color="#111918" metalness={0.62} roughness={0.42} /></mesh>
    <mesh position={[0, 2.5, 5.6]}><torusGeometry args={[0.52, 0.055, 10, 36]} /><meshStandardMaterial color="#78837c" metalness={0.72} roughness={0.34} /></mesh>
    {[-2.8, -1.4, 0, 1.4, 2.8].map((x) => <mesh key={x} position={[x, 4.27, -0.35]} rotation={[0, 0, 0.08 * Math.sign(x)]}><boxGeometry args={[0.045, 0.36, 2.5]} /><meshStandardMaterial color="#53615d" metalness={0.72} roughness={0.36} /></mesh>)}
    <mesh position={[0, 0.86, 1.65]} rotation={[-0.12, 0, 0]}><boxGeometry args={[6.5, 0.55, 2.5]} /><meshStandardMaterial color="#283333" metalness={0.48} roughness={0.44} /></mesh>
    <mesh position={[0, 1.04, 0.35]} rotation={[-0.1, 0, 0]}><boxGeometry args={[6.25, 0.95, 0.26]} /><meshStandardMaterial color="#333f3d" metalness={0.62} roughness={0.38} /></mesh>
    {[-2.55, 0, 2.55].map((x, index) => <group key={x} position={[x, 1.9, 0.75]}>
      <mesh position={[0, 0, -0.055]}><boxGeometry args={[1.46, 0.9, 0.12]} /><meshStandardMaterial color="#101819" metalness={0.78} roughness={0.28} /></mesh>
      <FlightDisplay flight={flight} kind={index === 0 ? "attitude" : index === 1 ? "systems" : "navigation"} />
      <mesh position={[0, 0, -0.12]}><boxGeometry args={[1.52, 0.96, 0.035]} /><meshStandardMaterial color="#66716b" metalness={0.82} roughness={0.24} /></mesh>
      <mesh position={[0, 0, -0.095]}><boxGeometry args={[1.36, 0.81, 0.025]} /><meshStandardMaterial color="#071012" metalness={0.2} roughness={0.24} /></mesh>
    </group>)}
    {toggles.map((item, i) => <group key={i} position={[item.x, 1.34, item.z]}>
      <mesh position={[0, 0, -0.08]}><cylinderGeometry args={[0.105, 0.12, 0.12, 16]} /><meshStandardMaterial color="#171e1d" metalness={0.75} roughness={0.3} /></mesh>
      <mesh position={[0, 0.09, -0.02]} rotation={[0.18, 0, item.active ? -0.25 : 0.25]}><cylinderGeometry args={[0.025, 0.035, 0.18, 10]} /><meshStandardMaterial color="#c2b99d" metalness={0.82} roughness={0.25} /></mesh>
      <mesh position={[0.12, 0.19, -0.01]}><sphereGeometry args={[0.027, 8, 8]} /><meshBasicMaterial color={item.active ? "#79d8ae" : "#e4aa60"} toneMapped={false} /></mesh>
    </group>)}
    {[-2.7, -1.8, 1.8, 2.7].map((x, i) => <group key={x} position={[x, 0.98, 0.38]}>
      <mesh><cylinderGeometry args={[0.115, 0.15, 0.12, 24]} /><meshStandardMaterial color="#171e1d" metalness={0.8} roughness={0.25} /></mesh>
      <mesh position={[0, 0.105, 0]}><cylinderGeometry args={[0.09, 0.11, 0.12, 20]} /><meshStandardMaterial color={i % 2 ? "#b2a27a" : "#718782"} metalness={0.76} roughness={0.29} /></mesh>
      <mesh position={[0, 0.17, 0.04]}><boxGeometry args={[0.025, 0.035, 0.08]} /><meshBasicMaterial color="#e7e1cf" /></mesh>
    </group>)}

    <mesh position={[0, 0.57, 1.5]} rotation={[-0.1, 0, 0]}><boxGeometry args={[2.7, 0.12, 0.95]} /><meshStandardMaterial color="#151c1b" metalness={0.7} roughness={0.3} /></mesh>
    <mesh position={[0, 1.2, 2.7]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.09, 0.13, 0.75, 16]} /><meshStandardMaterial color="#8b8a79" metalness={0.82} roughness={0.25} /></mesh>
    <mesh position={[0, 1.55, 2.36]}><torusGeometry args={[0.38, 0.055, 12, 48]} /><meshStandardMaterial color="#b8ad8d" metalness={0.78} roughness={0.24} /></mesh>
    <mesh position={[0, 1.55, 2.36]}><boxGeometry args={[0.055, 0.73, 0.06]} /><meshStandardMaterial color="#92896f" metalness={0.7} roughness={0.28} /></mesh>
    <mesh position={[-1.18, 1.5, 2.35]} rotation={[0, 0, -0.16]}><cylinderGeometry args={[0.055, 0.07, 0.62, 12]} /><meshStandardMaterial color="#c1aa73" metalness={0.75} roughness={0.24} /></mesh>
    <mesh position={[1.18, 1.5, 2.35]} rotation={[0, 0, 0.16]}><cylinderGeometry args={[0.055, 0.07, 0.62, 12]} /><meshStandardMaterial color="#c1aa73" metalness={0.75} roughness={0.24} /></mesh>
    <mesh position={[0, 4.28, 1.15]}><boxGeometry args={[0.52, 0.09, 0.3]} /><meshStandardMaterial color="#4f5a55" metalness={0.68} roughness={0.32} /></mesh>
    {[-2.9, 2.9].map((x, i) => <group key={x} position={[x, 2.9, 0.65]}>
      <mesh position={[0, 0, -0.15]}><cylinderGeometry args={[0.24, 0.28, 0.2, 32]} /><meshStandardMaterial color="#111918" metalness={0.78} roughness={0.26} /></mesh>
      <mesh><cylinderGeometry args={[0.19, 0.19, 0.05, 32]} /><meshStandardMaterial color="#c3b78f" metalness={0.74} roughness={0.22} /></mesh>
      <mesh position={[0, 0.035, 0.11]} rotation={[0, 0, i ? 0.6 : -0.6]}><boxGeometry args={[0.02, 0.13, 0.012]} /><meshBasicMaterial color="#dc5546" /></mesh>
    </group>)}
    <mesh position={[0, 1.14, 2.94]}><boxGeometry args={[0.38, 0.22, 0.08]} /><meshStandardMaterial color="#a83e34" metalness={0.46} roughness={0.35} /></mesh>
    <pointLight position={[0, 1.8, 1.1]} color="#81b99c" intensity={stage === "landing" ? 0.4 : 0.22} distance={7} />
  </group>;
}

function AscentClouds({ altitude }: { altitude: number }) {
  const clouds = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!clouds.current) return;
    clouds.current.position.y = -altitude * 0.26;
    clouds.current.scale.setScalar(clamp(1 - altitude / 14, 0.01, 1));
  });
  return <group ref={clouds} position={[0, 0, -14]}>
    {[[-3.2, 1.2, 0], [-1.1, 2.3, -2], [1.4, 1.5, -0.8], [3.2, 2.1, -2.6], [-2.2, -0.5, -5], [0.4, 0.3, -4.2], [2.6, -0.3, -5.4]].map(([x, y, z], i) => (
      <mesh key={i} position={[x, y, z]} scale={[1.7 + i % 3, 0.7 + (i % 2) * 0.35, 1.3]}>
        <sphereGeometry args={[1, 18, 12]} />
        <meshBasicMaterial color="#f4f7f6" transparent opacity={0.48} depthWrite={false} />
      </mesh>
    ))}
  </group>;
}

function LaunchWindow({ altitude }: { altitude: number }) {
  const scene = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!scene.current) return;
    scene.current.position.y = -altitude * 0.45;
    scene.current.scale.setScalar(clamp(1 - altitude / 30, 0.001, 1));
  });
  return <group ref={scene} position={[0, 0, -26]}>
    <mesh position={[0, -2, -8]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[280, 280]} /><meshStandardMaterial color="#68766b" roughness={1} /></mesh>
    <mesh position={[0, -1.92, -8]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[13, 48]} /><meshStandardMaterial color="#88877e" roughness={0.92} /></mesh>
    <mesh position={[0, -1.86, -20]}><boxGeometry args={[14, 0.14, 32]} /><meshStandardMaterial color="#333b39" roughness={0.88} /></mesh>
    <mesh position={[8, 9, -23]}><boxGeometry args={[1.8, 22, 1.8]} /><meshStandardMaterial color="#657d83" metalness={0.64} roughness={0.38} /></mesh>
    {[-1, 1].map((side) => <group key={side} position={[8 + side * 1.3, 9, -23]}>
      <mesh><boxGeometry args={[0.15, 23, 0.15]} /><meshStandardMaterial color="#c2a056" metalness={0.65} /></mesh>
      {Array.from({ length: 10 }, (_, i) => <mesh key={i} position={[-side * 0.42, -10 + i * 2.2, 0]}><boxGeometry args={[1.25, 0.09, 0.09]} /><meshStandardMaterial color="#c2a056" metalness={0.62} /></mesh>)}
    </group>)}
    {[-1, 1].map((side) => <mesh key={`stack-${side}`} position={[side * 15, 1, -35]}><cylinderGeometry args={[2.1, 2.1, 2.2, 24]} /><meshStandardMaterial color="#b9c0ba" metalness={0.28} roughness={0.62} /></mesh>)}
    <mesh position={[0, 0, -55]}><boxGeometry args={[42, 2, 3]} /><meshStandardMaterial color="#7e8980" roughness={0.8} /></mesh>
  </group>;
}

function MoonApproach({ stage, flight }: { stage: Stage; flight: FlightState }) {
  const moon = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!moon.current) return;
    const visible = stage === "orbit" || stage === "transfer";
    moon.current.visible = visible;
    if (!visible) return;
    const progress = stage === "transfer" ? clamp(flight.transferSeconds / 8, 0, 1) : 0;
    const distance = 26 - progress * 12;
    const angle = THREE.MathUtils.degToRad(MOON_HEADING);
    moon.current.position.set(Math.sin(angle) * distance, 4, -Math.cos(angle) * distance);
    moon.current.scale.setScalar(1 + progress * 1.3);
  });
  return <group ref={moon}>
    <mesh><sphereGeometry args={[3, 48, 36]} /><meshStandardMaterial color="#b1aaa0" roughness={1} /></mesh>
    <mesh scale={1.07}><sphereGeometry args={[3, 32, 24]} /><meshBasicMaterial color="#c4d4ed" transparent opacity={0.09} side={THREE.BackSide} depthWrite={false} /></mesh>
  </group>;
}

function LanderVehicle() {
  return <group>
    <mesh position={[0, 2.25, 0]}><cylinderGeometry args={[0.85, 1.05, 2.2, 8]} /><meshStandardMaterial color="#c8c6b8" metalness={0.58} roughness={0.38} /></mesh>
    <mesh position={[0, 3.55, 0]}><coneGeometry args={[0.85, 0.55, 8]} /><meshStandardMaterial color="#d8d5c8" metalness={0.48} roughness={0.4} /></mesh>
    <mesh position={[0, 1.08, 0]}><cylinderGeometry args={[0.4, 0.75, 0.38, 12]} /><meshStandardMaterial color="#525d5d" metalness={0.72} roughness={0.32} /></mesh>
    {[-1, 1].map((side) => <group key={side} position={[side * 0.72, 0.7, 0]}>
      <mesh position={[side * 0.28, 0, 0]} rotation={[0, 0, -side * 0.38]}><cylinderGeometry args={[0.045, 0.06, 1.4, 10]} /><meshStandardMaterial color="#aab0a8" metalness={0.8} /></mesh>
      <mesh position={[side * 0.62, -0.55, 0]}><boxGeometry args={[0.8, 0.1, 0.5]} /><meshStandardMaterial color="#616b67" metalness={0.62} /></mesh>
    </group>)}
    <mesh position={[0, 0.25, 0]}><coneGeometry args={[0.3, 0.7, 20]} /><meshBasicMaterial color="#ffbd69" /></mesh>
  </group>;
}

function ExternalViewScene({ stage, telemetry }: { stage: Stage; telemetry: FlightState }) {
  const { camera } = useThree();
  const rocket = stage === "ascent";
  const altitude = rocket ? clamp(telemetry.altitude, 0, ORBIT_ALTITUDE) : clamp(telemetry.altitude, 0, 2.4);
  const rocketHeight = altitude * 0.65;
  const landerHeight = altitude * 9;
  useFrame(() => {
    if (rocket) {
      const focusY = rocketHeight + 31;
      camera.position.set(98, focusY + 58, 122);
      camera.lookAt(0, focusY, 0);
    } else {
      const distance = 18 + landerHeight * 0.8;
      camera.position.set(distance * 0.76, landerHeight + distance * 0.92, distance * 0.86);
      camera.lookAt(0, landerHeight * 0.42, 0);
    }
  });
  return <>
    <color attach="background" args={[rocket ? altitude > 18 ? "#020712" : "#6daed0" : "#080b11"]} />
    <ambientLight intensity={rocket ? 0.8 : 0.62} />
    <directionalLight position={[-30, 55, 35]} intensity={rocket ? 2.1 : 2.5} color="#fff0d2" />
    {rocket ? <>
      <LaunchComplex />
      <LaunchVehicle position={[0, rocketHeight, -2.5]} stage={stage} />
      {Array.from({ length: 18 }, (_, i) => <mesh key={i} position={[Math.sin(i * 3.7) * 35, 8 + (i % 5) * 3, -28 - (i % 4) * 15]} scale={[3 + (i % 3), 1.4, 2.5]}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color="#f7f7ef" transparent opacity={Math.max(0.04, 0.44 - altitude * 0.025)} /></mesh>)}
      {altitude > 16 && <>
        <mesh position={[0, -145, -105]}><sphereGeometry args={[112, 40, 30]} /><meshStandardMaterial color="#236ca1" roughness={0.84} /></mesh>
        <mesh position={[0, -145, -105]} scale={1.025}><sphereGeometry args={[112, 32, 24]} /><meshBasicMaterial color="#76bfff" transparent opacity={0.18} side={THREE.BackSide} depthWrite={false} /></mesh>
      </>}
      {altitude > 24 && <Stars radius={220} depth={160} count={700} factor={3} saturation={0.1} fade speed={0.05} />}
    </> : <>
      <mesh position={[0, -0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[180, 180, 32, 32]} /><meshStandardMaterial color="#8a8981" roughness={1} /></mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[4.5, 5.6, 56]} /><meshBasicMaterial color="#d0c18e" /></mesh>
      {Array.from({ length: 32 }, (_, i) => <mesh key={i} position={[Math.sin(i * 9.2) * (9 + (i % 5) * 4), 0, -7 - (i % 8) * 5]} rotation={[0, i * 0.7, 0]} scale={[0.3 + (i % 3) * 0.2, 0.18 + (i % 4) * 0.12, 0.28 + (i % 3) * 0.16]}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={i % 3 ? "#77766e" : "#a7a397"} roughness={1} /></mesh>)}
      <group position={[0, landerHeight, 0]}><LanderVehicle /></group>
    </>}
  </>;
}

function FlightScene({ flight, keys, stage, onStageChange, onTelemetry }: {
  flight: MutableRefObject<FlightState>; keys: MutableRefObject<Set<string>>;
  stage: Stage; onStageChange: (stage: Stage) => void; onTelemetry: (state: FlightState) => void;
}) {
  const { camera, gl } = useThree();
  const cameraPosition = useRef(new THREE.Vector3(0, 1.72, PAD_APPROACH_DISTANCE - 2.5));
  const lookYaw = useRef(0);
  const lookPitch = useRef(0);
  useEffect(() => {
    const canvas = gl.domElement;
    const requestLook = () => {
      if (!gl.xr.isPresenting && document.pointerLockElement !== canvas) canvas.requestPointerLock();
    };
    const trackLook = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      lookYaw.current = clamp(lookYaw.current - event.movementX * 0.0022, -1.25, 1.25);
      lookPitch.current = clamp(lookPitch.current - event.movementY * 0.0018, -0.58, 0.58);
    };
    canvas.addEventListener("click", requestLook);
    window.addEventListener("mousemove", trackLook);
    return () => {
      canvas.removeEventListener("click", requestLook);
      window.removeEventListener("mousemove", trackLook);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [gl]);
  useEffect(() => {
    lookYaw.current = 0;
    lookPitch.current = 0;
  }, [stage]);
  useFrame((frame, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = flight.current;
    const k = keys.current;
    if (!["approach", "boarding", "startup", "landed", "outside", "entering"].includes(s.stage)) s.elapsedSeconds += dt;
    const axes = { walk: 0, throttle: 0, heading: 0, pitch: 0, trigger: false };
    if (gl.xr.isPresenting) {
      for (const source of gl.xr.getSession()?.inputSources ?? []) {
        const gamepad = source.gamepad;
        if (!gamepad) continue;
        const x = gamepad.axes[2] ?? gamepad.axes[0] ?? 0;
        const y = gamepad.axes[3] ?? gamepad.axes[1] ?? 0;
        const deadZone = (value: number) => Math.abs(value) < 0.16 ? 0 : value;
        if (source.handedness === "left") {
          axes.walk = -deadZone(y);
          axes.throttle = -deadZone(y);
          axes.trigger ||= Boolean(gamepad.buttons[0]?.pressed);
        } else if (source.handedness === "right") {
          axes.heading = deadZone(x);
          axes.pitch = -deadZone(y);
          axes.trigger ||= Boolean(gamepad.buttons[0]?.pressed);
        }
      }
    }
    const walkInput = Number(k.has("w")) - Number(k.has("s")) + axes.walk;
    const strafeInput = Number(k.has("d")) - Number(k.has("a"));
    const throttleInput = Number(k.has("w")) - Number(k.has("s")) + axes.throttle;
    const headingInput = Number(k.has("d")) - Number(k.has("a")) + axes.heading;
    const pitchInput = Number(k.has("e")) - Number(k.has("q")) + axes.pitch;
    lookYaw.current = clamp(lookYaw.current + (Number(k.has("arrowright")) - Number(k.has("arrowleft"))) * dt * 1.25, -1.25, 1.25);
    lookPitch.current = clamp(lookPitch.current + (Number(k.has("arrowup")) - Number(k.has("arrowdown"))) * dt * 1.05, -0.58, 0.58);
    if (s.stage === "approach") {
      const yaw = s.yaw + lookYaw.current;
      const forward = walkInput * dt * 3.2;
      const sideways = strafeInput * dt * 3.2;
      s.walkX += Math.sin(yaw) * forward + Math.cos(yaw) * sideways;
      s.walkZ += -Math.cos(yaw) * forward + Math.sin(yaw) * sideways;
      s.walkDistance = clamp(PAD_APPROACH_DISTANCE - Math.hypot(s.walkX, s.walkZ + 2.5), 0, PAD_APPROACH_DISTANCE - 3);
      if (Math.hypot(s.walkX, s.walkZ + 2.5) <= 3.2) { s.boardingSeconds = 0; onStageChange("boarding"); }
    } else if (s.stage === "boarding") {
      s.boardingSeconds += dt;
      if (s.boardingSeconds >= 1.25) onStageChange("startup");
    } else if (s.stage === "startup" && axes.trigger) {
      s.throttle = 68; s.pitch = 90; s.altitude = 0; s.speed = 0; onStageChange("ascent");
    } else if (s.stage === "ascent") {
      s.throttle = clamp(s.throttle + throttleInput * dt * 24, 0, 100);
      s.pitch = clamp(s.pitch + pitchInput * dt * 22, 0, 90);
      s.heading = (s.heading + headingInput * dt * 24 + 360) % 360;
      s.speed = Math.max(0, s.speed + (s.throttle / 100 * 0.06 - 0.015) * dt);
      s.altitude = Math.max(0, s.altitude + s.speed * Math.sin(THREE.MathUtils.degToRad(s.pitch)) * dt);
      const targetPitch = 90 - clamp(s.altitude / ORBIT_ALTITUDE, 0, 1) * 70;
      if (s.altitude >= ORBIT_ALTITUDE && s.speed >= ORBIT_SPEED && Math.abs(s.pitch - targetPitch) <= 11) {
        s.altitude = ORBIT_ALTITUDE; s.speed = ORBIT_SPEED; s.pitch = 0; s.heading = 0; s.throttle = 0; onStageChange("orbit");
      }
    } else if (s.stage === "orbit") {
      s.heading = clamp(s.heading + headingInput * dt * 32, 0, 180);
      s.pitch = clamp(s.pitch + pitchInput * dt * 22, -30, 30);
      s.throttle = clamp(s.throttle + throttleInput * dt * 24, 0, 100);
      if (Math.abs(s.heading - MOON_HEADING) <= 4 && Math.abs(s.pitch) <= 4 && s.throttle >= 76 && s.throttle <= 88) s.orbitSeconds += dt;
      else s.orbitSeconds = Math.max(0, s.orbitSeconds - dt * 0.8);
      if (axes.trigger && s.orbitSeconds >= 2) {
        s.burnStarted = true;
        s.transferSeconds = 0;
        onStageChange("transfer");
      }
    } else if (s.stage === "transfer") {
      s.heading = clamp(s.heading + headingInput * dt * 20, 0, 180);
      s.pitch = clamp(s.pitch + pitchInput * dt * 18, -30, 30);
      s.throttle = clamp(s.throttle + throttleInput * dt * 22, 0, 100);
      if (s.burnStarted) {
        const aligned = Math.abs(s.heading - MOON_HEADING) <= 7 && Math.abs(s.pitch) <= 7 && s.throttle >= 72;
        s.transferSeconds = aligned ? s.transferSeconds + dt : Math.max(0, s.transferSeconds - dt * 1.5);
        if (s.transferSeconds >= 8) {
          s.altitude = 2.4; s.speed = 0; s.verticalSpeed = -0.032; s.pitch = -80;
          s.throttle = 54; s.heading = MOON_HEADING; s.burnStarted = false; onStageChange("landing");
        }
      }
    } else if (s.stage === "landing") {
      s.throttle = clamp(s.throttle + throttleInput * dt * 36, 0, 100);
      s.pitch = clamp(s.pitch + pitchInput * dt * 18, -100, -55);
      s.verticalSpeed = clamp(s.verticalSpeed + (s.throttle * 0.03 - 1.62) / 1000 * dt, -0.09, 0.035);
      s.altitude += s.verticalSpeed * dt;
      if (s.altitude <= 0.004) {
        if (Math.abs(s.verticalSpeed) <= 0.003 && s.verticalSpeed <= 0.002 && Math.abs(s.pitch + 88) <= 8) {
          s.altitude = 0; s.verticalSpeed = 0; s.throttle = 0; onStageChange("landed");
        } else { s.altitude = 0; onStageChange("crashed"); }
      }
    } else if (s.stage === "landed") {
      if (k.has("w") || axes.trigger) {
        s.walkDistance = 0;
        s.walkX = 0;
        s.walkZ = 0;
        onStageChange("outside");
      }
    } else if (s.stage === "outside") {
      const yaw = s.yaw + lookYaw.current;
      const forward = walkInput * dt * 2.8;
      const sideways = strafeInput * dt * 2.8;
      s.walkX += Math.sin(yaw) * forward + Math.cos(yaw) * sideways;
      s.walkZ += -Math.cos(yaw) * forward + Math.sin(yaw) * sideways;
      s.walkDistance = clamp(s.walkZ, 0, 17);
      if (s.walkDistance >= 16.4) onStageChange("entering");
    }
    const cockpit = ["startup", "ascent", "orbit", "transfer", "landing", "crashed"].includes(s.stage);
    let target: THREE.Vector3;
    let direction: THREE.Vector3;
    if (s.stage === "approach" || s.stage === "boarding") {
      const bob = gl.xr.isPresenting || walkInput === 0 ? 0 : Math.sin(frame.clock.elapsedTime * 9.5) * 0.028;
      target = new THREE.Vector3(s.walkX, 1.72 + bob, s.walkZ);
      const yaw = s.yaw + lookYaw.current;
      direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(lookPitch.current), Math.sin(lookPitch.current), -Math.cos(yaw) * Math.cos(lookPitch.current));
    } else if (cockpit) {
      target = new THREE.Vector3(0, 1.7, 4.2);
      const pitch = lookPitch.current + (s.stage === "landing" ? THREE.MathUtils.degToRad(-20) : 0);
      const yaw = THREE.MathUtils.degToRad(s.heading) + lookYaw.current;
      direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    } else {
      target = new THREE.Vector3(s.stage === "outside" || s.stage === "entering" ? s.walkX : 0, 1.72, 7 - (s.stage === "outside" || s.stage === "entering" ? s.walkZ : 0));
      const yaw = s.yaw + lookYaw.current;
      direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(lookPitch.current), Math.sin(lookPitch.current), -Math.cos(yaw) * Math.cos(lookPitch.current));
    }
    cameraPosition.current.lerp(target, 1 - Math.exp(-dt * 4));
    if (gl.xr.isPresenting) {
      camera.position.set(cameraPosition.current.x, 0, cameraPosition.current.z);
    } else {
      camera.position.copy(cameraPosition.current);
      camera.lookAt(cameraPosition.current.clone().add(direction));
    }
    s.telemetrySeconds += dt;
    if (s.telemetrySeconds >= 0.12) { s.telemetrySeconds = 0; onTelemetry(s); }
  });

  const launchPad = stage === "approach" || stage === "boarding";
  const atmospheric = launchPad || stage === "startup" || (stage === "ascent" && flight.current.altitude < 45);
  const surface = stage === "landed" || stage === "outside" || stage === "entering";
  const cockpit = ["startup", "ascent", "orbit", "transfer", "landing", "crashed"].includes(stage);
  return <>
    <color attach="background" args={[atmospheric ? "#88c9ee" : surface ? "#111923" : "#030710"]} />
    {stage !== "startup" &&     <fog attach="fog" args={[atmospheric ? "#a7d5e9" : "#131a20", 38, atmospheric ? 420 : 140]} />}
    {!atmospheric && <Stars radius={130} depth={90} count={3200} factor={4} saturation={0.12} fade speed={0.15} />}
    {atmospheric && <><mesh position={[-34, 25, -90]} scale={3}><sphereGeometry args={[1, 32, 24]} /><meshBasicMaterial color="#fff5d9" toneMapped={false} /></mesh><mesh position={[-34, 25, -90]} scale={4.1}><sphereGeometry args={[1, 24, 16]} /><meshBasicMaterial color="#ffc56f" transparent opacity={0.11} side={THREE.BackSide} depthWrite={false} /></mesh></>}
    {launchPad && <><LaunchComplex /><LaunchVehicle stage={stage} /></>}
    {cockpit && <>
      {["orbit", "transfer"].includes(stage) || (stage === "ascent" && flight.current.altitude >= 45) ? <Earth altitude={flight.current.altitude} /> : null}
      <MoonApproach stage={stage} flight={flight.current} />
      {stage === "startup" && <><LaunchWindow altitude={0} /><AscentClouds altitude={0} /></>}
      {stage === "ascent" && <><LaunchWindow altitude={flight.current.altitude} /><AscentClouds altitude={flight.current.altitude} /></>}
      {stage === "landing" && <group position={[0, -flight.current.altitude, 0]}><MoonSurface stage="landing" /></group>}
    <Cockpit stage={stage} flight={flight.current} /></>}
    {surface && <><mesh position={[12, 17, -55]} scale={1.1}><sphereGeometry args={[1, 40, 30]} /><meshBasicMaterial color="#fff0cc" toneMapped={false} /></mesh><mesh position={[0, 0.4, -70]}><sphereGeometry args={[8, 48, 36]} /><meshStandardMaterial color="#23639a" roughness={0.8} emissive="#102b48" emissiveIntensity={0.45} /></mesh><mesh position={[0, 0.4, -70]} scale={1.08}><sphereGeometry args={[8, 32, 24]} /><meshBasicMaterial color="#65baff" transparent opacity={0.12} side={THREE.BackSide} depthWrite={false} /></mesh><MoonSurface stage={stage} /></>}
    <ambientLight intensity={atmospheric ? 0.72 : surface ? 0.42 : 0.25} />
    <hemisphereLight args={atmospheric ? ["#d7edff", "#817b67", 1.1] : ["#c7dcff", "#31353c", 0.46]} />
    <directionalLight position={[-34, 25, -90]} intensity={atmospheric ? 2.15 : surface ? 2.3 : 1.2} color={atmospheric ? "#fff3d8" : "#e8efff"} castShadow />
    <pointLight position={[0, 3, 1]} intensity={stage === "landing" ? 1.5 : 0.45} color="#f3c187" distance={12} />
    <ContactShadows position={[0, -0.14, -2]} opacity={surface ? 0.42 : 0.23} scale={26} blur={2.6} far={7} resolution={512} color="#07090d" />
  </>;
}

function Key({ children }: { children: ReactNode }) { return <kbd className="inline-flex min-w-7 justify-center border border-white/25 bg-black/20 px-1.5 py-1 font-mono text-[10px] text-white/90">{children}</kbd>; }
function Stat({ label, value, unit, accent = false }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return <div className="border border-white/[0.09] bg-[#101a1e]/70 px-3 py-2.5"><p className="text-[9px] uppercase tracking-[0.16em] text-[#91a69f]">{label}</p><p className={`mt-1.5 font-mono text-sm tabular-nums ${accent ? "text-[#f1c27c]" : "text-[#e5eee8]"}`}>{value}<span className="ml-1 text-[9px] text-[#91a69f]">{unit}</span></p></div>;
}

export function FlightSequence() {
  const pending = loadPendingMission();
  const flight = useRef(makeFlight());
  const keys = useRef(new Set<string>());
  const [stage, setStage] = useState<Stage>("approach");
  const [telemetry, setTelemetry] = useState<FlightState>(() => ({ ...flight.current }));
  const [xrStatus, setXrStatus] = useState<"checking" | "ready" | "unsupported" | "active">("checking");
  const [xrError, setXrError] = useState<string | null>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const xrSession = useRef<XRSessionHandle | null>(null);
  const overlayRoot = useRef<HTMLElement>(null);
  const changeStage = useCallback((next: Stage) => {
    if (flight.current.stage === next) return;
    flight.current.stage = next;
    setStage(next);
  }, []);
  const updateTelemetry = useCallback((state: FlightState) => setTelemetry({ ...state }), []);
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);
  useEffect(() => {
    const valid = new Set(["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright"]);
    const down = (e: KeyboardEvent) => { const key = e.key.toLowerCase(); if (valid.has(key)) { e.preventDefault(); keys.current.add(key); } };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const clear = () => keys.current.clear();
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); };
  }, []);
  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: XRSystemHandle }).xr;
    if (!xr || !window.isSecureContext) {
      setXrStatus("unsupported");
      return;
    }
    let active = true;
    xr.isSessionSupported("immersive-vr").then((supported) => {
      if (active) setXrStatus(supported ? "ready" : "unsupported");
    }).catch((error: unknown) => {
      if (!active) return;
      setXrStatus("unsupported");
      setXrError(error instanceof Error ? error.message : String(error));
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (stage !== "entering") return;
    const timer = window.setTimeout(() => {
      const session = xrSession.current;
      if (!session) {
        window.location.href = "/preview/MissionSimulation";
        return;
      }
      void session.end().catch((error: unknown) => {
        setXrError(error instanceof Error ? error.message : String(error));
      }).finally(() => {
        window.location.href = "/preview/MissionSimulation";
      });
    }, 1250);
    return () => window.clearTimeout(timer);
  }, [stage]);
  const launch = () => { flight.current.throttle = 68; flight.current.pitch = 90; flight.current.altitude = 0; flight.current.speed = 0; changeStage("ascent"); };
  const startBurn = () => { flight.current.burnStarted = true; flight.current.transferSeconds = 0; changeStage("transfer"); };
  const retryLanding = () => { flight.current.altitude = 2.4; flight.current.verticalSpeed = -0.032; flight.current.pitch = -80; flight.current.throttle = 54; changeStage("landing"); };
  const toggleVR = async () => {
    setXrError(null);
    if (xrSession.current) {
      try {
        await xrSession.current.end();
      } catch (error) {
        setXrError(error instanceof Error ? error.message : String(error));
      }
      return;
    }
    const xr = (navigator as Navigator & { xr?: XRSystemHandle }).xr;
    const webgl = renderer.current;
    if (!xr || !webgl) {
      setXrError("VR is unavailable: this browser did not expose a WebXR session or WebGL renderer.");
      return;
    }
    try {
      webgl.xr.enabled = true;
      webgl.xr.setReferenceSpaceType("local-floor");
      const session = await xr.requestSession("immersive-vr", {
        optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking", "dom-overlay"],
        domOverlay: { root: overlayRoot.current ?? document.body },
      });
      if (!session) throw new Error("The browser returned no immersive VR session.");
      xrSession.current = session;
      session.addEventListener("end", () => {
        xrSession.current = null;
        setXrStatus("ready");
      }, { once: true });
      await webgl.xr.setSession(session);
      setXrStatus("active");
    } catch (error) {
      xrSession.current = null;
      setXrError(error instanceof Error ? error.message : String(error));
      setXrStatus("ready");
    }
  };
  const ascentPitch = 90 - clamp(telemetry.altitude / ORBIT_ALTITUDE, 0, 1) * 70;
  const landingSpeed = -Math.min(35, Math.sqrt(2 * 1.2 * Math.max(0, telemetry.altitude) * 1000));
  const altitudeMeters = Math.max(1, telemetry.altitude * 1000);
  const verticalSpeedMeters = telemetry.verticalSpeed * 1000;
  const landingThrottle = verticalSpeedMeters >= 0
    ? 0
    : clamp((1.62 + verticalSpeedMeters ** 2 / (2 * altitudeMeters)) * 100 / 3, 0, 100);
  const headingError = Math.abs(telemetry.heading - MOON_HEADING);
  const transferReady = headingError <= 4 && Math.abs(telemetry.pitch) <= 4 && telemetry.throttle >= 76 && telemetry.throttle <= 88 && telemetry.orbitSeconds >= 2;
  const transferAligned = headingError <= 7 && Math.abs(telemetry.pitch) <= 7 && telemetry.throttle >= 72;
  const status = stage === "ascent" ? "ENGINE BURN" : stage === "landing" && telemetry.verticalSpeed > 0.004 ? "CLIMBING" : stage === "landing" ? "DESCENDING" : stage === "crashed" ? "ABORTED" : stage === "landed" || stage === "outside" ? "NOMINAL" : stage === "orbit" || stage === "transfer" ? "GUIDANCE ACTIVE" : "STANDBY";
  const approachProgress = clamp(telemetry.walkDistance / PAD_APPROACH_DISTANCE, 0, 1);
  const surfaceProgress = clamp((telemetry.walkDistance - 0.2) / 16.4, 0, 1);
  const progress = stage === "approach" ? approachProgress : stage === "ascent" ? clamp(telemetry.altitude / ORBIT_ALTITUDE, 0, 1) : stage === "orbit" ? clamp(telemetry.orbitSeconds / 2, 0, 1) : stage === "transfer" ? clamp(telemetry.transferSeconds / 8, 0, 1) : stage === "landing" ? clamp(1 - telemetry.altitude / 2.4, 0, 1) : stage === "outside" ? surfaceProgress : stage === "landed" ? 1 : 0;

  return <main ref={overlayRoot} className="fixed inset-0 z-0 h-dvh w-screen touch-none overflow-hidden overscroll-none bg-[#080e12] text-[#e9eee8]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
    <Canvas className="!fixed !inset-0 !h-full !w-full" shadows dpr={[1, 1.5]} camera={{ position: [0, 1.72, PAD_APPROACH_DISTANCE - 2.5], fov: 70, near: 0.1, far: 700 }} gl={{ antialias: true, alpha: false, powerPreference: "default", failIfMajorPerformanceCaveat: false }} onCreated={({ gl }) => { renderer.current = gl; gl.xr.enabled = true; gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); gl.outputColorSpace = THREE.SRGBColorSpace; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.18; }}>
      <Suspense fallback={null}><FlightScene flight={flight} keys={keys} stage={stage} onStageChange={changeStage} onTelemetry={updateTelemetry} /></Suspense>
    </Canvas>
    <div className={`pointer-events-none fixed inset-0 z-10 bg-black transition-opacity duration-700 ${stage === "boarding" || stage === "entering" ? "opacity-100" : "opacity-0"}`} />
    {stage === "boarding" && <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center"><p className="animate-pulse text-xs uppercase tracking-[0.4em] text-white/70">Crew hatch cycling</p></div>}
    <header className="relative z-20 flex h-[68px] shrink-0 items-center justify-between border-b border-white/[0.09] bg-[#081116]/70 px-5 backdrop-blur-xl md:px-9">
      <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center border border-[#6f857b]/70 bg-[#17241f]/80 text-[#ebc783]"><Rocket size={17} /></div><div><p className="text-[9px] uppercase tracking-[0.27em] text-[#91a79d]">Colony Frontier · Flight operations</p><p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.13em]">{pending?.missionTitle ?? "Lunar expedition"}</p></div></div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-[#adc1b6] sm:flex"><span className={`h-1.5 w-1.5 rounded-full ${status === "ABORTED" ? "bg-red-400" : status === "CLIMBING" ? "animate-pulse bg-amber-300" : "bg-emerald-300"}`} /> Flight computer · {status}</div>
        <span className="hidden border border-white/10 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.13em] text-[#c0cfc6] lg:inline">{labels[stage]}</span>
        <button onClick={toggleVR} disabled={xrStatus === "checking" || xrStatus === "unsupported"} title={xrStatus === "unsupported" ? "WebXR immersive VR is unavailable in this browser or requires a secure context." : undefined} className="flex items-center gap-2 border border-[#8db8a4]/45 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#c4e6d3] transition enabled:hover:bg-[#183126] disabled:cursor-not-allowed disabled:opacity-45">
          <Glasses size={14} /> {xrStatus === "active" ? "Exit VR" : xrStatus === "checking" ? "Checking VR" : xrStatus === "unsupported" ? "VR unavailable" : "Enter VR"}
        </button>
      </div>
    </header>
    {xrError && <div role="alert" className="absolute right-4 top-[76px] z-30 max-w-md border border-red-200/30 bg-[#211516]/95 px-4 py-3 text-xs text-red-100 shadow-xl">{xrError}</div>}
    <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(4,9,12,.34),transparent_19%,transparent_67%,rgba(3,8,10,.24))]" />
    <div className="relative z-20 grid h-[calc(100dvh-68px)] min-h-0 grid-cols-1 md:grid-cols-[minmax(0,1fr)_350px]">
      <section className="relative h-full min-h-0 overflow-hidden">
        <div className="absolute left-5 top-5 flex items-center gap-2 border border-white/15 bg-[#111a1c]/55 px-3 py-2 backdrop-blur-md"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8bd6b1]" /><span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#dbe4dc]">LIVE · {stage === "approach" || stage === "boarding" ? "KENNEDY SPACE CENTER" : stage === "outside" || stage === "landed" || stage === "entering" ? "LUNAR SURFACE · SOUTH POLE" : "CREW FLIGHT DECK"}</span></div>
        {["ascent", "orbit", "transfer", "landing", "crashed"].includes(stage) && <div className="absolute right-5 top-5 border border-white/15 bg-[#10191b]/65 px-3 py-2 backdrop-blur-md"><p className="text-[8px] uppercase tracking-[0.16em] text-[#98aca2]">Mission elapsed</p><p className="mt-1 font-mono text-sm">{Math.floor(telemetry.elapsedSeconds / 60).toString().padStart(2, "0")}:{Math.floor(telemetry.elapsedSeconds % 60).toString().padStart(2, "0")}<span className="ml-1 text-[9px] text-[#98aca2]">T+</span></p></div>}
        {["ascent", "landing"].includes(stage) && <div className="absolute right-4 top-16 z-20 w-[min(24vw,220px)] min-w-[132px] overflow-hidden border border-white/20 bg-[#0b1114]/85 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2"><span className="text-[8px] uppercase tracking-[0.18em] text-[#c5d4cb]">External pursuit camera</span><span className="font-mono text-[9px] text-[#edcb87]">{stage === "ascent" ? `${Math.round(telemetry.altitude * 1000)} m AGL` : `${Math.round(telemetry.altitude * 1000)} m TO SURFACE`}</span></div>
          <div className="aspect-[16/10]">
            <Canvas dpr={[1, 1.25]} camera={{ position: [98, 89, 122], fov: 34, near: 0.1, far: 1800 }} gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}>
              <ExternalViewScene stage={stage} telemetry={telemetry} />
            </Canvas>
          </div>
          <p className="border-t border-white/10 px-3 py-1.5 text-[8px] uppercase tracking-[0.12em] text-white/60">{stage === "ascent" ? "Launch vehicle · pad to orbital climb" : "Lander · descent and surface range"}</p>
        </div>}
        {stage === "approach" && <div className="absolute bottom-7 left-1/2 w-[min(90%,440px)] -translate-x-1/2 border border-white/15 bg-[#0a1315]/75 p-4 text-center backdrop-blur-md"><p className="text-[9px] uppercase tracking-[0.25em] text-[#e6c47f]">Kennedy Space Center · LC-39B · crew access arm · {Math.max(0, Math.ceil(PAD_APPROACH_DISTANCE - telemetry.walkDistance))} m</p><p className="mt-2 text-sm">Walk forward to the spacecraft</p>{xrStatus === "active" ? <p className="mt-3 text-[10px] text-white/65">W/S walk forward · A/D sidestep · arrows or head turn to look</p> : <p className="mt-3 flex items-center justify-center gap-2"><Key>W</Key><Key>S</Key><span className="ml-1 mr-2 text-[10px] text-white/60">walk</span><Key>A</Key><Key>D</Key><span className="ml-1 mr-2 text-[10px] text-white/60">sidestep</span><span className="text-[9px] text-white/60">← ↑ ↓ → look</span></p>}<div className="mt-3 h-[2px] bg-white/10"><div className="h-full bg-[#e6c47f]" style={{ width: `${approachProgress * 100}%` }} /></div></div>}
        {stage === "outside" && <div className="absolute bottom-7 left-1/2 w-[min(90%,440px)] -translate-x-1/2 border border-white/15 bg-[#0a1315]/75 p-4 text-center backdrop-blur-md"><p className="text-[9px] uppercase tracking-[0.25em] text-[#e6c47f]">Habitat airlock · ahead</p><p className="mt-2 text-sm">Walk forward to enter the lunar base</p>{xrStatus === "active" ? <p className="mt-3 text-[10px] text-white/65">W/S walk · A/D sidestep · right stick or head to look</p> : <p className="mt-3 flex items-center justify-center gap-2"><Key>W</Key><Key>S</Key><span className="ml-1 mr-2 text-[10px] text-white/60">walk</span><Key>A</Key><Key>D</Key><span className="ml-1 mr-2 text-[10px] text-white/60">sidestep</span><span className="text-[9px] text-white/60">← ↑ ↓ → look</span></p>}<div className="mt-3 h-[2px] bg-white/10"><div className="h-full bg-[#e6c47f]" style={{ width: `${surfaceProgress * 100}%` }} /></div></div>}
        {stage === "startup" && <div className="absolute bottom-7 left-1/2 flex w-[min(90%,460px)] -translate-x-1/2 flex-col items-center border border-white/15 bg-[#0c1517]/85 p-5 text-center backdrop-blur-lg"><p className="text-[9px] uppercase tracking-[0.24em] text-[#e6c47f]">Crewed lunar transfer vehicle · flight deck</p><p className="mt-2 text-base font-medium">Flight controls ready · launch pad</p><p className="mt-2 max-w-sm text-xs leading-5 text-[#adbbb4]">{xrStatus === "active" ? "Left stick controls throttle; right stick controls attitude. Trigger starts the engines. Turn your head to look around." : "W/S adjust thrust · A/D steer heading · Q/E adjust pitch · arrow keys or mouse look around."}</p><button onClick={launch} className="mt-4 flex items-center gap-2 bg-[#e5c17d] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#151a16] hover:bg-[#f1d292]"><Rocket size={14} /> Ignite engines</button></div>}
        {stage === "ascent" && <div className="absolute bottom-6 left-5 border border-white/15 bg-[#0d171a]/70 px-4 py-3 backdrop-blur-md"><p className="text-[8px] uppercase tracking-[0.17em] text-[#93aaa0]">Flight controls</p><p className="mt-2 flex items-center gap-1.5"><Key>W</Key><Key>S</Key><span className="ml-1 text-[10px] text-white/75">thrust</span><Key>A</Key><Key>D</Key><span className="ml-1 text-[10px] text-white/75">heading</span><Key>Q</Key><Key>E</Key><span className="ml-1 text-[10px] text-white/75">pitch · arrows look</span></p></div>}
        {stage === "orbit" && <div className="absolute bottom-6 left-1/2 w-[min(90%,480px)] -translate-x-1/2 border border-[#7bc9ac]/30 bg-[#0b191a]/85 p-4 text-center backdrop-blur-lg"><p className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.23em] text-[#99e0bf]"><Check size={13} /> Stable orbit · 160 km</p><p className="mt-2 text-sm">Turn to face the Moon, then set up the transfer burn.</p><p className="mt-2 text-[10px] text-[#afc1b7]">Heading {MOON_HEADING}° · pitch 0° · thrust 82%</p>{xrStatus === "active" ? <p className="mt-2 text-[9px] text-white/55">Right stick · align Moon · left stick · set thrust · trigger · burn</p> : <p className="mt-2 text-[9px] text-white/55"><Key>A</Key> <Key>D</Key> heading <Key>Q</Key> <Key>E</Key> pitch <Key>W</Key> <Key>S</Key> thrust · arrows look</p>}<button disabled={!transferReady} onClick={startBurn} className="mt-4 border border-[#91cbb0]/70 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#c1f1d3] enabled:hover:bg-[#17392e] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/35">{transferReady ? "Start translunar burn" : "Align with lunar guidance"}</button></div>}
        {stage === "transfer" && <div className="absolute bottom-6 left-1/2 w-[min(90%,460px)] -translate-x-1/2 border border-white/15 bg-[#101718]/85 p-4 text-center backdrop-blur-lg"><p className="text-[9px] uppercase tracking-[0.2em] text-[#e6c47f]">Translunar injection · 8 second guided burn</p><p className="mt-2 text-xs text-[#d8e1da]">{transferAligned ? "Trajectory correction nominal. Hold these parameters." : "Flight path drifting — re-align heading, pitch and throttle."}</p><div className="mx-auto mt-3 h-1 w-48 overflow-hidden bg-white/10"><div className="h-full bg-[#e6c47f]" style={{ width: `${clamp(telemetry.transferSeconds / 8, 0, 1) * 100}%` }} /></div></div>}
        {stage === "landing" && <div className="absolute bottom-6 left-1/2 w-[min(92%,490px)] -translate-x-1/2 border border-[#d4b67a]/35 bg-[#101718]/85 p-4 text-center backdrop-blur-lg"><p className="text-[9px] uppercase tracking-[0.2em] text-[#e6c47f]">Powered descent · lunar gravity 1.62 m/s²</p><p className={`mt-2 text-xs ${telemetry.verticalSpeed > 0.004 ? "text-amber-200" : "text-[#e0e8e1]"}`}>{telemetry.verticalSpeed > 0.004 ? "Excess thrust — climbing away from the surface. Reduce throttle." : telemetry.throttle < landingThrottle - 8 ? "Thrust below the landing curve — descent rate increasing." : "Match the guidance cues to settle onto the landing pad."}</p><p className="mt-2 text-[9px] text-white/65">Pitch −88° · vertical rate {Math.round(landingSpeed)} m/s · thrust {Math.round(landingThrottle)}% · touchdown ≤3 m/s</p><p className="mt-2 text-[9px] text-white/55">{xrStatus === "active" ? "Left stick · throttle · right stick · pitch · trigger · confirm" : <><Key>W</Key> <Key>S</Key> throttle <Key>Q</Key> <Key>E</Key> pitch · arrows look</>}</p></div>}
        {stage === "crashed" && <div className="absolute inset-0 flex items-center justify-center bg-[#130c0d]/40 p-5 backdrop-blur-[2px]"><div className="max-w-sm border border-red-200/25 bg-[#141112]/95 p-6 text-center"><TriangleAlert className="mx-auto text-red-300" size={24} /><p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-red-200">Landing envelope exceeded</p><p className="mt-2 text-xs leading-5 text-[#c6b8b5]">The vehicle struck the surface before descent rate and attitude were safe. Restart the approach and follow the landing cues.</p><button onClick={retryLanding} className="mt-4 border border-white/20 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/90 hover:bg-white/10">Restart lunar approach</button></div></div>}
        {stage === "landed" && <div className="absolute bottom-7 left-1/2 w-[min(90%,470px)] -translate-x-1/2 border border-[#8ad3ad]/30 bg-[#0b1918]/85 p-4 text-center backdrop-blur-lg"><p className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.22em] text-[#9ce1bb]"><Check size={13} /> Touchdown · engines safed</p><p className="mt-2 text-sm">Walk forward to leave the spacecraft.</p><p className="mt-2 text-[10px] text-white/55">{xrStatus === "active" ? "Press either controller trigger to exit the lander" : <><Key>W</Key> exit · arrows look around</>}</p></div>}
      </section>

      <aside className="relative z-20 hidden min-h-0 flex-col border-t border-white/[0.1] bg-[#0b1214]/95 px-5 py-5 backdrop-blur-2xl md:flex md:border-l md:border-t-0 md:px-6 md:py-7">
        <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#e4c27c]"><ShieldCheck size={14} /> Mission flight plan</div>
        <h1 className="mt-5 text-2xl font-medium leading-tight tracking-[-0.035em]">{titles[stage]}</h1><p className="mt-2 text-xs leading-[1.75] text-[#9fafa6]">{details[stage]}</p>
        <div className="mt-5 h-[2px] bg-white/[0.09]"><div className="h-full bg-[#d7b777] transition-[width] duration-200" style={{ width: `${progress * 100}%` }} /></div>
        {["ascent", "orbit", "transfer", "landing", "crashed"].includes(stage) ? <>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Stat label="Altitude" value={telemetry.altitude.toFixed(1)} unit="km" accent /><Stat label={stage === "landing" ? "Vertical rate" : "Velocity"} value={stage === "landing" ? (telemetry.verticalSpeed * 1000).toFixed(1) : telemetry.speed.toFixed(2)} unit={stage === "landing" ? "m/s" : "km/s"} />
            <Stat label="Thrust" value={Math.round(telemetry.throttle).toString()} unit="%" accent /><Stat label="Pitch" value={`${Math.round(telemetry.pitch)}°`} />
            <Stat label="Heading" value={`${Math.round(telemetry.heading).toString().padStart(3, "0")}°`} /><Stat label="Guidance" value={stage === "ascent" ? "ASCENT" : stage === "orbit" ? "ORBIT" : stage === "transfer" ? "MOON" : stage === "landing" ? "LAND" : "ABORT"} accent />
          </div>
          {stage === "ascent" && <div className="mt-5 border border-white/[0.09] bg-[#101a1e]/70 p-3.5"><div className="flex justify-between text-[9px] uppercase tracking-[0.13em] text-[#91a69f]"><span>Ascent guidance</span><span className="text-[#eac77f]">TARGET</span></div><div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px]"><div>Altitude <span className="text-[#eac77f]">160 km</span></div><div>Velocity <span className="text-[#eac77f]">7.80 km/s</span></div><div>Pitch <span className="text-[#eac77f]">{Math.round(ascentPitch)}°</span></div><div>Throttle <span className="text-[#eac77f]">68–78%</span></div></div><div className="mt-3 h-1 overflow-hidden bg-white/[0.08]"><div className="h-full bg-[#80cba8]" style={{ width: `${clamp(telemetry.altitude / ORBIT_ALTITUDE, 0, 1) * 100}%` }} /></div></div>}
          {stage === "orbit" && <div className="mt-5 border border-white/[0.09] bg-[#101a1e]/70 p-3.5"><div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.13em] text-[#91a69f]"><Compass size={13} /> Translunar alignment</div><div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px]"><div>Heading <span className="text-[#eac77f]">{MOON_HEADING}°</span></div><div>Pitch <span className="text-[#eac77f]">0°</span></div><div>Burn thrust <span className="text-[#eac77f]">76–88%</span></div><div>Alignment <span className={transferReady ? "text-[#8de0b4]" : "text-[#eac77f]"}>{transferReady ? "READY" : "TRIM"}</span></div></div><div className="mt-3 flex items-center gap-2 text-[9px] text-[#9fafa6]"><Crosshair size={12} /> Turn until the Moon is centered in the forward window.</div></div>}
          {stage === "transfer" && <div className="mt-5 border border-white/[0.09] bg-[#101a1e]/70 p-3.5"><div className="flex justify-between text-[9px] uppercase tracking-[0.13em] text-[#91a69f]"><span>Transfer burn</span><span className="text-[#eac77f]">{transferAligned ? "ON TRAJECTORY" : "CORRECT COURSE"}</span></div><div className="mt-3 flex items-center gap-2 font-mono text-[10px]"><Timer size={13} className="text-[#eac77f]" /> {telemetry.transferSeconds.toFixed(1)} / 8.0 sec</div><div className="mt-3 h-1 overflow-hidden bg-white/[0.08]"><div className="h-full bg-[#80cba8]" style={{ width: `${clamp(telemetry.transferSeconds / 8, 0, 1) * 100}%` }} /></div></div>}
          {stage === "landing" && <div className="mt-5 border border-white/[0.09] bg-[#101a1e]/70 p-3.5"><div className="flex justify-between text-[9px] uppercase tracking-[0.13em] text-[#91a69f]"><span>Descent guidance</span><span className={telemetry.verticalSpeed > 0.004 ? "text-amber-300" : "text-[#9ce1bb]"}>{telemetry.verticalSpeed > 0.004 ? "ASCENDING" : "ACTIVE"}</span></div><div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px]"><div>Target angle <span className="text-[#eac77f]">−88°</span></div><div>Current <span className="text-[#eac77f]">{Math.round(telemetry.pitch)}°</span></div><div>Target vertical rate <span className="text-[#eac77f]">{Math.round(landingSpeed)} m/s</span></div><div>Current <span className="text-[#eac77f]">{(telemetry.verticalSpeed * 1000).toFixed(1)} m/s</span></div><div>Target thrust <span className="text-[#eac77f]">{Math.round(landingThrottle)}%</span></div><div>Current <span className="text-[#eac77f]">{Math.round(telemetry.throttle)}%</span></div></div><div className="mt-3 text-[9px] leading-4 text-[#9fafa6]">Thrust surplus lifts the lander; a deficit accelerates descent. Touch down below 3 m/s, near vertical.</div></div>}
        </> : <div className="mt-6 space-y-2.5">
          {[["01", "Crew transfer", ["approach", "boarding", "startup"].includes(stage)], ["02", "Earth departure", ["ascent", "orbit", "transfer", "landing", "crashed", "landed", "outside", "entering"].includes(stage)], ["03", "Lunar arrival", ["landing", "crashed", "landed", "outside", "entering"].includes(stage)], ["04", "Surface mission", ["outside", "entering"].includes(stage)]].map(([n, label, done]) => <div key={n as string} className="flex items-center gap-3 border-b border-white/[0.07] pb-2.5"><span className={`grid h-6 w-6 place-items-center border text-[9px] ${done ? "border-[#6bb692]/45 bg-[#173126] text-[#9be1b9]" : "border-white/10 text-[#71817a]"}`}>{done ? <Check size={12} /> : n}</span><span className={`text-[10px] uppercase tracking-[0.1em] ${done ? "text-[#d3e6d6]" : "text-[#74847c]"}`}>{label}</span></div>)}
          <div className="!mt-5 grid grid-cols-2 gap-2"><Stat label="Cabin" value={stage === "approach" ? "OPEN" : "101.3"} unit={stage === "approach" ? "" : "kPa"} /><Stat label="Life support" value="NOMINAL" /><Stat label="Mission" value={pending?.missionNumber ?? "LUNAR 01"} /><Stat label="Vehicle" value="CREWED" /></div>
        </div>}
        <div className="mt-auto pt-6"><div className="mb-4 flex items-center justify-between border-t border-white/[0.1] pt-4"><span className="flex items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-[#97aaa0]"><Radio size={13} /> Guidance status</span><span className={`text-[9px] uppercase tracking-[0.12em] ${status === "ABORTED" ? "text-red-300" : status === "CLIMBING" ? "text-amber-200" : "text-[#9be1b9]"}`}>{status}</span></div>
          {stage === "startup" && <button onClick={launch} className="w-full bg-[#e5c17d] px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.17em] text-[#151a16] hover:bg-[#f1d292]"><Rocket className="mr-2 inline" size={14} />Ignite engines</button>}
          {stage === "orbit" && <button disabled={!transferReady} onClick={startBurn} className="w-full border border-[#91cbb0]/60 px-4 py-3.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#c1f1d3] enabled:hover:bg-[#17392e] disabled:text-white/35">{transferReady ? "Initiate lunar transfer" : "Align with lunar guidance"}</button>}
          {stage === "crashed" && <button onClick={retryLanding} className="w-full border border-red-200/30 px-4 py-3.5 text-[9px] uppercase tracking-[0.14em] text-red-100 hover:bg-red-950/40">Retry lunar descent</button>}
          {(stage === "landed" || stage === "outside") && <div className="border border-[#83cfa7]/25 bg-[#11231c]/60 px-3 py-3 text-[9px] uppercase tracking-[0.12em] text-[#a9dfbb]"><Check className="mr-2 inline" size={13} />{stage === "landed" ? "Press W to leave the lander" : "Walk to the habitat airlock"}</div>}
          {stage === "approach" && <div className="border border-white/10 px-3 py-3 text-[9px] uppercase tracking-[0.12em] text-[#acb9b1]"><Gauge className="mr-2 inline" size={13} />Walk up to the crew hatch</div>}
          {stage === "entering" && <div className="border border-[#83cfa7]/25 bg-[#11231c]/60 px-3 py-3 text-[9px] uppercase text-[#a9dfbb]"><Check className="mr-2 inline" size={13} />Airlock cycling · mission transfer</div>}
          <p className="mt-3 text-center text-[8px] tracking-[0.08em] text-[#63736c]">Interactive visual prototype · illustrative dynamics, not operational flight guidance</p>
        </div>
      </aside>
    </div>
  </main>;
}

export default FlightSequence;
