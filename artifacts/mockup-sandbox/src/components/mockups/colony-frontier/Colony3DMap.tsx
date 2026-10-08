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
  rover: [0, -17.2],
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
    ...ROAD_X.map((x) => ({ a: [x, -ROAD_EDGE] as [number, number], b: [x, ROAD_EDGE] as [number, number], level: 0 })),
    ...ROAD_Z.map((z) => ({ a: [-ROAD_EDGE, z] as [number, number], b: [ROAD_EDGE, z] as [number, number], level: 1 })),
    { a: [-18.4, -18.4] as [number, number], b: [18.4, -18.4] as [number, number], level: 0.5 },
    { a: [18.4, -18.4] as [number, number], b: [18.4, 18.4] as [number, number], level: 0 },
    { a: [18.4, 18.4] as [number, number], b: [-18.4, 18.4] as [number, number], level: 0.5 },
    { a: [-18.4, 18.4] as [number, number], b: [-18.4, -18.4] as [number, number], level: 0 },
  ];

  const access = Object.entries(POSITIONS)
    .filter(([id]) => id !== "rover")
    .map(([id, [x, z]]) => {
      const roadX = ROAD_X.reduce((best, candidate) => Math.abs(candidate - x) < Math.abs(best - x) ? candidate : best, ROAD_X[0]);
      return {
        id,
        a: [x, z] as [number, number],
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

function Pad({ position, size, mars, accent }: { position: [number, number]; size: number; mars: boolean; accent: string }) {
  const [x, z] = position;
  return (
    <group position={[x, 0, z]}>
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

function Beacon({ color, active }: { color: string; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.y = t * 0.8;
    ref.current.scale.setScalar(active ? 1 + (Math.sin(t * 5) + 1) * 0.08 : 0.9 + (Math.sin(t * 2) + 1) * 0.025);
  });
  return (
    <mesh ref={ref} position={[0, 2.1, 0]}>
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
        <mesh castShadow position={[0, 0.58, 0]}>
          <cylinderGeometry args={[2.45, 2.7, 0.82, 20]} />
          <meshStandardMaterial color="#49565b" roughness={0.66} metalness={0.25} />
        </mesh>
        <mesh castShadow position={[0, 1.35, 0]}>
          <sphereGeometry args={[2.18, 36, 22, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          <meshStandardMaterial color="#63cbd1" emissive="#154e58" emissiveIntensity={0.18} transparent opacity={0.94} roughness={0.24} />
        </mesh>
        <mesh position={[0, 1.38, 0]}>
          <torusGeometry args={[1.76, 0.08, 8, 36]} />
          <meshStandardMaterial color="#f1c75f" metalness={0.6} roughness={0.22} />
        </mesh>
        {[-1.35, -0.68, 0, 0.68, 1.35].map((x) => (
          <mesh key={x} position={[x, 1.36, 2.05]} rotation={[0, 0, x * 0.07]}>
            <boxGeometry args={[0.075, 1.05, 0.05]} />
            <meshStandardMaterial color="#dce4df" metalness={0.62} roughness={0.22} />
          </mesh>
        ))}
        <mesh position={[0, 2.75, 0]}>
          <cylinderGeometry args={[0.1, 0.15, 1.0, 10]} />
          <meshStandardMaterial color="#dbe3df" metalness={0.7} roughness={0.2} />
        </mesh>
        <Beacon color={accent} active={false} />
      </group>
    );
  }

  if (id === "solar") {
    return (
      <group>
        <RoundedBox args={[2.7, 0.34, 1.9]} radius={0.12} smoothness={3} castShadow>
          <meshStandardMaterial color={p.body} roughness={0.58} metalness={0.22} />
        </RoundedBox>
        {[-0.76, 0.76].map((x) => (
          <group key={x} position={[x, 0.82, 0]}>
            <mesh rotation={[0.18, 0, 0]} castShadow>
              <boxGeometry args={[0.9, 0.055, 1.48]} />
              <meshStandardMaterial color="#193e61" roughness={0.25} metalness={0.48} />
            </mesh>
            {[-0.3, 0, 0.3].map((z) => <mesh key={z} position={[0, 0.035, z]} rotation={[0.18, 0, 0]}><boxGeometry args={[0.82, 0.015, 0.025]} /><meshStandardMaterial color="#79b9ca" /></mesh>)}
          </group>
        ))}
        <Beacon color={accent} active={false} />
      </group>
    );
  }

  if (id === "battery") {
    return (
      <group>
        <RoundedBox args={[2.7, 0.42, 2.0]} radius={0.14} smoothness={4} castShadow>
          <meshStandardMaterial color={p.body} roughness={0.55} metalness={0.22} />
        </RoundedBox>
        {[-0.8, 0, 0.8].map((x) => (
          <group key={x} position={[x, 0.76, 0]}>
            <RoundedBox args={[0.52, 1.1, 1.0]} radius={0.12} smoothness={4} castShadow>
              <meshStandardMaterial color="#4a5b62" metalness={0.28} roughness={0.35} />
            </RoundedBox>
            <mesh position={[0, 0.58, 0.52]}><boxGeometry args={[0.28, 0.08, 0.04]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} /></mesh>
          </group>
        ))}
      </group>
    );
  }

  if (id === "oxygen" || id === "water") {
    return (
      <group>
        <RoundedBox args={[2.6, 0.38, 1.9]} radius={0.12} smoothness={3} castShadow>
          <meshStandardMaterial color={p.body} roughness={0.62} metalness={0.18} />
        </RoundedBox>
        {[-0.72, 0.72].map((x) => (
          <group key={x} position={[x, 0.72, 0]}>
            <mesh castShadow><cylinderGeometry args={[0.48, 0.54, 1.18, 16]} /><meshStandardMaterial color="#aeb9b5" roughness={0.35} metalness={0.38} /></mesh>
            <mesh position={[0, 0.64, 0]}><sphereGeometry args={[0.48, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} /><meshStandardMaterial color={id === "water" ? "#57c9e7" : "#9bd7c9"} transparent opacity={0.7} /></mesh>
            <mesh position={[0, 1.28, 0]}><torusGeometry args={[0.36, 0.045, 7, 22]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} /></mesh>
          </group>
        ))}
      </group>
    );
  }

  if (id === "comms" || id === "navigation") {
    return (
      <group>
        <RoundedBox args={[2.3, 0.34, 1.8]} radius={0.12} smoothness={3} castShadow><meshStandardMaterial color={p.body} roughness={0.6} metalness={0.2} /></RoundedBox>
        <mesh position={[0, 1.12, 0]}><cylinderGeometry args={[0.1, 0.15, 1.9, 10]} /><meshStandardMaterial color="#d7dfdb" metalness={0.7} roughness={0.2} /></mesh>
        <mesh position={[0, 1.9, 0]} rotation={[Math.PI / 2.2, 0, 0]}><sphereGeometry args={[0.72, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.48]} /><meshStandardMaterial color="#dbe2df" roughness={0.24} metalness={0.4} side={THREE.DoubleSide} /></mesh>
        <Beacon color={accent} active={false} />
      </group>
    );
  }

  if (id === "radiation" || id === "science") {
    return (
      <group>
        <RoundedBox args={[2.7, 0.4, 2.05]} radius={0.16} smoothness={4} castShadow><meshStandardMaterial color={p.body} roughness={0.62} metalness={0.2} /></RoundedBox>
        <mesh position={[0, 1.02, 0]}><sphereGeometry args={[1.28, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} /><meshStandardMaterial color={id === "science" ? "#74629d" : "#76699f"} transparent opacity={0.76} roughness={0.3} /></mesh>
        <mesh position={[0, 1.05, 0]}><torusGeometry args={[1.03, 0.06, 8, 28]} /><meshStandardMaterial color={accent} metalness={0.45} roughness={0.25} /></mesh>
        <Beacon color={accent} active={false} />
      </group>
    );
  }

  if (id === "extraction" || id === "isru") {
    return (
      <group>
        <RoundedBox args={[2.8, 0.44, 2.1]} radius={0.12} smoothness={3} castShadow><meshStandardMaterial color={p.body} roughness={0.65} metalness={0.18} /></RoundedBox>
        {[-0.72, 0.72].map((x) => <mesh key={x} position={[x, 0.92, 0]} castShadow><cylinderGeometry args={[0.38, 0.47, 1.35, 14]} /><meshStandardMaterial color="#64716f" metalness={0.4} roughness={0.4} /></mesh>)}
        <mesh position={[0, 1.68, 0]} rotation={[0, 0, 0.25]}><cylinderGeometry args={[0.11, 0.16, 1.5, 8]} /><meshStandardMaterial color="#d8dfda" metalness={0.72} roughness={0.2} /></mesh>
        <mesh position={[0, 2.42, 0]}><octahedronGeometry args={[0.2, 0]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.85} /></mesh>
      </group>
    );
  }

  if (id === "agriculture") {
    return (
      <group>
        <RoundedBox args={[2.9, 0.34, 2.05]} radius={0.14} smoothness={4} castShadow><meshStandardMaterial color={p.body} roughness={0.7} /></RoundedBox>
        <RoundedBox args={[2.55, 1.18, 1.62]} radius={0.28} smoothness={5} position={[0, 0.96, 0]} castShadow><meshStandardMaterial color="#5ebd76" transparent opacity={0.4} roughness={0.2} /></RoundedBox>
        {[-0.8,-0.27,0.27,0.8].map((x)=><mesh key={x} position={[x,0.82,0]}><sphereGeometry args={[0.13,10,8]} /><meshStandardMaterial color="#79ef89" emissive="#2ac95b" emissiveIntensity={0.45} /></mesh>)}
      </group>
    );
  }

  return (
    <group>
      <RoundedBox args={[2.65, 0.44, 1.95]} radius={0.13} smoothness={4} castShadow>
        <meshStandardMaterial color={p.body} roughness={0.65} metalness={0.18} />
      </RoundedBox>
      <mesh position={[0, 0.86, 0]} castShadow>
        <boxGeometry args={[1.75, 1.0, 1.25]} />
        <meshStandardMaterial color={p.body} roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.48, 0]}><boxGeometry args={[1.4,0.08,0.9]} /><meshStandardMaterial color={p.accent} emissive={p.accent} emissiveIntensity={0.28} /></mesh>
      <Beacon color={accent} active={false} />
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
    ref.current.position.set(x, terrainHeight(x, z) + 0.39, z);
    ref.current.position.y += Math.sin(clock.getElapsedTime() * 2) * 0.008;
  });
  const wheelZ = [-0.55, 0, 0.55];
  return (
    <group ref={ref} position={[position[0], PAD_Y + 0.39, position[1]]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
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
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const pulse = alerted ? 1 + (Math.sin(t * 5.2) + 1) * 0.045 : selected ? 1.025 : 1;
    ref.current.scale.set(pulse, pulse, pulse);
  });
  if (!selected && !alerted) return null;
  const color = alerted ? "#ff344f" : "#ffe36d";
  return (
    <>
      {alerted && (
        <mesh position={[0, height - 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[radius + 0.16, 64]} />
          <meshBasicMaterial color="#ff263f" transparent opacity={0.15} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <mesh ref={ref} position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius, radius + (alerted ? 0.17 : 0.12), 64]} />
        <meshBasicMaterial color={color} transparent opacity={alerted ? 1 : 0.92} depthWrite={false} toneMapped={false} />
      </mesh>
      {alerted && (
        <mesh position={[0, height + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius + 0.24, radius + 0.30, 64]} />
          <meshBasicMaterial color="#ff6574" transparent opacity={0.82} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </>
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
    ref.current.position.set(x,PAD_Y+0.32,z);
    ref.current.rotation.y=Math.atan2(bx-ax,bz-az);
  });
  const suit=["#67c9d9","#e4bb61","#d47c69","#83b97d","#9d8bd1"][index%5];
  return <group ref={ref} scale={0.45}>
    <mesh castShadow position={[0,0.43,0]}><capsuleGeometry args={[0.13,0.28,4,8]}/><meshStandardMaterial color={suit}/></mesh>
    <mesh castShadow position={[0,0.75,0]}><sphereGeometry args={[0.12,14,10]}/><meshStandardMaterial color={mars?"#b9c0bd":"#d2b65f"} metalness={0.15}/></mesh>
    <mesh position={[0,0.75,0.102]}><boxGeometry args={[0.13,0.055,0.018]}/><meshStandardMaterial color="#61e9f2" emissive="#218e99" emissiveIntensity={0.3}/></mesh>
  </group>;
}

function ColonyBuilding({
  track,tier,runtime,selected,alerted,position,onClick,mars
}:{track:TechnologyTrack;tier:Tier;runtime:BuildingRuntime;selected:boolean;alerted:boolean;position:[number,number];onClick:()=>void;mars:boolean}) {
  const [x,z]=position;
  const p=palette(track.id);
  const y=PAD_Y+0.07;
  const artBaseOffset = track.id === "habitat" ? -0.13
    : track.id === "battery" ? 0.25
    : track.id === "oxygen" || track.id === "water" ? 0.23
    : track.id === "radiation" || track.id === "science" ? 0.24
    : track.id === "extraction" || track.id === "isru" || track.id === "thermal" || track.id === "grid" || track.id === "maintenance" || track.id === "co2" ? 0.26
    : 0.21;
  return <group position={[x,y,z]} rotation={[0,BUILDING_ROTATIONS[track.id]??0,0]} onClick={(e)=>{e.stopPropagation();onClick();}} onPointerOver={()=>{document.body.style.cursor="pointer"}} onPointerOut={()=>{document.body.style.cursor=""}}>
    <Pad position={[0,0]} size={track.id==="habitat"?9.4:3.65} mars={mars} accent={p.accent}/>
    <group position={[0,artBaseOffset,0]} scale={track.id==="habitat"?1.12:1}>
      <BuildingArt id={track.id} accent={tierColor(tier)}/>
    </group>
    {track.id!=="habitat" && <mesh position={[0,0.07,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.42,1.54,32]}/><meshBasicMaterial color={statusColor(runtime.condition)} transparent opacity={0.82} depthWrite={false}/></mesh>}
    {(runtime.upgradeLevel ?? 0) > 0 && <mesh position={[0,0.075,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.62,1.69,32]}/><meshBasicMaterial color="#efc85f" transparent opacity={0.82} depthWrite={false}/></mesh>}
    <SelectionRing selected={selected} alerted={alerted} radius={track.id==="habitat"?5.1:2.05} height={0.065}/>
    <Text position={[0,track.id==="habitat"?4.0:2.75,0]} rotation={[-0.68,0,0]} fontSize={track.id==="habitat"?0.28:0.2} color={selected?"#fff0a2":"#d6e3df"} outlineWidth={0.035} outlineColor="#1d1a18" anchorX="center">{track.category.toUpperCase()}</Text>
    <Text position={[0,track.id==="habitat"?3.63:2.46,0]} rotation={[-0.68,0,0]} fontSize={0.12} color="#9bb1ad" outlineWidth={0.02} outlineColor="#1d1a18" anchorX="center">{tier.toUpperCase()}</Text>
    {alerted && <Text position={[0,track.id==="habitat"?4.65:3.28,0]} rotation={[-0.68,0,0]} fontSize={0.19} color="#ff6974" outlineWidth={0.03} outlineColor="#26171a" anchorX="center">EVENT</Text>}
  </group>;
}

function CommandCenter() {
  return <group position={[0,PAD_Y,0]}>
    <mesh castShadow><cylinderGeometry args={[2.0,2.25,0.78,16]}/><meshStandardMaterial color="#4e5c60" roughness={0.66} metalness={0.22}/></mesh>
    <mesh castShadow position={[0,0.6,0]}><cylinderGeometry args={[1.72,1.86,0.22,16]}/><meshStandardMaterial color="#929d99" roughness={0.4} metalness={0.36}/></mesh>
    <mesh castShadow position={[0,1.25,0]}><sphereGeometry args={[1.55,30,18,0,Math.PI*2,0,Math.PI*0.5]}/><meshStandardMaterial color="#69ccd2" transparent opacity={0.9} emissive="#1b626b" emissiveIntensity={0.18}/></mesh>
    <mesh position={[0,1.3,0]}><torusGeometry args={[1.2,0.07,8,30]}/><meshStandardMaterial color="#f0c85e" metalness={0.55} roughness={0.22}/></mesh>
    <mesh position={[0,2.3,0]}><cylinderGeometry args={[0.09,0.14,1.3,10]}/><meshStandardMaterial color="#dbe2de" metalness={0.7}/></mesh>
    <Beacon color="#55e7ef" active={false}/>
    <Text position={[0,3.1,0]} rotation={[-0.68,0,0]} fontSize={0.22} color="#fff0a8" outlineWidth={0.03} outlineColor="#241f18" anchorX="center">COMMAND</Text>
  </group>;
}

function LandingPad({ mars }: { mars:boolean }) {
  return <group position={[0,PAD_Y,-20.0]}>
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
        <div style={{fontSize:9,fontWeight:900,letterSpacing:".18em",textTransform:"uppercase",color:"#efc85f"}}>MISSION CONTROL · ${mars ? "MARS" : "MOON"}</div>
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
  const mars=props.environmentLabel==="MARS";
  return <Canvas orthographic shadows dpr={[1,1.35]} camera={{position:[48,56,48],zoom:25,near:0.1,far:260}} gl={{antialias:true,powerPreference:"high-performance",toneMapping:THREE.ACESFilmicToneMapping}}>
    <color attach="background" args={[mars?"#7b4638":"#55545a"]}/>
    <ambientLight intensity={0.68} color={mars?"#ffe6db":"#edf3ff"}/>
    <hemisphereLight args={[mars?"#ffe5da":"#f7f9ff",mars?"#3d2722":"#2f3035",1.0]}/>
    <directionalLight position={[18,34,20]} intensity={1.7} castShadow shadow-mapSize={[2048,2048]} shadow-camera-near={1} shadow-camera-far={120} shadow-camera-left={-52} shadow-camera-right={52} shadow-camera-top={52} shadow-camera-bottom={-52}/>
    <Terrain kind={mars?"mars":"moon"}/>
    <Rocks kind={mars?"mars":"moon"}/>
    <Foundation mars={mars}/>
    <group>
      <MissionGuide mars={mars}/>
      <RoadNetwork mars={mars}/>
      <LandingPad mars={mars}/>
      <CommandCenter/>
      {props.tracks.map((track)=>track.id!=="rover"&&<ColonyBuilding key={track.id} track={track} tier={props.selected[track.id]??"Foundation"} runtime={props.buildings[track.id]??{condition:100,dust:0,status:"ONLINE"}} selected={props.selectedBuildingId===track.id} alerted={props.activeEventTrackId===track.id} position={POSITIONS[track.id]??[0,0]} onClick={()=>props.onSelect(track.id)} mars={mars}/>)}
      {props.tracks.some((track)=>track.id==="rover")&&<Rover task={props.roverTask} position={POSITIONS.rover} resourceNodes={props.resourceNodes} selected={props.selectedBuildingId==="rover"} alerted={props.activeEventTrackId==="rover"} onClick={()=>props.onSelect("rover")}/>}
      <Crew mars={mars}/>
      {props.resourceNodes.map((node)=><ResourceMarker key={node.id} node={node} surveyed={props.surveyedNodes.includes(node.id)} selected={props.selectedResourceId===node.id} onClick={()=>props.onSelectResource(node)}/>)}
      {props.activeEventTrackId&&POSITIONS[props.activeEventTrackId]&&<Text position={[POSITIONS[props.activeEventTrackId][0],4.1,POSITIONS[props.activeEventTrackId][1]]} rotation={[-0.68,0,0]} fontSize={0.22} color="#ff6672" outlineWidth={0.035} outlineColor="#26171a" anchorX="center">RESPOND HERE</Text>}
      <mesh position={[0,0.21,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[2.8,48]}/><meshStandardMaterial color={mars?"#71463b":"#3f4749"} roughness={0.98}/></mesh>
      <Text position={[0,0.26,0]} rotation={[-0.68,0,0]} fontSize={0.16} color="#8fa7a3" outlineWidth={0.02} outlineColor="#171a1b" anchorX="center">COLONY CORE</Text>
    </group>
    <OrbitControls enableRotate={false} enablePan enableZoom screenSpacePanning panSpeed={1.0} minZoom={14} maxZoom={42} zoomSpeed={0.85} mouseButtons={{LEFT:THREE.MOUSE.PAN}} touches={{ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_PAN}} target={[0,0,0]}/>
  </Canvas>;
}

export function Colony3DMap(props: Props) {
  return <Scene props={props}/>;
}
