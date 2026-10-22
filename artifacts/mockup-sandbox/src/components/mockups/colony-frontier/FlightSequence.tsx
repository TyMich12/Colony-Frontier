import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Float, Stars } from "@react-three/drei";
import * as THREE from "three";
import { ArrowRight, CheckCircle2, Power, Radio, ShieldCheck, Volume2 } from "lucide-react";
import { loadPendingMission } from "./missionRuntime";

type Stage = "approach" | "boarding" | "startup" | "launch" | "landing" | "landed" | "outside";

const stageCopy: Record<Stage, { label: string; title: string; detail: string }> = {
  approach: { label: "PRE-LAUNCH / 01", title: "Crew transfer in progress", detail: "Suit checks complete. Proceed to the launch vehicle." },
  boarding: { label: "CREW ACCESS / 02", title: "Entering the spacecraft", detail: "Hatch sealed. Cabin pressure and restraints are being verified." },
  startup: { label: "SYSTEMS BOOT / 03", title: "Powering the vehicle", detail: "Flight computer online · life support nominal · guidance aligned." },
  launch: { label: "ASCENT / 04", title: "Leaving the launch pad", detail: "Main engines at thrust. Hold position while guidance stabilises." },
  landing: { label: "ARRIVAL / 05", title: "Lunar descent", detail: "Descent engines active. Landing zone acquired; dust plume detected." },
  landed: { label: "MISSION SITE / 06", title: "Touchdown confirmed", detail: "Engines shut down. The colony habitat is visible through the forward window." },
  outside: { label: "SURFACE OPERATIONS / 07", title: "Welcome to the frontier", detail: "Suit integrity confirmed. Transfer to the mission simulation." },
};
const timeline: Stage[] = ["approach", "boarding", "startup", "launch", "landing", "landed"];

function Rocket({ stage }: { stage: Stage }) {
  const root = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Group>(null);
  const landingGear = useRef<THREE.Group>(null);
  const launchStart = useRef<number | null>(null);
  const flameMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff9b45", transparent: true, opacity: 0.9 }), []);
  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    if (stage === "launch") {
      launchStart.current ??= t;
      root.current.position.y = THREE.MathUtils.damp(root.current.position.y, 2 + Math.min(8, (t - launchStart.current) * 1.25), delta, 1.2);
      root.current.rotation.z = THREE.MathUtils.damp(root.current.rotation.z, -0.025, delta, 1);
    } else if (stage === "landing") {
      root.current.position.y = THREE.MathUtils.damp(root.current.position.y, 0.12, delta, 0.65);
      root.current.rotation.z = THREE.MathUtils.damp(root.current.rotation.z, 0, delta, 1);
      launchStart.current = null;
    } else {
      root.current.position.y = THREE.MathUtils.damp(root.current.position.y, 0, delta, 2.5);
      root.current.rotation.z = THREE.MathUtils.damp(root.current.rotation.z, 0, delta, 2);
      if (stage !== "launch") launchStart.current = null;
    }
    if (flame.current) {
      const active = stage === "launch" || stage === "landing";
      flame.current.visible = active;
      flame.current.scale.y = active ? 0.8 + Math.abs(Math.sin(t * 15)) * 0.7 : 0.01;
      flame.current.scale.x = active ? 0.8 + Math.sin(t * 9) * 0.12 : 0.01;
    }
    if (landingGear.current) landingGear.current.visible = stage !== "launch";
  });
  return (
    <group ref={root} position={[1.35, 0, 0]} rotation={[0, 0, 0]}>
      {/* Main pressure hull: layered metal sections catch the scene lights like real hardware. */}
      <mesh position={[0, 1.65, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.64, 0.72, 2.75, 48, 1]} />
        <meshStandardMaterial color="#aab8bd" metalness={0.82} roughness={0.27} />
      </mesh>
      <mesh position={[0, 3.13, 0]} rotation={[Math.PI, 0, 0]} castShadow>
        <coneGeometry args={[0.64, 1.15, 48, 1]} />
        <meshStandardMaterial color="#d7dedc" metalness={0.72} roughness={0.24} />
      </mesh>
      <mesh position={[0, 3.72, 0]} castShadow>
        <sphereGeometry args={[0.12, 24, 16]} />
        <meshStandardMaterial color="#f2f0df" metalness={0.25} roughness={0.2} emissive="#b5d8e7" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 2.75, 0.616]} castShadow>
        <sphereGeometry args={[0.34, 32, 24]} />
        <meshPhysicalMaterial color="#163b4a" metalness={0.55} roughness={0.12} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      <mesh position={[-0.1, 2.83, 0.91]} rotation={[0.1, 0, -0.25]}>
        <planeGeometry args={[0.11, 0.31]} />
        <meshBasicMaterial color="#a8e5f3" transparent opacity={0.65} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.48, 0.8, 0]}>
          <mesh position={[side * 0.2, 0, 0]} rotation={[0, 0, -side * 0.15]} castShadow>
            <boxGeometry args={[0.48, 1.12, 0.18]} />
            <meshStandardMaterial color="#52646b" metalness={0.72} roughness={0.38} />
          </mesh>
          <mesh position={[side * 0.2, 0.25, 0.105]}>
            <boxGeometry args={[0.26, 0.09, 0.025]} />
            <meshStandardMaterial color="#e7b86d" metalness={0.35} roughness={0.32} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[0, 2.88 - i * 0.25, 0.638]}>
          <boxGeometry args={[0.92, 0.025, 0.035]} />
          <meshStandardMaterial color={i % 2 ? "#687b81" : "#e6c17d"} metalness={0.65} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.52, 0.59, 0.35, 32]} />
        <meshStandardMaterial color="#394a51" metalness={0.8} roughness={0.3} />
      </mesh>
      {[-0.29, 0, 0.29].map((x) => (
        <group key={x} position={[x, -0.12, 0]}>
          <mesh>
            <cylinderGeometry args={[0.12, 0.16, 0.28, 24]} />
            <meshStandardMaterial color="#1c272d" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.17, 0]}>
            <cylinderGeometry args={[0.06, 0.1, 0.12, 20]} />
            <meshBasicMaterial color="#ffb35d" />
          </mesh>
        </group>
      ))}
      <group ref={flame} position={[0, -0.42, 0]} visible={false}>
        <mesh material={flameMaterial}>
          <coneGeometry args={[0.38, 2.25, 32, 1]} />
        </mesh>
        <mesh position={[0, -0.48, 0]}>
          <coneGeometry args={[0.2, 2.1, 24, 1]} />
          <meshBasicMaterial color="#fff4cf" transparent opacity={0.94} />
        </mesh>
        <pointLight position={[0, -0.7, 0]} color="#ff873b" intensity={18} distance={8} />
      </group>
      <group ref={landingGear}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.46, 0.1, 0]}>
            <mesh position={[side * 0.16, -0.2, 0]} rotation={[0, 0, -side * 0.38]}>
              <cylinderGeometry args={[0.045, 0.055, 0.62, 12]} />
              <meshStandardMaterial color="#8a999b" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[side * 0.3, -0.48, 0.08]}>
              <boxGeometry args={[0.3, 0.07, 0.26]} />
              <meshStandardMaterial color="#59686a" metalness={0.7} roughness={0.4} />
            </mesh>
          </group>
        ))}
      </group>
      <pointLight position={[0, 2.6, 1.1]} color="#6ac6e8" intensity={stage === "startup" ? 5 : 1.1} distance={3.5} />
    </group>
  );
}

function Astronaut({ stage }: { stage: Stage }) {
  const group = useRef<THREE.Group>(null);
  const visor = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    const walking = stage === "approach" || stage === "boarding";
    const targetX = stage === "approach" ? -2.45 : stage === "boarding" ? -0.8 : -0.95;
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, delta, walking ? 0.85 : 2.5);
    group.current.position.y = walking ? Math.abs(Math.sin(clock.elapsedTime * 6)) * 0.045 : 0;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, stage === "approach" ? -0.15 : 0.65, delta, 2);
    if (visor.current) (visor.current.material as THREE.MeshStandardMaterial).emissiveIntensity = stage === "startup" ? 0.7 : 0.16;
  });
  return (
    <group ref={group} position={[-3.7, 0, 0.55]} scale={0.78}>
      <mesh position={[0, 1.03, 0]} castShadow>
        <sphereGeometry args={[0.27, 32, 24]} />
        <meshStandardMaterial color="#e5e8e3" roughness={0.28} metalness={0.18} />
      </mesh>
      <mesh ref={visor} position={[0, 1.06, 0.22]} castShadow>
        <sphereGeometry args={[0.195, 32, 24]} />
        <meshPhysicalMaterial color="#102c3c" metalness={0.65} roughness={0.1} clearcoat={1} emissive="#2b9dc3" emissiveIntensity={0.16} />
      </mesh>
      <mesh position={[0, 0.58, 0]} castShadow>
        <capsuleGeometry args={[0.29, 0.58, 8, 16]} />
        <meshStandardMaterial color="#d8dfdc" roughness={0.48} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.62, 0.25]}>
        <boxGeometry args={[0.28, 0.19, 0.035]} />
        <meshStandardMaterial color="#283f48" metalness={0.45} roughness={0.3} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.32, 0.65, 0]}>
          <mesh position={[side * 0.025, -0.09, 0]} rotation={[0, 0, -side * 0.23]} castShadow>
            <capsuleGeometry args={[0.09, 0.35, 5, 10]} />
            <meshStandardMaterial color="#c7d1ce" roughness={0.52} />
          </mesh>
          <mesh position={[side * 0.07, -0.32, 0.03]}>
            <sphereGeometry args={[0.095, 16, 12]} />
            <meshStandardMaterial color="#263941" metalness={0.35} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.14, 0.24, 0]}>
          <mesh position={[0, -0.17, 0]} castShadow>
            <capsuleGeometry args={[0.105, 0.38, 5, 10]} />
            <meshStandardMaterial color="#aebbb8" roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.4, 0.07]}>
            <boxGeometry args={[0.19, 0.12, 0.31]} />
            <meshStandardMaterial color="#303f45" roughness={0.58} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.62, -0.24]}>
        <boxGeometry args={[0.32, 0.4, 0.13]} />
        <meshStandardMaterial color="#52646a" metalness={0.35} roughness={0.48} />
      </mesh>
    </group>
  );
}

function LunarHabitat() {
  return (
    <group position={[4.1, 0, -1.8]}>
      <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.12, 1.28, 1.3, 48]} />
        <meshStandardMaterial color="#8a9895" metalness={0.42} roughness={0.44} />
      </mesh>
      <mesh position={[0, 1.31, 0]} castShadow>
        <sphereGeometry args={[1.12, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c2cbc4" metalness={0.32} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.73, 1.105]}>
        <boxGeometry args={[1.35, 0.42, 0.055]} />
        <meshPhysicalMaterial color="#163a4c" metalness={0.48} roughness={0.12} clearcoat={1} />
      </mesh>
      {[-0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.1, 0.15]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 0.25, 12]} />
          <meshStandardMaterial color="#48585b" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 1.2, -1.4]} rotation={[0.2, 0, -0.18]}>
        <boxGeometry args={[2.7, 0.04, 0.8]} />
        <meshStandardMaterial color="#203d50" metalness={0.6} roughness={0.3} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[-1.15 + i * 0.33, 1.23, -1.4]}>
          <boxGeometry args={[0.27, 0.025, 0.68]} />
          <meshStandardMaterial color={i % 2 ? "#376e87" : "#4b8195"} metalness={0.4} roughness={0.32} />
        </mesh>
      ))}
    </group>
  );
}

function Terrain({ stage }: { stage: Stage }) {
  const rocks = useMemo(() => Array.from({ length: 42 }, (_, i) => ({
    x: ((i * 37) % 23) - 11,
    z: -3 + ((i * 19) % 13),
    scale: 0.08 + ((i * 7) % 18) / 100,
    rotation: (i * 13) % 3,
  })), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[200, 200, 80, 80]} />
        <meshStandardMaterial color={stage === "outside" ? "#b8b5a7" : "#77776d"} roughness={1} metalness={0} />
      </mesh>
      {rocks.map((rock, i) => (
        <mesh key={i} position={[rock.x, -0.03 + rock.scale * 0.3, rock.z]} rotation={[rock.rotation, i, rock.rotation * 0.6]} scale={[rock.scale * 1.5, rock.scale, rock.scale]}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={stage === "outside" ? (i % 3 === 0 ? "#c7c1b0" : "#8c8d83") : (i % 3 === 0 ? "#99968a" : "#62665f")} roughness={1} />
        </mesh>
      ))}
      <mesh position={[-4.5, -0.02, -7]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.8, 64]} />
        <meshStandardMaterial color="#393f3e" roughness={1} />
      </mesh>
    </group>
  );
}

function MoonSky({ stage }: { stage: Stage }) {
  const earth = useRef<THREE.Group>(null);
  const outside = stage === "outside";
  useFrame(({ clock }) => {
    if (earth.current) earth.current.rotation.y = clock.elapsedTime * 0.018;
  });
  return (
    <>
      <color attach="background" args={[outside ? "#40596b" : "#050913"]} />
      <fog attach="fog" args={[outside ? "#a1b1b7" : "#111c2a", outside ? 26 : 13, outside ? 70 : 34]} />
      <Stars radius={100} depth={65} count={outside ? 1500 : 2400} factor={3} saturation={0.15} fade speed={0.25} />
      {/* Bright solar disc and warm glow, with directional light illuminating the whole scene. */}
      <mesh position={[7, 8, -14]} scale={1.25}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshBasicMaterial color="#fff0bd" toneMapped={false} />
      </mesh>
      <mesh position={[7, 8, -14]} scale={1.65}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial color="#ffbf62" transparent opacity={0.13} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* Stylised-but-3D Earth: blue ocean globe, raised green land masses and atmospheric rim. */}
      <group ref={earth} position={[-7, 5.5, -15]}>
        <mesh scale={2.2}>
          <sphereGeometry args={[1, 64, 48]} />
          <meshStandardMaterial color="#176fc2" roughness={0.82} metalness={0.02} />
        </mesh>
        {[
          [-0.45, 0.25, 0.36, 0.52, 0.15],
          [-0.22, -0.23, 0.23, 0.47, -0.2],
          [0.18, 0.22, 0.42, 0.29, -0.18],
          [0.48, -0.1, 0.26, 0.4, 0.25],
          [0.02, -0.48, 0.3, 0.13, 0.1],
        ].map(([x, y, sx, sy, rot], i) => (
          <mesh key={i} position={[x * 2.12, y * 2.12, 1.35]} rotation={[0, 0, rot]} scale={[sx, sy, 0.12]}>
            <sphereGeometry args={[0.8, 24, 16]} />
            <meshStandardMaterial color={i % 2 ? "#6a9d62" : "#3c875b"} roughness={0.95} />
          </mesh>
        ))}
        <mesh scale={2.24}>
          <sphereGeometry args={[1, 48, 32]} />
          <meshBasicMaterial color="#5eb8ff" transparent opacity={0.11} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      </group>
      <ambientLight intensity={outside ? 1.05 : 0.72} />
      <hemisphereLight args={[outside ? "#c9e6ff" : "#b8d0ed", outside ? "#a49b86" : "#242d3b", outside ? 1.2 : 0.65]} />
      <directionalLight position={[7, 10, 5]} intensity={outside ? 4.6 : 3.8} color="#fff0d3" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <pointLight position={[7, 8, -12]} intensity={outside ? 2.8 : 2.2} color="#ffdfa2" distance={70} />
      <pointLight position={[-7, 5, -12]} intensity={0.9} color="#65b5ff" distance={30} />
      <pointLight position={[0, 4, 6]} intensity={outside ? 2.4 : 1.1} color="#dcecff" distance={28} />
      <pointLight position={[3, 5, 4]} intensity={1.2} color="#f2bf87" distance={24} />
    </>
  );
}
function CinematicCamera({ stage }: { stage: Stage }) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const lookYaw = useRef(0);
  const lookPitch = useRef(0);
  const walkOffset = useRef(new THREE.Vector3());
  const isInteractiveStage = stage === "landed" || stage === "outside";

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["a", "d", "w", "s"].includes(key)) {
        keys.current[key] = true;
        if (isInteractiveStage) event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => { keys.current[event.key.toLowerCase()] = false; };
    const blur = () => { keys.current = {}; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [isInteractiveStage]);

  useFrame((_, delta) => {
    const targets: Record<Stage, { pos: [number, number, number]; look: [number, number, number]; fov: number }> = {
      approach: { pos: [-1.7, 3.2, 10.8], look: [0, 1.35, 0], fov: 44 },
      boarding: { pos: [-0.3, 3.0, 8.2], look: [0.8, 1.55, 0], fov: 39 },
      startup: { pos: [0.15, 2.8, 7.2], look: [1.1, 1.7, 0], fov: 34 },
      launch: { pos: [-0.5, 5.5, 12], look: [1, 3.5, 0], fov: 43 },
      landing: { pos: [-0.2, 4.2, 11.5], look: [1, 1.5, 0], fov: 43 },
      landed: { pos: [0.5, 3.5, 13.5], look: [0.8, 1.1, 0], fov: 48 },
      outside: { pos: [-2.5, 2.7, 10], look: [0.5, 1.1, 0], fov: 49 },
    };
    const target = targets[stage];
    camera.position.x = THREE.MathUtils.damp(camera.position.x, target.pos[0], delta, 1.3);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, target.pos[1], delta, 1.3);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, target.pos[2], delta, 1.3);

    // Interactive free-look and slow, deliberate movement after touchdown.
    // A/D pan the view; W/S move forward and backward without changing altitude.
    if (isInteractiveStage) {
      const turn = (Number(keys.current["d"]) - Number(keys.current["a"])) * delta * 1.15;
      const move = (Number(keys.current["w"]) - Number(keys.current["s"])) * delta * 2.6;
      lookYaw.current = THREE.MathUtils.clamp(lookYaw.current + turn, -1.35, 1.35);
      const forward = new THREE.Vector3(Math.sin(lookYaw.current), 0, -Math.cos(lookYaw.current));
      walkOffset.current.addScaledVector(forward, move);
      walkOffset.current.x = THREE.MathUtils.clamp(walkOffset.current.x, -7, 7);
      walkOffset.current.z = THREE.MathUtils.clamp(walkOffset.current.z, -4, 7);
    } else {
      lookYaw.current = THREE.MathUtils.damp(lookYaw.current, 0, delta, 2.5);
      walkOffset.current.lerp(new THREE.Vector3(), 1 - Math.exp(-delta * 2));
    }
    camera.position.add(walkOffset.current);
    const look = new THREE.Vector3(...target.look);
    look.x += Math.sin(lookYaw.current) * 5.5;
    look.z -= Math.cos(lookYaw.current) * 2.0;
    look.y += lookPitch.current;
    camera.lookAt(look);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.damp(camera.fov, target.fov, delta, 1.3);
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

function Scene({ stage }: { stage: Stage }) {
  const dust = useRef<THREE.Points>(null);
  const particles = useMemo(() => {
    const positions = new Float32Array(420 * 3);
    for (let i = 0; i < 420; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = Math.random() * 3.4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 18;
    }
    return positions;
  }, []);
  useFrame((_, delta) => {
    if (dust.current && (stage === "landing" || stage === "launch")) {
      dust.current.rotation.y += delta * 0.12;
      const mat = dust.current.material as THREE.PointsMaterial;
      mat.opacity = THREE.MathUtils.damp(mat.opacity, stage === "landing" ? 0.72 : 0.26, delta, 1.4);
    } else if (dust.current) {
      (dust.current.material as THREE.PointsMaterial).opacity = THREE.MathUtils.damp((dust.current.material as THREE.PointsMaterial).opacity, 0, delta, 2);
    }
  });
  return (
    <>
      <MoonSky stage={stage} />
      <Terrain stage={stage} />
      <Rocket stage={stage} />
      <Astronaut stage={stage} />
      <LunarHabitat />
      <points ref={dust}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particles, 3]} count={particles.length / 3} />
        </bufferGeometry>
        <pointsMaterial color="#d2c5a6" size={0.055} transparent opacity={0} depthWrite={false} sizeAttenuation />
      </points>
      <ContactShadows position={[0, -0.1, 0]} opacity={0.5} scale={18} blur={2.5} far={5} resolution={512} color="#05070a" />
      <CinematicCamera stage={stage} />
    </>
  );
}

export function FlightSequence() {
  const pending = loadPendingMission();
  const [stage, setStage] = useState<Stage>("approach");
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [manual, setManual] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  // Boot text only runs while the startup stage is visible.
  useEffect(() => {
    if (stage !== "startup") return;
    const lines = [
      "COLONY FRONTIER FLIGHT SYSTEM v05.0",
      "Checking crew life-support ........ PASS",
      "Cabin pressure seal ............... PASS",
      "Navigation and landing radar ...... ONLINE",
      "Thermal control loop .............. STABLE",
      "Guidance computer ................. READY",
      "Mission uplink .................... CONNECTED",
      "ALL PRIMARY SYSTEMS NOMINAL",
    ];
    setBootLines([]);
    let index = 0;
    const interval = window.setInterval(() => {
      if (index >= lines.length) {
        window.clearInterval(interval);
        return;
      }
      setBootLines((old) => [...old, lines[index]]);
      index += 1;
      if (index >= lines.length) window.clearInterval(interval);
    }, 650);
    return () => window.clearInterval(interval);
  }, [stage]);

  // Each scene stays on screen long enough to actually watch it; the sequence
  // never jumps to the mission simulation automatically.
  useEffect(() => {
    const next: Partial<Record<Stage, Stage>> = {
      approach: "boarding",
      boarding: "startup",
      startup: "launch",
      launch: "landing",
      landing: "landed",
    };
    const delay: Partial<Record<Stage, number>> = {
      approach: 7000,
      boarding: 8000,
      startup: 11000,
      launch: 9000,
      landing: 9000,
    };
    const following = next[stage];
    const duration = delay[stage];
    if (!following || !duration || manual) return;
    const timer = window.setTimeout(() => setStage((old) => old === stage ? following : old), duration);
    return () => window.clearTimeout(timer);
  }, [stage, manual]);

  const stageIndex = timeline.indexOf(stage);
  const skipAhead = () => {
    setManual(true);
    setStage((old) => {
      if (old === "approach") return "boarding";
      if (old === "boarding") return "startup";
      if (old === "startup") return "launch";
      if (old === "launch") return "landing";
      return "landed";
    });
  };
  const copy = stageCopy[stage];
  const isFlight = stage === "launch" || stage === "landing";
  const isLanded = stage === "landed" || stage === "outside";

  return (
    <main className={`relative min-h-screen overflow-hidden ${stage === "outside" ? "bg-[#40596b]" : "bg-[#050913]"} text-[#e7f0eb]`} style={{ fontFamily: "Arial, sans-serif" }}>
      <header className="relative z-20 flex items-center justify-between border-b border-[#334a4c] bg-[#071017]/85 px-5 py-4 backdrop-blur-xl md:px-10">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center border border-[#6f8a7d] bg-[#14252b] text-[#efb658]"><Radio size={18} /></div>
          <div><p className="text-[9px] uppercase tracking-[.32em] text-[#9bb6ac]">Colony Frontier Program</p><p className="mt-1 text-xs font-bold uppercase tracking-[.18em]">Flight operations / {pending?.campaign ?? "Moon"} campaign</p></div>
        </div>
        <button onClick={() => setSoundOn((v) => !v)} className="flex items-center gap-2 border border-[#33494c] px-3 py-2 text-[9px] uppercase tracking-[.14em] text-[#a8c0b4]" aria-pressed={soundOn}><Volume2 size={14} /> Audio {soundOn ? "enabled" : "muted"}</button>
      </header>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-73px)] max-w-[1600px] gap-5 p-3 md:grid-cols-[minmax(0,1fr)_330px] md:p-6">
        <section className={`relative min-h-[580px] overflow-hidden border border-[#54717b] ${stage === "outside" ? "bg-[#a1b1b7]" : "bg-[#050913]"} md:min-h-[calc(100vh-120px)]`}>
          <Canvas shadows dpr={[1, 2]} camera={{ position: [-1.7, 3.2, 10.8], fov: 44 }} gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}>
            <Suspense fallback={null}><Scene stage={stage} /></Suspense>
          </Canvas>
          <div className={`pointer-events-none absolute inset-0 ${stage === "outside" ? "bg-[linear-gradient(180deg,rgba(35,58,72,.015),transparent_18%,transparent_70%,rgba(35,58,72,.035))]" : "bg-[linear-gradient(180deg,rgba(3,7,13,.12),transparent_18%,transparent_70%,rgba(3,7,13,.14))"}`} />
          <div className="absolute left-4 top-4 z-10 rounded-sm border border-white/20 bg-[#101820]/65 px-3 py-2.5 shadow-sm backdrop-blur-sm"><p className="text-[8px] font-semibold uppercase tracking-[.18em] text-[#e2d8c5]">Lunar expedition</p><p className="mt-1.5 font-mono text-[10px] tracking-wide text-white/90">CAM {String(Math.max(1, stageIndex + 1)).padStart(2, "0")} · {isLanded ? "SURFACE" : isFlight ? "FLIGHT" : "EXTERNAL"}</p></div>
          {(stage === "landed" || stage === "outside") && <div className="absolute bottom-4 right-4 z-10 border border-white/25 bg-[#101820]/75 px-3 py-2.5 font-mono text-[9px] leading-5 text-white/90 shadow-sm backdrop-blur-sm"><p className="mb-1 font-sans text-[8px] uppercase tracking-[.18em] text-[#e2d8c5]">Explore the lunar site</p><p><kbd className="border border-white/30 px-1.5 py-0.5">A</kbd> <kbd className="border border-white/30 px-1.5 py-0.5">D</kbd> Look around</p><p><kbd className="border border-white/30 px-1.5 py-0.5">W</kbd> <kbd className="border border-white/30 px-1.5 py-0.5">S</kbd> Move forward / back</p></div>}
          {stage === "startup" && <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#071019]/28 p-4 backdrop-blur-[1px]"><div className="w-full max-w-[440px] border border-white/20 bg-[#111b22]/92 p-5 shadow-xl"><p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#e4c58b]"><Power size={14} /> Flight computer startup</p><div className="space-y-1 font-mono text-[10px] leading-5 text-[#c4dfce]">{bootLines.slice(-7).map((line) => <p key={line}><span className="text-[#efb658]">&gt;</span> {line}</p>)}</div><div className="mt-4 h-1.5 overflow-hidden bg-white/10"><div className="h-full bg-[#b6d2bb] transition-all duration-500" style={{ width: `${Math.min(100, bootLines.length / 8 * 100)}%` }} /></div></div></div>}
          {isLanded && <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 border border-white/20 bg-[#101b20]/75 px-3 py-2.5 text-[9px] font-medium uppercase tracking-[.13em] text-[#e0eadf] shadow-sm backdrop-blur-sm"><CheckCircle2 className="h-3.5 w-3.5 text-[#b9d3b5]" /> Touchdown confirmed</div>}
          {isFlight && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(255,174,103,.09),transparent_58%)]" />}
        </section>

        <aside className="flex flex-col border border-[#33494b] bg-[#0a161e]/95 p-5 backdrop-blur">
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.22em] text-[#efb658]"><ShieldCheck size={14} /> Mission sequence</div>
          <h1 className="mt-5 text-2xl font-semibold uppercase leading-tight tracking-[.07em]">{copy.title}</h1>
          <p className="mt-3 text-xs leading-6 text-[#9bb4ac]">{copy.detail}</p>
          <div className="mt-6 space-y-3">{timeline.map((item, index) => <div key={item} className="flex items-center gap-3 text-[9px] uppercase tracking-[.13em]"><span className={`grid h-6 w-6 place-items-center border ${index < stageIndex || stage === "outside" ? "border-[#78c49a] bg-[#16362b] text-[#a7e6bb]" : index === stageIndex ? "border-[#efb658] bg-[#3b3020] text-[#efb658]" : "border-[#2d4347] text-[#5c7775]"}`}>{index < stageIndex ? "✓" : String(index + 1).padStart(2, "0")}</span><span className={index === stageIndex ? "text-[#f0d9a6]" : index < stageIndex ? "text-[#9bc7a8]" : "text-[#637d7a]"}>{stageCopy[item].title}</span></div>)}</div>
          <div className="mt-7 border-t border-[#2c4246] pt-4"><div className="flex items-center justify-between text-[9px] uppercase tracking-[.16em] text-[#7f9a96]"><span>Flight telemetry</span><span className="text-[#8ed2a6]">{isLanded ? "STABLE" : stage === "launch" ? "THRUST" : "NOMINAL"}</span></div><div className="mt-3 grid grid-cols-2 gap-2">{[{label:"CABIN",value:stage === "startup" ? "101.3 kPa" : "SEALED"},{label:"LIFE SUPPORT",value:"ONLINE"},{label:"GUIDANCE",value:stage === "launch" ? "ASCENT" : isLanded ? "LANDED" : "TRACK"},{label:"MISSION",value:pending?.missionTitle ?? "MISSION 01"}].map((item) => <div key={item.label} className="border border-[#2b4145] bg-[#0d2026] p-2"><p className="text-[7px] uppercase tracking-[.13em] text-[#718e88]">{item.label}</p><p className="mt-1 truncate font-mono text-[9px] text-[#d4e2d4]">{item.value}</p></div>)}</div></div>
          <div className="mt-auto pt-6">
            {stage === "landed" || stage === "outside" ? <button onClick={() => { setStage("outside"); window.setTimeout(() => { window.location.href = "/preview/MissionSimulation"; }, 1100); }} className="flex w-full items-center justify-center gap-2 bg-[#efb658] px-4 py-4 text-[10px] font-black uppercase tracking-[.18em] text-[#172126] transition hover:bg-[#f6ca76]"><ArrowRight size={15} /> Go Outside <ArrowRight size={14} /></button> : <button onClick={skipAhead} className="flex w-full items-center justify-center gap-2 border border-[#4c6665] px-4 py-3 text-[9px] font-bold uppercase tracking-[.15em] text-[#a9c4b8] transition hover:border-[#efb658] hover:text-[#efb658]"><ArrowRight size={14} /> {manual ? "Continue sequence" : "Skip to next sequence"}</button>}
            <p className="mt-3 text-center text-[8px] leading-4 text-[#647f7c]">Real-time 3D scene · procedural spacecraft · no external model downloads.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default FlightSequence;
