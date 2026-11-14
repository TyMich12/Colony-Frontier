import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html, OrbitControls, PerspectiveCamera, RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";
import type { TechnologyTrack, Tier } from "./_shared/gameData";
import type { BuildingRuntime, MissionMetrics } from "./missionRuntime";
import { terrainHeight, Terrain, Rocks } from "./solar-surface/terrain";
import { getBaselineRating, interpolateSolarProfile } from "./_shared/simulationBalance";

export type MissionResourceNode = {
  id: string;
  label: string;
  kind: "ICE" | "MINERAL" | "SCIENCE" | "REGOLITH";
  x: number;
  y: number;
  description: string;
};

export type MissionPhysicalReadings = {
  power: string;
  battery: string;
  oxygen: string;
  water: string;
  food: string;
  radiation: string;
  temperature: string;
};

export const COLONY_WORLD_SCALE = 1.35;

type Props = {
  tracks: TechnologyTrack[];
  selected: Record<string, Tier>;
  buildings: Record<string, BuildingRuntime>;
  metrics: MissionMetrics;
  physicalReadings: MissionPhysicalReadings;
  colonyHealth: number;
  selectedBuildingId: string | null;
  elapsed: number;
  lunarNight: boolean;
  environmentLabel: "MOON" | "MARS";
  environmentTitle: string;
  activeEventId: string | null;
  activeEventTrackId: string | null;
  selectedResourceId: string | null;
  surveyedNodes: string[];
  habitatInterior: boolean;
  resourceNodes: MissionResourceNode[];
  onSelect: (trackId: string) => void;
  onCloseInspector: () => void;
  onSelectResource: (node: MissionResourceNode) => void;
  onEnterHabitat: () => void;
  onExitHabitat: () => void;
  onSupplyAction: (trackId: string, action: string) => void;
  roverTask: string;
  roverTargetNodeId: string | null;
  simulationSpeed: number;
};

export const POSITIONS: Record<string, [number, number]> = {
  // Compact service lanes keep the outpost walkable while leaving room for each facility.
  habitat: [0, 0],
  water: [-16, 13],
  extraction: [-5, 13],
  isru: [5, 13],
  radiation: [16, 13],
  oxygen: [-16, 4],
  comms: [-8, 4],
  maintenance: [8, 4],
  co2: [-16, -5],
  grid: [-8, -5],
  science: [8, -5],
  battery: [16, -5],
  thermal: [-16, -13],
  solar: [-5, -13],
  agriculture: [5, -13],
  navigation: [16, -13],
  rover: [19, -18],
};

const BUILDING_SCALES: Record<string, number> = {
  habitat: 1.35,
  solar: 2.15,
  battery: 1.28,
  oxygen: 1.28,
  water: 1.28,
  co2: 1.24,
  comms: 1.3,
  navigation: 1.28,
  radiation: 1.3,
  science: 1.3,
  agriculture: 1.4,
  extraction: 1.4,
  isru: 1.34,
  thermal: 1.28,
  grid: 1.28,
  maintenance: 1.3,
  rover: 1.2,
};

function buildingClearanceRadius(id: string): number {
  const footprintRadius = id === "habitat" ? 4.4 : id === "rover" ? 1.85 : 1.825;
  return footprintRadius * (BUILDING_SCALES[id] ?? 1.2) + 0.2;
}

function keepPathAwayFromBuildings(position: [number, number], clearance: number): [number, number] {
  let x = position[0];
  let z = position[1];

  for (const [id, [bx, bz]] of Object.entries(POSITIONS)) {
    if (id === "rover") continue;
    const radius = buildingClearanceRadius(id) + clearance;
    const dx = x - bx;
    const dz = z - bz;
    const distance = Math.hypot(dx, dz);
    if (distance === 0 || distance >= radius) continue;
    const push = (radius - distance) * 0.52;
    const nx = dx / distance;
    const nz = dz / distance;
    x += nx * push;
    z += nz * push;
  }

  return [x, z];
}

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

const ROAD_X = [-10, 0, 10];
const ROAD_Z = [-9, -0.6, 9];
const ROAD_EDGE = 18;
const PAD_Y = 0.12;

export function nodeWorldPosition(node: MissionResourceNode): [number, number] {
  return [(node.x - 500) / 22, (node.y - 300) / 10];
}

function createEarthTextures() {
  const width = 1536;
  const height = 768;
  const surfaceCanvas = document.createElement("canvas");
  surfaceCanvas.width = width;
  surfaceCanvas.height = height;
  const ctx = surfaceCanvas.getContext("2d");
  if (!ctx) throw new Error("Could not create Earth surface texture");
  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, "#153b68");
  ocean.addColorStop(0.25, "#1764a0");
  ocean.addColorStop(0.55, "#0a4d8a");
  ocean.addColorStop(0.78, "#1b6095");
  ocean.addColorStop(1, "#17365d");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);
  // Equirectangular continent silhouettes, deliberately irregular rather than icon-like.
  const continents = [
    [[0.08,0.22],[0.12,0.16],[0.17,0.13],[0.21,0.17],[0.24,0.22],[0.22,0.28],[0.19,0.31],[0.18,0.39],[0.15,0.45],[0.13,0.39],[0.12,0.32],[0.09,0.29]],
    [[0.20,0.43],[0.24,0.46],[0.26,0.53],[0.25,0.62],[0.23,0.70],[0.21,0.77],[0.19,0.68],[0.18,0.59],[0.19,0.50]],
    [[0.40,0.19],[0.45,0.14],[0.51,0.15],[0.54,0.20],[0.51,0.25],[0.47,0.27],[0.45,0.34],[0.42,0.31],[0.40,0.25]],
    [[0.45,0.32],[0.51,0.30],[0.55,0.36],[0.55,0.44],[0.52,0.52],[0.50,0.62],[0.47,0.68],[0.44,0.59],[0.43,0.48],[0.41,0.40]],
    [[0.53,0.20],[0.59,0.15],[0.66,0.16],[0.72,0.21],[0.79,0.22],[0.84,0.28],[0.80,0.34],[0.73,0.33],[0.68,0.38],[0.62,0.33],[0.57,0.30]],
    [[0.60,0.38],[0.65,0.36],[0.70,0.42],[0.73,0.51],[0.70,0.62],[0.66,0.67],[0.62,0.59],[0.60,0.50]],
    [[0.80,0.58],[0.85,0.55],[0.89,0.59],[0.90,0.65],[0.86,0.69],[0.82,0.65]],
    [[0.01,0.08],[0.12,0.04],[0.24,0.06],[0.34,0.05],[0.45,0.07],[0.56,0.04],[0.67,0.06],[0.78,0.05],[0.90,0.08],[0.99,0.06],[0.99,0.12],[0.86,0.14],[0.72,0.12],[0.59,0.15],[0.46,0.12],[0.33,0.14],[0.20,0.12],[0.09,0.14]],
    [[0.01,0.87],[0.12,0.84],[0.23,0.86],[0.34,0.84],[0.45,0.87],[0.57,0.84],[0.69,0.87],[0.82,0.85],[0.98,0.88],[0.98,0.95],[0.85,0.96],[0.70,0.94],[0.55,0.97],[0.40,0.94],[0.25,0.97],[0.11,0.94],[0.01,0.96]]
  ];
  continents.forEach((points, index) => {
    ctx.beginPath();
    points.forEach(([x,y], i) => i === 0 ? ctx.moveTo(x*width,y*height) : ctx.lineTo(x*width,y*height));
    ctx.closePath();
    const land = ctx.createLinearGradient(0, index*45, width*0.3, height*0.75);
    land.addColorStop(0, "#a9b77a");
    land.addColorStop(0.45, "#477e53");
    land.addColorStop(0.75, "#c2b27b");
    land.addColorStop(1, "#41694a");
    ctx.fillStyle = land;
    ctx.fill();
    ctx.strokeStyle = "rgba(202,211,151,0.45)";
    ctx.lineWidth = 3;
    ctx.stroke();
  });
  // Deterministic terrain flecks and highland textures add detail without remote assets.
  let seed = 1701;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i=0; i<1700; i++) {
    const x = rand()*width, y = height*(0.14+rand()*0.70);
    ctx.fillStyle = rand()>0.5 ? "rgba(216,204,145,0.12)" : "rgba(12,54,37,0.14)";
    ctx.beginPath(); ctx.ellipse(x,y,2+rand()*13,1+rand()*5,rand()*Math.PI,0,Math.PI*2); ctx.fill();
  }
  // Polar ice caps.
  const north = ctx.createLinearGradient(0,0,0,height*0.13);
  north.addColorStop(0,"rgba(245,250,255,0.98)"); north.addColorStop(1,"rgba(225,240,248,0)");
  ctx.fillStyle=north; ctx.fillRect(0,0,width,height*0.14);
  const south = ctx.createLinearGradient(0,height*0.85,0,height);
  south.addColorStop(0,"rgba(225,240,248,0)"); south.addColorStop(1,"rgba(245,250,255,0.94)");
  ctx.fillStyle=south; ctx.fillRect(0,height*0.85,width,height*0.15);
  const surface = new THREE.CanvasTexture(surfaceCanvas);
  surface.colorSpace = THREE.SRGBColorSpace;
  surface.anisotropy = 8;

  const cloudCanvas = document.createElement("canvas");
  cloudCanvas.width=width; cloudCanvas.height=height;
  const cloud=cloudCanvas.getContext("2d");
  if (!cloud) throw new Error("Could not create Earth cloud texture");
  for(let i=0;i<420;i++){
    const x=rand()*width, y=height*(0.12+rand()*0.76);
    cloud.save(); cloud.translate(x,y); cloud.rotate((rand()-0.5)*0.8);
    cloud.strokeStyle="rgba(242,249,255,"+(0.08+rand()*0.25)+")";
    cloud.lineWidth=2+rand()*10; cloud.lineCap="round";
    cloud.beginPath(); cloud.moveTo(-10-rand()*30,0); cloud.bezierCurveTo(-20,-8,20,8,18+rand()*36,rand()*8); cloud.stroke();
    cloud.restore();
  }
  const clouds = new THREE.CanvasTexture(cloudCanvas);
  clouds.colorSpace = THREE.SRGBColorSpace;
  clouds.anisotropy = 8;
  return { surface, clouds };
}

type RoverRockObstacle = {
  id: string;
  label: string;
  x: number;
  z: number;
  radius: number;
  rerouteRoll: number;
};

const ROVER_ROUTE_ROCKS: RoverRockObstacle[] = [
  { id: "central-boulder", label: "CENTRAL BOULDER", x: 1, z: -20, radius: 1.9, rerouteRoll: 0.64 },
  { id: "eastern-ridge", label: "EASTERN BOULDER RIDGE", x: 29, z: 7, radius: 1.8, rerouteRoll: 0.76 },
  { id: "southern-scree", label: "SOUTHERN SCREE", x: 27, z: -26, radius: 1.55, rerouteRoll: 0.85 },
  { id: "western-scree", label: "WESTERN SCREE", x: -18, z: 14, radius: 2.0, rerouteRoll: 0.92 },
];

const SITE_ROUTE_CHALLENGES: Record<string, string> = {
  ice: "central-boulder",
  mineral: "eastern-ridge",
  science: "southern-scree",
  regolith: "western-scree",
};

// Grid-based A*: buildings and the same physical boulders rendered in the scene are obstacles.
// An optional ignored rock is used only for the first, low-confidence approach so the rover can
// reach the near side of a visible obstacle, pause, announce the diversion, and re-plan around it.
function findRoverPath(
  start: [number, number],
  goal: [number, number],
  ignoredRockId?: string | null,
  ignoreAllRocks = false,
): [number, number][] {
  const step = 2;
  const limit = 18; // ±36 world units; includes the remote science / extraction sites.
  const toGrid = (point: [number, number]) => ({
    x: Math.max(-limit, Math.min(limit, Math.round(point[0] / step))),
    z: Math.max(-limit, Math.min(limit, Math.round(point[1] / step))),
  });
  const startGrid = toGrid(start);
  const goalGrid = toGrid(goal);
  const key = (x: number, z: number) => `${x},${z}`;
  const startKey = key(startGrid.x, startGrid.z);
  const goalKey = key(goalGrid.x, goalGrid.z);
  const blocked = (x: number, z: number) => {
    if (key(x, z) === startKey || key(x, z) === goalKey) return false;
    const wx = x * step;
    const wz = z * step;
    const nearBuilding = Object.entries(POSITIONS).some(([id, [bx, bz]]) => {
      if (id === "rover") return false;
      const radius = buildingClearanceRadius(id);
      return Math.hypot(wx - bx, wz - bz) < radius;
    });
    const nearRock = !ignoreAllRocks && ROVER_ROUTE_ROCKS.some((rock) =>
      rock.id !== ignoredRockId && Math.hypot(wx - rock.x, wz - rock.z) < rock.radius + 0.8,
    );
    return nearBuilding || nearRock;
  };
  const open = [startGrid];
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const pointFor = new Map<string, { x: number; z: number }>([[startKey, startGrid]]);
  const closed = new Set<string>();
  const heuristic = (x: number, z: number) => Math.hypot(goalGrid.x - x, goalGrid.z - z);
  const directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const;
  let found = false;

  while (open.length) {
    open.sort((a, b) =>
      (gScore.get(key(a.x, a.z)) ?? Infinity) + heuristic(a.x, a.z) -
      ((gScore.get(key(b.x, b.z)) ?? Infinity) + heuristic(b.x, b.z)),
    );
    const current = open.shift()!;
    const currentKey = key(current.x, current.z);
    if (currentKey === goalKey) { found = true; break; }
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    for (const [dx, dz] of directions) {
      const x = current.x + dx;
      const z = current.z + dz;
      if (Math.abs(x) > limit || Math.abs(z) > limit || blocked(x, z)) continue;
      if (dx && dz && (blocked(current.x + dx, current.z) || blocked(current.x, current.z + dz))) continue;
      const nextKey = key(x, z);
      if (closed.has(nextKey)) continue;
      const tentative = (gScore.get(currentKey) ?? Infinity) + (dx && dz ? Math.SQRT2 : 1);
      if (tentative >= (gScore.get(nextKey) ?? Infinity)) continue;
      cameFrom.set(nextKey, currentKey);
      gScore.set(nextKey, tentative);
      pointFor.set(nextKey, { x, z });
      if (!open.some((point) => key(point.x, point.z) === nextKey)) open.push({ x, z });
    }
  }

  if (!found) return [];
  const path: [number, number][] = [];
  let cursor = goalKey;
  while (cursor !== startKey) {
    const point = pointFor.get(cursor);
    if (!point) return [];
    path.push([point.x * step, point.z * step]);
    const previous = cameFrom.get(cursor);
    if (!previous) return [];
    cursor = previous;
  }
  path.reverse();
  path.push(goal);
  return path;
}

function planRoverPath(start: [number, number], goal: [number, number], ignoredRockId?: string | null): [number, number][] {
  const planned = findRoverPath(start, goal, ignoredRockId);
  if (planned.length) return planned;

  // Second pass relaxes boulder avoidance only; buildings still block the path.
  const rockFallback = findRoverPath(start, goal, null, true);
  if (rockFallback.length) return rockFallback;

  // A final bounded perimeter route ensures a destination never leaves the rover silently still.
  const edgeX = goal[0] < start[0] ? -33 : 33;
  const edgeZ = goal[1] < start[1] ? -33 : 33;
  const route: [number, number][] = [[start[0], edgeZ], [edgeX, edgeZ], [edgeX, goal[1]], goal];
  return route.filter((point, index) => {
    const previous = index === 0 ? start : route[index - 1];
    return Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 0.4;
  });
}

function rockApproachPoint(start: [number, number], rock: RoverRockObstacle): [number, number] {
  const dx = start[0] - rock.x;
  const dz = start[1] - rock.z;
  const distance = Math.max(0.001, Math.hypot(dx, dz));
  const standOff = rock.radius + 0.72;
  return [rock.x + (dx / distance) * standOff, rock.z + (dz / distance) * standOff];
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

function BuildingArt({ id, accent, dust = 0 }: { id: string; accent: string; dust?: number }) {
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
          <meshStandardMaterial color="#a1aaa2" metalness={0.68} roughness={0.34} emissive="#536d69" emissiveIntensity={0.18} />
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
                  <meshPhysicalMaterial color="#65d2e2" emissive="#247b8c" emissiveIntensity={0.55} roughness={0.18} metalness={0.18} clearcoat={0.8} />
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
          <group position={[-0.31, 0.02, 0.49]}>
            <RoundedBox args={[0.62, 0.53, 0.08]} radius={0.055} smoothness={4} position={[0.31, 0, 0]}>
              <meshStandardMaterial color="#1a303a" metalness={0.34} roughness={0.28} />
            </RoundedBox>
            <RoundedBox args={[0.43, 0.35, 0.04]} radius={0.04} smoothness={3} position={[0.31, 0.01, 0.055]}>
              <meshStandardMaterial color="#324b52" metalness={0.3} roughness={0.32} />
            </RoundedBox>
            <mesh position={[0.54, 0.01, 0.09]}>
              <torusGeometry args={[0.055, 0.012, 6, 14]} />
              <meshStandardMaterial color="#d5c27c" metalness={0.78} roughness={0.26} />
            </mesh>
          </group>
          <mesh position={[0, 0.27, 0.58]}>
            <boxGeometry args={[0.34, 0.04, 0.02]} />
            <meshStandardMaterial color="#f7d47c" emissive="#ffbd4a" emissiveIntensity={2.2} />
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
        <pointLight position={[0, 1.35, 3.1]} color="#62e6ed" intensity={2.2} distance={7} decay={2} />
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
            {dust > 0 && <mesh position={[0, 0.039, 0]} rotation={[0.18, 0, 0]}><boxGeometry args={[0.99, 0.012, 1.57]} /><meshStandardMaterial color="#bd8c63" transparent opacity={Math.min(0.78, dust / 100 * 0.78)} roughness={1} depthWrite={false} /></mesh>}
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

function Rover({
  task,
  position,
  resourceNodes,
  targetNodeId,
  onClick,
  selected,
  alerted,
  traverseSpeedKmh,
  navigationAccuracy,
  simulationSpeed,
}: {
  task: string;
  position: [number, number];
  resourceNodes: MissionResourceNode[];
  targetNodeId: string | null;
  onClick: () => void;
  selected: boolean;
  alerted: boolean;
  traverseSpeedKmh: number;
  navigationAccuracy: number;
  simulationSpeed: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const wheelRefs = useRef<Array<THREE.Group | null>>([]);
  const drillRef = useRef<THREE.Group>(null);
  const sensorSweepRef = useRef<THREE.Group>(null);
  const toolArmRef = useRef<THREE.Group>(null);
  const cleaningBrushRef = useRef<THREE.Group>(null);
  const cargoLightRef = useRef<THREE.MeshStandardMaterial>(null);
  const routeRef = useRef<[number, number][]>([]);
  const routeCursorRef = useRef(0);
  const commandKeyRef = useRef("");
  const encounteredRouteRef = useRef<string | null>(null);
  const reroutePlanRef = useRef<{
    commandKey: string;
    rockId: string;
    destination: [number, number];
    phase: "APPROACH" | "HOLD";
    resumeAt: number;
  } | null>(null);
  const [rerouteNotice, setRerouteNotice] = useState<string | null>(null);

  const prefixes = ["SURVEYING ", "MAPPING ", "COLLECTING ", "AT SITE ", "TRANSFERRING "];
  const taskPrefix = prefixes.find((prefix) => task.startsWith(prefix));
  const taskNodeLabel = taskPrefix ? task.slice(taskPrefix.length) : "";
  const target = (targetNodeId ? resourceNodes.find((node) => node.id === targetNodeId) : undefined)
    ?? (taskNodeLabel ? resourceNodes.find((node) => node.label === taskNodeLabel) : undefined);
  const isCollecting = task.startsWith("COLLECTING ");
  const isTransferring = task.startsWith("TRANSFERRING ");
  const isSurveying = task.startsWith("SURVEYING ") || task.startsWith("MAPPING ");
  const isReturning = ["RETURNING", "REPAIR VERIFIED", "SAMPLE DELIVERED"].includes(task);
  const repairTarget = task.startsWith("REPAIRING ") ? task.slice("REPAIRING ".length).toLowerCase() : "";
  const isCleaning = task === "CLEANING ARRAY";
  const destination: [number, number] = isTransferring
    ? POSITIONS.habitat
    : isReturning
      ? position
      : target && (targetNodeId || isCollecting || isSurveying || task.startsWith("AT SITE "))
        ? nodeWorldPosition(target)
      : isCleaning
        ? POSITIONS.solar
        : repairTarget && POSITIONS[repairTarget]
          ? POSITIONS[repairTarget]
          : position;
  const hasDestination = Boolean(
    isTransferring || isReturning || isCleaning || targetNodeId ||
    (target && (isCollecting || isSurveying || task.startsWith("AT SITE "))) ||
    (repairTarget && POSITIONS[repairTarget]),
  );
  const roverStatusLabel = rerouteNotice ?? (task === "STANDBY" ? null : task);
  const roverStatusWidth = Math.min(4.8, Math.max(2.1, (roverStatusLabel?.length ?? 0) * 0.095 + 0.55));

  // Start at the actual launch coordinate from the first rendered frame. Never rely on an effect
  // to move an origin-positioned (and easily mis-hit) vehicle into view after mount.
  useEffect(() => {
    if (ref.current) {
      ref.current.position.set(position[0], terrainHeight(position[0], position[1]) + 0.47, position[1]);
    }
  }, [position[0], position[1]]);

  useFrame(({ clock }, delta) => {
    const rover = ref.current;
    if (!rover) return;
    const current = rover.position;
    const start: [number, number] = [current.x, current.z];
    let travelled = 0;

    if (simulationSpeed <= 0) {
      current.y = terrainHeight(current.x, current.z) + 0.47;
      return;
    }

    const commandKey = hasDestination
      ? `${task}|${targetNodeId ?? ""}|${destination[0].toFixed(2)}|${destination[1].toFixed(2)}`
      : "IDLE";

    if (commandKey !== commandKeyRef.current) {
      commandKeyRef.current = commandKey;
      routeCursorRef.current = 0;
      reroutePlanRef.current = null;
      encounteredRouteRef.current = null;
      setRerouteNotice(null);

      if (!hasDestination || Math.hypot(destination[0] - current.x, destination[1] - current.z) < 1.2) {
        routeRef.current = [];
      } else {
        const siteKey = target?.id.split("-").slice(-1)[0] ?? "";
        const rockId = isSurveying || isCollecting ? SITE_ROUTE_CHALLENGES[siteKey] : undefined;
        const rock = rockId ? ROVER_ROUTE_ROCKS.find((item) => item.id === rockId) : undefined;
        // Each field corridor has a repeatable mapped difficulty. A higher Nav tier / retrofit
        // has greater accuracy, so it detects more of these boulders before driving up to them.
        // Only stage the surprise boulder on the outbound leg. Once the rover has reached
        // a surveyed site, beginning collection must not send it back to the same obstacle.
        const siteChallenge = Boolean(
          rock &&
          navigationAccuracy < rock.rerouteRoll &&
          Math.hypot(destination[0] - current.x, destination[1] - current.z) > 6,
        );
        if (siteChallenge && rock) {
          const approach = rockApproachPoint(start, rock);
          const firstLeg = planRoverPath(start, approach, rock.id);
          if (firstLeg.length) {
            routeRef.current = firstLeg;
            reroutePlanRef.current = {
              commandKey,
              rockId: rock.id,
              destination: [...destination],
              phase: "APPROACH",
              resumeAt: 0,
            };
          } else {
            routeRef.current = planRoverPath(start, destination);
          }
        } else {
          routeRef.current = planRoverPath(start, destination);
        }
      }
    }

    const reroutePlan = reroutePlanRef.current;
    if (reroutePlan && reroutePlan.commandKey === commandKey && reroutePlan.phase === "HOLD") {
      if (clock.getElapsedTime() < reroutePlan.resumeAt) {
        current.y = terrainHeight(current.x, current.z) + 0.47 + Math.sin(clock.getElapsedTime() * 2.2) * 0.006;
        return;
      }
      // Re-plan around the actual boulder field after the vehicle has stopped at the near side.
      routeRef.current = planRoverPath(start, reroutePlan.destination);
      routeCursorRef.current = 0;
      encounteredRouteRef.current = commandKey;
      reroutePlanRef.current = null;
      setRerouteNotice(null);
    }

    if (hasDestination && routeRef.current.length === 0 && Math.hypot(destination[0] - current.x, destination[1] - current.z) >= 1.2) {
      routeRef.current = planRoverPath(start, destination);
      routeCursorRef.current = 0;
    }

    if (hasDestination && routeRef.current.length) {
      const path = routeRef.current;
      let waypoint = path[routeCursorRef.current];
      while (waypoint && Math.hypot(waypoint[0] - current.x, waypoint[1] - current.z) < 0.42) {
        routeCursorRef.current += 1;
        waypoint = path[routeCursorRef.current];
      }

      const activeReroute = reroutePlanRef.current;
      if (activeReroute && activeReroute.phase === "APPROACH" && routeCursorRef.current >= path.length) {
        activeReroute.phase = "HOLD";
        activeReroute.resumeAt = clock.getElapsedTime() + 2.0;
        const rock = ROVER_ROUTE_ROCKS.find((item) => item.id === activeReroute.rockId);
        setRerouteNotice(`REROUTING · ${rock?.label ?? "ROCK AHEAD"}`);
        current.y = terrainHeight(current.x, current.z) + 0.47;
        return;
      }

      if (waypoint) {
        const dx = waypoint[0] - current.x;
        const dz = waypoint[1] - current.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 0.0001) {
          const finalWaypoint = routeCursorRef.current >= path.length - 1;
          const arriveRadius = finalWaypoint ? (isCollecting ? 0.62 : isTransferring || isReturning ? 0.42 : 0.28) : 0.08;
          if (distance > arriveRadius) {
            // The route must finish before the timed field task does. Simulation speed and rover tier both affect travel time.
            // One colony-map unit represents approximately one metre. Convert the rated
            // safe traverse speed from km/h to m/s; simulation speed accelerates both travel
            // and the corresponding timed field-operation clock.
            const baseSpeedMps = Math.max(0, traverseSpeedKmh / 3.6 / COLONY_WORLD_SCALE);
            const simRate = Math.min(4, Math.max(0.5, simulationSpeed));
            const terrainSampleDistance = Math.min(0.75, distance);
            const terrainAheadHeight = terrainHeight(current.x + (dx / distance) * terrainSampleDistance, current.z + (dz / distance) * terrainSampleDistance);
            const localTerrainRise = Math.abs(terrainAheadHeight - terrainHeight(current.x, current.z));
            // Slopes / uneven ground slow the rover; path planning separately avoids rocks
            // and structures, so the displayed speed is not just an animation multiplier.
            const terrainSpeedFactor = Math.max(0.45, Math.min(1, 1 - localTerrainRise * 0.8));
            const move = Math.min(Math.max(0, delta) * baseSpeedMps * simRate * terrainSpeedFactor, distance - arriveRadius);
            current.x += (dx / distance) * move;
            current.z += (dz / distance) * move;
            travelled = move;
            rover.rotation.y = Math.atan2(dx, dz);
          }
        }
      }
    }

    current.y = terrainHeight(current.x, current.z) + 0.47 + Math.sin(clock.getElapsedTime() * (travelled > 0 ? 7 : 2.2)) * (travelled > 0 ? 0.018 : 0.005);
    if (travelled > 0) wheelRefs.current.forEach((wheel) => { if (wheel) wheel.rotation.x += travelled / 0.235; });
    if (drillRef.current) {
      const working = isCollecting || Boolean(repairTarget);
      drillRef.current.rotation.y = isCollecting ? clock.getElapsedTime() * 4.5 : repairTarget ? clock.getElapsedTime() * 2.4 : 0;
      drillRef.current.position.y = working
        ? -0.12 + Math.sin(clock.getElapsedTime() * 15) * 0.025
        : 0.14;
    }
    if (sensorSweepRef.current) {
      sensorSweepRef.current.rotation.y = isSurveying ? Math.sin(clock.getElapsedTime() * 1.35) * 0.78 : 0;
      sensorSweepRef.current.rotation.x = isSurveying ? Math.sin(clock.getElapsedTime() * 2.1) * 0.08 : 0;
    }
    if (toolArmRef.current) {
      const deployed = isCollecting || isCleaning || Boolean(repairTarget);
      toolArmRef.current.rotation.x = THREE.MathUtils.damp(
        toolArmRef.current.rotation.x,
        deployed ? 0.62 + Math.sin(clock.getElapsedTime() * 3.2) * 0.04 : 0,
        4,
        delta,
      );
    }
    if (cleaningBrushRef.current) {
      cleaningBrushRef.current.visible = isCleaning;
      if (isCleaning) cleaningBrushRef.current.rotation.x = clock.getElapsedTime() * 9;
    }
    if (cargoLightRef.current) {
      cargoLightRef.current.emissiveIntensity = isTransferring ? 0.7 + (Math.sin(clock.getElapsedTime() * 7) + 1) * 0.7 : 0.2;
    }
  });

  const wheelZ = [-0.55, 0, 0.55];
  const basePosition = useMemo<[number, number, number]>(() => [position[0], terrainHeight(position[0], position[1]) + 0.47, position[1]], [position[0], position[1]]);
  return (
    <group
      ref={ref}
      position={basePosition}
      frustumCulled={false}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      <mesh
        castShadow
        position={[0, 0.01, 0]}
      >
        <RoundedBox args={[1.72, 0.28, 1.12]} radius={0.12} smoothness={4}>
          <meshStandardMaterial color="#c8ab66" roughness={0.58} metalness={0.28} />
        </RoundedBox>
      </mesh>
      <mesh castShadow position={[0, 0.22, 0.02]}>
        <RoundedBox args={[1.22, 0.18, 0.82]} radius={0.08} smoothness={3}>
          <meshStandardMaterial color="#e0cb8d" roughness={0.52} metalness={0.24} />
        </RoundedBox>
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh castShadow position={[side * 0.68, -0.12, 0]} rotation={[0, 0, side * 0.08]}>
            <boxGeometry args={[0.09, 0.07, 1.36]} />
            <meshStandardMaterial color="#515b5d" metalness={0.58} roughness={0.36} />
          </mesh>
          {wheelZ.map((z, wheelIndex) => (
            <group key={z} ref={(element) => { wheelRefs.current[(side === -1 ? 0 : 3) + wheelIndex] = element; }} position={[side * 0.82, -0.16, z]}>
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
              {Array.from({ length: 10 }, (_, index) => (
                <mesh key={index} position={[side * 0.1, Math.sin(index * Math.PI / 5) * 0.19, Math.cos(index * Math.PI / 5) * 0.19]} rotation={[index * Math.PI / 5, 0, 0]}>
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
      <group ref={sensorSweepRef} position={[-0.53, 0.43, -0.24]}>
        <mesh position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.045, 0.06, 0.27, 10]} />
          <meshStandardMaterial color="#82918d" metalness={0.78} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.29, 0]}>
          <RoundedBox args={[0.3, 0.17, 0.23]} radius={0.045} smoothness={3} castShadow>
            <meshStandardMaterial color="#59686a" metalness={0.64} roughness={0.3} />
          </RoundedBox>
        </mesh>
        <mesh position={[0, 0.29, 0.12]}>
          <sphereGeometry args={[0.065, 14, 10]} />
          <meshStandardMaterial color="#63e8f3" emissive="#31c6e8" emissiveIntensity={isSurveying ? 2 : 0.75} toneMapped={false} />
        </mesh>
        <mesh position={[0.11, 0.29, 0.12]}>
          <sphereGeometry args={[0.027, 10, 8]} />
          <meshStandardMaterial color="#f0c45b" emissive="#c18639" emissiveIntensity={0.8} />
        </mesh>
      </group>
      <group position={[0.48, 0.39, -0.29]}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.34, 12]} />
          <meshStandardMaterial color="#637276" metalness={0.72} roughness={0.3} />
        </mesh>
        {[-0.15, 0.15].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.16, 0.026, 6, 16]} />
            <meshStandardMaterial color="#d7bd72" metalness={0.72} roughness={0.28} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.18]}>
          <sphereGeometry args={[0.045, 10, 8]} />
          <meshStandardMaterial ref={cargoLightRef} color="#6cf0d0" emissive="#32d5ae" emissiveIntensity={0.2} />
        </mesh>
      </group>
      <group ref={toolArmRef} position={[-0.55, 0.2, 0.38]}>
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.11, 0.13, 0.14, 12]} />
          <meshStandardMaterial color="#6c7d7b" metalness={0.76} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.045, 0.14]} rotation={[0.15, 0, 0]}>
          <boxGeometry args={[0.12, 0.1, 0.3]} />
          <meshStandardMaterial color="#a9b5ad" metalness={0.7} roughness={0.32} />
        </mesh>
        <mesh position={[0, -0.08, 0.3]}>
          <sphereGeometry args={[0.085, 12, 10]} />
          <meshStandardMaterial color="#435659" metalness={0.8} roughness={0.26} />
        </mesh>
        <mesh position={[0, -0.1, 0.43]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.085, 0.022, 6, 14, Math.PI]} />
          <meshStandardMaterial color="#d3bd77" metalness={0.76} roughness={0.26} />
        </mesh>
        <mesh position={[0, -0.1, 0.5]}>
          <sphereGeometry args={[0.025, 8, 6]} />
          <meshStandardMaterial color="#78d8c3" emissive="#38b89f" emissiveIntensity={0.55} />
        </mesh>
      </group>
      <group ref={cleaningBrushRef} position={[0, 0.64, 0.28]} visible={false}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 1.02, 16]} />
          <meshStandardMaterial color="#45585c" metalness={0.62} roughness={0.48} />
        </mesh>
        {Array.from({ length: 10 }, (_, index) => {
          const angle = (index / 10) * Math.PI * 2;
          return (
            <mesh key={index} position={[0, Math.cos(angle) * 0.22, Math.sin(angle) * 0.22]}>
              <boxGeometry args={[0.9, 0.035, 0.035]} />
              <meshStandardMaterial color={index % 2 ? "#d7c58c" : "#8fa09b"} roughness={0.7} />
            </mesh>
          );
        })}
      </group>
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
      {roverStatusLabel && (
        <Billboard position={[0, 2.15, 0]} follow frustumCulled={false}>
          <mesh position={[0, 0.02, -0.025]}>
            <planeGeometry args={[roverStatusWidth, 0.48]} />
            <meshBasicMaterial color="#17212a" transparent opacity={0.94} depthWrite={false} />
          </mesh>
          <Text frustumCulled={false} fontSize={0.17} color={rerouteNotice ? "#ffcf65" : "#a8edc2"} outlineWidth={0.025} outlineColor="#171a1c" anchorX="center" anchorY="middle">{roverStatusLabel}</Text>
        </Billboard>
      )}
    </group>
  );
}

function SelectionRing({ selected, alerted, radius, height = 0.23 }: { selected: boolean; alerted: boolean; radius: number; height?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = alerted ? 1 + (Math.sin(t * 4.1) + 1) * 0.04 : selected ? 1.02 : 1;
    if (ref.current) ref.current.scale.set(pulse, pulse, pulse);
    if (haloRef.current && alerted) {
      const glow = 0.08 + (Math.sin(t * 3.4) + 1) * 0.028;
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
          <pointLight position={[0, height + 0.28, 0]} color="#ff1f3c" intensity={1.2} distance={Math.max(4.5, radius * 2.4)} decay={2} />
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

function RoverRockField({ mars }: { mars: boolean }) {
  const rockColor = mars ? "#806357" : "#77766f";
  const highlight = mars ? "#bd9273" : "#a8a69a";
  return (
    <group>
      {ROVER_ROUTE_ROCKS.map((rock, index) => {
        const y = terrainHeight(rock.x, rock.z);
        const scale = rock.radius / 1.8;
        return (
          <group key={rock.id} position={[rock.x, y - 0.06, rock.z]}>
            <mesh castShadow receiveShadow position={[0, 0.56 * scale, 0]} scale={[1.35 * scale, 0.86 * scale, 1.08 * scale]}>
              <dodecahedronGeometry args={[1, 1]} />
              <meshStandardMaterial color={rockColor} roughness={0.98} flatShading />
            </mesh>
            <mesh castShadow receiveShadow position={[-0.82 * scale, 0.28 * scale, 0.32 * scale]} scale={[0.72 * scale, 0.58 * scale, 0.7 * scale]}>
              <icosahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color={index % 2 ? rockColor : highlight} roughness={1} flatShading />
            </mesh>
            <mesh castShadow receiveShadow position={[0.86 * scale, 0.22 * scale, -0.35 * scale]} scale={[0.58 * scale, 0.47 * scale, 0.64 * scale]}>
              <dodecahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color={highlight} roughness={1} flatShading />
            </mesh>
          </group>
        );
      })}
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
    [[-12.2,13],[-12.2,4],[-14,-0.6],[-14,-13],[0,-13],[12.2,-13],[14,-0.6],[14,5],[14,13]],
    [[14,-18],[12.2,-13],[12.2,-9],[25.6,-9],[25.6,-25.6],[14,-25.6],[14,-18]],
    [[-25.6,13],[-14,13],[-14,-0.6],[-4.4,-0.6],[-4.4,4],[-4.4,-0.6],[-14,-0.6],[-25.6,-0.6],[-25.6,13]],
  ];
  const serviceStops = [
    [{ waypointIndex: 0, buildingPosition: [-16, 13] as [number, number] }, { waypointIndex: 1, buildingPosition: [-16, 4] as [number, number] }],
    [{ waypointIndex: 1, buildingPosition: [16, -13] as [number, number] }],
    [{ waypointIndex: 4, buildingPosition: [-8, 4] as [number, number] }],
  ];
  return (
    <group>
      {Array.from({length:mars?7:5},(_,i)=><CrewMember key={i} route={routes[i%routes.length]} index={i} mars={mars}/>)}
      {Array.from({ length: 3 }, (_, i) => <ColonyRobot key={`robot-${i}`} route={routes[i]} index={i} serviceStops={serviceStops[i]} />)}
    </group>
  );
}

function ColonyRobot({
  route,
  index,
  serviceStops,
}: {
  route: Array<[number, number]>;
  index: number;
  serviceStops: Array<{ waypointIndex: number; buildingPosition: [number, number] }>;
}) {
  const ref = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const phaseOffset = index * 1.9;
  const segmentDurations = useMemo(
    () => route.map(([x, z], segmentIndex) => {
      const [nextX, nextZ] = route[(segmentIndex + 1) % route.length];
      const distance = Math.hypot(nextX - x, nextZ - z);
      const speedVariation = 0.9 + ((index * 17 + segmentIndex * 13) % 7) * 0.09;
      return Math.max(2.5, distance / speedVariation);
    }),
    [index, route],
  );
  const serviceDurations = useMemo(
    () => new Map(serviceStops.map((stop, stopIndex) => [
      stop.waypointIndex,
      4 + ((index * 11 + stopIndex * 7) % 5),
    ])),
    [index, serviceStops],
  );
  const cycleDuration = segmentDurations.reduce((total, duration) => total + duration, 0)
    + Array.from(serviceDurations.values()).reduce((total, duration) => total + duration, 0);

  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    const time = clock.getElapsedTime();
    let remaining = (time + index * 19.7) % cycleDuration;
    let x = route[0][0];
    let z = route[0][1];
    let heading = ref.current.rotation.y;
    let servicing = false;
    let serviceTarget: [number, number] | null = null;

    for (let segmentIndex = 0; segmentIndex < route.length; segmentIndex += 1) {
      const [ax, az] = route[segmentIndex];
      const nextIndex = (segmentIndex + 1) % route.length;
      const [bx, bz] = route[nextIndex];
      const travelDuration = segmentDurations[segmentIndex];
      if (remaining < travelDuration) {
        const progress = remaining / travelDuration;
        x = THREE.MathUtils.lerp(ax, bx, progress);
        z = THREE.MathUtils.lerp(az, bz, progress);
        heading = Math.atan2(bx - ax, bz - az);
        break;
      }

      remaining -= travelDuration;
      x = bx;
      z = bz;
      const dwellDuration = serviceDurations.get(nextIndex);
      if (dwellDuration !== undefined) {
        if (remaining < dwellDuration) {
          servicing = true;
          serviceTarget = serviceStops.find((stop) => stop.waypointIndex === nextIndex)?.buildingPosition ?? null;
          if (serviceTarget) heading = Math.atan2(serviceTarget[0] - x, serviceTarget[1] - z);
          break;
        }
        remaining -= dwellDuration;
      }
    }

    const safePosition = keepPathAwayFromBuildings([x, z], 0.8);
    const gait = Math.sin(time * 3.8 + phaseOffset) * (servicing ? 0.08 : 0.34);
    ref.current.position.set(
      safePosition[0],
      -0.17 + Math.abs(Math.sin(time * 3.8 + phaseOffset)) * (servicing ? 0.006 : 0.018) - (servicing ? 0.025 : 0),
      safePosition[1],
    );
    const turn = Math.atan2(Math.sin(heading - ref.current.rotation.y), Math.cos(heading - ref.current.rotation.y));
    ref.current.rotation.y += turn * Math.min(1, delta * 5);
    if (leftArm.current) {
      leftArm.current.rotation.x = THREE.MathUtils.damp(leftArm.current.rotation.x, servicing ? -0.65 + gait : gait * 0.72, 6, delta);
    }
    if (rightArm.current) {
      rightArm.current.rotation.x = THREE.MathUtils.damp(rightArm.current.rotation.x, servicing ? 0.72 + gait : -gait * 0.72, 6, delta);
      rightArm.current.rotation.z = THREE.MathUtils.damp(rightArm.current.rotation.z, servicing ? -0.22 : 0, 5, delta);
    }
    if (leftLeg.current) leftLeg.current.rotation.x = -gait;
    if (rightLeg.current) rightLeg.current.rotation.x = gait;
    if (head.current) {
      head.current.rotation.y = Math.sin(time * 0.7 + phaseOffset) * (servicing ? 0.3 : 0.16);
      head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, servicing ? 0.12 : 0, 4, delta);
    }
  });

  const statusColor = index === 1 ? "#f2bd58" : "#62e4e6";
  return (
    <group ref={ref} scale={1.18}>
      <mesh position={[0, 0.43, 0]}>
        <cylinderGeometry args={[0.17, 0.2, 0.14, 12]} />
        <meshStandardMaterial color="#35454a" metalness={0.76} roughness={0.3} />
      </mesh>
      <RoundedBox args={[0.39, 0.4, 0.25]} radius={0.08} smoothness={4} position={[0, 0.68, 0]} castShadow>
        <meshStandardMaterial color="#7f9290" metalness={0.66} roughness={0.34} />
      </RoundedBox>
      <RoundedBox args={[0.29, 0.17, 0.04]} radius={0.035} smoothness={3} position={[0, 0.69, 0.143]}>
        <meshStandardMaterial color="#22353b" metalness={0.44} roughness={0.28} />
      </RoundedBox>
      <mesh position={[0, 0.71, 0.17]}>
        <boxGeometry args={[0.19, 0.035, 0.018]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={1.35} />
      </mesh>
      {[-0.09, -0.045, 0, 0.045, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.55, 0.132]}>
          <boxGeometry args={[0.018, 0.065, 0.012]} />
          <meshStandardMaterial color="#b4c0b5" metalness={0.78} roughness={0.32} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.205, 0.88, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.095, 0.095, 0.08, 16]} />
            <meshStandardMaterial color="#46585c" metalness={0.84} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <torusGeometry args={[0.072, 0.014, 6, 14]} />
            <meshStandardMaterial color="#d3bd77" metalness={0.8} roughness={0.24} />
          </mesh>
          <RoundedBox args={[0.14, 0.2, 0.06]} radius={0.035} smoothness={3} position={[side * 0.04, 0.035, 0.09]}>
            <meshStandardMaterial color="#b2bdb4" metalness={0.62} roughness={0.36} />
          </RoundedBox>
        </group>
      ))}
      {[-0.13, 0.13].map((x) => (
        <mesh key={x} position={[x, 0.91, 0.025]} rotation={[0, 0, x * 1.4]}>
          <boxGeometry args={[0.08, 0.14, 0.12]} />
          <meshStandardMaterial color="#c0c8bd" metalness={0.58} roughness={0.42} />
        </mesh>
      ))}
      <mesh position={[0, 0.78, -0.18]}>
        <boxGeometry args={[0.27, 0.3, 0.12]} />
        <meshStandardMaterial color="#45575b" metalness={0.62} roughness={0.38} />
      </mesh>
      {/* Rugged life-support / compute pack with radiator fins and service status lighting. */}
      <group position={[0, 0.82, -0.285]}>
        <RoundedBox args={[0.34, 0.34, 0.18]} radius={0.045} smoothness={3}>
          <meshStandardMaterial color="#34464b" metalness={0.82} roughness={0.3} />
        </RoundedBox>
        {[-0.12, -0.06, 0, 0.06, 0.12].map((y) => (
          <mesh key={y} position={[0, y, -0.098]}>
            <boxGeometry args={[0.25, 0.018, 0.025]} />
            <meshStandardMaterial color="#9aa9a2" metalness={0.88} roughness={0.26} />
          </mesh>
        ))}
        <mesh position={[0, 0.02, -0.112]}>
          <boxGeometry args={[0.12, 0.055, 0.012]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.85} />
        </mesh>
      </group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.31, 0.82, -0.24]} rotation={[0, 0, side * -0.12]}>
          <mesh position={[side * 0.11, 0, 0]}>
            <boxGeometry args={[0.24, 0.29, 0.045]} />
            <meshStandardMaterial color="#53666a" metalness={0.78} roughness={0.34} />
          </mesh>
          {Array.from({ length: 4 }, (_, fin) => (
            <mesh key={fin} position={[side * 0.11, -0.105 + fin * 0.07, 0.027]}>
              <boxGeometry args={[0.19, 0.012, 0.012]} />
              <meshStandardMaterial color="#c0c9bd" metalness={0.86} roughness={0.25} />
            </mesh>
          ))}
        </group>
      ))}
      {[-0.095, 0.095].map((x) => (
        <mesh key={x} position={[x, 0.78, -0.25]}>
          <cylinderGeometry args={[0.045, 0.045, 0.22, 10]} />
          <meshStandardMaterial color="#a6b0a7" metalness={0.72} roughness={0.28} />
        </mesh>
      ))}
      <mesh position={[0, 1.12, 0]}>
        <cylinderGeometry args={[0.055, 0.075, 0.11, 12]} />
        <meshStandardMaterial color="#d2bd77" metalness={0.72} roughness={0.26} />
      </mesh>
      <group ref={head} position={[0, 1.29, 0]}>
        <RoundedBox args={[0.38, 0.3, 0.31]} radius={0.12} smoothness={5} castShadow>
          <meshStandardMaterial color="#b4beb5" metalness={0.64} roughness={0.3} />
        </RoundedBox>
        <RoundedBox args={[0.3, 0.16, 0.035]} radius={0.06} smoothness={4} position={[0, -0.015, 0.162]}>
          <meshStandardMaterial color="#14272e" metalness={0.38} roughness={0.2} />
        </RoundedBox>
        <mesh position={[0, -0.01, 0.19]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.022, 20]} />
          <meshStandardMaterial color="#74898c" metalness={0.82} roughness={0.24} />
        </mesh>
        <mesh position={[0, -0.01, 0.207]}>
          <sphereGeometry args={[0.045, 16, 12]} />
          <meshPhysicalMaterial color="#53d8ed" emissive="#16748a" emissiveIntensity={0.9} roughness={0.12} metalness={0.12} clearcoat={1} />
        </mesh>
        {[-0.12, 0.12].map((x) => (
          <mesh key={x} position={[x, 0.08, 0.17]}>
            <sphereGeometry args={[0.018, 8, 6]} />
            <meshStandardMaterial color="#e3b65d" emissive="#b98537" emissiveIntensity={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 0.19, 0]}>
          <cylinderGeometry args={[0.018, 0.025, 0.18, 8]} />
          <meshStandardMaterial color="#7c8b87" metalness={0.76} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.29, 0]}>
          <sphereGeometry args={[0.035, 10, 8]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={1.2} />
        </mesh>
      </group>
      {[-1, 1].map((side) => (
        <group key={side} ref={side < 0 ? leftArm : rightArm} position={[side * 0.26, 0.84, 0]}>
          <mesh position={[side * 0.055, -0.13, 0]}>
            <capsuleGeometry args={[0.065, 0.17, 4, 8]} />
            <meshStandardMaterial color="#aeb9b1" metalness={0.55} roughness={0.4} />
          </mesh>
          <mesh position={[side * 0.09, -0.27, 0]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial color="#4d6062" metalness={0.74} roughness={0.28} />
          </mesh>
          <mesh position={[side * 0.09, -0.27, 0.055]}>
            <torusGeometry args={[0.054, 0.012, 6, 12]} />
            <meshStandardMaterial color="#d3bd77" metalness={0.82} roughness={0.24} />
          </mesh>
          <mesh position={[side * 0.08, -0.32, -0.045]} rotation={[0.28, 0, side * 0.12]}>
            <cylinderGeometry args={[0.018, 0.018, 0.22, 8]} />
            <meshStandardMaterial color="#ccd2c7" metalness={0.82} roughness={0.25} />
          </mesh>
          <mesh position={[side * 0.08, -0.37, 0.015]}>
            <capsuleGeometry args={[0.052, 0.13, 4, 8]} />
            <meshStandardMaterial color="#899b96" metalness={0.6} roughness={0.36} />
          </mesh>
          <mesh position={[side * 0.08, -0.45, 0.035]}>
            <boxGeometry args={[0.12, 0.09, 0.12]} />
            <meshStandardMaterial color="#35484c" metalness={0.7} roughness={0.3} />
          </mesh>
          {[-1, 1].map((finger) => (
            <mesh key={finger} position={[side * 0.08 + finger * 0.035, -0.5, 0.075]}>
              <cylinderGeometry args={[0.012, 0.012, 0.075, 6]} />
              <meshStandardMaterial color="#c0c9bd" metalness={0.76} roughness={0.28} />
            </mesh>
          ))}
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} ref={side < 0 ? leftLeg : rightLeg} position={[side * 0.105, 0.43, 0]}>
          <mesh position={[0, -0.12, 0]}>
            <capsuleGeometry args={[0.065, 0.18, 4, 8]} />
            <meshStandardMaterial color="#899995" metalness={0.58} roughness={0.42} />
          </mesh>
          <mesh position={[0, -0.24, 0]}>
            <sphereGeometry args={[0.065, 10, 8]} />
            <meshStandardMaterial color="#44565a" metalness={0.74} roughness={0.28} />
          </mesh>
          <mesh position={[0, -0.24, 0.048]}>
            <torusGeometry args={[0.05, 0.012, 6, 12]} />
            <meshStandardMaterial color="#d1bb76" metalness={0.82} roughness={0.24} />
          </mesh>
          <mesh position={[0, -0.35, 0]}>
            <capsuleGeometry args={[0.05, 0.14, 4, 8]} />
            <meshStandardMaterial color="#aab5ac" metalness={0.62} roughness={0.36} />
          </mesh>
          <mesh position={[0, -0.32, -0.045]} rotation={[0.22, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.18, 8]} />
            <meshStandardMaterial color="#d0d5c9" metalness={0.84} roughness={0.24} />
          </mesh>
          <RoundedBox args={[0.16, 0.09, 0.24]} radius={0.035} smoothness={3} position={[0, -0.45, 0.045]}>
            <meshStandardMaterial color="#344347" metalness={0.56} roughness={0.54} />
          </RoundedBox>
        </group>
      ))}
      <mesh position={[0.21, 0.59, 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.055, 0.012, 6, 12]} />
        <meshStandardMaterial color="#d3bd77" metalness={0.82} roughness={0.24} />
      </mesh>
    </group>
  );
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
    const safePosition = keepPathAwayFromBuildings([x, z], 0.55);
    ref.current.position.set(safePosition[0], -0.176 + Math.abs(Math.sin(time * 3.4 + phaseOffset)) * 0.012, safePosition[1]);
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

function BuildingStatusBeacon({ color, urgent }: { color: string; urgent: boolean }) {
  const lens = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.getElapsedTime() * (urgent ? 6 : 2.4)) + 1) / 2;
    if (lens.current) lens.current.emissiveIntensity = urgent ? 0.65 + pulse * 1.1 : 0.35 + pulse * 0.3;
  });

  return (
    <group>
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[0.24, 0.13, 0.12]} />
        <meshStandardMaterial color="#263236" metalness={0.65} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.13, 0.01]}>
        <sphereGeometry args={[0.075, 14, 10]} />
        <meshStandardMaterial ref={lens} color={color} emissive={color} emissiveIntensity={1} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ColonyBuilding({
  track, tier, runtime, selected, alerted, eventId, position, onClick, onInteraction, mars, nightMode = false
}: {
  track: TechnologyTrack;
  tier: Tier;
  runtime: BuildingRuntime;
  selected: boolean;
  alerted: boolean;
  eventId: string | null;
  position: [number, number];
  onClick: () => void;
  onInteraction?: () => void;
  mars: boolean;
  nightMode?: boolean;
}) {
  const [x, z] = position;
  const p = palette(track.id);
  const urgent = alerted || runtime.condition < 55;
  const needsSupervision = !urgent && (runtime.condition < 82 || runtime.status !== "ONLINE");
  const statusBeaconColor = urgent ? "#ff4052" : needsSupervision ? "#f0c45b" : null;
  return (
    <group
      position={[x, PAD_Y + 0.07, z]}
      rotation={[0, BUILDING_ROTATIONS[track.id] ?? 0, 0]}
      scale={BUILDING_SCALES[track.id] ?? 1.2}
      frustumCulled={false}
      onClick={(e) => { e.stopPropagation(); onInteraction?.(); onClick(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      <Pad position={[0, 0]} size={track.id === "habitat" ? 8.8 : 3.65} mars={mars} accent={p.accent} />
      <group position={[0, 0.04, 0]} frustumCulled={false}>
        <MemoBuildingArt id={track.id} accent={tierColor(tier)} dust={runtime.dust} />
        <MemoBuildingSurfaceDetails large={track.id === "habitat"} accent={tierColor(tier)} />
      </group>
      {statusBeaconColor && (
        <group position={[
          track.id === "habitat" ? 2.4 : 0.88,
          track.id === "habitat" ? 0.39 : 0.35,
          track.id === "habitat" ? 1.92 : 0.86,
        ]}>
          <MemoBuildingStatusBeacon color={statusBeaconColor} urgent={urgent} />
        </group>
      )}
      {alerted && <MemoIncidentEffects eventId={eventId} mars={mars} />}
      {/* Low-power exterior beacons make the colony readable at lunar sunset/night
          without washing out the dark sky or pretending the Sun is still illuminating it. */}
      {nightMode && <group position={[0, track.id === "habitat" ? 3.3 : 1.9, 0]}>
        <mesh><sphereGeometry args={[0.13, 12, 10]} /><meshBasicMaterial color={p.accent} toneMapped={false} /></mesh>
        <pointLight color={p.accent} intensity={track.id === "habitat" ? 1.1 : 0.42} distance={track.id === "habitat" ? 7 : 3.8} decay={2} />
      </group>}
      <MemoTierHardware tier={tier} large={track.id === "habitat"} upgradeLevel={runtime.upgradeLevel ?? 0} />
      <mesh position={[0, 0.095, 0]} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
        <ringGeometry args={track.id === "habitat" ? [2.02, 2.12, 48] : [1.42, 1.54, 40]} />
        <meshBasicMaterial color={alerted ? "#ff4052" : statusColor(runtime.condition)} transparent opacity={0.94} depthWrite={false} toneMapped={false} />
      </mesh>
      {(runtime.upgradeLevel ?? 0) > 0 && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
          <ringGeometry args={[1.62, 1.69, 40]} />
          <meshBasicMaterial color="#efc85f" transparent opacity={0.98} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <MemoSelectionRing selected={selected} alerted={alerted} radius={track.id === "habitat" ? 4.24 : 2.05} height={0.12} />
      {track.id !== "rover" && (
  <Billboard
          position={[0, track.id === "habitat" ? 5.0 : track.id === "extraction" ? 4.35 : 3.35, 0]}
          follow
          frustumCulled={false}
        >
          <mesh position={[0, -0.04, -0.045]} renderOrder={12}>
            <planeGeometry args={[Math.max(2.35, Math.min(5.4, track.category.length * 0.19 + 0.7)), 0.76]} />
            <meshBasicMaterial color="#071117" transparent opacity={0.78} depthWrite={false} toneMapped={false} />
          </mesh>
          <Text frustumCulled={false} position={[0, 0.16, 0]} fontSize={track.id === "habitat" ? 0.48 : 0.36} color={selected ? "#fff0a2" : "#f0f5ef"} outlineWidth={0.035} outlineColor="#11191d" anchorX="center" anchorY="middle">{track.category.toUpperCase()}</Text>
          <Text frustumCulled={false} position={[0, -0.16, 0]} fontSize={0.2} color={tierColor(tier)} outlineWidth={0.025} outlineColor="#11191d" anchorX="center" anchorY="middle">{tier.toUpperCase()}</Text>
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
          <br/><b style={{color:"#e8eee9"}}>2.</b> Amber base lights need supervision; a pulsing red base light means immediate action. Open the marked facility to respond.
          <br/><b style={{color:"#e8eee9"}}>3.</b> Walk the compact outpost to inspect each facility. Field sites lie beyond the base; the rover follows its plotted route.
        </div>
        <div style={{display:"flex",gap:9,marginTop:8,fontSize:8,fontWeight:800,letterSpacing:".08em",textTransform:"uppercase",color:"#7f9692"}}>
          <span><i style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#73dda0",marginRight:4}}/>Stable</span>
          <span><i style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#f0c45b",marginRight:4}}/>Needs supervision</span>
          <span><i style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#ff6558",marginRight:4}}/>Do it now</span>
        </div>
      </div>
    </Html>
  );
}

function MissionVitalsHUD({
  metrics,
  physicalReadings,
  colonyHealth,
  alerted,
}: {
  metrics: MissionMetrics;
  physicalReadings: MissionPhysicalReadings;
  colonyHealth: number;
  alerted: boolean;
}) {
  const temperatureMargin = THREE.MathUtils.clamp(100 - Math.abs(metrics.temperature - 21) * 18, 0, 100);
  const radiationSafety = THREE.MathUtils.clamp(100 - metrics.radiation * 3.4, 0, 100);
  const readings = [
    { label: "O₂ reserve", value: metrics.oxygen, display: physicalReadings.oxygen },
    { label: "Cabin temperature", value: temperatureMargin, display: physicalReadings.temperature },
    { label: "Potable water", value: metrics.water, display: physicalReadings.water },
    { label: "Battery storage", value: metrics.battery, display: physicalReadings.battery },
    { label: "Power margin", value: metrics.power, display: physicalReadings.power },
    { label: "Radiation dose", value: radiationSafety, display: physicalReadings.radiation },
    { label: "Food stores", value: metrics.food, display: physicalReadings.food },
  ];
  const colorFor = (value: number) => value < 28 ? "#ff6874" : value < 55 ? "#f0c45b" : "#83e2a8";
  const healthColor = colorFor(colonyHealth);

  return (
    <aside aria-label="EVA colony vital signs" className="pointer-events-none absolute left-3 top-24 z-30 w-[min(76vw,276px)] border border-[#75a9a0]/35 bg-[#07151b]/85 p-3 font-mono text-white shadow-[0_12px_34px_rgba(0,0,0,0.42)] backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-[#51706d]/40 pb-2">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#86d6c6]">EVA telemetry · colony link</p>
          <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[#aebfba]">Crew life support</p>
        </div>
        <span className={`h-2 w-2 rounded-full ${alerted ? "animate-pulse bg-[#ff5868]" : "bg-[#7de4a3]"}`} />
      </div>
      <div className="mt-2.5 rounded-lg border border-[#456158]/55 bg-[#0c211d]/80 p-2.5">
        <div className="flex items-center justify-between gap-2 text-[8px] font-black uppercase tracking-[0.13em]">
          <span className="text-[#bed0c5]">Colony health</span>
          <span style={{ color: healthColor }}>{Math.round(colonyHealth)}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#1d302d]">
          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${THREE.MathUtils.clamp(colonyHealth, 0, 100)}%`, backgroundColor: healthColor, boxShadow: `0 0 10px ${healthColor}88` }} />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {readings.map((reading) => {
          const color = colorFor(reading.value);
          return (
            <div key={reading.label} className={`min-w-0 rounded-md border border-white/[0.08] bg-black/20 px-2 py-1.5 ${reading.label === "Food stores" ? "col-span-2" : ""}`}>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[7px] font-bold uppercase tracking-[0.09em] text-[#9db3b0]">{reading.label}</span>
                <span className="shrink-0 text-[8px] font-bold" style={{ color }}>{reading.display}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${THREE.MathUtils.clamp(reading.value, 0, 100)}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function IncidentEffects({ eventId, mars }: { eventId: string | null; mars: boolean }) {
  const particles = useRef<Array<THREE.Mesh | null>>([]);
  const warningLight = useRef<THREE.PointLight>(null);
  const count = 10;
  const pressureLeak = eventId === "habitat-pressure";
  const regolithEjecta = eventId === "solar-dust" || eventId === "extraction-lock" || eventId === "micrometeoroid-impact";
  const marsDustFront = mars && eventId === "regional-dust-front";
  const particlesActive = pressureLeak || regolithEjecta || marsDustFront;
  const particleColor = pressureLeak ? "#c9f3ff" : mars ? "#a77a5a" : "#cbb894";
  const warningColor = eventId === "radiation-burst" ? "#bd9cff" : regolithEjecta || marsDustFront ? "#f0a75c" : "#ff4354";

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (warningLight.current) warningLight.current.intensity = 1.15 + (Math.sin(time * 8.5) + 1) * 0.9;
    particles.current.forEach((particle, index) => {
      if (!particle) return;
      const phase = (time * 0.72 + index / count) % 1;
      particle.visible = particlesActive;
      if (pressureLeak) {
        const side = index % 2 === 0 ? -1 : 1;
        particle.position.set(side * (0.18 + phase * 0.48), 0.48 + phase * 1.75, 0.85 + phase * 1.4);
      } else if (marsDustFront) {
        particle.position.set(-2.2 + phase * 4.4, 0.22 + Math.sin(index * 2.1 + time * 2) * 0.34, Math.sin(index * 1.7 + time * 1.4) * 2.2);
      } else if (regolithEjecta) {
        const angle = index * 2.399;
        const radius = 0.25 + phase * 2.05;
        particle.position.set(Math.cos(angle) * radius, 0.12 + Math.sin(phase * Math.PI) * 0.62, Math.sin(angle) * radius);
      }
      particle.scale.setScalar(pressureLeak ? 0.55 + phase * 0.85 : 0.35 + (1 - phase) * 0.8);
    });
  });

  return (
    <group>
      <pointLight ref={warningLight} position={[0, 2.1, 0]} color={warningColor} distance={8} decay={2} />
      {Array.from({ length: count }, (_, index) => (
        <mesh key={index} ref={(mesh) => { particles.current[index] = mesh; }} visible={false}>
          <sphereGeometry args={[pressureLeak ? 0.055 : 0.045, 8, 6]} />
          <meshStandardMaterial color={particleColor} emissive={particleColor} emissiveIntensity={pressureLeak ? 0.65 : 1.2} transparent opacity={0.82} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

type AirlockStatus =
  | "IDLE"
  | "SEALING"
  | "PRESSURIZING"
  | "HELMET_REMOVAL"
  | "HELMET_SEAL"
  | "DEPRESSURIZING"
  | "SUIT_CHECK"
  | "OPENING_HATCH"
  | "PRESSURIZED"
  | "DEPRESSURIZED";

function HabitatInterior({ cabinetOpen, airlockStatus }: { cabinetOpen: boolean; airlockStatus: AirlockStatus }) {
  const cabinetDoor = useRef<THREE.Group>(null);
  const pressureLight = useRef<THREE.Mesh>(null);
  const innerHatch = useRef<THREE.Group>(null);
  const ventFan = useRef<THREE.Group>(null);
  const airflowParticles = useRef<Array<THREE.Mesh | null>>([]);
  const airlockCycling = ["SEALING", "PRESSURIZING", "HELMET_REMOVAL", "HELMET_SEAL", "DEPRESSURIZING", "SUIT_CHECK", "OPENING_HATCH"].includes(airlockStatus);
  const airflowActive = airlockStatus === "PRESSURIZING" || airlockStatus === "DEPRESSURIZING";

  useFrame(({ clock }, delta) => {
    if (cabinetDoor.current) {
      cabinetDoor.current.rotation.y = THREE.MathUtils.damp(
        cabinetDoor.current.rotation.y,
        cabinetOpen ? -1.2 : 0,
        7,
        delta,
      );
    }
    if (pressureLight.current) {
      const material = pressureLight.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = airlockCycling ? 1.1 + (Math.sin(clock.elapsedTime * 8) + 1) * 0.9 : 0.2;
    }
    if (innerHatch.current) {
      const open = airlockStatus === "PRESSURIZED" || airlockStatus === "OPENING_HATCH";
      innerHatch.current.position.x = THREE.MathUtils.damp(innerHatch.current.position.x, open ? 1.08 : 0, 7, delta);
    }
    if (ventFan.current) ventFan.current.rotation.z += delta * (airflowActive ? 5.2 : 1.15);
    airflowParticles.current.forEach((particle, index) => {
      if (!particle) return;
      particle.visible = airflowActive;
      const phase = (clock.elapsedTime * 0.68 + index / airflowParticles.current.length) % 1;
      const progress = airlockStatus === "DEPRESSURIZING" ? phase : 1 - phase;
      particle.position.set(
        Math.sin(index * 2.4) * 0.48,
        0.58 + (index % 5) * 0.34 + Math.sin(clock.elapsedTime * 3 + index) * 0.08,
        1.08 + progress * 2.25,
      );
      particle.scale.setScalar(0.65 + Math.sin(phase * Math.PI) * 0.6);
    });
  });

  return (
    <group>
      <mesh position={[0, -0.16, 0]} receiveShadow>
        <boxGeometry args={[8.4, 0.32, 8.4]} />
        <meshStandardMaterial color="#59656a" metalness={0.55} roughness={0.72} />
      </mesh>
      <mesh position={[0, 3.28, 0]}>
        <boxGeometry args={[8.4, 0.24, 8.4]} />
        <meshStandardMaterial color="#7b8583" metalness={0.48} roughness={0.62} side={THREE.DoubleSide} />
      </mesh>
      {/* Replaceable floor panels, recessed guide lighting and ceiling service rails. */}
      {[-3.1, -1.55, 0, 1.55, 3.1].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.012, 0]}><boxGeometry args={[0.018, 0.018, 7.65]} /><meshStandardMaterial color="#26383c" metalness={0.78} roughness={0.32} /></mesh>
          <mesh position={[x + (x === 0 ? 0.18 : 0), 3.105, 0]}><boxGeometry args={[0.035, 0.025, 7.75]} /><meshStandardMaterial color="#8eaaa3" metalness={0.72} roughness={0.28} emissive="#315d57" emissiveIntensity={0.18} /></mesh>
        </group>
      ))}
      {[-2.75, 2.75].map((x) => (
        <group key={x}>
          <mesh position={[x, 3.08, 0]}><boxGeometry args={[0.62, 0.055, 7.8]} /><meshStandardMaterial color="#d5ddd2" metalness={0.38} roughness={0.42} emissive="#b7d5c7" emissiveIntensity={0.3} /></mesh>
          <pointLight position={[x, 2.82, 0]} color="#c8e7df" intensity={0.72} distance={9} decay={2} />
        </group>
      ))}
      {Array.from({ length: 9 }, (_, index) => (
        <mesh key={index} position={[-3.45 + (index % 3) * 3.45, 3.02, -2.8 + Math.floor(index / 3) * 2.8]}>
          <boxGeometry args={[0.82, 0.055, 0.58]} /><meshStandardMaterial color="#45575b" metalness={0.78} roughness={0.34} />
        </mesh>
      ))}
      <mesh position={[-4.18, 1.55, 0]}>
        <boxGeometry args={[0.24, 3.1, 8.4]} />
        <meshStandardMaterial color="#87918e" metalness={0.4} roughness={0.65} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[4.18, 1.55, 0]}>
        <boxGeometry args={[0.24, 3.1, 8.4]} />
        <meshStandardMaterial color="#87918e" metalness={0.4} roughness={0.65} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.38, -4.18]}>
        <boxGeometry args={[8.4, 0.76, 0.24]} />
        <meshStandardMaterial color="#87918e" metalness={0.4} roughness={0.65} />
      </mesh>
      <mesh position={[0, 3.0, -4.18]}>
        <boxGeometry args={[8.4, 0.68, 0.24]} />
        <meshStandardMaterial color="#87918e" metalness={0.4} roughness={0.65} />
      </mesh>
      {[-3.13, 3.13].map((x) => (
        <mesh key={x} position={[x, 1.95, -4.18]}>
          <boxGeometry args={[2.14, 2.38, 0.24]} />
          <meshStandardMaterial color="#87918e" metalness={0.4} roughness={0.65} />
        </mesh>
      ))}
      <group position={[0, 1.95, -4.02]}>
        <mesh>
          <boxGeometry args={[4.0, 2.16, 0.13]} />
          <meshStandardMaterial color="#22353d" metalness={0.78} roughness={0.24} />
        </mesh>
        <mesh position={[0, 0, -0.075]}>
          <boxGeometry args={[3.64, 1.82, 0.018]} />
          <meshBasicMaterial color="#020815" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -0.055]}>
          <sphereGeometry args={[0.57, 32, 24]} />
          <meshStandardMaterial color="#3c82b4" emissive="#143859" emissiveIntensity={0.42} roughness={0.84} />
        </mesh>
        <mesh position={[0.21, 0.12, -0.045]} scale={[1.015, 1.015, 1.015]}>
          <sphereGeometry args={[0.57, 24, 18, 0, Math.PI * 2, 0.1, Math.PI * 0.72]} />
          <meshStandardMaterial color="#76a86d" roughness={0.92} />
        </mesh>
        {Array.from({ length: 48 }, (_, index) => {
          const x = (((index * 37) % 97) / 97 - 0.5) * 3.48;
          const y = (((index * 61) % 89) / 89 - 0.5) * 1.68;
          const size = index % 7 === 0 ? 0.034 : 0.018;
          return (
            <mesh key={index} position={[x, y, -0.035]}>
              <sphereGeometry args={[size, 6, 5]} />
              <meshBasicMaterial color={index % 9 === 0 ? "#a5dcff" : "#eef5ff"} toneMapped={false} />
            </mesh>
          );
        })}
        <mesh position={[0, 0, 0.08]}>
          <boxGeometry args={[3.72, 1.88, 0.055]} />
          <meshPhysicalMaterial color="#8dc4d0" transparent opacity={0.12} roughness={0.12} metalness={0.1} clearcoat={1} depthWrite={false} />
        </mesh>
        {[-1.88, 1.88].map((x) => (
          <mesh key={x} position={[x, 0, 0.12]}>
            <boxGeometry args={[0.12, 2.22, 0.18]} />
            <meshStandardMaterial color="#bec9be" metalness={0.72} roughness={0.27} />
          </mesh>
        ))}
        {[-1.04, 1.04].map((y) => (
          <mesh key={y} position={[0, y, 0.12]}>
            <boxGeometry args={[3.86, 0.12, 0.18]} />
            <meshStandardMaterial color="#bec9be" metalness={0.72} roughness={0.27} />
          </mesh>
        ))}
        <Text position={[0, -1.29, 0.13]} fontSize={0.12} color="#c9ded8" anchorX="center" anchorY="middle">
          OBSERVATION WINDOW · EARTH IN VIEW
        </Text>
      </group>
      <group position={[-2.95, 0, -1.43]}>
        <RoundedBox args={[1.48, 0.24, 2.48]} radius={0.1} smoothness={4} position={[0, 0.26, 0]}>
          <meshStandardMaterial color="#56666a" metalness={0.45} roughness={0.5} />
        </RoundedBox>
        <RoundedBox args={[1.34, 0.28, 2.28]} radius={0.12} smoothness={5} position={[0, 0.49, 0]}>
          <meshStandardMaterial color="#b4c0b5" roughness={0.92} />
        </RoundedBox>
        <RoundedBox args={[0.78, 0.16, 0.48]} radius={0.1} smoothness={5} position={[0, 0.69, -0.79]}>
          <meshStandardMaterial color="#e0e3d5" roughness={0.96} />
        </RoundedBox>
        <mesh position={[0, 0.11, 0.68]}>
          <boxGeometry args={[1.28, 0.16, 0.55]} />
          <meshStandardMaterial color="#46565a" metalness={0.58} roughness={0.42} />
        </mesh>
        <mesh position={[0.6, 1.55, -0.95]}>
          <boxGeometry args={[0.22, 0.36, 0.08]} />
          <meshStandardMaterial color="#dce4d5" emissive="#d4e5bb" emissiveIntensity={0.45} />
        </mesh>
        <pointLight position={[0.6, 1.3, -0.82]} color="#e8e9c8" intensity={0.35} distance={2.2} />
      </group>
      <group position={[-1.88, 1.2, -1.45]}>
        <mesh>
          <boxGeometry args={[0.1, 2.4, 2.55]} />
          <meshStandardMaterial color="#526369" metalness={0.52} roughness={0.48} transparent opacity={0.86} />
        </mesh>
        <mesh position={[0.06, 0.05, 0]}>
          <boxGeometry args={[0.025, 2.25, 0.045]} />
          <meshStandardMaterial color="#6ee3d1" emissive="#2aa997" emissiveIntensity={0.5} />
        </mesh>
      </group>
      <Text position={[-2.98, 2.05, 0.28]} rotation={[0, 0, 0]} fontSize={0.13} color="#c6d9cd" anchorX="center" anchorY="middle">
        SLEEPING QUARTERS
      </Text>
      <group position={[1.58, 0, -3.55]}>
        <RoundedBox args={[3.55, 0.78, 0.62]} radius={0.09} smoothness={4} position={[0, 0.42, 0]}>
          <meshStandardMaterial color="#8c9991" metalness={0.48} roughness={0.44} />
        </RoundedBox>
        <RoundedBox args={[3.62, 0.1, 0.7]} radius={0.04} smoothness={3} position={[0, 0.85, 0]}>
          <meshStandardMaterial color="#d0d4c8" metalness={0.52} roughness={0.32} />
        </RoundedBox>
        <RoundedBox args={[0.72, 0.08, 0.42]} radius={0.08} smoothness={4} position={[-0.78, 0.91, -0.02]}>
          <meshStandardMaterial color="#56696a" metalness={0.55} roughness={0.3} />
        </RoundedBox>
        <mesh position={[-0.78, 0.98, 0.02]}>
          <ringGeometry args={[0.13, 0.17, 24]} />
          <meshStandardMaterial color="#9aa9a0" metalness={0.72} roughness={0.26} />
        </mesh>
        <mesh position={[-0.78, 1.08, 0.06]}>
          <cylinderGeometry args={[0.025, 0.025, 0.2, 8]} />
          <meshStandardMaterial color="#9aa9a0" metalness={0.76} roughness={0.25} />
        </mesh>
        <mesh position={[0.15, 0.94, 0.02]}>
          <boxGeometry args={[0.55, 0.035, 0.42]} />
          <meshStandardMaterial color="#15272b" metalness={0.32} roughness={0.28} />
        </mesh>
        <mesh position={[0.15, 0.97, 0.02]}>
          <boxGeometry args={[0.42, 0.018, 0.28]} />
          <meshStandardMaterial color="#db9f54" emissive="#b96c2d" emissiveIntensity={0.45} />
        </mesh>
        <mesh position={[1.23, 1.36, -0.13]}>
          <boxGeometry args={[1.95, 0.82, 0.22]} />
          <meshStandardMaterial color="#a6b0a7" metalness={0.42} roughness={0.38} />
        </mesh>
        <mesh position={[1.23, 1.36, 0.0]}>
          <boxGeometry args={[1.64, 0.58, 0.04]} />
          <meshStandardMaterial color="#35484c" metalness={0.4} roughness={0.42} />
        </mesh>
        <Text position={[0, 1.8, 0.03]} fontSize={0.12} color="#c6d9cd" anchorX="center" anchorY="middle">
          GALLEY · WATER · FOOD
        </Text>
      </group>
      {[-2.8, -1.4, 0, 1.4, 2.8].map((x) => (
        <mesh key={x} position={[x, 3.12, 0]}>
          <boxGeometry args={[0.12, 0.12, 8.2]} />
          <meshStandardMaterial color="#d0d5cd" metalness={0.72} roughness={0.38} />
        </mesh>
      ))}
      {[-2.5, 2.5].map((x) => (
        <mesh key={x} position={[x, 1.55, 4.12]}>
          <boxGeometry args={[3.3, 3.1, 0.22]} />
          <meshStandardMaterial color="#87918e" metalness={0.4} roughness={0.65} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 4.02, 1.9, -0.35]} rotation={[0, side * Math.PI / 2, 0]}>
          <mesh position={[0, 0, -0.08]}>
            <circleGeometry args={[0.7, 32]} />
            <meshBasicMaterial color="#030916" toneMapped={false} />
          </mesh>
          <mesh position={[0.16, 0.06, -0.025]}>
            <sphereGeometry args={[0.31, 20, 16]} />
            <meshStandardMaterial color={side < 0 ? "#cb8061" : "#4388b6"} emissive={side < 0 ? "#693f38" : "#173955"} emissiveIntensity={0.35} roughness={0.86} />
          </mesh>
          {Array.from({ length: 10 }, (_, index) => {
            const x = (((index * 17) % 29) / 29 - 0.5) * 1.15;
            const y = (((index * 11) % 23) / 23 - 0.5) * 1.15;
            return (
              <mesh key={index} position={[x, y, 0]}>
                <sphereGeometry args={[0.018, 6, 5]} />
                <meshBasicMaterial color="#edf5ff" toneMapped={false} />
              </mesh>
            );
          })}
          <mesh position={[0, 0, 0.04]}>
            <torusGeometry args={[0.7, 0.11, 10, 36]} />
            <meshStandardMaterial color="#aebbb2" metalness={0.82} roughness={0.24} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2.82, 4.12]}>
        <boxGeometry args={[1.7, 0.55, 0.22]} />
        <meshStandardMaterial color="#87918e" metalness={0.4} roughness={0.65} />
      </mesh>
      <group ref={innerHatch} position={[0, 1.36, 3.98]}>
        <mesh>
          <boxGeometry args={[1.55, 2.05, 0.16]} />
          <meshStandardMaterial color="#44545a" metalness={0.72} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0, -0.1]}>
          <boxGeometry args={[1.12, 1.62, 0.06]} />
          <meshStandardMaterial color="#829095" metalness={0.62} roughness={0.35} />
        </mesh>
        <mesh position={[0.42, 0, -0.17]}>
          <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
          <meshStandardMaterial color="#d5c27c" metalness={0.78} roughness={0.26} />
        </mesh>
      </group>
      <group position={[2.12, 0, -0.65]}>
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[1.18, 1.9, 0.72]} />
          <meshStandardMaterial color="#9da8a2" metalness={0.42} roughness={0.46} />
        </mesh>
        <mesh position={[0, 0.98, 0.39]}>
          <boxGeometry args={[0.94, 1.55, 0.08]} />
          <meshStandardMaterial color="#273b40" metalness={0.4} roughness={0.48} />
        </mesh>
        <mesh position={[0, 0.98, 0.445]}>
          <boxGeometry args={[0.035, 1.35, 0.025]} />
          <meshStandardMaterial color="#79d8bc" emissive="#2b8a73" emissiveIntensity={0.5} />
        </mesh>
        <group ref={cabinetDoor} position={[-0.48, 1.03, 0.47]}>
          <mesh position={[0.48, 0, 0]}>
            <boxGeometry args={[0.96, 1.62, 0.07]} />
            <meshStandardMaterial color="#b4bdb4" metalness={0.6} roughness={0.34} />
          </mesh>
          <mesh position={[0.82, 0, 0.06]}>
            <boxGeometry args={[0.035, 0.28, 0.08]} />
            <meshStandardMaterial color="#e5c773" metalness={0.72} roughness={0.28} />
          </mesh>
        </group>
        <mesh position={[0, 2.04, 0.06]}>
          <boxGeometry args={[1.28, 0.08, 0.78]} />
          <meshStandardMaterial color="#c5cdc3" metalness={0.55} roughness={0.4} />
        </mesh>
      </group>
      <group position={[0, 2.98, 0]}>
        <mesh><boxGeometry args={[1.55, 0.08, 0.74]} /><meshStandardMaterial color="#dce3da" emissive="#e7f2db" emissiveIntensity={0.55} roughness={0.42} /></mesh>
        <pointLight position={[0, -0.18, 0]} color="#d9e8d2" intensity={1.35} distance={8} decay={2} />
      </group>
      <group position={[3.91, 2.12, 1.45]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 0, -0.08]}><cylinderGeometry args={[0.53, 0.53, 0.16, 32]} /><meshStandardMaterial color="#34464b" metalness={0.86} roughness={0.28} /></mesh>
        <mesh position={[0, 0, 0.015]}><torusGeometry args={[0.49, 0.055, 12, 40]} /><meshStandardMaterial color="#9baaa3" metalness={0.84} roughness={0.22} /></mesh>
        <group ref={ventFan}>
          {[0, 1, 2, 3].map((blade) => <mesh key={blade} rotation={[0, 0, blade * Math.PI / 2]} position={[0.18, 0.1, 0.07]}><boxGeometry args={[0.48, 0.13, 0.045]} /><meshStandardMaterial color="#71858a" metalness={0.82} roughness={0.26} /></mesh>)}
          <mesh position={[0, 0, 0.12]}><sphereGeometry args={[0.12, 20, 16]} /><meshStandardMaterial color="#d0d8cc" metalness={0.86} roughness={0.2} /></mesh>
        </group>
        <pointLight position={[0, 0, 0.32]} color="#83d8c7" intensity={0.28} distance={2.4} />
      </group>
      <group position={[0, 2.28, 3.78]}>
        <mesh>
          <boxGeometry args={[0.55, 0.38, 0.08]} />
          <meshStandardMaterial ref={pressureLight} color="#5bd9a3" emissive="#1eaa69" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[0.38, 0.07, 0.025]} />
          <meshBasicMaterial color="#d7e5df" />
        </mesh>
      </group>
      <Text position={[0, 2.55, 3.78]} fontSize={0.12} color="#d6e2d9" anchorX="center" anchorY="middle">
        AIRLOCK · PRESSURE SEAL
      </Text>
      <Text position={[2.12, 2.2, -0.2]} fontSize={0.13} color="#dce7dc" anchorX="center" anchorY="middle">
        CREW STORES
      </Text>
      <Text position={[-2.95, 1.08, -1.43]} fontSize={0.12} color="#dce7dc" anchorX="center" anchorY="middle">
        CREW BERTH
      </Text>
      <HabitatExpansion />
      {Array.from({ length: 18 }, (_, index) => (
        <mesh key={index} ref={(mesh) => { airflowParticles.current[index] = mesh; }} visible={false}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <meshBasicMaterial color="#c4f4ff" transparent opacity={0.72} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Additional pressurised crew modules connected to the existing habitat airlock. */
function HabitatExpansion() {
  const rooms = [
    { x: -5.55, z: 7, title: "CREW QUARTERS · 4 BERTHS", accent: "#79d9d0" },
    { x: 5.55, z: 7, title: "MEDICAL BAY · FIRST AID", accent: "#8bd6b0" },
    { x: -5.55, z: 13, title: "HYDROPONICS · FOOD GROWTH", accent: "#83d98b" },
    { x: 5.55, z: 13, title: "EXERCISE & SCIENCE LAB", accent: "#8bc8ed" },
  ];
  const wall = "#87918e";
  return (
    <group>
      <mesh position={[0, -0.16, 11]} receiveShadow>
        <boxGeometry args={[3.8, 0.32, 14.2]} />
        <meshStandardMaterial color="#59656a" metalness={0.55} roughness={0.72} />
      </mesh>
      <mesh position={[0, 3.28, 11]}>
        <boxGeometry args={[3.8, 0.2, 14.2]} />
        <meshStandardMaterial color="#7b8583" metalness={0.48} roughness={0.62} side={THREE.DoubleSide} />
      </mesh>
      {[-1.9, 1.9].map((x) => [4.1, 9.5, 10.5, 15.8].map((z, i) => (
        <mesh key={x + ":" + z} position={[x, 1.55, z + (i === 0 || i === 3 ? 0.9 : 0)]}>
          <boxGeometry args={[0.2, 3.1, i === 0 || i === 3 ? 1.8 : 1.0]} />
          <meshStandardMaterial color={wall} metalness={0.42} roughness={0.62} />
        </mesh>
      )))}
      <mesh position={[0, 1.55, 18.1]}>
        <boxGeometry args={[3.8, 3.1, 0.22]} />
        <meshStandardMaterial color={wall} metalness={0.42} roughness={0.62} />
      </mesh>
      {rooms.map((room, index) => {
        const side = room.x < 0 ? -1 : 1;
        return (
          <group key={room.title}>
            <mesh position={[room.x, -0.16, room.z]} receiveShadow>
              <boxGeometry args={[7.3, 0.32, 4.8]} />
              <meshStandardMaterial color="#59656a" metalness={0.5} roughness={0.75} />
            </mesh>
            <mesh position={[room.x, 3.28, room.z]}>
              <boxGeometry args={[7.3, 0.2, 4.8]} />
              <meshStandardMaterial color="#7b8583" metalness={0.48} roughness={0.62} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[side * 9.2, 1.55, room.z]}>
              <boxGeometry args={[0.22, 3.1, 4.8]} />
              <meshStandardMaterial color={wall} metalness={0.42} roughness={0.62} />
            </mesh>
            {[-2.3, 2.3].map((dz) => (
              <mesh key={dz} position={[room.x, 1.55, room.z + dz]}>
                <boxGeometry args={[7.3, 3.1, 0.22]} />
                <meshStandardMaterial color={wall} metalness={0.42} roughness={0.62} />
              </mesh>
            ))}
            <mesh position={[room.x, 2.94, room.z]}>
              <boxGeometry args={[2.0, 0.12, 0.55]} />
              <meshStandardMaterial color={room.accent} emissive={room.accent} emissiveIntensity={0.55} />
            </mesh>
            <pointLight position={[room.x, 2.55, room.z]} color={room.accent} intensity={0.75} distance={8} />
            <Text position={[room.x, 2.65, room.z - 1.92]} fontSize={0.16} color={room.accent} anchorX="center" anchorY="middle">{room.title}</Text>
            {index === 0 && (
              <group position={[room.x, 0, room.z]}>
                {[-1.35, 1.35].map((x) => [-0.95, 0.95].map((z) => (
                  <group key={x + ":" + z} position={[x, 0, z]}>
                    <RoundedBox args={[1.55, 0.2, 1.85]} radius={0.08} position={[0, 0.48, 0]}>
                      <meshStandardMaterial color="#53636a" metalness={0.5} roughness={0.48} />
                    </RoundedBox>
                    <RoundedBox args={[1.42, 0.22, 1.7]} radius={0.1} position={[0, 0.69, 0]}>
                      <meshStandardMaterial color="#d0d8ce" roughness={0.9} />
                    </RoundedBox>
                    <mesh position={[0, 1.35, -0.72]}>
                      <boxGeometry args={[1.5, 1.25, 0.1]} />
                      <meshStandardMaterial color="#45565c" metalness={0.45} roughness={0.55} />
                    </mesh>
                  </group>
                )))}
                <Text position={[0, 2.12, 1.95]} fontSize={0.12} color="#c6d9cd" anchorX="center">PERSONAL LOCKERS</Text>
              </group>
            )}
            {index === 1 && (
              <group position={[room.x, 0, room.z]}>
                {[-1.25, 1.25].map((x) => (
                  <group key={x} position={[x, 0, 0.45]}>
                    <RoundedBox args={[1.6, 0.42, 2.0]} radius={0.12} position={[0, 0.42, 0]}>
                      <meshStandardMaterial color="#e0e5df" roughness={0.8} />
                    </RoundedBox>
                    <mesh position={[0, 1.25, -0.72]}>
                      <boxGeometry args={[1.65, 1.15, 0.12]} />
                      <meshStandardMaterial color="#344a52" metalness={0.45} roughness={0.35} />
                    </mesh>
                    <mesh position={[0, 1.25, -0.64]}>
                      <boxGeometry args={[1.35, 0.82, 0.025]} />
                      <meshBasicMaterial color="#174c56" />
                    </mesh>
                  </group>
                ))}
                <Text position={[0, 1.95, -1.85]} fontSize={0.12} color="#d6e2d9" anchorX="center">DIAGNOSTICS · TELEMEDICINE</Text>
              </group>
            )}
            {index === 2 && (
              <group position={[room.x, 0, room.z]}>
                {[-2.1, 0, 2.1].map((x) => (
                  <group key={x} position={[x, 0, 0.25]}>
                    <mesh position={[0, 0.72, 0]}>
                      <boxGeometry args={[1.45, 0.42, 2.7]} />
                      <meshStandardMaterial color="#536b59" metalness={0.28} roughness={0.7} />
                    </mesh>
                    {[-0.8, 0, 0.8].map((z) => (
                      <mesh key={z} position={[0, 1.0, z]}>
                        <sphereGeometry args={[0.28, 12, 8]} />
                        <meshStandardMaterial color="#55a86c" roughness={0.9} />
                      </mesh>
                    ))}
                    <mesh position={[0, 1.22, -1.18]}>
                      <boxGeometry args={[1.5, 0.08, 0.08]} />
                      <meshStandardMaterial color="#a5d98d" emissive="#4c9b54" emissiveIntensity={0.4} />
                    </mesh>
                  </group>
                ))}
                <Text position={[0, 2.05, -1.85]} fontSize={0.12} color="#c6e6c4" anchorX="center">NUTRIENT & WATER RECYCLING</Text>
              </group>
            )}
            {index === 3 && (
              <group position={[room.x, 0, room.z]}>
                <group position={[-1.55, 0, 0.2]}>
                  <mesh position={[0, 0.8, 0]}>
                    <boxGeometry args={[1.0, 1.5, 2.1]} />
                    <meshStandardMaterial color="#45545b" metalness={0.6} roughness={0.38} />
                  </mesh>
                  <mesh position={[0, 1.62, 0]}>
                    <boxGeometry args={[1.1, 0.08, 2.2]} />
                    <meshStandardMaterial color="#79c9d4" emissive="#2e8797" emissiveIntensity={0.45} />
                  </mesh>
                </group>
                <group position={[1.45, 0, -0.35]}>
                  <mesh position={[0, 0.82, 0]}>
                    <boxGeometry args={[2.2, 0.12, 0.9]} />
                    <meshStandardMaterial color="#87918e" metalness={0.6} roughness={0.35} />
                  </mesh>
                  <mesh position={[0, 1.48, -0.34]}>
                    <boxGeometry args={[1.7, 1.15, 0.08]} />
                    <meshStandardMaterial color="#233b46" metalness={0.55} roughness={0.3} />
                  </mesh>
                  <mesh position={[0, 1.48, -0.28]}>
                    <boxGeometry args={[1.48, 0.92, 0.025]} />
                    <meshBasicMaterial color="#123f50" />
                  </mesh>
                </group>
                <Text position={[0, 2.05, -1.85]} fontSize={0.12} color="#c6d9ed" anchorX="center">WORKSTATION · RESEARCH</Text>
              </group>
            )}
          </group>
        );
      })}
      <Text position={[0, 2.7, 11]} fontSize={0.16} color="#d5e7df" anchorX="center" anchorY="middle">
        HABITAT MODULES · CREW ACCESS
      </Text>
    </group>
  );
}

type NearbyInteraction = { id: string; label: string; kind: "FACILITY" | "FIELD SITE" | "CABINET" | "AIRLOCK" | "BERTH" | "GALLEY" } | null;
type InteractionClickState = { current: boolean; requestPending: boolean };

function BuildingSurfaceDetails({ large, accent }: { large: boolean; accent: string }) {
  const fastenerMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#c5cbc4", metalness: 0.82, roughness: 0.3 }),
    [],
  );
  const washerMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#414c4e", metalness: 0.55, roughness: 0.62 }),
    [],
  );
  const panelMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#26383d", metalness: 0.48, roughness: 0.56 }),
    [],
  );
  const fasteners: Array<[number, number]> = large
    ? [[-2.82, -2.08], [2.82, -2.08], [-2.82, 2.08], [2.82, 2.08]]
    : [[-1.12, -0.76], [1.12, -0.76], [-1.12, 0.76], [1.12, 0.76]];

  return (
    <group>
      {fasteners.map(([x, z]) => (
        <group key={`${x}-${z}`} position={[x, large ? 0.335 : 0.365, z]}>
          <mesh material={washerMaterial}>
            <cylinderGeometry args={[0.067, 0.067, 0.018, 12]} />
          </mesh>
          <mesh position={[0, 0.014, 0]} material={fastenerMaterial}>
            <cylinderGeometry args={[0.031, 0.031, 0.025, 6]} />
          </mesh>
        </group>
      ))}
      {!large && (
        <group position={[0, 0.375, 0.7]}>
          <RoundedBox args={[0.56, 0.035, 0.25]} radius={0.035} smoothness={3} material={panelMaterial} />
          <mesh position={[0, 0.022, 0.025]}>
            <boxGeometry args={[0.32, 0.012, 0.13]} />
            <meshStandardMaterial color="#52676a" metalness={0.58} roughness={0.46} />
          </mesh>
          {[-0.18, 0, 0.18].map((x) => (
            <mesh key={x} position={[x, 0.034, 0.027]}>
              <sphereGeometry args={[0.018, 8, 6]} />
              <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.45} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function WalkControls({
  tracks,
  resourceNodes,
  paused,
  habitatInterior,
  cabinetOpen,
  airlockCycling,
  crewSleeping,
  onSelect,
  onCloseInspector,
  onSelectResource,
  onEnterHabitat,
  onActivateHabitatSpot,
  onWake,
  onExitHabitat,
  onToggleCabinet,
  onToggleFlashlight,
  onLockChange,
  onLockError,
  onNearbyChange,
  interactionClickHandled,
  selectedBuildingId,
  selectedResourceId,
}: {
  tracks: TechnologyTrack[];
  resourceNodes: MissionResourceNode[];
  paused: boolean;
  habitatInterior: boolean;
  cabinetOpen: boolean;
  airlockCycling: boolean;
  crewSleeping: boolean;
  onSelect: (trackId: string) => void;
  onCloseInspector: () => void;
  onSelectResource: (node: MissionResourceNode) => void;
  onEnterHabitat: () => void;
  onActivateHabitatSpot: (spot: "BERTH" | "GALLEY") => void;
  onWake: () => void;
  onExitHabitat: () => void;
  onToggleCabinet: () => void;
  onToggleFlashlight: () => void;
  onLockChange: (locked: boolean) => void;
  onLockError: (message: string) => void;
  onNearbyChange: (target: NearbyInteraction) => void;
  interactionClickHandled: InteractionClickState;
  selectedBuildingId: string | null;
  selectedResourceId: string | null;
}) {
  const { gl, camera } = useThree();
  const keys = useRef(new Set<string>());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const playerPosition = useRef(new THREE.Vector3(0, 1.72, 12));
  const jumpRequested = useRef(false);
  const jumpVelocity = useRef(0);
  const nearbyId = useRef<string | null>(null);
  const latest = useRef({
    tracks,
    resourceNodes,
    paused,
    selectedBuildingId,
    selectedResourceId,
    habitatInterior,
    cabinetOpen,
    airlockCycling,
    crewSleeping,
    onSelect,
    onCloseInspector,
    onSelectResource,
    onEnterHabitat,
    onActivateHabitatSpot,
    onWake,
    onExitHabitat,
    onToggleCabinet,
    onLockChange,
    onLockError,
    onNearbyChange,
    onToggleFlashlight,
  });
  latest.current = {
    tracks,
    resourceNodes,
    paused,
    selectedBuildingId,
    selectedResourceId,
    habitatInterior,
    cabinetOpen,
    airlockCycling,
    crewSleeping,
    onSelect,
    onCloseInspector,
    onSelectResource,
    onEnterHabitat,
    onActivateHabitatSpot,
    onWake,
    onExitHabitat,
    onToggleCabinet,
    onLockChange,
    onLockError,
    onNearbyChange,
    onToggleFlashlight,
  };

  useEffect(() => {
    const spawnZ = habitatInterior ? 2.2 : 7;
    camera.position.set(0, habitatInterior ? 1.56 : terrainHeight(0, spawnZ) + 1.72, spawnZ);
    yaw.current = habitatInterior ? Math.PI : 0;
    pitch.current = 0;
    jumpVelocity.current = 0;
    keys.current.clear();
  }, [camera, habitatInterior]);

  useEffect(() => {
    const canvas = gl.domElement;
    const requestPointerLock = () => {
      try {
        interactionClickHandled.requestPending = true;
        void Promise.resolve(canvas.requestPointerLock())
          .then(() => {
            interactionClickHandled.requestPending = false;
            if (interactionClickHandled.current) {
              if (document.pointerLockElement === canvas) document.exitPointerLock();
              interactionClickHandled.current = false;
            }
          })
          .catch(() => {
            interactionClickHandled.requestPending = false;
            latest.current.onLockError("Mouse capture was denied. Press F or click the scene to try again.");
          });
      } catch {
        interactionClickHandled.requestPending = false;
        latest.current.onLockError("Mouse capture is unavailable in this browser context.");
      }
    };
    const handleClick = () => {
      if (latest.current.paused) return;
      if (interactionClickHandled.current) {
        interactionClickHandled.current = false;
        return;
      }
      if (document.pointerLockElement !== canvas) requestPointerLock();
    };
    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      keys.current.clear();
      latest.current.onLockChange(locked);
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (latest.current.paused || document.pointerLockElement !== canvas) return;
      yaw.current -= event.movementX * 0.0022;
      pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * 0.0022, -1.25, 1.25);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (latest.current.paused) return;
      if (key === "f" && !event.repeat) {
        event.preventDefault();
        latest.current.onToggleFlashlight();
        return;
      }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(key)) {
        event.preventDefault();
        keys.current.add(key);
      }
      if (key === " " && !event.repeat) {
        event.preventDefault();
        jumpRequested.current = true;
      }
      if (key === "e" && !event.repeat) {
        const player = playerPosition.current;
        if (latest.current.crewSleeping) {
          latest.current.onWake();
          return;
        }
        if (latest.current.habitatInterior) {
          if (latest.current.airlockCycling) return;
          const cabinetDistance = Math.hypot(player.x - 2.12, player.z - 0.2);
          const berthDistance = Math.hypot(player.x + 2.95, player.z + 1.43);
          const galleyDistance = Math.hypot(player.x - 0.1, player.z + 2.8);
          const airlockDistance = Math.hypot(player.x, player.z - 3.25);
          if (cabinetDistance < 1.7) {
            const closingCabinet = latest.current.cabinetOpen;
            latest.current.onToggleCabinet();
            if (closingCabinet) requestPointerLock();
          }
          else if (berthDistance < 1.9) latest.current.onActivateHabitatSpot("BERTH");
          else if (galleyDistance < 1.8) latest.current.onActivateHabitatSpot("GALLEY");
          else if (airlockDistance < 1.8) latest.current.onExitHabitat();
          return;
        }
        const airlockDistance = Math.hypot(player.x, player.z - 4.45);
        if (airlockDistance < 1.8) {
          latest.current.onEnterHabitat();
          return;
        }
        let closest: { distance: number; trackId?: string; node?: MissionResourceNode } | null = null;
        for (const track of latest.current.tracks) {
          const position = POSITIONS[track.id];
          if (!position) continue;
          const distance = Math.hypot(player.x - position[0], player.z - position[1]);
          if (distance < 7.5 && (!closest || distance < closest.distance)) {
            closest = { distance, trackId: track.id };
          }
        }
        for (const node of latest.current.resourceNodes) {
          const [x, z] = nodeWorldPosition(node);
          const distance = Math.hypot(player.x - x, player.z - z);
          if (distance < 7.5 && (!closest || distance < closest.distance)) {
            closest = { distance, node };
          }
        }
        if (closest?.trackId || closest?.node) {
          if (document.pointerLockElement === canvas) document.exitPointerLock();
        }
        if (closest?.trackId) {
          const closingInspector = latest.current.selectedBuildingId === closest.trackId;
          latest.current.onSelect(closest.trackId);
          if (closingInspector) requestPointerLock();
        } else if (closest?.node) {
          const closingInspector = latest.current.selectedResourceId === closest.node.id;
          if (closingInspector) latest.current.onCloseInspector();
          else latest.current.onSelectResource(closest.node);
          if (closingInspector) requestPointerLock();
        } else {
          const closingInspector = Boolean(latest.current.selectedBuildingId || latest.current.selectedResourceId);
          latest.current.onCloseInspector();
          if (closingInspector) requestPointerLock();
        }
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const handlePointerLockCleanup = () => {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      latest.current.onLockChange(false);
    };

    canvas.addEventListener("click", handleClick);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      canvas.removeEventListener("click", handleClick);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      handlePointerLockCleanup();
      latest.current.onNearbyChange(null);
    };
  }, [gl, interactionClickHandled]);

  useEffect(() => {
    keys.current.clear();
    jumpRequested.current = false;
    if (paused && document.pointerLockElement === gl.domElement) document.exitPointerLock();
  }, [gl, paused]);

  useFrame(({ camera }, delta) => {
    const player = camera as THREE.PerspectiveCamera;
    playerPosition.current.copy(player.position);
    player.rotation.order = "YXZ";
    player.rotation.set(pitch.current, yaw.current, 0);

    const floorY = habitatInterior ? 1.56 : terrainHeight(player.position.x, player.position.z) + 1.72;
    if (!airlockCycling && jumpRequested.current && player.position.y <= floorY + 0.03) jumpVelocity.current = habitatInterior ? 1.9 : 2.8;
    jumpRequested.current = false;
    if (!airlockCycling && !crewSleeping) {
      jumpVelocity.current -= 1.62 * Math.min(delta, 0.05);
      player.position.y += jumpVelocity.current * Math.min(delta, 0.05);
      if (player.position.y <= floorY) {
        player.position.y = floorY;
        jumpVelocity.current = 0;
      }
    } else {
      keys.current.clear();
    }

    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    const direction = new THREE.Vector3();
    if (!airlockCycling && !crewSleeping) {
      if (keys.current.has("w") || keys.current.has("arrowup")) direction.add(forward);
      if (keys.current.has("s") || keys.current.has("arrowdown")) direction.sub(forward);
      if (keys.current.has("d") || keys.current.has("arrowright")) direction.add(right);
      if (keys.current.has("a") || keys.current.has("arrowleft")) direction.sub(right);
    }
    if (direction.lengthSq() > 0) {
      direction.normalize();
      const speed = (keys.current.has("shift") ? 7 : 4.5) / (habitatInterior ? 1 : COLONY_WORLD_SCALE);
      const distance = speed * Math.min(delta, 0.05);
      const nextX = player.position.x + direction.x * distance;
      const nextZ = player.position.z + direction.z * distance;
      const collides = (x: number, z: number) => {
        if (habitatInterior) {
          const outsideStation = Math.abs(x) > 9.05 || z < -3.88 || z > 17.85;
          const corridorWall = Math.abs(x) > 1.45 && Math.abs(x) < 2.15 && (
            (z > 4.1 && z < 5.9) || (z > 9.0 && z < 11.0) || (z > 15.8 && z < 17.6)
          );
          const roomDivider = Math.abs(x) > 2.0 && z > 9.35 && z < 10.65;
          const roomEndWalls = Math.abs(x) > 2.0 && (
            (z > 4.35 && z < 4.72) || (z > 9.25 && z < 9.62)
            || (z > 10.38 && z < 10.75) || (z > 15.25 && z < 15.62)
          );
          return outsideStation || corridorWall || roomDivider || roomEndWalls
            || (Math.abs(x - 2.12) < 0.78 && Math.abs(z + 0.65) < 0.56)
            || (x > -3.8 && x < -2.05 && z > -2.92 && z < 0.08)
            || (x > -2.16 && x < -1.6 && z > -2.72 && z < -0.18)
            || (x > -0.3 && x < 3.5 && z > -4.02 && z < -3.1);
        }
        if (Math.abs(x) > 48 || Math.abs(z) > 48) return true;
        const nearBuilding = tracks.some((track) => {
          const position = POSITIONS[track.id];
          if (!position) return false;
          if (track.id === "habitat" && Math.abs(x - position[0]) < 1.35 && z - position[1] > 3.3 && z - position[1] < 6.4) return false;
          const radius = buildingClearanceRadius(track.id);
          return Math.hypot(x - position[0], z - position[1]) < radius;
        });
        return nearBuilding || ROVER_ROUTE_ROCKS.some((rock) => Math.hypot(x - rock.x, z - rock.z) < rock.radius + 0.55);
      };

      if (!collides(nextX, player.position.z)) player.position.x = nextX;
      if (!collides(player.position.x, nextZ)) player.position.z = nextZ;
    }
    const updatedFloorY = habitatInterior ? 1.56 : terrainHeight(player.position.x, player.position.z) + 1.72;
    if (player.position.y <= updatedFloorY) {
      player.position.y = updatedFloorY;
      jumpVelocity.current = 0;
    }
    playerPosition.current.copy(player.position);
    let nearest: { distance: number; target: Exclude<NearbyInteraction, null> } | null = null;
    if (habitatInterior) {
      const cabinetDistance = Math.hypot(player.position.x - 2.12, player.position.z - 0.2);
      if (cabinetDistance < 1.7) {
        nearest = { distance: cabinetDistance, target: { id: "supply-cabinet", label: cabinetOpen ? "CREW SUPPLY CABINET · OPEN" : "CREW SUPPLY CABINET", kind: "CABINET" } };
      }
      const berthDistance = Math.hypot(player.position.x + 2.95, player.position.z + 1.43);
      if (berthDistance < 1.9 && (!nearest || berthDistance < nearest.distance)) {
        nearest = { distance: berthDistance, target: { id: "crew-berth", label: "CREW BERTH · SLEEP", kind: "BERTH" } };
      }
      const galleyDistance = Math.hypot(player.position.x - 0.1, player.position.z + 2.8);
      if (galleyDistance < 1.8 && (!nearest || galleyDistance < nearest.distance)) {
        nearest = { distance: galleyDistance, target: { id: "habitat-galley", label: "GALLEY · CREW STATION", kind: "GALLEY" } };
      }
      const airlockDistance = Math.hypot(player.position.x, player.position.z - 3.25);
      if (airlockDistance < 1.8 && (!nearest || airlockDistance < nearest.distance)) {
        nearest = { distance: airlockDistance, target: { id: "habitat-airlock", label: "HABITAT AIRLOCK", kind: "AIRLOCK" } };
      }
    } else {
      const exteriorAirlockDistance = Math.hypot(player.position.x, player.position.z - 4.45);
      if (exteriorAirlockDistance < 1.8) {
        nearest = { distance: exteriorAirlockDistance, target: { id: "habitat-airlock", label: "HABITAT AIRLOCK", kind: "AIRLOCK" } };
      }
      for (const track of tracks) {
        const position = POSITIONS[track.id];
        if (!position) continue;
        const distance = Math.hypot(player.position.x - position[0], player.position.z - position[1]);
        if (track.id === "habitat" && exteriorAirlockDistance < 1.8) continue;
        if (distance < 7.5 && (!nearest || distance < nearest.distance)) {
          nearest = { distance, target: { id: track.id, label: track.category, kind: "FACILITY" } };
        }
      }
      for (const node of resourceNodes) {
        const [x, z] = nodeWorldPosition(node);
        const distance = Math.hypot(player.position.x - x, player.position.z - z);
        if (distance < 7.5 && (!nearest || distance < nearest.distance)) {
          nearest = { distance, target: { id: node.id, label: node.label, kind: "FIELD SITE" } };
        }
      }
    }
    const nextNearbyId = nearest?.target.id ?? null;
    if (nearbyId.current !== nextNearbyId) {
      nearbyId.current = nextNearbyId;
      latest.current.onNearbyChange(nearest?.target ?? null);
    }
  });

  return <PerspectiveCamera makeDefault position={[0, terrainHeight(0, 12) + 1.72, 12]} fov={70} near={0.05} far={190} />;
}

function HelmetFlashlight({ enabled }: { enabled: boolean }) {
  const { camera, scene } = useThree();
  const targetRef = useRef<THREE.Object3D | null>(null);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const cameraPosition = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!enabled) return;

    const light = new THREE.SpotLight(0xffe6ad, 28, 30, Math.PI / 7, 0.55, 1.3);
    const target = new THREE.Object3D();
    camera.add(light);
    scene.add(target);
    light.target = target;
    targetRef.current = target;

    return () => {
      camera.remove(light);
      scene.remove(target);
      targetRef.current = null;
    };
  }, [camera, enabled, scene]);

  useFrame(() => {
    const target = targetRef.current;
    if (!enabled || !target) return;
    camera.updateMatrixWorld();
    camera.getWorldPosition(cameraPosition);
    camera.getWorldDirection(direction);
    target.position.copy(cameraPosition).addScaledVector(direction, 20);
    target.updateMatrixWorld();
  });

  return null;
}


// Stable scene subtrees: simulation values update several times per second, but most
// of the colony geometry does not. Memoisation prevents rebuilding those meshes.
const MemoTerrain = memo(Terrain);
const MemoRocks = memo(Rocks);
const MemoFoundation = memo(Foundation);
const MemoRoadNetwork = memo(RoadNetwork);
const MemoPad = memo(Pad);
const MemoBeacon = memo(Beacon);
const MemoBuildingArt = memo(BuildingArt);
const MemoRoverRockField = memo(RoverRockField);
const MemoSelectionRing = memo(SelectionRing);
const MemoCrew = memo(Crew);
const MemoLandingPad = memo(LandingPad);
const MemoMissionGuide = memo(MissionGuide);
const MemoBuildingSurfaceDetails = memo(BuildingSurfaceDetails);
const MemoTierHardware = memo(TierHardware);
const MemoBuildingStatusBeacon = memo(BuildingStatusBeacon);
const MemoIncidentEffects = memo(IncidentEffects);

function Scene({ props }: { props: Props }) {
  const [walkMode, setWalkMode] = useState(true);
  const firstPersonMode = walkMode || props.habitatInterior;
  const paused = props.simulationSpeed === 0;
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [pointerLockError, setPointerLockError] = useState<string | null>(null);
  const interactionClickHandled = useRef<InteractionClickState>({ current: false, requestPending: false });
  const [nearbyTarget, setNearbyTarget] = useState<NearbyInteraction>(null);
  const [cabinetOpen, setCabinetOpen] = useState(false);
  const [habitatActivity, setHabitatActivity] = useState<"BERTH" | "GALLEY" | null>(null);
  const crewSleeping = props.habitatInterior && habitatActivity === "BERTH";
  const [airlockStatus, setAirlockStatus] = useState<AirlockStatus>("IDLE");
  const airlockTimer = useRef<number | null>(null);
  const airlockCycling = ["SEALING", "PRESSURIZING", "HELMET_REMOVAL", "HELMET_SEAL", "DEPRESSURIZING", "SUIT_CHECK", "OPENING_HATCH"].includes(airlockStatus);
  useEffect(() => {
    if (props.habitatInterior) setWalkMode(true);
  }, [props.habitatInterior]);
  useEffect(() => () => {
    if (airlockTimer.current !== null) window.clearTimeout(airlockTimer.current);
  }, []);
  useEffect(() => {
    if (!crewSleeping) return;
    const wakeTimer = window.setTimeout(() => setHabitatActivity(null), 8000);
    return () => window.clearTimeout(wakeTimer);
  }, [crewSleeping]);
  const previousHabitatInterior = useRef(props.habitatInterior);
  useEffect(() => {
    if (props.habitatInterior && !previousHabitatInterior.current) {
      if (airlockTimer.current !== null) window.clearTimeout(airlockTimer.current);
      setCabinetOpen(false);
      setHabitatActivity(null);
      setAirlockStatus("SEALING");
      airlockTimer.current = window.setTimeout(() => {
        setAirlockStatus("PRESSURIZING");
        airlockTimer.current = window.setTimeout(() => {
          setAirlockStatus("HELMET_REMOVAL");
          airlockTimer.current = window.setTimeout(() => {
            setAirlockStatus("PRESSURIZED");
            airlockTimer.current = null;
          }, 900);
        }, 2200);
      }, 900);
    }
    previousHabitatInterior.current = props.habitatInterior;
  }, [props.habitatInterior]);
  const exitHabitat = () => {
    if (airlockCycling) return;
    if (airlockTimer.current !== null) window.clearTimeout(airlockTimer.current);
    setCabinetOpen(false);
    setHabitatActivity(null);
    setAirlockStatus("SEALING");
    airlockTimer.current = window.setTimeout(() => {
      setAirlockStatus("HELMET_SEAL");
      airlockTimer.current = window.setTimeout(() => {
        setAirlockStatus("DEPRESSURIZING");
        airlockTimer.current = window.setTimeout(() => {
          setAirlockStatus("SUIT_CHECK");
          airlockTimer.current = window.setTimeout(() => {
            setAirlockStatus("OPENING_HATCH");
            airlockTimer.current = window.setTimeout(() => {
              props.onExitHabitat();
              setAirlockStatus("DEPRESSURIZED");
              airlockTimer.current = window.setTimeout(() => {
                setAirlockStatus("IDLE");
                airlockTimer.current = null;
              }, 1500);
            }, 900);
          }, 1100);
        }, 2400);
      }, 900);
    }, 800);
  };
  const mars = props.environmentLabel === "MARS";
  const earthTextures = useMemo(() => createEarthTextures(), []);
  const colonyLightTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(0, 5, 0);
    return target;
  }, []);
  const roverTier = props.selected.rover ?? "Foundation";
  const roverRetrofitLevel = props.buildings.rover?.upgradeLevel ?? 0;
  const roverCondition = Math.max(0, Math.min(100, props.buildings.rover?.condition ?? 100));
  const roverRatedSpeedKmh = getBaselineRating("rover", roverTier, roverRetrofitLevel);
  const roverSpeedGap = props.buildings.rover?.repairMetrics?.["Unrestored fault gap · Safe traverse speed restored"] ?? 0;
  const roverTraverseSpeedKmh = Math.max(0, roverRatedSpeedKmh - roverSpeedGap) * roverCondition / 100;
  const navTier = props.selected.navigation ?? "Foundation";
  const navRetrofitLevel = props.buildings.navigation?.upgradeLevel ?? 0;
  const navCondition = Math.max(25, Math.min(100, props.buildings.navigation?.condition ?? 100));
  const navRatedErrorM = getBaselineRating("navigation", navTier, navRetrofitLevel);
  const navErrorGapM = props.buildings.navigation?.repairMetrics?.["Unrestored fault gap · Horizontal position error reduced"] ?? 0;
  const navigationErrorM = (navRatedErrorM + navErrorGapM) * (100 / navCondition);
  const navigationAccuracy = Math.max(0, Math.min(100, 100 - navigationErrorM)) / 100;
  const lunarDay = Math.max(0, Math.min(14, props.elapsed / 86400));
  const sunAngleDeg = props.lunarNight ? -8 : interpolateSolarProfile(lunarDay).sunAltitudeDeg;
  // Place celestial bodies in the visible, far background of the colony camera. The
  // old ±36-unit orbit pushed them outside the orthographic camera framing, so the
  // simulation was technically drawing them but players could not see them.
  const sunProgress = lunarDay / 14;
  const sunAltitudeRad = (sunAngleDeg * Math.PI) / 180;
  // Celestial bodies live on a distant sky plane, not hovering just behind the habitat.
  // The orthographic scene uses a deliberately cinematic apparent size: Earth is visibly
  // larger than the Sun, while both remain clearly separated from the terrain silhouette.
  const skyDistance = -82;
  const sunPosition: [number, number, number] = [
    -35 + sunProgress * 70,
    props.lunarNight ? -25 : -2 + Math.sin(sunAltitudeRad) * 28,
    skyDistance,
  ];
  const daylight = props.lunarNight ? 0 : interpolateSolarProfile(lunarDay).sunlightGeometry;
  const supplyStations = [
    { trackId: "oxygen", action: "fallback-oxygen", label: "O₂ reserve", value: props.physicalReadings.oxygen, detail: "Release a finite emergency bottle reserve." },
    { trackId: "water", action: "fallback-water", label: "Potable water", value: props.physicalReadings.water, detail: "Recover stored condensate through the manual line." },
    { trackId: "agriculture", action: "fallback-agriculture", label: "Food stores", value: props.physicalReadings.food, detail: "Collect already-mature emergency biomass." },
  ];
  return (
    <div className="relative h-full w-full overflow-hidden">
    <Canvas
      frameloop={paused ? "never" : "always"}
      orthographic
      dpr={0.85}
      camera={{ position: [48, 56, 48], zoom: 20.5, near: 0.5, far: 190 }}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08, depth: true, stencil: false }}
      onCreated={({ gl }) => {
        gl.setPixelRatio(0.85);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        // Dynamic shadow maps were the largest avoidable GPU cost in the colony scene.
        gl.shadowMap.enabled = false;
      }}
    >
      {firstPersonMode && props.habitatInterior ? (
        <>
          <color attach="background" args={["#172326"]} />
          <ambientLight intensity={0.72} color="#dce8df" />
          <hemisphereLight args={["#e5eee5", "#252c30", 0.72]} />
          <HabitatInterior cabinetOpen={cabinetOpen} airlockStatus={airlockStatus} />
        </>
      ) : (
        <>
      <color attach="background" args={[mars ? "#7b4638" : props.lunarNight ? "#02050b" : daylight < 0.08 ? "#111824" : daylight < 0.5 ? "#303d4c" : "#596d80"]} />
      <ambientLight intensity={mars ? 0.68 : props.lunarNight ? 0.035 : 0.13 + daylight * 0.22} color={mars ? "#ffe6db" : "#dce8f5"} />
      <hemisphereLight args={[mars ? "#ffe5da" : "#dce8f5", mars ? "#3d2722" : "#080d16", mars ? 1.0 : props.lunarNight ? 0.06 : 0.20 + daylight * 0.38]} />
      <directionalLight position={mars ? [18, 34, 20] : [0, 60, 0]} target={colonyLightTarget} intensity={mars ? 1.7 : props.lunarNight ? 0.015 : daylight * 2.2} />
      <primitive object={colonyLightTarget} />
      {!mars && <group position={sunPosition} frustumCulled={false}>
        <mesh><sphereGeometry args={[1.02, 64, 48]} /><meshBasicMaterial color={props.lunarNight ? "#d8d8cf" : "#fff9df"} toneMapped={false} /></mesh>
        <mesh><sphereGeometry args={[1.42, 64, 48]} /><meshBasicMaterial color="#fff0bd" transparent opacity={props.lunarNight ? 0.025 : 0.24} depthWrite={false} toneMapped={false} /></mesh>
        {!props.lunarNight && <mesh><sphereGeometry args={[2.05, 48, 32]} /><meshBasicMaterial color="#ffdda0" transparent opacity={0.10} depthWrite={false} toneMapped={false} /></mesh>}
        {!props.lunarNight && <mesh><sphereGeometry args={[3.2, 48, 32]} /><meshBasicMaterial color="#ffc96e" transparent opacity={0.035} depthWrite={false} toneMapped={false} /></mesh>}
        {!props.lunarNight && <pointLight color="#fff0cf" intensity={2.4} distance={95} decay={1.6} />}
      </group>}
      {!mars && <group position={[-22, 20, -79]} rotation={[0.08, -0.35, 0.02]} frustumCulled={false}>
        {/* Earth is a distant, recognisable blue-white disc, with an apparent diameter
            around three times the Sun in this cinematic camera framing. */}
        <mesh><sphereGeometry args={[2.55, 64, 48]} /><meshStandardMaterial map={earthTextures.surface} roughness={0.9} metalness={0} emissive="#0b1d2a" emissiveIntensity={0.18} /></mesh>
        <mesh scale={1.018}><sphereGeometry args={[2.55, 48, 32]} /><meshStandardMaterial map={earthTextures.clouds} transparent opacity={0.72} roughness={1} depthWrite={false} /></mesh>
        <mesh scale={1.045}><sphereGeometry args={[2.55, 48, 32]} /><meshBasicMaterial color="#5b9bd0" transparent opacity={0.18} side={THREE.BackSide} toneMapped={false} /></mesh>
      </group>}
      <MemoTerrain kind={mars ? "mars" : "moon"} />
      <MemoRocks kind={mars ? "mars" : "moon"} />
      <group scale={COLONY_WORLD_SCALE}>
      <MemoRoverRockField mars={mars} />
      <MemoFoundation mars={mars} />
      <group frustumCulled={false}>
        <MemoMissionGuide mars={mars} />
        <MemoRoadNetwork mars={mars} />
        <MemoLandingPad mars={mars} />
        {props.tracks.map((track) => track.id !== "rover" && (
          <ColonyBuilding
            key={track.id}
            track={track}
            tier={props.selected[track.id] ?? "Foundation"}
            runtime={props.buildings[track.id] ?? { condition: 100, dust: 0, status: "ONLINE" }}
            selected={props.selectedBuildingId === track.id}
            alerted={props.activeEventTrackId === track.id}
            eventId={props.activeEventId}
            position={POSITIONS[track.id] ?? [0, 0]}
            onClick={() => props.onSelect(track.id)}
            onInteraction={() => {
              if (!firstPersonMode) return;
              interactionClickHandled.current.current = true;
              if (document.pointerLockElement) document.exitPointerLock();
              window.setTimeout(() => {
                if (!interactionClickHandled.current.requestPending) interactionClickHandled.current.current = false;
              }, 0);
            }}
            mars={mars}
            nightMode={!mars && (props.lunarNight || daylight < 0.18)}
          />
        ))}
        {props.tracks.some((track) => track.id === "rover") && (
          <>
            <Pad position={POSITIONS.rover} size={3.8} mars={mars} accent="#52e9f2" baseY={0.04} />
            <Rover task={props.roverTask} position={POSITIONS.rover} resourceNodes={props.resourceNodes} targetNodeId={props.roverTargetNodeId} selected={props.selectedBuildingId === "rover"} alerted={props.activeEventTrackId === "rover"} traverseSpeedKmh={roverTraverseSpeedKmh} navigationAccuracy={navigationAccuracy} simulationSpeed={props.simulationSpeed} onClick={() => props.onSelect("rover")} />
          </>
        )}
        <MemoCrew mars={mars} />
        {props.resourceNodes.map((node) => <ResourceMarker key={node.id} node={node} surveyed={props.surveyedNodes.includes(node.id)} selected={props.selectedResourceId === node.id} onClick={() => props.onSelectResource(node)} />)}
      </group>
      </group>
        </>
      )}
      {firstPersonMode ? (
        <group scale={props.habitatInterior ? 1 : COLONY_WORLD_SCALE}>
        <WalkControls
          tracks={props.tracks}
          resourceNodes={props.resourceNodes}
          paused={paused}
          habitatInterior={props.habitatInterior}
          cabinetOpen={cabinetOpen}
          airlockCycling={airlockCycling}
          crewSleeping={crewSleeping}
          onSelect={props.onSelect}
          onCloseInspector={props.onCloseInspector}
          onSelectResource={props.onSelectResource}
          onEnterHabitat={props.onEnterHabitat}
          onActivateHabitatSpot={(spot) => {
            setHabitatActivity(spot);
            if (document.pointerLockElement) document.exitPointerLock();
          }}
          onWake={() => setHabitatActivity(null)}
          onExitHabitat={exitHabitat}
          onToggleCabinet={() => {
            if (!cabinetOpen && document.pointerLockElement) document.exitPointerLock();
            setCabinetOpen((open) => !open);
          }}
          onToggleFlashlight={() => setFlashlightOn((active) => !active)}
          onLockChange={(locked) => {
            setPointerLocked(locked);
            if (locked) setPointerLockError(null);
          }}
          onLockError={setPointerLockError}
          onNearbyChange={setNearbyTarget}
          interactionClickHandled={interactionClickHandled.current}
          selectedBuildingId={props.selectedBuildingId}
          selectedResourceId={props.selectedResourceId}
        />
        </group>
      ) : (
        <OrbitControls
          enableRotate
          enablePan
          enableZoom
          enableDamping
          dampingFactor={0.075}
          screenSpacePanning
          rotateSpeed={0.55}
          panSpeed={1.0}
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI / 2.02}
          minZoom={10}
          maxZoom={48}
          zoomSpeed={0.85}
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
          target={[0, 0, 0]}
        />
      )}
      {firstPersonMode && <HelmetFlashlight enabled={flashlightOn} />}
    </Canvas>
    {firstPersonMode && (
      <>
        <MissionVitalsHUD metrics={props.metrics} physicalReadings={props.physicalReadings} colonyHealth={props.colonyHealth} alerted={Boolean(props.activeEventTrackId)} />
        {nearbyTarget && (
          <div role="status" className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 translate-y-6 border border-[#d6c17a]/55 bg-[#07151b]/90 px-3 py-1.5 font-mono text-[9px] font-black uppercase tracking-[0.12em] text-[#f3dda0] shadow-lg backdrop-blur-sm">
            E · {nearbyTarget.kind === "CABINET" ? (cabinetOpen ? "close" : "open") : nearbyTarget.kind === "AIRLOCK" ? "cycle airlock" : nearbyTarget.kind === "BERTH" ? "sleep" : nearbyTarget.kind === "GALLEY" ? "use galley" : "inspect / close"} · {nearbyTarget.label}
          </div>
        )}
        {props.habitatInterior && crewSleeping && (
          <section aria-label="Crew sleep cycle" className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-[#02060b]/75 p-5 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-[#77b7bf]/45 bg-[#07151c]/95 p-6 text-center font-mono shadow-[0_0_70px_rgba(75,158,188,.18)]">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#7ed8dd]">Crew berth · sleep cycle</p>
              <h2 className="mt-3 text-xl font-black uppercase tracking-[0.1em] text-[#e7f2e7]">Resting in orbit</h2>
              <p className="mt-2 text-[10px] leading-5 text-[#9cb5b6]">The habitat is quiet. Earth and the stars drift past the observation window while the crew sleeps.</p>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#1d3037]">
                <div className="h-full origin-left rounded-full bg-gradient-to-r from-[#5dc9cf] to-[#e6c982]" style={{ animation: "crew-sleep-progress 8s linear forwards" }} />
              </div>
              <button type="button" onClick={() => setHabitatActivity(null)} className="mt-5 w-full rounded-lg border border-[#6cb7aa]/50 bg-[#12332c] px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-[#c5f0d7] transition hover:border-[#d3c27b] hover:bg-[#1d4437]">
                Wake up · E
              </button>
              <style>{`@keyframes crew-sleep-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
            </div>
          </section>
        )}
        {props.habitatInterior && habitatActivity === "GALLEY" && (
          <section aria-label="Habitat galley" className="pointer-events-auto absolute bottom-4 left-1/2 z-40 w-[min(94vw,420px)] -translate-x-1/2 rounded-2xl border border-[#73988c]/55 bg-[#081719]/[0.97] p-4 font-mono text-white shadow-[0_20px_60px_rgba(0,0,0,0.65)] backdrop-blur-md">
            <header className="mb-3 flex items-start justify-between gap-3 border-b border-[#37514b] pb-3">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#8ed0b3]">Habitat · common room</p>
                <h2 className="mt-1 text-sm font-black uppercase tracking-[0.1em]">Galley & crew station</h2>
              </div>
              <button type="button" onClick={() => setHabitatActivity(null)} aria-label="Close galley" className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 bg-black/20 text-lg text-[#c5d2cd] hover:border-[#f0cf69]">×</button>
            </header>
            <p className="text-[9px] leading-4 text-[#9eb2a9]">Check the shared stores before preparing a meal. Supplies remain tied to the mission inventory.</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: "Food", value: props.physicalReadings.food },
                { label: "Water", value: props.physicalReadings.water },
                { label: "Cabin", value: props.physicalReadings.temperature },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-[#34524b] bg-[#10231f] px-2 py-2">
                  <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#8ca9a0]">{item.label}</p>
                  <p className="mt-1 text-[10px] font-black text-[#c8efd7]">{item.value}</p>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => { setHabitatActivity(null); setCabinetOpen(true); }} className="mt-3 w-full rounded-lg border border-[#729184]/60 bg-[#16352c] px-3 py-2.5 text-left text-[9px] font-black uppercase tracking-[0.12em] text-[#c5f0d7] transition hover:border-[#d3c27b]">
              Open crew supplies
            </button>
            <p className="mt-2 text-[8px] text-[#829a90]">E or × returns to the room.</p>
          </section>
        )}
        {props.habitatInterior && airlockStatus !== "IDLE" && (
          <div role="status" className="pointer-events-none absolute left-1/2 top-5 z-40 -translate-x-1/2 border border-[#8cb5a1]/50 bg-[#081719]/95 px-4 py-2 text-center font-mono text-[9px] font-black uppercase tracking-[0.14em] text-[#bcebd2] shadow-lg">
            {airlockCycling ? <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[#f2ce75]" /> : null}
            Airlock · {airlockStatus.replaceAll("_", " ").toLowerCase()}
            <div className="mt-1 text-[8px] font-normal tracking-normal text-[#9fb8ae]">
              {airlockStatus === "SEALING" && "Inner hatch sealed · suit and pressure seals checking."}
              {airlockStatus === "PRESSURIZING" && "Clean habitat air entering the chamber · helmet may be removed when green."}
              {airlockStatus === "HELMET_REMOVAL" && "Pressure equalized · releasing helmet seals inside the habitat."}
              {airlockStatus === "HELMET_SEAL" && "Helmet donned · locking the neck ring and checking suit pressure."}
              {airlockStatus === "PRESSURIZED" && "Pressure equalized · inner hatch unlocked · helmet off inside."}
              {airlockStatus === "DEPRESSURIZING" && "Air is drawn from the chamber into the habitat recovery system."}
              {airlockStatus === "SUIT_CHECK" && "Outer hatch locked · helmet seal and life support verified."}
              {airlockStatus === "OPENING_HATCH" && "Pressure safe · outer hatch opening for EVA."}
              {airlockStatus === "DEPRESSURIZED" && "Outer hatch open · suit sealed · EVA clearance granted."}
            </div>
          </div>
        )}
        {props.habitatInterior && (airlockStatus === "HELMET_REMOVAL" || airlockStatus === "HELMET_SEAL") && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden">
            <style>{`
              @keyframes habitat-visor-lift {
                from { transform: translateY(0); opacity: .9; }
                to { transform: translateY(-110%); opacity: 0; }
              }
              @keyframes habitat-visor-seat {
                from { transform: translateY(-110%); opacity: 0; }
                to { transform: translateY(0); opacity: .9; }
              }
            `}</style>
            <div
              className="absolute inset-3 rounded-[22%] border-[5px] border-[#9fc4c8]/70 shadow-[inset_0_0_80px_rgba(114,201,220,.18),0_0_28px_rgba(123,216,224,.24)]"
              style={{
                background: "radial-gradient(ellipse at 50% 44%, rgba(16,44,55,.24), rgba(3,12,17,.82))",
                animation: airlockStatus === "HELMET_REMOVAL" ? "habitat-visor-lift 900ms ease-in forwards" : "habitat-visor-seat 900ms ease-out forwards",
              }}
            />
            <div className="relative rounded border border-[#8cb5a1]/60 bg-[#081719]/90 px-5 py-3 text-center font-mono text-[9px] font-black uppercase tracking-[0.16em] text-[#c5f0d7] shadow-xl backdrop-blur">
              <span className="block text-[#7ce2d2]">Suit automation</span>
              {airlockStatus === "HELMET_REMOVAL" ? "Helmet seals released" : "Helmet sealed · suit checked"}
            </div>
          </div>
        )}
        {props.habitatInterior && cabinetOpen && (
          <section aria-label="Crew supply cabinet" className="pointer-events-auto absolute bottom-4 right-4 z-40 w-[min(94vw,360px)] border border-[#729184]/60 bg-[#081518]/[0.97] p-4 font-mono text-white shadow-[0_20px_60px_rgba(0,0,0,0.65)] backdrop-blur-md">
            <header className="mb-3 flex items-start justify-between gap-3 border-b border-[#37514b] pb-3">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#8ed0b3]">Habitat · crew stores</p>
                <h2 className="mt-1 text-sm font-black uppercase tracking-[0.1em]">Emergency supply cabinet</h2>
              </div>
              <button type="button" onClick={() => setCabinetOpen(false)} aria-label="Close supply cabinet" className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 bg-black/20 text-lg text-[#c5d2cd] hover:border-[#f0cf69]">×</button>
            </header>
            <div className="grid gap-2">
              {supplyStations.map((station) => (
                <button
                  key={station.trackId}
                  type="button"
                  onClick={() => props.onSupplyAction(station.trackId, station.action)}
                  className="rounded-lg border border-[#34524b] bg-[#10231f] p-2.5 text-left transition hover:border-[#c5b268] hover:bg-[#172d26]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em]">{station.label}</span>
                    <span className="text-[9px] font-bold text-[#a9e5be]">{station.value}</span>
                  </span>
                  <span className="mt-1 block text-[8px] leading-4 text-[#9eb2a9]">{station.detail}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[8px] leading-4 text-[#829a90]">These are finite emergency recovery procedures, not free resource generation. Mission reserve levels, system installation, cooldowns, and active faults still apply.</p>
            <p className="mt-2 text-[8px] font-bold uppercase tracking-[0.12em] text-[#d3c27b]">Select a procedure · E closes the cabinet</p>
          </section>
        )}
      </>
    )}
    <div className="pointer-events-auto absolute left-3 top-1/2 z-30 flex w-[min(94vw,230px)] -translate-y-1/2 flex-col items-start gap-2">
      {walkMode && !props.habitatInterior && props.tracks.some((track) => track.id === "habitat") && (
        <button
          type="button"
          onClick={props.onEnterHabitat}
          className="w-full border border-[#78c9a1]/60 bg-[#10251f]/95 px-3 py-2 text-left font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#c5f0d7] shadow-lg backdrop-blur-sm transition hover:border-[#d3c27b] hover:bg-[#1d4437]"
        >
          Enter habitat
        </button>
      )}
      <button
        type="button"
        disabled={props.habitatInterior}
        onClick={() => {
          setPointerLocked(false);
          setWalkMode((active) => !active);
        }}
        className="w-full border border-[#e7c56e]/50 bg-[#10191d]/90 px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#f4d785] shadow-lg backdrop-blur-sm transition hover:border-[#ffe7a0] hover:bg-[#24343a] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {props.habitatInterior ? "Habitat interior" : walkMode ? "Colony map" : "Enter first person"}
      </button>
      {firstPersonMode && (
        <div className="w-full border border-white/15 bg-[#07131c]/90 px-3 py-2 text-left font-mono text-[9px] leading-4 text-[#d3dfdc] shadow-lg backdrop-blur-sm">
          WASD move · Space jump · mouse look · Shift run
          <br />
          F flashlight {flashlightOn ? "ON" : "OFF"} · E interact / airlock · Esc pause
          {!pointerLocked && <><br /><span className="text-[#f4d785]">Click the scene to look around</span></>}
          {pointerLockError && <><br /><span className="text-[#ffadb0]">{pointerLockError}</span></>}
        </div>
      )}
    </div>
    {firstPersonMode && pointerLocked && (
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-white/80" />
        <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white/80" />
      </div>
    )}
    {!props.habitatInterior && (
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex max-w-[min(94vw,520px)] flex-wrap items-start gap-2">
        {!mars && (
          <div className="rounded-lg border border-white/20 bg-[#07131c]/80 px-3 py-2 text-[9px] font-mono text-white shadow-lg backdrop-blur-sm">
            <div className="mb-1 font-black tracking-[0.16em] text-[#f3d16f]">LUNAR SKY</div>
            {props.lunarNight ? <div className="text-[#9dbbd2]">SUN BELOW HORIZON · 0°</div> : <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full bg-[#ffe17b] shadow-[0_0_12px_4px_rgba(255,211,91,.65)]" /><span>SUN ALTITUDE · {sunAngleDeg.toFixed(1)}°</span></div>}
            <div className="mt-1 text-[8px] text-[#b6c9d4]">Earth remains visible · daylight and shadows follow the Sun</div>
          </div>
        )}
        <div className="rounded-lg border border-white/15 bg-[#07131c]/70 px-3 py-2 font-mono text-[8px] text-[#b6c9d4] shadow-lg backdrop-blur-sm">
          <div className="mb-1 font-black tracking-[0.16em] text-[#9bd9cf]">COLONY LINK</div>
          {firstPersonMode ? `EVA MODE · Arrow keys / WASD move · mouse look · Space jump · F flashlight ${flashlightOn ? "ON" : "OFF"} · E interact` : "MAP MODE · drag to rotate · right-drag to pan · wheel to zoom"}
        </div>
      </div>
    )}
    </div>
  );
}

export function Colony3DMap(props: Props) {
  return <Scene props={props}/>;
}
