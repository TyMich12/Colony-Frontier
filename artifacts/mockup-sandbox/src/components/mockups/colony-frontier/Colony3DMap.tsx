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

function AnimatedBuildingDetails({ id, color, h, level }: { id: string; color: string; h: number; level: number }) {
  const mainRef = useRef<THREE.Group>(null);
  const secondaryRef = useRef<THREE.Group>(null);
  const tertiaryRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (mainRef.current) mainRef.current.rotation.y = t * (0.7 + level * 0.18);
    if (secondaryRef.current) {
      secondaryRef.current.rotation.z = Math.sin(t * 2.4) * 0.12;
      secondaryRef.current.position.y = h + 0.72 + Math.sin(t * 2.7 + level) * 0.08;
    }
    if (tertiaryRef.current) tertiaryRef.current.rotation.y = -t * 1.9;
  });

  if (id === "comms") return (
    <group ref={mainRef} position={[0, h + 0.38, 0]}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.8, 10]} />
        <meshStandardMaterial color="#d9edf4" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh rotation={[Math.PI / 2.8, 0, 0]} position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.48 + level * 0.05, 20, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} roughness={0.25} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.96, 0]}>
        <torusGeometry args={[0.72 + level * 0.09, 0.035, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.65} />
      </mesh>
      <pointLight color={color} intensity={0.75} distance={4} />
    </group>
  );

  if (id === "navigation") return (
    <group ref={mainRef} position={[0, h + 0.72, 0]}>
      {[0, 1, 2].map((ring) => (
        <mesh key={ring} rotation={[Math.PI / 2, ring * 0.45, 0]} position={[0, 0.15 * ring, 0]}>
          <torusGeometry args={[0.42 + ring * 0.18, 0.035, 8, 24]} />
          <meshBasicMaterial color={ring === 1 ? "#ff4fd8" : color} transparent opacity={0.75} />
        </mesh>
      ))}
      <mesh>
        <coneGeometry args={[0.18, 0.8, 8]} />
        <meshStandardMaterial color="#fff4a6" emissive="#fff4a6" emissiveIntensity={0.85} />
      </mesh>
    </group>
  );

  if (id === "battery") return (
    <group position={[0, h + 0.45, 0]}>
      <group ref={tertiaryRef}>
        {[-0.42, 0, 0.42].map((x, i) => (
          <mesh key={i} position={[x, 0.2, 0]} scale={[0.7, 1 + i * 0.18, 0.7]}>
            <boxGeometry args={[0.18, 0.65, 0.18]} />
            <meshStandardMaterial color={i === 1 ? "#62f7ff" : color} emissive={i === 1 ? "#62f7ff" : color} emissiveIntensity={1.2} metalness={0.3} roughness={0.2} />
          </mesh>
        ))}
      </group>
      <pointLight color="#62f7ff" intensity={0.8} distance={3.5} />
    </group>
  );

  if (id === "oxygen" || id === "water") return (
    <group ref={mainRef} position={[0, h + 0.55, 0]}>
      <mesh>
        <cylinderGeometry args={[0.42, 0.42, 0.16, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} />
      </mesh>
      <group ref={secondaryRef}>
        {[0, 1, 2, 3].map((blade) => (
          <mesh key={blade} rotation={[0, 0, blade * Math.PI / 2]} position={[0, 0.12, 0]}>
            <boxGeometry args={[0.65, 0.06, 0.12]} />
            <meshStandardMaterial color="#e9f7ff" emissive="#d8f7ff" emissiveIntensity={0.35} />
          </mesh>
        ))}
      </group>
      <pointLight color={color} intensity={0.6} distance={3.2} />
    </group>
  );

  if (id === "radiation") return (
    <group ref={mainRef} position={[0, h + 0.62, 0]}>
      {[0, 1, 2].map((ring) => (
        <mesh key={ring} rotation={[Math.PI / 2, ring * 0.65, tSafe(ring)]}>
          <torusGeometry args={[0.5 + ring * 0.2, 0.045, 8, 28]} />
          <meshBasicMaterial color={ring === 1 ? "#ffe84f" : color} transparent opacity={0.72} />
        </mesh>
      ))}
      <mesh>
        <icosahedronGeometry args={[0.25 + level * 0.04, 1]} />
        <meshStandardMaterial color="#ffe84f" emissive="#ffe84f" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );

  if (id === "science") return (
    <group ref={mainRef} position={[0, h + 0.62, 0]}>
      <mesh>
        <icosahedronGeometry args={[0.3 + level * 0.04, 1]} />
        <meshStandardMaterial color="#d96bff" emissive="#a938ff" emissiveIntensity={1.6} />
      </mesh>
      {[0, 1].map((ring) => (
        <mesh key={ring} rotation={[Math.PI / 2, ring * 0.8, 0]}>
          <torusGeometry args={[0.58 + ring * 0.18, 0.035, 8, 28]} />
          <meshBasicMaterial color={ring === 0 ? "#65f4ff" : color} transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  );

  if (id === "extraction" || id === "isru") return (
    <group ref={mainRef} position={[0, h + 0.44, 0]}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.3, 0.46, 0.55, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} metalness={0.35} />
      </mesh>
      <group ref={secondaryRef}>
        <mesh position={[0, -0.08, 0]}>
          <coneGeometry args={[0.24, 0.8, 8]} />
          <meshStandardMaterial color="#c9d6da" metalness={0.7} roughness={0.2} />
        </mesh>
      </group>
      <pointLight color={color} intensity={0.75} distance={3.5} />
    </group>
  );

  if (id === "agriculture") return (
    <group position={[0, h + 0.48, 0]}>
      <mesh>
        <boxGeometry args={[1.25 + level * 0.18, 0.72, 1.0 + level * 0.14]} />
        <meshStandardMaterial color="#273f3b" roughness={0.4} metalness={0.08} transparent opacity={0.82} />
      </mesh>
      {[[-0.35, 0.05], [0.35, 0.05], [0, -0.25]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.32 + (i % 2) * 0.12, z as number]}>
          <sphereGeometry args={[0.13 + level * 0.02, 12, 8]} />
          <meshStandardMaterial color="#72ff91" emissive="#37ff74" emissiveIntensity={1.05} />
        </mesh>
      ))}
      <pointLight color="#54ff8a" intensity={0.9} distance={3.5} />
    </group>
  );

  if (id === "grid" || id === "thermal" || id === "maintenance" || id === "solar") return (
    <group ref={mainRef} position={[0, h + 0.62, 0]}>
      <mesh>
        <octahedronGeometry args={[0.25 + level * 0.045, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.7} />
      </mesh>
      {[0, 1, 2].map((orb) => (
        <mesh key={orb} position={[Math.cos(orb * 2.1) * 0.55, 0.1, Math.sin(orb * 2.1) * 0.55]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color="#fff2a1" emissive="#fff2a1" emissiveIntensity={1.4} />
        </mesh>
      ))}
    </group>
  );

  if (id === "habitat") return null;
  return null;
}

function tSafe(value: number) {
  return value * Math.PI * 0.22;
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
    if (groupRef.current) groupRef.current.position.y = y + Math.sin(t * 1.8 + position[0] * 0.4) * 0.055;
    if (beaconRef.current) {
      beaconRef.current.rotation.y = t * (1.7 + level * 0.25);
      beaconRef.current.scale.setScalar(0.92 + (Math.sin(t * 4 + position[1]) + 1) * 0.055);
    }
    if (orbRef.current) orbRef.current.position.y = h + 0.64 + Math.sin(t * 3.2 + position[0]) * 0.09;
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
      <AnimatedBuildingDetails id={track.id} color={c} h={h} level={level} />
      <Text position={[0, h + (track.id === "solar" ? 2.0 : 1.48), 0]} rotation={[-0.66, 0, 0]} fontSize={0.34} color={selected ? "#fff2a7" : "#ffffff"} outlineWidth={0.045} outlineColor="#111820" anchorX="center">
        {track.category}
      </Text>
    </group>
  );
}

function Rover({ selected, alerted, task, position, resourceNodes, onClick }: {
  selected: boolean;
  alerted: boolean;
  task: string;
  position: [number, number];
  resourceNodes: MissionResourceNode[];
  onClick: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Group>(null);
  const wheelsRef = useRef<THREE.Group[]>([]);
  const scanRef = useRef<THREE.Mesh>(null);

  const taskTargetName = task.startsWith("SURVEYING ") ? task.slice("SURVEYING ".length) : "";
  const targetNode = taskTargetName ? resourceNodes.find((node) => node.label === taskTargetName) : null;
  const home: [number, number] = position;
  const habitat: [number, number] = POSITIONS.habitat;
  const target: [number, number] = targetNode ? nodeWorldPosition(targetNode) : task === "RETURNING" ? habitat : [-6, 5];

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    let phase = (t * 0.16) % 1;
    let from = home;
    let to = target;

    if (task === "RETURNING") {
      from = targetNode ? target : home;
      to = habitat;
      phase = (t * 0.22) % 1;
    } else if (task === "REROUTING" || task === "FORCED THROUGH") {
      const waypoint = task === "REROUTING" ? [-4, 7] as [number, number] : [5, 4] as [number, number];
      from = home;
      to = waypoint;
      phase = (t * 0.2) % 1;
    } else if (task.startsWith("SURVEYING")) {
      if (phase < 0.46) {
        from = home;
        to = target;
        phase = phase / 0.46;
      } else if (phase < 0.72) {
        from = target;
        to = target;
        phase = 0;
      } else {
        from = target;
        to = home;
        phase = (phase - 0.72) / 0.28;
      }
    }

    const x = THREE.MathUtils.lerp(from[0], to[0], phase);
    const z = THREE.MathUtils.lerp(from[1], to[1], phase);
    const nextX = THREE.MathUtils.lerp(from[0], to[0], Math.min(1, phase + 0.02));
    const nextZ = THREE.MathUtils.lerp(from[1], to[1], Math.min(1, phase + 0.02));
    ref.current.position.set(x, terrainHeight(x, z) + 0.72, z);
    const moving = Math.hypot(nextX - x, nextZ - z) > 0.01;

    if (moving) {
      ref.current.rotation.y = Math.atan2(nextX - x, nextZ - z);
      wheelsRef.current.forEach((wheel, index) => {
        if (wheel) wheel.rotation.y += (0.14 + index * 0.008);
      });
    }
    if (armRef.current) {
      const atTarget = task.startsWith("SURVEYING") && Math.hypot(x - target[0], z - target[1]) < 1.1;
      armRef.current.rotation.z = atTarget ? Math.sin(t * 5.5) * 0.42 - 0.7 : Math.sin(t * 1.8) * 0.06;
    }
    if (scanRef.current) {
      const atTarget = task.startsWith("SURVEYING") && Math.hypot(x - target[0], z - target[1]) < 1.1;
      scanRef.current.scale.setScalar(atTarget ? 0.7 + (Math.sin(t * 4.5) + 1) * 0.3 : 0.05);
      scanRef.current.material.opacity = atTarget ? 0.14 + (Math.sin(t * 4.5) + 1) * 0.08 : 0;
    }
  });

  return (
    <group ref={ref} position={[position[0], terrainHeight(position[0], position[1]) + 0.72, position[1]]} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      {selected && <PulseRing color="#ffe18a" y={-0.58} radius={0.9} />}
      {alerted && <PulseRing color="#ff466c" y={-0.55} radius={1.1} />}
      <mesh castShadow>
        <boxGeometry args={[1.35, 0.34, 0.92]} />
        <meshStandardMaterial color="#f0c96b" roughness={0.62} metalness={0.35} />
      </mesh>
      <mesh castShadow position={[0, 0.33, 0]}>
        <boxGeometry args={[0.38, 0.46, 0.38]} />
        <meshStandardMaterial color="#18d7df" roughness={0.42} metalness={0.2} emissive="#08e7ff" emissiveIntensity={0.75} />
      </mesh>
      <mesh position={[0, 0.68, 0]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.12, 0.08, 0.9]} />
        <meshStandardMaterial color="#fff0a0" emissive="#fff0a0" emissiveIntensity={0.9} />
      </mesh>
      <group ref={armRef} position={[0.36, 0.18, 0]}>
        <mesh position={[0.24, -0.03, 0]} rotation={[0, 0, -0.35]}>
          <boxGeometry args={[0.45, 0.08, 0.08]} />
          <meshStandardMaterial color="#d9e7e8" metalness={0.75} roughness={0.2} />
        </mesh>
        <mesh position={[0.48, -0.08, 0]}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color="#ffcf4a" emissive="#ffb300" emissiveIntensity={1.2} />
        </mesh>
      </group>
      <group ref={(node) => { if (node) wheelsRef.current[0] = node; }} position={[-0.48, -0.24, -0.31]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.19, 0.19, 0.18, 12]} /><meshStandardMaterial color="#22282d" roughness={0.9} /></mesh>
      </group>
      <group ref={(node) => { if (node) wheelsRef.current[1] = node; }} position={[-0.48, -0.24, 0.31]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.19, 0.19, 0.18, 12]} /><meshStandardMaterial color="#22282d" roughness={0.9} /></mesh>
      </group>
      <group ref={(node) => { if (node) wheelsRef.current[2] = node; }} position={[0.48, -0.24, -0.31]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.19, 0.19, 0.18, 12]} /><meshStandardMaterial color="#22282d" roughness={0.9} /></mesh>
      </group>
      <group ref={(node) => { if (node) wheelsRef.current[3] = node; }} position={[0.48, -0.24, 0.31]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.19, 0.19, 0.18, 12]} /><meshStandardMaterial color="#22282d" roughness={0.9} /></mesh>
      </group>
      <mesh ref={scanRef} position={[0, -0.68, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.9, 32]} />
        <meshBasicMaterial color="#22f0ff" transparent opacity={0} />
      </mesh>
      <pointLight color="#2ef3ff" intensity={1.4} distance={4.5} />
      <Text position={[0, 1.18, 0]} rotation={[-0.66, 0, 0]} fontSize={0.3} color="#fff1a6" outlineWidth={0.03} outlineColor="#171b22">
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

function ColonyAmbientLife() {
  const droneRefs = useRef<THREE.Mesh[]>([]);
  const energyRefs = useRef<THREE.Mesh[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    droneRefs.current.forEach((mesh, index) => {
      if (!mesh) return;
      const phase = t * (0.35 + index * 0.04) + index * 1.7;
      mesh.position.x = Math.sin(phase) * (5.5 + index * 0.8);
      mesh.position.z = Math.cos(phase * 0.82) * (4.8 + index * 0.55) + 2;
      mesh.position.y = terrainHeight(mesh.position.x, mesh.position.z) + 2.6 + Math.sin(phase * 2) * 0.35;
    });
    energyRefs.current.forEach((mesh, index) => {
      if (!mesh) return;
      const phase = (t * 0.18 + index * 0.24) % 1;
      const x = THREE.MathUtils.lerp(-5.5, 3.5, phase);
      const z = THREE.MathUtils.lerp(-3, 1.2, phase);
      mesh.position.set(x, terrainHeight(x, z) + 0.34, z);
      mesh.scale.setScalar(0.65 + Math.sin(t * 5 + index) * 0.16);
    });
  });

  return (
    <group>
      {[0, 1, 2, 3].map((index) => (
        <mesh key={index} ref={(node) => { if (node) droneRefs.current[index] = node; }}>
          <sphereGeometry args={[0.1 + (index % 2) * 0.035, 10, 8]} />
          <meshStandardMaterial color={index % 2 ? "#ff66db" : "#57efff"} emissive={index % 2 ? "#ff22c9" : "#0ce7ff"} emissiveIntensity={2} />
        </mesh>
      ))}
      {[0, 1, 2].map((index) => (
        <mesh key={"energy-" + index} ref={(node) => { if (node) energyRefs.current[index] = node; }}>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial color="#faff8a" emissive="#fff05e" emissiveIntensity={2} />
        </mesh>
      ))}
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
      <ColonyAmbientLife />
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
          resourceNodes={props.resourceNodes}
          onClick={() => props.onSelect("rover")}
        />
      )}
      <Text position={[0, 5.1, -1.5]} rotation={[-0.66, 0, 0]} fontSize={0.46} color="#fff0c2" outlineWidth={0.045} outlineColor="#191816" anchorX="center">
        {props.environmentLabel + " OUTPOST"}
      </Text>
      <OrbitControls
        enableRotate={false}
        enablePan={false}
        enableZoom
        enableDamping
        dampingFactor={0.08}
        minDistance={14}
        maxDistance={38}
        target={[0, 0, 2]}
      />
    </Canvas>
  );
}

export function Colony3DMap(props: Props) {
  return <MissionScene {...props} />;
}
