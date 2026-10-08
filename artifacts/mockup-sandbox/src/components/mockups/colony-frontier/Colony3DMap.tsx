import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";
import type { TechnologyTrack, Tier } from "./_shared/gameData";
import type { BuildingRuntime } from "./missionRuntime";
import { terrainHeight, Terrain, Rocks } from "./solar-surface/terrain";

export type MissionResourceNode = {
  id: string;
  label: string;
  kind: "ICE" | "MINERAL" | "SCIENCE" | "REGOLITH";
  x: number;
  y: number;
  description: string;
};

type Props = {
  tracks: TechnologyTrack[];
  selected: Record<string, Tier>;
  buildings: Record<string, BuildingRuntime>;
  selectedBuildingId: string | null;
  elapsed: number;
  environmentLabel: "MOON" | "MARS";
  environmentTitle: string;
  activeEventTrackId: string | null;
  selectedResourceId: string | null;
  surveyedNodes: string[];
  resourceNodes: MissionResourceNode[];
  onSelect: (trackId: string) => void;
  onSelectResource: (node: MissionResourceNode) => void;
  roverTask: string;
};

const POSITIONS: Record<string, [number, number]> = {
  habitat: [-12.5, 11.0],
  extraction: [-4.2, 11.0],
  isru: [4.2, 11.0],
  radiation: [12.5, 11.0],
  oxygen: [-12.5, 3.3],
  comms: [-4.2, 3.3],
  maintenance: [4.2, 3.3],
  water: [12.5, 3.3],
  co2: [-12.5, -4.5],
  grid: [-4.2, -4.5],
  science: [4.2, -4.5],
  battery: [12.5, -4.5],
  thermal: [-12.5, -12.2],
  solar: [-4.2, -12.2],
  agriculture: [4.2, -12.2],
  navigation: [12.5, -12.2],
  rover: [13, -14.5],
};

const BUILDING_ROTATIONS: Record<string, number> = {
  habitat: 0,
  solar: 0.2,
  battery: -0.12,
  oxygen: 0.1,
  water: -0.1,
  co2: 0.05,
  comms: 0.25,
  navigation: -0.15,
  radiation: 0.16,
  science: -0.22,
  agriculture: -0.08,
  extraction: 0.08,
  isru: -0.1,
  thermal: 0.03,
  grid: 0,
  maintenance: 0.2,
};

const ROAD_X = [-8.45, 0, 8.45];
const ROAD_Z = [-8.35, -0.6, 7.15];
const ROAD_EDGE = 18.4;
const PAD_Y = 0.12;

function nodeWorldPosition(node: MissionResourceNode): [number, number] {
  return [(node.x - 500) / 22, (node.y - 300) / 10];
}

function tierColor(tier: Tier) {
  return tier === "Foundation"
    ? "#63df8c"
    : tier === "Frontier"
      ? "#2ec9f1"
      : tier === "Apex"
        ? "#b86cff"
        : "#ffad3f";
}

function statusColor(condition: number) {
  return condition < 55 ? "#ff6558" : condition < 82 ? "#f0c45b" : "#73dda0";
}

function palette(id: string) {
  const p: Record<string, { body: string; accent: string }> = {
    habitat: { body: "#566166", accent: "#4bd9e5" },
    solar: { body: "#38586a", accent: "#51d8ef" },
    battery: { body: "#4e5877", accent: "#8b76d2" },
    oxygen: { body: "#4c7774", accent: "#64e5df" },
    water: { body: "#3d6989", accent: "#56c9ef" },
    co2: { body: "#705548", accent: "#e3a05e" },
    comms: { body: "#5e5280", accent: "#6bdfff" },
    navigation: { body: "#605587", accent: "#e57bdf" },
    radiation: { body: "#514d70", accent: "#c787ff" },
    science: { body: "#654c82", accent: "#d28bff" },
    agriculture: { body: "#3e7057", accent: "#72e889" },
    extraction: { body: "#76573e", accent: "#e6b258" },
    isru: { body: "#467568", accent: "#67e5bc" },
    thermal: { body: "#76534a", accent: "#ff8c68" },
    grid: { body: "#4b6872", accent: "#58e6f0" },
    maintenance: { body: "#566a73", accent: "#70dceb" },
    rover: { body: "#8f733f", accent: "#52e9f2" },
  };
  return p[id] ?? { body: "#596b71", accent: "#64dce8" };
}

function Foundation({ mars }: { mars: boolean }) {
  const ground = mars ? "#70483b" : "#55585a";
  const curb = mars ? "#b4775e" : "#96928a";
  return (
    <group>
      <mesh receiveShadow position={[0, -0.205, 0]}>
        <boxGeometry args={[44, 0.36, 44]} />
        <meshStandardMaterial color={ground} roughness={0.98} />
      </mesh>
      <mesh receiveShadow position={[0, 0.025, 0]}>
        <boxGeometry args={[40.8, 0.11, 40.8]} />
        <meshStandardMaterial color={mars ? "#8d5948" : "#74726e"} roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.105, 0]}>
        <boxGeometry args={[40.3, 0.035, 40.3]} />
        <meshStandardMaterial color={curb} roughness={0.9} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.132, 0]}>
        <boxGeometry args={[39.4, 0.028, 39.4]} />
        <meshStandardMaterial color={mars ? "#774b3e" : "#666765"} roughness={0.94} />
      </mesh>
    </group>
  );
}

function Road({
  a,
  b,
  level,
  mars,
  width = 1.05,
}: {
  a: [number, number];
  b: [number, number];
  level: number;
  mars: boolean;
  width?: number;
}) {
  const [x1, z1] = a;
  const [x2, z2] = b;
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const x = (x1 + x2) / 2;
  const z = (z1 + z2) / 2;
  const y = 0.19 + level * 0.014;

  return (
    <group position={[x, y, z]} rotation={[0, angle, 0]}>
      <mesh>
        <boxGeometry args={[width + 0.26, 0.055, length + 0.18]} />
        <meshStandardMaterial color={mars ? "#b2765f" : "#aaa69d"} roughness={0.94} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <mesh position={[0, 0.032, 0]}>
        <boxGeometry args={[width, 0.034, length]} />
        <meshStandardMaterial color={mars ? "#71483d" : "#676a6b"} roughness={0.98} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      <mesh position={[0, 0.053, 0]}>
        <boxGeometry args={[0.045, 0.012, Math.max(0.2, length - 0.4)]} />
        <meshStandardMaterial color={mars ? "#d6a083" : "#d2ccb9"} roughness={0.86} />
      </mesh>
    </group>
  );
}

function RoadNetwork({ mars }: { mars: boolean }) {
  const roads = [
    ...ROAD_X.filter((x) => x !== 0).map((x) => ({ a: [x, -ROAD_EDGE] as [number, number], b: [x, ROAD_EDGE] as [number, number], level: 0 })),
    // The main access lanes deliberately split around the central command hub.
    { a: [0, -ROAD_EDGE] as [number, number], b: [0, -3.35] as [number, number], level: 0 },
    { a: [0, 3.35] as [number, number], b: [0, ROAD_EDGE] as [number, number], level: 0 },
    ...ROAD_Z.filter((z) => z !== -0.6).map((z) => ({ a: [-ROAD_EDGE, z] as [number, number], b: [ROAD_EDGE, z] as [number, number], level: 1 })),
    { a: [-ROAD_EDGE, -0.6] as [number, number], b: [-3.35, -0.6] as [number, number], level: 1 },
    { a: [3.35, -0.6] as [number, number], b: [ROAD_EDGE, -0.6] as [number, number], level: 1 },
    { a: [-18.4, -18.4] as [number, number], b: [18.4, -18.4] as [number, number], level: 0.5 },
    { a: [18.4, -18.4] as [number, number], b: [18.4, 18.4] as [number, number], level: 0 },
    { a: [18.4, 18.4] as [number, number], b: [-18.4, 18.4] as [number, number], level: 0.5 },
    { a: [-18.4, 18.4] as [number, number], b: [-18.4, -18.4] as [number, number], level: 0 },
  ];

  const access = Object.entries(POSITIONS)
    .filter(([id]) => id !== "rover")
    .map(([id, [x, z]]) => {
      const roadX = ROAD_X.reduce((best, candidate) => Math.abs(candidate - x) < Math.abs(best - x) ? candidate : best, ROAD_X[0]);
      const padHalfWidth = id === "habitat" ? 3.7 : 1.825;
      const padEdgeX = x + Math.sign(roadX - x) * padHalfWidth;
      return {
        id,
        // Stop the access spur at the pad edge instead of drawing a road through the building.
        a: [padEdgeX, z] as [number, number],
        b: [roadX, z] as [number, number],
      };
    });

  return (
    <group>
      {roads.map((r, i) => <Road key={i} {...r} mars={mars} />)}
      {access.map((r) => <Road key={r.id} a={r.a} b={r.b} level={2} mars={mars} width={0.72} />)}
    </group>
  );
}

function Pad({ position, size, mars, accent, baseY = 0 }: { position: [number, number]; size: number; mars: boolean; accent: string; baseY?: number }) {
  const [x, z] = position;
  return (
    <group position={[x, baseY, z]}>
      <mesh receiveShadow>
        <boxGeometry args={[size, 0.08, size]} />
        <meshStandardMaterial color={mars ? "#795044" : "#4f5557"} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.046, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 0.43, size * 0.46, 4]} />
        <meshBasicMaterial color={accent} transparent opacity={0.42} />
      </mesh>
      <mesh position={[0, 0.052, 0]}>
        <boxGeometry args={[size * 0.86, 0.012, 0.04]} />
        <meshStandardMaterial color={mars ? "#c4876d" : "#9d9d98"} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Beacon({ color, active, height = 2.1 }: { color: string; active: boolean; height?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.y = t * 0.8;
    ref.current.scale.setScalar(active ? 1 + (Math.sin(t * 5) + 1) * 0.08 : 0.9 + (Math.sin(t * 2) + 1) * 0.025);
  });
  return (
    <mesh ref={ref} position={[0, height, 0]}>
      <octahedronGeometry args={[0.15, 0]} />
      <meshStandardMaterial color={active ? "#fff16b" : color} emissive={active ? "#ff9f28" : color} emissiveIntensity={active ? 1.5 : 0.7} />
    </mesh>
  );
}

function BuildingArt({ id, accent }: { id: string; accent: string }) {
  const p = palette(id);

  if (id === "habitat") {
    return (
      <group>
        <mesh castShadow position={[0, 0.28, 0]}>
          <cylinderGeometry args={[2.35, 2.48, 0.55, 24]} />
          <meshStandardMaterial color="#46565e" roughness={0.62} metalness={0.38} />
        </mesh>
        <mesh position={[0, 0.31, 0]}>
          <cylinderGeometry args={[2.36, 2.36, 0.12, 24]} />
          <meshStandardMaterial color="#92a19e" roughness={0.38} metalness={0.65} />
        </mesh>
        <mesh castShadow position={[0, 0.57, 0]}>
          <sphereGeometry args={[2.02, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.53]} />
          <meshPhysicalMaterial color="#63cbd1" emissive="#164b56" emissiveIntensity={0.2} transparent opacity={0.82} roughness={0.2} metalness={0.16} clearcoat={0.7} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.56, 0]}>
          <torusGeometry args={[1.96, 0.075, 10, 44]} />
          <meshStandardMaterial color="#e9c66c" metalness={0.66} roughness={0.25} />
        </mesh>
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return (
            <group key={i} position={[Math.cos(a) * 1.92, 0.82, Math.sin(a) * 1.92]} rotation={[0, -a, 0]}>
              <mesh castShadow><boxGeometry args={[0.055, 0.72, 0.065]} /><meshStandardMaterial color="#c6d0ca" metalness={0.7} roughness={0.3} /></mesh>
              <mesh position={[0, -0.43, 0]}><boxGeometry args={[0.1, 0.08, 0.12]} /><meshStandardMaterial color="#35464c" metalness={0.55} /></mesh>
            </group>
          );
        })}
        <group position={[0, 0.28, 2.18]}>
          <RoundedBox args={[1.0, 0.54, 0.74]} radius={0.11} smoothness={4} castShadow>
            <meshStandardMaterial color="#596970" roughness={0.56} metalness={0.38} />
          </RoundedBox>
          <RoundedBox args={[0.62, 0.4, 0.08]} radius={0.05} smoothness={3} position={[0, 0, 0.39]}>
            <meshStandardMaterial color="#1e3039" roughness={0.4} metalness={0.45} />
          </RoundedBox>
          <mesh position={[0, 0.16, 0.44]}><boxGeometry args={[0.34, 0.035, 0.02]} /><meshStandardMaterial color="#f5d17b" emissive="#be8734" emissiveIntensity={0.6} /></mesh>
          {[-0.23, 0.23].map((x) => <mesh key={x} position={[x, -0.02, 0.445]}><cylinderGeometry args={[0.035, 0.035, 0.05, 10]} /><meshStandardMaterial color="#c7d1ca" metalness={0.8} /></mesh>)}
        </group>
        <mesh position={[0, 1.05, 0]}><cylinderGeometry args={[0.07, 0.1, 1.05, 10]} /><meshStandardMaterial color="#ced6d0" metalness={0.76} roughness={0.28} /></mesh>
        <mesh position={[0, 1.63, 0]}><boxGeometry args={[0.45, 0.08, 0.34]} /><meshStandardMaterial color="#4f6267" metalness={0.38} /></mesh>
        <Beacon color={accent} active={false} height={2.15} />
      </group>
    );
  }

  if (id === "solar") {
    return (
      <group>
        <RoundedBox args={[2.7, 0.34, 1.9]} radius={0.12} smoothness={4} position={[0, 0.18, 0]} castShadow>
          <meshStandardMaterial color={p.body} roughness={0.58} metalness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0.38, 0]}><cylinderGeometry args={[0.12, 0.16, 0.42, 10]} /><meshStandardMaterial color="#879592" metalness={0.75} /></mesh>
        {[-0.85, 0.85].map((x) => (
          <group key={x} position={[x, 0.82, 0]}>
            <mesh rotation={[0.18, 0, 0]} castShadow><boxGeometry args={[1.02, 0.055, 1.62]} /><meshStandardMaterial color="#12334f" roughness={0.22} metalness={0.52} /></mesh>
            {[-0.3, 0, 0.3].map((z) => <mesh key={z} position={[0, 0.035, z]} rotation={[0.18, 0, 0]}><boxGeometry args={[0.95, 0.015, 0.025]} /><meshStandardMaterial color="#79b9ca" metalness={0.3} /></mesh>)}
            {[-0.47, 0, 0.47].map((z) => <mesh key={z} position={[0, 0.035, z]} rotation={[0.18, 0, 0]}><boxGeometry args={[0.018, 0.015, 1.53]} /><meshStandardMaterial color="#6c9fb3" /></mesh>)}
            {[-0.8, 0.8].map((z) => <mesh key={z} position={[0, 0.018, z]}><boxGeometry args={[1.06, 0.04, 0.04]} /><meshStandardMaterial color="#b3beb9" metalness={0.75} /></mesh>)}
            <mesh position={[0, -0.31, 0]} castShadow><cylinderGeometry args={[0.055, 0.065, 0.64, 10]} /><meshStandardMaterial color="#83918f" metalness={0.68} /></mesh>
            {[-0.48, 0.48].map((z) => <mesh key={z} position={[0, -0.29, z]} rotation={[0, 0, z * 0.43]}><boxGeometry args={[0.045, 0.56, 0.045]} /><meshStandardMaterial color="#78898d" metalness={0.62} /></mesh>)}
          </group>
        ))}
        <mesh position={[0, 0.38, 0.72]}><boxGeometry args={[0.65, 0.18, 0.12]} /><meshStandardMaterial color="#24343c" metalness={0.55} /></mesh>
        <Beacon color={accent} active={false} height={0.72} />
      </group>
    );
  }

  if (id === "battery") {
    return (
      <group>
        <RoundedBox args={[2.7, 0.34, 2.0]} radius={0.14} smoothness={4} position={[0, 0.18, 0]} castShadow>
          <meshStandardMaterial color={p.body} roughness={0.55} metalness={0.28} />
        </RoundedBox>
        {[-0.82, 0, 0.82].map((x) => (
          <group key={x} position={[x, 0.83, 0]}>
            <RoundedBox args={[0.58, 1.02, 1.18]} radius={0.12} smoothness={4} castShadow>
              <meshStandardMaterial color="#4a5b62" metalness={0.34} roughness={0.34} />
            </RoundedBox>
            <mesh position={[0, 0.52, 0.605]}><boxGeometry args={[0.32, 0.075, 0.025]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} /></mesh>
            {[-0.18, 0, 0.18].map((slot) => <mesh key={slot} position={[slot, 0.13, 0.606]}><boxGeometry args={[0.085, 0.035, 0.02]} /><meshStandardMaterial color="#1d292d" roughness={0.9} /></mesh>)}
            {[-0.36, 0.36].map((z) => <mesh key={z} position={[0, -0.02, z]}><boxGeometry args={[0.48, 0.035, 0.055]} /><meshStandardMaterial color="#a4afaa" metalness={0.72} /></mesh>)}
            <mesh position={[0, 0.57, -0.61]}><cylinderGeometry args={[0.075, 0.075, 0.15, 8]} /><meshStandardMaterial color="#e0c76f" metalness={0.6} /></mesh>
          </group>
        ))}
        <mesh position={[0, 0.38, -0.9]}><boxGeometry args={[2.2, 0.18, 0.12]} /><meshStandardMaterial color="#26373d" metalness={0.48} /></mesh>
        <Beacon color={accent} active={false} height={1.55} />
      </group>
    );
  }

  if (id === "oxygen" || id === "water") {
    const liquidColor = id === "water" ? "#57c9e7" : "#9bd7c9";
    return (
      <group>
        <RoundedBox args={[2.65, 0.28, 1.9]} radius={0.1} smoothness={3} position={[0, 0.15, 0]} castShadow>
          <meshStandardMaterial color={p.body} roughness={0.62} metalness={0.28} />
        </RoundedBox>
        {[-0.78, 0.78].map((x) => (
          <group key={x} position={[x, 0.92, 0]}>
            <mesh castShadow><cylinderGeometry args={[0.47, 0.52, 1.35, 20]} /><meshStandardMaterial color="#aeb9b5" roughness={0.34} metalness={0.48} /></mesh>
            <mesh position={[0, 0.72, 0]}><sphereGeometry args={[0.47, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} /><meshStandardMaterial color="#d8e0da" roughness={0.3} metalness={0.34} /></mesh>
            <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.49, 0.04, 8, 28]} /><meshStandardMaterial color="#d6dcd4" metalness={0.72} roughness={0.28} /></mesh>
            <mesh position={[0, -0.28, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.49, 0.04, 8, 28]} /><meshStandardMaterial color="#d6dcd4" metalness={0.72} roughness={0.28} /></mesh>
            <mesh position={[0, 0.64, 0]}><torusGeometry args={[0.36, 0.055, 8, 24]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} /></mesh>
            <mesh position={[0, -0.02, 0.505]}><boxGeometry args={[0.24, 0.34, 0.04]} /><meshStandardMaterial color="#33454c" metalness={0.45} /></mesh>
            <mesh position={[0, 0.1, 0.535]}><boxGeometry args={[0.14, 0.055, 0.02]} /><meshStandardMaterial color={liquidColor} emissive={liquidColor} emissiveIntensity={0.65} /></mesh>
            <mesh position={[0.39, 0.26, 0.1]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.06, 0.06, 0.34, 10]} /><meshStandardMaterial color="#8d9b99" metalness={0.72} /></mesh>
          </group>
        ))}
        <mesh position={[0, 0.49, 0]}><boxGeometry args={[0.12, 0.82, 0.12]} /><meshStandardMaterial color="#b3c0ba" metalness={0.72} /></mesh>
        <mesh position={[0, 0.5, 0.14]}><boxGeometry args={[0.42, 0.36, 0.07]} /><meshStandardMaterial color="#27383e" metalness={0.48} /></mesh>
        <mesh position={[0, 0.53, 0.19]}><boxGeometry args={[0.2, 0.16, 0.025]} /><meshStandardMaterial color={liquidColor} emissive={liquidColor} emissiveIntensity={0.8} /></mesh>
        <Beacon color={accent} active={false} height={1.72} />
      </group>
    );
  }

  if (id === "co2") {
    return (
      <group>
        <RoundedBox args={[2.72, 0.32, 2.0]} radius={0.12} smoothness={4} position={[0, 0.17, 0]} castShadow><meshStandardMaterial color={p.body} roughness={0.6} metalness={0.3} /></RoundedBox>
        {[-0.76, 0, 0.76].map((x, i) => (
          <group key={x} position={[x, 0.72, 0]}>
            <mesh castShadow><cylinderGeometry args={[0.3, 0.34, 0.88, 16]} /><meshStandardMaterial color={i === 1 ? "#687d7b" : "#85928e"} roughness={0.38} metalness={0.56} /></mesh>
            <mesh position={[0, 0.46, 0]}><cylinderGeometry args={[0.31, 0.31, 0.12, 16]} /><meshStandardMaterial color="#d4c9a0" metalness={0.55} /></mesh>
            <mesh position={[0, -0.34, 0]}><torusGeometry args={[0.32, 0.045, 7, 20]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} /></mesh>
            {[-0.12, 0.02, 0.16].map((y) => <mesh key={y} position={[0.343, y, 0]}><boxGeometry args={[0.04, 0.055, 0.16]} /><meshStandardMaterial color="#d6ddd7" metalness={0.68} /></mesh>)}
          </group>
        ))}
        <mesh position={[0, 1.28, 0]}><boxGeometry args={[2.05, 0.13, 0.16]} /><meshStandardMaterial color="#bcc6c0" metalness={0.67} /></mesh>
        {[-0.76, 0, 0.76].map((x) => <mesh key={x} position={[x, 1.1, 0]}><cylinderGeometry args={[0.055, 0.055, 0.35, 10]} /><meshStandardMaterial color="#d2b86b" metalness={0.5} /></mesh>)}
        <mesh position={[1.1, 0.55, 0.44]}><boxGeometry args={[0.36, 0.38, 0.07]} /><meshStandardMaterial color="#1a2c35" metalness={0.4} /></mesh>
        <mesh position={[1.1, 0.57, 0.485]}><boxGeometry args={[0.24, 0.19, 0.025]} /><meshStandardMaterial color="#76d8cc" emissive="#329e94" emissiveIntensity={0.6} /></mesh>
        <Beacon color={accent} active={false} height={1.55} />
      </group>
    );
  }

  if (id === "thermal") {
    return (
      <group>
        <RoundedBox args={[2.75, 0.34, 2.0]} radius={0.12} smoothness={4} position={[0, 0.18, 0]} castShadow><meshStandardMaterial color="#4b5b61" roughness={0.54} metalness={0.38} /></RoundedBox>
        <RoundedBox args={[1.28, 0.88, 1.24]} radius={0.13} smoothness={4} position={[0, 0.78, 0]} castShadow><meshStandardMaterial color="#73554a" roughness={0.5} metalness={0.32} /></RoundedBox>
        <mesh position={[0, 1.28, 0.03]}><boxGeometry args={[0.88, 0.12, 0.92]} /><meshStandardMaterial color="#323f43" metalness={0.6} /></mesh>
        <mesh position={[0, 1.3, 0.5]}><boxGeometry args={[0.52, 0.2, 0.05]} /><meshStandardMaterial color="#202c32" metalness={0.36} /></mesh>
        <mesh position={[0, 1.32, 0.535]}><boxGeometry args={[0.3, 0.08, 0.02]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} /></mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 1.53, 0.92, 0]}>
            <mesh castShadow><boxGeometry args={[0.13, 1.52, 2.28]} /><meshStandardMaterial color="#34484f" roughness={0.45} metalness={0.48} /></mesh>
            <mesh position={[side * 0.09, 0, 0]}><boxGeometry args={[0.07, 1.36, 2.08]} /><meshStandardMaterial color="#667a80" roughness={0.32} metalness={0.58} /></mesh>
            {Array.from({ length: 9 }, (_, i) => (
              <mesh key={i} position={[side * 0.14, -0.59 + i * 0.145, 0]} castShadow>
                <boxGeometry args={[0.18, 0.055, 2.0]} />
                <meshStandardMaterial color={i % 2 === 0 ? "#c07a51" : "#8d6b58"} roughness={0.36} metalness={0.52} emissive={i % 3 === 0 ? "#6c2919" : "#000000"} emissiveIntensity={0.16} />
              </mesh>
            ))}
            {[-0.72, 0.72].map((z) => <mesh key={z} position={[side * 0.12, -0.02, z]}><boxGeometry args={[0.22, 1.56, 0.06]} /><meshStandardMaterial color="#b7c1bb" metalness={0.66} /></mesh>)}
            <mesh position={[0, 0.78, 1.19]}><boxGeometry args={[0.2, 0.22, 0.12]} /><meshStandardMaterial color="#e6bb66" emissive="#c17d31" emissiveIntensity={0.55} /></mesh>
          </group>
        ))}
        {[-0.62, 0.62].map((z) => <mesh key={z} position={[0.92, 0.83, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.065, 0.065, 0.9, 10]} /><meshStandardMaterial color="#d5a568" metalness={0.62} roughness={0.28} /></mesh>)}
        {[-0.36, 0.36].map((z) => <mesh key={z} position={[-0.9, 0.55, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 0.55, 10]} /><meshStandardMaterial color="#7ecbd0" metalness={0.5} emissive="#236d72" emissiveIntensity={0.25} /></mesh>)}
        <Beacon color={accent} active={false} height={1.72} />
      </group>
    );
  }

  if (id === "comms" || id === "navigation") {
    const nav = id === "navigation";
    return (
      <group>
        <RoundedBox args={[2.45, 0.34, 1.9]} radius={0.12} smoothness={4} position={[0, 0.18, 0]} castShadow><meshStandardMaterial color={p.body} roughness={0.56} metalness={0.32} /></RoundedBox>
        <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.22, 0.25, 0.2, 12]} /><meshStandardMaterial color="#83928e" metalness={0.68} /></mesh>
        <mesh position={[0, 1.05, 0]} castShadow><cylinderGeometry args={[0.08, 0.13, 1.25, 12]} /><meshStandardMaterial color="#d7dfdb" metalness={0.76} roughness={0.22} /></mesh>
        <mesh position={[0, 1.67, 0]}><cylinderGeometry args={[0.3, 0.1, 0.22, 12]} /><meshStandardMaterial color="#58696b" metalness={0.68} /></mesh>
        <mesh position={[0, 1.86, 0.04]} rotation={[Math.PI / 2.25, 0, nav ? 0.38 : -0.28]} castShadow><sphereGeometry args={[nav ? 0.65 : 0.78, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.46]} /><meshStandardMaterial color="#d8e0db" roughness={0.26} metalness={0.46} side={THREE.DoubleSide} /></mesh>
        {[-0.42, 0.42].map((x) => <mesh key={x} position={[x, 1.48, 0.1]} rotation={[0, 0, -x * 0.7]} castShadow><cylinderGeometry args={[0.04, 0.05, 0.78, 8]} /><meshStandardMaterial color="#9eaaa7" metalness={0.76} roughness={0.3} /></mesh>)}
        <mesh position={[0.77, 0.5, 0.35]}><boxGeometry args={[0.42, 0.34, 0.07]} /><meshStandardMaterial color="#1c2b35" metalness={0.4} /></mesh>
        <mesh position={[0.77, 0.51, 0.392]}><boxGeometry args={[0.25, 0.18, 0.02]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} /></mesh>
        {[-0.65, 0.65].map((x) => <mesh key={x} position={[x, 0.24, -0.74]}><boxGeometry args={[0.25, 0.18, 0.22]} /><meshStandardMaterial color="#313f44" metalness={0.4} /></mesh>)}
        <Beacon color={accent} active={false} height={2.16} />
      </group>
    );
  }

  if (id === "radiation") {
    return (
      <group>
        <RoundedBox args={[2.78, 0.34, 2.08]} radius={0.15} smoothness={4} position={[0, 0.18, 0]} castShadow><meshStandardMaterial color={p.body} roughness={0.62} metalness={0.3} /></RoundedBox>
        <mesh castShadow position={[0, 0.62, 0]}><cylinderGeometry args={[1.0, 1.12, 0.58, 16]} /><meshStandardMaterial color="#515c65" roughness={0.58} metalness={0.42} /></mesh>
        <mesh castShadow position={[0, 0.94, 0]}><sphereGeometry args={[1.02, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.52]} /><meshStandardMaterial color="#75699b" roughness={0.3} metalness={0.28} transparent opacity={0.8} depthWrite={false} /></mesh>
        <mesh position={[0, 0.93, 0]}><torusGeometry args={[0.96, 0.075, 8, 32]} /><meshStandardMaterial color={accent} metalness={0.5} roughness={0.28} /></mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return <mesh key={i} position={[Math.cos(a) * 1.02, 0.72, Math.sin(a) * 1.02]} rotation={[0, -a, 0]}><boxGeometry args={[0.12, 0.48, 0.06]} /><meshStandardMaterial color="#abb4b1" metalness={0.65} roughness={0.4} /></mesh>;
        })}
        <mesh position={[0, 0.58, 1.08]}><boxGeometry args={[0.62, 0.38, 0.08]} /><meshStandardMaterial color="#1e2b32" metalness={0.4} /></mesh>
        <mesh position={[0, 0.6, 1.13]}><boxGeometry args={[0.38, 0.2, 0.025]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.75} /></mesh>
        <Beacon color={accent} active={false} height={1.78} />
      </group>
    );
  }

  if (id === "science") {
    return (
      <group>
        <RoundedBox args={[2.78, 0.34, 2.08]} radius={0.14} smoothness={4} position={[0, 0.18, 0]} castShadow><meshStandardMaterial color={p.body} roughness={0.6} metalness={0.34} /></RoundedBox>
        <mesh castShadow position={[0, 0.48, 0]}><cylinderGeometry args={[1.06, 1.12, 0.3, 18]} /><meshStandardMaterial color="#424f5b" metalness={0.45} roughness={0.45} /></mesh>
        <mesh castShadow position={[0, 0.9, 0]}><sphereGeometry args={[0.86, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.5]} /><meshStandardMaterial color="#7060a0" emissive="#211b4d" emissiveIntensity={0.16} transparent opacity={0.86} roughness={0.25} depthWrite={false} /></mesh>
        <mesh position={[0, 0.9, 0]}><torusGeometry args={[0.82, 0.065, 8, 32]} /><meshStandardMaterial color={accent} metalness={0.54} roughness={0.25} /></mesh>
        <group position={[0.82, 0.58, 0.2]} rotation={[0, 0, -0.6]}>
          <mesh position={[0, 0.26, 0]}><cylinderGeometry args={[0.07, 0.1, 0.54, 10]} /><meshStandardMaterial color="#bdc6c0" metalness={0.74} /></mesh>
          <mesh position={[0, 0.58, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.13, 0.13, 0.38, 12]} /><meshStandardMaterial color="#202e37" metalness={0.54} /></mesh>
          <mesh position={[0, 0.58, 0.2]}><circleGeometry args={[0.09, 16]} /><meshBasicMaterial color="#69e5ff" toneMapped={false} /></mesh>
        </group>
        {[-0.72, 0.72].map((x) => <mesh key={x} position={[x, 0.32, 0.86]}><boxGeometry args={[0.42, 0.16, 0.1]} /><meshStandardMaterial color="#a9b5af" metalness={0.68} /></mesh>)}
        <mesh position={[0, 0.48, 1.1]}><boxGeometry args={[0.66, 0.28, 0.06]} /><meshStandardMaterial color="#1b2c34" metalness={0.44} /></mesh>
        <mesh position={[0, 0.5, 1.14]}><boxGeometry args={[0.44, 0.14, 0.02]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} /></mesh>
        <Beacon color={accent} active={false} height={1.75} />
      </group>
    );
  }

  if (id === "extraction") {
    return (
      <group>
        <RoundedBox args={[2.78, 0.34, 2.08]} radius={0.12} smoothness={4} position={[0, 0.18, 0]} castShadow><meshStandardMaterial color={p.body} roughness={0.62} metalness={0.32} /></RoundedBox>
        {[-0.87, 0.87].map((x) => <mesh key={x} position={[x, 0.42, 0]}><boxGeometry args={[0.18, 0.48, 1.52]} /><meshStandardMaterial color="#3a4548" metalness={0.42} /></mesh>)}
        {[-0.72, 0.72].map((x) => <mesh key={x} position={[x, 0.82, 0]} castShadow><cylinderGeometry args={[0.32, 0.42, 1.12, 14]} /><meshStandardMaterial color="#687673" metalness={0.44} roughness={0.4} /></mesh>)}
        <mesh position={[0, 1.28, 0]}><boxGeometry args={[0.82, 0.26, 0.76]} /><meshStandardMaterial color="#d0b16a" metalness={0.42} /></mesh>
        <mesh position={[0, 1.9, 0]} castShadow><cylinderGeometry args={[0.16, 0.19, 1.02, 12]} /><meshStandardMaterial color="#c6cfca" metalness={0.74} roughness={0.28} /></mesh>
        <mesh position={[0, 2.5, 0]}><cylinderGeometry args={[0.07, 0.2, 0.4, 10]} /><meshStandardMaterial color="#596564" metalness={0.5} /></mesh>
        <mesh position={[0, 2.75, 0]}><coneGeometry args={[0.13, 0.34, 8]} /><meshStandardMaterial color="#b4bcb5" metalness={0.62} /></mesh>
        <mesh position={[0.42, 1.62, 0]} rotation={[0, 0, -0.5]}><cylinderGeometry args={[0.06, 0.08, 0.8, 8]} /><meshStandardMaterial color="#d8b56c" metalness={0.58} /></mesh>
        <mesh position={[0.82, 1.38, 0]}><torusGeometry args={[0.24, 0.045, 7, 20]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} /></mesh>
        <Beacon color={accent} active={false} height={3.0} />
      </group>
    );
  }

  if (id === "isru") {
    return (
      <group>
        <RoundedBox args={[2.82, 0.34, 2.08]} radius={0.12} smoothness={4} position={[0, 0.18, 0]} castShadow><meshStandardMaterial color={p.body} roughness={0.64} metalness={0.3} /></RoundedBox>
        {[-0.82, 0, 0.82].map((x) => (
          <group key={x} position={[x, 0.69, -0.05]}>
            <mesh castShadow><cylinderGeometry args={[0.29, 0.33, 0.86, 16]} /><meshStandardMaterial color="#7f918b" metalness={0.48} roughness={0.36} /></mesh>
            <mesh position={[0, 0.45, 0]}><torusGeometry args={[0.29, 0.035, 6, 20]} /><meshStandardMaterial color="#d7c37d" metalness={0.5} /></mesh>
            <mesh position={[0, -0.14, 0]}><torusGeometry args={[0.3, 0.04, 6, 20]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.36} /></mesh>
            <mesh position={[0, 0.52, 0]}><cylinderGeometry args={[0.075, 0.075, 0.18, 8]} /><meshStandardMaterial color="#d5dfd7" metalness={0.72} /></mesh>
          </group>
        ))}
        <mesh position={[0, 1.24, 0.14]}><boxGeometry args={[2.08, 0.13, 0.15]} /><meshStandardMaterial color="#b4c0ba" metalness={0.68} /></mesh>
        {[-0.82, 0.82].map((x) => <mesh key={x} position={[x, 1.06, 0.18]}><cylinderGeometry args={[0.055, 0.055, 0.34, 8]} /><meshStandardMaterial color="#e2b960" metalness={0.64} /></mesh>)}
        <mesh position={[0.88, 0.5, 0.55]}><boxGeometry args={[0.38, 0.38, 0.06]} /><meshStandardMaterial color="#1d2e37" metalness={0.4} /></mesh>
        <mesh position={[0.88, 0.52, 0.59]}><boxGeometry args={[0.24, 0.2, 0.02]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} /></mesh>
        <Beacon color={accent} active={false} height={1.52} />
      </group>
    );
  }

  if (id === "agriculture") {
    return (
      <group>
        <RoundedBox args={[2.95, 0.32, 2.1]} radius={0.14} smoothness={4} position={[0, 0.17, 0]} castShadow><meshStandardMaterial color={p.body} roughness={0.66} metalness={0.26} /></RoundedBox>
        <RoundedBox args={[2.55, 1.12, 1.72]} radius={0.26} smoothness={6} position={[0, 0.85, 0]} castShadow><meshStandardMaterial color="#5ebd76" transparent opacity={0.28} roughness={0.18} metalness={0.08} side={THREE.DoubleSide} depthWrite={false} /></RoundedBox>
        {[-0.97, -0.49, 0, 0.49, 0.97].map((x) => <mesh key={x} position={[x, 0.84, 0]}><boxGeometry args={[0.035, 1.14, 1.84]} /><meshStandardMaterial color="#adc0b7" metalness={0.68} roughness={0.28} /></mesh>)}
        {[-0.61, 0, 0.61].map((z) => <mesh key={z} position={[0, 0.55, z]}><boxGeometry args={[2.5, 0.08, 0.13]} /><meshStandardMaterial color="#2c4537" roughness={0.8} /></mesh>)}
        {[-0.92, -0.46, 0, 0.46, 0.92].map((x) => (
          <group key={x} position={[x, 0.59, -0.3]}>
            <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[0.025, 0.035, 0.28, 6]} /><meshStandardMaterial color="#6bd17b" /></mesh>
            {[-0.08, 0.08].map((offset) => <mesh key={offset} position={[offset, 0.22, 0]} rotation={[0, 0, offset * 7]}><sphereGeometry args={[0.075, 9, 7]} /><meshStandardMaterial color="#52b968" emissive="#207735" emissiveIntensity={0.22} /></mesh>)}
          </group>
        ))}
        <mesh position={[0, 1.45, 0]}><boxGeometry args={[1.7, 0.07, 0.08]} /><meshStandardMaterial color="#e0d17c" emissive="#8c7730" emissiveIntensity={0.35} /></mesh>
        <mesh position={[0, 0.4, 1.08]}><boxGeometry args={[0.55, 0.26, 0.07]} /><meshStandardMaterial color="#1e2d35" metalness={0.4} /></mesh>
        <mesh position={[0, 0.42, 1.125]}><boxGeometry args={[0.34, 0.12, 0.02]} /><meshStandardMaterial color="#6ee8a0" emissive="#23975f" emissiveIntensity={0.8} /></mesh>
        <Beacon color={accent} active={false} height={1.63} />
      </group>
    );
  }

  if (id === "grid") {
    return (
      <group>
        <RoundedBox args={[2.85, 0.34, 2.08]} radius={0.12} smoothness={4} position={[0, 0.18, 0]} castShadow><meshStandardMaterial color={p.body} roughness={0.62} metalness={0.4} /></RoundedBox>
        {[-0.78, 0, 0.78].map((x, i) => (
          <group key={x} position={[x, 0.58, 0]}>
            <RoundedBox args={[0.56, 0.58, 1.22]} radius={0.07} smoothness={3} castShadow><meshStandardMaterial color={i === 1 ? "#53686c" : "#34484f"} metalness={0.38} roughness={0.42} /></RoundedBox>
            <mesh position={[0, 0.05, 0.63]}><boxGeometry args={[0.24, 0.2, 0.025]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} /></mesh>
            {[-0.18, 0, 0.18].map((z) => <mesh key={z} position={[0, -0.14, z]}><boxGeometry args={[0.34, 0.035, 0.03]} /><meshStandardMaterial color="#bfc9c2" metalness={0.72} /></mesh>)}
          </group>
        ))}
        {[-0.86, 0, 0.86].map((x) => (
          <group key={x} position={[x, 1.02, -0.12]}>
            <mesh><cylinderGeometry args={[0.16, 0.18, 0.12, 10]} /><meshStandardMaterial color="#8d9b98" metalness={0.62} /></mesh>
            {[-0.1, 0, 0.1].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[0.105, 0.105, 0.055, 10]} /><meshStandardMaterial color="#d7c879" metalness={0.58} /></mesh>)}
          </group>
        ))}
        <mesh position={[0, 1.28, -0.12]}><boxGeometry args={[2.16, 0.08, 0.08]} /><meshStandardMaterial color="#9eadaa" metalness={0.8} /></mesh>
        {[-0.53, 0, 0.53].map((x) => <mesh key={x} position={[x, 1.22, -0.12]}><cylinderGeometry args={[0.035, 0.035, 0.16, 8]} /><meshStandardMaterial color="#e8cd67" metalness={0.6} /></mesh>)}
        <mesh position={[0, 0.49, 0.74]}><boxGeometry args={[0.9, 0.18, 0.08]} /><meshStandardMaterial color="#1b2b31" metalness={0.4} /></mesh>
        <mesh position={[0, 0.51, 0.79]}><boxGeometry args={[0.68, 0.1, 0.025]} /><meshStandardMaterial color="#56dfe8" emissive="#188994" emissiveIntensity={0.8} /></mesh>
        <Beacon color={accent} active={false} height={1.5} />
      </group>
    );
  }

  if (id === "maintenance") {
    return (
      <group>
        <RoundedBox args={[2.9, 0.34, 2.08]} radius={0.12} smoothness={4} position={[0, 0.18, 0]} castShadow><meshStandardMaterial color={p.body} roughness={0.6} metalness={0.34} /></RoundedBox>
        <mesh castShadow position={[0, 0.62, -0.12]}><boxGeometry args={[1.9, 0.72, 1.28]} /><meshStandardMaterial color="#4b5b61" roughness={0.58} metalness={0.38} /></mesh>
        <mesh position={[0, 0.65, 0.54]}><boxGeometry args={[1.18, 0.56, 0.07]} /><meshStandardMaterial color="#18262c" roughness={0.5} metalness={0.3} /></mesh>
        <mesh position={[0, 0.65, 0.59]}><boxGeometry args={[0.9, 0.4, 0.025]} /><meshStandardMaterial color="#283f43" metalness={0.32} /></mesh>
        {[-0.3, 0, 0.3].map((x) => <mesh key={x} position={[x, 0.65, 0.61]}><boxGeometry args={[0.035, 0.29, 0.02]} /><meshStandardMaterial color="#d2b56a" metalness={0.38} /></mesh>)}
        <group position={[0.98, 0.64, -0.16]}>
          <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.06, 0.06, 0.88, 8]} /><meshStandardMaterial color="#bcc7c0" metalness={0.74} /></mesh>
          <mesh position={[0, 0.88, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.06, 0.06, 0.6, 8]} /><meshStandardMaterial color="#bcc7c0" metalness={0.74} /></mesh>
          <mesh position={[-0.28, 0.88, 0]}><boxGeometry args={[0.08, 0.26, 0.08]} /><meshStandardMaterial color={accent} metalness={0.58} /></mesh>
          <mesh position={[0.24, 0.65, 0]} rotation={[0, 0, 0.5]}><cylinderGeometry args={[0.04, 0.05, 0.4, 8]} /><meshStandardMaterial color="#c3cec4" metalness={0.72} /></mesh>
        </group>
        <mesh position={[-0.78, 0.38, 0.74]}><boxGeometry args={[0.46, 0.18, 0.08]} /><meshStandardMaterial color="#1d2d35" metalness={0.45} /></mesh>
        <mesh position={[-0.78, 0.4, 0.79]}><boxGeometry args={[0.3, 0.1, 0.025]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} /></mesh>
        <Beacon color={accent} active={false} height={1.45} />
      </group>
    );
  }

  return (
    <group>
      <RoundedBox args={[2.7, 0.34, 1.98]} radius={0.13} smoothness={4} position={[0, 0.18, 0]} castShadow>
        <meshStandardMaterial color={p.body} roughness={0.63} metalness={0.28} />
      </RoundedBox>
      <mesh position={[0, 0.66, 0]} castShadow><boxGeometry args={[1.6, 0.7, 1.18]} /><meshStandardMaterial color={p.body} roughness={0.68} metalness={0.32} /></mesh>
      <mesh position={[0, 1.06, 0.61]}><boxGeometry args={[0.84, 0.34, 0.05]} /><meshStandardMaterial color="#1c2a31" metalness={0.4} /></mesh>
      <mesh position={[0, 1.08, 0.65]}><boxGeometry args={[0.6, 0.21, 0.025]} /><meshStandardMaterial color={p.accent} emissive={p.accent} emissiveIntensity={0.75} /></mesh>
      {[-0.48, 0, 0.48].map((x) => <mesh key={x} position={[x, 0.3, -0.75]}><boxGeometry args={[0.22, 0.13, 0.18]} /><meshStandardMaterial color="#334448" metalness={0.48} /></mesh>)}
      <Beacon color={accent} active={false} height={1.55} />
    </group>
  );
}

function Rover({ task, position, resourceNodes, onClick, selected, alerted }: { task: string; position: [number, number]; resourceNodes: MissionResourceNode[]; onClick: () => void; selected: boolean; alerted: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const targetLabel = task.startsWith("SURVEYING ") ? task.slice("SURVEYING ".length) : "";
  const target = resourceNodes.find((node) => node.label === targetLabel);
  const destination = target ? nodeWorldPosition(target) : position;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const active = !!target && task.startsWith("SURVEYING ");
    const phase = active ? (Math.sin(clock.getElapsedTime() * 0.24) + 1) / 2 : 0;
    const x = THREE.MathUtils.lerp(position[0], destination[0], phase);
    const z = THREE.MathUtils.lerp(position[1], destination[1], phase);
    ref.current.position.set(x, terrainHeight(x, z) + 0.47, z);
    ref.current.position.y += Math.sin(clock.getElapsedTime() * 2) * 0.008;
  });
  const wheelZ = [-0.55, 0, 0.55];
  return (
    <group ref={ref} position={[position[0], PAD_Y + 0.47, position[1]]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh castShadow position={[0, 0.01, 0]}>
        <RoundedBox args={[1.72, 0.28, 1.12]} radius={0.12} smoothness={4}>
          <meshStandardMaterial color="#b99a5d" roughness={0.64} metalness={0.3} />
        </RoundedBox>
      </mesh>
      <mesh castShadow position={[0, 0.22, 0.02]}>
        <RoundedBox args={[1.22, 0.18, 0.82]} radius={0.08} smoothness={3}>
          <meshStandardMaterial color="#d7bd7a" roughness={0.55} metalness={0.24} />
        </RoundedBox>
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh castShadow position={[side * 0.68, -0.12, 0]} rotation={[0, 0, side * 0.08]}>
            <boxGeometry args={[0.09, 0.07, 1.36]} />
            <meshStandardMaterial color="#515b5d" metalness={0.58} roughness={0.36} />
          </mesh>
          {wheelZ.map((z) => (
            <group key={z} position={[side * 0.82, -0.16, z]}>
              <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.235, 0.235, 0.19, 20]} />
                <meshStandardMaterial color="#1e2528" roughness={0.96} metalness={0.04} />
              </mesh>
              <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.145, 0.145, 0.205, 16]} />
                <meshStandardMaterial color="#8d9997" roughness={0.36} metalness={0.76} />
              </mesh>
              <mesh position={[side * 0.108, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[0.157, 0.024, 6, 20]} />
                <meshStandardMaterial color="#c7b16f" metalness={0.56} roughness={0.34} />
              </mesh>
              {Array.from({ length: 10 }, (_, i) => (
                <mesh key={i} position={[side * 0.1, Math.sin(i * Math.PI / 5) * 0.19, Math.cos(i * Math.PI / 5) * 0.19]} rotation={[i * Math.PI / 5, 0, 0]}>
                  <boxGeometry args={[0.018, 0.045, 0.07]} />
                  <meshStandardMaterial color="#343b3d" roughness={0.88} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.326, -0.02]}>
        <boxGeometry args={[0.88, 0.026, 0.58]} />
        <meshStandardMaterial color="#17364d" roughness={0.26} metalness={0.48} />
      </mesh>
      {[-0.27, -0.09, 0.09, 0.27].map((x) => (
        <mesh key={x} position={[x, 0.342, -0.02]}>
          <boxGeometry args={[0.012, 0.008, 0.56]} />
          <meshStandardMaterial color="#80b7cb" metalness={0.34} roughness={0.3} />
        </mesh>
      ))}
      {[-0.18, 0, 0.18].map((z) => (
        <mesh key={z} position={[0, 0.342, z - 0.02]}>
          <boxGeometry args={[0.88, 0.008, 0.012]} />
          <meshStandardMaterial color="#80b7cb" metalness={0.34} roughness={0.3} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.57, 0.25]}>
        <cylinderGeometry args={[0.035, 0.055, 0.5, 10]} />
        <meshStandardMaterial color="#aab4ad" metalness={0.78} roughness={0.28} />
      </mesh>
      <mesh castShadow position={[0, 0.84, 0.25]}>
        <RoundedBox args={[0.43, 0.18, 0.22]} radius={0.045} smoothness={3}>
          <meshStandardMaterial color="#d3c18a" metalness={0.25} roughness={0.42} />
        </RoundedBox>
      </mesh>
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.84, 0.126]}>
          <sphereGeometry args={[0.055, 14, 10]} />
          <meshStandardMaterial color="#49d7ea" emissive="#1a8796" emissiveIntensity={0.8} metalness={0.5} roughness={0.18} />
        </mesh>
      ))}
      <mesh position={[-0.58, 0.43, -0.12]} rotation={[0.4, 0, 0.3]}>
        <cylinderGeometry args={[0.24, 0.09, 0.08, 22, 1, true]} />
        <meshStandardMaterial color="#c3c8c0" side={THREE.DoubleSide} metalness={0.45} roughness={0.36} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.02, 0.58]}>
          <sphereGeometry args={[0.07, 12, 8]} />
          <meshStandardMaterial color="#fff0a6" emissive="#ffca63" emissiveIntensity={1.15} />
        </mesh>
      ))}
      <group position={[0.48, 0.14, 0.53]} rotation={[0.1, 0, -0.22]}>
        <mesh position={[0, 0.15, 0.18]} rotation={[0.55, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.055, 0.4, 9]} />
          <meshStandardMaterial color="#aeb8b1" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.29, 0.36]} rotation={[0.9, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.035, 0.25, 8]} />
          <meshStandardMaterial color="#d1bd7d" metalness={0.62} roughness={0.38} />
        </mesh>
        <mesh position={[0, 0.39, 0.47]}>
          <coneGeometry args={[0.065, 0.16, 8]} />
          <meshStandardMaterial color="#6b7673" metalness={0.65} roughness={0.35} />
        </mesh>
      </group>
      <mesh position={[0, 0.38, -0.42]}>
        <boxGeometry args={[0.3, 0.12, 0.24]} />
        <meshStandardMaterial color="#4b6264" metalness={0.4} roughness={0.48} />
      </mesh>
      <SelectionRing selected={selected} alerted={alerted} radius={1.34} height={-0.32} />
      {task !== "STANDBY" && <Text position={[0, 1.14, 0]} rotation={[-0.7, 0, 0]} fontSize={0.17} color="#fff0a8" outlineWidth={0.025} outlineColor="#1c1815" anchorX="center">{task}</Text>}
    </group>
  );
}

function SelectionRing({ selected, alerted, radius, height = 0.23 }: { selected: boolean; alerted: boolean; radius: number; height?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = alerted ? 1 + (Math.sin(t * 5.2) + 1) * 0.055 : selected ? 1.025 : 1;
    if (ref.current) ref.current.scale.set(pulse, pulse, pulse);
    if (haloRef.current && alerted) {
      const glow = 0.1 + (Math.sin(t * 4.1) + 1) * 0.045;
      const material = haloRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = glow;
    }
  });
  if (!selected && !alerted) return null;
  const color = alerted ? "#ff2846" : "#ffe36d";
  return (
    <group frustumCulled={false}>
      {alerted && (
        <>
          {/* A broad, above-ground emissive pool makes the affected asset obvious at every zoom. */}
          <mesh ref={haloRef} position={[0, height - 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={20}>
            <circleGeometry args={[radius + 0.22, 72]} />
            <meshBasicMaterial color="#ff1f3c" transparent opacity={0.14} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, height + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={21}>
            <ringGeometry args={[radius + 0.10, radius + 0.18, 72]} />
            <meshBasicMaterial color="#ff4b61" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
          </mesh>
          <pointLight position={[0, height + 0.28, 0]} color="#ff1f3c" intensity={3.2} distance={Math.max(4.5, radius * 2.8)} decay={2} />
        </>
      )}
      <mesh ref={ref} position={[0, height + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={22}>
        <ringGeometry args={[radius, radius + (alerted ? 0.17 : 0.12), 72]} />
        <meshBasicMaterial color={color} transparent opacity={alerted ? 1 : 0.94} depthWrite={false} toneMapped={false} />
      </mesh>
      {alerted && (
        <mesh position={[0, height + 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={23}>
          <ringGeometry args={[radius + 0.29, radius + 0.35, 72]} />
          <meshBasicMaterial color="#ff7988" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function ResourceMarker({ node, selected, surveyed, onClick }: { node: MissionResourceNode; selected: boolean; surveyed: boolean; onClick: ()=>void }) {
  const ref=useRef<THREE.Group>(null);
  const [x,z]=nodeWorldPosition(node);
  const color=node.kind==="ICE"?"#55e7ff":node.kind==="MINERAL"?"#ffd25b":node.kind==="SCIENCE"?"#d18dff":"#b5a384";
  useFrame(({clock})=>{ if(ref.current) ref.current.scale.setScalar(selected?1.1+(Math.sin(clock.getElapsedTime()*4)+1)*0.03:1); });
  return <group ref={ref} position={[x,terrainHeight(x,z)+0.5,z]} onClick={(e)=>{e.stopPropagation();onClick();}}>
    <mesh castShadow><octahedronGeometry args={[0.38,0]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected?0.9:0.45}/></mesh>
    <mesh position={[0,-0.34,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.48,selected?0.74:0.62,24]}/><meshBasicMaterial color={color} transparent opacity={0.82}/></mesh>
    {selected && <Text position={[0,0.72,0]} rotation={[-0.7,0,0]} fontSize={0.18} color="#fff2c0" outlineWidth={0.025} outlineColor="#3a2d20" anchorX="center">{surveyed?"SURVEYED":node.label}</Text>}
  </group>;
}

function Crew({ mars }: { mars: boolean }) {
  const routes: Array<Array<[number,number]>> = [
    [[-8.45,7.15],[-8.45,11],[-4.2,11],[-8.45,11],[-8.45,-0.6],[0,-0.6],[0,3.3],[8.45,3.3],[8.45,7.15]],
    [[8.45,-12.2],[8.45,-8.35],[0,-8.35],[0,-12.2],[-4.2,-12.2]],
    [[-12.5,3.3],[-8.45,3.3],[-8.45,-8.35],[-12.5,-8.35],[-12.5,3.3]],
  ];
  return <group>{Array.from({length:mars?7:5},(_,i)=><CrewMember key={i} route={routes[i%routes.length]} index={i} mars={mars}/>)}</group>;
}

function CrewMember({ route,index,mars }:{route:Array<[number,number]>;index:number;mars:boolean}) {
  const ref=useRef<THREE.Group>(null);
  useFrame(({clock})=>{
    if(!ref.current)return;
    const p=((clock.getElapsedTime()*0.14)+index*0.22)%(route.length);
    const i=Math.floor(p); const f=p-i;
    const [ax,az]=route[i], [bx,bz]=route[(i+1)%route.length];
    const x=THREE.MathUtils.lerp(ax,bx,f), z=THREE.MathUtils.lerp(az,bz,f);
    ref.current.position.set(x,-0.176,z);
    ref.current.rotation.y=Math.atan2(bx-ax,bz-az);
  });
  const suit=["#67c9d9","#e4bb61","#d47c69","#83b97d","#9d8bd1"][index%5];
  return <group ref={ref} scale={1.6}>
    <mesh castShadow position={[0,0.43,0]}><capsuleGeometry args={[0.13,0.28,4,8]}/><meshStandardMaterial color={suit}/></mesh>
    <mesh castShadow position={[0,0.75,0]}><sphereGeometry args={[0.12,14,10]}/><meshStandardMaterial color={mars?"#b9c0bd":"#d2b65f"} metalness={0.15}/></mesh>
    <mesh position={[0,0.75,0.102]}><boxGeometry args={[0.13,0.055,0.018]}/><meshStandardMaterial color="#61e9f2" emissive="#218e99" emissiveIntensity={0.3}/></mesh>
  </group>;
}

function ColonyBuilding({
  track, tier, runtime, selected, alerted, position, onClick, mars
}: {
  track: TechnologyTrack;
  tier: Tier;
  runtime: BuildingRuntime;
  selected: boolean;
  alerted: boolean;
  position: [number, number];
  onClick: () => void;
  mars: boolean;
}) {
  const [x, z] = position;
  const p = palette(track.id);
  return (
    <group
      position={[x, PAD_Y + 0.07, z]}
      rotation={[0, BUILDING_ROTATIONS[track.id] ?? 0, 0]}
      frustumCulled={false}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      <Pad position={[0, 0]} size={track.id === "habitat" ? 7.4 : 3.65} mars={mars} accent={p.accent} />
      <group position={[0, 0.04, 0]} frustumCulled={false}>
        <BuildingArt id={track.id} accent={tierColor(tier)} />
      </group>
      {track.id !== "habitat" && (
        <mesh position={[0, 0.095, 0]} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
          <ringGeometry args={[1.42, 1.54, 40]} />
          <meshBasicMaterial color={statusColor(runtime.condition)} transparent opacity={0.94} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {(runtime.upgradeLevel ?? 0) > 0 && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
          <ringGeometry args={[1.62, 1.69, 40]} />
          <meshBasicMaterial color="#efc85f" transparent opacity={0.98} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <SelectionRing selected={selected} alerted={alerted} radius={track.id === "habitat" ? 4.0 : 2.05} height={0.12} />
      <Text frustumCulled={false} position={[0, track.id === "habitat" ? 4.0 : track.id === "extraction" ? 3.65 : 2.75, 0]} rotation={[-0.68, 0, 0]} fontSize={track.id === "habitat" ? 0.28 : 0.2} color={selected ? "#fff0a2" : "#d6e3df"} outlineWidth={0.035} outlineColor="#1d1a18" anchorX="center">{track.category.toUpperCase()}</Text>
      <Text frustumCulled={false} position={[0, track.id === "habitat" ? 3.63 : track.id === "extraction" ? 3.34 : 2.46, 0]} rotation={[-0.68, 0, 0]} fontSize={0.12} color="#9bb1ad" outlineWidth={0.02} outlineColor="#1d1a18" anchorX="center">{tier.toUpperCase()}</Text>
      {alerted && <Text frustumCulled={false} position={[0, track.id === "habitat" ? 4.65 : track.id === "extraction" ? 4.0 : 3.28, 0]} rotation={[-0.68, 0, 0]} fontSize={0.19} color="#ff6974" outlineWidth={0.03} outlineColor="#26171a" anchorX="center">EVENT</Text>}
    </group>
  );
}

function CommandCenter() {
  return (
    <group position={[0, 0.15, 0]} frustumCulled={false}>
      {/* Raised circular foundation, metallic rim and segmented anchor ring. */}
      <mesh castShadow receiveShadow position={[0, 0.15, 0]}>
        <cylinderGeometry args={[2.22, 2.36, 0.28, 24]} />
        <meshStandardMaterial color="#46545a" roughness={0.7} metalness={0.38} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <torusGeometry args={[2.12, 0.075, 10, 48]} />
        <meshStandardMaterial color="#ddbd69" metalness={0.68} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[1.85, 1.95, 0.18, 12]} />
        <meshStandardMaterial color="#71817f" roughness={0.44} metalness={0.58} />
      </mesh>
      {/* Four pressure-rated access corridors visibly connect to the central module. */}
      {[
        { position: [1.77, 0.42, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] },
        { position: [-1.77, 0.42, 0] as [number, number, number], rotation: [0, Math.PI, 0] as [number, number, number] },
        { position: [0, 0.42, 1.77] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
        { position: [0, 0.42, -1.77] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },
      ].map((arm, i) => (
        <group key={i} position={arm.position} rotation={arm.rotation}>
          <RoundedBox args={[1.18, 0.4, 0.58]} radius={0.12} smoothness={4} castShadow>
            <meshStandardMaterial color="#53656a" roughness={0.58} metalness={0.36} />
          </RoundedBox>
          <mesh position={[0, 0.07, 0.3]}>
            <boxGeometry args={[0.78, 0.17, 0.035]} />
            <meshStandardMaterial color="#1c3038" roughness={0.35} metalness={0.28} />
          </mesh>
          {[-0.22, 0.22].map((x) => <mesh key={x} position={[x, 0, 0.32]}><boxGeometry args={[0.045, 0.26, 0.045]} /><meshStandardMaterial color="#bdc8c0" metalness={0.7} /></mesh>)}
          <mesh position={[0, -0.18, -0.27]}><boxGeometry args={[0.84, 0.07, 0.065]} /><meshStandardMaterial color="#d8ba67" metalness={0.6} /></mesh>
        </group>
      ))}
      {/* Octagonal command pressure hull with service panels and a glazed dome. */}
      <mesh castShadow position={[0, 0.66, 0]}>
        <cylinderGeometry args={[1.63, 1.79, 0.68, 12]} />
        <meshStandardMaterial color="#526168" roughness={0.52} metalness={0.36} />
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <torusGeometry args={[1.59, 0.075, 10, 44]} />
        <meshStandardMaterial color="#e7c66f" metalness={0.68} roughness={0.23} />
      </mesh>
      <mesh castShadow position={[0, 1.0, 0]}>
        <sphereGeometry args={[1.56, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.53]} />
        <meshPhysicalMaterial color="#68cbd0" emissive="#164e59" emissiveIntensity={0.2} transparent opacity={0.83} roughness={0.18} metalness={0.12} clearcoat={0.7} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <torusGeometry args={[1.5, 0.05, 8, 42]} />
        <meshStandardMaterial color="#e6c66a" metalness={0.65} roughness={0.23} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 1.48, 1.24, Math.sin(a) * 1.48]} rotation={[0, -a, 0]}>
            <mesh castShadow><boxGeometry args={[0.035, 0.58, 0.045]} /><meshStandardMaterial color="#d4ddd4" metalness={0.75} roughness={0.25} /></mesh>
            <mesh position={[0, -0.32, 0]}><boxGeometry args={[0.08, 0.07, 0.09]} /><meshStandardMaterial color="#33454b" metalness={0.5} /></mesh>
          </group>
        );
      })}
      {/* A clear forward-facing airlock, light strip, and mechanical access rails. */}
      <group position={[0, 0.38, 2.05]}>
        <RoundedBox args={[0.94, 0.66, 0.62]} radius={0.1} smoothness={4} castShadow>
          <meshStandardMaterial color="#5c6b70" roughness={0.54} metalness={0.42} />
        </RoundedBox>
        <RoundedBox args={[0.55, 0.45, 0.06]} radius={0.045} smoothness={3} position={[0, 0, 0.34]}>
          <meshStandardMaterial color="#1d3038" roughness={0.36} metalness={0.4} />
        </RoundedBox>
        <mesh position={[0, 0.16, 0.38]}><boxGeometry args={[0.35, 0.035, 0.02]} /><meshStandardMaterial color="#f4d37c" emissive="#b98232" emissiveIntensity={0.65} /></mesh>
        {[-0.24, 0.24].map((x) => <mesh key={x} position={[x, -0.05, 0.38]}><cylinderGeometry args={[0.03, 0.03, 0.08, 10]} /><meshStandardMaterial color="#c6d0ca" metalness={0.8} /></mesh>)}
      </group>
      {/* Communications mast, sensor crossbar and instrument beacons. */}
      <mesh position={[0, 2.15, 0]}><cylinderGeometry args={[0.06, 0.1, 1.55, 10]} /><meshStandardMaterial color="#d1dad3" metalness={0.76} roughness={0.24} /></mesh>
      <mesh position={[0, 2.58, 0]}><boxGeometry args={[0.72, 0.09, 0.14]} /><meshStandardMaterial color="#465b60" metalness={0.54} /></mesh>
      {[-0.28, 0.28].map((x) => <mesh key={x} position={[x, 2.58, 0.08]}><sphereGeometry args={[0.08, 12, 8]} /><meshStandardMaterial color="#62e5f0" emissive="#2297a2" emissiveIntensity={0.7} /></mesh>)}
      <mesh position={[0.55, 1.42, 0.55]}><boxGeometry args={[0.3, 0.2, 0.1]} /><meshStandardMaterial color="#1b2c34" metalness={0.4} /></mesh>
      <mesh position={[0.55, 1.44, 0.61]}><boxGeometry args={[0.2, 0.11, 0.02]} /><meshStandardMaterial color="#68dfe6" emissive="#168a93" emissiveIntensity={0.7} /></mesh>
      <Beacon color="#55e7ef" active={false} height={2.82} />
      <Text frustumCulled={false} position={[0, 3.24, 0]} rotation={[-0.68, 0, 0]} fontSize={0.22} color="#fff0a8" outlineWidth={0.03} outlineColor="#241f18" anchorX="center">COMMAND HUB</Text>
    </group>
  );
}

function LandingPad({ mars }: { mars:boolean }) {
  return <group position={[0,0.22,-20.0]}>
    <mesh receiveShadow><cylinderGeometry args={[4.0,4.3,0.14,24]}/><meshStandardMaterial color={mars?"#875747":"#777976"} roughness={0.94}/></mesh>
    <mesh position={[0,0.08,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[3.1,3.18,32]}/><meshBasicMaterial color={mars?"#d8a183":"#d3cfbd"}/></mesh>
    <Text position={[0,0.22,0]} rotation={[-0.68,0,0]} fontSize={0.28} color={mars?"#f0c1a0":"#e3decb"} outlineWidth={0.035} outlineColor="#28221d" anchorX="center">LANDING PAD</Text>
  </group>;
}

function MissionGuide({ mars }: { mars: boolean }) {
  return (
    <Html fullscreen zIndexRange={[10, 20]} style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        left: 16,
        bottom: 16,
        width: 285,
        padding: "11px 13px",
        border: "1px solid rgba(213,168,74,.58)",
        borderRadius: 12,
        background: "rgba(8,15,19,.86)",
        boxShadow: "0 12px 30px rgba(0,0,0,.32)",
        color: "#e7eeea",
        fontFamily: "system-ui, sans-serif",
        backdropFilter: "blur(8px)",
      }}>
        <div style={{fontSize:9,fontWeight:900,letterSpacing:".18em",textTransform:"uppercase",color:"#efc85f"}}>MISSION CONTROL · {mars ? "MARS" : "MOON"}</div>
        <div style={{marginTop:5,fontSize:10,lineHeight:1.45,color:"#9fb0ad"}}>
          <b style={{color:"#e8eee9"}}>1.</b> Keep the colony stable and complete the objectives.
          <br/><b style={{color:"#e8eee9"}}>2.</b> During a disaster, click the red-ringed facility. Read the situation report, then choose a response in its building panel.
          <br/><b style={{color:"#e8eee9"}}>3.</b> Click the rover or field marker to survey resources, upgrade facilities when reserves allow, and improve your score.
        </div>
        <div style={{display:"flex",gap:9,marginTop:8,fontSize:8,fontWeight:800,letterSpacing:".08em",textTransform:"uppercase",color:"#7f9692"}}>
          <span><i style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#73dda0",marginRight:4}}/>Stable</span>
          <span><i style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#f0c45b",marginRight:4}}/>Degraded</span>
          <span><i style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#ff6558",marginRight:4}}/>Critical</span>
        </div>
      </div>
    </Html>
  );
}

function Scene({ props }: { props: Props }) {
  const mars = props.environmentLabel === "MARS";
  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 1.35]}
      camera={{ position: [48, 56, 48], zoom: 25, near: 0.5, far: 190 }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, depth: true }}
    >
      <color attach="background" args={[mars ? "#7b4638" : "#55545a"]} />
      <ambientLight intensity={0.68} color={mars ? "#ffe6db" : "#edf3ff"} />
      <hemisphereLight args={[mars ? "#ffe5da" : "#f7f9ff", mars ? "#3d2722" : "#2f3035", 1.0]} />
      <directionalLight position={[18, 34, 20]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-near={1} shadow-camera-far={120} shadow-camera-left={-52} shadow-camera-right={52} shadow-camera-top={52} shadow-camera-bottom={-52} />
      <Terrain kind={mars ? "mars" : "moon"} />
      <Rocks kind={mars ? "mars" : "moon"} />
      <Foundation mars={mars} />
      <group frustumCulled={false}>
        <MissionGuide mars={mars} />
        <RoadNetwork mars={mars} />
        <LandingPad mars={mars} />
        <CommandCenter />
        {props.tracks.map((track) => track.id !== "rover" && (
          <ColonyBuilding
            key={track.id}
            track={track}
            tier={props.selected[track.id] ?? "Foundation"}
            runtime={props.buildings[track.id] ?? { condition: 100, dust: 0, status: "ONLINE" }}
            selected={props.selectedBuildingId === track.id}
            alerted={props.activeEventTrackId === track.id}
            position={POSITIONS[track.id] ?? [0, 0]}
            onClick={() => props.onSelect(track.id)}
            mars={mars}
          />
        ))}
        {props.tracks.some((track) => track.id === "rover") && (
          <>
            <Pad position={POSITIONS.rover} size={3.8} mars={mars} accent="#52e9f2" baseY={0.04} />
            <Rover task={props.roverTask} position={POSITIONS.rover} resourceNodes={props.resourceNodes} selected={props.selectedBuildingId === "rover"} alerted={props.activeEventTrackId === "rover"} onClick={() => props.onSelect("rover")} />
          </>
        )}
        <Crew mars={mars} />
        {props.resourceNodes.map((node) => <ResourceMarker key={node.id} node={node} surveyed={props.surveyedNodes.includes(node.id)} selected={props.selectedResourceId === node.id} onClick={() => props.onSelectResource(node)} />)}
        {props.activeEventTrackId && POSITIONS[props.activeEventTrackId] && (
          <Text frustumCulled={false} position={[POSITIONS[props.activeEventTrackId][0], 4.25, POSITIONS[props.activeEventTrackId][1]]} rotation={[-0.68, 0, 0]} fontSize={0.22} color="#ff6672" outlineWidth={0.035} outlineColor="#26171a" anchorX="center">RESPOND HERE</Text>
        )}
      </group>
      <OrbitControls
        enableRotate={false}
        enablePan
        enableZoom
        enableDamping
        dampingFactor={0.08}
        screenSpacePanning
        panSpeed={1.0}
        minZoom={14}
        maxZoom={42}
        zoomSpeed={0.85}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN }}
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}

export function Colony3DMap(props: Props) {
  return <Scene props={props}/>;
}
