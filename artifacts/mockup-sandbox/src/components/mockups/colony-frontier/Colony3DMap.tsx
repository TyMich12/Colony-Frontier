import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, Html, OrbitControls, RoundedBox, Text } from "@react-three/drei";
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
  roverTargetNodeId: string | null;
  simulationSpeed: number;
};

const POSITIONS: Record<string, [number, number]> = {
  // Wide deployment lanes: players pan across the colony instead of seeing every system as a tight cluster.
  habitat: [0, 0],
  water: [-22, 18],
  extraction: [-7, 18],
  isru: [7, 18],
  radiation: [22, 18],
  oxygen: [-22, 5],
  comms: [-11, 5],
  maintenance: [11, 5],
  co2: [-22, -7],
  grid: [-11, -7],
  science: [11, -7],
  battery: [22, -7],
  thermal: [-22, -18],
  solar: [-7, -18],
  agriculture: [7, -18],
  navigation: [22, -18],
  rover: [24, -22],
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

const ROAD_X = [-14, 0, 14];
const ROAD_Z = [-13, -0.6, 13];
const ROAD_EDGE = 25.6;
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
        <boxGeometry args={[58, 0.36, 58]} />
        <meshStandardMaterial color={ground} roughness={0.98} />
      </mesh>
      <mesh receiveShadow position={[0, 0.025, 0]}>
        <boxGeometry args={[54, 0.11, 54]} />
        <meshStandardMaterial color={mars ? "#8d5948" : "#74726e"} roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.105, 0]}>
        <boxGeometry args={[53, 0.035, 53]} />
        <meshStandardMaterial color={curb} roughness={0.9} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.132, 0]}>
        <boxGeometry args={[52, 0.028, 52]} />
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
    // The central lane skirts the habitat and is interrupted around the separate landing pad.
    { a: [0, -ROAD_EDGE] as [number, number], b: [0, -25.0] as [number, number], level: 0 },
    { a: [0, -15.0] as [number, number], b: [0, -5.0] as [number, number], level: 0 },
    { a: [0, 5.0] as [number, number], b: [0, ROAD_EDGE] as [number, number], level: 0 },
    ...ROAD_Z.filter((z) => z !== -0.6).map((z) => ({ a: [-ROAD_EDGE, z] as [number, number], b: [ROAD_EDGE, z] as [number, number], level: 1 })),
    { a: [-ROAD_EDGE, -0.6] as [number, number], b: [-5.0, -0.6] as [number, number], level: 1 },
    { a: [5.0, -0.6] as [number, number], b: [ROAD_EDGE, -0.6] as [number, number], level: 1 },
    { a: [-ROAD_EDGE, -ROAD_EDGE] as [number, number], b: [ROAD_EDGE, -ROAD_EDGE] as [number, number], level: 0.5 },
    { a: [ROAD_EDGE, -ROAD_EDGE] as [number, number], b: [ROAD_EDGE, ROAD_EDGE] as [number, number], level: 0 },
    { a: [ROAD_EDGE, ROAD_EDGE] as [number, number], b: [-ROAD_EDGE, ROAD_EDGE] as [number, number], level: 0.5 },
    { a: [-ROAD_EDGE, ROAD_EDGE] as [number, number], b: [-ROAD_EDGE, -ROAD_EDGE] as [number, number], level: 0 },
  ];

  const access = Object.entries(POSITIONS)
    .filter(([id]) => id !== "habitat")
    .map(([id, [x, z]]) => {
      const roadX = ROAD_X.reduce((best, candidate) => Math.abs(candidate - x) < Math.abs(best - x) ? candidate : best, ROAD_X[0]);
      const padHalfWidth = id === "habitat" ? 3.7 : id === "rover" ? 1.9 : 1.825;
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
        {/* Three linked pressure modules: a large surface habitat rather than another command dome. */}
        <RoundedBox args={[6.35, 0.24, 4.9]} radius={0.16} smoothness={4} position={[0, 0.2, 0]} castShadow>
          <meshStandardMaterial color="#343f43" metalness={0.5} roughness={0.54} />
        </RoundedBox>
        <mesh position={[0, 0.335, 0]}>
          <boxGeometry args={[5.96, 0.045, 4.5]} />
          <meshStandardMaterial color="#a1aaa2" metalness={0.68} roughness={0.34} />
        </mesh>

        {/* Main cylindrical pressure hull and reinforced end bulkheads. */}
        <mesh castShadow receiveShadow position={[0, 1.42, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.08, 1.08, 4.6, 32]} />
          <meshStandardMaterial color="#9aa6a4" metalness={0.48} roughness={0.35} />
        </mesh>
        {[-2.28, 2.28].map((x) => (
          <group key={x} position={[x, 1.42, 0]}>
            <mesh castShadow scale={[0.42, 1, 1]}>
              <sphereGeometry args={[1.07, 24, 18]} />
              <meshStandardMaterial color="#657579" metalness={0.42} roughness={0.42} />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[1.02, 0.07, 10, 36]} />
              <meshStandardMaterial color="#d6bd77" metalness={0.7} roughness={0.28} />
            </mesh>
          </group>
        ))}
        {[-1.68, -0.84, 0, 0.84, 1.68].map((x) => (
          <mesh key={x} position={[x, 1.42, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[1.08, 0.035, 8, 32]} />
            <meshStandardMaterial color="#c4ceca" metalness={0.76} roughness={0.28} />
          </mesh>
        ))}

        {/* Two side sleeping/laboratory modules with pressure-rated connecting tunnels. */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh castShadow receiveShadow position={[0.12, 1.0, side * 1.55]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.67, 0.67, 2.45, 24]} />
              <meshStandardMaterial color={side < 0 ? "#71858a" : "#60767c"} metalness={0.42} roughness={0.38} />
            </mesh>
            {[-0.98, 0.0, 0.98].map((x) => (
              <mesh key={x} position={[x, 1.0, side * 1.55]} rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[0.65, 0.035, 8, 28]} />
                <meshStandardMaterial color="#d2d8d2" metalness={0.72} roughness={0.3} />
              </mesh>
            ))}
            <RoundedBox args={[1.35, 0.38, 0.54]} radius={0.1} smoothness={3} position={[0.0, 0.56, side * 1.18]} castShadow>
              <meshStandardMaterial color="#52666b" metalness={0.44} roughness={0.48} />
            </RoundedBox>
            {[-0.62, 0.0, 0.62].map((x) => (
              <group key={x} position={[x, 1.04, side * 2.17]}>
                <RoundedBox args={[0.34, 0.26, 0.045]} radius={0.04} smoothness={3} castShadow>
                  <meshStandardMaterial color="#162e3a" metalness={0.28} roughness={0.25} />
                </RoundedBox>
                <mesh position={[0, 0, side * 0.03]}>
                  <boxGeometry args={[0.24, 0.16, 0.012]} />
                  <meshStandardMaterial color={side < 0 ? "#5bcbd8" : "#8ed7ba"} emissive={side < 0 ? "#1d6670" : "#2e7a61"} emissiveIntensity={0.48} />
                </mesh>
              </group>
            ))}
          </group>
        ))}

        {/* Main hull windows, mounted in thick frames instead of floating panes. */}
        {[-1.62, -0.54, 0.54, 1.62].map((x) => (
          <group key={x}>
            {[-1, 1].map((side) => (
              <group key={side} position={[x, 1.42, side * 1.06]}>
                <RoundedBox args={[0.5, 0.36, 0.075]} radius={0.07} smoothness={4}>
                  <meshStandardMaterial color="#d2c995" metalness={0.64} roughness={0.32} />
                </RoundedBox>
                <RoundedBox args={[0.41, 0.27, 0.085]} radius={0.05} smoothness={4} position={[0, 0, side * 0.04]}>
                  <meshPhysicalMaterial color="#65d2e2" emissive="#164c61" emissiveIntensity={0.2} roughness={0.18} metalness={0.18} clearcoat={0.8} />
                </RoundedBox>
              </group>
            ))}
          </group>
        ))}

        {/* Front airlock, hatch window, access steps, handrails and illuminated wayfinding. */}
        <group position={[0, 0.58, 2.48]}>
          <RoundedBox args={[1.25, 0.82, 0.88]} radius={0.14} smoothness={4} castShadow>
            <meshStandardMaterial color="#465b61" metalness={0.48} roughness={0.44} />
          </RoundedBox>
          <RoundedBox args={[0.62, 0.53, 0.08]} radius={0.055} smoothness={4} position={[0, 0.02, 0.49]}>
            <meshStandardMaterial color="#1a303a" metalness={0.34} roughness={0.28} />
          </RoundedBox>
          <RoundedBox args={[0.43, 0.35, 0.04]} radius={0.04} smoothness={3} position={[0, 0.03, 0.545]}>
            <meshStandardMaterial color="#324b52" metalness={0.3} roughness={0.32} />
          </RoundedBox>
          <mesh position={[0, 0.27, 0.58]}>
            <boxGeometry args={[0.34, 0.04, 0.02]} />
            <meshStandardMaterial color="#f7d47c" emissive="#ba842f" emissiveIntensity={0.9} />
          </mesh>
          {[-0.53, 0.53].map((x) => (
            <mesh key={x} position={[x, 0.0, 0.44]}>
              <cylinderGeometry args={[0.035, 0.035, 0.7, 10]} />
              <meshStandardMaterial color="#cbd2cb" metalness={0.76} roughness={0.28} />
            </mesh>
          ))}
          <mesh position={[0, -0.34, 0.75]} castShadow>
            <boxGeometry args={[0.98, 0.12, 0.74]} />
            <meshStandardMaterial color="#7d8985" metalness={0.38} roughness={0.54} />
          </mesh>
          <mesh position={[0, -0.41, 1.04]}>
            <boxGeometry args={[0.82, 0.025, 0.035]} />
            <meshStandardMaterial color="#f2ce72" emissive="#8e6e2d" emissiveIntensity={0.65} />
          </mesh>
        </group>

        {/* Exterior life-support skids, tanks and insulated thermal lines. */}
        {[-1.72, 1.72].map((x) => (
          <group key={x} position={[x, 0.76, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.21, 0.21, 0.7, 14]} />
              <meshStandardMaterial color="#d5d8d0" metalness={0.68} roughness={0.34} />
            </mesh>
            <mesh position={[0, 0.36, 0]}>
              <torusGeometry args={[0.2, 0.035, 8, 20]} />
              <meshStandardMaterial color="#d7b76c" metalness={0.65} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.22, 0.025, 8, 20]} />
              <meshStandardMaterial color="#789196" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        ))}
        {[-1, 1].map((side) => (
          <group key={side} position={[0, 0.82, side * 1.02]}>
            <mesh position={[0, -0.1, 0]}>
              <cylinderGeometry args={[0.045, 0.045, 1.1, 10]} />
              <meshStandardMaterial color="#dfc27a" metalness={0.56} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.4, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.46, 8]} />
              <meshStandardMaterial color="#d1d7d0" metalness={0.76} roughness={0.25} />
            </mesh>
          </group>
        ))}

        {/* Redundant comms mast and sensor crossbar: a functional habitat roofline, not a central dome. */}
        <mesh position={[0, 3.2, -0.24]}>
          <cylinderGeometry args={[0.045, 0.075, 1.65, 10]} />
          <meshStandardMaterial color="#e0e0d2" metalness={0.76} roughness={0.26} />
        </mesh>
        <mesh position={[0, 3.72, -0.24]}>
          <boxGeometry args={[0.72, 0.09, 0.14]} />
          <meshStandardMaterial color="#52676c" metalness={0.6} roughness={0.3} />
        </mesh>
        {[-0.28, 0.28].map((x) => (
          <mesh key={x} position={[x, 3.72, -0.16]}>
            <sphereGeometry args={[0.075, 12, 8]} />
            <meshStandardMaterial color="#63e6ee" emissive="#2598a1" emissiveIntensity={0.85} />
          </mesh>
        ))}
        <mesh position={[0, 1.6, 1.1]}>
          <boxGeometry args={[0.55, 0.34, 0.11]} />
          <meshStandardMaterial color="#1a2c34" metalness={0.44} roughness={0.33} />
        </mesh>
        <mesh position={[0, 1.62, 1.17]}>
          <boxGeometry args={[0.37, 0.21, 0.025]} />
          <meshStandardMaterial color="#4ed3df" emissive="#176b75" emissiveIntensity={0.85} />
        </mesh>
        <mesh position={[-2.1, 0.41, -1.55]}>
          <boxGeometry args={[0.5, 0.11, 0.45]} />
          <meshStandardMaterial color="#37484b" metalness={0.48} roughness={0.42} />
        </mesh>
        <mesh position={[2.1, 0.41, -1.55]}>
          <boxGeometry args={[0.5, 0.11, 0.45]} />
          <meshStandardMaterial color="#37484b" metalness={0.48} roughness={0.42} />
        </mesh>
        <Beacon color={accent} active={false} height={4.05} />
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
        {id === "water" && (
          <group>
            {/* Blue recovery loop, membrane canister, shut-off valves and insulated return plumbing. */}
            <mesh position={[0, 0.39, 0.59]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.045, 0.045, 1.42, 10]} />
              <meshStandardMaterial color="#4cc9ee" emissive="#125779" emissiveIntensity={0.28} metalness={0.28} roughness={0.4} />
            </mesh>
            {[-0.62, 0.62].map((x) => (
              <group key={x}>
                <mesh position={[x, 0.56, 0.57]}>
                  <cylinderGeometry args={[0.045, 0.045, 0.32, 10]} />
                  <meshStandardMaterial color="#55d6f2" metalness={0.38} roughness={0.34} />
                </mesh>
                <mesh position={[x, 0.71, 0.57]}>
                  <torusGeometry args={[0.09, 0.022, 6, 16]} />
                  <meshStandardMaterial color="#e1c879" metalness={0.65} roughness={0.28} />
                </mesh>
              </group>
            ))}
            <group position={[0, 0.66, 0.7]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.17, 0.19, 0.55, 16]} />
                <meshStandardMaterial color="#5d8c9a" metalness={0.55} roughness={0.36} />
              </mesh>
              {[-0.17, 0.17].map((y) => (
                <mesh key={y} position={[0, y, 0]}>
                  <torusGeometry args={[0.18, 0.026, 7, 20]} />
                  <meshStandardMaterial color="#c4d1cf" metalness={0.72} roughness={0.26} />
                </mesh>
              ))}
              <mesh position={[0, 0.02, 0.176]}>
                <boxGeometry args={[0.1, 0.24, 0.025]} />
                <meshStandardMaterial color="#53dafa" emissive="#1491b4" emissiveIntensity={0.9} />
              </mesh>
            </group>
            {[-0.34, 0.34].map((x) => (
              <mesh key={x} position={[x, 0.96, 0.55]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.026, 0.026, 0.58, 8]} />
                <meshStandardMaterial color="#c2ceca" metalness={0.72} roughness={0.3} />
              </mesh>
            ))}
          </group>
        )}
        {id === "oxygen" && (
          <group>
            {/* Pressure regulators and a redundant high-pressure feed manifold. */}
            <mesh position={[0, 1.42, -0.58]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.055, 0.055, 1.55, 10]} />
              <meshStandardMaterial color="#d5dfd8" metalness={0.72} roughness={0.28} />
            </mesh>
            {[-0.78, 0.78].map((x) => (
              <group key={x} position={[x, 1.43, -0.58]}>
                <mesh>
                  <cylinderGeometry args={[0.12, 0.12, 0.23, 12]} />
                  <meshStandardMaterial color="#5ed9c2" metalness={0.4} roughness={0.3} />
                </mesh>
                <mesh position={[0, 0.15, 0]}>
                  <sphereGeometry args={[0.065, 10, 8]} />
                  <meshStandardMaterial color="#f2c96b" emissive="#7e5527" emissiveIntensity={0.5} />
                </mesh>
                <mesh position={[0.16, 0, 0.03]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.025, 0.025, 0.2, 8]} />
                  <meshStandardMaterial color="#d0d8d2" metalness={0.68} roughness={0.32} />
                </mesh>
              </group>
            ))}
            {[-0.52, 0.52].map((x) => (
              <mesh key={x} position={[x, 1.62, 0.22]}>
                <boxGeometry args={[0.16, 0.1, 0.08]} />
                <meshStandardMaterial color="#273b40" metalness={0.42} />
              </mesh>
            ))}
          </group>
        )}
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

  if (id === "navigation") {
    return (
      <group>
        {/* Autonomous navigation / survey package: compact star tracker, inertial core and sensor gantry. */}
        <RoundedBox args={[2.55, 0.34, 1.92]} radius={0.12} smoothness={4} position={[0, 0.18, 0]} castShadow>
          <meshStandardMaterial color={p.body} roughness={0.54} metalness={0.38} />
        </RoundedBox>
        <mesh position={[0, 0.39, 0]}>
          <boxGeometry args={[2.32, 0.08, 1.65]} />
          <meshStandardMaterial color="#a8b6ae" metalness={0.72} roughness={0.32} />
        </mesh>
        {/* Triangulated stabiliser legs and isolation mounts. */}
        {[
          [-0.85, -0.62, -0.26],
          [0.85, -0.62, 0.26],
          [-0.85, 0.62, 0.26],
          [0.85, 0.62, -0.26],
        ].map(([x, z, angle], i) => (
          <group key={i} position={[x, 0.46, z]} rotation={[0, 0, angle]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.045, 0.07, 0.54, 8]} />
              <meshStandardMaterial color="#d0d8d0" metalness={0.76} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.24, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.08, 8]} />
              <meshStandardMaterial color="#374a50" metalness={0.48} roughness={0.44} />
            </mesh>
          </group>
        ))}
        {/* Inertial measurement unit with layered gimbal rings. */}
        <RoundedBox args={[0.92, 0.45, 0.85]} radius={0.1} smoothness={4} position={[0, 0.69, 0]} castShadow>
          <meshStandardMaterial color="#3f565f" metalness={0.48} roughness={0.36} />
        </RoundedBox>
        <mesh position={[0, 0.96, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.36, 0.035, 8, 28]} />
          <meshStandardMaterial color="#ddc87a" metalness={0.72} roughness={0.25} />
        </mesh>
        <mesh position={[0, 1.03, 0]} rotation={[0.26, 0.34, 0]}>
          <torusGeometry args={[0.28, 0.027, 8, 24]} />
          <meshStandardMaterial color="#829f9f" metalness={0.74} roughness={0.26} />
        </mesh>
        {/* Three independent optical sensor heads, each with a glass objective and sun hood. */}
        {[
          { x: -0.75, y: 1.18, z: 0.27, color: "#70e3ee" },
          { x: 0.0, y: 1.44, z: 0.18, color: "#c1a1ff" },
          { x: 0.75, y: 1.18, z: 0.27, color: "#65d8be" },
        ].map((sensor, i) => (
          <group key={i} position={[sensor.x, sensor.y, sensor.z]}>
            <RoundedBox args={[0.42, 0.34, 0.38]} radius={0.06} smoothness={3} castShadow>
              <meshStandardMaterial color="#54676b" metalness={0.46} roughness={0.36} />
            </RoundedBox>
            <mesh position={[0, 0, 0.2]}>
              <cylinderGeometry args={[0.12, 0.15, 0.14, 16]} />
              <meshStandardMaterial color="#263a42" metalness={0.52} roughness={0.26} />
            </mesh>
            <mesh position={[0, 0, 0.28]}>
              <circleGeometry args={[0.09, 16]} />
              <meshPhysicalMaterial color={sensor.color} emissive={sensor.color} emissiveIntensity={0.35} transparent opacity={0.92} roughness={0.14} metalness={0.28} />
            </mesh>
            <mesh position={[0, 0.19, -0.02]}>
              <boxGeometry args={[0.49, 0.045, 0.45]} />
              <meshStandardMaterial color="#9eaaa5" metalness={0.66} roughness={0.3} />
            </mesh>
          </group>
        ))}
        {/* GNSS-style redundant antenna mast and crossbar. */}
        <mesh position={[0, 1.72, -0.58]}>
          <cylinderGeometry args={[0.035, 0.055, 1.12, 10]} />
          <meshStandardMaterial color="#cbd7d1" metalness={0.78} roughness={0.25} />
        </mesh>
        <mesh position={[0, 2.22, -0.58]}>
          <boxGeometry args={[0.94, 0.07, 0.12]} />
          <meshStandardMaterial color="#4a5f65" metalness={0.56} roughness={0.32} />
        </mesh>
        {[-0.38, 0, 0.38].map((x, i) => (
          <group key={x} position={[x, 2.22, -0.5]}>
            <mesh>
              <cylinderGeometry args={[0.11, 0.12, 0.08, 12]} />
              <meshStandardMaterial color="#364c53" metalness={0.48} roughness={0.36} />
            </mesh>
            <mesh position={[0, 0.06, 0]}>
              <sphereGeometry args={[0.06, 12, 8]} />
              <meshStandardMaterial color={i === 1 ? "#c5a5ff" : "#66e0df"} emissive={i === 1 ? "#5a3489" : "#176d72"} emissiveIntensity={0.8} />
            </mesh>
          </group>
        ))}
        {/* Clearly readable diagnostic panel and orientation marks. */}
        <RoundedBox args={[0.48, 0.36, 0.08]} radius={0.04} smoothness={3} position={[0.9, 0.62, 0.45]} castShadow>
          <meshStandardMaterial color="#1b2d35" metalness={0.42} roughness={0.3} />
        </RoundedBox>
        <mesh position={[0.9, 0.63, 0.5]}>
          <boxGeometry args={[0.28, 0.22, 0.02]} />
          <meshStandardMaterial color="#c5a5ff" emissive="#5a3489" emissiveIntensity={0.72} />
        </mesh>
        <mesh position={[-0.95, 0.4, 0.28]}>
          <boxGeometry args={[0.28, 0.08, 0.1]} />
          <meshStandardMaterial color="#e4cb78" metalness={0.66} roughness={0.28} />
        </mesh>
        <Beacon color={accent} active={false} height={2.62} />
      </group>
    );
  }

  if (id === "comms") {
    return (
      <group>
        <RoundedBox args={[2.45, 0.34, 1.9]} radius={0.12} smoothness={4} position={[0, 0.18, 0]} castShadow><meshStandardMaterial color={p.body} roughness={0.56} metalness={0.32} /></RoundedBox>
        <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.22, 0.25, 0.2, 12]} /><meshStandardMaterial color="#83928e" metalness={0.68} /></mesh>
        <mesh position={[0, 1.05, 0]} castShadow><cylinderGeometry args={[0.08, 0.13, 1.25, 12]} /><meshStandardMaterial color="#d7dfdb" metalness={0.76} roughness={0.22} /></mesh>
        <mesh position={[0, 1.67, 0]}><cylinderGeometry args={[0.3, 0.1, 0.22, 12]} /><meshStandardMaterial color="#58696b" metalness={0.68} /></mesh>
        <mesh position={[0, 1.86, 0.04]} rotation={[Math.PI / 2.25, 0, -0.28]} castShadow><sphereGeometry args={[0.78, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.46]} /><meshStandardMaterial color="#d8e0db" roughness={0.26} metalness={0.46} side={THREE.DoubleSide} /></mesh>
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

function Rover({ task, position, resourceNodes, targetNodeId, onClick, selected, alerted, performanceMultiplier }: { task: string; position: [number, number]; resourceNodes: MissionResourceNode[]; targetNodeId: string | null; onClick: () => void; selected: boolean; alerted: boolean; performanceMultiplier: number }) {
  const ref = useRef<THREE.Group>(null);
  const wheelRefs = useRef<Array<THREE.Group | null>>([]);
  const drillRef = useRef<THREE.Group>(null);
  const lastTaskRef = useRef("");
  const initializedRef = useRef(false);

  const prefixes = ["SURVEYING ", "MAPPING ", "COLLECTING ", "AT SITE ", "TRANSFERRING "];
  const taskPrefix = prefixes.find((prefix) => task.startsWith(prefix));
  const taskNodeLabel = taskPrefix ? task.slice(taskPrefix.length) : "";
  const target = (targetNodeId ? resourceNodes.find((node) => node.id === targetNodeId) : undefined)
    ?? (taskNodeLabel ? resourceNodes.find((node) => node.label === taskNodeLabel) : undefined);
  const isCollecting = task.startsWith("COLLECTING ");
  const isTransferring = task.startsWith("TRANSFERRING ");
  const isReturning = ["RETURNING", "REPAIR VERIFIED", "SAMPLE DELIVERED"].includes(task);
  const repairTarget = task.startsWith("REPAIRING ") ? task.slice("REPAIRING ".length).toLowerCase() : "";
  const isCleaning = task === "CLEANING ARRAY";
  const isSurveying = task.startsWith("SURVEYING ") || task.startsWith("MAPPING ");
  const isRouting = task === "REROUTING" || task === "FORCED THROUGH";
  const destination: [number, number] = isTransferring || isReturning
    ? POSITIONS.habitat
    : target && (isCollecting || isSurveying || task.startsWith("AT SITE "))
      ? nodeWorldPosition(target)
      : isCleaning
        ? POSITIONS.solar
        : repairTarget && POSITIONS[repairTarget]
          ? POSITIONS[repairTarget]
          : isRouting && resourceNodes[0]
            ? nodeWorldPosition(resourceNodes[0])
            : position;
  const hasDestination = Boolean(
    isTransferring || isReturning || isCleaning || isRouting ||
    (target && (isCollecting || isSurveying || task.startsWith("AT SITE "))) ||
    (repairTarget && POSITIONS[repairTarget]),
  );

  useEffect(() => {
    if (!ref.current) return;
    if (!initializedRef.current) {
      ref.current.position.set(POSITIONS.rover[0], PAD_Y + 0.47, POSITIONS.rover[1]);
      initializedRef.current = true;
    }
  }, []);

  useEffect(() => {
    // A new assignment is a new navigation command. Do not reset the vehicle to its spawn.
    if (task !== lastTaskRef.current) lastTaskRef.current = task;
  }, [task, targetNodeId]);

  useFrame(({ clock, delta }) => {
    const rover = ref.current;
    if (!rover) return;
    const current = rover.position;
    let travelled = 0;
    if (hasDestination) {
      const dx = destination[0] - current.x;
      const dz = destination[1] - current.z;
      const distance = Math.hypot(dx, dz);
      const arriveRadius = isCollecting ? 0.62 : isTransferring || isReturning ? 0.42 : 0.28;
      if (distance > arriveRadius && distance > 0.0001) {
        // Use frame delta, not the mission clock, so a rover doesn't freeze when a job timer is paused.
        const baseSpeed = isCollecting ? 3.4 : isTransferring || isReturning ? 5.6 : 6.8;
        const move = Math.min(Math.max(0, delta) * baseSpeed * Math.max(0.85, performanceMultiplier), distance - arriveRadius);
        current.x += (dx / distance) * move;
        current.z += (dz / distance) * move;
        travelled = move;
        rover.rotation.y = Math.atan2(dx, dz);
      }
    }
    current.y = terrainHeight(current.x, current.z) + 0.47 + Math.sin(clock.getElapsedTime() * (travelled > 0 ? 7 : 2.2)) * (travelled > 0 ? 0.018 : 0.005);
    if (travelled > 0) wheelRefs.current.forEach((wheel) => { if (wheel) wheel.rotation.x += travelled / 0.235; });
    if (drillRef.current) {
      drillRef.current.rotation.y = isCollecting ? clock.getElapsedTime() * 4.5 : 0;
      drillRef.current.position.y = isCollecting ? 0.14 + (Math.sin(clock.getElapsedTime() * 15) + 1) * 0.035 : 0.14;
    }
  });

  const wheelZ = [-0.55, 0, 0.55];
  return (
    <group ref={ref} onClick={(e) => { e.stopPropagation(); onClick(); }}>
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
          {wheelZ.map((z, wheelIndex) => (
            <group key={z} ref={(el) => { wheelRefs.current[(side === -1 ? 0 : 3) + wheelIndex] = el; }} position={[side * 0.82, -0.16, z]}>
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
      <group ref={drillRef} position={[0.48, 0.14, 0.53]} rotation={[0.1, 0, -0.22]}>
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
      <SelectionRing selected={selected} alerted={alerted} radius={1.34} height={-0.32} />
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
    {selected && <Billboard position={[0,0.82,0]} follow><Text frustumCulled={false} fontSize={0.25} color="#fff2c0" outlineWidth={0.03} outlineColor="#11191d" anchorX="center">{surveyed?"SURVEYED":node.label}</Text></Billboard>}
  </group>;
}

function Crew({ mars }: { mars: boolean }) {
  const routes: Array<Array<[number,number]>> = [
    // Long service-road circuits keep the crew visually moving through a much larger settlement.
    [[-14,13],[-14,5],[-14,-0.6],[-14,-13],[0,-13],[14,-13],[14,-0.6],[14,5],[14,13]],
    [[14,-18],[14,-13],[25.6,-13],[25.6,-25.6],[14,-25.6],[14,-18]],
    [[-25.6,13],[-14,13],[-14,-0.6],[-25.6,-0.6],[-25.6,13]],
  ];
  return <group>{Array.from({length:mars?7:5},(_,i)=><CrewMember key={i} route={routes[i%routes.length]} index={i} mars={mars}/>)}</group>;
}

function CrewMember({ route, index, mars }: { route: Array<[number, number]>; index: number; mars: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const phaseOffset = index * 1.17;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const time = clock.getElapsedTime();
    const p = ((time * 0.14) + index * 0.22) % route.length;
    const i = Math.floor(p);
    const f = p - i;
    const [ax, az] = route[i];
    const [bx, bz] = route[(i + 1) % route.length];
    const x = THREE.MathUtils.lerp(ax, bx, f);
    const z = THREE.MathUtils.lerp(az, bz, f);
    ref.current.position.set(x, -0.176 + Math.abs(Math.sin(time * 3.4 + phaseOffset)) * 0.012, z);
    ref.current.rotation.y = Math.atan2(bx - ax, bz - az);

    // Slower, weightier EVA gait rather than a twitchy robot walk.
    const gait = Math.sin(time * 3.2 + phaseOffset) * 0.2;
    if (leftArm.current) leftArm.current.rotation.x = gait;
    if (rightArm.current) rightArm.current.rotation.x = -gait;
    if (leftLeg.current) leftLeg.current.rotation.x = -gait * 0.8;
    if (rightLeg.current) rightLeg.current.rotation.x = gait * 0.8;
  });

  const suit = mars ? "#d6c7b9" : "#e2e4de";
  const fabric = mars ? "#b9a698" : "#c3c9c4";
  const seal = "#414c50";
  const hardware = "#7e8b8a";
  const patchColor = ["#c58a49", "#628caf", "#b66e62", "#769a7f", "#9184b8"][index % 5];

  return (
    <group ref={ref} scale={1.32}>
      {/* Human proportions: hip, torso, shoulders and a single helmet silhouette. */}
      <mesh castShadow position={[0, 0.47, 0]}>
        <sphereGeometry args={[0.205, 16, 12]} />
        <meshStandardMaterial color={fabric} roughness={0.86} />
      </mesh>
      <RoundedBox args={[0.34, 0.21, 0.22]} radius={0.075} smoothness={5} position={[0, 0.48, 0.015]} castShadow>
        <meshStandardMaterial color={suit} roughness={0.82} />
      </RoundedBox>
      <mesh position={[0, 0.58, 0]}>
        <torusGeometry args={[0.16, 0.025, 7, 20]} />
        <meshStandardMaterial color={seal} roughness={0.7} />
      </mesh>

      {/* EVA legs: shaped fabric thighs, flexible knees, calf shells and broad boots. */}
      {[-1, 1].map((side) => (
        <group key={side} ref={side < 0 ? leftLeg : rightLeg} position={[side * 0.105, 0.39, 0]}>
          <mesh castShadow position={[0, -0.12, 0]}>
            <capsuleGeometry args={[0.085, 0.22, 5, 10]} />
            <meshStandardMaterial color={suit} roughness={0.82} />
          </mesh>
          <RoundedBox args={[0.17, 0.14, 0.18]} radius={0.055} smoothness={4} position={[0, -0.28, 0.005]} castShadow>
            <meshStandardMaterial color={fabric} roughness={0.88} />
          </RoundedBox>
          <mesh position={[0, -0.3, 0.015]}>
            <torusGeometry args={[0.075, 0.018, 6, 14]} />
            <meshStandardMaterial color={seal} roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0, -0.4, 0.005]}>
            <capsuleGeometry args={[0.071, 0.18, 4, 9]} />
            <meshStandardMaterial color={suit} roughness={0.86} />
          </mesh>
          <RoundedBox args={[0.17, 0.105, 0.23]} radius={0.045} smoothness={4} position={[0, -0.54, 0.04]} castShadow>
            <meshStandardMaterial color="#354045" roughness={0.95} metalness={0.03} />
          </RoundedBox>
          <mesh position={[0, -0.59, 0.055]}>
            <boxGeometry args={[0.14, 0.018, 0.15]} />
            <meshStandardMaterial color="#8c9892" roughness={0.8} />
          </mesh>
      </group>
      ))}

      {/* Rounded pressure suit torso, shoulder yoke, fabric pleats and chest console. */}
      <mesh castShadow position={[0, 0.77, 0]}>
        <capsuleGeometry args={[0.205, 0.34, 6, 14]} />
        <meshStandardMaterial color={suit} roughness={0.82} />
      </mesh>
      <RoundedBox args={[0.49, 0.22, 0.29]} radius={0.095} smoothness={5} position={[0, 0.88, 0]} castShadow>
        <meshStandardMaterial color={suit} roughness={0.83} />
      </RoundedBox>
      <mesh position={[0, 0.63, 0.01]}>
        <torusGeometry args={[0.18, 0.023, 7, 22]} />
        <meshStandardMaterial color={fabric} roughness={0.85} />
      </mesh>
      <RoundedBox args={[0.12, 0.045, 0.035]} radius={0.012} smoothness={3} position={[0, 0.93, 0.145]}>
        <meshStandardMaterial color={patchColor} roughness={0.8} />
      </RoundedBox>

      {/* Cross-body restraint straps are narrow textile webbing, not metal robot plating. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.095, 0.77, 0.151]} rotation={[0, 0, -side * 0.45]}>
          <boxGeometry args={[0.032, 0.34, 0.012]} />
          <meshStandardMaterial color={fabric} roughness={0.92} />
        </mesh>
      ))}
      <RoundedBox args={[0.2, 0.17, 0.04]} radius={0.035} smoothness={4} position={[0, 0.79, 0.195]} castShadow>
        <meshStandardMaterial color="#4d5b5e" roughness={0.7} metalness={0.12} />
      </RoundedBox>
      <RoundedBox args={[0.12, 0.065, 0.018]} radius={0.018} smoothness={3} position={[0, 0.8, 0.222]}>
        <meshStandardMaterial color={patchColor} roughness={0.8} />
      </RoundedBox>
      {[-0.055, 0, 0.055].map((x, i) => (
        <mesh key={x} position={[x, 0.725, 0.222]}>
          <boxGeometry args={[0.025, 0.018, 0.012]} />
          <meshStandardMaterial color={["#8aafa7", "#dbbb73", "#8aafa7"][i]} roughness={0.7} />
        </mesh>
      ))}

      {/* Arms are jointed and padded; hands have a thumb but no exposed humanoid fingers. */}
      {[-1, 1].map((side) => (
        <group key={side} ref={side < 0 ? leftArm : rightArm} position={[side * 0.235, 0.87, 0]}>
          <mesh castShadow position={[side * 0.045, -0.14, 0]}>
            <capsuleGeometry args={[0.09, 0.22, 5, 11]} />
            <meshStandardMaterial color={suit} roughness={0.84} />
          </mesh>
          <RoundedBox args={[0.16, 0.13, 0.15]} radius={0.048} smoothness={4} position={[side * 0.07, -0.28, 0.005]}>
            <meshStandardMaterial color={fabric} roughness={0.86} />
          </RoundedBox>
          <mesh position={[side * 0.07, -0.31, 0.005]}>
            <torusGeometry args={[0.071, 0.018, 6, 14]} />
            <meshStandardMaterial color={seal} roughness={0.76} />
          </mesh>
          <mesh castShadow position={[side * 0.09, -0.385, 0.015]}>
            <capsuleGeometry args={[0.07, 0.12, 4, 9]} />
            <meshStandardMaterial color={suit} roughness={0.84} />
          </mesh>
          <RoundedBox args={[0.125, 0.105, 0.13]} radius={0.045} smoothness={4} position={[side * 0.09, -0.47, 0.045]}>
            <meshStandardMaterial color="#d3d5ce" roughness={0.88} />
          </RoundedBox>
          <mesh position={[side * 0.145, -0.49, 0.08]} rotation={[0, 0, -side * 0.5]}>
            <capsuleGeometry args={[0.034, 0.065, 4, 8]} />
            <meshStandardMaterial color="#d3d5ce" roughness={0.88} />
          </mesh>
      </group>
      ))}

      {/* Compact, load-bearing life-support backpack, hose ports and lower service pouch. */}
      <group position={[0, 0.78, -0.205]}>
        <RoundedBox args={[0.29, 0.4, 0.18]} radius={0.05} smoothness={4} castShadow>
          <meshStandardMaterial color="#aab2ad" roughness={0.78} />
        </RoundedBox>
        <RoundedBox args={[0.23, 0.16, 0.035]} radius={0.025} smoothness={3} position={[0, 0.08, -0.101]}>
          <meshStandardMaterial color="#6d7c7e" roughness={0.7} />
        </RoundedBox>
        {[-0.085, 0.085].map((x) => (
          <mesh key={x} position={[x, -0.035, -0.105]}>
            <boxGeometry args={[0.035, 0.19, 0.025]} />
            <meshStandardMaterial color="#d1d7d0" roughness={0.78} />
          </mesh>
        ))}
        <mesh position={[0.18, 0.04, -0.005]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 0.23, 8]} />
          <meshStandardMaterial color="#879798" roughness={0.72} metalness={0.12} />
        </mesh>
        <mesh position={[0, -0.23, -0.005]}>
          <boxGeometry args={[0.19, 0.12, 0.07]} />
          <meshStandardMaterial color="#818e8c" roughness={0.8} />
        </mesh>
      </group>

      {/* A single sealed spherical helmet with a broad, dark reflective visor. No visible face or glowing eyes. */}
      <mesh castShadow position={[0, 1.19, 0]}>
        <sphereGeometry args={[0.19, 24, 20]} />
        <meshStandardMaterial color={suit} roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.18, 0.112]} scale={[1.04, 0.72, 0.3]}>
        <sphereGeometry args={[0.15, 28, 22]} />
        <meshPhysicalMaterial color="#101f2a" transparent opacity={0.94} depthWrite={false} roughness={0.16} metalness={0.32} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      {/* A restrained curved reflection makes the visor legible at small map scale. */}
      <mesh position={[-0.038, 1.22, 0.151]} rotation={[0, 0, -0.22]}>
        <boxGeometry args={[0.1, 0.009, 0.004]} />
        <meshStandardMaterial color="#6e838a" roughness={0.32} metalness={0.28} />
      </mesh>
      <mesh position={[0.128, 1.19, 0.025]}>
        <sphereGeometry args={[0.026, 10, 8]} />
        <meshStandardMaterial color="#c5cbc4" roughness={0.5} metalness={0.18} />
      </mesh>
      <mesh position={[0, 1.03, 0]}>
        <boxGeometry args={[0.13, 0.1, 0.13]} />
        <meshStandardMaterial color={suit} roughness={0.86} />
      </mesh>
    </group>
  );
}

function TierHardware({ tier, large, upgradeLevel }: { tier: Tier; large: boolean; upgradeLevel: number }) {
  const rank = tier === "Foundation" ? 0 : tier === "Frontier" ? 1 : tier === "Apex" ? 2 : 3;
  if (rank === 0 && upgradeLevel === 0) return null;
  const hue = tierColor(tier);
  const radius = large ? 3.88 : 1.78;
  const hardwareRadius = large ? 3.18 : 1.22;
  const unitSize = large ? 0.36 : 0.2;
  return (
    <group frustumCulled={false}>
      {/* Exterior upgrade collar: tier changes remain visually readable from map zoom. */}
      {rank > 0 && (
        <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={13}>
          <ringGeometry args={[radius, radius + (rank >= 3 ? 0.12 : 0.075), 48]} />
          <meshBasicMaterial color={hue} transparent opacity={rank >= 3 ? 0.96 : 0.78} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {/* Frontier adds visible sensor/utility pods rather than only recolouring the skin. */}
      {rank >= 1 && Array.from({ length: 4 }, (_, i) => {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <group key={i} position={[Math.cos(angle) * hardwareRadius, 0.34, Math.sin(angle) * hardwareRadius]} rotation={[0, -angle, 0]}>
            <RoundedBox args={[unitSize, large ? 0.38 : 0.24, unitSize * 0.78]} radius={unitSize * 0.16} smoothness={3} castShadow>
              <meshStandardMaterial color={rank >= 3 ? "#d2b56c" : rank >= 2 ? "#778d96" : "#687a7f"} metalness={rank >= 2 ? 0.54 : 0.34} roughness={0.42} />
            </RoundedBox>
            <mesh position={[0, large ? 0.21 : 0.14, 0.012]}>
              <boxGeometry args={[unitSize * 0.42, unitSize * 0.22, 0.015]} />
              <meshStandardMaterial color={hue} emissive={rank >= 2 ? hue : "#000000"} emissiveIntensity={rank >= 2 ? 0.26 : 0} roughness={0.52} />
            </mesh>
          </group>
        );
      })}
      {/* Apex adds taller independent instrument masts; Research adds paired advanced beacons. */}
      {rank >= 2 && [-1, 1].map((side) => (
        <group key={side} position={[side * (large ? 2.75 : 1.06), 0.34, large ? -2.15 : -0.72]}>
          <mesh castShadow>
            <cylinderGeometry args={[large ? 0.045 : 0.028, large ? 0.055 : 0.035, large ? 0.85 : 0.56, 8]} />
            <meshStandardMaterial color="#c8d3cc" metalness={0.74} roughness={0.3} />
          </mesh>
          <mesh position={[0, large ? 0.48 : 0.32, 0]}>
            <octahedronGeometry args={[large ? 0.105 : 0.072, 0]} />
            <meshStandardMaterial color={hue} emissive={hue} emissiveIntensity={rank >= 3 ? 0.9 : 0.36} />
          </mesh>
        </group>
      ))}
      {rank >= 3 && (
        <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={14}>
          <ringGeometry args={[radius + 0.18, radius + 0.24, 48]} />
          <meshBasicMaterial color="#efd08a" transparent opacity={0.96} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {/* In-mission retrofits retain the selected technology silhouette and add separate gold hardware. */}
      {upgradeLevel > 0 && (
        <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={15}>
          <ringGeometry args={[large ? 4.16 : 2.02, large ? 4.23 : 2.1, 48]} />
          <meshBasicMaterial color="#e8c568" transparent opacity={0.94} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {/* Field retrofits add real surface hardware as well as the gold maintenance collar. */}
      {upgradeLevel === 1 && (
        <group>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * (large ? 2.35 : 0.87), 0.31, large ? -1.42 : -0.58]} rotation={[0, side * 0.32, 0]}>
              <RoundedBox args={[large ? 0.54 : 0.28, large ? 0.29 : 0.17, large ? 0.36 : 0.2]} radius={0.045} smoothness={3} castShadow>
                <meshStandardMaterial color="#a3b0aa" metalness={0.42} roughness={0.54} />
              </RoundedBox>
              <mesh position={[0, large ? 0.155 : 0.095, large ? 0.045 : 0.028]}>
                <boxGeometry args={[large ? 0.31 : 0.15, large ? 0.035 : 0.022, 0.018]} />
                <meshStandardMaterial color="#d8b960" emissive="#6b5120" emissiveIntensity={0.22} roughness={0.52} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {upgradeLevel >= 2 && rank === 0 && (
        <group>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * (large ? 2.78 : 1.05), 0.29, large ? 0.25 : 0.08]}>
              <mesh castShadow>
                <cylinderGeometry args={[large ? 0.09 : 0.055, large ? 0.11 : 0.07, large ? 0.45 : 0.3, 10]} />
                <meshStandardMaterial color="#899995" metalness={0.48} roughness={0.4} />
              </mesh>
              <mesh position={[0, large ? 0.24 : 0.16, 0]}>
                <octahedronGeometry args={[large ? 0.075 : 0.045, 0]} />
                <meshStandardMaterial color="#d7bd72" emissive="#705324" emissiveIntensity={0.32} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {upgradeLevel >= 2 && (
        <group>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (large ? 2.55 : 0.93), 0.68, large ? 0.4 : 0.18]} castShadow>
              <boxGeometry args={[large ? 0.2 : 0.13, large ? 0.55 : 0.4, large ? 0.38 : 0.24]} />
              <meshStandardMaterial color="#c2c9c0" metalness={0.67} roughness={0.34} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
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
      <Pad position={[0, 0]} size={track.id === "habitat" ? 8.8 : 3.65} mars={mars} accent={p.accent} />
      <group position={[0, 0.04, 0]} frustumCulled={false}>
        <BuildingArt id={track.id} accent={tierColor(tier)} />
      </group>
      <TierHardware tier={tier} large={track.id === "habitat"} upgradeLevel={runtime.upgradeLevel ?? 0} />
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
      <SelectionRing selected={selected} alerted={alerted} radius={track.id === "habitat" ? 4.24 : 2.05} height={0.12} />
      {track.id !== "rover" && (
  <Billboard
          position={[0, track.id === "habitat" ? 5.0 : track.id === "extraction" ? 4.35 : 3.35, 0]}
          follow
          frustumCulled={false}
        >
          <mesh position={[0, -0.04, -0.045]} renderOrder={12}>
            <planeGeometry args={[Math.max(2.35, Math.min(5.4, track.category.length * 0.19 + 0.7)), alerted ? 0.96 : 0.76]} />
            <meshBasicMaterial color="#071117" transparent opacity={0.78} depthWrite={false} toneMapped={false} />
          </mesh>
          <Text frustumCulled={false} position={[0, 0.16, 0]} fontSize={track.id === "habitat" ? 0.48 : 0.36} color={selected ? "#fff0a2" : "#f0f5ef"} outlineWidth={0.035} outlineColor="#11191d" anchorX="center" anchorY="middle">{track.category.toUpperCase()}</Text>
          <Text frustumCulled={false} position={[0, -0.16, 0]} fontSize={0.2} color={tierColor(tier)} outlineWidth={0.025} outlineColor="#11191d" anchorX="center" anchorY="middle">{tier.toUpperCase()}</Text>
          {alerted && <Text frustumCulled={false} position={[0, -0.43, 0]} fontSize={0.24} color="#ff6974" outlineWidth={0.03} outlineColor="#26171a" anchorX="center" anchorY="middle">EVENT · RESPOND</Text>}
        </Billboard>
)}
    </group>
  );
}

function LandingPad({ mars }: { mars:boolean }) {
  return <group position={[0,0.22,-20.0]}>
    <mesh receiveShadow><cylinderGeometry args={[4.0,4.3,0.14,24]}/><meshStandardMaterial color={mars?"#875747":"#777976"} roughness={0.94}/></mesh>
    <mesh position={[0,0.08,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[3.1,3.18,32]}/><meshBasicMaterial color={mars?"#d8a183":"#d3cfbd"}/></mesh>
    <Billboard position={[0,0.55,0]} follow><Text frustumCulled={false} fontSize={0.34} color={mars?"#f0c1a0":"#e3decb"} outlineWidth={0.035} outlineColor="#28221d" anchorX="center">LANDING PAD</Text></Billboard>
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
          <b style={{color:"#e8eee9"}}>1.</b> Keep the colony stable, manage supplies, and complete the mission objectives.
          <br/><b style={{color:"#e8eee9"}}>2.</b> A disaster opens a response popup and pauses the clock. Choose there first; if a fault remains, open the red-ringed system and run its repair.
          <br/><b style={{color:"#e8eee9"}}>3.</b> Open any system to see its work timer. Different systems can work in parallel; the rover drives to survey, sample, clean, or assigned repair sites.
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
  const roverTier = props.selected.rover ?? "Foundation";
  const roverTierIndex = roverTier === "Frontier" ? 1 : roverTier === "Apex" ? 2 : roverTier === "Research" ? 3 : 0;
  const roverRetrofitLevel = props.buildings.rover?.upgradeLevel ?? 0;
  // A complete technology-tier step (+18%) is always better than both field retrofits together (+10%).
  const roverPerformanceMultiplier = 1 + roverTierIndex * 0.18 + Math.max(0, Math.min(2, roverRetrofitLevel)) * 0.05;
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
            <Rover task={props.roverTask} position={POSITIONS.rover} resourceNodes={props.resourceNodes} targetNodeId={props.roverTargetNodeId} selected={props.selectedBuildingId === "rover"} alerted={props.activeEventTrackId === "rover"} performanceMultiplier={roverPerformanceMultiplier} onClick={() => props.onSelect("rover")} />
          </>
        )}
        <Crew mars={mars} />
        {props.resourceNodes.map((node) => <ResourceMarker key={node.id} node={node} surveyed={props.surveyedNodes.includes(node.id)} selected={props.selectedResourceId === node.id} onClick={() => props.onSelectResource(node)} />)}
        {props.activeEventTrackId && POSITIONS[props.activeEventTrackId] && (
          <Billboard position={[POSITIONS[props.activeEventTrackId][0], props.activeEventTrackId === "habitat" ? 5.9 : props.activeEventTrackId === "extraction" ? 5.0 : 4.25, POSITIONS[props.activeEventTrackId][1]]} follow frustumCulled={false}>
            <Text frustumCulled={false} fontSize={0.34} color="#ff6672" outlineWidth={0.045} outlineColor="#26171a" anchorX="center" anchorY="middle">RESPOND HERE</Text>
          </Billboard>
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
