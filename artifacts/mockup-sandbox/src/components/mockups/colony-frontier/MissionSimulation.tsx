import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BatteryCharging,
  Car,
  Check,
  CircleDot,
  Cloud,
  Compass,
  Droplets,
  Factory,
  FlaskConical,
  Gauge,
  Home,
  Pause,
  Pickaxe,
  Play,
  Radio,
  Shield,
  Sparkles,
  Sprout,
  Sun,
  Thermometer,
  Wind,
  Wrench,
  Zap,
} from "lucide-react";
import {
  technologyTracks,
  tierMeta,
  type TechnologyTrack,
  type Tier,
} from "./_shared/gameData";
import { loadGameState, saveGameState } from "./gameState";
import {
  clearMissionRuntime,
  clearPendingMission,
  loadMissionRuntime,
  loadPendingMission,
  saveMissionRuntime,
  type BuildingRuntime,
  type MissionDecision,
  type MissionMetrics,
  type PendingMission,
} from "./missionRuntime";
import { Colony3DMap } from "./Colony3DMap";

const TOTAL_MISSION_SECONDS = 14 * 30;
const EVENT_TIMES = [60, 120, 195, 255, 315, 375];

const starterCategories = new Set([
  "solar",
  "battery",
  "oxygen",
  "water",
  "habitat",
  "comms",
  "navigation",
  "radiation",
]);

const categoryIcons = {
  Solar: Sun,
  Battery: BatteryCharging,
  Oxygen: Wind,
  Water: Droplets,
  "CO₂": Cloud,
  Thermal: Thermometer,
  Comms: Radio,
  Habitat: Home,
  Radiation: Shield,
  "Power Grid": Zap,
  Science: FlaskConical,
  Navigation: Compass,
  Rover: Car,
  Extraction: Pickaxe,
  ISRU: Factory,
  Agriculture: Sprout,
  Maintenance: Wrench,
} as const;

type MissionEvent = {
  id: string;
  trackId: string;
  environment?: "MOON" | "MARS" | "BOTH";
  title: string;
  subtitle: string;
  summary: string;
};

type EventChoice = {
  id: string;
  label: string;
  detail: string;
};

type ResourceNode = {
  id: string;
  label: string;
  kind: "ICE" | "MINERAL" | "SCIENCE" | "REGOLITH";
  x: number;
  y: number;
  description: string;
};

const EVENT_DEFS: MissionEvent[] = [
  { id: "solar-dust", trackId: "solar", title: "Dust deposition on solar array", subtitle: "Surface dust is reducing usable solar input.", summary: "On the Moon, electrostatically active regolith can adhere to exposed hardware; on Mars, airborne dust can reduce solar input. Array output is falling." },
  { id: "battery-thermal", trackId: "battery", title: "Battery thermal-control excursion", subtitle: "One storage module is outside its preferred thermal operating range.", summary: "Battery efficiency is dropping. The colony can rebalance its loads, isolate the affected storage path, or continue at the cost of stored energy." },
  { id: "oxygen-filter", trackId: "oxygen", title: "Cabin air revitalization filter loading", subtitle: "A filtration stage in the cabin air-revitalization loop is showing increasing pressure drop.", summary: "Airflow resistance is reducing processing margin. The crew can isolate the affected stage, change operating mode, or accept reduced margin." },
  { id: "water-filter", trackId: "water", title: "Water recovery loop pressure rise", subtitle: "Pressure across the water-recovery hardware is rising above the normal operating band.", summary: "The recovery loop is showing elevated differential pressure. Cleaning or bypassing the affected stage protects recovery capacity." },
  { id: "habitat-pressure", trackId: "habitat", title: "Pressure decay detected", subtitle: "Pressure sensors have detected a small change in the cabin leak rate.", summary: "The habitat remains pressurised, but a growing leak would reduce life-support margin and force an EVA-independent repair response." },
  { id: "radiation-burst", trackId: "radiation", title: "Solar particle event", subtitle: "Radiation levels are rising across the exposed surface.", summary: "A short radiation spike is crossing the colony. Protective shelter mode is available, but it limits some active operations." },
  { id: "micrometeoroid-impact", trackId: "habitat", environment: "MOON", title: "Micrometeoroid impact nearby", subtitle: "A small impact has damaged exposed hardware near the habitat.", summary: "A micrometeoroid strike has created a localized equipment fault. The pressure shell is still stable, but exposed systems need inspection before normal operations continue." },
  { id: "polar-shadow-cold-soak", trackId: "thermal", environment: "MOON", title: "Polar shadow cold-soak", subtitle: "A surface asset is entering a much colder illuminated-to-shadow transition.", summary: "Equipment near a permanently shadowed region is losing thermal margin. Heaters and power routing must be managed before components fall below their qualified operating range." },
  { id: "regional-dust-front", trackId: "solar", environment: "MARS", title: "Regional dust front", subtitle: "An advancing dust front is reducing sunlight reaching the surface arrays.", summary: "A regional Martian dust event is lowering solar irradiance and increasing dust loading on exposed hardware. The colony must protect energy reserves while the front passes." },
  { id: "mars-comm-relay-loss", trackId: "comms", environment: "MARS", title: "Surface relay link degraded", subtitle: "The primary relay path has lost signal margin.", summary: "A combination of pointing error and atmospheric dust has reduced the available communications link. Autonomous operations can bridge the gap while the relay recovers." },
  { id: "thermal-drift", trackId: "thermal", title: "Radiator thermal-control drift", subtitle: "The habitat temperature is moving outside the preferred band.", summary: "Heat rejection is drifting away from its expected operating point. The colony needs to decide whether to rebalance heat or conserve stored energy." },
  { id: "comms-drift", trackId: "comms", title: "High-gain antenna pointing drift", subtitle: "The surface high-gain antenna has lost part of its pointing margin.", summary: "The link remains usable, but falling signal margin can interrupt high-rate science and command traffic." },
  { id: "grid-overload", trackId: "grid", title: "Power distribution bus trip risk", subtitle: "A power distribution bus is approaching its protection threshold.", summary: "A simultaneous high load could trip a protective breaker and disconnect downstream systems." },
  { id: "rover-wheel", trackId: "rover", title: "Rover wheel traction loss", subtitle: "The rover is reporting wheel slip and reduced traction on loose regolith.", summary: "The rover has lost traction on loose surface material. Repeated wheel spin could increase wear and bury the vehicle deeper." },
  { id: "extraction-lock", trackId: "extraction", title: "Regolith excavation torque increase", subtitle: "The excavation system is seeing higher-than-expected torque in the regolith.", summary: "The tool can be slowed to reduce mechanical load, or the run can be aborted before the actuator exceeds its limit." },
  { id: "isru-pressure", trackId: "isru", title: "ISRU feed-system pressure rise", subtitle: "A local-resource processing line is showing rising pressure and feed resistance.", summary: "Reducing throughput can bring the process back inside its operating envelope before it stresses pumps, heaters, or the power system." },
  { id: "agriculture-stress", trackId: "agriculture", title: "Controlled-environment crop stress", subtitle: "A controlled growing module is drifting outside its preferred temperature, CO₂, or nutrient range.", summary: "The crop system can be stabilised by restoring environmental controls, or the colony can conserve power and accept reduced production." },
  { id: "science-anomaly", trackId: "science", title: "Science instrument calibration drift", subtitle: "A science instrument is showing calibration drift relative to its reference measurement.", summary: "The measurement may still be scientifically useful, but the instrument should be checked against a reference before committing to a high-value observation." },
  { id: "maintenance-alert", trackId: "maintenance", title: "Predictive wear indication", subtitle: "A sensor trend indicates developing mechanical or electrical wear.", summary: "Early maintenance is available before the trend becomes a hard failure." },
  { id: "core-power", trackId: "power", title: "Power margin reduced", subtitle: "Current load is leaving less generation margin than planned.", summary: "The colony can shed non-critical loads, rebalance distribution, or draw down storage while the margin is low." },
];

function isTier(value: unknown): value is Tier {
  return value === "Foundation" || value === "Frontier" || value === "Apex" || value === "Research";
}

function tierLevel(tier: Tier): number {
  if (!isTier(tier)) return 0;
  return tier === "Foundation" ? 0 : tier === "Frontier" ? 1 : tier === "Apex" ? 2 : 3;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function buildingStatus(condition: number): string {
  if (condition < 28) return "CRITICAL";
  if (condition < 55) return "DAMAGED";
  if (condition < 82) return "DEGRADED";
  return "ONLINE";
}

function formatMissionTime(seconds: number): string {
  const day = Math.min(14, Math.floor(seconds / 30) + 1);
  const dayProgress = Math.floor(seconds % 30);
  const hour = Math.floor((dayProgress / 30) * 24);
  const minute = Math.floor((((dayProgress / 30) * 24) % 1) * 60);
  return `DAY ${day.toString().padStart(2, "0")} · ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function initialMetrics(selected: Record<string, Tier>): MissionMetrics {
  const solar = tierLevel(selected.solar ?? "Foundation");
  const battery = tierLevel(selected.battery ?? "Foundation");
  const oxygen = tierLevel(selected.oxygen ?? "Foundation");
  const water = tierLevel(selected.water ?? "Foundation");
  const habitat = tierLevel(selected.habitat ?? "Foundation");
  const radiation = tierLevel(selected.radiation ?? "Foundation");
  const thermal = tierLevel(selected.thermal ?? "Foundation");
  const optionalCount = Object.keys(selected).filter((id) => !starterCategories.has(id)).length;

  return {
    power: clamp(78 + solar * 6 + Math.max(0, radiation - 1) * 2 - optionalCount * 2),
    battery: clamp(74 + battery * 6 - optionalCount * 3),
    oxygen: clamp(93 + oxygen * 2),
    water: clamp(91 + water * 2),
    food: clamp(84 + (selected.agriculture ? tierLevel(selected.agriculture) * 4 : 0)),
    temperature: clamp(21 + thermal * 0.15, 16, 28),
    radiation: clamp(10 - radiation * 1.5),
    habitat: clamp(94 + habitat * 2),
  };
}

function initialBuildings(selected: Record<string, Tier>): Record<string, BuildingRuntime> {
  return Object.fromEntries(
    Object.keys(selected).map((trackId) => [
      trackId,
      { condition: 100, dust: 0, status: "ONLINE", upgradeLevel: 0 },
    ]),
  );
}

function selectedTrackData(selected: Record<string, Tier>): TechnologyTrack[] {
  return technologyTracks.filter((track) => isTier(selected[track.id]));
}

function pickNextEvent(
  environmentLabel: "MOON" | "MARS",
  selected: Record<string, Tier>,
  resolvedEventIds: string[],
  scheduleIndex: number,
  metrics: MissionMetrics,
): MissionEvent {
  const selectedOptional = Object.keys(selected).filter((trackId) => !starterCategories.has(trackId));

  if (scheduleIndex === 0) {
    return EVENT_DEFS.find((event) => event.id === "solar-dust")!;
  }

  const environmentEventId =
    scheduleIndex === 1
      ? environmentLabel === "MOON"
        ? "micrometeoroid-impact"
        : "regional-dust-front"
      : scheduleIndex === 3
        ? environmentLabel === "MOON"
          ? "polar-shadow-cold-soak"
          : "mars-comm-relay-loss"
        : null;

  if (environmentEventId && !resolvedEventIds.includes(environmentEventId)) {
    const environmentEvent = EVENT_DEFS.find((event) => event.id === environmentEventId);
    if (environmentEvent) return environmentEvent;
  }

  const unusedOptional = selectedOptional
    .map((trackId) => EVENT_DEFS.find((event) => event.trackId === trackId))
    .filter((event): event is MissionEvent => Boolean(event))
    .filter((event) => !resolvedEventIds.includes(event.id));

  if (scheduleIndex % 2 === 1 && unusedOptional.length > 0) {
    const index = Math.floor((scheduleIndex - 1) / 2) % unusedOptional.length;
    return unusedOptional[index] ?? unusedOptional[0];
  }

  const weakest = [
    { value: metrics.battery, event: "battery-thermal" },
    { value: metrics.oxygen, event: "oxygen-filter" },
    { value: metrics.water, event: "water-filter" },
    { value: metrics.habitat, event: "habitat-pressure" },
    {
      value: metrics.power,
      event: selected.grid ? "grid-overload" : "core-power",
    },
    {
      value: Math.max(0, 100 - Math.abs(metrics.temperature - 21) * 8),
      event: selected.thermal ? "thermal-drift" : "habitat-pressure",
    },
  ].sort((a, b) => a.value - b.value)[0];

  return (
    EVENT_DEFS.find((event) => event.id === weakest.event) ??
    EVENT_DEFS.find((event) => event.id === "core-power")!
  );
}

function getEventChoices(event: MissionEvent, selected: Record<string, Tier>): EventChoice[] {
  const hasRover = selected.rover !== undefined;
  const hasNavigation = selected.navigation !== undefined;

  const choices: Record<string, EventChoice[]> = {
    "solar-dust": [
      { id: "clean", label: hasRover ? "Dispatch rover to clean array" : "Clean the array", detail: hasRover ? "Use the deployed rover for a safer, faster cleaning pass." : "Use the colony direct cleaning procedure. It costs a little time and power." },
      { id: "shed", label: "Reduce non-critical systems", detail: "Protect the battery by cutting optional colony loads for a short period." },
      { id: "battery", label: "Increase battery discharge", detail: "Maintain normal operations by drawing harder from stored energy." },
    ],
    "battery-thermal": [
      { id: "isolate", label: "Isolate affected storage path", detail: "Sacrifice a little available storage to protect the remaining bank." },
      { id: "rebalance", label: "Rebalance colony loads", detail: "Reduce electrical stress without interrupting essential life support." },
      { id: "continue", label: "Continue normally", detail: "Keep everything online and accept a larger battery penalty." },
    ],
    "oxygen-filter": [
      { id: "reset", label: "Reset oxygen processing loop", detail: "Spend a brief power spike to restore atmospheric processing." },
      { id: "reduce", label: "Reduce non-essential habitation load", detail: "Give the oxygen loop extra margin while keeping the colony online." },
      { id: "ignore", label: "Continue normally", detail: "Accept faster oxygen depletion and let the system recover slowly." },
    ],
    "water-filter": [
      { id: "flush", label: "Flush filtration system", detail: "Use extra power to restore the water recovery loop." },
      { id: "ration", label: "Enter water conservation mode", detail: "Protect the reserve while keeping normal operations mostly intact." },
      { id: "ignore", label: "Continue normally", detail: "Let the blockage reduce recovery efficiency." },
    ],
    "habitat-pressure": [
      { id: "seal", label: "Seal and inspect", detail: "Use maintenance procedures to stabilise the affected structural area." },
      { id: "monitor", label: "Monitor the seal", detail: "Keep the habitat operating while watching the pressure sensors." },
      { id: "ignore", label: "Continue normally", detail: "Accept a chance of worsening structural degradation." },
    ],
    "radiation-burst": [
      { id: "shelter", label: "Switch colony to shelter mode", detail: "Reduce exposed activity until the radiation spike passes." },
      { id: "maintain", label: "Maintain surface operations", detail: "Keep the colony productive but accept higher radiation exposure." },
      { id: "ignore", label: "Ignore the alert", detail: "Continue everything normally and take the largest radiation penalty." },
    ],
    "micrometeoroid-impact": [
      { id: "inspect", label: "Inspect exposed hardware", detail: "Use the rover or crew procedures to identify the damaged external subsystem before returning to full operations." },
      { id: "isolate", label: "Isolate the affected circuit", detail: "Protect the habitat power network while sacrificing a small amount of available capacity." },
      { id: "defer", label: "Defer inspection", detail: "Keep the base operating, but accept additional equipment and habitat safety margin loss." },
    ],
    "polar-shadow-cold-soak": [
      { id: "heat", label: "Increase heater power", detail: "Use electrical power to keep exposed hardware above its qualified minimum temperature." },
      { id: "reroute", label: "Reroute power from non-critical loads", detail: "Protect thermal survival by shedding optional loads first." },
      { id: "defer", label: "Accept cold-soak", detail: "Conserve stored energy and accept reduced equipment condition." },
    ],
    "regional-dust-front": [
      { id: "shed", label: "Shed non-critical loads", detail: "Prepare for lower solar input and preserve battery reserve." },
      { id: "protect", label: "Protect and monitor arrays", detail: "Reduce exposure of vulnerable equipment while the dust front passes." },
      { id: "battery", label: "Maintain full operations on storage", detail: "Keep the colony productive using stored energy while solar input falls." },
    ],
    "mars-comm-relay-loss": [
      { id: "autonomy", label: "Enter autonomous operations", detail: "Continue critical control and science without relying on continuous Earth commands." },
      { id: "repoint", label: "Repoint the relay", detail: "Use the remaining link margin to restore a stable high-gain connection." },
      { id: "hold", label: "Hold current configuration", detail: "Wait for the link to recover while accepting lower communications reliability." },
    ],
    "thermal-drift": [
      { id: "rebalance", label: "Rebalance thermal system", detail: "Restore the preferred temperature band with a small power cost." },
      { id: "conserve", label: "Conserve stored energy", detail: "Accept a slower thermal correction to protect the battery." },
      { id: "ignore", label: "Continue normally", detail: "Let the temperature drift farther from its ideal range." },
    ],
    "comms-drift": [
      { id: "repoint", label: "Repoint communications array", detail: "Restore line-of-sight alignment and recover signal margin." },
      { id: "redundancy", label: hasNavigation ? "Switch to autonomous routing" : "Hold current link", detail: hasNavigation ? "Use navigation redundancy to preserve the link while the array realigns." : "Keep the existing link open and wait for the drift to settle." },
      { id: "ignore", label: "Continue without intervention", detail: "Accept reduced communications reliability." },
    ],
    "grid-overload": [
      { id: "reroute", label: "Reroute the power bus", detail: "Use active distribution control to keep essential systems stable." },
      { id: "shed", label: "Shed optional loads", detail: "Drop non-critical equipment before the overload spreads." },
      { id: "continue", label: "Continue normally", detail: "Keep every load active and accept a deeper battery draw." },
    ],
    "rover-wheel": [
      { id: "reroute", label: "Reroute rover", detail: "Take a longer route around the obstruction and preserve rover condition." },
      { id: "recall", label: "Recall to habitat", detail: "Abort the current task and bring the rover home safely." },
      { id: "force", label: "Force through obstruction", detail: "Save time now at the cost of rover condition." },
    ],
    "extraction-lock": [
      { id: "throttle", label: "Throttle extraction", detail: "Reduce torque and let the rig work through the obstruction carefully." },
      { id: "abort", label: "Abort extraction run", detail: "Protect the equipment and give up the immediate resource opportunity." },
      { id: "continue", label: "Keep full power", detail: "Try to break through immediately, risking equipment condition." },
    ],
    "isru-pressure": [
      { id: "throttle", label: "Throttle processing", detail: "Lower throughput and preserve power-system stability." },
      { id: "isolate", label: "Isolate the processing line", detail: "Protect the wider colony if the local process continues to misbehave." },
      { id: "continue", label: "Continue at full throughput", detail: "Keep output high and accept a larger power penalty." },
    ],
    "agriculture-stress": [
      { id: "lights", label: "Stabilise greenhouse controls", detail: "Increase electrical support to protect the crop environment." },
      { id: "conserve", label: "Conserve power", detail: "Protect battery reserves but accept slower food production." },
      { id: "continue", label: "Continue normally", detail: "Keep the schedule unchanged and accept crop stress." },
    ],
    "science-anomaly": [
      { id: "secure", label: "Secure the research data", detail: "Safely preserve the unexpected result before continuing the experiment." },
      { id: "isolate", label: "Isolate the instrument", detail: "Protect the equipment while saving most of the scientific value." },
      { id: "push", label: "Push the experiment", detail: "Take the risk for a larger scientific payoff." },
    ],
    "maintenance-alert": [
      { id: "dispatch", label: "Dispatch maintenance response", detail: "Repair the developing fault before it becomes a colony-wide problem." },
      { id: "monitor", label: "Monitor the subsystem", detail: "Save power now and accept a little additional wear." },
      { id: "ignore", label: "Ignore the warning", detail: "Keep everything running and accept a condition penalty." },
    ],
    "core-power": [
      { id: "shed", label: "Reduce non-critical systems", detail: "Preserve battery reserves by cutting optional loads." },
      { id: "balance", label: "Balance the power network", detail: "Use colony distribution controls to stabilise generation and demand." },
      { id: "battery", label: "Use stored power", detail: "Keep everything online by spending battery reserve." },
    ],
  };

  return choices[event.id] ?? [];
}

function resourceColor(value: number, invert = false): string {
  const effective = invert ? 100 - value : value;
  if (effective > 65) return "#8fc9a0";
  if (effective > 35) return "#efb658";
  return "#d77a5a";
}

function BuildingShape({
  track,
  tier,
  runtime,
  selected,
  alerted,
  x,
  y,
  onClick,
}: {
  track: TechnologyTrack;
  tier: Tier;
  runtime: BuildingRuntime;
  selected: boolean;
  alerted: boolean;
  x: number;
  y: number;
  onClick: () => void;
}) {
  const level = tierLevel(tier);
  const size = 38 + level * 7;
  const height = 18 + level * 8;
  const Icon = categoryIcons[track.category as keyof typeof categoryIcons] ?? Zap;
  const damaged = runtime.condition < 82;
  const dusted = track.id === "solar" && runtime.dust > 2;
  const topFill = tierMeta[tier]?.color ?? tierMeta.Foundation.color;
  const sideFill = tier === "Research" ? "#203c3b" : tier === "Apex" ? "#1d3440" : "#172a32";

  return (
    <g transform={`translate(${x} ${y})`} onClick={onClick} style={{ cursor: "pointer" }}>
      {alerted && (
        <>
          <ellipse cx="0" cy="4" rx={size * 1.15} ry={size * 0.68} fill="none" stroke="#ff8a65" strokeWidth="3" opacity="0.9" />
          <ellipse cx="0" cy="4" rx={size * 0.98} ry={size * 0.56} fill="#ff8a65" opacity="0.08" />
        </>
      )}
      <polygon points={`-${size},0 0,${size * 0.55} ${size},0 0,-${size * 0.55}`} fill="#0b171d" stroke={alerted ? "#ff8a65" : selected ? "#f5c86c" : "#55746d"} strokeWidth={alerted || selected ? 3 : 1.4} />
      <polygon points={`-${size},0 0,${size * 0.55} 0,${size * 0.55 + height} -${size},${height}`} fill={sideFill} />
      <polygon points={`0,${size * 0.55} ${size},0 ${size},${height} 0,${size * 0.55 + height}`} fill="#10242c" />

      {track.id === "solar" ? (
        <g>
          {Array.from({ length: 2 + level }).map((_, index) => (
            <polygon key={index} points={`-${size * 0.7 + index * 5},-${size * 0.22} -${size * 0.05 + index * 5},-${size * 0.48} ${size * 0.5 + index * 5},-${size * 0.15} 0,${size * 0.1}`} fill="#244852" stroke={dusted ? "#8f7960" : "#6fb2c6"} opacity={dusted ? 0.7 : 0.95} />
          ))}
          <line x1="0" y1={-size * 0.05} x2="0" y2={-size * 0.75} stroke="#76939a" strokeWidth="2" />
        </g>
      ) : track.id === "habitat" ? (
        <g>
          <ellipse cx="0" cy={-height * 0.72} rx={size * 0.66} ry={size * 0.38} fill="#294f57" opacity="0.96" />
          <ellipse cx="0" cy={-height * 0.82} rx={size * 0.38} ry={size * 0.2} fill="#6b7f73" opacity="0.45" />
        </g>
      ) : track.id === "battery" ? (
        <g>
          {Array.from({ length: 2 + level }).map((_, index) => (
            <rect key={index} x={-size * 0.55 + index * size * 0.34} y={-height * 0.95} width={size * 0.25} height={height * 1.55} rx="4" fill="#1d3c45" stroke="#688684" strokeWidth="1.2" />
          ))}
        </g>
      ) : track.id === "rover" ? (
        <g>
          <rect x={-size * 0.62} y={-height * 0.85} width={size * 1.24} height={height * 0.72} rx="5" fill="#6a6e69" stroke="#c4b88e" strokeWidth="1.5" />
          <circle cx={-size * 0.45} cy="-1" r="6" fill="#1b2528" stroke="#9ca39b" />
          <circle cx={size * 0.45} cy="-1" r="6" fill="#1b2528" stroke="#9ca39b" />
        </g>
      ) : track.id === "agriculture" ? (
        <g>
          <polygon points={`-${size * 0.65},0 0,-${size * 0.42} ${size * 0.65},0 0,${size * 0.42}`} fill="#37584f" stroke="#7cae8c" strokeWidth="1.2" />
          <line x1={-size * 0.3} y1="0" x2={size * 0.3} y2="0" stroke="#91c29d" strokeWidth="2" opacity="0.7" />
        </g>
      ) : track.id === "comms" ? (
        <g>
          <ellipse cx="0" cy={-height * 1.2} rx={size * 0.48} ry={size * 0.25} fill="#34555d" stroke="#a2bac0" strokeWidth="1.1" />
          <line x1="0" y1={-height * 1.05} x2="0" y2={-height * 2} stroke="#829a9f" strokeWidth="2" />
        </g>
      ) : track.id === "extraction" || track.id === "isru" ? (
        <g>
          <rect x={-size * 0.25} y={-height * 1.55} width={size * 0.5} height={height * 1.2} fill="#475c58" stroke="#a4ae91" strokeWidth="1.2" />
          <line x1="0" y1={-height * 1.55} x2={size * 0.68} y2={-height * 2.1} stroke="#b0a27c" strokeWidth="4" />
        </g>
      ) : (
        <g>
          <rect x={-size * 0.55} y={-height * 1.15} width={size * 1.1} height={height * 1.15} rx="5" fill={topFill} opacity="0.75" stroke="#b7c8b7" strokeWidth="1" />
          {Array.from({ length: 1 + level }).map((_, index) => (
            <rect key={index} x={-size * 0.36 + index * size * 0.24} y={-height} width={size * 0.14} height={height * 0.35} rx="1" fill="#e0d9b2" opacity="0.55" />
          ))}
        </g>
      )}

      <Icon x={-10} y={-height * 2.25} width={20} height={20} color={selected ? "#f6c96f" : "#b9d4ca"} />
      <text x="0" y={size * 0.92} textAnchor="middle" fill={selected ? "#f7cf79" : "#b0c4bf"} fontSize="11" fontWeight="700" letterSpacing="1.3">{track.category.toUpperCase()}</text>
      <text x="0" y={size * 0.92 + 14} textAnchor="middle" fill="#6e8d8b" fontSize="8" letterSpacing="0.7">{isTier(tier) ? tier.toUpperCase() : "FOUNDATION"}</text>
      {damaged && <circle cx={size * 0.76} cy={-size * 0.1} r="5" fill="#d77a5a" />}
    </g>
  );
}

const RESOURCE_NODES: Record<"MOON" | "MARS", ResourceNode[]> = {
  MOON: [
    { id: "moon-ice", label: "ICE DEPOSIT", kind: "ICE", x: 165, y: 190, description: "A cold-trap site with a strong water-ice signature." },
    { id: "moon-mineral", label: "ILMENITE RIDGE", kind: "MINERAL", x: 820, y: 285, description: "A bright mineral ridge worth a future extraction run." },
    { id: "moon-science", label: "CRATER SAMPLE", kind: "SCIENCE", x: 730, y: 145, description: "Fresh crater ejecta may contain useful scientific data." },
    { id: "moon-regolith", label: "REGOLITH FIELD", kind: "REGOLITH", x: 225, y: 420, description: "A broad regolith field suitable for rover mapping." },
  ],
  MARS: [
    { id: "mars-ice", label: "SUBSURFACE ICE", kind: "ICE", x: 175, y: 205, description: "Orbital data suggests shallow buried water ice." },
    { id: "mars-mineral", label: "IRON RIDGE", kind: "MINERAL", x: 825, y: 275, description: "A high-value iron-rich ridge sits beyond the outpost." },
    { id: "mars-science", label: "BASALT OUTCROP", kind: "SCIENCE", x: 725, y: 145, description: "An exposed basalt layer is ideal for geological sampling." },
    { id: "mars-regolith", label: "DUST PLAIN", kind: "REGOLITH", x: 225, y: 425, description: "A wide dust plain offers an easy autonomous mapping route." },
  ],
};

function IsometricMap({
  tracks,
  selected,
  buildings,
  onSelect,
  selectedBuildingId,
  elapsed,
  environmentLabel,
  environmentTitle,
  activeEventTrackId,
  selectedResourceId,
  surveyedNodes,
  onSelectResource,
  roverTask,
}: {
  tracks: TechnologyTrack[];
  selected: Record<string, Tier>;
  buildings: Record<string, BuildingRuntime>;
  onSelect: (trackId: string) => void;
  selectedBuildingId: string | null;
  elapsed: number;
  environmentLabel: string;
  environmentTitle: string;
  activeEventTrackId: string | null;
  selectedResourceId: string | null;
  surveyedNodes: string[];
  onSelectResource: (node: ResourceNode) => void;
  roverTask: string;
}) {
  return (
    <Colony3DMap
      tracks={tracks}
      selected={selected}
      buildings={buildings}
      selectedBuildingId={selectedBuildingId}
      elapsed={elapsed}
      environmentLabel={environmentLabel === "MARS" ? "MARS" : "MOON"}
      environmentTitle={environmentTitle}
      activeEventTrackId={activeEventTrackId}
      selectedResourceId={selectedResourceId}
      surveyedNodes={surveyedNodes}
      resourceNodes={RESOURCE_NODES[environmentLabel === "MARS" ? "MARS" : "MOON"]}
      onSelect={onSelect}
      onSelectResource={onSelectResource}
      roverTask={roverTask}
    />
  );
}

function MissionTaskRibbon({
  pending,
  elapsed,
  resolvedEvents,
  surveyedNodes,
  activeEvent,
  roverTask,
}: {
  pending: PendingMission;
  elapsed: number;
  resolvedEvents: string[];
  surveyedNodes: string[];
  activeEvent: MissionEvent | null;
  roverTask: string;
}) {
  const day = Math.min(14, Math.floor(elapsed / 30) + 1);
  const eventGoal = EVENT_TIMES.length;
  const surveyDone = surveyedNodes.length > 0;
  const taskRows = [
    { label: "SURVIVE", value: `DAY ${day.toString().padStart(2, "0")} / 14`, done: elapsed >= TOTAL_MISSION_SECONDS },
    { label: "RESPOND TO EVENTS", value: `${resolvedEvents.length} / ${eventGoal}`, done: resolvedEvents.length >= eventGoal },
    { label: "SURVEY A FIELD SITE", value: surveyDone ? "COMPLETE" : "1 REQUIRED", done: surveyDone },
  ];
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-30 w-[min(88vw,270px)]">
      <div className="pointer-events-auto overflow-hidden rounded-xl border-2 border-[#d3a84a] bg-[#172026]/92 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-[#4d5050] bg-[#27363a] px-3 py-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#e2b84f] text-[9px] font-black text-[#20261e]">★</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[8px] font-black uppercase tracking-[0.18em] text-[#f4db87]">{pending.missionTitle}</p>
            <p className="text-[7px] uppercase tracking-[0.15em] text-[#92a6a4]">Mission objectives</p>
          </div>
        </div>
        <div className="space-y-1.5 p-2">
          {taskRows.map((task) => (
            <div key={task.label} className="flex items-center justify-between gap-3 rounded-lg bg-[#0d171c]/75 px-2.5 py-1.5">
              <span className={`text-[7px] font-black uppercase tracking-[0.12em] ${task.done ? "text-[#7fe19f]" : "text-[#d8e0da]"}`}>
                {task.done ? "✓ " : "○ "}{task.label}
              </span>
              <span className={`shrink-0 text-[7px] font-mono font-bold ${task.done ? "text-[#7fe19f]" : "text-[#f2c960]"}`}>{task.value}</span>
            </div>
          ))}
          <div className="px-1 pt-0.5 text-[7px] uppercase tracking-[0.1em] text-[#728886]">
            {activeEvent ? `Target: ${activeEvent.trackId.toUpperCase()}` : roverTask !== "STANDBY" ? roverTask : "Keep the settlement stable."}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBar({
  icon,
  label,
  value,
  suffix = "%",
  invert = false,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  suffix?: string;
  invert?: boolean;
}) {
  const safe = clamp(value);
  const displayValue = suffix === "°" ? value.toFixed(1) : Math.round(value);
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.16em]">
        <span className="flex min-w-0 items-center gap-1.5 text-[#9eb0aa]">{icon}<span className="truncate">{label}</span></span>
        <span style={{ color: resourceColor(safe, invert) }} className="font-mono font-bold">{displayValue}{suffix}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-[#29434a] bg-[#0a171c]">
        <div className="h-full" style={{ width: `${clamp(value)}%`, background: resourceColor(safe, invert), boxShadow: `0 0 10px ${resourceColor(safe, invert)}55` }} />
      </div>
    </div>
  );
}

function BuildingInspector({
  track,
  tier,
  runtime,
  onAction,
  onClose,
  hasMaintenance,
  actionBusy,
  activeEvent,
  eventChoices,
  onEventChoice,
  power,
  battery,
}: {
  track: TechnologyTrack;
  tier: Tier;
  runtime: BuildingRuntime;
  onAction: (action: string) => void;
  onClose: () => void;
  hasMaintenance: boolean;
  actionBusy: boolean;
  activeEvent: MissionEvent | null;
  eventChoices: EventChoice[];
  onEventChoice: (choiceId: string) => void;
  power: number;
  battery: number;
}) {
  const actionMap: Record<string, EventChoice[]> = {
    solar: [
      { id: "clean", label: "Clean array", detail: "Remove accumulated dust and recover generation." },
      { id: "tune", label: "Tune tracking", detail: "Optimise the array for the current Sun angle." },
    ],
    battery: [
      { id: "balance", label: "Balance cells", detail: "Rebalance charge across the storage bank." },
      { id: "reserve", label: "Set reserve", detail: "Protect emergency storage and reshape the power margin." },
    ],
    oxygen: [
      { id: "reset", label: "Reset loop", detail: "Cycle the atmospheric processing hardware." },
      { id: "boost", label: "Boost output", detail: "Increase oxygen processing for a short high-load cycle." },
    ],
    water: [
      { id: "flush", label: "Flush loop", detail: "Clean the recovery path and restore throughput." },
      { id: "purify", label: "Deep purify", detail: "Use extra power to recover more usable water." },
    ],
    co2: [
      { id: "scrub", label: "Run scrubber", detail: "Increase CO₂ removal to protect cabin air quality." },
      { id: "recover", label: "Recover carbon", detail: "Run the recovery stage for a small efficiency gain." },
    ],
    thermal: [
      { id: "dump", label: "Dump heat", detail: "Push stored heat toward the radiator loop." },
      { id: "insulate", label: "Protect thermal", detail: "Reduce thermal drift at a small power cost." },
    ],
    comms: [
      { id: "repoint", label: "Repoint antenna", detail: "Correct the high-gain dish pointing solution." },
      { id: "test", label: "Link test", detail: "Run a communications health check." },
    ],
    habitat: [
      { id: "repair", label: "Repair seal", detail: hasMaintenance ? "Use maintenance support for a stronger repair." : "Patch the most likely pressure-leak path." },
      { id: "seal", label: "Pressure check", detail: "Run a focused leak isolation and sealing cycle." },
    ],
    radiation: [
      { id: "shield", label: "Check shielding", detail: "Inspect shelter layers and improve protection." },
      { id: "shelter", label: "Shelter protocol", detail: "Move the crew into protected operating mode." },
    ],
    grid: [
      { id: "balance-grid", label: "Balance bus", detail: "Rebalance loads before a distribution fault develops." },
      { id: "prioritize", label: "Prioritize critical", detail: "Reserve power for life support and habitat systems." },
    ],
    science: [
      { id: "calibrate", label: "Calibrate", detail: "Recalibrate the science stack for cleaner measurements." },
      { id: "experiment", label: "Run experiment", detail: "Turn the current environment into a research result." },
    ],
    navigation: [
      { id: "nav-calibrate", label: "Calibrate nav", detail: "Tighten positioning and route accuracy." },
      { id: "route", label: "Plan route", detail: "Recalculate the safest colony vehicle route." },
    ],
    rover: [
      { id: "survey", label: "Survey site", detail: "Dispatch the rover along the marked field route." },
      { id: "return", label: "Return home", detail: "Recall the rover to the launch lane." },
      { id: "inspect", label: "Inspect rover", detail: "Check wheels, payload, and navigation health." },
    ],
    extraction: [
      { id: "extract-test", label: "Test drill", detail: "Run a short extraction test at the surveyed deposit." },
      { id: "extract", label: "Extract sample", detail: "Use power to collect a larger resource yield." },
    ],
    isru: [
      { id: "process", label: "Process feed", detail: "Convert surveyed local material into useful stock." },
      { id: "purge", label: "Purge line", detail: "Clear the feed system and reduce pressure risk." },
    ],
    agriculture: [
      { id: "tune-crops", label: "Tune crops", detail: "Optimise the controlled environment for food growth." },
      { id: "harvest", label: "Harvest", detail: "Collect the current mature crop output." },
    ],
    maintenance: [
      { id: "service", label: "Service", detail: "Preventatively service the weakest colony system." },
      { id: "diagnostics", label: "Diagnostics", detail: "Scan for developing faults before they become events." },
    ],
  };
  const actions = actionMap[track.id] ?? [{ id: "inspect", label: "Inspect system", detail: "Review current operating condition." }];
  const Icon = categoryIcons[track.category as keyof typeof categoryIcons] ?? Factory;
  const condition = Math.round(runtime.condition);
  const dust = Math.round(runtime.dust);
  const upgradeLevel = runtime.upgradeLevel ?? 0;
  const canUpgrade = upgradeLevel < 2 && power >= 8 && battery >= 5;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex justify-center px-3 sm:bottom-5">
      <div className="pointer-events-auto max-h-[84vh] w-[min(94vw,520px)] overflow-y-auto rounded-[26px] border border-[#6e7d7b] bg-[#0b1519]/[0.98] shadow-[0_24px_70px_rgba(0,0,0,0.62)] backdrop-blur-md">
        <div className="relative overflow-hidden border-b border-[#30454b] bg-gradient-to-r from-[#172b32] via-[#152329] to-[#111a1f] px-5 py-4">
          <div className="absolute right-[-30px] top-[-40px] h-32 w-32 rounded-full bg-[#f4c75e]/[0.06] blur-2xl" />
          <div className="relative flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#415961] bg-[#081116]">
              <Icon className="h-6 w-6" style={{ color: tierMeta[tier].color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: tierMeta[tier].color }}>{track.category} · {tier}</p>
              <h2 className="mt-1 truncate text-lg font-black uppercase tracking-[0.06em] text-white sm:text-xl">{track.tiers[tier].name}</h2>
              <p className="mt-1 text-[11px] leading-4 text-[#9fb0b2]">{track.description}</p>
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#3c5056] bg-[#0a1317] text-xl text-[#9fb0b3] transition hover:border-[#f0c964] hover:text-white" aria-label="Close building panel">×</button>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.16em]">
                <span className="text-[#87999d]">System condition</span>
                <span style={{ color: resourceColor(runtime.condition) }}>{condition}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#22343a]">
                <div className="h-full rounded-full transition-all" style={{ width: `${condition}%`, background: resourceColor(runtime.condition) }} />
              </div>
            </div>
            {track.id === "solar" && (
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#87999d]">Dust load</p>
                <p className="mt-0.5 font-mono text-sm text-[#e9c865]">{dust}%</p>
              </div>
            )}
          </div>
        </div>

        {activeEvent && eventChoices.length > 0 && (
          <section className="border-b border-[#733943] bg-[#21151b] p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#ff5367]/15 text-[#ff7380]"><CircleDot className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ff7783]">Disaster response required</p>
                <h3 className="mt-0.5 text-xs font-black uppercase tracking-[0.06em] text-white">{activeEvent.title}</h3>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-[#d2bec4]">{activeEvent.summary}</p>
            <div className="mt-3 grid gap-2">
              {eventChoices.map((choice, index) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => onEventChoice(choice.id)}
                  disabled={actionBusy}
                  className="rounded-xl border border-[#71404b] bg-[#2a1b22] p-2.5 text-left transition hover:border-[#f4cd6c] hover:bg-[#33222a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#ff5367]/15 text-[9px] font-black text-[#ffd875]">{index + 1}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.04em] text-white">{choice.label}</span>
                  </span>
                  <span className="mt-1 block pl-8 text-[9px] leading-4 text-[#c2afb7]">{choice.detail}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3">
          {actions.map((action, index) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action.id)}
              disabled={actionBusy}
              className="group min-w-0 rounded-2xl border border-[#35505a] bg-[#14262d] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#f2cd64] hover:bg-[#1b343d] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
            >
              <span className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0a1519] text-[10px] font-black text-[#f4cf65]">{index + 1}</span>
                <span className="text-[10px] font-black uppercase tracking-[0.05em] text-white">{action.label}</span>
              </span>
              <span className="mt-2 block text-[9px] leading-4 text-[#8da2a7]">{action.detail}</span>
            </button>
          ))}
        </div>
        <div className="mx-4 mb-4 rounded-2xl border border-[#40575b] bg-[#101f24] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#e5c56b]">Module upgrade</p>
              <p className="mt-1 text-[9px] leading-4 text-[#9cb0b2]">Level {upgradeLevel}/2 · costs 8 power and 5 battery reserve · improves performance and condition.</p>
            </div>
            <button
              type="button"
              onClick={() => onAction("upgrade")}
              disabled={actionBusy || !canUpgrade}
              className="shrink-0 rounded-xl border border-[#8b7445] bg-[#d9b555] px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-[#1b211d] transition hover:bg-[#f0cd70] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {upgradeLevel >= 2 ? "MAX LEVEL" : "UPGRADE"}
            </button>
          </div>
          {!canUpgrade && upgradeLevel < 2 && (
            <p className="mt-2 text-[9px] text-[#e3a2a0]">Requires at least 8 power and 5 battery reserve.</p>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-[#293e44] px-5 py-3">
          <span className={`text-[9px] font-bold uppercase tracking-[0.16em] ${actionBusy ? "text-[#f0c85f]" : "text-[#70858a]"}`}>{actionBusy ? "OPERATION IN PROGRESS" : runtime.status}</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#7e9398]">Tap another facility to switch</span>
        </div>
      </div>
    </div>
  );
}

function ResourceInspector({
  node, surveyed, hasRover, hasExtraction, onAction, onClose,
}: {
  node: ResourceNode;
  surveyed: boolean;
  hasRover: boolean;
  hasExtraction: boolean;
  onAction: (action: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex justify-center px-3 sm:bottom-5">
      <div className="pointer-events-auto w-[min(94vw,470px)] overflow-hidden rounded-[26px] border border-[#6b7e68] bg-[#101a16]/[0.97] shadow-[0_24px_70px_rgba(0,0,0,0.62)] backdrop-blur-md">
        <div className="flex items-start gap-3 border-b border-[#334b3b] bg-gradient-to-r from-[#183025] to-[#13221b] px-5 py-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#49664d] bg-[#0a1510]">
            <CircleDot className="h-6 w-6 text-[#f0cf69]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#86b88d]">{node.kind} DEPOSIT · {surveyed ? "SURVEYED" : "UNSURVEYED"}</p>
            <h2 className="mt-1 text-lg font-black uppercase tracking-[0.06em] text-white">{node.label}</h2>
            <p className="mt-1 text-[11px] leading-4 text-[#9eb2a4]">{node.description}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#43584b] bg-[#0c1711] text-xl text-[#9bb0a0] hover:border-[#f0cf69] hover:text-white" aria-label="Close resource panel">×</button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3">
          <button type="button" onClick={() => onAction("survey")} className="rounded-2xl border border-[#3b654b] bg-[#173326] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#f0cf69]">
            <span className="block text-[10px] font-black uppercase tracking-[0.05em] text-white">{surveyed ? "Resurvey" : "Survey"}</span>
            <span className="mt-2 block text-[9px] leading-4 text-[#91ad99]">{hasRover ? "Dispatch rover." : "Use local sensors."}</span>
          </button>
          <button type="button" disabled={!surveyed} onClick={() => onAction("sample")} className="rounded-2xl border border-[#3b654b] bg-[#173326] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#f0cf69] disabled:cursor-not-allowed disabled:opacity-35">
            <span className="block text-[10px] font-black uppercase tracking-[0.05em] text-white">Collect sample</span>
            <span className="mt-2 block text-[9px] leading-4 text-[#91ad99]">Turn field data into research.</span>
          </button>
          {hasExtraction && surveyed && (
            <button type="button" onClick={() => onAction("extract")} className="rounded-2xl border border-[#725e35] bg-[#302715] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#f0cf69] sm:col-span-1">
              <span className="block text-[10px] font-black uppercase tracking-[0.05em] text-[#ffeab2]">Test extraction</span>
              <span className="mt-2 block text-[9px] leading-4 text-[#b8a27d]">Spend power for a resource yield.</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
function getAiAnalysis(metrics: MissionMetrics, score: number): string {
  if (metrics.battery < 45) return "Your largest weakness was battery management during low-solar periods. Stored energy was used more aggressively than necessary.";
  if (metrics.water < 55) return "Your largest weakness was water recovery. The colony remained stable, but the recycling loop lost reserve that could have been protected earlier.";
  if (metrics.oxygen < 55) return "Your largest weakness was life-support margin. The oxygen loop remained functional, but several responses left less reserve than necessary.";
  if (metrics.habitat < 75) return "Your largest weakness was structural protection. Earlier inspection would have preserved more habitat margin.";
  if (score >= 85) return "You managed the colony proactively. Your decisions preserved reserves and prevented small faults from becoming large system problems.";
  return "The colony survived with a workable balance of power and life support. The next improvement is to intervene slightly earlier when reserves begin falling.";
}

export function MissionSimulation() {
  const pending = useMemo<PendingMission | null>(() => loadPendingMission(), []);
  const runtime = pending ? loadMissionRuntime(pending.missionId) : null;
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(runtime?.elapsedSeconds ?? 0);
  const [metrics, setMetrics] = useState<MissionMetrics>(() => runtime?.metrics ?? (pending ? initialMetrics(pending.selected) : initialMetrics({ solar: "Foundation" })));
  const [buildings, setBuildings] = useState<Record<string, BuildingRuntime>>(() => runtime?.buildings ?? (pending ? initialBuildings(pending.selected) : {}));
  const [activeEventId, setActiveEventId] = useState<string | null>(runtime?.activeEventId ?? null);
  const [resolvedEventIds, setResolvedEventIds] = useState<string[]>(runtime?.resolvedEventIds ?? []);
  const [decisions, setDecisions] = useState<MissionDecision[]>(runtime?.decisions ?? []);
  const [aiMessage, setAiMessage] = useState(runtime?.aiMessage ?? "Mission AI online. I am monitoring power, life support, habitat condition, and system behaviour.");
  const [roverTask, setRoverTask] = useState(runtime?.roverTask ?? "STANDBY");
  const [score, setScore] = useState(runtime?.score ?? 72);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [surveyedNodes, setSurveyedNodes] = useState<string[]>([]);
  const [resourceYield, setResourceYield] = useState(0);
  const [manualActions, setManualActions] = useState(0);
  const [manualPaused, setManualPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [results, setResults] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const eventPointerRef = useRef(
    (runtime?.resolvedEventIds.length ?? 0) + (runtime?.activeEventId ? 1 : 0),
  );
  const completionSavedRef = useRef(false);

  const selectedTracks = pending ? selectedTrackData(pending.selected) : [];
  const selectedTrack = selectedBuildingId ? selectedTracks.find((track) => track.id === selectedBuildingId) : undefined;
  const selectedTier = selectedTrack && pending ? pending.selected[selectedTrack.id] : undefined;
  const activeEvent = activeEventId ? EVENT_DEFS.find((event) => event.id === activeEventId) ?? null : null;
  const activeTargetTrackId = activeEvent?.trackId === "power" ? "battery" : activeEvent?.trackId ?? null;
  const selectedResource = selectedResourceId
    ? RESOURCE_NODES[pending?.campaign === "mars" ? "MARS" : "MOON"].find((node) => node.id === selectedResourceId)
    : undefined;
  const environmentLabel = pending?.campaign === "mars" ? "MARS" : "MOON";
  const environmentTitle = pending?.campaign === "mars" ? "Utopia Planitia" : "Mare Tranquillitatis";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedBuildingId(null);
      setSelectedResourceId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);


  useEffect(() => {
    if (!pending || results || manualPaused || activeEventId) return;

    const timer = window.setInterval(() => {
      setElapsed((current) => {
        const next = Math.min(TOTAL_MISSION_SECONDS, current + 0.25 * speed);

        while (eventPointerRef.current < EVENT_TIMES.length && next >= EVENT_TIMES[eventPointerRef.current]) {
          const event = pickNextEvent(environmentLabel, pending.selected, resolvedEventIds, eventPointerRef.current, metrics);
          eventPointerRef.current += 1;
          setTimeout(() => {
            setActiveEventId(event.id);
            setAiMessage(`EVENT DETECTED: ${event.title}. Review the situation and choose a response.`);
          }, 0);
          break;
        }

        if (next >= TOTAL_MISSION_SECONDS) {
          setTimeout(() => setResults(true), 0);
        }

        return next;
      });

      setMetrics((current) => {
        const solarTier = tierLevel(pending.selected.solar ?? "Foundation");
        const batteryTier = tierLevel(pending.selected.battery ?? "Foundation");
        const oxygenTier = tierLevel(pending.selected.oxygen ?? "Foundation");
        const waterTier = tierLevel(pending.selected.water ?? "Foundation");
        const thermalTier = tierLevel(pending.selected.thermal ?? "Foundation");
        const optionalCount = Object.keys(pending.selected).filter((id) => !starterCategories.has(id)).length;
        const solarDust = buildings.solar?.dust ?? 0;
        const solarUpgrade = buildings.solar?.upgradeLevel ?? 0;
        const batteryUpgrade = buildings.battery?.upgradeLevel ?? 0;
        const oxygenUpgrade = buildings.oxygen?.upgradeLevel ?? 0;
        const waterUpgrade = buildings.water?.upgradeLevel ?? 0;
        const foodUpgrade = buildings.agriculture?.upgradeLevel ?? 0;
        const thermalUpgrade = buildings.thermal?.upgradeLevel ?? 0;
        const habitatUpgrade = buildings.habitat?.upgradeLevel ?? 0;
        const powerBase = 74 + solarTier * 7 + solarUpgrade * 4 - solarDust * 0.34 - optionalCount * 1.8 + (pending.selected.grid ? tierLevel(pending.selected.grid) * 3 : 0);
        const demandPenalty = Math.max(0, 68 - powerBase);
        const batteryDelta = (powerBase > 72 ? 0.012 : -0.042 - demandPenalty * 0.001) + batteryTier * 0.008 + batteryUpgrade * 0.012;

        return {
          power: clamp(powerBase),
          battery: clamp(current.battery + batteryDelta * speed),
          oxygen: clamp(current.oxygen - (0.0085 - oxygenTier * 0.0018 - oxygenUpgrade * 0.0008) * speed),
          water: clamp(current.water - (0.0075 - waterTier * 0.0016 - waterUpgrade * 0.0007) * speed),
          food: clamp(current.food - (0.0065 - (pending.selected.agriculture ? tierLevel(pending.selected.agriculture) * 0.0016 : 0) - foodUpgrade * 0.0008) * speed),
          temperature: clamp(current.temperature + (21 - current.temperature) * (0.01 + (thermalTier + thermalUpgrade) * 0.004) * speed, 16, 28),
          radiation: clamp(current.radiation + 0.0005 * speed),
          habitat: clamp(current.habitat - Math.max(0.00025, 0.0012 - habitatUpgrade * 0.00035) * speed),
        };
      });

      setBuildings((current) => {
        const next = { ...current };
        for (const [trackId, state] of Object.entries(next)) {
          const tier = pending.selected[trackId];
          const level = tier ? tierLevel(tier) : 0;
          const wear = trackId === "solar" ? 0.003 : 0.0016;
          next[trackId] = {
            ...state,
            condition: clamp(state.condition - Math.max(0.00025, wear - level * 0.00025 - (state.upgradeLevel ?? 0) * 0.0003) * speed),
            status: buildingStatus(clamp(state.condition - Math.max(0.00025, wear - level * 0.00025 - (state.upgradeLevel ?? 0) * 0.0003) * speed)),
            dust: trackId === "solar" ? clamp(state.dust + Math.max(0.002, 0.012 - level * 0.0015 - (state.upgradeLevel ?? 0) * 0.002) * speed) : state.dust,
          };
        }
        return next;
      });
    }, 250);

    return () => window.clearInterval(timer);
  }, [activeEventId, buildings.solar?.dust, manualPaused, metrics, pending, resolvedEventIds, results, speed]);

  useEffect(() => {
    if (!pending || results) return;
    saveMissionRuntime({
      missionId: pending.missionId,
      elapsedSeconds: elapsed,
      metrics,
      buildings,
      activeEventId,
      resolvedEventIds,
      decisions,
      aiMessage,
      roverTask,
      score,
    });
  }, [activeEventId, aiMessage, buildings, decisions, elapsed, metrics, pending, resolvedEventIds, results, roverTask, score]);

  useEffect(() => {
    if (!results || !pending || completionSavedRef.current) return;
    completionSavedRef.current = true;

    const finalState = loadGameState();
    const alreadyComplete = finalState.completedMissions.includes(pending.missionId);
    const firstTime = !pending.replay && !alreadyComplete;
    const nextState = {
      ...finalState,
      credits: finalState.credits + pending.rewardCredits,
      xp: finalState.xp + pending.rewardXp,
      researchTokens: finalState.researchTokens + (firstTime ? pending.rewardResearchTokens : 0),
      completedMissions: firstTime ? Array.from(new Set([...finalState.completedMissions, pending.missionId])) : finalState.completedMissions,
      lastMissionReward: firstTime
        ? {
            missionId: pending.missionId,
            title: pending.missionTitle,
            credits: pending.rewardCredits,
            xp: pending.rewardXp,
            researchTokens: pending.rewardResearchTokens,
          }
        : undefined,
    };

    saveGameState(nextState);
    clearMissionRuntime();
    clearPendingMission();
  }, [pending, results]);

  const handleEventChoice = (choiceId: string) => {
    if (!activeEvent || !pending) return;

    const choice = getEventChoices(activeEvent, pending.selected).find((item) => item.id === choiceId);
    setDecisions((current) => [...current, { eventId: activeEvent.id, choiceId, label: choice?.label ?? choiceId }]);
    setResolvedEventIds((current) => current.includes(activeEvent.id) ? current : [...current, activeEvent.id]);

    const level = tierLevel(pending.selected[activeEvent.trackId] ?? "Foundation");

    switch (activeEvent.id) {
      case "solar-dust":
        if (choiceId === "clean") {
          const bonus = pending.selected.rover ? 48 : 34;
          setBuildings((current) => ({
            ...current,
            solar: { ...(current.solar ?? { condition: 100, dust: 0, status: "ONLINE" }), dust: clamp((current.solar?.dust ?? 0) - bonus) },
          }));
          setMetrics((current) => ({ ...current, power: clamp(current.power + 8 + level * 2), battery: clamp(current.battery + 3) }));
          setScore((value) => clamp(value + 8));
          setAiMessage(pending.selected.rover ? "Good call. The rover cleaned the solar array and recovered a large portion of lost output." : "The array was cleaned successfully. A rover-assisted clean would have been faster.");
        } else if (choiceId === "shed") {
          setMetrics((current) => ({ ...current, power: clamp(current.power + 2), battery: clamp(current.battery + 8) }));
          setScore((value) => clamp(value + 6));
          setAiMessage("Load shedding protected your battery reserve while the array remained dirty.");
        } else {
          setMetrics((current) => ({ ...current, power: clamp(current.power - 10), battery: clamp(current.battery - (15 - level * 2)) }));
          setBuildings((current) => ({ ...current, solar: { ...(current.solar ?? { condition: 100, dust: 0, status: "ONLINE" }), dust: clamp((current.solar?.dust ?? 0) + 9 - level * 2) } }));
          setScore((value) => clamp(value - 8));
          setAiMessage("Normal operations were maintained, but the colony paid for it with a deeper battery draw.");
        }
        break;

      case "battery-thermal":
        if (choiceId === "isolate") {
          setMetrics((current) => ({ ...current, battery: clamp(current.battery - 4), power: clamp(current.power - 2) }));
          setScore((value) => clamp(value + 6));
          setAiMessage("Storage isolation limited the thermal problem. Some capacity was sacrificed, but the bank remained stable.");
        } else if (choiceId === "rebalance") {
          setMetrics((current) => ({ ...current, battery: clamp(current.battery + 6), power: clamp(current.power + 2) }));
          setScore((value) => clamp(value + 7));
          setAiMessage("Load balancing was the strongest response: it protected the storage reserve without shutting down life support.");
        } else {
          setMetrics((current) => ({ ...current, battery: clamp(current.battery - (13 - level * 2)), power: clamp(current.power - 5) }));
          setScore((value) => clamp(value - 7));
          setAiMessage("Continuing normally kept everything active, but the affected battery path lost reserve faster.");
        }
        break;

      case "oxygen-filter":
        if (choiceId === "reset") {
          setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + 5), power: clamp(current.power - 4) }));
          setScore((value) => clamp(value + 7));
          setAiMessage("The oxygen processing loop was reset. Short-term power demand increased, but life-support margin recovered.");
        } else if (choiceId === "reduce") {
          setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + 2), battery: clamp(current.battery + 3) }));
          setScore((value) => clamp(value + 5));
          setAiMessage("Reducing non-essential habitation load bought the oxygen system time without spending much stored power.");
        } else {
          setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen - (13 - level * 2)) }));
          setScore((value) => clamp(value - 8));
          setAiMessage("The filter restriction was left untreated, so the oxygen reserve fell faster than necessary.");
        }
        break;

      case "water-filter":
        if (choiceId === "flush") {
          setMetrics((current) => ({ ...current, water: clamp(current.water + 7), power: clamp(current.power - 3) }));
          setScore((value) => clamp(value + 7));
          setAiMessage("The water filter was flushed and recovery performance improved immediately.");
        } else if (choiceId === "ration") {
          setMetrics((current) => ({ ...current, water: clamp(current.water + 2), battery: clamp(current.battery + 3) }));
          setScore((value) => clamp(value + 5));
          setAiMessage("Water conservation protected the reserve while the filter remained partially restricted.");
        } else {
          setMetrics((current) => ({ ...current, water: clamp(current.water - 12) }));
          setScore((value) => clamp(value - 8));
          setAiMessage("The recycling blockage was ignored, so the colony lost water reserve it could have recovered.");
        }
        break;

      case "habitat-pressure":
        if (choiceId === "seal") {
          const amount = 7 + level * 2;
          setBuildings((current) => ({ ...current, habitat: { ...(current.habitat ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.habitat?.condition ?? 100) + amount), status: buildingStatus(clamp((current.habitat?.condition ?? 100) + amount)) } }));
          setMetrics((current) => ({ ...current, habitat: clamp(current.habitat + 5), battery: clamp(current.battery - 2) }));
          setScore((value) => clamp(value + 7));
          setAiMessage("Structural sealing stabilised the habitat before the anomaly could spread.");
        } else if (choiceId === "monitor") {
          setMetrics((current) => ({ ...current, habitat: clamp(current.habitat + 1) }));
          setScore((value) => clamp(value + 3));
          setAiMessage("Monitoring worked, but it left less safety margin than an immediate inspection and seal.");
        } else {
          const loss = 10 - level * 2;
          setBuildings((current) => ({ ...current, habitat: { ...(current.habitat ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.habitat?.condition ?? 100) - loss), status: buildingStatus(clamp((current.habitat?.condition ?? 100) - loss)) } }));
          setMetrics((current) => ({ ...current, habitat: clamp(current.habitat - 9 + level) }));
          setScore((value) => clamp(value - 8));
          setAiMessage("The habitat anomaly was ignored. The colony survived, but structural margin was unnecessarily lost.");
        }
        break;

      case "micrometeoroid-impact":
        if (choiceId === "inspect") {
          setBuildings((current) => ({
            ...current,
            habitat: { ...(current.habitat ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.habitat?.condition ?? 100) - 1), status: buildingStatus(clamp((current.habitat?.condition ?? 100) - 1)) },
          }));
          setScore((value) => clamp(value + 8));
          setAiMessage("External hardware was inspected after the impact. No pressure-shell breach was indicated, and the damaged equipment was isolated.");
        } else if (choiceId === "isolate") {
          setMetrics((current) => ({ ...current, power: clamp(current.power - 2), battery: clamp(current.battery - 2) }));
          setScore((value) => clamp(value + 6));
          setAiMessage("The affected circuit was isolated. Some capability was lost, but the primary habitat power path remained protected.");
        } else {
          setBuildings((current) => ({
            ...current,
            habitat: { ...(current.habitat ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.habitat?.condition ?? 100) - 7), status: buildingStatus(clamp((current.habitat?.condition ?? 100) - 7)) },
          }));
          setScore((value) => clamp(value - 7));
          setAiMessage("The impact was left uninspected. The base stayed pressurised, but exposed-system condition deteriorated.");
        }
        break;

      case "polar-shadow-cold-soak":
        if (choiceId === "heat") {
          setMetrics((current) => ({ ...current, battery: clamp(current.battery - 7), temperature: clamp(current.temperature - 0.4, 16, 28) }));
          setScore((value) => clamp(value + 7));
          setAiMessage("Heater power was increased to protect exposed hardware during the cold-soak transition.");
        } else if (choiceId === "reroute") {
          setMetrics((current) => ({ ...current, battery: clamp(current.battery + 2), power: clamp(current.power + 3), temperature: clamp(current.temperature - 0.8, 16, 28) }));
          setScore((value) => clamp(value + 8));
          setAiMessage("Non-critical electrical loads were shed and thermal protection was prioritized.");
        } else {
          setBuildings((current) => {
            const next = { ...current };
            for (const id of ["thermal", "solar"]) {
              if (!next[id]) continue;
              next[id] = { ...next[id], condition: clamp(next[id].condition - 7), status: buildingStatus(clamp(next[id].condition - 7)) };
            }
            return next;
          });
          setScore((value) => clamp(value - 7));
          setAiMessage("Cold-soak was accepted to preserve energy. Exposed hardware took a measurable condition penalty.");
        }
        break;

      case "regional-dust-front":
        if (choiceId === "shed") {
          setMetrics((current) => ({ ...current, power: clamp(current.power + 3), battery: clamp(current.battery + 9) }));
          setBuildings((current) => ({ ...current, solar: { ...(current.solar ?? { condition: 100, dust: 0, status: "ONLINE" }), dust: clamp((current.solar?.dust ?? 0) + 7) } }));
          setScore((value) => clamp(value + 8));
          setAiMessage("The dust front reduced solar input, so optional loads were shed and battery reserve was protected.");
        } else if (choiceId === "protect") {
          setBuildings((current) => ({ ...current, solar: { ...(current.solar ?? { condition: 100, dust: 0, status: "ONLINE" }), dust: clamp((current.solar?.dust ?? 0) + 3) } }));
          setMetrics((current) => ({ ...current, power: clamp(current.power - 4) }));
          setScore((value) => clamp(value + 6));
          setAiMessage("Array operations were reduced while the dust front passed. Solar losses stayed manageable.");
        } else {
          setMetrics((current) => ({ ...current, power: clamp(current.power - 12), battery: clamp(current.battery - 10) }));
          setBuildings((current) => ({ ...current, solar: { ...(current.solar ?? { condition: 100, dust: 0, status: "ONLINE" }), dust: clamp((current.solar?.dust ?? 0) + 8) } }));
          setScore((value) => clamp(value - 8));
          setAiMessage("Full operations were maintained during the dust front, consuming substantial stored energy.");
        }
        break;

      case "mars-comm-relay-loss":
        if (choiceId === "autonomy") {
          setScore((value) => clamp(value + 7));
          setAiMessage("Autonomous control retained essential operations while the Mars relay path was degraded.");
        } else if (choiceId === "repoint") {
          setBuildings((current) => ({ ...current, comms: { ...(current.comms ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.comms?.condition ?? 100) + 7), status: "ONLINE" } }));
          setScore((value) => clamp(value + 8));
          setAiMessage("The relay antenna was repointed and the communications margin recovered.");
        } else {
          setScore((value) => clamp(value - 5));
          setAiMessage("The degraded link was held without intervention. Critical autonomy remained available, but communications margin stayed low.");
        }
        break;

      case "radiation-burst":
        if (choiceId === "shelter") {
          setMetrics((current) => ({ ...current, radiation: clamp(current.radiation - 4), power: clamp(current.power - 3) }));
          setScore((value) => clamp(value + 7));
          setAiMessage("Shelter mode reduced radiation exposure and protected the crew while the event passed.");
        } else if (choiceId === "maintain") {
          setMetrics((current) => ({ ...current, radiation: clamp(current.radiation + 4) }));
          setScore((value) => clamp(value + 1));
          setAiMessage("Surface operations continued, but the colony accepted higher radiation exposure.");
        } else {
          setMetrics((current) => ({ ...current, radiation: clamp(current.radiation + 9) }));
          setScore((value) => clamp(value - 8));
          setAiMessage("The radiation alert was ignored. The colony stayed productive, but at a needless exposure cost.");
        }
        break;

      case "thermal-drift":
        if (choiceId === "rebalance") {
          setMetrics((current) => ({ ...current, temperature: clamp(current.temperature + (21 - current.temperature) * 0.7, 16, 28), battery: clamp(current.battery - 3) }));
          setScore((value) => clamp(value + 7));
          setAiMessage("Thermal balancing restored the habitat toward its preferred operating range.");
        } else if (choiceId === "conserve") {
          setMetrics((current) => ({ ...current, temperature: clamp(current.temperature + (21 - current.temperature) * 0.35, 16, 28), battery: clamp(current.battery + 3) }));
          setScore((value) => clamp(value + 5));
          setAiMessage("Energy conservation preserved the battery, but the temperature correction was slower.");
        } else {
          setMetrics((current) => ({ ...current, temperature: clamp(current.temperature + 4.5, 16, 28) }));
          setScore((value) => clamp(value - 7));
          setAiMessage("Thermal drift was left to grow. The colony remained inside emergency limits, but efficiency fell.");
        }
        break;

      case "comms-drift":
        if (choiceId === "repoint") {
          setBuildings((current) => ({ ...current, comms: { ...(current.comms ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.comms?.condition ?? 100) + 8), status: "ONLINE" } }));
          setScore((value) => clamp(value + 6));
          setAiMessage("The communications array was realigned and signal margin recovered.");
        } else if (choiceId === "redundancy") {
          setScore((value) => clamp(value + (pending.selected.navigation ? 7 : 2)));
          setAiMessage(pending.selected.navigation ? "Navigation redundancy preserved communications while the primary link drifted." : "The current link remained open, but its margin stayed limited.");
        } else {
          setScore((value) => clamp(value - 6));
          setAiMessage("Communications reliability was allowed to degrade without a clear operational benefit.");
        }
        break;

      case "grid-overload":
      case "core-power":
        if (choiceId === "reroute" || choiceId === "balance") {
          setMetrics((current) => ({ ...current, power: clamp(current.power + 6 + level * 2), battery: clamp(current.battery + 4) }));
          setScore((value) => clamp(value + 7));
          setAiMessage("Power distribution was actively managed. Essential systems retained a healthy operating margin.");
        } else if (choiceId === "shed") {
          setMetrics((current) => ({ ...current, power: clamp(current.power + 3), battery: clamp(current.battery + 7) }));
          setScore((value) => clamp(value + 6));
          setAiMessage("Optional loads were shed before the grid became unstable. Battery reserve improved.");
        } else {
          setMetrics((current) => ({ ...current, power: clamp(current.power - 8), battery: clamp(current.battery - 12) }));
          setScore((value) => clamp(value - 8));
          setAiMessage("The colony stayed online, but continued full demand consumed valuable stored energy.");
        }
        break;

      case "rover-wheel":
        if (choiceId === "reroute") {
          setRoverTask("REROUTING");
          setScore((value) => clamp(value + 6));
          setAiMessage("The rover is taking a longer route around the obstruction. Condition remains protected.");
        } else if (choiceId === "recall") {
          setRoverTask("RETURNING");
          setScore((value) => clamp(value + 3));
          setAiMessage("The rover was recalled safely. The survey objective will be less complete, but equipment risk is low.");
        } else {
          setRoverTask("FORCED THROUGH");
          setBuildings((current) => ({ ...current, rover: { ...(current.rover ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.rover?.condition ?? 100) - 10 + level * 2), status: buildingStatus(clamp((current.rover?.condition ?? 100) - 10 + level * 2)) } }));
          setScore((value) => clamp(value - 6));
          setAiMessage("The rover forced through the obstruction and lost condition. A safer reroute would have preserved the asset.");
        }
        break;

      case "extraction-lock":
        if (choiceId === "throttle") {
          setMetrics((current) => ({ ...current, power: clamp(current.power + 3) }));
          setScore((value) => clamp(value + 6));
          setAiMessage("Extraction torque was reduced and the rig remained within a safer operating envelope.");
        } else if (choiceId === "abort") {
          setScore((value) => clamp(value + 2));
          setAiMessage("The resource opportunity was abandoned, but the extraction equipment stayed protected.");
        } else {
          setBuildings((current) => ({ ...current, extraction: { ...(current.extraction ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.extraction?.condition ?? 100) - 12 + level * 3), status: buildingStatus(clamp((current.extraction?.condition ?? 100) - 12 + level * 3)) } }));
          setMetrics((current) => ({ ...current, power: clamp(current.power - 4) }));
          setScore((value) => clamp(value - 8));
          setAiMessage("Full extraction power was maintained during the torque lock. Equipment condition dropped as a result.");
        }
        break;

      case "isru-pressure":
        if (choiceId === "throttle") {
          setMetrics((current) => ({ ...current, power: clamp(current.power + 4), battery: clamp(current.battery + 2) }));
          setScore((value) => clamp(value + 6));
          setAiMessage("ISRU throughput was reduced before the processing surge could destabilise the power budget.");
        } else if (choiceId === "isolate") {
          setScore((value) => clamp(value + 5));
          setAiMessage("The processing line was isolated. Production slowed, but the rest of the colony stayed stable.");
        } else {
          setMetrics((current) => ({ ...current, power: clamp(current.power - 11), battery: clamp(current.battery - 8) }));
          setScore((value) => clamp(value - 8));
          setAiMessage("Full ISRU throughput was maintained during the surge, putting avoidable stress on the power system.");
        }
        break;

      case "agriculture-stress":
        if (choiceId === "lights") {
          setMetrics((current) => ({ ...current, food: clamp(current.food + 5), battery: clamp(current.battery - 4) }));
          setScore((value) => clamp(value + 7));
          setAiMessage("Greenhouse control power was increased and food-production conditions recovered.");
        } else if (choiceId === "conserve") {
          setMetrics((current) => ({ ...current, battery: clamp(current.battery + 3), food: clamp(current.food - 1) }));
          setScore((value) => clamp(value + 4));
          setAiMessage("Power was conserved, but the greenhouse accepted a small production penalty.");
        } else {
          setMetrics((current) => ({ ...current, food: clamp(current.food - 10) }));
          setScore((value) => clamp(value - 7));
          setAiMessage("Controlled-environment crop stress was left unresolved, reducing food-production reserve.");
        }
        break;

      case "science-anomaly":
        if (choiceId === "secure") {
          setScore((value) => clamp(value + 9));
          setAiMessage("Research data was secured safely. This was an efficient use of an optional science capability.");
        } else if (choiceId === "isolate") {
          setBuildings((current) => ({ ...current, science: { ...(current.science ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.science?.condition ?? 100) + 3), status: "ONLINE" } }));
          setScore((value) => clamp(value + 5));
          setAiMessage("The instrument was isolated and protected. Some scientific value was preserved without adding much risk.");
        } else {
          setBuildings((current) => ({ ...current, science: { ...(current.science ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.science?.condition ?? 100) - 14 + level * 3), status: buildingStatus(clamp((current.science?.condition ?? 100) - 14 + level * 3)) } }));
          setScore((value) => clamp(value - 5));
          setAiMessage("The experiment was pushed beyond the safe envelope. You gained risk without proportionate mission benefit.");
        }
        break;

      case "maintenance-alert":
        if (choiceId === "dispatch") {
          const candidates = Object.entries(buildings).sort(([, a], [, b]) => a.condition - b.condition);
          const target = candidates[0]?.[0];
          if (target) {
            setBuildings((current) => ({ ...current, [target]: { ...current[target], condition: clamp(current[target].condition + 18 + level * 4), status: buildingStatus(clamp(current[target].condition + 18 + level * 4)) } }));
          }
          setScore((value) => clamp(value + 9));
          setAiMessage("Predictive maintenance paid off: an emerging fault was repaired before it became a mission problem.");
        } else if (choiceId === "monitor") {
          setScore((value) => clamp(value + 3));
          setAiMessage("Monitoring saved power, but the developing fault remains on the watch list.");
        } else {
          setBuildings((current) => {
            const candidates = Object.entries(current).sort(([, a], [, b]) => a.condition - b.condition);
            const target = candidates[0]?.[0];
            if (!target) return current;
            return { ...current, [target]: { ...current[target], condition: clamp(current[target].condition - 8), status: buildingStatus(clamp(current[target].condition - 8)) } };
          });
          setScore((value) => clamp(value - 8));
          setAiMessage("The maintenance alert was ignored. The fault is now more likely to become a real repair task.");
        }
        break;

      default:
        setAiMessage("Mission AI recorded the decision and will include it in the final analysis.");
    }

    setActiveEventId(null);
  };

  const handleResourceAction = (nodeId: string, action: string) => {
    const nodes = RESOURCE_NODES[pending?.campaign === "mars" ? "MARS" : "MOON"];
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return;

    if (action === "survey") {
      setSurveyedNodes((current) => current.includes(nodeId) ? current : [...current, nodeId]);
      setManualActions((value) => value + 1);
      setScore((value) => clamp(value + (pending?.selected.rover ? 4 : 2)));
      setRoverTask(pending?.selected.rover ? "SURVEYING " + node.label : "REMOTE TERRAIN SCAN");
      setAiMessage(pending?.selected.rover ? "Rover dispatched to " + node.label + ". Terrain geometry and resource signatures are being mapped." : "Local sensors scanned " + node.label + ". A rover would provide higher-resolution terrain data.");
      return;
    }
    if (action === "sample" && surveyedNodes.includes(nodeId)) {
      setResourceYield((value) => value + 1);
      setManualActions((value) => value + 1);
      setScore((value) => clamp(value + 5));
      setAiMessage("Sample secured from " + node.label + ". The mission now has a physical field result.");
      return;
    }
    if (action === "extract" && surveyedNodes.includes(nodeId)) {
      setResourceYield((value) => value + 5);
      setManualActions((value) => value + 1);
      setMetrics((current) => ({ ...current, power: clamp(current.power - 5), battery: clamp(current.battery - 2) }));
      setScore((value) => clamp(value + 7));
      setAiMessage("Extraction test complete at " + node.label + ". Resource yield increased, but the operation consumed real colony power.");
    }
  };
  const runQuickCommand = (command: "survey" | "service" | "clean") => {
    if (command === "survey") {
      const nodes = RESOURCE_NODES[pending?.campaign === "mars" ? "MARS" : "MOON"];
      const nextNode = nodes.find((node) => !surveyedNodes.includes(node.id)) ?? nodes[0];
      if (nextNode) handleResourceAction(nextNode.id, "survey");
      return;
    }
    if (command === "clean" && pending?.selected.solar) {
      handleBuildingAction("solar", "clean");
      return;
    }
    if (command === "service" && pending?.selected.maintenance) {
      handleBuildingAction("maintenance", "service");
    }
  };
  const handleBuildingAction = (trackId: string, action: string) => {
    if (!pending?.selected[trackId] || actionBusy) return;
    if (action === "upgrade") {
      const current = buildings[trackId] ?? { condition: 100, dust: 0, status: "ONLINE", upgradeLevel: 0 };
      if ((current.upgradeLevel ?? 0) >= 2) {
        setAiMessage(`${trackId.toUpperCase()} has reached its maximum module upgrade level.`);
        return;
      }
      if (metrics.power < 8 || metrics.battery < 5) {
        setAiMessage("Upgrade unavailable: reserve at least 8 power and 5 battery before modifying this module.");
        return;
      }
    }
    setActionBusy(true);
    window.setTimeout(() => setActionBusy(false), 1100);
    setManualActions((value) => value + 1);

    const conditionBoost = (amount: number) => {
      setBuildings((current) => {
        const previous = current[trackId] ?? { condition: 100, dust: 0, status: "ONLINE" };
        const condition = clamp(previous.condition + amount);
        return { ...current, [trackId]: { ...previous, condition, status: buildingStatus(condition) } };
      });
    };

    switch (action) {
      case "upgrade": {
        setMetrics((current) => ({ ...current, power: clamp(current.power - 8), battery: clamp(current.battery - 5) }));
        setBuildings((current) => {
          const previous = current[trackId] ?? { condition: 100, dust: 0, status: "ONLINE", upgradeLevel: 0 };
          const upgradeLevel = Math.min(2, (previous.upgradeLevel ?? 0) + 1);
          const condition = clamp(previous.condition + 8);
          return { ...current, [trackId]: { ...previous, upgradeLevel, condition, status: buildingStatus(condition) } };
        });
        setScore((value) => clamp(value + 4));
        setAiMessage(`${trackId.toUpperCase()} upgraded to module level ${Math.min(2, (buildings[trackId]?.upgradeLevel ?? 0) + 1)}. Ongoing performance and equipment wear have improved.`);
        break;
      }
      case "clean": {
        const recovery = pending.selected.rover ? 24 : 16;
        setBuildings((current) => ({
          ...current,
          solar: {
            ...(current.solar ?? { condition: 100, dust: 0, status: "ONLINE" }),
            dust: clamp((current.solar?.dust ?? 0) - recovery),
            condition: clamp((current.solar?.condition ?? 100) + 1),
            status: buildingStatus(clamp((current.solar?.condition ?? 100) + 1)),
          },
        }));
        setMetrics((current) => ({ ...current, power: clamp(current.power + 4) }));
        setAiMessage(pending.selected.rover ? "Solar array cleaned by a rover-assisted operation. Generation margin recovered." : "Solar array cleaned. Generation margin recovered.");
        break;
      }
      case "tune": {
        setBuildings((current) => ({ ...current, solar: { ...(current.solar ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.solar?.condition ?? 100) + 1) } }));
        setMetrics((current) => ({ ...current, power: clamp(current.power + 3) }));
        setAiMessage("Solar tracking solution tuned for the current illumination angle.");
        break;
      }
      case "balance":
        setMetrics((current) => ({ ...current, battery: clamp(current.battery + 5), power: clamp(current.power + 2) }));
        setAiMessage("Battery cells balanced against the colony load. Reserve margin improved.");
        break;
      case "reserve":
        setMetrics((current) => ({ ...current, battery: clamp(current.battery + 8), power: clamp(current.power - 2) }));
        setAiMessage("Emergency reserve mode engaged. Stored energy is protected at the expense of available load.");
        break;
      case "reset":
        setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + 3), power: clamp(current.power - 2) }));
        setAiMessage("Atmospheric processing loop reset completed.");
        break;
      case "boost":
        setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + 6), power: clamp(current.power - 4) }));
        conditionBoost(-1);
        setAiMessage("Oxygen output temporarily increased. The extra processing load is drawing power.");
        break;
      case "flush":
        setMetrics((current) => ({ ...current, water: clamp(current.water + 4), power: clamp(current.power - 2) }));
        setAiMessage("Water recovery loop flushed. Differential pressure has fallen.");
        break;
      case "purify":
        setMetrics((current) => ({ ...current, water: clamp(current.water + 6), power: clamp(current.power - 4) }));
        setAiMessage("Deep purification cycle completed. Water reserve improved at a higher energy cost.");
        break;
      case "scrub":
        setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + 2), power: clamp(current.power - 1) }));
        setAiMessage("CO₂ scrubber cycle increased. Cabin atmospheric margin improved.");
        break;
      case "recover":
        setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + 1), power: clamp(current.power - 1) }));
        conditionBoost(1);
        setAiMessage("Carbon-recovery stage completed and the scrubber was left in a stable state.");
        break;
      case "dump": {
        setMetrics((current) => ({
          ...current,
          temperature: clamp(current.temperature + (21 - current.temperature) * 0.36, 16, 28),
          power: clamp(current.power - 2),
        }));
        setAiMessage("Thermal loop was opened to dump stored heat and pull the habitat back toward its target temperature.");
        break;
      }
      case "insulate":
        setMetrics((current) => ({ ...current, temperature: clamp(current.temperature + (21 - current.temperature) * 0.22, 16, 28), power: clamp(current.power - 1) }));
        conditionBoost(1);
        setAiMessage("Thermal protection mode engaged. Temperature drift has been reduced.");
        break;
      case "repoint":
        conditionBoost(1);
        setScore((value) => clamp(value + 3));
        setAiMessage("High-gain antenna repointed. Communications geometry is back inside the preferred link budget.");
        break;
      case "test":
        setScore((value) => clamp(value + 2));
        setAiMessage("Communications link test passed. The relay is tracking the current Earth-facing solution.");
        break;
      case "repair": {
        const amount = pending.selected.maintenance ? 28 : 14;
        const next = clamp((buildings.habitat?.condition ?? 100) + amount);
        setBuildings((current) => ({ ...current, habitat: { ...(current.habitat ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: next, status: buildingStatus(next) } }));
        setMetrics((current) => ({ ...current, habitat: clamp(current.habitat + 5), battery: clamp(current.battery - 2) }));
        setAiMessage(pending.selected.maintenance ? "Maintenance support completed a stronger habitat seal repair." : "Basic habitat seal repair completed. Structural margin restored.");
        break;
      }
      case "seal":
        setMetrics((current) => ({ ...current, habitat: clamp(current.habitat + 3), battery: clamp(current.battery - 1) }));
        conditionBoost(3);
        setAiMessage("Pressure-isolation cycle completed. Habitat leak margin improved.");
        break;
      case "shield":
        setMetrics((current) => ({ ...current, radiation: clamp(current.radiation - 2), battery: clamp(current.battery - 1) }));
        conditionBoost(1);
        setAiMessage("Shielding inspection completed. The protected volume is better prepared for elevated radiation.");
        break;
      case "shelter":
        setMetrics((current) => ({ ...current, radiation: clamp(current.radiation - 3), battery: clamp(current.battery - 2), power: clamp(current.power - 1) }));
        setAiMessage("Shelter protocol enabled. Crew exposure risk is reduced while the protective mode is active.");
        break;
      case "balance-grid":
        setMetrics((current) => ({ ...current, power: clamp(current.power + 3), battery: clamp(current.battery + 2) }));
        conditionBoost(1);
        setAiMessage("Power distribution bus balanced across active loads.");
        break;
      case "prioritize":
        setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + 1), water: clamp(current.water + 1), battery: clamp(current.battery + 3), power: clamp(current.power - 1) }));
        setAiMessage("Critical-load priority enabled. Life support and habitat systems now receive first access to reserve power.");
        break;
      case "calibrate":
        setScore((value) => clamp(value + 4));
        conditionBoost(1);
        setAiMessage("Science instruments calibrated against the current environmental baseline.");
        break;
      case "experiment":
        setResourceYield((value) => value + 1);
        setScore((value) => clamp(value + 7));
        setMetrics((current) => ({ ...current, power: clamp(current.power - 2) }));
        setAiMessage("Experiment completed. A field observation has been converted into a research result.");
        break;
      case "nav-calibrate":
        setScore((value) => clamp(value + 3));
        conditionBoost(1);
        setAiMessage("Navigation solution recalibrated. Vehicle route confidence improved.");
        break;
      case "route":
        setScore((value) => clamp(value + 2));
        setAiMessage("Colony route planner recalculated the safest travel corridors around the current work sites.");
        break;
      case "survey": {
        const nodes = RESOURCE_NODES[pending.campaign === "mars" ? "MARS" : "MOON"];
        const nextNode = nodes.find((node) => !surveyedNodes.includes(node.id)) ?? nodes[0];
        if (nextNode) {
          setRoverTask("SURVEYING " + nextNode.label);
          setScore((value) => clamp(value + 2));
          setAiMessage("Rover dispatched to " + nextNode.label + ". It is following the marked road network to the field site.");
        }
        break;
      }
      case "return":
        setRoverTask("RETURNING");
        setAiMessage("Rover recall issued. It is returning along the colony road network to the launch lane.");
        break;
      case "inspect":
        setScore((value) => clamp(value + 1));
        setAiMessage(`Inspection complete — ${trackId.toUpperCase()} is operating at ${Math.round(buildings[trackId]?.condition ?? 100)}% condition.`);
        break;
      case "extract-test":
        setResourceYield((value) => value + 4);
        setMetrics((current) => ({ ...current, power: clamp(current.power - 4), battery: clamp(current.battery - 1) }));
        conditionBoost(-1);
        setScore((value) => clamp(value + 5));
        setAiMessage("Short drill test complete. A usable resource signature was confirmed at the surveyed deposit.");
        break;
      case "extract":
        setResourceYield((value) => value + 5);
        setMetrics((current) => ({ ...current, power: clamp(current.power - 5), battery: clamp(current.battery - 2) }));
        setScore((value) => clamp(value + 7));
        setAiMessage("Extraction sample collected. Resource yield increased, but the operation consumed colony power.");
        break;
      case "process":
        setResourceYield((value) => value + 3);
        setMetrics((current) => ({ ...current, power: clamp(current.power - 5), battery: clamp(current.battery - 1) }));
        setScore((value) => clamp(value + 5));
        setAiMessage("ISRU feed processed. Local material was converted into a useful colony stockpile.");
        break;
      case "purge":
        conditionBoost(2);
        setMetrics((current) => ({ ...current, power: clamp(current.power - 1) }));
        setAiMessage("ISRU feed line purged. Pressure margin and process stability improved.");
        break;
      case "tune-crops":
        setMetrics((current) => ({ ...current, food: clamp(current.food + 5), water: clamp(current.water - 2), power: clamp(current.power - 2) }));
        conditionBoost(1);
        setAiMessage("Controlled crop environment tuned. Food production increased with a modest water and power cost.");
        break;
      case "harvest":
        setMetrics((current) => ({ ...current, food: clamp(current.food + 7), water: clamp(current.water - 2) }));
        setResourceYield((value) => value + 1);
        setScore((value) => clamp(value + 3));
        setAiMessage("Harvest cycle complete. Fresh food output has been added to the colony reserve.");
        break;
      case "service":
        {
          const candidates = Object.entries(buildings).sort(([, a], [, b]) => a.condition - b.condition);
          const target = candidates[0]?.[0];
          if (target) {
            const next = clamp(buildings[target].condition + 10);
            setBuildings((current) => ({ ...current, [target]: { ...current[target], condition: next, status: buildingStatus(next) } }));
            setAiMessage(`Maintenance service complete. ${target.toUpperCase()} received preventative service.`);
          }
        }
        break;
      case "diagnostics":
        setScore((value) => clamp(value + 3));
        setAiMessage("Predictive diagnostic sweep complete. No immediate critical failure is present.");
        break;
      default:
        setAiMessage(`Inspection complete — ${trackId.toUpperCase()} is operating at ${Math.round(buildings[trackId]?.condition ?? 100)}% condition.`);
        break;
    }
  };

  const askMissionAi = () => {
    const weakest = [
      { label: "battery reserve", value: metrics.battery },
      { label: "oxygen reserve", value: metrics.oxygen },
      { label: "water reserve", value: metrics.water },
      { label: "food reserve", value: metrics.food },
      { label: "habitat integrity", value: metrics.habitat },
    ].sort((a, b) => a.value - b.value)[0];

    if (weakest.value < 45) {
      setAiMessage(`Mission AI diagnosis: your current weakest area is ${weakest.label} at ${Math.round(weakest.value)}%. Prioritise that system before taking another optional risk.`);
    } else if (metrics.power < 55) {
      setAiMessage("Mission AI diagnosis: power generation is your current limiting factor. Reduce non-critical loads and protect battery reserve.");
    } else if (Math.abs(metrics.temperature - 21) > 2.5) {
      setAiMessage("Mission AI diagnosis: thermal conditions are drifting. Restoring the preferred temperature band will reduce long-term system stress.");
    } else {
      setAiMessage(`Mission AI diagnosis: colony state is stable. Your current score is ${Math.round(score)}/100. Keep monitoring the next event rather than overreacting to small fluctuations.`);
    }
  };

  const performance = useMemo(() => {
    const tempScore = clamp(100 - Math.abs(metrics.temperature - 21) * 18);
    const radiationScore = clamp(100 - metrics.radiation * 3.4);
    const colonyHealth = Math.round((metrics.power + metrics.battery + metrics.oxygen + metrics.water + metrics.food + metrics.habitat + tempScore + radiationScore) / 8);
    const decisionQuality = clamp(score);
    const researchOpportunity = pending?.selected.science !== undefined || decisions.some((decision) => decision.eventId === "science-anomaly");
    return { colonyHealth, decisionQuality, researchOpportunity, radiationScore };
  }, [decisions, metrics, pending, score]);

  if (!pending) {
    return (
      <div className="min-h-screen bg-[#050b10] p-8 text-[#e9f0e5]">
        <div className="mx-auto max-w-2xl border border-[#70483e] bg-[#1b1315] p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#d77a5a]">Mission runtime unavailable</p>
          <h1 className="mt-3 text-2xl font-semibold uppercase tracking-[0.12em]">No active mission deployment</h1>
          <p className="mt-3 text-sm leading-6 text-[#9aaba5]">Return to the campaign map and deploy a mission from the loadout screen.</p>
          <a href="/preview/CampaignMapRefresh" className="mt-6 inline-flex bg-[#efb658] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#171e1b]">Return to campaign map</a>
        </div>
      </div>
    );
  }

  if (results) {
    const checks: [string, boolean][] = [
      ["SURVIVAL", true],
      ["POWER STABILITY", performance.colonyHealth >= 55],
      ["LIFE SUPPORT", Math.min(metrics.oxygen, metrics.water) >= 55],
      ["CREW SAFETY", performance.radiationScore >= 55],
      ["HABITAT INTEGRITY", metrics.habitat >= 75],
      ["RESOURCE MANAGEMENT", Math.min(metrics.food, metrics.water) >= 55],
      ["RESEARCH OPPORTUNITY", performance.researchOpportunity],
    ];

    return (
      <div className="min-h-screen bg-[#050b10] px-5 py-8 text-[#e9f0e5]">
        <div className="mx-auto max-w-6xl border border-[#3c5e59] bg-[#08151b] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="border-b border-[#304b4b] bg-[#0d252a] px-6 py-5">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8fc9a0]">Mission complete</p>
            <h1 className="mt-2 text-3xl font-semibold uppercase tracking-[0.13em] text-[#f1f4e8]">{pending.missionTitle}</h1>
            <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[#708b88]">14 simulated days survived · {pending.replay ? "Replay operation" : "First deployment"}</p>
          </div>
          <div className="grid gap-5 p-6 lg:grid-cols-[1fr_360px]">
            <section className="space-y-3">
              {checks.map(([label, complete]) => (
                <div key={label} className="flex items-center justify-between border border-[#29434a] bg-[#0d2027] px-4 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c7d5cc]">{label}</span>
                  {complete ? (
                    <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8fc9a0]"><Check className="h-4 w-4" /> Complete</span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d77a5a]">Degraded</span>
                  )}
                </div>
              ))}
              <div className="grid gap-3 pt-3 sm:grid-cols-3">
                <div className="border border-[#344e4d] bg-[#102329] p-4"><p className="text-[8px] uppercase tracking-[0.2em] text-[#748e8b]">Colony health</p><p className="mt-1 text-2xl font-mono text-[#dfe9d9]">{performance.colonyHealth}%</p></div>
                <div className="border border-[#344e4d] bg-[#102329] p-4"><p className="text-[8px] uppercase tracking-[0.2em] text-[#748e8b]">Decision quality</p><p className="mt-1 text-2xl font-mono text-[#efb658]">{Math.round(performance.decisionQuality)}%</p></div>
                <div className="border border-[#344e4d] bg-[#102329] p-4"><p className="text-[8px] uppercase tracking-[0.2em] text-[#748e8b]">Runtime score</p><p className="mt-1 text-2xl font-mono text-[#9fce82]">{Math.round(score)}</p></div>
              </div>
            </section>
            <aside className="space-y-4">
              <div className="border border-[#46595a] bg-[#101f25] p-5">
                <div className="flex items-center gap-2 text-[#efb658]"><Sparkles className="h-4 w-4" /><p className="text-[9px] font-bold uppercase tracking-[0.22em]">Mission AI analysis</p></div>
                <p className="mt-3 text-sm leading-6 text-[#c8d7cf]">{getAiAnalysis(metrics, score)}</p>
                <p className="mt-3 text-[9px] uppercase tracking-[0.13em] text-[#788f8c]">Generated from your resource levels, equipment condition, and decisions.</p>
              </div>
              <div className="border border-[#6b5734] bg-[#1b1d18] p-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#efb658]">Rewards</p>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-[#9baaa3]">Credits</span><span className="font-mono text-[#efb658]">+{pending.rewardCredits.toFixed(pending.rewardCredits % 1 === 0 ? 0 : 1)}M</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#9baaa3]">XP</span><span className="font-mono text-[#b4d0b6]">+{pending.rewardXp.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#9baaa3]">Research Tokens</span><span className="font-mono text-[#d4dfb7]">+{pending.rewardResearchTokens}</span></div>
                </div>
              </div>
              <a href={`/preview/CampaignMapRefresh?campaign=${pending.campaign}`} className="flex w-full items-center justify-center gap-2 bg-[#efb658] px-5 py-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[#17201b]">
                <Check className="h-4 w-4" /> Continue
              </a>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 h-[100dvh] w-full overflow-hidden bg-[#05040a] text-white">
      <main className="relative h-full w-full overflow-hidden">
        <IsometricMap
          tracks={selectedTracks}
          selected={pending.selected}
          buildings={buildings}
          onSelect={(trackId) => {
            setSelectedResourceId(null);
            setSelectedBuildingId(trackId);
          }}
          selectedBuildingId={selectedBuildingId}
          elapsed={elapsed}
          environmentLabel={environmentLabel}
          environmentTitle={environmentTitle}
          activeEventTrackId={activeTargetTrackId}
          selectedResourceId={selectedResourceId}
          surveyedNodes={surveyedNodes}
          onSelectResource={(node) => {
            setSelectedResourceId(node.id);
            setSelectedBuildingId(null);
          }}
          roverTask={roverTask}
        />

        <div className="pointer-events-none absolute left-3 bottom-3 z-20 w-[min(86vw,390px)]">
          <div className="rounded-2xl border border-[#3d555b] bg-[#0b1519]/[0.90] px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.42)] backdrop-blur-sm">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#e8bd56]/[0.16] text-[#f2cd67]">
                <Zap className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#d6e0dd]">Mission feed</p>
                <p className="mt-0.5 text-[10px] leading-4 text-[#94aaa9]">{aiMessage}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto absolute right-3 bottom-3 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setManualPaused((value) => !value)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#40565b] bg-[#0b1519]/[0.92] text-[#e8eeee] shadow-[0_8px_25px_rgba(0,0,0,0.38)] backdrop-blur-sm hover:border-[#f0ca63]"
            aria-label={manualPaused ? "Resume mission" : "Pause mission"}
            title={manualPaused ? "Resume" : "Pause"}
          >
            {manualPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          {[1, 2, 4].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSpeed(value)}
              className={`rounded-xl border px-2.5 py-2 text-[8px] font-black tracking-[0.1em] shadow-[0_8px_25px_rgba(0,0,0,0.38)] backdrop-blur-sm ${speed === value ? "border-[#f0ca63] bg-[#e1b952] text-[#1e211c]" : "border-[#40565b] bg-[#0b1519]/[0.92] text-[#aab8b9] hover:border-[#f0ca63]"}`}
              aria-label={`Set mission speed to ${value}x`}
            >
              {value}×
            </button>
          ))}
        </div>

        <MissionTaskRibbon
          pending={pending}
          elapsed={elapsed}
          resolvedEvents={resolvedEventIds}
          surveyedNodes={surveyedNodes}
          activeEvent={activeEvent}
          roverTask={roverTask}
        />

        {selectedResource && !activeEvent && (
          <ResourceInspector
            node={selectedResource}
            surveyed={surveyedNodes.includes(selectedResource.id)}
            hasRover={pending.selected.rover !== undefined}
            hasExtraction={pending.selected.extraction !== undefined || pending.selected.isru !== undefined}
            onAction={(action) => handleResourceAction(selectedResource.id, action)}
            onClose={() => setSelectedResourceId(null)}
          />
        )}

        {selectedTrack && selectedTier && !selectedResource && (!activeEvent || selectedBuildingId === activeTargetTrackId) && (
          <BuildingInspector
            track={selectedTrack}
            tier={selectedTier}
            runtime={buildings[selectedTrack.id] ?? { condition: 100, dust: 0, status: "ONLINE", upgradeLevel: 0 }}
            onAction={(action) => handleBuildingAction(selectedTrack.id, action)}
            onClose={() => setSelectedBuildingId(null)}
            hasMaintenance={pending.selected.maintenance !== undefined}
            actionBusy={actionBusy}
            activeEvent={activeEvent && selectedBuildingId === activeTargetTrackId ? activeEvent : null}
            eventChoices={activeEvent && selectedBuildingId === activeTargetTrackId ? getEventChoices(activeEvent, pending.selected) : []}
            onEventChoice={handleEventChoice}
            power={metrics.power}
            battery={metrics.battery}
          />
        )}

        {activeEvent && (
          <div className="pointer-events-none absolute right-3 top-3 z-40 flex justify-end px-0">
            <div className="pointer-events-auto max-h-[55vh] w-[min(92vw,400px)] overflow-y-auto rounded-2xl border-2 border-[#ff5367] bg-[#120f16]/[0.96] shadow-[0_14px_40px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between gap-3 bg-[#2a1620] px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ff7180]">⚠ DISASTER · {activeEvent.title}</p>
                  <p className="mt-1 text-[8px] uppercase tracking-[0.1em] text-[#e5bd64]">Situation report · {activeEvent.trackId}</p>
                </div>
                <span className="shrink-0 rounded-full border border-[#ff5367]/50 px-2 py-1 text-[7px] font-black uppercase tracking-[0.14em] text-[#ffb39d]">Active</span>
              </div>
              <div className="space-y-3 p-3">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#ff9aa3]">What is happening</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#e4d6da]">{activeEvent.subtitle}</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#bfaeb5]">{activeEvent.summary}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#f1cd75]">Possible responses</p>
                  <div className="mt-1.5 space-y-2">
                    {getEventChoices(activeEvent, pending.selected).map((choice, index) => (
                      <div key={choice.id} className="border-l-2 border-[#76505b] pl-2.5">
                        <p className="text-[9px] font-bold text-white">{index + 1}. {choice.label}</p>
                        <p className="mt-0.5 text-[8px] leading-3.5 text-[#bca9b3]">{choice.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-[#78424b] bg-[#281820] px-2.5 py-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#ffb0b7]">Your next step</p>
                  <p className="mt-1 text-[9px] leading-4 text-[#e1c6cb]">Click the red-ringed building. Its information panel will give you the response options. No response is chosen for you.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default MissionSimulation;
