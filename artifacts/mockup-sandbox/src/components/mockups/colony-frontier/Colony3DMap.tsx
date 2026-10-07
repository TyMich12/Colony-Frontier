import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
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
  habitat: [0, 0],
  grid: [0, -4.8],
  solar: [-5.4, -6.5],
  battery: [6.2, -2.1],
  oxygen: [-6.2, 2.0],
  co2: [-3.1, 4.9],
  water: [6.4, 4.0],
  comms: [5.9, -7.0],
  navigation: [-6.2, 7.9],
  radiation: [7.5, 8.0],
  rover: [0, 9.1],
  agriculture: [-9.9, 5.2],
  thermal: [-9.0, -1.4],
  science: [9.2, -6.8],
  extraction: [-8.8, 9.8],
  isru: [8.7, 11.0],
  maintenance: [10.3, 2.7],
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
  return mars ? "#a96f50" : "#787f80";
}

function roadEdgeColor(mars: boolean) {
  return mars ? "#d69a72" : "#bfc6c3";
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
              <planeGeometry args={[width + 0.22, length + 0.1]} />
              <meshStandardMaterial color={roadEdgeColor(mars)} roughness={0.98} />
            </mesh>
            <mesh position={[0, 0.016, 0]} receiveShadow>
              <planeGeometry args={[width, length]} />
              <meshStandardMaterial color={surfaceRoadColor(mars)} roughness={1} />
            </mesh>
            {Array.from({ length: Math.max(2, Math.floor(length / 2.1)) }, (_, tileIndex) => (
              <mesh key={tileIndex} position={[0, 0.025, -length / 2 + 0.85 + tileIndex * 2.05]}>
                <planeGeometry args={[width * 0.82, 0.045]} />
                <meshBasicMaterial color={roadEdgeColor(mars)} transparent opacity={0.45} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function CityRoadNetwork({ mars }: { mars: boolean }) {
  const routes: Array<Array<[number, number]>> = [
    [[-15.8, -15.6], [-8.2, -11.8], [0, -7.7], [0, -4.8], [0, 0]],
    [[0, 0], [0, 4.0], [0, 9.1], [4.4, 11.0], [8.7, 11.0]],
    [[0, 0], [-3.1, 4.9], [-6.2, 7.9], [-8.8, 9.8]],
    [[0, 0], [-6.2, 2.0], [-9.9, 5.2], [-6.2, 7.9]],
    [[0, 0], [6.4, 4.0], [7.5, 8.0], [8.7, 11.0]],
    [[0, 0], [6.2, -2.1], [5.9, -7.0], [9.2, -6.8]],
    [[-6.2, 2.0], [-3.1, 4.9], [6.4, 4.0], [10.3, 2.7]],
    [[-6.2, 2.0], [-9.0, -1.4], [-5.4, -6.5], [0, -4.8]],
  ];

  return (
    <group>
      {routes.map((route, index) => (
        <PathStrip
          key={index}
          points={route}
          width={index === 0 ? 1.2 : index < 4 ? 0.98 : 0.86}
          mars={mars}
        />
      ))}
    </group>
  );
}

function Plaza({
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

function DecorativeTree({
  position,
  scale = 1,
  flower = false,
  mars = false,
}: {
  position: [number, number];
  scale?: number;
  flower?: boolean;
  mars?: boolean;
}) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.02;
  const foliage = mars ? (flower ? "#d98d72" : "#6e8f5d") : flower ? "#e39abb" : "#5f9f67";

  return (
    <group position={[x, y, z]} scale={scale}>
      <mesh castShadow position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.095, 0.14, 0.96, 8]} />
        <meshStandardMaterial color="#5f5046" roughness={0.94} />
      </mesh>
      {[
        [-0.21, 0.66, 0],
        [0.18, 0.74, 0.06],
        [0, 1.04, -0.03],
        [0.22, 0.98, 0.11],
        [-0.16, 0.96, 0.07],
      ].map(([bx, by, bz], index) => (
        <mesh key={index} castShadow position={[bx, by, bz]}>
          <sphereGeometry args={[0.28 + (index % 2) * 0.06, 10, 8]} />
          <meshStandardMaterial color={foliage} roughness={0.96} />
        </mesh>
      ))}
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


port { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
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
  habitat: [0, 0],
  grid: [0, -4.8],
  solar: [-5.4, -6.5],
  battery: [6.2, -2.1],
  oxygen: [-6.2, 2.0],
  co2: [-3.1, 4.9],
  water: [6.4, 4.0],
  comms: [5.9, -7.0],
  navigation: [-6.2, 7.9],
  radiation: [7.5, 8.0],
  rover: [0, 9.1],
  agriculture: [-9.9, 5.2],
  thermal: [-9.0, -1.4],
  science: [9.2, -6.8],
  extraction: [-8.8, 9.8],
  isru: [8.7, 11.0],
  maintenance: [10.3, 2.7],
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
  return mars ? "#a96f50" : "#787f80";
}

function roadEdgeColor(mars: boolean) {
  return mars ? "#d69a72" : "#bfc6c3";
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
              <planeGeometry args={[width + 0.22, length + 0.1]} />
              <meshStandardMaterial color={roadEdgeColor(mars)} roughness={0.98} />
            </mesh>
            <mesh position={[0, 0.016, 0]} receiveShadow>
              <planeGeometry args={[width, length]} />
              <meshStandardMaterial color={surfaceRoadColor(mars)} roughness={1} />
            </mesh>
            {Array.from({ length: Math.max(2, Math.floor(length / 2.1)) }, (_, tileIndex) => (
              <mesh key={tileIndex} position={[0, 0.025, -length / 2 + 0.85 + tileIndex * 2.05]}>
                <planeGeometry args={[width * 0.82, 0.045]} />
                <meshBasicMaterial color={roadEdgeColor(mars)} transparent opacity={0.45} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function CityRoadNetwork({ mars }: { mars: boolean }) {
  const routes: Array<Array<[number, number]>> = [
    [[-15.8, -15.6], [-8.2, -11.8], [0, -7.7], [0, -4.8], [0, 0]],
    [[0, 0], [0, 4.0], [0, 9.1], [4.4, 11.0], [8.7, 11.0]],
    [[0, 0], [-3.1, 4.9], [-6.2, 7.9], [-8.8, 9.8]],
    [[0, 0], [-6.2, 2.0], [-9.9, 5.2], [-6.2, 7.9]],
    [[0, 0], [6.4, 4.0], [7.5, 8.0], [8.7, 11.0]],
    [[0, 0], [6.2, -2.1], [5.9, -7.0], [9.2, -6.8]],
    [[-6.2, 2.0], [-3.1, 4.9], [6.4, 4.0], [10.3, 2.7]],
    [[-6.2, 2.0], [-9.0, -1.4], [-5.4, -6.5], [0, -4.8]],
  ];

  return (
    <group>
      {routes.map((route, index) => (
        <PathStrip
          key={index}
          points={route}
          width={index === 0 ? 1.2 : index < 4 ? 0.98 : 0.86}
          mars={mars}
        />
      ))}
    </group>
  );
}

function Plaza({
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

function DecorativeTree({
  position,
  scale = 1,
  flower = false,
  mars = false,
}: {
  position: [number, number];
  scale?: number;
  flower?: boolean;
  mars?: boolean;
}) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.02;
  const foliage = mars ? (flower ? "#d98d72" : "#6e8f5d") : flower ? "#e39abb" : "#5f9f67";

  return (
    <group position={[x, y, z]} scale={scale}>
      <mesh castShadow position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.095, 0.14, 0.96, 8]} />
        <meshStandardMaterial color="#5f5046" roughness={0.94} />
      </mesh>
      {[
        [-0.21, 0.66, 0],
        [0.18, 0.74, 0.06],
        [0, 1.04, -0.03],
        [0.22, 0.98, 0.11],
        [-0.16, 0.96, 0.07],
      ].map(([bx, by, bz], index) => (
        <mesh key={index} castShadow position={[bx, by, bz]}>
          <sphereGeometry args={[0.28 + (index % 2) * 0.06, 10, 8]} />
          <meshStandardMaterial color={foliage} roughness={0.96} />
        </mesh>
      ))}
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

function StaticBuildingArt({
  id,
  color,
}: {
  id: string;
  color: string;
}) {
  switch (id) {
    case "solar":
      return (
        <group>
          <mesh castShadow position={[0, 0.33, 0]}>
            <boxGeometry args={[2.2, 0.58, 1.8]} />
            <meshStandardMaterial color="#505b5e" roughness={0.8} metalness={0.12} />
          </mesh>
          {[-0.62, 0, 0.62].map((x) => (
            <group key={x} position={[x, 0.8, 0]} rotation={[0.12, 0.04 * x, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.52, 0.08, 0.98]} />
                <meshStandardMaterial color="#2f92d1" roughness={0.3} metalness={0.34} />
              </mesh>
              <mesh position={[0, 0.056, 0]}>
                <boxGeometry args={[0.08, 0.035, 0.98]} />
                <meshStandardMaterial color="#c6d8dc" metalness={0.5} roughness={0.28} />
              </mesh>
              <mesh position={[0, -0.2, 0]}>
                <cylinderGeometry args={[0.045, 0.05, 0.42, 8]} />
                <meshStandardMaterial color="#8c9695" metalness={0.65} roughness={0.24} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.77, 0]}>
            <cylinderGeometry args={[0.11, 0.14, 0.4, 10]} />
            <meshStandardMaterial color="#cfd7d3" metalness={0.68} roughness={0.22} />
          </mesh>
        </group>
      );
    case "habitat":
      return <CentralCommandCenter color={color} />;
    case "comms":
      return (
        <group>
          <mesh castShadow position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.78, 0.9, 0.78, 12]} />
            <meshStandardMaterial color="#5b666a" roughness={0.74} metalness={0.16} />
          </mesh>
          <mesh position={[0, 1.04, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 1.15, 10]} />
            <meshStandardMaterial color="#dfe5e0" metalness={0.68} roughness={0.22} />
          </mesh>
          <mesh position={[0, 1.7, 0.05]} rotation={[Math.PI / 2.8, 0, 0]}>
            <sphereGeometry args={[0.58, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
            <meshStandardMaterial color="#dbe2df" roughness={0.26} metalness={0.42} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 1.73, 0.28]}>
            <cylinderGeometry args={[0.045, 0.045, 0.58, 8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
          </mesh>
        </group>
      );
    case "oxygen":
      return (
        <group>
          <mesh castShadow position={[0, 0.36, 0]}>
            <boxGeometry args={[1.95, 0.68, 1.58]} />
            <meshStandardMaterial color="#576366" roughness={0.8} metalness={0.12} />
          </mesh>
          {[-0.52, 0.52].map((x) => (
            <group key={x} position={[x, 0.92, 0.2]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.31, 0.36, 1.12, 14]} />
                <meshStandardMaterial color="#cbd3d0" roughness={0.44} metalness={0.26} />
              </mesh>
              <mesh position={[0, 0, 0.015]}>
                <cylinderGeometry args={[0.22, 0.25, 0.94, 12]} />
                <meshStandardMaterial color="#7aeaff" transparent opacity={0.72} roughness={0.24} />
              </mesh>
              <mesh position={[0, 0.63, 0]}>
                <cylinderGeometry args={[0.32, 0.32, 0.08, 14]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.36} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 1.0, -0.52]}>
            <boxGeometry args={[1.05, 0.12, 0.28]} />
            <meshStandardMaterial color="#6c797a" roughness={0.5} metalness={0.28} />
          </mesh>
        </group>
      );
    case "water":
      return (
        <group>
          <mesh castShadow position={[0, 0.36, 0]}>
            <boxGeometry args={[1.95, 0.68, 1.58]} />
            <meshStandardMaterial color="#576366" roughness={0.8} metalness={0.12} />
          </mesh>
          {[-0.52, 0.52].map((x) => (
            <group key={x} position={[x, 0.92, 0.2]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.31, 0.36, 1.12, 14]} />
                <meshStandardMaterial color="#cbd3d0" roughness={0.44} metalness={0.26} />
              </mesh>
              <mesh position={[0, 0, 0.015]}>
                <cylinderGeometry args={[0.22, 0.25, 0.94, 12]} />
                <meshStandardMaterial color="#48bfff" transparent opacity={0.74} roughness={0.22} />
              </mesh>
              <mesh position={[0, 0.63, 0]}>
                <cylinderGeometry args={[0.32, 0.32, 0.08, 14]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.36} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 1.02, -0.5]}>
            <boxGeometry args={[1.08, 0.12, 0.26]} />
            <meshStandardMaterial color="#6d797a" roughness={0.5} metalness={0.28} />
          </mesh>
        </group>
      );
    case "battery":
      return (
        <group>
          <mesh castShadow position={[0, 0.42, 0]}>
            <boxGeometry args={[2.15, 0.84, 1.72]} />
            <meshStandardMaterial color="#495357" roughness={0.75} metalness={0.22} />
          </mesh>
          {[-0.62, -0.2, 0.2, 0.62].map((x, index) => (
            <group key={x} position={[x, 1.0, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.28, 0.82, 0.5]} />
                <meshStandardMaterial color={index === 2 ? "#5be9ff" : "#6b7678"} emissive={index === 2 ? "#1dd5df" : "#000000"} emissiveIntensity={index === 2 ? 0.72 : 0} roughness={0.4} metalness={0.3} />
              </mesh>
              <mesh position={[0, 0.46, 0]}>
                <boxGeometry args={[0.14, 0.06, 0.18]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.52} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 1.0, -0.75]}>
            <boxGeometry args={[1.65, 0.12, 0.05]} />
            <meshStandardMaterial color="#747f80" metalness={0.36} roughness={0.4} />
          </mesh>
        </group>
      );
    case "co2":
      return (
        <group>
          <mesh castShadow position={[0, 0.4, 0]}>
            <boxGeometry args={[1.75, 0.78, 1.45]} />
            <meshStandardMaterial color="#515b60" roughness={0.78} metalness={0.14} />
          </mesh>
          <mesh castShadow position={[0, 1.12, 0]}>
            <cylinderGeometry args={[0.42, 0.5, 0.75, 12]} />
            <meshStandardMaterial color="#7d8988" roughness={0.52} metalness={0.2} />
          </mesh>
          <mesh position={[0, 1.53, 0]}>
            <cylinderGeometry args={[0.24, 0.28, 0.08, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
          </mesh>
          {[-0.52, 0.52].map((x) => (
            <mesh key={x} position={[x, 0.9, 0.5]}>
              <cylinderGeometry args={[0.08, 0.08, 0.62, 8]} />
              <meshStandardMaterial color="#7de6eb" emissive="#2caeb8" emissiveIntensity={0.35} />
            </mesh>
          ))}
        </group>
      );
    case "radiation":
      return (
        <group>
          <mesh castShadow position={[0, 0.43, 0]}>
            <boxGeometry args={[1.95, 0.84, 1.55]} />
            <meshStandardMaterial color="#4d575d" roughness={0.76} metalness={0.18} />
          </mesh>
          {[0, 1, 2].map((index) => (
            <mesh key={index} position={[0, 1.18 + index * 0.28, 0]} rotation={[0, index * 0.18, 0]}>
              <torusGeometry args={[0.43 + index * 0.09, 0.055, 8, 28]} />
              <meshBasicMaterial color={index === 1 ? "#ffe55e" : color} />
            </mesh>
          ))}
          <mesh position={[0, 1.02, 0]}>
            <cylinderGeometry args={[0.12, 0.16, 0.34, 8]} />
            <meshStandardMaterial color="#dbe0dc" metalness={0.64} roughness={0.24} />
          </mesh>
        </group>
      );
    case "science":
      return (
        <group>
          <mesh castShadow position={[0, 0.56, 0]}>
            <cylinderGeometry args={[0.98, 1.08, 0.9, 12]} />
            <meshStandardMaterial color="#545f66" roughness={0.74} metalness={0.16} />
          </mesh>
          <mesh castShadow position={[0, 1.16, 0]}>
            <sphereGeometry args={[0.9, 24, 14]} />
            <meshStandardMaterial color="#765ca5" emissive="#4b257a" emissiveIntensity={0.38} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.2, 0]}>
            <torusGeometry args={[0.7, 0.055, 8, 26]} />
            <meshBasicMaterial color="#5eeaff" />
          </mesh>
          <mesh position={[0.56, 1.26, 0]}>
            <boxGeometry args={[0.1, 0.84, 0.1]} />
            <meshStandardMaterial color={color} metalness={0.55} roughness={0.28} />
          </mesh>
          <mesh position={[-0.45, 1.08, 0.55]} rotation={[0, 0, 0.2]}>
            <boxGeometry args={[0.38, 0.16, 0.38]} />
            <meshStandardMaterial color="#c9d7d3" roughness={0.52} metalness={0.22} />
          </mesh>
        </group>
      );
    case "extraction":
      return (
        <group>
          <mesh castShadow position={[0, 0.48, 0]}>
            <boxGeometry args={[2.25, 0.95, 1.8]} />
            <meshStandardMaterial color="#4f585b" roughness={0.76} metalness={0.18} />
          </mesh>
          <mesh castShadow position={[0, 1.56, 0]}>
            <cylinderGeometry args={[0.42, 0.52, 0.86, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.28} metalness={0.28} roughness={0.34} />
          </mesh>
          <mesh castShadow position={[0, 1.02, 0]}>
            <coneGeometry args={[0.19, 0.98, 8]} />
            <meshStandardMaterial color="#d3dbd7" metalness={0.72} roughness={0.2} />
          </mesh>
          <mesh position={[0.62, 1.1, 0.38]}>
            <boxGeometry args={[0.45, 0.58, 0.42]} />
            <meshStandardMaterial color="#727c7d" roughness={0.55} metalness={0.22} />
          </mesh>
        </group>
      );
    case "isru":
      return (
        <group>
          <mesh castShadow position={[0, 0.48, 0]}>
            <boxGeometry args={[2.35, 0.98, 1.92]} />
            <meshStandardMaterial color="#4c5759" roughness={0.75} metalness={0.2} />
          </mesh>
          <mesh castShadow position={[0, 1.62, 0]}>
            <cylinderGeometry args={[0.44, 0.56, 0.92, 12]} />
            <meshStandardMaterial color="#69c7b7" emissive="#2c9286" emissiveIntensity={0.3} metalness={0.3} roughness={0.34} />
          </mesh>
          <mesh castShadow position={[0, 1.04, 0]}>
            <coneGeometry args={[0.2, 1.02, 8]} />
            <meshStandardMaterial color="#d5dbd7" metalness={0.7} roughness={0.21} />
          </mesh>
          {[-0.7, 0.7].map((x) => (
            <mesh key={x} position={[x, 0.98, 0.42]}>
              <cylinderGeometry args={[0.17, 0.2, 0.78, 10]} />
              <meshStandardMaterial color="#6d8d88" roughness={0.52} metalness={0.26} />
            </mesh>
          ))}
        </group>
      );
    case "agriculture":
      return (
        <group>
          <mesh castShadow position={[0, 0.62, 0]}>
            <boxGeometry args={[2.35, 1.04, 1.58]} />
            <meshStandardMaterial color="#315348" transparent opacity={0.94} roughness={0.42} />
          </mesh>
          <mesh position={[0, 1.3, 0]}>
            <boxGeometry args={[2.46, 0.1, 1.68]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
          </mesh>
          {[-0.66, -0.22, 0.22, 0.66].map((x) => (
            <group key={x} position={[x, 0.94, 0]}>
              <mesh>
                <cylinderGeometry args={[0.045, 0.06, 0.34, 6]} />
                <meshStandardMaterial color="#6d5038" roughness={0.95} />
              </mesh>
              <mesh position={[0, 0.22, 0]}>
                <sphereGeometry args={[0.12, 10, 8]} />
                <meshStandardMaterial color="#7cf58c" emissive="#2de25b" emissiveIntensity={0.66} roughness={0.86} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "navigation":
      return (
        <group>
          <mesh castShadow position={[0, 0.4, 0]}>
            <boxGeometry args={[1.72, 0.8, 1.48]} />
            <meshStandardMaterial color="#555f63" roughness={0.76} metalness={0.17} />
          </mesh>
          <mesh position={[0, 1.38, 0]}>
            <cylinderGeometry args={[0.12, 0.18, 1.42, 10]} />
            <meshStandardMaterial color="#e1e7e1" metalness={0.68} roughness={0.2} />
          </mesh>
          <mesh position={[0, 1.73, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.52, 0.055, 8, 26]} />
            <meshBasicMaterial color="#ff64d8" />
          </mesh>
          <mesh position={[0, 2.14, 0]}>
            <octahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.72} />
          </mesh>
        </group>
      );
    case "thermal":
      return (
        <group>
          <mesh castShadow position={[0, 0.4, 0]}>
            <boxGeometry args={[2.05, 0.8, 1.62]} />
            <meshStandardMaterial color="#505a5c" roughness={0.78} metalness={0.16} />
          </mesh>
          {[-0.5, 0, 0.5].map((x) => (
            <group key={x} position={[x, 1.05, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.16, 0.2, 0.8, 10]} />
                <meshStandardMaterial color="#d6ddd8" metalness={0.58} roughness={0.24} />
              </mesh>
              <mesh position={[0, 0.46, 0]}>
                <sphereGeometry args={[0.08, 8, 6]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.78} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.95, 0.72]}>
            <boxGeometry args={[1.25, 0.14, 0.08]} />
            <meshStandardMaterial color="#707b7b" roughness={0.42} metalness={0.32} />
          </mesh>
        </group>
      );
    case "grid":
      return (
        <group>
          <mesh castShadow position={[0, 0.43, 0]}>
            <boxGeometry args={[2.15, 0.86, 1.7]} />
            <meshStandardMaterial color="#475156" roughness={0.75} metalness={0.23} />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <octahedronGeometry args={[0.35, 0]} />
            <meshStandardMaterial color="#5cecff" emissive="#22dbe7" emissiveIntensity={0.94} />
          </mesh>
          {[-0.66, 0.66].map((x) => (
            <mesh key={x} position={[x, 1.04, 0]}>
              <boxGeometry args={[0.34, 0.48, 0.36]} />
              <meshStandardMaterial color="#788282" roughness={0.48} metalness={0.24} />
            </mesh>
          ))}
        </group>
      );
    case "maintenance":
      return (
        <group>
          <mesh castShadow position={[0, 0.44, 0]}>
            <boxGeometry args={[2.15, 0.88, 1.76]} />
            <meshStandardMaterial color="#50595d" roughness={0.77} metalness={0.2} />
          </mesh>
          <mesh position={[0, 1.72, 0]}>
            <boxGeometry args={[0.12, 1.22, 0.12]} />
            <meshStandardMaterial color="#d9dfdb" metalness={0.64} roughness={0.24} />
          </mesh>
          <mesh position={[0.4, 2.08, 0]}>
            <boxGeometry args={[0.74, 0.1, 0.1]} />
            <meshStandardMaterial color="#d9dfdb" metalness={0.64} roughness={0.24} />
          </mesh>
          <mesh position={[-0.4, 1.07, 0.9]}>
            <boxGeometry args={[0.52, 0.45, 0.05]} />
            <meshStandardMaterial color="#253136" emissive="#0d1d21" emissiveIntensity={0.7} />
          </mesh>
        </group>
      );
    case "rover":
      return (
        <group>
          <mesh receiveShadow position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.25, 32]} />
            <meshStandardMaterial color="#515c5f" roughness={0.9} metalness={0.06} />
          </mesh>
          <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.88, 1, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.72} />
          </mesh>
          <mesh castShadow position={[0, 0.52, 0]}>
            <boxGeometry args={[1.42, 0.36, 0.92]} />
            <meshStandardMaterial color="#e8c86b" roughness={0.63} metalness={0.3} />
          </mesh>
          <mesh castShadow position={[0, 0.9, 0]}>
            <boxGeometry args={[0.42, 0.46, 0.42]} />
            <meshStandardMaterial color="#20dbe4" emissive="#0fc7d1" emissiveIntensity={0.7} />
          </mesh>
          {[[-0.5, -0.33], [-0.5, 0.33], [0.5, -0.33], [0.5, 0.33]].map(([x, z]) => (
            <mesh key={String(x) + String(z)} castShadow position={[x, 0.16, z]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.18, 0.18, 0.17, 12]} />
              <meshStandardMaterial color="#22282b" roughness={0.92} />
            </mesh>
          ))}
          <mesh position={[0.44, 0.96, 0]}>
            <boxGeometry args={[0.07, 0.07, 0.7]} />
            <meshStandardMaterial color="#ffd85a" emissive="#ffbd18" emissiveIntensity={0.6} />
          </mesh>
        </group>
      );
    default:
      return (
        <group>
          <mesh castShadow position={[0, 0.42, 0]}>
            <boxGeometry args={[1.8, 0.84, 1.5]} />
            <meshStandardMaterial color="#515a5d" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[1.45, 0.1, 1.16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.26} />
          </mesh>
        </group>
      );
  }
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
  const toolRef = useRef<THREE.Mesh>(null);

  const shirtColors = ["#6fc8d9", "#f0bf5c", "#da7d68", "#82b97a", "#9a8bd2", "#66a7cf"];
  const bodyColor = shirtColors[index % shirtColors.length];
  const skinColors = ["#d59b7a", "#be805f", "#e1ad88", "#a96d53"];
  const skin = skinColors[index % skinColors.length];
  const bootColor = index % 2 ? "#39434a" : "#2e3a40";
  const helmetColor = mars ? (index % 3 === 0 ? "#d07f5d" : "#bbc2bf") : (index % 3 === 0 ? "#e0ba59" : "#b8c4c6");

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * (0.7 + (index % 5) * 0.035);
    const progress = (t * 0.24 + index * 0.071) % route.length;
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
      groupRef.current.rotation.y = Math.atan2(dx, dz);
    }

    const stride = Math.sin(t * 8.4 + index);
    const armSwing = stride * 0.34;
    if (leftArmRef.current) leftArmRef.current.rotation.x = armSwing;
    if (rightArmRef.current) rightArmRef.current.rotation.x = -armSwing;
    if (leftLegRef.current) leftLegRef.current.rotation.x = -stride * 0.38;
    if (rightLegRef.current) rightLegRef.current.rotation.x = stride * 0.38;
    if (toolRef.current) toolRef.current.rotation.z = Math.sin(t * 4 + index) * 0.22;
  });

  return (
    <group ref={groupRef} scale={0.43}>
      <mesh castShadow position={[0, 0.42, 0]}>
        <capsuleGeometry args={[0.125, 0.25, 4, 8]} />
        <meshStandardMaterial color={bodyColor} roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 0.48, -0.13]}>
        <boxGeometry args={[0.2, 0.25, 0.08]} />
        <meshStandardMaterial color={helmetColor} roughness={0.74} metalness={0.22} />
      </mesh>
      <mesh castShadow position={[0, 0.73, 0]}>
        <sphereGeometry args={[0.105, 12, 8]} />
        <meshStandardMaterial color={skin} roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.74, 0.085]}>
        <boxGeometry args={[0.12, 0.055, 0.018]} />
        <meshStandardMaterial color={index % 2 ? "#7ddfe7" : "#f4d267"} emissive={index % 2 ? "#238c95" : "#8e6513"} emissiveIntensity={0.4} metalness={0.24} roughness={0.28} />
      </mesh>
      <mesh castShadow position={[0, 0.82, 0]}>
        <sphereGeometry args={[0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial color={helmetColor} roughness={0.7} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.73, 0.10]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color="#67e7ef" emissive="#29bcc6" emissiveIntensity={0.75} />
      </mesh>
      <mesh castShadow position={[0, 0.34, -0.10]}>
        <boxGeometry args={[0.22, 0.24, 0.12]} />
        <meshStandardMaterial color="#445256" roughness={0.82} metalness={0.2} />
      </mesh>

      <group ref={leftArmRef} position={[-0.16, 0.48, 0]}>
        <mesh castShadow position={[0, -0.13, 0]}>
          <capsuleGeometry args={[0.035, 0.2, 3, 6]} />
          <meshStandardMaterial color={skin} roughness={0.88} />
        </mesh>
        <mesh castShadow position={[0, -0.25, 0]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <meshStandardMaterial color={skin} roughness={0.9} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.16, 0.48, 0]}>
        <mesh castShadow position={[0, -0.13, 0]}>
          <capsuleGeometry args={[0.035, 0.2, 3, 6]} />
          <meshStandardMaterial color={skin} roughness={0.88} />
        </mesh>
        <mesh castShadow position={[0, -0.25, 0]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <meshStandardMaterial color={skin} roughness={0.9} />
        </mesh>
      </group>

      <group ref={leftLegRef} position={[-0.07, 0.19, 0]}>
        <mesh castShadow position={[0, -0.1, 0]}>
          <capsuleGeometry args={[0.042, 0.17, 3, 6]} />
          <meshStandardMaterial color={bootColor} roughness={0.92} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.07, 0.19, 0]}>
        <mesh castShadow position={[0, -0.1, 0]}>
          <capsuleGeometry args={[0.042, 0.17, 3, 6]} />
          <meshStandardMaterial color={bootColor} roughness={0.92} />
        </mesh>
      </group>

      {carry && (
        <mesh ref={toolRef} castShadow position={[0.24, 0.57, 0.18]}>
          <boxGeometry args={[0.24, 0.23, 0.22]} />
          <meshStandardMaterial color="#ca9852" roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

function SettlerCrowd({ mars }: { mars: boolean }) {
  const routes: Array<Array<[number, number]>> = [
    [[-15.0, -14.2], [-10.3, -12.1], [-6.0, -8.8], [0, -4.8], [0, 0]],
    [[0, 0], [-3.1, 4.9], [-6.2, 7.9], [-8.8, 9.8], [-4.0, 11.2], [0, 9.1]],
    [[0, 0], [6.4, 4.0], [7.5, 8.0], [8.7, 11.0], [4.6, 12.0], [0, 9.1]],
    [[0, 0], [6.2, -2.1], [5.9, -7.0], [9.2, -6.8], [12.8, -9.2], [0, -4.8]],
    [[-6.2, 2.0], [-9.9, 5.2], [-9.0, -1.4], [-5.4, -6.5], [-12.8, -6.3], [0, 0]],
    [[-6.2, 2.0], [-3.1, 4.9], [6.4, 4.0], [10.3, 2.7], [12.4, 5.9], [7.5, 8.0]],
    [[-13.0, 1.0], [-10.5, 5.5], [-6.2, 7.9], [-1.0, 10.4], [0.1, 9.1]],
    [[12.7, -0.8], [10.1, 2.7], [8.0, 6.8], [7.5, 8.0], [12.0, 10.5]],
    [[-11.7, -9.5], [-7.0, -6.0], [-3.3, -2.2], [0, 0], [4.0, -2.7]],
    [[10.8, -9.7], [6.0, -7.0], [3.3, -3.0], [0, 0], [-4.0, -2.7]],
  ];

  return (
    <group>
      {Array.from({ length: 48 }, (_, index) => (
        <HumanSettler
          key={index}
          route={routes[index % routes.length]}
          index={index}
          carry={index % 4 === 0}
          mars={mars}
        />
      ))}
    </group>
  );
}


function CivicPlazaStatue({ position, mars }: { position: [number, number]; mars: boolean }) {
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

function ShrubCluster({ position, flower = false, scale = 1 }: {
  position: [number, number];
  flower?: boolean;
  scale?: number;
}) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.03;
  const leaves = flower ? "#d989b3" : "#57975e";
  return (
    <group position={[x, y, z]} scale={scale}>
      {[-0.18, 0.0, 0.18].map((dx, index) => (
        <mesh key={index} castShadow position={[dx, 0.17 + (index % 2) * 0.05, index % 2 ? 0.06 : -0.03]}>
          <sphereGeometry args={[0.16 + (index % 2) * 0.035, 10, 8]} />
          <meshStandardMaterial color={leaves} roughness={0.96} />
        </mesh>
      ))}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 0.12, 8]} />
        <meshStandardMaterial color="#625244" roughness={0.98} />
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


function CityFloor({ mars }: { mars: boolean }) {
  const tiles = [
    { x: 0, z: -7.4, w: 18, d: 2.2 },
    { x: 0, z: 0, w: 2.3, d: 22 },
    { x: 0, z: 7.1, w: 18, d: 1.9 },
    { x: -8.5, z: 0.8, w: 2.0, d: 17 },
    { x: 8.6, z: 0.8, w: 2.0, d: 17 },
  ];
  return (
    <group>
      {tiles.map((tile, index) => {
        const y = terrainHeight(tile.x, tile.z) + 0.08;
        return (
          <mesh key={index} receiveShadow position={[tile.x, y, tile.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[tile.w, tile.d]} />
            <meshStandardMaterial color={mars ? "#875743" : "#687477"} roughness={0.97} />
          </mesh>
        );
      })}
      {Array.from({ length: 9 }, (_, index) => {
        const x = -8 + index * 2;
        const y = terrainHeight(x, -7.4) + 0.12;
        return (
          <mesh key={index} position={[x, y, -7.4]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.72, 1.54]} />
            <meshStandardMaterial color={mars ? "#b6795e" : "#9aa3a0"} roughness={0.94} />
          </mesh>
        );
      })}
    </group>
  );
}

function Archway({ position, color }: { position: [number, number]; color: string }) {
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

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const active = task !== "STANDBY" && task !== "RETURNING";
    const p = active ? (Math.sin(t * 0.28) + 1) / 2 : 0;
    const from = task === "RETURNING" ? destination : home;
    const to = task === "RETURNING" ? home : destination;
    const x = THREE.MathUtils.lerp(from[0], to[0], p);
    const z = THREE.MathUtils.lerp(from[1], to[1], p);
    const nx = THREE.MathUtils.lerp(from[0], to[0], Math.min(1, p + 0.02));
    const nz = THREE.MathUtils.lerp(from[1], to[1], Math.min(1, p + 0.02));
    ref.current.position.set(x, terrainHeight(x, z) + 0.47, z);
    if (Math.abs(nx - x) + Math.abs(nz - z) > 0.02) ref.current.rotation.y = Math.atan2(nx - x, nz - z);
    if (scannerRef.current) {
      const atSite = !!resource && Math.hypot(x - destination[0], z - destination[1]) < 1;
      scannerRef.current.scale.setScalar(atSite ? 0.9 + (Math.sin(t * 5) + 1) * 0.2 : 0.18);
      (scannerRef.current.material as THREE.MeshBasicMaterial).opacity = atSite ? 0.65 : 0.08;
    }
  });

  return (
    <group ref={ref} position={[position[0], terrainHeight(position[0], position[1]) + 0.47, position[1]]} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      <SelectionRing selected={selected} alerted={alerted} radius={1.06} />
      <mesh castShadow>
        <boxGeometry args={[1.35, 0.32, 0.9]} />
        <meshStandardMaterial color="#e7c76a" roughness={0.64} metalness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.36, 0]}>
        <boxGeometry args={[0.42, 0.46, 0.42]} />
        <meshStandardMaterial color="#20dbe4" emissive="#0ec9d2" emissiveIntensity={0.64} />
      </mesh>
      {[[-0.49, -0.32], [-0.49, 0.32], [0.49, -0.32], [0.49, 0.32]].map(([x, z]) => (
        <mesh key={String(x) + String(z)} castShadow position={[x, -0.18, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.16, 12]} />
          <meshStandardMaterial color="#24282c" roughness={0.91} />
        </mesh>
      ))}
      <mesh position={[0.4, 0.53, 0]}>
        <boxGeometry args={[0.07, 0.07, 0.68]} />
        <meshStandardMaterial color="#ffd958" emissive="#ffbd18" emissiveIntensity={0.62} />
      </mesh>
      <mesh ref={scannerRef} position={[0, -0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.58, 0.86, 28]} />
        <meshBasicMaterial color="#52e7ff" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

function SelectionRing({
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
        {selected && (
          <Text position={[position[0], y + 2.0, position[1]]} rotation={[-0.66, 0, 0]} fontSize={0.22} color="#fff1ad" outlineWidth={0.03} outlineColor="#251f1c" anchorX="center">
            ROVER
          </Text>
        )}
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
      <SelectionRing selected={selected} alerted={alerted} radius={track.id === "habitat" ? 2.45 : 1.38} />
      {track.id !== "habitat" && <BuildingDetailTrim id={track.id} color={color} mars={false} />}
      <StaticBuildingArt id={track.id} color={color} />
      <BuildingIdleMotion color={color} level={level} active={alerted} id={track.id} />
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.25, 18]} />
        <meshBasicMaterial color={statusColor(runtime.condition)} />
      </mesh>

      {(selected || alerted) && track.id !== "habitat" && (
        <>
          <Text position={[0, 2.55, 0]} rotation={[-0.66, 0, 0]} fontSize={0.24} color={selected ? "#fff2a0" : "#ff8e77"} outlineWidth={0.035} outlineColor="#241f1c" anchorX="center">
            {track.category}
          </Text>
          <Text position={[0, 2.3, 0]} rotation={[-0.66, 0, 0]} fontSize={0.15} color={color} outlineWidth={0.02} outlineColor="#241f1c" anchorX="center">
            {tier}
          </Text>
        </>
      )}
    </group>
  );
}

function MissionScene(props: Props) {
  const mars = props.environmentLabel === "MARS";

  const decorativeTrees = [
    [-14.2, -11.7, 1.0, true],
    [-11.3, -9.6, 0.8, false],
    [12.8, -11.8, 1.1, true],
    [14.5, -1.1, 0.8, false],
    [-13.1, 2.7, 0.9, true],
    [12.9, 6.0, 0.92, true],
    [-13.1, 10.9, 0.82, false],
    [12.0, 12.1, 0.9, true],
    [-4.7, -11.0, 0.72, false],
    [4.5, -11.6, 0.74, true],
  ] as Array<[number, number, number, boolean]>;

  const gardens = [
    [-11.8, -5.1, 0.72],
    [11.7, -4.2, 0.72],
    [-11.6, 7.6, 0.7],
    [11.9, 9.3, 0.68],
    [-4.7, 10.8, 0.62],
    [4.4, 8.4, 0.62],
  ] as Array<[number, number, number]>;

  const lamps = [
    [-9.1, -9.6], [-3.9, -5.7], [3.9, -5.7], [9.1, -9.7],
    [-8.2, 1.0], [8.2, 1.2], [-3.0, 6.9], [3.1, 6.7],
    [-5.7, 10.7], [6.0, 10.9],
  ] as Array<[number, number]>;

  return (
    <Canvas
      shadows
      dpr={[1, 1.3]}
      camera={{ position: [48, 58, 46], fov: 50, near: 0.1, far: 320 }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <color attach="background" args={[mars ? "#8f4c3b" : "#69666b"]} />
      <fog attach="fog" args={[mars ? "#a3604d" : "#737177", 58, 115]} />

      <ambientLight intensity={0.84} color={mars ? "#ffe4d9" : "#eef4ff"} />
      <hemisphereLight args={[mars ? "#ffeadd" : "#f7f8ff", mars ? "#43271f" : "#34323b", 1.02]} />
      <directionalLight
        position={[17, 33, 20]}
        intensity={2.6}
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

      <CityFloor mars={mars} />
      <SettlementWall mars={mars} />
      <SettlementGate mars={mars} />
      <CityRoadNetwork mars={mars} />
      <PathStrip points={[[-13.8, -3.8], [-8.8, -3.8], [-3.0, -3.8], [0, -3.8], [4.0, -3.8], [9.0, -3.8], [13.5, -3.8]]} width={0.72} mars={mars} />
      <PathStrip points={[[-9.3, 6.8], [-5.2, 6.8], [0, 6.8], [5.0, 6.8], [9.6, 6.8]]} width={0.7} mars={mars} />
      <Plaza position={[0, 0]} radius={5.0} mars={mars} accent="#43dbe6" />
      <Plaza position={[0, 9.2]} radius={2.6} mars={mars} accent="#f1c95e" />
      <Plaza position={[-8.9, 9.9]} radius={2.1} mars={mars} accent="#69e3f0" />

      <PipeRuns />
      <ColonyLighting mars={mars} />
      <Archway position={[0, -5.7]} color="#56dfe8" />
      <Archway position={[0, 5.7]} color="#f0c75d" />
      <Archway position={[-6.5, 0]} color="#6fdddf" />
      <Archway position={[6.5, 0]} color="#b579ef" />
      <StatueRow z={-2.9} color="#56dce6" />
      <StatueRow z={2.9} color="#f0c760" />
      <CargoCart position={[-10.9, -4.9]} mars={mars} />
      <CargoCart position={[10.9, -5.0]} mars={mars} />
      <CargoCart position={[-10.4, 6.3]} mars={mars} />
      <CargoCart position={[10.5, 6.6]} mars={mars} />

      <UrbanBlock position={[-8.9, -3.5]} width={3.3} depth={2.4} mars={mars} accent="#59dce5" />
      <UrbanBlock position={[8.7, -3.7]} width={3.2} depth={2.4} mars={mars} accent="#f1c75c" />
      <UrbanBlock position={[-8.5, 6.1]} width={3.4} depth={2.45} mars={mars} accent="#73d7e0" />
      <UrbanBlock position={[8.8, 6.2]} width={3.4} depth={2.45} mars={mars} accent="#c17bf0" />
      <UrbanBlock position={[-3.7, 10.9]} width={3.0} depth={2.25} mars={mars} accent="#5edfe8" />
      <UrbanBlock position={[4.0, 10.9]} width={3.0} depth={2.25} mars={mars} accent="#f3cf67" />

      <ColonyMonument position={[-3.0, 3.0]} color="#61dfe8" />
      <ColonyMonument position={[3.1, 3.0]} color="#f0c75d" />
      <ColonyMonument position={[0, 6.6]} color="#b97bf0" />

      <ShrubCluster position={[-12.2, -10.4]} scale={1.1} />
      <ShrubCluster position={[-10.7, -9.2]} flower scale={0.8} />
      <ShrubCluster position={[11.4, -10.6]} flower scale={1.0} />
      <ShrubCluster position={[13.0, -8.9]} scale={0.78} />
      <ShrubCluster position={[-12.4, 4.4]} flower scale={0.85} />
      <ShrubCluster position={[12.6, 4.8]} scale={0.82} />
      <ShrubCluster position={[-10.9, 11.2]} scale={0.8} />
      <ShrubCluster position={[11.2, 11.5]} flower scale={0.86} />

      
      <CivicPlazaStatue position={[0, -3.25]} mars={mars} />
      <CivicPlazaStatue position={[0, 7.55]} mars={mars} />
      <ColonyBanner position={[-4.0, -2.9]} accent="#54dfe9" mars={mars} />
      <ColonyBanner position={[4.0, -2.9]} accent="#f2c65e" mars={mars} />
      <ColonyBanner position={[-4.0, 7.0]} accent="#b878ef" mars={mars} />
      <ColonyBanner position={[4.0, 7.0]} accent="#5ed9e5" mars={mars} />
      <WorkshopYard position={[-13.0, -2.0]} index={0} />
      <WorkshopYard position={[12.8, 4.8]} index={1} />
      <WorkshopYard position={[-12.4, 7.1]} index={2} />
      <WorkshopYard position={[12.1, -1.0]} index={3} />

      {decorativeTrees.map(([x, z, scale, flower], index) => (
        <DecorativeTree key={index} position={[x, z]} scale={scale} flower={flower} mars={mars} />
      ))}

      {gardens.map(([x, z, scale], index) => (
        <GardenPatch key={index} position={[x, z]} scale={scale} flower={!mars || index % 2 === 0} />
      ))}

      {lamps.map(([x, z], index) => (
        <StreetLamp key={index} position={[x, z]} mars={mars} />
      ))}

      <SmallColonyBuilding position={[-14.1, -8.9]} index={2} mars={mars} />
      <SmallColonyBuilding position={[-11.9, -8.3]} index={4} mars={mars} />
      <SmallColonyBuilding position={[10.9, -9.0]} index={3} mars={mars} />
      <SmallColonyBuilding position={[13.3, -8.1]} index={5} mars={mars} />
      <SmallColonyBuilding position={[-13.4, 4.2]} index={1} mars={mars} />
      <SmallColonyBuilding position={[13.6, 4.2]} index={0} mars={mars} />
      <SmallColonyBuilding position={[-13.2, 8.8]} index={3} mars={mars} />
      <SmallColonyBuilding position={[13.0, 9.2]} index={4} mars={mars} />
            <SmallColonyBuilding position={[-13.1, -9.0]} index={0} mars={mars} />
      <SmallColonyBuilding position={[-10.9, -7.6]} index={1} mars={mars} />
      <SmallColonyBuilding position={[10.8, -9.0]} index={2} mars={mars} />
      <SmallColonyBuilding position={[12.9, -6.8]} index={3} mars={mars} />
      <SmallColonyBuilding position={[-12.3, 0.5]} index={4} mars={mars} />
      <SmallColonyBuilding position={[12.6, 2.0]} index={5} mars={mars} />
      <SmallColonyBuilding position={[-11.8, 8.1]} index={0} mars={mars} />
      <SmallColonyBuilding position={[12.2, 9.6]} index={1} mars={mars} />
      <StorageYard position={[-13.1, -4.0]} mars={mars} />
      <StorageYard position={[12.6, -3.8]} mars={mars} />
      <CanopyMarket position={[3.1, -9.0]} mars={mars} />
      <CanopyMarket position={[-3.3, 8.1]} mars={mars} />
      <HydroponicPlanter position={[-7.9, -8.4]} mars={mars} />
      <HydroponicPlanter position={[7.8, -9.1]} mars={mars} />
      <HydroponicPlanter position={[-8.5, 8.2]} mars={mars} />
      <HydroponicPlanter position={[8.6, 8.8]} mars={mars} />
      <FenceRow from={[-14.8, 1.8]} to={[-12.0, 1.8]} />
      <FenceRow from={[11.5, 5.2]} to={[14.8, 5.2]} />
      <FenceRow from={[-5.2, 12.2]} to={[-1.0, 12.2]} />
      <FenceRow from={[1.8, 12.8]} to={[5.7, 12.8]} />
      <CrateCluster position={[-13.7, -6.7]} large />
      <CrateCluster position={[13.5, -6.8]} />
      <CrateCluster position={[13.6, 8.6]} />
      <CrateCluster position={[-12.8, 9.0]} />

      <PlazaTower position={[-2.65, -2.65]} color="#57dce7" />
      <PlazaTower position={[2.65, -2.65]} color="#57dce7" />
      <PlazaTower position={[-2.65, 2.65]} color="#57dce7" />
      <PlazaTower position={[2.65, 2.65]} color="#57dce7" />

      <SettlerCrowd mars={mars} />

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

      <OrbitControls
        enableRotate={false}
        enablePan={false}
        enableZoom
        minDistance={34}
        maxDistance={82}
        zoomSpeed={0.6}
        target={[0, 0.9, 1.1]}
      />
    </Canvas>
  );
}

export function Colony3DMap(props: Props) {
  return <MissionScene {...props} />;
}
