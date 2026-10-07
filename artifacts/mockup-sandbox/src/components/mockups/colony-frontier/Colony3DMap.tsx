import { useRef } from "react";
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
  solar: [-11, -6],
  comms: [7, -8],
  habitat: [0, 0],
  battery: [6.5, 2],
  oxygen: [-8, 6.5],
  water: [6, 8],
  radiation: [13, -1],
  navigation: [11, 6.5],
  rover: [-1, 12.5],
  thermal: [-14, 10],
  grid: [5.5, 13],
  science: [14, 9],
  extraction: [0, 16],
  isru: [16, 16],
  agriculture: [-9, 16],
  maintenance: [4, -6],
};

function nodeWorldPosition(node: MissionResourceNode): [number, number] {
  return [(node.x - 500) / 22, (node.y - 300) / 10];
}

function statusColor(condition: number) {
  return condition < 55 ? "#ff775c" : condition < 82 ? "#f4c75d" : "#73e1a0";
}

function tierColor(tier: Tier) {
  return tier === "Foundation"
    ? "#56e57a"
    : tier === "Frontier"
      ? "#16c8ff"
      : tier === "Apex"
        ? "#b65cff"
        : "#ff9d32";
}

function FoundationPad() {
  const pads: Array<[number, number, number, number]> = [
    [-11, -6, 4.2, 2.5],
    [0, 0, 6.8, 6.2],
    [7, 2, 3.4, 2.6],
    [-8, 6.5, 3.2, 2.5],
    [6, 8, 3.5, 2.7],
    [-1, 12.5, 4.2, 3.2],
  ];
  return (
    <group>
      {pads.map(([x, z, w, d], index) => {
        const y = terrainHeight(x, z) + 0.08;
        return (
          <group key={index}>
            <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[w, d]} />
              <meshStandardMaterial color={index === 1 ? "#344b58" : "#42515a"} roughness={0.82} metalness={0.16} />
            </mesh>
            <mesh position={[x, y + 0.035, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[Math.min(w, d) * 0.34, Math.min(w, d) * 0.39, 32]} />
              <meshBasicMaterial color={index === 1 ? "#22d3ee" : "#4ade80"} transparent opacity={0.22} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function ConnectionPaths() {
  const paths: Array<[number, number, number, number, number]> = [
    [-5.5, -3, 0.9, 10.2, 0.2],
    [3.4, 1.2, 0.8, 9.2, 0.55],
    [1.5, 4.8, 0.8, 7.8, 1.05],
    [-5.2, 8.2, 0.7, 6.6, -0.78],
  ];
  return (
    <group>
      {paths.map(([x, z, w, length, rot], index) => (
        <mesh key={index} position={[x, terrainHeight(x, z) + 0.11, z]} rotation={[-Math.PI / 2, 0, rot]} receiveShadow>
          <planeGeometry args={[w, length]} />
          <meshStandardMaterial color="#b3a17c" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function SelectionRing({ selected, alerted, radius }: { selected: boolean; alerted: boolean; radius: number }) {
  if (!selected && !alerted) return null;
  return (
    <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius, radius + 0.12, 28]} />
      <meshBasicMaterial color={alerted ? "#ff4e58" : "#ffe25a"} />
    </mesh>
  );
}

function BoxBuilding({ color, height = 1.5, width = 1.7, depth = 1.45 }: {
  color: string;
  height?: number;
  width?: number;
  depth?: number;
}) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#4a5051" roughness={0.85} metalness={0.12} />
      </mesh>
      <mesh castShadow position={[0, height + 0.16, 0]}>
        <boxGeometry args={[width * 0.9, 0.24, depth * 0.9]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, height * 0.56, depth / 2 + 0.02]}>
        <boxGeometry args={[width * 0.68, 0.3, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

function Tank({ color, x, z }: { color: string; x: number; z: number }) {
  return (
    <group position={[x, 0.18, z]}>
      <mesh castShadow position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.34, 0.4, 1.28, 12]} />
        <meshStandardMaterial color="#d4dcda" roughness={0.5} metalness={0.28} />
      </mesh>
      <mesh position={[0, 1.42, 0]}>
        <cylinderGeometry args={[0.39, 0.39, 0.12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function UniqueBuilding({ id, color, task }: { id: string; color: string; task: string }) {
  if (id === "solar") return (
    <group>
      <BoxBuilding color={color} height={1.1} width={1.55} depth={1.35} />
      <group position={[0, 1.05, 0]} rotation={[0.08, -0.35, 0]}>
        {[-0.62, 0, 0.62].map((x) => (
          <mesh key={x} castShadow position={[x, 0.18, 0]}>
            <boxGeometry args={[0.5, 0.08, 1.05]} />
            <meshStandardMaterial color="#238fd0" metalness={0.3} roughness={0.38} />
          </mesh>
        ))}
      </group>
    </group>
  );

  if (id === "habitat") return (
    <group>
      <mesh castShadow position={[0, 0.72, 0]}>
        <cylinderGeometry args={[1.2, 1.34, 1.2, 12]} />
        <meshStandardMaterial color="#50575a" roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 1.45, 0]}>
        <sphereGeometry args={[1.15, 24, 14]} />
        <meshStandardMaterial color="#61b2c1" emissive="#215d66" emissiveIntensity={0.18} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.48, 0]}>
        <torusGeometry args={[0.55, 0.07, 8, 24]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.0, 1.18]}>
        <boxGeometry args={[1.2, 0.28, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );

  if (id === "comms") return (
    <group>
      <BoxBuilding color={color} height={1.15} />
      <mesh position={[0, 1.95, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 1.55, 10]} />
        <meshStandardMaterial color="#e0e5e3" metalness={0.65} roughness={0.22} />
      </mesh>
      <mesh position={[0, 2.25, 0]} rotation={[Math.PI / 2.75, 0, 0]}>
        <sphereGeometry args={[0.52, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
        <meshStandardMaterial color={color} roughness={0.32} metalness={0.12} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );

  if (id === "navigation") return (
    <group>
      <BoxBuilding color={color} height={1.1} width={1.45} depth={1.3} />
      <mesh position={[0, 2.05, 0]}>
        <cylinderGeometry args={[0.13, 0.18, 1.65, 10]} />
        <meshStandardMaterial color="#e6ece9" metalness={0.6} roughness={0.22} />
      </mesh>
      <mesh position={[0, 2.85, 0]}>
        <coneGeometry args={[0.26, 0.46, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0.55, 0]} position={[0, 2.35, 0]}>
        <torusGeometry args={[0.58, 0.05, 8, 24]} />
        <meshBasicMaterial color="#ff63d8" />
      </mesh>
    </group>
  );

  if (id === "oxygen" || id === "water") return (
    <group>
      <BoxBuilding color={color} height={1.08} />
      <Tank color={id === "oxygen" ? "#72edff" : "#48baff"} x={-0.5} z={0.42} />
      <Tank color={id === "oxygen" ? "#72edff" : "#48baff"} x={0.5} z={0.42} />
    </group>
  );

  if (id === "battery") return (
    <group>
      <BoxBuilding color={color} height={1.25} />
      {[-0.45, 0, 0.45].map((x) => (
        <mesh key={x} position={[x, 1.48, 0]}>
          <boxGeometry args={[0.22, 0.65, 0.22]} />
          <meshStandardMaterial color={x === 0 ? "#55efff" : color} emissive={x === 0 ? "#08d7e8" : color} emissiveIntensity={0.65} />
        </mesh>
      ))}
    </group>
  );

  if (id === "radiation") return (
    <group>
      <BoxBuilding color={color} height={1.12} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 1.58 + i * 0.3, 0]}>
          <torusGeometry args={[0.4 + i * 0.07, 0.045, 8, 22]} />
          <meshBasicMaterial color={i === 1 ? "#ffe54e" : color} />
        </mesh>
      ))}
    </group>
  );

  if (id === "science") return (
    <group>
      <mesh castShadow position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.9, 1.04, 1.15, 10]} />
        <meshStandardMaterial color="#505865" roughness={0.74} metalness={0.18} />
      </mesh>
      <mesh castShadow position={[0, 1.45, 0]}>
        <sphereGeometry args={[0.76, 20, 12]} />
        <meshStandardMaterial color="#7a5aa8" emissive="#532a88" emissiveIntensity={0.42} roughness={0.32} />
      </mesh>
      <mesh position={[0, 1.48, 0]}>
        <torusGeometry args={[0.6, 0.05, 8, 24]} />
        <meshBasicMaterial color="#5beaff" />
      </mesh>
    </group>
  );

  if (id === "extraction" || id === "isru") return (
    <group>
      <BoxBuilding color={color} height={1.4} width={1.85} depth={1.5} />
      <mesh castShadow position={[0, 2.05, 0]}>
        <cylinderGeometry args={[0.32, 0.45, 0.85, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 1.02, 0]}>
        <coneGeometry args={[0.18, 0.9, 8]} />
        <meshStandardMaterial color="#ccd5d1" metalness={0.7} roughness={0.22} />
      </mesh>
      {id === "isru" && (
        <mesh position={[0.58, 1.7, 0.45]}>
          <cylinderGeometry args={[0.22, 0.26, 1.0, 10]} />
          <meshStandardMaterial color="#73d8d2" emissive="#2a9994" emissiveIntensity={0.32} />
        </mesh>
      )}
    </group>
  );

  if (id === "agriculture") return (
    <group>
      <mesh castShadow position={[0, 0.66, 0]}>
        <boxGeometry args={[2.0, 1.0, 1.42]} />
        <meshStandardMaterial color="#30534b" transparent opacity={0.92} roughness={0.36} />
      </mesh>
      <mesh position={[0, 1.28, 0]}>
        <boxGeometry args={[2.12, 0.08, 1.52]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {[-0.5, 0, 0.5].map((x) => (
        <mesh key={x} position={[x, 1.0, 0]}>
          <sphereGeometry args={[0.14, 12, 8]} />
          <meshStandardMaterial color="#70ff89" emissive="#2df05a" emissiveIntensity={0.8} />
        </mesh>
      ))}
    </group>
  );

  if (id === "thermal") return (
    <group>
      <BoxBuilding color={color} height={1.15} />
      {[-0.45, 0, 0.45].map((x) => (
        <mesh key={x} position={[x, 1.6, 0]}>
          <cylinderGeometry args={[0.14, 0.18, 0.72, 10]} />
          <meshStandardMaterial color="#d9dfdc" metalness={0.55} roughness={0.24} />
        </mesh>
      ))}
    </group>
  );

  if (id === "grid") return (
    <group>
      <BoxBuilding color={color} height={1.22} />
      <mesh position={[0, 1.82, 0]}>
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial color="#59eaff" emissive="#1bdfff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 1.24, 0.75]}>
        <boxGeometry args={[1.24, 0.38, 0.05]} />
        <meshStandardMaterial color="#ffdc53" emissive="#ffbf00" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );

  if (id === "maintenance") return (
    <group>
      <BoxBuilding color={color} height={1.18} width={1.8} depth={1.5} />
      <mesh position={[0, 2.0, 0]}>
        <boxGeometry args={[0.12, 1.15, 0.12]} />
        <meshStandardMaterial color="#d5dad6" metalness={0.6} roughness={0.25} />
      </mesh>
      <mesh position={[0.28, 2.32, 0]}>
        <boxGeometry args={[0.7, 0.1, 0.1]} />
        <meshStandardMaterial color="#d5dad6" metalness={0.6} roughness={0.25} />
      </mesh>
    </group>
  );

  if (id === "rover") return (
    <group>
      <mesh castShadow position={[0, 0.34, 0]}>
        <boxGeometry args={[1.45, 0.36, 0.95]} />
        <meshStandardMaterial color="#ebc969" roughness={0.62} metalness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.72, 0]}>
        <boxGeometry args={[0.42, 0.5, 0.42]} />
        <meshStandardMaterial color="#1fd9e3" emissive="#08b8c4" emissiveIntensity={0.55} />
      </mesh>
      {[[-0.5, -0.35], [-0.5, 0.35], [0.5, -0.35], [0.5, 0.35]].map(([x, z]) => (
        <mesh key={String(x) + String(z)} position={[x, 0.08, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.18, 12]} />
          <meshStandardMaterial color="#24282b" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0.42, 0.78, 0]}>
        <boxGeometry args={[0.08, 0.08, 0.72]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
      </mesh>
      <Text position={[0, 1.22, 0]} rotation={[-0.66, 0, 0]} fontSize={0.22} color="#fff0a6" outlineWidth={0.03} outlineColor="#1b1d21" anchorX="center">
        {task}
      </Text>
    </group>
  );

  return <BoxBuilding color={color} />;
}

function BuildingIdleMotion({ color, level, active }: { color: string; level: number; active: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const orbRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 1.35 + level * 0.7) * 0.045;
      groupRef.current.rotation.z = Math.sin(t * 0.8 + level) * 0.012;
    }
    if (orbRef.current) {
      orbRef.current.rotation.y = t * (0.8 + level * 0.2);
      const pulse = active ? 1.12 : 0.9 + (Math.sin(t * 2.8 + level) + 1) * 0.035;
      orbRef.current.scale.setScalar(pulse);
    }
  });
  return (
    <group ref={groupRef} position={[0, 0.05, 0]}>
      <mesh ref={orbRef} position={[0, 2.0 + level * 0.08, 0]}>
        <octahedronGeometry args={[0.11 + level * 0.025, 0]} />
        <meshStandardMaterial color={active ? "#fff066" : color} emissive={active ? "#ffba35" : color} emissiveIntensity={active ? 1.6 : 0.75} />
      </mesh>
    </group>
  );
}

function RoverWorld({ task, position, resourceNodes, selected, alerted, onClick }: {
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
    const duration = active ? 0.18 : 0;
    const p = active ? (Math.sin(t * duration) + 1) / 2 : 0;
    const from = task === "RETURNING" ? destination : home;
    const to = task === "RETURNING" ? home : destination;
    const x = THREE.MathUtils.lerp(from[0], to[0], p);
    const z = THREE.MathUtils.lerp(from[1], to[1], p);
    const nx = THREE.MathUtils.lerp(from[0], to[0], Math.min(1, p + 0.02));
    const nz = THREE.MathUtils.lerp(from[1], to[1], Math.min(1, p + 0.02));
    ref.current.position.set(x, terrainHeight(x, z) + 0.62, z);
    if (Math.abs(nx - x) + Math.abs(nz - z) > 0.02) {
      ref.current.rotation.y = Math.atan2(nx - x, nz - z);
    }
    if (scannerRef.current) {
      const atSite = !!resource && Math.hypot(x - destination[0], z - destination[1]) < 1.1;
      scannerRef.current.scale.setScalar(atSite ? 0.85 + (Math.sin(t * 5) + 1) * 0.25 : 0.25);
      (scannerRef.current.material as THREE.MeshBasicMaterial).opacity = atSite ? 0.55 : 0.12;
    }
  });
  return (
    <group ref={ref} position={[position[0], terrainHeight(position[0], position[1]) + 0.62, position[1]]} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      <SelectionRing selected={selected} alerted={alerted} radius={1.08} />
      <mesh castShadow><boxGeometry args={[1.45, 0.34, 0.95]} /><meshStandardMaterial color="#e7c66b" roughness={0.66} metalness={0.28} /></mesh>
      <mesh castShadow position={[0, 0.38, 0]}><boxGeometry args={[0.43, 0.48, 0.43]} /><meshStandardMaterial color="#22d9e3" emissive="#0fc6d0" emissiveIntensity={0.7} /></mesh>
      {[[-0.5, -0.36], [-0.5, 0.36], [0.5, -0.36], [0.5, 0.36]].map(([x, z]) => (
        <mesh key={String(x)+String(z)} position={[x, -0.18, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.18, 12]} /><meshStandardMaterial color="#25292d" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0.44, 0.54, 0]}><boxGeometry args={[0.08, 0.08, 0.72]} /><meshStandardMaterial color="#ffda52" emissive="#ffbd18" emissiveIntensity={0.65} /></mesh>
      <mesh ref={scannerRef} position={[0, -0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.58, 0.86, 28]} /><meshBasicMaterial color="#54eaff" transparent opacity={0.12} />
      </mesh>
      <Text position={[0, 1.12, 0]} rotation={[-0.66, 0, 0]} fontSize={0.22} color="#fff0a7" outlineWidth={0.03} outlineColor="#171a20" anchorX="center">{task}</Text>
    </group>
  );
}

function ColonyBuilding({ track, tier, runtime, selected, alerted, position, roverTask, resourceNodes, onClick }: {
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
    return <RoverWorld task={roverTask} position={position} resourceNodes={resourceNodes} selected={selected} alerted={alerted} onClick={onClick} />;
  }

  return (
    <group
      position={[position[0], y, position[1]]}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
    >
      <SelectionRing selected={selected} alerted={alerted} radius={track.id === "habitat" ? 1.82 : 1.3} />
      <BuildingIdleMotion color={color} level={level} active={alerted} />
      <StaticBuildingArt id={track.id} color={color} task={roverTask} />
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.26, 18]} />
        <meshBasicMaterial color={statusColor(runtime.condition)} />
      </mesh>
      <Text position={[0, track.id === "habitat" ? 2.7 : 2.3, 0]} rotation={[-0.66, 0, 0]} fontSize={0.29} color={selected ? "#fff2a3" : "#ffffff"} outlineWidth={0.045} outlineColor="#171d24" anchorX="center">
        {track.category}
      </Text>
      <Text position={[0, track.id === "habitat" ? 2.38 : 2.0, 0]} rotation={[-0.66, 0, 0]} fontSize={0.17} color={color} outlineWidth={0.025} outlineColor="#171d24" anchorX="center">
        {tier}
      </Text>
    </group>
  );
}

function WorkerBots() {
  const refs = useRef<THREE.Group[]>([]);
  const routes: Array<[[number, number], [number, number]]> = [
    [[-9, -4], [0, 0]],
    [[2, 1], [6, 8]],
    [[-2, 11], [11, 6]],
  ];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((group, index) => {
      if (!group) return;
      const [a, b] = routes[index];
      const p = (Math.sin(t * (0.35 + index * 0.06) + index) + 1) / 2;
      const x = THREE.MathUtils.lerp(a[0], b[0], p);
      const z = THREE.MathUtils.lerp(a[1], b[1], p);
      const nx = THREE.MathUtils.lerp(a[0], b[0], Math.min(1, p + 0.03));
      const nz = THREE.MathUtils.lerp(a[1], b[1], Math.min(1, p + 0.03));
      group.position.set(x, terrainHeight(x, z) + 0.35, z);
      group.rotation.y = Math.atan2(nx - x, nz - z);
      group.position.y += Math.abs(Math.sin(t * 7 + index)) * 0.045;
    });
  });

  return (
    <group>
      {routes.map((_, index) => (
        <group key={index} ref={(node) => { if (node) refs.current[index] = node; }}>
          <mesh castShadow position={[0, 0.22, 0]} scale={[0.72, 1, 0.72]}>
            <sphereGeometry args={[0.22, 12, 8]} />
            <meshStandardMaterial color={index === 1 ? "#ff8b4d" : index === 2 ? "#8f7cff" : "#f5d35c"} roughness={0.72} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.12, 12, 8]} />
            <meshStandardMaterial color="#f3eee1" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.54, 0.1]}>
            <sphereGeometry args={[0.045, 8, 6]} />
            <meshStandardMaterial color="#3de4ff" emissive="#3de4ff" emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ResourceMarker({ node, surveyed, selected, onClick }: {
  node: MissionResourceNode;
  surveyed: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const [x, z] = nodeWorldPosition(node);
  const y = terrainHeight(x, z);
  const color = node.kind === "ICE"
    ? "#58e3ff"
    : node.kind === "MINERAL"
      ? "#ffd257"
      : node.kind === "SCIENCE"
        ? "#cc8cff"
        : "#b39c7f";

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const pulse = selected ? 1.08 + (Math.sin(t * 4) + 1) * 0.045 : 0.96 + (Math.sin(t * 2.2 + x) + 1) * 0.02;
    ref.current.scale.setScalar(pulse);
  });

  return (
    <group ref={ref} position={[x, y + 0.36, z]} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      <mesh>
        <octahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.85 : 0.48} roughness={0.34} metalness={0.14} />
      </mesh>
      <mesh position={[0, -0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.54, selected ? 0.8 : 0.66, 24]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Text position={[0, 0.72, 0]} rotation={[-0.66, 0, 0]} fontSize={0.22} color="#fff3c5" outlineWidth={0.025} outlineColor="#3b2c20" anchorX="center">
        {surveyed ? "SURVEYED" : node.label}
      </Text>
    </group>
  );
}

function MissionScene(props: Props) {
  const mars = props.environmentLabel === "MARS";

  return (
    <Canvas
      shadows
      dpr={[1, 1.25]}
      camera={{ position: [23, 20, 25], fov: 42, near: 0.1, far: 220 }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <color attach="background" args={[mars ? "#7a3f31" : "#5e5b60"]} />
      <fog attach="fog" args={[mars ? "#925b49" : "#6b6870", 55, 112]} />
      <ambientLight intensity={0.78} color={mars ? "#ffe0d0" : "#e4ebf7"} />
      <hemisphereLight args={[mars ? "#ffe8db" : "#f2f6ff", mars ? "#43241f" : "#34313b", 0.92]} />
      <directionalLight
        position={[17, 28, 13]}
        intensity={2.25}
        color="#fff1d9"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={100}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />

      <Terrain kind={mars ? "mars" : "moon"} />
      <Rocks kind={mars ? "mars" : "moon"} />
      <FoundationPad />
      <ConnectionPaths />
      <WorkerBots />

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
          tier={props.selected[track.id]}
          runtime={props.buildings[track.id] ?? { condition: 100, dust: 0, status: "ONLINE" }}
          selected={props.selectedBuildingId === track.id}
          alerted={props.activeEventTrackId === track.id}
          position={POSITIONS[track.id] ?? [0, 0]}
          roverTask={props.roverTask}
          resourceNodes={props.resourceNodes}
          onClick={() => props.onSelect(track.id)}
        />
      ))}

      <Text
        position={[0, 5.0, -1.5]}
        rotation={[-0.66, 0, 0]}
        fontSize={0.5}
        color="#fff0ad"
        outlineWidth={0.055}
        outlineColor="#231e1c"
        anchorX="center"
      >
        {props.environmentLabel + " OUTPOST"}
      </Text>

      <OrbitControls
        enableRotate={false}
        enablePan={false}
        enableZoom
        minDistance={14}
        maxDistance={38}
        zoomSpeed={0.9}
        target={[0, 0, 2]}
      />
    </Canvas>
  );
}

export function Colony3DMap(props: Props) {
  return <MissionScene {...props} />;
}
