import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Text } from "@react-three/drei";
import * as THREE from "three";
import type { TechnologyTrack, Tier } from "./_shared/gameData";
import type { BuildingRuntime } from "./missionRuntime";
import { terrainHeight, Terrain, Rocks } from "./solar-surface/terrain";
import { DustParticles } from "./solar-surface/dust-particles";

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

function PulseRing({ color, y, radius = 1.5 }: { color: string; y: number; radius?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * 2.3;
    ref.current.scale.setScalar(0.9 + (Math.sin(t) + 1) * 0.12);
    ref.current.rotation.z = t * 0.16;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <ringGeometry args={[radius, radius + 0.08, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} />
    </mesh>
  );
}

function SolarEquipment({ level, dust }: { level: number; dust: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.26) * 0.045;
  });
  const clean = dust < 25;
  return (
    <group ref={ref} position={[0, 1.25 + level * 0.12, 0]}>
      {Array.from({ length: 3 + level }).map((_, index) => (
        <mesh key={index} castShadow position={[(index - 1 - level / 2) * 0.72, 0, 0]} rotation={[0.14, -0.52, 0]}>
          <boxGeometry args={[0.62, 0.08, 1.15 + level * 0.1]} />
          <meshStandardMaterial color={clean ? "#3ba8dc" : "#767064"} emissive={clean ? "#0d607e" : "#382f25"} emissiveIntensity={clean ? 0.5 : 0.08} roughness={0.42} metalness={0.32} />
        </mesh>
      ))}
      <mesh castShadow position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.62, 10]} />
        <meshStandardMaterial color="#d6cfb4" metalness={0.55} roughness={0.35} />
      </mesh>
      <pointLight color="#56d7ff" intensity={clean ? 1.2 : 0.3} distance={4} />
    </group>
  );
}

function StandardBuilding({ track, tier, runtime, selected, alerted, position, onClick }: {
  track: TechnologyTrack;
  tier: Tier;
  runtime: BuildingRuntime;
  selected: boolean;
  alerted: boolean;
  position: [number, number];
  onClick: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const orbRef = useRef<THREE.Mesh>(null);
  const y = terrainHeight(position[0], position[1]);
  const level = tier === "Foundation" ? 0 : tier === "Frontier" ? 1 : tier === "Apex" ? 2 : 3;
  const h = 1.15 + level * 0.32;
  const c = tierColor(tier);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.position.y = y + Math.sin(t * 1.8 + position[0] * 0.4) * 0.055;
    }
    if (beaconRef.current) {
      beaconRef.current.rotation.y = t * (1.7 + level * 0.25);
      beaconRef.current.scale.setScalar(0.92 + (Math.sin(t * 4 + position[1]) + 1) * 0.055);
    }
    if (orbRef.current) {
      orbRef.current.position.y = h + 0.64 + Math.sin(t * 3.2 + position[0]) * 0.09;
    }
  });

  return (
    <group ref={groupRef} position={[position[0], y, position[1]]} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      {selected && <PulseRing color="#ffe66b" y={0.08} radius={1.18 + level * 0.14} />}
      {alerted && <PulseRing color="#ff3f68" y={0.12} radius={1.46 + level * 0.14} />}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[1.7 + level * 0.32, h, 1.45 + level * 0.25]} />
        <meshStandardMaterial color="#27343d" roughness={0.7} metalness={0.28} />
      </mesh>
      <mesh castShadow position={[0, h * 0.62, 0.73]}>
        <boxGeometry args={[1.32 + level * 0.18, 0.36, 0.08]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.32} roughness={0.35} metalness={0.18} />
      </mesh>
      <mesh castShadow position={[0, h + 0.22, 0]}>
        <cylinderGeometry args={[0.75 + level * 0.08, 0.9 + level * 0.08, 0.4, 6]} />
        <meshStandardMaterial color={c} roughness={0.4} metalness={0.3} emissive={c} emissiveIntensity={0.3} />
      </mesh>
      <mesh ref={beaconRef} position={[0, h + 0.62, 0]}>
        <octahedronGeometry args={[0.18 + level * 0.035, 0]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.5} roughness={0.18} metalness={0.15} />
      </mesh>
      <mesh position={[0.72, h + 0.45, 0.32]}>
        <sphereGeometry args={[0.11, 12, 8]} />
        <meshStandardMaterial color={statusColor(runtime.condition)} emissive={statusColor(runtime.condition)} emissiveIntensity={1.05} />
      </mesh>
      <pointLight color={c} intensity={selected || alerted ? 1.6 : 0.6} distance={3.8} />
      {track.id === "solar" && <SolarEquipment level={level} dust={runtime.dust} />}
      {track.id === "habitat" && (
        <mesh castShadow position={[0, h + 0.85, 0]}>
          <sphereGeometry args={[0.96 + level * 0.12, 24, 16]} />
          <meshStandardMaterial color="#56b7b2" roughness={0.38} metalness={0.14} emissive="#164c50" emissiveIntensity={0.22} />
        </mesh>
      )}
      {track.id !== "solar" && track.id !== "habitat" && (
        <mesh ref={orbRef} position={[0, h + 0.64, 0]}>
          <sphereGeometry args={[0.24 + level * 0.045, 16, 12]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.15} roughness={0.2} metalness={0.2} />
        </mesh>
      )}
      <Text position={[0, h + (track.id === "solar" ? 2.0 : 1.48), 0]} rotation={[-0.66, 0, 0]} fontSize={0.34} color={selected ? "#fff2a7" : "#ffffff"} outlineWidth={0.045} outlineColor="#111820" anchorX="center">
        {track.category}
      </Text>
    </group>
  );
}

function Rover({ selected, alerted, task, position, onClick }: {
  selected: boolean;
  alerted: boolean;
  task: string;
  position: [number, number];
  onClick: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current || task === "RETURNING") return;
    const t = clock.getElapsedTime() * 0.42;
    ref.current.position.x = Math.sin(t) * 5.5;
    ref.current.position.z = 12 + Math.cos(t * 0.82) * 3.4;
    ref.current.position.y = terrainHeight(ref.current.position.x, ref.current.position.z) + 0.72;
    ref.current.rotation.y = Math.atan2(Math.cos(t * 0.82), -Math.cos(t));
  });
  return (
    <group ref={ref} position={[position[0], terrainHeight(position[0], position[1]) + 0.72, position[1]]} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      {selected && <PulseRing color="#ffe18a" y={-0.58} radius={0.9} />}
      {alerted && <PulseRing color="#ff6e52" y={-0.55} radius={1.1} />}
      <mesh castShadow>
        <boxGeometry args={[1.35, 0.34, 0.92]} />
        <meshStandardMaterial color="#d4c48e" roughness={0.75} metalness={0.24} />
      </mesh>
      <mesh castShadow position={[0, 0.33, 0]}>
        <boxGeometry args={[0.38, 0.46, 0.38]} />
        <meshStandardMaterial color="#4c858d" roughness={0.52} metalness={0.18} emissive="#1e6570" emissiveIntensity={0.4} />
      </mesh>
      {[-0.48, 0.48].flatMap((x) => [-0.31, 0.31].map((z) => (
        <mesh key={String(x) + String(z)} rotation={[Math.PI / 2, 0, 0]} position={[x, -0.24, z]}>
          <cylinderGeometry args={[0.19, 0.19, 0.18, 12]} />
          <meshStandardMaterial color="#262d31" roughness={0.92} />
        </mesh>
      )))}
      <pointLight color="#ffd36f" intensity={1.25} distance={3.6} />
      <Text position={[0, 1.05, 0]} rotation={[-0.66, 0, 0]} fontSize={0.3} color="#ffeab5" outlineWidth={0.03} outlineColor="#1a201f">
        {task}
      </Text>
    </group>
  );
}

function ResourceMarker({ node, surveyed, selected, onClick, elapsed }: {
  node: MissionResourceNode;
  surveyed: boolean;
  selected: boolean;
  onClick: () => void;
  elapsed: number;
}) {
  const [x, z] = nodeWorldPosition(node);
  const y = terrainHeight(x, z);
  const color = node.kind === "ICE" ? "#67ddf7" : node.kind === "MINERAL" ? "#f3c95f" : node.kind === "SCIENCE" ? "#c49aed" : "#b09c7b";
  return (
    <group position={[x, y + 0.42, z]} scale={selected ? 1.18 : 1} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      <mesh scale={1 + Math.sin(elapsed * 2.5 + x) * 0.12}>
        <octahedronGeometry args={[0.48, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} roughness={0.3} metalness={0.16} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]}>
        <ringGeometry args={[0.58, selected ? 0.84 : 0.72, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.48} />
      </mesh>
      <Text position={[0, 0.83, 0]} rotation={[-0.66, 0, 0]} fontSize={0.27} color="#fff0bd" outlineWidth={0.03} outlineColor="#3a2b1c" anchorX="center">
        {surveyed ? "SURVEYED" : node.label}
      </Text>
    </group>
  );
}

function MissionScene(props: Props) {
  const mars = props.environmentLabel === "MARS";
  return (
    <Canvas shadows dpr={[1, 1.25]} camera={{ position: [23, 20, 25], fov: 40, near: 0.1, far: 220 }} gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}>
      <color attach="background" args={[mars ? "#3a1714" : "#08051a"]} />
      <fog attach="fog" args={[mars ? "#4d2d25" : "#13171f", 52, 112]} />
      <ambientLight intensity={0.48} color={mars ? "#ffd0b8" : "#bcd5ff"} />
      <hemisphereLight args={[mars ? "#ffe0cf" : "#eef4ff", mars ? "#3d201b" : "#1f1738", 0.86]} />
      <directionalLight position={[17, 28, 13]} intensity={2.3} color="#fff5df" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-near={1} shadow-camera-far={100} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
      <Stars radius={95} depth={60} count={1700} factor={2.8} saturation={0} fade speed={0.45} />
      <Terrain kind={mars ? "mars" : "moon"} />
      <Rocks kind={mars ? "mars" : "moon"} />
      {props.buildings.solar?.dust && props.buildings.solar.dust > 18 ? <DustParticles kind={mars ? "mars" : "moon"} dust={props.buildings.solar.dust} /> : null}
      <FoundationPad />
      <ConnectionPaths />
      {props.resourceNodes.map((node) => (
        <ResourceMarker key={node.id} node={node} surveyed={props.surveyedNodes.includes(node.id)} selected={props.selectedResourceId === node.id} elapsed={props.elapsed} onClick={() => props.onSelectResource(node)} />
      ))}
      {props.tracks.filter((track) => track.id !== "rover").map((track) => (
        <StandardBuilding
          key={track.id}
          track={track}
          tier={props.selected[track.id]}
          runtime={props.buildings[track.id] ?? { condition: 100, dust: 0, status: "ONLINE" }}
          selected={props.selectedBuildingId === track.id}
          alerted={props.activeEventTrackId === track.id}
          position={POSITIONS[track.id] ?? [0, 0]}
          onClick={() => props.onSelect(track.id)}
        />
      ))}
      {props.selected.rover && (
        <Rover
          selected={props.selectedBuildingId === "rover"}
          alerted={props.activeEventTrackId === "rover"}
          task={props.roverTask}
          position={POSITIONS.rover}
          onClick={() => props.onSelect("rover")}
        />
      )}
      <Text position={[0, 5.1, -1.5]} rotation={[-0.66, 0, 0]} fontSize={0.46} color="#fff0c2" outlineWidth={0.045} outlineColor="#191816" anchorX="center">
        {props.environmentLabel + " OUTPOST"}
      </Text>
      <OrbitControls enableDamping dampingFactor={0.08} enablePan minDistance={14} maxDistance={38} minPolarAngle={0.5} maxPolarAngle={1.25} target={[0, 0, 2]} />
    </Canvas>
  );
}

export function Colony3DMap(props: Props) {
  return <MissionScene {...props} />;
}
