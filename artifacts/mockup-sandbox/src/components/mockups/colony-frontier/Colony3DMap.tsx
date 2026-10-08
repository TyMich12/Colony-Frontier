import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Text } from "@react-three/drei";
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
  habitat: [-12.5, 10.5],
  extraction: [-3.8, 10.5],
  isru: [5.0, 10.5],
  radiation: [13.0, 10.5],
  oxygen: [-12.5, 3.0],
  comms: [-4.5, 3.0],
  maintenance: [4.5, 3.0],
  water: [12.5, 3.0],
  co2: [-12.5, -4.5],
  grid: [-4.0, -4.5],
  science: [4.5, -4.5],
  battery: [12.5, -4.5],
  thermal: [-12.5, -12.0],
  solar: [-4.0, -12.0],
  agriculture: [4.5, -12.0],
  navigation: [12.5, -12.0],
  rover: [0, -17.0],
};
const BUILDING_ROTATIONS: Record<string, number> = {
  habitat: 0,
  grid: 0,
  solar: 0.25,
  battery: -0.2,
  oxygen: 0.16,
  co2: 0.1,
  water: -0.08,
  comms: 0.45,
  navigation: -0.12,
  radiation: 0.22,
  rover: 0,
  agriculture: -0.15,
  thermal: 0.05,
  science: -0.42,
  extraction: 0.08,
  isru: -0.12,
  maintenance: 0.3,
};

function nodeWorldPosition(node: MissionResourceNode): [number, number] {
  return [(node.x - 500) / 22, (node.y - 300) / 10];
}

function statusColor(condition: number) {
  return condition < 55 ? "#ff705d" : condition < 82 ? "#f5c85d" : "#7be0a0";
}

function tierColor(tier: Tier) {
  return tier === "Foundation"
    ? "#62df8b"
    : tier === "Frontier"
      ? "#2dcaf1"
      : tier === "Apex"
        ? "#bb6cff"
        : "#ffae3f";
}

function surfaceRoadColor(mars: boolean) {
  return mars ? "#b77f62" : "#b7ad96";
}

function roadEdgeColor(mars: boolean) {
  return mars ? "#d3a17f" : "#d8ceb9";
}

const ROAD_HORIZONTAL_Z = [-8.25, -0.75, 6.75] as const;
const ROAD_VERTICAL_X = [-8.65, 0.25, 8.5] as const;
const OUTER_ROAD = [
  [-15.8, -14.5],
  [15.8, -14.5],
  [15.8, 13.8],
  [-15.8, 13.8],
  [-15.8, -14.5],
] as Array<[number, number]>;

function nearestRoadZ(z: number) {
  return ROAD_HORIZONTAL_Z.reduce((best, candidate) =>
    Math.abs(candidate - z) < Math.abs(best - z) ? candidate : best,
  ROAD_HORIZONTAL_Z[0]);
}

function PathStrip({
  points,
  width = 0.86,
  mars,
}: {
  points: Array<[number, number]>;
  width?: number;
  mars: boolean;
}) {
  return (
    <group>
      {points.slice(0, -1).map(([x1, z1], index) => {
        const [x2, z2] = points[index + 1];
        const dx = x2 - x1;
        const dz = z2 - z1;
        const length = Math.hypot(dx, dz);
        const angle = Math.atan2(dx, dz);
        const mx = (x1 + x2) / 2;
        const mz = (z1 + z2) / 2;
        const y = terrainHeight(mx, mz) + 0.13;
        return (
          <group
            key={index}
            position={[mx, y, mz]}
            rotation={[-Math.PI / 2, 0, angle]}
          >
            <mesh receiveShadow>
              <planeGeometry args={[width + 0.22, length + 0.14]} />
              <meshStandardMaterial color={roadEdgeColor(mars)} roughness={0.98} />
            </mesh>
            <mesh position={[0, 0.02, 0]} receiveShadow>
              <planeGeometry args={[width, length]} />
              <meshStandardMaterial color={surfaceRoadColor(mars)} roughness={0.98} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function CityRoadNetwork({ mars }: { mars: boolean }) {
  const routes: Array<{ points: Array<[number, number]>; width: number }> = [
    { points: OUTER_ROAD, width: 1.18 },
    ...ROAD_HORIZONTAL_Z.map((z) => ({
      points: [[-15.8, z], [15.8, z]] as Array<[number, number]>,
      width: 1.02,
    })),
    ...ROAD_VERTICAL_X.map((x) => ({
      points: [[x, -14.5], [x, 13.8]] as Array<[number, number]>,
      width: 1.02,
    })),
  ];

  const buildingAccess = Object.entries(POSITIONS)
    .filter(([id]) => id !== "rover")
    .map(([id, [x, z]]) => {
      const roadZ = nearestRoadZ(z);
      const approachZ = roadZ > z ? z + 2.0 : z - 2.0;
      return {
        id,
        points: [[x, approachZ], [x, roadZ]] as Array<[number, number]>,
      };
    });

  return (
    <group>
      {routes.map((route, index) => (
        <PathStrip key={index} points={route.points} width={route.width} mars={mars} />
      ))}
      {buildingAccess.map((route) => (
        <PathStrip key={route.id} points={route.points} width={0.82} mars={mars} />
      ))}
      <PathStrip points={[[0, -17.2], [0, -14.5]]} width={1.05} mars={mars} />
    </group>
  );
}

function Plaza(function Plaza({
  position,
  radius,
  mars,
  accent,
}: {
  position: [number, number];
  radius: number;
  mars: boolean;
  accent: string;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.17;

  useFrame(({ clock }) => {
    if (ringRef.current) ringRef.current.rotation.z = clock.getElapsedTime() * 0.08;
  });

  return (
    <group position={[x, y, z]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 48]} />
        <meshStandardMaterial color={mars ? "#704638" : "#59666a"} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]}>
        <ringGeometry args={[radius * 0.77, radius * 0.81, 48]} />
        <meshBasicMaterial color={accent} transparent opacity={0.65} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.027, 0]}>
        <ringGeometry args={[radius * 0.4, radius * 0.44, 32]} />
        <meshBasicMaterial color={mars ? "#e8b66d" : "#f1cf61"} transparent opacity={0.72} />
      </mesh>
    </group>
  );
}

function CentralCommandCenter({ color }: { color: string }) {
  const beaconRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (beaconRef.current) {
      beaconRef.current.rotation.y = t * 0.5;
      const mat = beaconRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.9 + (Math.sin(t * 2.5) + 1) * 0.22;
    }
    if (ringRef.current) ringRef.current.rotation.z = -t * 0.18;
  });

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.42, 0]}>
        <cylinderGeometry args={[1.62, 1.78, 0.84, 14]} />
        <meshStandardMaterial color="#4f5b60" roughness={0.72} metalness={0.22} />
      </mesh>
      <mesh castShadow position={[0, 0.94, 0]}>
        <cylinderGeometry args={[1.42, 1.52, 0.24, 14]} />
        <meshStandardMaterial color="#899291" roughness={0.52} metalness={0.34} />
      </mesh>
      <mesh castShadow position={[0, 1.45, 0]}>
        <sphereGeometry args={[1.32, 28, 18]} />
        <meshStandardMaterial color="#79cbd0" emissive="#245d68" emissiveIntensity={0.25} roughness={0.28} />
      </mesh>
      <mesh position={[0, 1.47, 0]}>
        <torusGeometry args={[0.92, 0.075, 8, 30]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={ringRef} position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.18, 0.035, 6, 28]} />
        <meshBasicMaterial color="#54eaff" transparent opacity={0.68} />
      </mesh>
      <mesh position={[0, 2.35, 0]}>
        <cylinderGeometry args={[0.13, 0.18, 1.4, 10]} />
        <meshStandardMaterial color="#dce3de" metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh ref={beaconRef} position={[0, 3.06, 0]}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial color="#60eaff" emissive="#1fcfda" emissiveIntensity={1} metalness={0.12} roughness={0.18} />
      </mesh>
      <mesh position={[0, 2.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.52, 0.048, 8, 24]} />
        <meshBasicMaterial color="#ffcf5c" />
      </mesh>
      {[-0.9, 0.9].map((x) => (
        <group key={x} position={[x, 0.68, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.24, 0.28, 0.75, 10]} />
            <meshStandardMaterial color="#6f7b7c" roughness={0.6} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <meshStandardMaterial color="#58dce6" emissive="#21c5d2" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
      <Text position={[0, 3.52, 0]} rotation={[-0.66, 0, 0]} fontSize={0.24} color="#fff1b4" outlineWidth={0.035} outlineColor="#28221f" anchorX="center">
        COMMAND HABITAT
      </Text>
    </group>
  );
}

function GardenPatch({
  position,
  scale = 1,
  flower = false,
}: {
  position: [number, number];
  scale?: number;
  flower?: boolean;
}) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.03;
  return (
    <group position={[x, y, z]} scale={scale}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.3, 1.35]} />
        <meshStandardMaterial color="#4c604d" roughness={1} />
      </mesh>
      {Array.from({ length: 12 }, (_, index) => {
        const gx = ((index % 4) - 1.5) * 0.46;
        const gz = (Math.floor(index / 4) - 1) * 0.38;
        return (
          <group key={index} position={[gx, 0.11 + (index % 2) * 0.03, gz]}>
            <mesh>
              <cylinderGeometry args={[0.035, 0.05, 0.22, 6]} />
              <meshStandardMaterial color="#6d4d36" roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.14, 0]}>
              <sphereGeometry args={[0.095, 8, 6]} />
              <meshStandardMaterial color={flower ? "#d888ae" : "#75b56b"} roughness={0.92} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function CrateCluster({ position, large = false }: { position: [number, number]; large?: boolean }) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.17;
  const s = large ? 1.12 : 1;
  return (
    <group position={[x, y, z]} scale={s}>
      {[
        [0, 0.22, 0],
        [0.36, 0.18, 0.15],
        [-0.26, 0.16, -0.33],
        [0.18, 0.57, -0.08],
      ].map(([cx, cy, cz], index) => (
        <mesh key={index} castShadow position={[cx, cy, cz]} rotation={[0, (index % 2) * 0.12, 0]}>
          <boxGeometry args={[0.5, 0.4, 0.5]} />
          <meshStandardMaterial color={index % 2 ? "#839694" : "#bf8e4f"} roughness={0.86} metalness={0.12} />
        </mesh>
      ))}
    </group>
  );
}

function PipeRuns() {
  const pipes: Array<[number, number, number, number]> = [
    [-6.2, 2.0, -3.1, 4.9],
    [6.4, 4.0, 10.3, 2.7],
    [-9.0, -1.4, -5.4, -6.5],
    [-3.1, 4.9, 0, 0],
    [6.2, -2.1, 0, -4.8],
  ];
  return (
    <group>
      {pipes.map(([x1, z1, x2, z2], index) => {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const length = Math.hypot(dx, dz);
        const angle = Math.atan2(dx, dz);
        const mx = (x1 + x2) / 2;
        const mz = (z1 + z2) / 2;
        return (
          <group key={index} position={[mx, terrainHeight(mx, mz) + 0.24, mz]} rotation={[0, angle, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.08, 0.08, length, 8]} />
              <meshStandardMaterial color="#7f8a88" metalness={0.55} roughness={0.32} />
            </mesh>
            <mesh position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.035, 0.035, length, 6]} />
              <meshStandardMaterial color="#39dce9" emissive="#1da8b4" emissiveIntensity={0.34} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function StreetLamp({ position, mars = false }: { position: [number, number]; mars?: boolean }) {
  const bulbRef = useRef<THREE.Mesh>(null);
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.02;
  useFrame(({ clock }) => {
    if (!bulbRef.current) return;
    (bulbRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
      0.72 + (Math.sin(clock.getElapsedTime() * 2.1 + x) + 1) * 0.1;
  });
  return (
    <group position={[x, y, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.045, 0.07, 0.72, 8]} />
        <meshStandardMaterial color={mars ? "#5b514f" : "#5d6869"} metalness={0.45} roughness={0.45} />
      </mesh>
      <mesh position={[0.16, 0.31, 0]}>
        <boxGeometry args={[0.33, 0.045, 0.045]} />
        <meshStandardMaterial color="#65706f" metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh ref={bulbRef} position={[0.31, 0.25, 0]}>
        <sphereGeometry args={[0.085, 10, 8]} />
        <meshStandardMaterial color="#ffdf78" emissive="#ffbf2a" emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

function SettlementGate({
  mars,
}: {
  mars: boolean;
}) {
  const wall = mars ? "#6e4136" : "#56636a";
  const cap = mars ? "#d89b6d" : "#c2cbca";
  return (
    <group position={[0, terrainHeight(0, -15.5) + 0.06, -15.5]}>
      <mesh castShadow>
        <boxGeometry args={[5.2, 1.35, 0.62]} />
        <meshStandardMaterial color={wall} roughness={0.78} metalness={0.18} />
      </mesh>
      {[[-2.05, 0], [2.05, 0]].map(([x], index) => (
        <group key={index} position={[x, 1.0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.72, 0.84, 2.45, 12]} />
            <meshStandardMaterial color={wall} roughness={0.72} metalness={0.2} />
          </mesh>
          <mesh position={[0, 1.33, 0]}>
            <cylinderGeometry args={[0.58, 0.67, 0.22, 12]} />
            <meshStandardMaterial color={cap} roughness={0.38} metalness={0.32} />
          </mesh>
          <mesh position={[0, 1.7, 0]}>
            <coneGeometry args={[0.35, 0.55, 8]} />
            <meshStandardMaterial color={index ? "#4cdbec" : "#f2c95f"} emissive={index ? "#1b9aa8" : "#b97a17"} emissiveIntensity={0.42} />
          </mesh>
        </group>
      ))}
      <mesh castShadow position={[0, 1.28, -0.08]}>
        <boxGeometry args={[2.15, 2.05, 0.55]} />
        <meshStandardMaterial color="#394349" roughness={0.73} metalness={0.18} />
      </mesh>
      <mesh position={[0, 1.3, -0.4]}>
        <boxGeometry args={[1.55, 1.72, 0.06]} />
        <meshStandardMaterial color="#1e282c" roughness={0.45} metalness={0.3} />
      </mesh>
      <mesh position={[0, 2.48, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 1.08, 8]} />
        <meshStandardMaterial color="#d8dfdb" metalness={0.6} roughness={0.24} />
      </mesh>
      <mesh position={[0.46, 2.42, 0]}>
        <boxGeometry args={[0.62, 0.34, 0.05]} />
        <meshStandardMaterial color="#48d9e8" emissive="#1fabb7" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

function SettlementWall({ mars }: { mars: boolean }) {
  const wall = mars ? "#6a3f34" : "#515e64";
  const cap = mars ? "#d08f66" : "#bfc8c6";
  const merlon = mars ? "#7c4b3d" : "#626e74";
  const segments = [
    { x: 0, z: -15.5, w: 34, d: 0.56 },
    { x: 0, z: 15.5, w: 34, d: 0.56 },
    { x: -17, z: 0, w: 0.56, d: 31 },
    { x: 17, z: 0, w: 0.56, d: 31 },
  ];

  return (
    <group>
      {segments.map((segment, index) => {
        const isFront = index === 0;
        const y = terrainHeight(segment.x, segment.z) + 0.65;
        return (
          <group key={index} position={[segment.x, y, segment.z]}>
            {isFront ? (
              <>
                <mesh castShadow receiveShadow position={[-6.2, 0, 0]}>
                  <boxGeometry args={[21.6, 1.15, segment.d]} />
                  <meshStandardMaterial color={wall} roughness={0.76} metalness={0.16} />
                </mesh>
                <mesh castShadow receiveShadow position={[6.2, 0, 0]}>
                  <boxGeometry args={[21.6, 1.15, segment.d]} />
                  <meshStandardMaterial color={wall} roughness={0.76} metalness={0.16} />
                </mesh>
              </>
            ) : (
              <mesh castShadow receiveShadow>
                <boxGeometry args={[segment.w, 1.15, segment.d]} />
                <meshStandardMaterial color={wall} roughness={0.76} metalness={0.16} />
              </mesh>
            )}
            <mesh position={[0, 0.64, 0]}>
              <boxGeometry args={[segment.w, 0.11, segment.d * 1.1]} />
              <meshStandardMaterial color={cap} roughness={0.42} metalness={0.28} />
            </mesh>
            {Array.from({ length: index < 2 ? 18 : 16 }, (_, merlonIndex) => {
              const span = index < 2 ? 34 : 31;
              const along = -span / 2 + 1.0 + merlonIndex * 2.0;
              const pos = index < 2 ? [along, 0.84, 0] : [0, 0.84, along];
              return (
                <mesh key={merlonIndex} castShadow position={pos as [number, number, number]}>
                  <boxGeometry args={index < 2 ? [0.62, 0.34, 0.72] : [0.72, 0.34, 0.62]} />
                  <meshStandardMaterial color={merlon} roughness={0.74} metalness={0.15} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

function PlazaTower({ position, color }: { position: [number, number]; color: string }) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.14;
  return (
    <group position={[x, y, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.3, 0.42, 1.28, 10]} />
        <meshStandardMaterial color="#626c6f" roughness={0.65} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.82, 0]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color="#ffd565" emissive="#ffb91d" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <boxGeometry args={[0.48, 0.06, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.42} />
      </mesh>
    </group>
  );
}


function SmallColonyBuilding({
  position,
  index,
  mars,
}: {
  position: [number, number];
  index: number;
  mars: boolean;
}) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.04;
  const shell = mars ? ["#714539", "#7b503e", "#674037"][index % 3] : ["#5d696d", "#687477", "#536166"][index % 3];
  const roof = mars ? ["#c78361", "#df9c71", "#ae6b52"][index % 3] : ["#65b7c1", "#7b8dd0", "#72c39d"][index % 3];
  return (
    <group position={[x, y, z]} rotation={[0, (index % 4) * 0.12 - 0.18, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.43, 0]}>
        <boxGeometry args={[1.25 + (index % 2) * 0.2, 0.78, 0.98]} />
        <meshStandardMaterial color={shell} roughness={0.82} metalness={0.12} />
      </mesh>
      <mesh castShadow position={[0, 0.9, 0]}>
        <boxGeometry args={[1.05 + (index % 2) * 0.2, 0.16, 0.82]} />
        <meshStandardMaterial color={roof} roughness={0.52} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.42, 0.51]}>
        <boxGeometry args={[0.31, 0.42, 0.035]} />
        <meshStandardMaterial color="#263237" roughness={0.65} metalness={0.2} />
      </mesh>
      {[-0.35, 0.35].map((wx) => (
        <mesh key={wx} position={[wx, 0.56, 0.515]}>
          <boxGeometry args={[0.24, 0.17, 0.028]} />
          <meshStandardMaterial color="#88dfe7" emissive="#2a8590" emissiveIntensity={0.32} roughness={0.28} />
        </mesh>
      ))}
      <mesh position={[0, 1.18, 0]}>
        <cylinderGeometry args={[0.055, 0.08, 0.48, 8]} />
        <meshStandardMaterial color="#d3dad6" metalness={0.52} roughness={0.28} />
      </mesh>
      <mesh position={[0, 1.43, 0]}>
        <sphereGeometry args={[0.045, 8, 6]} />
        <meshStandardMaterial color="#ffdd74" emissive="#ffbd24" emissiveIntensity={0.75} />
      </mesh>
    </group>
  );
}

function StorageYard({
  position,
  mars,
}: {
  position: [number, number];
  mars: boolean;
}) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.05;
  return (
    <group position={[x, y, z]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 2.1]} />
        <meshStandardMaterial color={mars ? "#7b5143" : "#515b5e"} roughness={0.95} />
      </mesh>
      {[[-0.9, -0.45], [0, -0.45], [0.9, -0.45], [-0.45, 0.42], [0.45, 0.42]].map(([cx, cz], index) => (
        <mesh key={index} castShadow position={[cx, 0.26 + (index % 2) * 0.38, cz]} rotation={[0, index * 0.17, 0]}>
          <boxGeometry args={[0.66, 0.46, 0.66]} />
          <meshStandardMaterial color={index % 2 ? "#839391" : "#bc8b50"} roughness={0.86} metalness={0.14} />
        </mesh>
      ))}
      <mesh position={[0, 0.1, 0.92]}>
        <boxGeometry args={[2.42, 0.08, 0.08]} />
        <meshStandardMaterial color="#707a79" metalness={0.42} roughness={0.44} />
      </mesh>
    </group>
  );
}

function CanopyMarket({
  position,
  mars,
}: {
  position: [number, number];
  mars: boolean;
}) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.04;
  return (
    <group position={[x, y, z]}>
      {[[-0.65, -0.52], [0.65, -0.52], [-0.65, 0.52], [0.65, 0.52]].map(([cx, cz], index) => (
        <mesh key={index} castShadow position={[cx, 0.55, cz]}>
          <cylinderGeometry args={[0.045, 0.06, 1.05, 8]} />
          <meshStandardMaterial color="#747f7f" metalness={0.42} roughness={0.46} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 1.12, 0]}>
        <boxGeometry args={[1.65, 0.12, 1.45]} />
        <meshStandardMaterial color={mars ? "#d38d65" : "#73c7ce"} emissive={mars ? "#6e3524" : "#267e87"} emissiveIntensity={0.2} roughness={0.58} />
      </mesh>
      {[[-0.48, 0, -0.28], [0, 0, 0], [0.48, 0, 0.28]].map(([cx, cy, cz], index) => (
        <mesh key={index} castShadow position={[cx, 0.34, cz]}>
          <boxGeometry args={[0.42, 0.34, 0.48]} />
          <meshStandardMaterial color={index % 2 ? "#c89a56" : "#6e9b96"} roughness={0.82} />
        </mesh>
      ))}
    </group>
  );
}

function HydroponicPlanter({
  position,
  mars,
}: {
  position: [number, number];
  mars: boolean;
}) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.04;
  return (
    <group position={[x, y, z]}>
      <mesh receiveShadow>
        <boxGeometry args={[1.55, 0.2, 0.74]} />
        <meshStandardMaterial color="#3f5048" roughness={0.92} />
      </mesh>
      {[-0.52, -0.17, 0.17, 0.52].map((cx, index) => (
        <mesh key={index} position={[cx, 0.28, 0]} castShadow>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial color={mars ? "#78aa69" : "#6fd17b"} emissive={mars ? "#315f2c" : "#2f9b44"} emissiveIntensity={0.4} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.17, -0.39]}>
        <boxGeometry args={[1.7, 0.04, 0.05]} />
        <meshStandardMaterial color="#6fdbdf" emissive="#25a6ae" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function FenceRow({
  from,
  to,
}: {
  from: [number, number];
  to: [number, number];
}) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const mx = (from[0] + to[0]) / 2;
  const mz = (from[1] + to[1]) / 2;
  return (
    <group position={[mx, terrainHeight(mx, mz) + 0.05, mz]} rotation={[0, angle, 0]}>
      {Array.from({ length: Math.max(2, Math.floor(length / 0.9)) }, (_, index) => (
        <group key={index} position={[0, 0, -length / 2 + 0.45 + index * 0.9]}>
          <mesh>
            <cylinderGeometry args={[0.025, 0.035, 0.42, 6]} />
            <meshStandardMaterial color="#6f7a78" metalness={0.42} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <boxGeometry args={[0.18, 0.035, 0.05]} />
            <meshStandardMaterial color="#83918e" metalness={0.36} roughness={0.54} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BuildingPlot({
  position,
  size = 3.8,
  mars,
  accent = "#b7ab95",
}: {
  position: [number, number];
  size?: number;
  mars: boolean;
  accent?: string;
}) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.055;
  return (
    <group position={[x, y, z]}>
      <mesh receiveShadow>
        <circleGeometry args={[size * 0.56, 64]} />
        <meshStandardMaterial color={mars ? "#805247" : "#686761"} roughness={0.99} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 0.48, size * 0.53, 64]} />
        <meshStandardMaterial color={accent} roughness={0.97} transparent opacity={0.42} />
      </mesh>
      <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 0.38, size * 0.405, 64]} />
        <meshStandardMaterial color={mars ? "#b8795f" : "#969189"} roughness={1} transparent opacity={0.34} />
      </mesh>
    </group>
  );
}

function buildingPalette(function buildingPalette(id: string) {
  const palette: Record<string, { body: string; roof: string; accent: string; glow: string }> = {
    habitat: { body: "#d9e1d8", roof: "#2f9eb2", accent: "#f0c85e", glow: "#43d7e8" },
    solar: { body: "#4a6f82", roof: "#2879b8", accent: "#67d9ee", glow: "#43dff1" },
    battery: { body: "#4b587c", roof: "#7564b5", accent: "#55d9ef", glow: "#55e7f3" },
    oxygen: { body: "#4b817d", roof: "#3bb8ba", accent: "#f1cf62", glow: "#68eff0" },
    water: { body: "#477a9e", roof: "#2caed3", accent: "#f4cd62", glow: "#53dfff" },
    co2: { body: "#8a604c", roof: "#d58b58", accent: "#ffd064", glow: "#ffb34d" },
    comms: { body: "#66548b", roof: "#4c86c5", accent: "#f0c75b", glow: "#66ddff" },
    navigation: { body: "#5f5689", roof: "#8b63c4", accent: "#ffd160", glow: "#ff74df" },
    radiation: { body: "#554f78", roof: "#8b65b7", accent: "#efca63", glow: "#d48cff" },
    science: { body: "#634f84", roof: "#a05ac1", accent: "#f1c761", glow: "#e082ff" },
    agriculture: { body: "#3f765c", roof: "#54b86d", accent: "#f5d060", glow: "#6cff8c" },
    extraction: { body: "#765942", roof: "#c58d49", accent: "#f2d065", glow: "#ffc04d" },
    isru: { body: "#497969", roof: "#54b59b", accent: "#f0cf5c", glow: "#69f0bd" },
    thermal: { body: "#80574e", roof: "#d27657", accent: "#f6d166", glow: "#ff8f63" },
    grid: { body: "#4c6874", roof: "#4db3c8", accent: "#f0cc5a", glow: "#5fe9f3" },
    maintenance: { body: "#596b74", roof: "#4e9cb5", accent: "#f2c65d", glow: "#6fdff1" },
  };
  return palette[id] ?? { body: "#607277", roof: "#4e9cae", accent: "#f0c85e", glow: "#63e4ee" };
}

function BuildingBase({
  color,
  width = 2.2,
  depth = 1.8,
  height = 0.55,
}: {
  color: string;
  width?: number;
  depth?: number;
  height?: number;
}) {
  return (
    <RoundedBox args={[width, height, depth]} radius={0.18} smoothness={4} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.64} metalness={0.16} />
    </RoundedBox>
  );
}

function SolarArray() {
  return (
    <group rotation={[0.12, 0, 0]}>
      <mesh position={[0, 0.03, 0]} castShadow>
        <boxGeometry args={[2.05, 0.06, 1.55]} />
        <meshStandardMaterial color="#26343a" roughness={0.45} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.075, 0]}>
        <planeGeometry args={[1.9, 1.4]} />
        <meshStandardMaterial color="#173d62" roughness={0.24} metalness={0.42} />
      </mesh>
      {[-0.62, -0.2, 0.2, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.082, 0]}>
          <boxGeometry args={[0.022, 0.018, 1.4]} />
          <meshStandardMaterial color="#88bdd0" metalness={0.65} roughness={0.22} />
        </mesh>
      ))}
      {[-0.47, 0, 0.47].map((z) => (
        <mesh key={z} position={[0, 0.084, z]}>
          <boxGeometry args={[1.88, 0.018, 0.024]} />
          <meshStandardMaterial color="#88bdd0" metalness={0.65} roughness={0.22} />
        </mesh>
      ))}
      <mesh position={[0, -0.43, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.075, 0.86, 8]} />
        <meshStandardMaterial color="#9aa5a3" metalness={0.64} roughness={0.26} />
      </mesh>
      <mesh position={[0, -0.82, 0]} castShadow>
        <boxGeometry args={[0.72, 0.08, 0.16]} />
        <meshStandardMaterial color="#737f7e" metalness={0.45} roughness={0.4} />
      </mesh>
    </group>
  );
}

function DomeStructure({
  color,
  glass = "#7fd7df",
}: {
  color: string;
  glass?: string;
}) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.48, 0]}>
        <cylinderGeometry args={[1.28, 1.46, 0.72, 12]} />
        <meshStandardMaterial color="#4b575b" roughness={0.66} metalness={0.24} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <sphereGeometry args={[1.3, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color={glass} roughness={0.3} metalness={0.24} transparent opacity={0.88} />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <torusGeometry args={[1.08, 0.055, 7, 28]} />
        <meshStandardMaterial color={color} metalness={0.52} roughness={0.24} />
      </mesh>
      {[-0.72, -0.24, 0.24, 0.72].map((x) => (
        <mesh key={x} position={[x, 1.06, 0]} rotation={[0, 0, x * 0.14]}>
          <boxGeometry args={[0.035, 0.86, 0.05]} />
          <meshStandardMaterial color="#bbc8c5" metalness={0.6} roughness={0.24} />
        </mesh>
      ))}
    </group>
  );
}

function CommandHabitat({ color }: { color: string }) {
  const windows = [-1.72, -0.86, 0, 0.86, 1.72];
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.32, 0]}>
        <cylinderGeometry args={[2.18, 2.42, 0.64, 16]} />
        <meshStandardMaterial color="#465257" roughness={0.65} metalness={0.26} />
      </mesh>
      <mesh castShadow position={[0, 0.71, 0]}>
        <cylinderGeometry args={[1.94, 2.08, 0.24, 16]} />
        <meshStandardMaterial color="#9ba7a5" roughness={0.42} metalness={0.38} />
      </mesh>
      <mesh castShadow position={[0, 1.72, 0]}>
        <sphereGeometry args={[1.82, 36, 22, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <meshStandardMaterial color="#76d2d8" emissive="#174e59" emissiveIntensity={0.16} roughness={0.25} metalness={0.2} transparent opacity={0.94} />
      </mesh>
      <mesh position={[0, 1.76, 0]}>
        <torusGeometry args={[1.48, 0.075, 8, 32]} />
        <meshStandardMaterial color="#f0c85f" metalness={0.55} roughness={0.22} />
      </mesh>
      {[-1.28, -0.64, 0, 0.64, 1.28].map((x) => (
        <mesh key={x} position={[x, 1.78, 0]} rotation={[0, 0, x * 0.08]}>
          <boxGeometry args={[0.07, 1.18, 0.05]} />
          <meshStandardMaterial color="#dce4e0" metalness={0.6} roughness={0.22} />
        </mesh>
      ))}
      {windows.map((x) => (
        <mesh key={x} position={[x, 0.94, 2.02]}>
          <RoundedBox args={[0.52, 0.25, 0.06]} radius={0.07} smoothness={3}>
            <meshStandardMaterial color="#19363e" emissive="#1bbbc8" emissiveIntensity={0.45} metalness={0.34} roughness={0.2} />
          </RoundedBox>
        </mesh>
      ))}
      {[-2.35, 2.35].map((x) => (
        <group key={x} position={[x, 0.62, 0]}>
          <RoundedBox args={[1.18, 0.82, 1.6]} radius={0.24} smoothness={4} castShadow>
            <meshStandardMaterial color="#596568" roughness={0.68} metalness={0.2} />
          </RoundedBox>
          <mesh position={[0, 0.63, 0]}>
            <boxGeometry args={[1.22, 0.08, 1.52]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} metalness={0.28} roughness={0.36} />
          </mesh>
        </group>
      ))}
      <mesh castShadow position={[0, 2.88, 0]}>
        <cylinderGeometry args={[0.1, 0.16, 1.1, 10]} />
        <meshStandardMaterial color="#d9e1dd" metalness={0.72} roughness={0.18} />
      </mesh>
      <mesh position={[0, 3.45, 0]}>
        <octahedronGeometry args={[0.25, 1]} />
        <meshStandardMaterial color="#55e8f0" emissive="#1bc8d3" emissiveIntensity={1.1} metalness={0.16} roughness={0.18} />
      </mesh>
    </group>
  );
}

function IndustrialTanks({ color, water }: { color: string; water: boolean }) {
  const tankColor = water ? "#4fc3e2" : "#a9d9d1";
  return (
    <group>
      {[-0.72, 0.72].map((x) => (
        <group key={x} position={[x, 0.72, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.48, 0.55, 1.24, 14]} />
            <meshStandardMaterial color="#aeb9b5" roughness={0.38} metalness={0.36} />
          </mesh>
          <mesh position={[0, 0.7, 0]}>
            <sphereGeometry args={[0.48, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial color="#d4dbd7" roughness={0.32} metalness={0.34} />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <RoundedBox args={[0.62, 0.66, 0.62]} radius={0.16} smoothness={3}>
              <meshStandardMaterial color={tankColor} transparent opacity={0.58} roughness={0.2} metalness={0.08} />
            </RoundedBox>
          </mesh>
          <mesh position={[0, 1.34, 0]}>
            <torusGeometry args={[0.36, 0.045, 7, 22]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} metalness={0.3} roughness={0.24} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.26, 0.55]}>
        <RoundedBox args={[1.22, 0.13, 0.18]} radius={0.05} smoothness={2}>
          <meshStandardMaterial color="#6c7a79" metalness={0.5} roughness={0.3} />
        </RoundedBox>
      </mesh>
    </group>
  );
}

function StaticBuildingArt({
  id,
  color,
}: {
  id: string;
  color: string;
}) {
  const palette = buildingPalette(id);

  switch (id) {
    case "habitat":
      return <CommandHabitat color={color} />;

    case "solar":
      return (
        <group>
          <BuildingBase color={palette.body} width={2.4} depth={1.9} height={0.34} />
          <mesh position={[0, 0.42, 0]} castShadow>
            <RoundedBox args={[0.22, 0.62, 1.42]} radius={0.08} smoothness={3}>
              <meshStandardMaterial color="#7b8582" metalness={0.42} roughness={0.35} />
            </RoundedBox>
          </mesh>
          <group position={[-0.73, 0.72, 0]}>
            <SolarArray />
          </group>
          <group position={[0.73, 0.72, 0]} scale={0.9}>
            <SolarArray />
          </group>
          <mesh position={[0, 0.58, 0.7]} rotation={[0.3, 0, 0]}>
            <cylinderGeometry args={[0.075, 0.1, 0.82, 8]} />
            <meshStandardMaterial color="#c6d0cc" metalness={0.7} roughness={0.2} />
          </mesh>
        </group>
      );

    case "comms":
      return (
        <group>
          <BuildingBase color={palette.body} width={1.9} depth={1.7} height={0.38} />
          <mesh position={[0, 0.98, 0]}>
            <cylinderGeometry args={[0.09, 0.14, 1.55, 10]} />
            <meshStandardMaterial color="#d9e0dc" metalness={0.7} roughness={0.2} />
          </mesh>
          <mesh position={[0, 1.7, 0]} rotation={[Math.PI / 2.55, 0, 0]}>
            <sphereGeometry args={[0.72, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.46]} />
            <meshStandardMaterial color="#dce4df" roughness={0.23} metalness={0.42} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 1.6, 0.52]} rotation={[0.15, 0, 0]}>
            <RoundedBox args={[0.72, 0.08, 0.08]} radius={0.025} smoothness={2}>
              <meshStandardMaterial color={palette.accent} emissive={palette.glow} emissiveIntensity={0.55} />
            </RoundedBox>
          </mesh>
        </group>
      );

    case "oxygen":
      return (
        <group>
          <BuildingBase color={palette.body} width={2.15} depth={1.8} height={0.36} />
          <IndustrialTanks color={color} water={false} />
          <mesh position={[0, 1.14, -0.62]}>
            <RoundedBox args={[1.38, 0.14, 0.22]} radius={0.05} smoothness={2}>
              <meshStandardMaterial color="#6f7c7c" metalness={0.48} roughness={0.3} />
            </RoundedBox>
          </mesh>
        </group>
      );

    case "water":
      return (
        <group>
          <BuildingBase color={palette.body} width={2.15} depth={1.8} height={0.36} />
          <IndustrialTanks color={color} water />
          <mesh position={[0, 1.14, -0.62]}>
            <RoundedBox args={[1.38, 0.14, 0.22]} radius={0.05} smoothness={2}>
              <meshStandardMaterial color="#6f7c7c" metalness={0.48} roughness={0.3} />
            </RoundedBox>
          </mesh>
        </group>
      );

    case "battery":
      return (
        <group>
          <BuildingBase color={palette.body} width={2.32} depth={1.84} height={0.42} />
          {[-0.78, 0, 0.78].map((x, index) => (
            <group key={x} position={[x, 0.72, 0]}>
              <RoundedBox args={[0.5, 1.02, 0.94]} radius={0.15} smoothness={4} castShadow>
                <meshStandardMaterial color={index === 1 ? "#4c686c" : "#596466"} metalness={0.28} roughness={0.38} />
              </RoundedBox>
              <mesh position={[0, 0.58, 0.48]}>
                <RoundedBox args={[0.27, 0.1, 0.05]} radius={0.035} smoothness={2}>
                  <meshStandardMaterial color={palette.accent} emissive={palette.glow} emissiveIntensity={0.8} />
                </RoundedBox>
              </mesh>
            </group>
          ))}
          <mesh position={[0, 1.42, 0]}>
            <torusGeometry args={[1.0, 0.045, 7, 30, Math.PI]} />
            <meshStandardMaterial color="#879290" metalness={0.55} roughness={0.3} />
          </mesh>
        </group>
      );

    case "co2":
      return (
        <group>
          <BuildingBase color={palette.body} width={1.95} depth={1.7} height={0.38} />
          <mesh position={[0, 1.0, 0]}>
            <cylinderGeometry args={[0.48, 0.58, 1.12, 14]} />
            <meshStandardMaterial color="#717d7e" roughness={0.46} metalness={0.3} />
          </mesh>
          <mesh position={[0, 1.58, 0]}>
            <sphereGeometry args={[0.48, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial color="#899593" roughness={0.38} metalness={0.28} />
          </mesh>
          {[-0.62, 0.62].map((x) => (
            <mesh key={x} position={[x, 0.94, 0.38]}>
              <RoundedBox args={[0.25, 0.62, 0.25]} radius={0.08} smoothness={3}>
                <meshStandardMaterial color="#657273" roughness={0.45} metalness={0.22} />
              </RoundedBox>
            </mesh>
          ))}
          <mesh position={[0, 1.02, 0.5]}>
            <torusGeometry args={[0.34, 0.045, 7, 24]} />
            <meshStandardMaterial color={palette.accent} emissive={palette.glow} emissiveIntensity={0.6} />
          </mesh>
        </group>
      );

    case "radiation":
      return (
        <group>
          <BuildingBase color={palette.body} width={2.2} depth={1.8} height={0.4} />
          <DomeStructure color={color} glass="#7868a7" />
          {[-0.9, 0.9].map((x) => (
            <mesh key={x} position={[x, 0.66, 0.72]} rotation={[0, 0, x > 0 ? -0.28 : 0.28]}>
              <RoundedBox args={[0.24, 1.0, 0.08]} radius={0.05} smoothness={3}>
                <meshStandardMaterial color="#c6cfca" metalness={0.55} roughness={0.3} />
              </RoundedBox>
            </mesh>
          ))}
        </group>
      );

    case "science":
      return (
        <group>
          <BuildingBase color={palette.body} width={2.28} depth={2.05} height={0.38} />
          <DomeStructure color={color} glass="#6a5e95" />
          <mesh position={[0, 1.34, 0.22]} rotation={[0.24, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.13, 1.05, 10]} />
            <meshStandardMaterial color="#d7dfda" metalness={0.68} roughness={0.2} />
          </mesh>
          <mesh position={[0, 1.7, 0.52]} rotation={[0.3, 0, 0]}>
            <RoundedBox args={[0.44, 0.15, 0.32]} radius={0.06} smoothness={3}>
              <meshStandardMaterial color="#ddd0f1" emissive="#8f65bb" emissiveIntensity={0.28} metalness={0.25} roughness={0.26} />
            </RoundedBox>
          </mesh>
        </group>
      );

    case "extraction":
      return (
        <group>
          <BuildingBase color={palette.body} width={2.35} depth={1.9} height={0.42} />
          <mesh position={[0, 1.0, 0]}>
            <cylinderGeometry args={[0.33, 0.45, 1.08, 12]} />
            <meshStandardMaterial color="#626f70" metalness={0.38} roughness={0.42} />
          </mesh>
          <mesh position={[0, 1.62, 0]}>
            <coneGeometry args={[0.42, 0.48, 8]} />
            <meshStandardMaterial color={palette.accent} emissive={palette.glow} emissiveIntensity={0.38} metalness={0.3} roughness={0.28} />
          </mesh>
          <mesh position={[0, 1.08, 0]} rotation={[0, 0, Math.PI / 2.8]}>
            <cylinderGeometry args={[0.11, 0.14, 1.55, 8]} />
            <meshStandardMaterial color="#d2d9d5" metalness={0.72} roughness={0.2} />
          </mesh>
          {[-0.65, 0.65].map((x) => (
            <mesh key={x} position={[x, 0.9, 0.42]}>
              <RoundedBox args={[0.34, 0.52, 0.34]} radius={0.08} smoothness={3}>
                <meshStandardMaterial color="#697576" roughness={0.5} metalness={0.24} />
              </RoundedBox>
            </mesh>
          ))}
        </group>
      );

    case "isru":
      return (
        <group>
          <BuildingBase color={palette.body} width={2.45} depth={2.02} height={0.44} />
          {[-0.72, 0.72].map((x, index) => (
            <group key={x} position={[x, 0.98, 0]}>
              <mesh>
                <cylinderGeometry args={[0.34, 0.43, 1.28, 14]} />
                <meshStandardMaterial color={index ? "#5d706d" : "#657976"} metalness={0.42} roughness={0.38} />
              </mesh>
              <mesh position={[0, 0.72, 0]}>
                <sphereGeometry args={[0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
                <meshStandardMaterial color={index ? "#77b9ac" : "#6fc9b9"} emissive="#237f70" emissiveIntensity={0.22} metalness={0.32} roughness={0.28} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 1.42, 0]}>
            <cylinderGeometry args={[0.24, 0.3, 1.5, 10]} />
            <meshStandardMaterial color="#d6ddd8" metalness={0.7} roughness={0.2} />
          </mesh>
          <mesh position={[0, 2.18, 0]}>
            <torusGeometry args={[0.28, 0.05, 7, 22]} />
            <meshStandardMaterial color={palette.accent} emissive={palette.glow} emissiveIntensity={0.65} />
          </mesh>
        </group>
      );

    case "agriculture":
      return (
        <group>
          <BuildingBase color={palette.body} width={2.5} depth={1.92} height={0.36} />
          <mesh position={[0, 0.95, 0]}>
            <RoundedBox args={[2.28, 1.06, 1.5]} radius={0.34} smoothness={5} castShadow>
              <meshStandardMaterial color={palette.roof} transparent opacity={0.48} roughness={0.2} metalness={0.1} />
            </RoundedBox>
          </mesh>
          <mesh position={[0, 1.48, 0]}>
            <boxGeometry args={[2.36, 0.08, 1.58]} />
            <meshStandardMaterial color={palette.accent} emissive={palette.glow} emissiveIntensity={0.2} metalness={0.36} roughness={0.3} />
          </mesh>
          {[-0.72, -0.24, 0.24, 0.72].map((x) => (
            <group key={x} position={[x, 0.82, 0]}>
              <mesh>
                <cylinderGeometry args={[0.06, 0.075, 0.5, 7]} />
                <meshStandardMaterial color="#6a523d" roughness={0.92} />
              </mesh>
              <mesh position={[0, 0.34, 0]}>
                <sphereGeometry args={[0.13, 10, 8]} />
                <meshStandardMaterial color="#7df58b" emissive="#30d75c" emissiveIntensity={0.52} roughness={0.82} />
              </mesh>
            </group>
          ))}
        </group>
      );

    case "navigation":
      return (
        <group>
          <BuildingBase color={palette.body} width={1.8} depth={1.7} height={0.34} />
          <mesh position={[0, 1.02, 0]}>
            <cylinderGeometry args={[0.13, 0.2, 1.85, 10]} />
            <meshStandardMaterial color="#dbe2dd" metalness={0.68} roughness={0.21} />
          </mesh>
          <mesh position={[0, 1.66, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.64, 0.065, 8, 28]} />
            <meshStandardMaterial color={palette.accent} emissive={palette.glow} emissiveIntensity={0.5} metalness={0.36} roughness={0.22} />
          </mesh>
          <mesh position={[0, 2.14, 0]}>
            <octahedronGeometry args={[0.23, 1]} />
            <meshStandardMaterial color="#f0c85d" emissive="#ffbd22" emissiveIntensity={0.84} metalness={0.2} roughness={0.18} />
          </mesh>
          {[-0.45, 0.45].map((x) => (
            <mesh key={x} position={[x, 0.72, 0.28]} rotation={[0, 0, x * 0.2]}>
              <RoundedBox args={[0.35, 0.72, 0.08]} radius={0.05} smoothness={3}>
                <meshStandardMaterial color="#697574" metalness={0.45} roughness={0.34} />
              </RoundedBox>
            </mesh>
          ))}
        </group>
      );

    case "thermal":
      return (
        <group>
          <BuildingBase color={palette.body} width={2.3} depth={1.9} height={0.36} />
          {[-0.64, 0, 0.64].map((x) => (
            <group key={x} position={[x, 0.92, 0]}>
              <mesh castShadow rotation={[0.18, 0, -0.28]}>
                <RoundedBox args={[0.42, 0.1, 1.44]} radius={0.05} smoothness={3}>
                  <meshStandardMaterial color="#7d8e91" roughness={0.38} metalness={0.42} />
                </RoundedBox>
              </mesh>
              {[-0.42, -0.14, 0.14, 0.42].map((z) => (
                <mesh key={z} position={[0, 0.06, z]} rotation={[0.18, 0, -0.28]}>
                  <boxGeometry args={[0.46, 0.024, 0.035]} />
                  <meshStandardMaterial color={palette.accent} emissive={palette.glow} emissiveIntensity={0.38} />
                </mesh>
              ))}
            </group>
          ))}
          <mesh position={[0, 1.3, -0.62]}>
            <cylinderGeometry args={[0.07, 0.1, 1.1, 8]} />
            <meshStandardMaterial color="#d7dfda" metalness={0.68} roughness={0.22} />
          </mesh>
        </group>
      );

    case "grid":
      return (
        <group>
          <BuildingBase color={palette.body} width={2.35} depth={1.92} height={0.4} />
          {[[-0.7, 0.52], [0.7, 0.52]].map(([x, z], index) => (
            <group key={index} position={[x, 0, z]}>
              <RoundedBox args={[0.6, 0.84, 0.6]} radius={0.12} smoothness={4} castShadow>
                <meshStandardMaterial color="#6a7777" roughness={0.48} metalness={0.28} />
              </RoundedBox>
              <mesh position={[0, 0.5, 0]}>
                <sphereGeometry args={[0.1, 10, 8]} />
                <meshStandardMaterial color={palette.accent} emissive={palette.glow} emissiveIntensity={0.72} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 1.25, 0]}>
            <cylinderGeometry args={[0.16, 0.2, 1.1, 8]} />
            <meshStandardMaterial color="#d5dcd8" metalness={0.68} roughness={0.22} />
          </mesh>
          <mesh position={[0, 1.8, 0]}>
            <octahedronGeometry args={[0.26, 1]} />
            <meshStandardMaterial color="#58e7ef" emissive="#1ecbd6" emissiveIntensity={1} metalness={0.15} roughness={0.18} />
          </mesh>
        </group>
      );

    case "maintenance":
      return (
        <group>
          <BuildingBase color={palette.body} width={2.38} depth={2.0} height={0.4} />
          <RoundedBox args={[1.72, 1.18, 1.42]} radius={0.28} smoothness={5} position={[0, 0.95, 0]} castShadow>
            <meshStandardMaterial color="#596568" roughness={0.64} metalness={0.22} />
          </RoundedBox>
          <mesh position={[0, 1.72, 0]}>
            <sphereGeometry args={[0.93, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial color="#748487" roughness={0.42} metalness={0.24} />
          </mesh>
          <mesh position={[0, 1.12, 0.74]}>
            <RoundedBox args={[1.15, 0.54, 0.06]} radius={0.09} smoothness={3}>
              <meshStandardMaterial color="#26363a" emissive="#102126" emissiveIntensity={0.5} />
            </RoundedBox>
          </mesh>
          {[-0.62, 0.62].map((x) => (
            <mesh key={x} position={[x, 0.83, 0.8]}>
              <cylinderGeometry args={[0.075, 0.09, 0.52, 8]} />
              <meshStandardMaterial color={palette.accent} emissive={palette.glow} emissiveIntensity={0.4} metalness={0.25} roughness={0.24} />
            </mesh>
          ))}
        </group>
      );

    default:
      return (
        <group>
          <BuildingBase color={palette.body} width={1.95} depth={1.7} height={0.38} />
          <DomeStructure color={color} glass="#6f9da2" />
        </group>
      );
  }
}

function FunctionalBuildingMotion({
  id,
  color,
}: {
  id: string;
  color: string;
}) {
  const primaryRef = useRef<THREE.Group>(null);
  const secondaryRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (primaryRef.current) {
      if (id === "solar") primaryRef.current.rotation.z = Math.sin(t * 0.18) * 0.12;
      else if (id === "comms") primaryRef.current.rotation.y = Math.sin(t * 0.22) * 0.34;
      else if (id === "navigation") primaryRef.current.rotation.z = t * 0.52;
      else if (id === "grid") primaryRef.current.rotation.y = t * 0.75;
      else if (id === "science") primaryRef.current.rotation.y = t * 0.26;
      else if (id === "extraction" || id === "isru") primaryRef.current.rotation.y = t * 1.15;
      else primaryRef.current.rotation.y = Math.sin(t * 0.35) * 0.06;
    }
    if (secondaryRef.current) {
      const pulse = 0.86 + (Math.sin(t * 2.8) + 1) * 0.08;
      secondaryRef.current.scale.setScalar(pulse);
    }
  });

  if (id === "solar") {
    return (
      <group ref={primaryRef} position={[0, 0.9, 0]}>
        <mesh rotation={[0, 0, 0.24]}>
          <boxGeometry args={[2.2, 0.035, 0.055]} />
          <meshStandardMaterial color="#b7c4c1" metalness={0.7} roughness={0.25} />
        </mesh>
      </group>
    );
  }

  if (id === "comms") {
    return (
      <group ref={primaryRef} position={[0, 1.72, 0]}>
        <mesh>
          <torusGeometry args={[0.57, 0.022, 6, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.72} />
        </mesh>
      </group>
    );
  }

  if (id === "navigation") {
    return (
      <group ref={primaryRef} position={[0, 1.72, 0]}>
        <mesh>
          <torusGeometry args={[0.63, 0.025, 6, 24]} />
          <meshBasicMaterial color="#ff69d8" transparent opacity={0.78} />
        </mesh>
      </group>
    );
  }

  if (id === "extraction" || id === "isru") {
    return (
      <group ref={primaryRef} position={[0, 1.2, 0]}>
        <mesh>
          <coneGeometry args={[0.22, 0.82, 8]} />
          <meshStandardMaterial color="#dbe0dc" metalness={0.72} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <torusGeometry args={[0.17, 0.035, 6, 20]} />
          <meshBasicMaterial color={color} transparent opacity={0.75} />
        </mesh>
      </group>
    );
  }

  if (id === "battery" || id === "agriculture" || id === "oxygen" || id === "water") {
    return (
      <group ref={secondaryRef} position={[0, id === "battery" ? 1.42 : 1.28, 0]}>
        <mesh>
          <octahedronGeometry args={[0.12, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} metalness={0.22} roughness={0.2} />
        </mesh>
      </group>
    );
  }

  if (id === "thermal") {
    return (
      <group ref={primaryRef} position={[0, 1.08, 0]}>
        {[0, 1, 2].map((index) => {
          const angle = (index / 3) * Math.PI * 2;
          return (
            <mesh key={index} position={[Math.cos(angle) * 0.18, Math.sin(angle) * 0.18, 0]}>
              <boxGeometry args={[0.33, 0.05, 0.035]} />
              <meshStandardMaterial color="#d8dfda" metalness={0.6} roughness={0.22} />
            </mesh>
          );
        })}
      </group>
    );
  }

  return null;
}

function BuildingIdleMotion({
  color,
  level,
  active,
  id,
}: {
  color: string;
  level: number;
  active: boolean;
  id: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 1.2 + level * 0.6) * 0.018;
    }
    if (beaconRef.current) {
      beaconRef.current.rotation.y = t * (id === "comms" ? 0.32 : 0.78);
      const pulse = active ? 1.23 + (Math.sin(t * 5) + 1) * 0.05 : 0.94 + (Math.sin(t * 2.4 + level) + 1) * 0.025;
      beaconRef.current.scale.setScalar(pulse);
      const mat = beaconRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = active ? 1.7 : 0.55 + level * 0.12;
    }
  });

  return (
    <group ref={groupRef} scale={0.52}>
      <mesh ref={beaconRef} position={[0, id === "habitat" ? 3.85 : 2.3, 0]}>
        <octahedronGeometry args={[0.075 + level * 0.018, 0]} />
        <meshStandardMaterial color={active ? "#fff16c" : color} emissive={active ? "#ffb735" : color} emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

function HumanSettler({
  route,
  index,
  carry,
  mars,
}: {
  route: Array<[number, number]>;
  index: number;
  carry: boolean;
  mars: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);

  const suitColors = ["#70c8d8", "#e4ba60", "#d17c68", "#83b97d", "#9c8ed2", "#6aa4ca"];
  const suitColor = suitColors[index % suitColors.length];
  const helmetColor = mars ? (index % 3 === 0 ? "#d48a67" : "#b9c1be") : (index % 3 === 0 ? "#dbb55b" : "#bcc6c7");

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * (0.82 + (index % 5) * 0.035);
    const progress = (t * 0.2 + index * 0.11) % route.length;
    const routeIndex = Math.floor(progress);
    const phase = progress - routeIndex;
    const nextIndex = (routeIndex + 1) % route.length;
    const [ax, az] = route[routeIndex];
    const [bx, bz] = route[nextIndex];
    const x = THREE.MathUtils.lerp(ax, bx, phase);
    const z = THREE.MathUtils.lerp(az, bz, phase);
    const dx = bx - ax;
    const dz = bz - az;

    if (groupRef.current) {
      groupRef.current.position.set(x, terrainHeight(x, z) + 0.31, z);
      if (Math.abs(dx) + Math.abs(dz) > 0.01) groupRef.current.rotation.y = Math.atan2(dx, dz);
    }

    const stride = Math.sin(t * 8.0 + index);
    const armSwing = stride * 0.3;
    if (leftArmRef.current) leftArmRef.current.rotation.x = armSwing;
    if (rightArmRef.current) rightArmRef.current.rotation.x = -armSwing;
    if (leftLegRef.current) leftLegRef.current.rotation.x = -stride * 0.34;
    if (rightLegRef.current) rightLegRef.current.rotation.x = stride * 0.34;
  });

  return (
    <group ref={groupRef} scale={0.43}>
      <mesh castShadow position={[0, 0.44, 0]}>
        <capsuleGeometry args={[0.125, 0.27, 4, 8]} />
        <meshStandardMaterial color={suitColor} roughness={0.84} />
      </mesh>
      <mesh castShadow position={[0, 0.73, 0]}>
        <sphereGeometry args={[0.12, 14, 10]} />
        <meshStandardMaterial color={helmetColor} roughness={0.72} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.73, 0.101]}>
        <RoundedBox args={[0.13, 0.058, 0.018]} radius={0.02} smoothness={2}>
          <meshStandardMaterial color={index % 2 ? "#6fe9f1" : "#f3cf63"} emissive={index % 2 ? "#238c95" : "#8e6513"} emissiveIntensity={0.26} metalness={0.22} roughness={0.24} />
        </RoundedBox>
      </mesh>
      <mesh castShadow position={[0, 0.34, -0.1]}>
        <boxGeometry args={[0.22, 0.24, 0.12]} />
        <meshStandardMaterial color="#465459" roughness={0.84} metalness={0.18} />
      </mesh>
      <group ref={leftArmRef} position={[-0.16, 0.49, 0]}>
        <mesh castShadow position={[0, -0.13, 0]}>
          <capsuleGeometry args={[0.035, 0.2, 3, 6]} />
          <meshStandardMaterial color={suitColor} roughness={0.84} />
        </mesh>
        <mesh castShadow position={[0, -0.25, 0]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <meshStandardMaterial color={suitColor} roughness={0.84} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.16, 0.49, 0]}>
        <mesh castShadow position={[0, -0.13, 0]}>
          <capsuleGeometry args={[0.035, 0.2, 3, 6]} />
          <meshStandardMaterial color={suitColor} roughness={0.84} />
        </mesh>
        <mesh castShadow position={[0, -0.25, 0]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <meshStandardMaterial color={suitColor} roughness={0.84} />
        </mesh>
      </group>
      <group ref={leftLegRef} position={[-0.07, 0.2, 0]}>
        <mesh castShadow position={[0, -0.1, 0]}>
          <capsuleGeometry args={[0.042, 0.18, 3, 6]} />
          <meshStandardMaterial color="#313a40" roughness={0.92} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.07, 0.2, 0]}>
        <mesh castShadow position={[0, -0.1, 0]}>
          <capsuleGeometry args={[0.042, 0.18, 3, 6]} />
          <meshStandardMaterial color="#313a40" roughness={0.92} />
        </mesh>
      </group>
      {carry && (
        <RoundedBox args={[0.22, 0.18, 0.2]} radius={0.04} smoothness={2} position={[0.24, 0.53, 0.14]}>
          <meshStandardMaterial color="#c79958" roughness={0.9} metalness={0.06} />
        </RoundedBox>
      )}
    </group>
  );
}

const CREW_ROUTES: Array<Array<[number, number]>> = [
  OUTER_ROAD,
  [[-15.8, 6.75], [-8.65, 6.75], [-8.65, 13.8], [-8.65, 6.75], [0.25, 6.75], [0.25, 1.6], [0.25, -0.75], [-8.65, -0.75], [-15.8, -0.75], [-15.8, 6.75]],
  [[-8.65, -14.5], [-8.65, -8.25], [-8.65, -0.75], [-8.65, 6.75], [-8.65, 13.8], [0.25, 13.8], [0.25, 6.75], [0.25, -0.75], [0.25, -8.25], [0.25, -14.5], [-8.65, -14.5]],
  [[8.5, -14.5], [8.5, -8.25], [8.5, -0.75], [8.5, 6.75], [8.5, 13.8], [15.8, 13.8], [15.8, 6.75], [8.5, 6.75], [8.5, -0.75], [15.8, -0.75], [15.8, -8.25], [8.5, -8.25], [8.5, -14.5]],
  [[-15.8, -8.25], [-8.65, -8.25], [0.25, -8.25], [8.5, -8.25], [15.8, -8.25], [15.8, -14.5], [8.5, -14.5], [0.25, -14.5], [-8.65, -14.5], [-15.8, -14.5], [-15.8, -8.25]],
  [[-15.8, 13.8], [-8.65, 13.8], [-0.5, 13.8], [8.5, 13.8], [15.8, 13.8], [15.8, 6.75], [8.5, 6.75], [-0.5, 6.75], [-8.65, 6.75], [-15.8, 6.75], [-15.8, 13.8]],
];

function SettlerCrowd({ mars }: { mars: boolean }) {
  return (
    <group>
      {Array.from({ length: mars ? 9 : 6 }, (_, index) => (
        <HumanSettler
          key={index}
          route={CREW_ROUTES[index % CREW_ROUTES.length]}
          index={index}
          carry={index % 4 === 0}
          mars={mars}
        />
      ))}
    </group>
  );
}

function CivicPlazaStatue(function CivicPlazaStatue({ position, mars }: { position: [number, number]; mars: boolean }) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.06;
  const glowRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (glowRef.current) {
      const t = clock.getElapsedTime();
      glowRef.current.scale.setScalar(0.94 + (Math.sin(t * 2.2) + 1) * 0.035);
    }
  });
  return (
    <group position={[x, y, z]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.15, 32]} />
        <meshStandardMaterial color={mars ? "#75483a" : "#5b686b"} roughness={0.92} />
      </mesh>
      <mesh castShadow position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.3, 0.42, 0.72, 10]} />
        <meshStandardMaterial color="#657174" roughness={0.58} metalness={0.28} />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0]}>
        <coneGeometry args={[0.25, 0.55, 8]} />
        <meshStandardMaterial color={mars ? "#d89067" : "#6dd3d9"} emissive={mars ? "#713825" : "#248993"} emissiveIntensity={0.32} />
      </mesh>
      <mesh ref={glowRef} position={[0, 1.48, 0]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#fff0a2" emissive="#ffc62f" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function ColonyBanner({ position, accent, mars }: { position: [number, number]; accent: string; mars: boolean }) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.02;
  return (
    <group position={[x, y, z]}>
      <mesh castShadow position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.035, 0.05, 1.25, 8]} />
        <meshStandardMaterial color={mars ? "#725046" : "#626e70"} metalness={0.5} roughness={0.46} />
      </mesh>
      <mesh position={[0.22, 0.85, 0]}>
        <boxGeometry args={[0.42, 0.28, 0.035]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.25} roughness={0.5} />
      </mesh>
      <mesh position={[0.22, 0.85, 0.022]}>
        <boxGeometry args={[0.16, 0.13, 0.01]} />
        <meshStandardMaterial color={mars ? "#ffd18c" : "#173039"} emissive={mars ? "#7e5128" : "#0d5661"} emissiveIntensity={0.18} />
      </mesh>
    </group>
  );
}

function WorkshopYard({ position, index }: { position: [number, number]; index: number }) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.04;
  return (
    <group position={[x, y, z]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.25, 1.65]} />
        <meshStandardMaterial color={index % 2 ? "#565f60" : "#5e6667"} roughness={0.97} />
      </mesh>
      <mesh castShadow position={[-0.58, 0.32, -0.18]}>
        <boxGeometry args={[0.62, 0.52, 0.5]} />
        <meshStandardMaterial color={index % 2 ? "#6f8f8b" : "#bc8f50"} roughness={0.86} />
      </mesh>
      <mesh castShadow position={[0.36, 0.25, 0.34]}>
        <boxGeometry args={[0.42, 0.38, 0.42]} />
        <meshStandardMaterial color={index % 2 ? "#c69450" : "#738b88"} roughness={0.86} />
      </mesh>
      <mesh position={[0.56, 0.52, -0.36]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.16, 10]} />
        <meshStandardMaterial color="#2d383b" roughness={0.88} />
      </mesh>
      <mesh position={[-0.06, 0.25, 0.2]}>
        <boxGeometry args={[0.7, 0.08, 0.08]} />
        <meshStandardMaterial color="#a3afac" metalness={0.5} roughness={0.42} />
      </mesh>
    </group>
  );
}


function UrbanBlock({
  position,
  width = 2.5,
  depth = 2.0,
  accent = "#67c4ca",
  mars = false,
}: {
  position: [number, number];
  width?: number;
  depth?: number;
  accent?: string;
  mars?: boolean;
}) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.035;
  return (
    <group position={[x, y, z]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={mars ? "#754b3e" : "#566366"} roughness={0.98} />
      </mesh>
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.min(width, depth) * 0.38, Math.min(width, depth) * 0.41, 4]} />
        <meshBasicMaterial color={accent} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function ColonyMonument({ position, color }: {
  position: [number, number];
  color: string;
}) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.05;
  const coreRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!coreRef.current) return;
    coreRef.current.rotation.y = clock.getElapsedTime() * 0.32;
  });
  return (
    <group position={[x, y, z]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 32]} />
        <meshStandardMaterial color="#586568" roughness={0.93} />
      </mesh>
      <mesh castShadow position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.28, 0.38, 0.56, 10]} />
        <meshStandardMaterial color="#737f80" metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 0.84, 0]}>
        <coneGeometry args={[0.28, 0.62, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.32} metalness={0.2} roughness={0.4} />
      </mesh>
      <mesh ref={coreRef} position={[0, 1.32, 0]}>
        <octahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial color="#fff0a2" emissive="#ffc21f" emissiveIntensity={1.1} />
      </mesh>
    </group>
  );
}

function GoldArchitecturalTrim({
  id,
  color,
}: {
  id: string;
  color: string;
}) {
  if (id === "solar" || id === "rover") return null;
  const wide = id === "habitat" || id === "extraction" || id === "isru" || id === "agriculture";
  const width = wide ? 1.55 : 1.22;
  const depth = wide ? 1.18 : 0.92;
  return (
    <group>
      <mesh position={[0, wide ? 1.06 : 0.98, 0]}>
        <boxGeometry args={[width, 0.055, depth]} />
        <meshStandardMaterial color="#d9a83d" metalness={0.72} roughness={0.24} />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], index) => (
        <group key={index} position={[sx * width * 0.45, 0.97, sz * depth * 0.43]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.045, 0.06, 0.28, 8]} />
            <meshStandardMaterial color="#f0c65a" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <sphereGeometry args={[0.052, 10, 8]} />
            <meshStandardMaterial color="#ffe38a" emissive="#b77a10" emissiveIntensity={0.5} metalness={0.72} roughness={0.18} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, wide ? 1.31 : 1.24, 0]}>
        <coneGeometry args={[0.16, 0.24, 6]} />
        <meshStandardMaterial color="#e5b74a" metalness={0.78} roughness={0.2} emissive={color} emissiveIntensity={0.08} />
      </mesh>
    </group>
  );
}

function GildedRoadMarker({ position, color }: {
  position: [number, number];
  color: string;
}) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.05;
  return (
    <group position={[x, y, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.06, 0.09, 0.46, 8]} />
        <meshStandardMaterial color="#c99431" metalness={0.78} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <octahedronGeometry args={[0.11, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} metalness={0.55} roughness={0.22} />
      </mesh>
    </group>
  );
}

function GoldenCivicArch({ position, color }: {
  position: [number, number];
  color: string;
}) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.05;
  return (
    <group position={[x, y, z]}>
      {[-0.72, 0.72].map((px) => (
        <group key={px} position={[px, 0.7, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.18, 1.42, 0.18]} />
            <meshStandardMaterial color="#c99835" metalness={0.76} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <sphereGeometry args={[0.105, 10, 8]} />
            <meshStandardMaterial color="#ffe18a" emissive="#bd7f13" emissiveIntensity={0.7} metalness={0.72} roughness={0.18} />
          </mesh>
        </group>
      ))}
      <mesh castShadow position={[0, 1.38, 0]}>
        <boxGeometry args={[1.65, 0.18, 0.2]} />
        <meshStandardMaterial color="#dcae44" metalness={0.8} roughness={0.18} />
      </mesh>
      <mesh position={[0, 1.62, 0]}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

function BuildingDetailTrim({
  id,
  color,
  mars,
}: {
  id: string;
  color: string;
  mars: boolean;
}) {
  const size = id === "habitat" ? 3.0 : id === "extraction" || id === "isru" ? 2.65 : 2.2;
  const materialColor = mars ? "#77645c" : "#707b7d";
  return (
    <group>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size, size * 0.82]} />
        <meshStandardMaterial color={materialColor} roughness={0.96} transparent opacity={0.78} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (size * 0.4), 0.27, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.09, 0.5, size * 0.48]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.22} metalness={0.28} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.28, 0]}>
            <sphereGeometry args={[0.065, 8, 6]} />
            <meshStandardMaterial color="#ffe18a" emissive="#ffb91d" emissiveIntensity={0.85} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.23, size * 0.38]}>
        <boxGeometry args={[0.58, 0.38, 0.05]} />
        <meshStandardMaterial color="#202a2e" roughness={0.55} metalness={0.35} />
      </mesh>
    </group>
  );
}



function LandingPad({ mars }: { mars: boolean }) {
  const y = terrainHeight(0, -20.0) + 0.08;
  const base = mars ? "#93604b" : "#85847d";
  const markings = mars ? "#e0ae8d" : "#d8d1bf";
  return (
    <group position={[0, y, -20.0]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[4.4, 4.65, 0.16, 16]} />
        <meshStandardMaterial color={base} roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.45, 3.52, 32]} />
        <meshBasicMaterial color={markings} />
      </mesh>
      <mesh position={[0, 0.092, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 0.78, 16]} />
        <meshBasicMaterial color={markings} />
      </mesh>
      {[0,1,2,3,4,5,6,7].map((index) => {
        const a = (index / 8) * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(a) * 3.86, 0.14, Math.sin(a) * 3.86]}>
            <sphereGeometry args={[0.08, 8, 6]} />
            <meshStandardMaterial color="#ffd56b" emissive="#ffb929" emissiveIntensity={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

function RegolithBerm({ mars }: { mars: boolean }) {
  const color = mars ? "#754638" : "#64615b";
  return (
    <group>
      {[[-12.6,-11.4],[12.6,-11.4],[-12.7,11.8],[12.7,11.8]].map(([x,z],index)=>( 
        <mesh key={index} castShadow receiveShadow position={[x,terrainHeight(x,z)+0.42,z]} rotation={[0,index%2?0.18:-0.18,0]}>
          <coneGeometry args={[2.1,0.84,7]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function UtilityCable({ from, to }: { from: [number, number]; to: [number, number] }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const mx = (from[0] + to[0]) / 2;
  const mz = (from[1] + to[1]) / 2;
  return (
    <mesh position={[mx, terrainHeight(mx, mz) + 0.11, mz]} rotation={[0, angle, 0]}>
      <cylinderGeometry args={[0.035, 0.035, length, 7]} />
      <meshStandardMaterial color="#252d30" roughness={0.48} metalness={0.68} />
    </mesh>
  );
}
function CityFloor({ mars }: { mars: boolean }) {
  const ground = mars ? "#8f5847" : "#76746f";
  const inset = mars ? "#a96b55" : "#898780";
  return (
    <group>
      <mesh receiveShadow position={[0, terrainHeight(0, 0) + 0.046, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.12, 1, 1]}>
        <circleGeometry args={[22.8, 96]} />
        <meshStandardMaterial color={ground} roughness={1} />
      </mesh>
      <mesh receiveShadow position={[0, terrainHeight(0, 0) + 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.08, 1, 1]}>
        <circleGeometry args={[20.7, 96]} />
        <meshStandardMaterial color={inset} roughness={0.99} />
      </mesh>
      <mesh position={[0, terrainHeight(0, 0) + 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.08, 1, 1]}>
        <ringGeometry args={[20.55, 20.78, 96]} />
        <meshStandardMaterial color={mars ? "#c6876d" : "#aaa49b"} roughness={0.98} transparent opacity={0.24} />
      </mesh>
    </group>
  );
}

function Archway(function Archway({ position, color }: { position: [number, number]; color: string }) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.04;
  return (
    <group position={[x, y, z]}>
      <mesh castShadow position={[-0.55, 0.7, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 1.38, 10]} />
        <meshStandardMaterial color="#778281" metalness={0.32} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0.55, 0.7, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 1.38, 10]} />
        <meshStandardMaterial color="#778281" metalness={0.32} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 1.33, 0]}>
        <boxGeometry args={[1.24, 0.18, 0.18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.22} metalness={0.22} roughness={0.42} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial color="#ffe18a" emissive="#ffbf28" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

function StatueRow({ z, color }: { z: number; color: string }) {
  const points = [-6.8, -4.6, 4.6, 6.8];
  return (
    <group>
      {points.map((x, index) => (
        <group key={index} position={[x, terrainHeight(x, z) + 0.04, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.14, 0.2, 0.38, 10]} />
            <meshStandardMaterial color="#697474" metalness={0.22} roughness={0.62} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <coneGeometry args={[0.17, 0.36, 6]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CargoCart({ position, mars }: { position: [number, number]; mars: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.1;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = y + Math.sin(clock.getElapsedTime() * 2.2 + x) * 0.018;
  });
  return (
    <group ref={ref} position={[x, y, z]}>
      <mesh castShadow>
        <boxGeometry args={[0.8, 0.3, 0.55]} />
        <meshStandardMaterial color={mars ? "#c77f55" : "#c8a05d"} roughness={0.86} />
      </mesh>
      <mesh position={[0.08, 0.28, 0]}>
        <boxGeometry args={[0.56, 0.28, 0.42]} />
        <meshStandardMaterial color="#788b88" roughness={0.84} metalness={0.12} />
      </mesh>
      {[-0.3, 0.3].map((wheel) => (
        <mesh key={wheel} castShadow position={[wheel, -0.14, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.11, 10]} />
          <meshStandardMaterial color="#2d3538" roughness={0.94} />
        </mesh>
      ))}
    </group>
  );
}

function RoverWorld({
  task,
  position,
  resourceNodes,
  selected,
  alerted,
  onClick,
}: {
  task: string;
  position: [number, number];
  resourceNodes: MissionResourceNode[];
  selected: boolean;
  alerted: boolean;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const scannerRef = useRef<THREE.Mesh>(null);
  const home = position;
  const targetName = task.startsWith("SURVEYING ") ? task.slice("SURVEYING ".length) : "";
  const resource = resourceNodes.find((node) => node.label === targetName);
  const destination = resource ? nodeWorldPosition(resource) : home;

  const roverWaypoints = useMemo<[number, number][]>(() => {
    if (!resource) return [home, [home[0], -14.5], [15.8, -14.5], [15.8, home[1]]];
    const [dx, dz] = destination;
    const exitX = dx < 0 ? -15.8 : 15.8;
    const approachZ = Math.abs(dz) > 12 ? (dz < 0 ? -14.5 : 13.8) : (dz >= 0 ? 6.75 : -8.25);
    return [
      home,
      [home[0], -14.5],
      [exitX, -14.5],
      [exitX, approachZ],
      [dx < 0 ? Math.max(-15.8, dx) : Math.min(15.8, dx), approachZ],
      destination,
    ];
  }, [destination, home, resource]);

  const roverPathLengths = useMemo(() => {
    const lengths: number[] = [];
    let total = 0;
    for (let index = 0; index < roverWaypoints.length - 1; index += 1) {
      const [ax, az] = roverWaypoints[index];
      const [bx, bz] = roverWaypoints[index + 1];
      const length = Math.hypot(bx - ax, bz - az);
      lengths.push(length);
      total += length;
    }
    return { lengths, total };
  }, [roverWaypoints]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const active = task !== "STANDBY" && task !== "RETURNING";
    const path = task === "RETURNING" ? [...roverWaypoints].reverse() : roverWaypoints;
    const total = roverPathLengths.total;
    const progress = active ? (Math.sin(t * 0.24) + 1) / 2 : 0;
    const targetDistance = progress * total;
    let travelled = 0;
    let segment = 0;
    while (segment < path.length - 2) {
      const segmentLength = Math.hypot(path[segment + 1][0] - path[segment][0], path[segment + 1][1] - path[segment][1]);
      if (travelled + segmentLength >= targetDistance) break;
      travelled += segmentLength;
      segment += 1;
    }
    const [ax, az] = path[segment];
    const [bx, bz] = path[segment + 1] ?? path[segment];
    const segmentLength = Math.max(0.001, Math.hypot(bx - ax, bz - az));
    const segmentPhase = THREE.MathUtils.clamp((targetDistance - travelled) / segmentLength, 0, 1);
    const x = THREE.MathUtils.lerp(ax, bx, segmentPhase);
    const z = THREE.MathUtils.lerp(az, bz, segmentPhase);
    const lookX = THREE.MathUtils.lerp(x, bx, 0.18);
    const lookZ = THREE.MathUtils.lerp(z, bz, 0.18);

    ref.current.position.set(x, terrainHeight(x, z) + 0.43, z);
    if (Math.abs(lookX - x) + Math.abs(lookZ - z) > 0.03) ref.current.rotation.y = Math.atan2(lookX - x, lookZ - z);

    if (scannerRef.current) {
      const atSite = !!resource && Math.hypot(x - destination[0], z - destination[1]) < 1.15;
      scannerRef.current.scale.setScalar(atSite ? 0.9 + (Math.sin(t * 5) + 1) * 0.2 : 0.18);
      (scannerRef.current.material as THREE.MeshBasicMaterial).opacity = atSite ? 0.65 : 0.06;
    }
  });

  const showRoute = resource && task !== "STANDBY";
  const routeEndpoint = roverWaypoints[roverWaypoints.length - 2] ?? home;

  return (
    <group>
      {showRoute && (
        <PathStrip points={[routeEndpoint, destination]} width={0.68} mars={false} />
      )}
      <group
        ref={ref}
        position={[position[0], terrainHeight(position[0], position[1]) + 0.43, position[1]]}
        onClick={(event) => { event.stopPropagation(); onClick(); }}
      >
        <SelectionRing selected={selected} alerted={alerted} radius={1.06} />
        <mesh castShadow>
          <boxGeometry args={[1.35, 0.32, 0.9]} />
          <meshStandardMaterial color="#e7c76a" roughness={0.64} metalness={0.3} />
        </mesh>
        <mesh castShadow position={[0, 0.36, 0]}>
          <boxGeometry args={[0.42, 0.46, 0.42]} />
          <meshStandardMaterial color="#20dbe4" emissive="#0ec9d2" emissiveIntensity={0.5} />
        </mesh>
        {[[-0.49, -0.32], [-0.49, 0.32], [0.49, -0.32], [0.49, 0.32]].map(([x, z]) => (
          <mesh key={String(x) + String(z)} castShadow position={[x, -0.18, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.16, 12]} />
            <meshStandardMaterial color="#24282c" roughness={0.91} />
          </mesh>
        ))}
        <mesh position={[0.4, 0.53, 0]}>
          <boxGeometry args={[0.07, 0.07, 0.68]} />
          <meshStandardMaterial color="#ffd958" emissive="#ffbd18" emissiveIntensity={0.5} />
        </mesh>
        <mesh ref={scannerRef} position={[0, -0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.58, 0.86, 28]} />
          <meshBasicMaterial color="#52e7ff" transparent opacity={0.06} />
        </mesh>
      </group>
    </group>
  );
}

function SelectionRing(function SelectionRing({
  selected,
  alerted,
  radius,
}: {
  selected: boolean;
  alerted: boolean;
  radius: number;
}) {
  if (!selected && !alerted) return null;
  return (
    <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius, radius + 0.15, 36]} />
      <meshBasicMaterial color={alerted ? "#ff4b55" : "#ffe36d"} />
    </mesh>
  );
}

function TaskMarker({
  position,
  label,
  color,
}: {
  position: [number, number];
  label: string;
  color: string;
}) {
  const ref = useRef<THREE.Group>(null);
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.16;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.position.y = y + Math.sin(t * 2.8) * 0.05;
    const scale = 0.9 + (Math.sin(t * 3.4) + 1) * 0.04;
    ref.current.scale.setScalar(scale);
  });
  return (
    <group ref={ref} position={[x, y, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.62, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.72} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      <Text position={[0, 0.64, 0]} rotation={[-0.66, 0, 0]} fontSize={0.16} color="#ffeaa0" outlineWidth={0.025} outlineColor="#1d1915" anchorX="center">
        {label}
      </Text>
    </group>
  );
}

function ResourceMarker({
  node,
  surveyed,
  selected,
  onClick,
}: {
  node: MissionResourceNode;
  surveyed: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const [x, z] = nodeWorldPosition(node);
  const y = terrainHeight(x, z);
  const color = node.kind === "ICE" ? "#5de5ff" : node.kind === "MINERAL" ? "#ffd25d" : node.kind === "SCIENCE" ? "#cf8fff" : "#b49e82";

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.scale.setScalar(selected ? 1.08 + (Math.sin(t * 4) + 1) * 0.04 : 0.98 + (Math.sin(t * 2.2 + x) + 1) * 0.018);
  });

  return (
    <group ref={ref} position={[x, y + 0.4, z]} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      <mesh castShadow>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.88 : 0.44} roughness={0.34} metalness={0.14} />
      </mesh>
      <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, selected ? 0.77 : 0.65, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.82} />
      </mesh>
      {selected && (
        <Text position={[0, 0.72, 0]} rotation={[-0.66, 0, 0]} fontSize={0.18} color="#fff2c0" outlineWidth={0.025} outlineColor="#3b2c20" anchorX="center">
          {surveyed ? "SURVEYED" : node.label}
        </Text>
      )}
    </group>
  );
}

function ColonyLighting({ mars }: { mars: boolean }) {
  const refs = useRef<THREE.Mesh[]>([]);
  const positions: Array<[number, number]> = [
    [-13.5, -11.7],
    [-7.2, -8.1],
    [5.2, -4.0],
    [12.1, -8.8],
    [-12.8, 0.6],
    [11.7, 4.5],
    [-9.3, 10.9],
    [7.2, 12.9],
    [-2.6, 7.2],
    [3.0, 6.3],
  ];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((mesh, index) => {
      if (!mesh) return;
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.74 + (Math.sin(t * 2 + index * 0.7) + 1) * 0.11;
    });
  });

  return (
    <group>
      {positions.map(([x, z], index) => {
        const y = terrainHeight(x, z) + 0.4;
        return (
          <group key={index} position={[x, y, z]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.045, 0.07, 0.66, 8]} />
              <meshStandardMaterial color={mars ? "#695954" : "#596668"} metalness={0.45} roughness={0.48} />
            </mesh>
            <mesh ref={(node) => { if (node) refs.current[index] = node; }} position={[0, 0.44, 0]}>
              <sphereGeometry args={[0.075, 10, 8]} />
              <meshStandardMaterial color="#ffdf7a" emissive="#ffbf2b" emissiveIntensity={1} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function ColonyBuilding({
  track,
  tier,
  runtime,
  selected,
  alerted,
  position,
  roverTask,
  resourceNodes,
  onClick,
}: {
  track: TechnologyTrack;
  tier: Tier;
  runtime: BuildingRuntime;
  selected: boolean;
  alerted: boolean;
  position: [number, number];
  roverTask: string;
  resourceNodes: MissionResourceNode[];
  onClick: () => void;
}) {
  const y = terrainHeight(position[0], position[1]);
  const color = tierColor(tier);
  const level = tier === "Foundation" ? 0 : tier === "Frontier" ? 1 : tier === "Apex" ? 2 : 3;

  if (track.id === "rover") {
    return (
      <group>
        <RoverWorld
          task={roverTask}
          position={position}
          resourceNodes={resourceNodes}
          selected={selected}
          alerted={alerted}
          onClick={onClick}
        />
      </group>
    );
  }

  return (
    <group
      position={[position[0], y, position[1]]}
      rotation={[0, BUILDING_ROTATIONS[track.id] ?? 0, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <SelectionRing selected={selected} alerted={alerted} radius={track.id === "habitat" ? 4.6 : 1.38} />
      <mesh
        position={[0, 1.05, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
      >
        <boxGeometry args={track.id === "habitat" ? [6.6, 5.4, 6.6] : [2.65, 2.5, 2.65]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group scale={track.id === "habitat" ? 2.1 : 1}>
        <StaticBuildingArt id={track.id} color={color} />
        <FunctionalBuildingMotion id={track.id} color={color} />
        <BuildingIdleMotion color={color} level={level} active={alerted} id={track.id} />
      </group>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.25, 18]} />
        <meshBasicMaterial color={statusColor(runtime.condition)} />
      </mesh>

    </group>
  );
}

function UtilityCartWorld({ index }: { index: number }) {
  const ref = useRef<THREE.Group>(null);
  const route = useMemo<Array<[number, number]>>(() => (
    index % 2 === 0
      ? [[-15.8, -8.25], [-8.65, -8.25], [-8.65, -0.75], [0.25, -0.75], [0.25, -8.25], [8.5, -8.25], [8.5, -14.5], [-15.8, -14.5], [-15.8, -8.25]]
      : [[15.8, 6.75], [8.5, 6.75], [8.5, -0.75], [0.25, -0.75], [0.25, 6.75], [-8.65, 6.75], [-8.65, 13.8], [15.8, 13.8], [15.8, 6.75]]
  ), [index]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const speed = index % 2 === 0 ? 0.115 : 0.09;
    const progress = ((t * speed) + index * 0.17) % (route.length - 1);
    const segment = Math.floor(progress);
    const phase = progress - segment;
    const [ax, az] = route[segment];
    const [bx, bz] = route[segment + 1];
    const x = THREE.MathUtils.lerp(ax, bx, phase);
    const z = THREE.MathUtils.lerp(az, bz, phase);
    ref.current.position.set(x, terrainHeight(x, z) + 0.28, z);
    ref.current.rotation.y = Math.atan2(bx - ax, bz - az);
  });

  return (
    <group ref={ref} position={[route[0][0], terrainHeight(route[0][0], route[0][1]) + 0.28, route[0][1]]}>
      <mesh castShadow>
        <RoundedBox args={[0.7, 0.2, 0.46]} radius={0.06} smoothness={2}>
          <meshStandardMaterial color={index % 2 ? "#778d95" : "#b58b4a"} roughness={0.82} metalness={0.18} />
        </RoundedBox>
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <RoundedBox args={[0.26, 0.26, 0.24]} radius={0.06} smoothness={2}>
          <meshStandardMaterial color="#425158" roughness={0.72} metalness={0.22} />
        </RoundedBox>
      </mesh>
      {[[-0.24,-0.19],[0.24,-0.19],[-0.24,0.19],[0.24,0.19]].map(([x,z])=>(
        <mesh key={String(x)+String(z)} position={[x,-0.12,z]} rotation={[Math.PI/2,0,0]}>
          <cylinderGeometry args={[0.07,0.07,0.08,10]} />
          <meshStandardMaterial color="#252a2d" roughness={0.92} />
        </mesh>
      ))}
    </group>
  );
}

function MissionScene(props: Props) {
  const mars = props.environmentLabel === "MARS";


  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 1.3]}
      camera={{ position: [47, 56, 47], zoom: 25, near: 0.1, far: 360 }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <color attach="background" args={[mars ? "#8f4c3b" : "#69666b"]} />

      <ambientLight intensity={0.62} color={mars ? "#ffe4d9" : "#eef4ff"} />
      <hemisphereLight args={[mars ? "#ffeadd" : "#f7f8ff", mars ? "#43271f" : "#34323b", 1.02]} />
      <directionalLight
        position={[17, 33, 20]}
        intensity={1.65}
        color="#fff3dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-camera-left={-46}
        shadow-camera-right={46}
        shadow-camera-top={46}
        shadow-camera-bottom={-46}
      />

      <Terrain kind={mars ? "mars" : "moon"} />
      <Rocks kind={mars ? "mars" : "moon"} />

      <group scale={[1.28, 1.28, 1.28]}>
              <CityFloor mars={mars} />
              <LandingPad mars={mars} />
              <RegolithBerm mars={mars} />
              <UtilityCable from={[0, 0]} to={[0, -6.6]} />
              <UtilityCable from={[0, 0]} to={[-8.7, -8.1]} />
              <UtilityCable from={[0, 0]} to={[8.4, -3.3]} />
              <UtilityCable from={[0, 0]} to={[-8.2, 3.0]} />
              <UtilityCable from={[0, 0]} to={[8.4, 4.8]} />
              <CityRoadNetwork mars={mars} />
              <UtilityCartWorld index={0} />
              <UtilityCartWorld index={1} />

{props.tracks.map((track) => (
                track.id !== "rover" ? (
                  <BuildingPlot
                    key={`plot-${track.id}`}
                    position={POSITIONS[track.id] ?? [0, 0]}
                    size={track.id === "habitat" ? 6.6 : track.id === "extraction" || track.id === "isru" ? 4.0 : 3.5}
                    mars={mars}
                  />
                ) : null
              ))}

              <SettlerCrowd mars={mars} />

      {props.activeEventTrackId && POSITIONS[props.activeEventTrackId] && (
        <TaskMarker
          position={POSITIONS[props.activeEventTrackId]}
          label="EVENT"
          color="#ff5965"
        />
      )}
      {props.roverTask !== "STANDBY" && props.roverTask !== "RETURNING" && props.roverTask.startsWith("SURVEYING ") && (() => {
        const targetLabel = props.roverTask.slice("SURVEYING ".length);
        const node = props.resourceNodes.find((item) => item.label === targetLabel);
        return node ? <TaskMarker position={nodeWorldPosition(node)} label="ROVER TASK" color="#55e6f3" /> : null;
      })()}
      {props.resourceNodes.map((node) => (
        <ResourceMarker
          key={node.id}
          node={node}
          surveyed={props.surveyedNodes.includes(node.id)}
          selected={props.selectedResourceId === node.id}
          onClick={() => props.onSelectResource(node)}
        />
      ))}

      {props.tracks.map((track) => (
        <ColonyBuilding
          key={track.id}
          track={track}
          tier={props.selected[track.id] ?? "Foundation"}
          runtime={props.buildings[track.id] ?? { condition: 100, dust: 0, status: "ONLINE" }}
          selected={props.selectedBuildingId === track.id}
          alerted={props.activeEventTrackId === track.id}
          position={POSITIONS[track.id] ?? [0, 0]}
          roverTask={props.roverTask}
          resourceNodes={props.resourceNodes}
          onClick={() => props.onSelect(track.id)}
        />
      ))}

      </group>

      <OrbitControls
        enableRotate={false}
        enablePan={true}
        enableZoom
        screenSpacePanning={true}
        panSpeed={1.15}
        minZoom={13}
        maxZoom={44}
        zoomSpeed={0.9}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN }}
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
        target={[0, 0.2, 0]}
      />
    </Canvas>
  );
}

export function Colony3DMap(props: Props) {
  return <MissionScene {...props} />;
}
