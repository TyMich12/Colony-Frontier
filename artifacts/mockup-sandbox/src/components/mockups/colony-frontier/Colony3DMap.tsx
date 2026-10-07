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
  grid: [0, -4.2],
  comms: [5.6, -6.1],
  solar: [-5.8, -6],
  battery: [6.8, -1.3],
  oxygen: [-6.1, 2.4],
  co2: [-2.9, 4.7],
  water: [6.3, 3.9],
  navigation: [-6.3, 7.9],
  radiation: [7.3, 8],
  rover: [0.1, 9.3],
  thermal: [-9.2, -1.5],
  science: [9.2, -7.4],
  extraction: [-8.8, 9.9],
  isru: [7.8, 11.2],
  agriculture: [-10, 5.6],
  maintenance: [10.1, 3.6],
};

function nodeWorldPosition(node: MissionResourceNode): [number, number] {
  return [(node.x - 500) / 22, (node.y - 300) / 10];
}

function statusColor(condition: number) {
  return condition < 55 ? "#ff775c" : condition < 82 ? "#f4c75d" : "#73e1a0";
}

function tierColor(tier: Tier) {
  return tier === "Foundation"
    ? "#5be28a"
    : tier === "Frontier"
      ? "#24c9f6"
      : tier === "Apex"
        ? "#b86cff"
        : "#ffab3e";
}

function roadMaterialColor(mars: boolean) {
  return mars ? "#b97a55" : "#8d9796";
}

function trimPath(points: Array<[number, number]>) {
  return points.map(([x, z]) => [x, z] as [number, number]);
}

function PathStrip({
  points,
  width = 0.95,
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
        const y = terrainHeight(mx, mz) + 0.12;
        return (
          <group key={index} position={[mx, y, mz]} rotation={[-Math.PI / 2, 0, angle]}>
            <mesh receiveShadow>
              <planeGeometry args={[width, length]} />
              <meshStandardMaterial color={roadMaterialColor(mars)} roughness={0.96} metalness={0.03} />
            </mesh>
            <mesh position={[0, 0.016, 0]}>
              <planeGeometry args={[width * 0.78, length * 0.92]} />
              <meshStandardMaterial color={mars ? "#cd9068" : "#b8c0bc"} roughness={1} metalness={0} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function CityRoads({ mars }: { mars: boolean }) {
  const roads = [
    trimPath([[-15, -10], [-4, -4.7], [0, -2.7], [5.6, -6.1]]),
    trimPath([[0, -2.7], [0, 0], [0.1, 9.3]]),
    trimPath([[-6.1, 2.4], [-2.9, 4.7], [0, 0], [6.3, 3.9], [10.1, 3.6]]),
    trimPath([[-6.3, 7.9], [-3.8, 7.4], [0, 9.3], [7.8, 11.2]]),
    trimPath([[-10, 5.6], [-6.1, 2.4], [-3.8, 7.4], [-8.8, 9.9]]),
    trimPath([[5.6, -6.1], [9.2, -7.4]]),
    trimPath([[6.3, 3.9], [7.3, 8], [7.8, 11.2]]),
  ];
  return (
    <group>
      {roads.map((points, index) => <PathStrip key={index} points={points} width={index === 1 ? 1.2 : 0.88} mars={mars} />)}
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
    <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius, radius + 0.16, 36]} />
      <meshBasicMaterial color={alerted ? "#ff4e58" : "#ffe36a"} />
    </mesh>
  );
}

function RoundedBlock({
  color,
  accent,
  width = 1.9,
  depth = 1.65,
  height = 1.05,
}: {
  color: string;
  accent: string;
  width?: number;
  depth?: number;
  height?: number;
}) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.82} metalness={0.1} />
      </mesh>
      <mesh castShadow position={[0, height + 0.13, 0]}>
        <boxGeometry args={[width * 0.88, 0.2, depth * 0.88]} />
        <meshStandardMaterial color={accent} roughness={0.55} metalness={0.18} />
      </mesh>
      <mesh position={[0, height * 0.56, depth / 2 + 0.025]}>
        <boxGeometry args={[width * 0.64, 0.23, 0.05]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.28} />
      </mesh>
    </group>
  );
}

function SolarFarm({ color }: { color: string }) {
  return (
    <group>
      <RoundedBlock color="#596268" accent={color} width={1.75} depth={1.55} height={0.8} />
      {[[-0.52, -0.35], [0.52, -0.35], [-0.52, 0.38], [0.52, 0.38]].map(([x, z], index) => (
        <group key={index} position={[x, 0.9, z]} rotation={[0.12, index % 2 ? -0.15 : 0.15, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.55, 0.075, 0.78]} />
            <meshStandardMaterial color="#237fc0" roughness={0.32} metalness={0.35} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[0.08, 0.04, 0.78]} />
            <meshStandardMaterial color="#b8d5de" roughness={0.3} metalness={0.55} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.35, 10]} />
        <meshStandardMaterial color="#d8dfdb" metalness={0.7} roughness={0.22} />
      </mesh>
    </group>
  );
}

function HabitatCore({ color }: { color: string }) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.66, 0]}>
        <cylinderGeometry args={[1.25, 1.4, 1.18, 14]} />
        <meshStandardMaterial color="#5a6467" roughness={0.78} metalness={0.12} />
      </mesh>
      <mesh castShadow position={[0, 1.38, 0]}>
        <sphereGeometry args={[1.18, 28, 16]} />
        <meshStandardMaterial color="#7cc6ca" emissive="#245c65" emissiveIntensity={0.18} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.43, 0]}>
        <torusGeometry args={[0.78, 0.07, 8, 28]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {[-0.72, 0.72].map((x) => (
        <group key={x} position={[x, 0.66, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.23, 0.28, 0.72, 10]} />
            <meshStandardMaterial color="#858d8d" roughness={0.62} metalness={0.22} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <sphereGeometry args={[0.18, 12, 8]} />
            <meshStandardMaterial color="#5ae9ef" emissive="#24d7df" emissiveIntensity={0.42} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.98, 1.22]}>
        <boxGeometry args={[1.18, 0.24, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.32} />
      </mesh>
    </group>
  );
}

function CommsTower({ color }: { color: string }) {
  const dishRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (dishRef.current) dishRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.18) * 0.22;
  });
  return (
    <group>
      <RoundedBlock color="#566067" accent={color} width={1.72} depth={1.5} height={0.86} />
      <mesh position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 1.1, 10]} />
        <meshStandardMaterial color="#dfe4df" metalness={0.72} roughness={0.2} />
      </mesh>
      <group ref={dishRef} position={[0, 1.78, 0]}>
        <mesh rotation={[Math.PI / 2.8, 0, 0]}>
          <sphereGeometry args={[0.55, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
          <meshStandardMaterial color="#dbe4e1" roughness={0.28} metalness={0.4} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.02, 0.22]}>
          <cylinderGeometry args={[0.045, 0.045, 0.56, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
        </mesh>
      </group>
    </group>
  );
}

function TankComplex({ color, liquid }: { color: string; liquid: string }) {
  return (
    <group>
      <RoundedBlock color="#566267" accent={color} width={1.8} depth={1.5} height={0.82} />
      {[-0.5, 0.5].map((x) => (
        <group key={x} position={[x, 0.92, 0.18]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.3, 0.36, 1.1, 14]} />
            <meshStandardMaterial color="#c9d1ce" roughness={0.46} metalness={0.25} />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <cylinderGeometry args={[0.2, 0.24, 0.95, 12]} />
            <meshStandardMaterial color={liquid} transparent opacity={0.75} roughness={0.24} metalness={0.05} />
          </mesh>
          <mesh position={[0, 0.61, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.08, 14]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BatteryBank({ color }: { color: string }) {
  return (
    <group>
      <RoundedBlock color="#454e54" accent={color} width={1.95} depth={1.58} height={0.9} />
      {[-0.58, -0.19, 0.19, 0.58].map((x, index) => (
        <group key={x} position={[x, 1.08, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.24, 0.78, 0.42]} />
            <meshStandardMaterial color={index === 2 ? "#53eaff" : "#697579"} emissive={index === 2 ? "#19d9e7" : "#000000"} emissiveIntensity={index === 2 ? 0.68 : 0} roughness={0.4} metalness={0.28} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[0.12, 0.06, 0.16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ShieldComplex({ color }: { color: string }) {
  return (
    <group>
      <RoundedBlock color="#4f575d" accent={color} width={1.8} depth={1.55} height={0.9} />
      {[0, 1, 2].map((index) => (
        <mesh key={index} position={[0, 1.25 + index * 0.25, 0]} rotation={[0, index * 0.22, 0]}>
          <torusGeometry args={[0.46 + index * 0.08, 0.055, 8, 28]} />
          <meshBasicMaterial color={index === 1 ? "#ffe55c" : color} />
        </mesh>
      ))}
      <mesh position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.36, 8]} />
        <meshStandardMaterial color="#d9dfdc" metalness={0.65} roughness={0.25} />
      </mesh>
    </group>
  );
}

function ScienceDome({ color }: { color: string }) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.92, 1.06, 1.0, 12]} />
        <meshStandardMaterial color="#525a63" roughness={0.76} metalness={0.16} />
      </mesh>
      <mesh castShadow position={[0, 1.25, 0]}>
        <sphereGeometry args={[0.86, 22, 14]} />
        <meshStandardMaterial color="#7461a2" emissive="#4b2875" emissiveIntensity={0.35} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.29, 0]}>
        <torusGeometry args={[0.67, 0.05, 8, 24]} />
        <meshBasicMaterial color="#5cecff" />
      </mesh>
      <mesh position={[0.57, 1.35, 0]}>
        <boxGeometry args={[0.1, 0.82, 0.1]} />
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.28} />
      </mesh>
    </group>
  );
}

function FactoryRig({ color, secondary = false }: { color: string; secondary?: boolean }) {
  return (
    <group>
      <RoundedBlock color="#4e575b" accent={color} width={2.1} depth={1.75} height={1.06} />
      <mesh castShadow position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.36, 0.48, 0.88, 12]} />
        <meshStandardMaterial color={secondary ? "#69c6b8" : color} emissive={secondary ? "#2e9688" : color} emissiveIntensity={0.28} metalness={0.24} roughness={0.36} />
      </mesh>
      <mesh castShadow position={[0, 1.15, 0.1]}>
        <coneGeometry args={[0.19, 0.92, 8]} />
        <meshStandardMaterial color="#d4dad6" metalness={0.72} roughness={0.2} />
      </mesh>
      <mesh position={[0.58, 1.1, 0.38]}>
        <boxGeometry args={[0.42, 0.55, 0.42]} />
        <meshStandardMaterial color="#6f7978" roughness={0.56} metalness={0.24} />
      </mesh>
      <mesh position={[-0.58, 1.12, 0.38]}>
        <cylinderGeometry args={[0.16, 0.2, 0.72, 10]} />
        <meshStandardMaterial color="#8b9593" roughness={0.5} metalness={0.3} />
      </mesh>
    </group>
  );
}

function AgricultureGreenhouse({ color }: { color: string }) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.62, 0]}>
        <boxGeometry args={[2.15, 0.96, 1.5]} />
        <meshStandardMaterial color="#31564c" roughness={0.5} metalness={0.08} transparent opacity={0.94} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[2.25, 0.08, 1.58]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      {[-0.6, -0.2, 0.2, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.95, 0]}>
          <sphereGeometry args={[0.11, 10, 8]} />
          <meshStandardMaterial color="#7cff8c" emissive="#32dc5f" emissiveIntensity={0.72} />
        </mesh>
      ))}
    </group>
  );
}

function NavigationTower({ color }: { color: string }) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ringRef.current) ringRef.current.rotation.z = clock.getElapsedTime() * 0.55;
  });
  return (
    <group>
      <RoundedBlock color="#555e61" accent={color} width={1.68} depth={1.46} height={0.82} />
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 1.45, 10]} />
        <meshStandardMaterial color="#dfe6e0" metalness={0.68} roughness={0.2} />
      </mesh>
      <mesh ref={ringRef} position={[0, 1.86, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.52, 0.05, 8, 26]} />
        <meshBasicMaterial color="#ff63d8" />
      </mesh>
      <mesh position={[0, 2.18, 0]}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

function ThermalPlant({ color }: { color: string }) {
  return (
    <group>
      <RoundedBlock color="#4d5759" accent={color} width={1.98} depth={1.6} height={0.88} />
      {[-0.46, 0, 0.46].map((x) => (
        <group key={x} position={[x, 1.22, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.16, 0.2, 0.78, 10]} />
            <meshStandardMaterial color="#d5dbd7" metalness={0.58} roughness={0.24} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <sphereGeometry args={[0.08, 8, 6]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function PowerGridCore({ color }: { color: string }) {
  const coreRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (coreRef.current) coreRef.current.rotation.y = clock.getElapsedTime() * 0.4;
  });
  return (
    <group>
      <RoundedBlock color="#465056" accent={color} width={1.98} depth={1.62} height={0.9} />
      <mesh ref={coreRef} position={[0, 1.48, 0]}>
        <octahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial color="#5cecff" emissive="#24d8e2" emissiveIntensity={0.9} metalness={0.14} roughness={0.2} />
      </mesh>
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 1.12, 0]}>
          <boxGeometry args={[0.34, 0.48, 0.34]} />
          <meshStandardMaterial color="#727d7d" roughness={0.5} metalness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

function MaintenanceBay({ color }: { color: string }) {
  return (
    <group>
      <RoundedBlock color="#50595c" accent={color} width={2.06} depth={1.7} height={0.95} />
      <mesh position={[0, 1.78, 0]}>
        <boxGeometry args={[0.12, 1.16, 0.12]} />
        <meshStandardMaterial color="#d9dfda" metalness={0.62} roughness={0.22} />
      </mesh>
      <mesh position={[0.38, 2.1, 0]}>
        <boxGeometry args={[0.74, 0.1, 0.1]} />
        <meshStandardMaterial color="#d9dfda" metalness={0.62} roughness={0.22} />
      </mesh>
      <mesh position={[-0.42, 1.18, 0.86]}>
        <boxGeometry args={[0.45, 0.48, 0.05]} />
        <meshStandardMaterial color="#262f34" emissive="#112127" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function RoverPad({ color }: { color: string }) {
  return (
    <group>
      <mesh receiveShadow position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.25, 32]} />
        <meshStandardMaterial color="#505b5e" roughness={0.92} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.88, 0.96, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.54, 0]}>
        <boxGeometry args={[1.45, 0.36, 0.92]} />
        <meshStandardMaterial color="#e8c86c" roughness={0.64} metalness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.92, 0]}>
        <boxGeometry args={[0.42, 0.46, 0.42]} />
        <meshStandardMaterial color="#1ddbe2" emissive="#0bcbd5" emissiveIntensity={0.68} />
      </mesh>
      {[[-0.52, -0.34], [-0.52, 0.34], [0.52, -0.34], [0.52, 0.34]].map(([x, z]) => (
        <mesh key={String(x) + String(z)} castShadow position={[x, 0.16, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.17, 12]} />
          <meshStandardMaterial color="#22282b" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0.45, 0.98, 0]}>
        <boxGeometry args={[0.08, 0.08, 0.72]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
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
  switch (id) {
    case "solar":
      return <SolarFarm color={color} />;
    case "habitat":
      return <HabitatCore color={color} />;
    case "comms":
      return <CommsTower color={color} />;
    case "oxygen":
      return <TankComplex color={color} liquid="#77efff" />;
    case "water":
      return <TankComplex color={color} liquid="#3ebcff" />;
    case "battery":
      return <BatteryBank color={color} />;
    case "radiation":
      return <ShieldComplex color={color} />;
    case "science":
      return <ScienceDome color={color} />;
    case "extraction":
      return <FactoryRig color={color} />;
    case "isru":
      return <FactoryRig color={color} secondary />;
    case "agriculture":
      return <AgricultureGreenhouse color={color} />;
    case "navigation":
      return <NavigationTower color={color} />;
    case "thermal":
      return <ThermalPlant color={color} />;
    case "grid":
      return <PowerGridCore color={color} />;
    case "maintenance":
      return <MaintenanceBay color={color} />;
    case "rover":
      return <RoverPad color={color} />;
    default:
      return <RoundedBlock color="#535c5e" accent={color} />;
  }
}

function BuildingIdleMotion({
  color,
  level,
  active,
}: {
  color: string;
  level: number;
  active: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 1.15 + level * 0.75) * 0.025;
      groupRef.current.rotation.z = Math.sin(t * 0.5 + level) * 0.006;
    }
    if (beaconRef.current) {
      const pulse = active ? 1.18 + (Math.sin(t * 5) + 1) * 0.05 : 0.92 + (Math.sin(t * 2.5 + level) + 1) * 0.025;
      beaconRef.current.scale.setScalar(pulse);
      const mat = beaconRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = active ? 1.6 : 0.65 + level * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={beaconRef} position={[0, 2.08 + level * 0.06, 0]}>
        <octahedronGeometry args={[0.09 + level * 0.02, 0]} />
        <meshStandardMaterial color={active ? "#fff16b" : color} emissive={active ? "#ffb52e" : color} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function SettlementWall({
  mars,
}: {
  mars: boolean;
}) {
  const wallColor = mars ? "#6b4033" : "#566268";
  const capColor = mars ? "#d49a68" : "#b9c5c2";
  const towers = [
    [-18, -15],
    [18, -15],
    [-18, 15],
    [18, 15],
  ] as Array<[number, number]>;
  const segments = [
    { x: 0, z: -15, w: 36, d: 0.55 },
    { x: 0, z: 15, w: 36, d: 0.55 },
    { x: -18, z: 0, w: 0.55, d: 30 },
    { x: 18, z: 0, w: 0.55, d: 30 },
  ];

  return (
    <group>
      {segments.map((segment, index) => {
        const y = terrainHeight(segment.x, segment.z) + 0.62;
        return (
          <group key={index} position={[segment.x, y, segment.z]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[segment.w, 1.15, segment.d]} />
              <meshStandardMaterial color={wallColor} roughness={0.75} metalness={0.18} />
            </mesh>
            <mesh position={[0, 0.64, 0]}>
              <boxGeometry args={[segment.w * 0.96, 0.11, segment.d * 1.12]} />
              <meshStandardMaterial color={capColor} roughness={0.45} metalness={0.3} />
            </mesh>
          </group>
        );
      })}
      {towers.map(([x, z], index) => {
        const y = terrainHeight(x, z) + 0.15;
        return (
          <group key={index} position={[x, y, z]}>
            <mesh castShadow>
              <cylinderGeometry args={[1.02, 1.14, 1.9, 12]} />
              <meshStandardMaterial color={wallColor} roughness={0.72} metalness={0.18} />
            </mesh>
            <mesh position={[0, 1.02, 0]}>
              <cylinderGeometry args={[0.84, 0.92, 0.24, 12]} />
              <meshStandardMaterial color={capColor} roughness={0.38} metalness={0.35} />
            </mesh>
            <mesh position={[0, 1.28, 0]}>
              <coneGeometry args={[0.48, 0.62, 10]} />
              <meshStandardMaterial color={index % 2 ? "#48d7e8" : "#f1b654"} emissive={index % 2 ? "#1b9fac" : "#a36a1c"} emissiveIntensity={0.35} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, terrainHeight(0, -15) + 1.32, -15.1]}>
        <boxGeometry args={[8.5, 0.18, 0.7]} />
        <meshStandardMaterial color={capColor} roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}

function CentralPlaza() {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ringRef.current) ringRef.current.rotation.z = clock.getElapsedTime() * 0.1;
  });
  return (
    <group position={[0, terrainHeight(0, 0) + 0.14, 0]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.6, 48]} />
        <meshStandardMaterial color="#536168" roughness={0.88} metalness={0.08} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[3.55, 3.72, 48]} />
        <meshBasicMaterial color="#43dbe6" transparent opacity={0.72} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.95, 2.05, 36]} />
        <meshBasicMaterial color="#f0c957" transparent opacity={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.56, 0.72, 0.82, 12]} />
        <meshStandardMaterial color="#4d575d" roughness={0.62} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.18, 0]}>
        <octahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial color="#5eeeff" emissive="#24d9e4" emissiveIntensity={0.95} />
      </mesh>
      {[0, 1, 2, 3].map((index) => {
        const angle = (index / 4) * Math.PI * 2;
        return (
          <group key={index} position={[Math.cos(angle) * 2.55, 0.24, Math.sin(angle) * 2.55]}>
            <mesh>
              <cylinderGeometry args={[0.11, 0.15, 0.42, 10]} />
              <meshStandardMaterial color="#d8dfdb" metalness={0.55} roughness={0.22} />
            </mesh>
            <mesh position={[0, 0.3, 0]}>
              <sphereGeometry args={[0.08, 10, 8]} />
              <meshStandardMaterial color="#ffd968" emissive="#ffb91f" emissiveIntensity={0.95} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function DecorativeTree({
  position,
  scale = 1,
  pink = false,
}: {
  position: [number, number];
  scale?: number;
  pink?: boolean;
}) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.02;
  return (
    <group position={[x, y, z]} scale={[scale, scale, scale]}>
      <mesh castShadow position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.09, 0.13, 0.84, 8]} />
        <meshStandardMaterial color="#665347" roughness={0.95} />
      </mesh>
      {[[-0.2, 0.62, 0], [0.18, 0.72, 0.04], [0, 1.0, -0.04], [0.22, 0.94, 0.12]].map(([bx, by, bz], index) => (
        <mesh key={index} castShadow position={[bx, by, bz]}>
          <sphereGeometry args={[0.34 + (index % 2) * 0.05, 10, 8]} />
          <meshStandardMaterial color={pink ? "#d986b7" : index % 2 ? "#76b66b" : "#5f9f62"} roughness={0.94} />
        </mesh>
      ))}
    </group>
  );
}

function CrateCluster({ position }: { position: [number, number] }) {
  const [x, z] = position;
  const y = terrainHeight(x, z) + 0.16;
  return (
    <group position={[x, y, z]}>
      <mesh castShadow>
        <boxGeometry args={[0.52, 0.38, 0.52]} />
        <meshStandardMaterial color="#c79550" roughness={0.84} />
      </mesh>
      <mesh position={[0.34, 0.25, 0.12]}>
        <boxGeometry args={[0.44, 0.38, 0.44]} />
        <meshStandardMaterial color="#7e9e9a" roughness={0.78} metalness={0.12} />
      </mesh>
      <mesh position={[-0.24, 0.22, -0.32]}>
        <boxGeometry args={[0.38, 0.3, 0.38]} />
        <meshStandardMaterial color="#b8c8c5" roughness={0.74} metalness={0.16} />
      </mesh>
    </group>
  );
}

function HumanSettler({
  route,
  index,
  carry,
}: {
  route: Array<[number, number]>;
  index: number;
  carry: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const bodyColor = ["#6ec3d5", "#f0bf58", "#db7d64", "#86b77a", "#9c8cd4"][index % 5];
  const skin = ["#d39b78", "#c98668", "#e1ae8a", "#a97056"][index % 4];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * (0.72 + (index % 4) * 0.06);
    if (!groupRef.current) return;
    const routeIndex = Math.floor(t * 0.34 + index * 0.17) % route.length;
    const nextIndex = (routeIndex + 1) % route.length;
    const phase = (t * 0.34 + index * 0.17) % 1;
    const [ax, az] = route[routeIndex];
    const [bx, bz] = route[nextIndex];
    const x = THREE.MathUtils.lerp(ax, bx, phase);
    const z = THREE.MathUtils.lerp(az, bz, phase);
    const y = terrainHeight(x, z) + 0.34;
    groupRef.current.position.set(x, y, z);
    const dx = bx - ax;
    const dz = bz - az;
    groupRef.current.rotation.y = Math.atan2(dx, dz);

    const walk = Math.sin(t * 8.2 + index);
    if (leftArm.current) leftArm.current.rotation.x = walk * 0.35;
    if (rightArm.current) rightArm.current.rotation.x = -walk * 0.35;
    if (leftLeg.current) leftLeg.current.rotation.x = -walk * 0.42;
    if (rightLeg.current) rightLeg.current.rotation.x = walk * 0.42;
    groupRef.current.position.y += Math.abs(walk) * 0.025;
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow position={[0, 0.55, 0]}>
        <boxGeometry args={[0.34, 0.56, 0.22]} />
        <meshStandardMaterial color={bodyColor} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.98, 0]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color={skin} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.01, 0]}>
        <sphereGeometry args={[0.165, 10, 8]} />
        <meshStandardMaterial color={bodyColor} roughness={0.78} />
      </mesh>

      <group ref={leftArm} position={[-0.22, 0.66, 0]}>
        <mesh castShadow position={[0, -0.2, 0]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color={skin} roughness={0.88} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.22, 0.66, 0]}>
        <mesh castShadow position={[0, -0.2, 0]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color={skin} roughness={0.88} />
        </mesh>
      </group>

      <group ref={leftLeg} position={[-0.09, 0.27, 0]}>
        <mesh castShadow position={[0, -0.17, 0]}>
          <boxGeometry args={[0.12, 0.34, 0.13]} />
          <meshStandardMaterial color="#354047" roughness={0.9} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.09, 0.27, 0]}>
        <mesh castShadow position={[0, -0.17, 0]}>
          <boxGeometry args={[0.12, 0.34, 0.13]} />
          <meshStandardMaterial color="#354047" roughness={0.9} />
        </mesh>
      </group>

      {carry && (
        <mesh castShadow position={[0, 0.56, 0.25]}>
          <boxGeometry args={[0.28, 0.26, 0.22]} />
          <meshStandardMaterial color="#cc9954" roughness={0.88} />
        </mesh>
      )}
    </group>
  );
}

function SettlerCrowd() {
  const routes: Array<Array<[number, number]>> = [
    [[-13, -9], [-5.6, -6], [0, 0], [5.6, -6], [13, -9], [5.6, -6]],
    [[-10, 5.6], [-6.1, 2.4], [0, 0], [6.3, 3.9], [10.1, 3.6], [6.3, 3.9]],
    [[-6.3, 7.9], [0.1, 9.3], [7.8, 11.2], [0.1, 9.3], [-8.8, 9.9]],
    [[-12.5, -1.2], [-6.1, 2.4], [-2.9, 4.7], [0, 0]],
    [[9.2, -7.4], [5.6, -6.1], [0, -4.2], [0, 0], [10.1, 3.6]],
  ];
  return (
    <group>
      {Array.from({ length: 18 }, (_, index) => (
        <HumanSettler
          key={index}
          route={routes[index % routes.length]}
          index={index}
          carry={index % 3 === 0}
        />
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
    ref.current.position.set(x, terrainHeight(x, z) + 0.48, z);
    if (Math.abs(nx - x) + Math.abs(nz - z) > 0.02) ref.current.rotation.y = Math.atan2(nx - x, nz - z);
    if (scannerRef.current) {
      const atSite = !!resource && Math.hypot(x - destination[0], z - destination[1]) < 1.0;
      scannerRef.current.scale.setScalar(atSite ? 0.9 + (Math.sin(t * 5) + 1) * 0.18 : 0.2);
      (scannerRef.current.material as THREE.MeshBasicMaterial).opacity = atSite ? 0.6 : 0.1;
    }
  });

  return (
    <group ref={ref} position={[position[0], terrainHeight(position[0], position[1]) + 0.48, position[1]]} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      <SelectionRing selected={selected} alerted={alerted} radius={1.06} />
      <mesh castShadow>
        <boxGeometry args={[1.35, 0.32, 0.9]} />
        <meshStandardMaterial color="#e8c86b" roughness={0.64} metalness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.36, 0]}>
        <boxGeometry args={[0.42, 0.46, 0.42]} />
        <meshStandardMaterial color="#24dce5" emissive="#12c7d0" emissiveIntensity={0.64} />
      </mesh>
      {[[-0.48, -0.32], [-0.48, 0.32], [0.48, -0.32], [0.48, 0.32]].map(([x, z]) => (
        <mesh key={String(x) + String(z)} castShadow position={[x, -0.18, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.16, 12]} />
          <meshStandardMaterial color="#24292d" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0.4, 0.52, 0]}>
        <boxGeometry args={[0.07, 0.07, 0.68]} />
        <meshStandardMaterial color="#ffd957" emissive="#ffbe18" emissiveIntensity={0.58} />
      </mesh>
      <mesh ref={scannerRef} position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.56, 0.84, 28]} />
        <meshBasicMaterial color="#52e8ff" transparent opacity={0.1} />
      </mesh>
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
  const color = node.kind === "ICE" ? "#5ee5ff" : node.kind === "MINERAL" ? "#ffd25d" : node.kind === "SCIENCE" ? "#cf8fff" : "#b39f83";

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const pulse = selected ? 1.09 + (Math.sin(t * 4) + 1) * 0.05 : 0.97 + (Math.sin(t * 2.2 + x) + 1) * 0.02;
    ref.current.scale.setScalar(pulse);
  });

  return (
    <group ref={ref} position={[x, y + 0.42, z]} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      <mesh castShadow>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.85 : 0.45} roughness={0.35} metalness={0.14} />
      </mesh>
      <mesh position={[0, -0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, selected ? 0.78 : 0.64, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
      {selected && (
        <Text position={[0, 0.78, 0]} rotation={[-0.66, 0, 0]} fontSize={0.18} color="#fff1bd" outlineWidth={0.025} outlineColor="#29211b" anchorX="center">
          {surveyed ? "SURVEYED" : node.label}
        </Text>
      )}
    </group>
  );
}

function EnergyConduits() {
  const refs = useRef<THREE.Mesh[]>([]);
  const links: Array<[number, number, number, number]> = [
    [0, 0, 0, -4.2],
    [0, 0, -5.8, -6],
    [0, 0, 5.6, -6.1],
    [0, 0, 6.8, -1.3],
    [0, 0, 6.3, 3.9],
    [0, 0, -6.1, 2.4],
    [0, 0, -2.9, 4.7],
    [0, 0, 5.5, 8],
  ];
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((mesh, index) => {
      if (!mesh) return;
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.16 + (Math.sin(t * 2.4 + index) + 1) * 0.035;
    });
  });
  return (
    <group>
      {links.map(([x1, z1, x2, z2], index) => {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const length = Math.hypot(dx, dz);
        const mx = (x1 + x2) / 2;
        const mz = (z1 + z2) / 2;
        return (
          <mesh key={index} ref={(node) => { if (node) refs.current[index] = node; }} position={[mx, terrainHeight(mx, mz) + 0.17, mz]} rotation={[-Math.PI / 2, 0, Math.atan2(dx, dz)]}>
            <planeGeometry args={[0.09, length]} />
            <meshBasicMaterial color="#55e7ef" transparent opacity={0.18} />
          </mesh>
        );
      })}
    </group>
  );
}

function ColonyLighting({ mars }: { mars: boolean }) {
  const refs = useRef<THREE.Mesh[]>([]);
  const positions = [
    [-12.8, -11.5],
    [-6.2, -3.5],
    [5.2, -4.1],
    [12.2, -10.3],
    [-12.2, 0.7],
    [12.5, 7.2],
    [-7.1, 11.7],
    [6.1, 12.5],
  ] as Array<[number, number]>;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((mesh, index) => {
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.75 + (Math.sin(t * 2.1 + index * 0.65) + 1) * 0.13;
    });
  });

  return (
    <group>
      {positions.map(([x, z], index) => {
        const y = terrainHeight(x, z) + 0.44;
        return (
          <group key={index} position={[x, y, z]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.05, 0.07, 0.7, 8]} />
              <meshStandardMaterial color={mars ? "#74645d" : "#657271"} roughness={0.74} metalness={0.34} />
            </mesh>
            <mesh ref={(node) => { if (node) refs.current[index] = node; }} position={[0, 0.46, 0]}>
              <sphereGeometry args={[0.075, 10, 8]} />
              <meshStandardMaterial color="#ffd76a" emissive="#ffbc1e" emissiveIntensity={1} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function SettlementAtmosphere({ mars }: { mars: boolean }) {
  const positions = useMemo(() => {
    const data = new Float32Array(72 * 3);
    for (let i = 0; i < 72; i += 1) {
      const angle = (i / 72) * Math.PI * 2;
      const radius = 11 + (i % 9) * 1.15;
      data[i * 3] = Math.cos(angle) * radius;
      data[i * 3 + 1] = 1.3 + (i % 7) * 0.42;
      data[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return data;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={mars ? 0.045 : 0.035} color={mars ? "#ffd7c5" : "#d6f4ff"} transparent opacity={0.22} sizeAttenuation />
    </points>
  );
}

function MissionScene(props: Props) {
  const mars = props.environmentLabel === "MARS";

  return (
    <Canvas
      shadows
      dpr={[1, 1.25]}
      camera={{ position: [27, 25, 29], fov: 40, near: 0.1, far: 220 }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <color attach="background" args={[mars ? "#8f4e3c" : "#69666b"]} />
      <fog attach="fog" args={[mars ? "#9e604d" : "#727078", 54, 105]} />

      <ambientLight intensity={0.82} color={mars ? "#ffe3d7" : "#edf3ff"} />
      <hemisphereLight args={[mars ? "#ffeade" : "#f5f7ff", mars ? "#40251f" : "#343139", 0.98]} />
      <directionalLight
        position={[18, 32, 17]}
        intensity={2.5}
        color="#fff3dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={110}
        shadow-camera-left={-42}
        shadow-camera-right={42}
        shadow-camera-top={42}
        shadow-camera-bottom={-42}
      />

      <Terrain kind={mars ? "mars" : "moon"} />
      <Rocks kind={mars ? "mars" : "moon"} />
      <SettlementWall mars={mars} />
      <CityRoads mars={mars} />
      <CentralPlaza />
      <EnergyConduits />
      <ColonyLighting mars={mars} />
      <SettlementAtmosphere mars={mars} />

      <DecorativeTree position={[-14.8, -12.3]} scale={1.0} pink={!mars} />
      <DecorativeTree position={[-11.5, -8.7]} scale={0.85} pink={false} />
      <DecorativeTree position={[12.3, -11.4]} scale={1.05} pink={!mars} />
      <DecorativeTree position={[14.2, 1.8]} scale={0.8} pink={false} />
      <DecorativeTree position={[-12.8, 2.2]} scale={0.86} pink={!mars} />
      <DecorativeTree position={[11.3, 11.8]} scale={0.92} pink={!mars} />
      <DecorativeTree position={[-11.4, 11.6]} scale={0.82} pink={false} />
      <CrateCluster position={[-14.1, -5.9]} />
      <CrateCluster position={[13.2, -5.6]} />
      <CrateCluster position={[13.2, 9.8]} />

      <SettlerCrowd />

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

      <Text
        position={[0, 5.6, 0]}
        rotation={[-0.66, 0, 0]}
        fontSize={0.42}
        color="#fff0ae"
        outlineWidth={0.055}
        outlineColor="#29231f"
        anchorX="center"
      >
        {props.environmentLabel + " COLONY"}
      </Text>

      <OrbitControls
        enableRotate={false}
        enablePan={false}
        enableZoom
        minDistance={16}
        maxDistance={42}
        zoomSpeed={0.78}
        target={[0, 0, 2]}
      />
    </Canvas>
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
      <RoverWorld
        task={roverTask}
        position={position}
        resourceNodes={resourceNodes}
        selected={selected}
        alerted={alerted}
        onClick={onClick}
      />
    );
  }

  return (
    <group
      position={[position[0], y, position[1]]}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <SelectionRing selected={selected} alerted={alerted} radius={track.id === "habitat" ? 2.0 : 1.35} />
      <StaticBuildingArt id={track.id} color={color} />
      <BuildingIdleMotion color={color} level={level} active={alerted} />

      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.25, 18]} />
        <meshBasicMaterial color={statusColor(runtime.condition)} />
      </mesh>

      {(selected || alerted) && (
        <group>
          <Text
            position={[0, track.id === "habitat" ? 2.95 : 2.42, 0]}
            rotation={[-0.66, 0, 0]}
            fontSize={0.27}
            color={selected ? "#fff2a1" : "#ff8f75"}
            outlineWidth={0.04}
            outlineColor="#201b19"
            anchorX="center"
          >
            {track.category}
          </Text>
          <Text
            position={[0, track.id === "habitat" ? 2.64 : 2.17, 0]}
            rotation={[-0.66, 0, 0]}
            fontSize={0.16}
            color={color}
            outlineWidth={0.02}
            outlineColor="#201b19"
            anchorX="center"
          >
            {tier}
          </Text>
        </group>
      )}
    </group>
  );
}

export function Colony3DMap(props: Props) {
  return <MissionScene {...props} />;
}
