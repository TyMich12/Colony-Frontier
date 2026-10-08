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
      { condition: 100, dust: 0, status: "ONLINE" },
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
}: {
  track: TechnologyTrack;
  tier: Tier;
  runtime: BuildingRuntime;
  onAction: (action: string) => void;
  onClose: () => void;
  hasMaintenance: boolean;
}) {
  const actionMap: Record<string, EventChoice[]> = {
    solar: [{ id: "clean", label: "Clean", detail: "Reduce solar dust." }, { id: "inspect", label: "Inspect", detail: "Check condition." }],
    habitat: [{ id: "repair", label: "Repair", detail: hasMaintenance ? "Use maintenance for a stronger repair." : "Repair the habitat seal." }, { id: "inspect", label: "Inspect", detail: "Check structure." }],
    battery: [{ id: "balance", label: "Balance", detail: "Rebalance storage." }, { id: "inspect", label: "Inspect", detail: "Check storage." }],
    rover: [{ id: "survey", label: "Survey", detail: "Send the rover to a site." }, { id: "return", label: "Return", detail: "Call it back to base." }, { id: "inspect", label: "Inspect", detail: "Check wheels and payload." }],
    water: [{ id: "flush", label: "Flush", detail: "Restore filtration." }, { id: "inspect", label: "Inspect", detail: "Check recovery." }],
    oxygen: [{ id: "reset", label: "Reset", detail: "Reset processing." }, { id: "inspect", label: "Inspect", detail: "Check flow." }],
    maintenance: [{ id: "service", label: "Service", detail: "Service the weakest system." }, { id: "inspect", label: "Inspect", detail: "Scan the colony." }],
  };
  const actions = actionMap[track.id] ?? [{ id: "inspect", label: "Inspect", detail: "Check this system." }];
  const Icon = categoryIcons[track.category as keyof typeof categoryIcons] ?? Factory;

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-30 w-[min(92vw,360px)]">
      <div className="pointer-events-auto overflow-hidden rounded-2xl border-2 border-[#eecb61] bg-[#141c22]/96 shadow-[0_12px_35px_rgba(0,0,0,0.52)]">
        <div className="flex items-center gap-2 border-b border-[#405158] bg-[#23333b] px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#10181d]"><Icon className="h-4 w-4" style={{ color: tierMeta[tier].color }} /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[8px] font-black uppercase tracking-[0.12em] text-white">{track.tiers[tier].name}</p>
            <p className="truncate text-[7px] uppercase tracking-[0.1em]" style={{ color: tierMeta[tier].color }}>{track.category} · {tier}</p>
          </div>
          <span className="font-mono text-xs font-black" style={{ color: resourceColor(runtime.condition) }}>{Math.round(runtime.condition)}%</span>
          <button type="button" onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-md text-sm text-[#9fb0b5] hover:bg-[#344a52] hover:text-white" aria-label="Close inspector">×</button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-2">
          {actions.map((action, index) => (
            <button key={action.id} type="button" onClick={() => onAction(action.id)} className="rounded-xl border border-[#3f5860] bg-[#1c3038] px-2.5 py-2 text-left hover:border-[#f3cf63] hover:bg-[#29434c]">
              <span className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#0c171d] text-[7px] font-black text-[#f4d16a]">{index + 1}</span>
                <span className="truncate text-[8px] font-black uppercase tracking-[0.08em] text-white">{action.label}</span>
              </span>
              <span className="mt-1 block truncate text-[7px] text-[#8da1a6]">{action.detail}</span>
            </button>
          ))}
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
    <div className="pointer-events-none absolute bottom-3 left-3 z-30 w-[min(92vw,330px)]">
      <div className="pointer-events-auto overflow-hidden rounded-2xl border-2 border-[#d8ad5c] bg-[#17231d]/96 shadow-[0_12px_35px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2 bg-[#28402e] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[8px] font-black uppercase tracking-[0.15em] text-[#f2d27a]">{node.label}</p>
            <p className="mt-0.5 text-[7px] uppercase tracking-[0.1em] text-[#9fb8a6]">{node.kind} · {surveyed ? "SURVEYED" : "UNSURVEYED"}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-md text-sm text-[#9bb0a1] hover:bg-[#3c5842] hover:text-white" aria-label="Close resource inspector">×</button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-2">
          <button type="button" onClick={() => onAction("survey")} className="rounded-xl border border-[#4e6d57] bg-[#1b3625] px-2.5 py-2 text-left hover:border-[#f0cf68]">
            <span className="block text-[8px] font-black uppercase tracking-[0.08em] text-white">{surveyed ? "Resurvey" : "Survey"}</span>
            <span className="mt-1 block truncate text-[7px] text-[#91ab98]">{hasRover ? "Send rover." : "Use sensors."}</span>
          </button>
          <button type="button" disabled={!surveyed} onClick={() => onAction("sample")} className="rounded-xl border border-[#4e6d57] bg-[#1b3625] px-2.5 py-2 text-left disabled:opacity-40 hover:border-[#f0cf68]">
            <span className="block text-[8px] font-black uppercase tracking-[0.08em] text-white">Sample</span>
            <span className="mt-1 block truncate text-[7px] text-[#91ab98]">Collect a result.</span>
          </button>
          {hasExtraction && surveyed && (
            <button type="button" onClick={() => onAction("extract")} className="col-span-2 rounded-xl border border-[#806640] bg-[#332a1c] px-2.5 py-2 text-left hover:border-[#f0cf68]">
              <span className="block text-[8px] font-black uppercase tracking-[0.08em] text-[#ffe7b0]">Test extraction point</span>
              <span className="mt-1 block truncate text-[7px] text-[#b69f79]">Spend power for a small resource yield.</span>
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
        const powerBase = 74 + solarTier * 7 - solarDust * 0.34 - optionalCount * 1.8 + (pending.selected.grid ? tierLevel(pending.selected.grid) * 3 : 0);
        const demandPenalty = Math.max(0, 68 - powerBase);
        const batteryDelta = (powerBase > 72 ? 0.012 : -0.042 - demandPenalty * 0.001) + batteryTier * 0.008;
        const temperaturePull = (21 - current.temperature) * (0.01 + thermalTier * 0.004);

        return {
          power: clamp(powerBase),
          battery: clamp(current.battery + batteryDelta * speed),
          oxygen: clamp(current.oxygen - (0.0085 - oxygenTier * 0.0018) * speed),
          water: clamp(current.water - (0.0075 - waterTier * 0.0016) * speed),
          food: clamp(current.food - (0.0065 - (pending.selected.agriculture ? tierLevel(pending.selected.agriculture) * 0.0016 : 0)) * speed),
          temperature: clamp(current.temperature + temperaturePull * speed, 16, 28),
          radiation: clamp(current.radiation + 0.0005 * speed),
          habitat: clamp(current.habitat - 0.0012 * speed),
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
            condition: clamp(state.condition - Math.max(0.0004, wear - level * 0.00025) * speed),
            status: buildingStatus(state.condition),
            dust: trackId === "solar" ? clamp(state.dust + (0.012 - level * 0.0015) * speed) : state.dust,
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
    if (!pending?.selected[trackId]) return;
    setManualActions((value) => value + 1);

    if (action === "clean" && trackId === "solar") {
      setBuildings((current) => ({ ...current, solar: { ...(current.solar ?? { condition: 100, dust: 0, status: "ONLINE" }), dust: clamp((current.solar?.dust ?? 0) - (pending.selected.rover ? 24 : 16)) } }));
      setMetrics((current) => ({ ...current, power: clamp(current.power + 4) }));
      setAiMessage(pending.selected.rover ? "Manual command accepted. Rover-assisted cleaning would recover more output." : "Solar surface cleaned. Power margin improved slightly.");
      return;
    }

    if (action === "repair" && trackId === "habitat") {
      const amount = pending.selected.maintenance ? 28 : 14;
      setBuildings((current) => ({ ...current, habitat: { ...(current.habitat ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.habitat?.condition ?? 100) + amount), status: buildingStatus(clamp((current.habitat?.condition ?? 100) + amount)) } }));
      setMetrics((current) => ({ ...current, habitat: clamp(current.habitat + 5), battery: clamp(current.battery - 2) }));
      setAiMessage(pending.selected.maintenance ? "Maintenance capability accelerated the habitat repair and restored extra structural margin." : "Basic habitat repair completed. The structure is stable again.");
      return;
    }

    if (action === "balance" && trackId === "battery") {
      setMetrics((current) => ({ ...current, battery: clamp(current.battery + 5), power: clamp(current.power + 2) }));
      setAiMessage("Battery discharge was balanced against current colony demand.");
      return;
    }

    if (trackId === "rover" && action === "survey") {
      const nodes = RESOURCE_NODES[pending?.campaign === "mars" ? "MARS" : "MOON"];
      const nextNode = nodes.find((node) => !surveyedNodes.includes(node.id)) ?? nodes[0];
      setRoverTask(nextNode ? "SURVEYING " + nextNode.label : "SURVEYING");
      setScore((value) => clamp(value + 2));
      setAiMessage(nextNode ? "Rover dispatched to " + nextNode.label + ". It will travel there, scan the site, and return." : "Rover mission started. The rover is surveying nearby terrain.");
      return;
    }

    if (trackId === "rover" && action === "return") {
      setRoverTask("RETURNING");
      setAiMessage("Rover recall issued. It is returning to the habitat.");
      return;
    }

    if (action === "flush" && trackId === "water") {
      setMetrics((current) => ({ ...current, water: clamp(current.water + 4), power: clamp(current.power - 2) }));
      setAiMessage("Water loop flushed. Recovery performance has improved.");
      return;
    }

    if (action === "reset" && trackId === "oxygen") {
      setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + 3), power: clamp(current.power - 2) }));
      setAiMessage("Atmospheric processing loop reset completed.");
      return;
    }

    if (action === "service" && trackId === "maintenance") {
      const candidates = Object.entries(buildings).sort(([, a], [, b]) => a.condition - b.condition);
      const target = candidates[0]?.[0];
      if (target) {
        setBuildings((current) => ({ ...current, [target]: { ...current[target], condition: clamp(current[target].condition + 10), status: buildingStatus(clamp(current[target].condition + 10)) } }));
        setAiMessage(`Maintenance scan complete. ${target.toUpperCase()} received preventative service.`);
      }
      return;
    }

    const track = technologyTracks.find((item) => item.id === trackId);
    setAiMessage(`INSPECTION COMPLETE — ${track?.category ?? trackId} is operating at ${Math.round(buildings[trackId]?.condition ?? 100)}% condition.`);
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

        {selectedTrack && selectedTier && !activeEvent && !selectedResource && (
          <BuildingInspector
            track={selectedTrack}
            tier={selectedTier}
            runtime={buildings[selectedTrack.id] ?? { condition: 100, dust: 0, status: "ONLINE" }}
            onAction={(action) => handleBuildingAction(selectedTrack.id, action)}
            onClose={() => setSelectedBuildingId(null)}
            hasMaintenance={pending.selected.maintenance !== undefined}
          />
        )}

        {activeEvent && (
          <div className="pointer-events-none absolute right-3 top-3 z-40 flex justify-end px-0">
            <div className="pointer-events-auto w-[min(92vw,400px)] overflow-hidden rounded-2xl border-2 border-[#ff5367] bg-[#120f16]/95 shadow-[0_14px_40px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between gap-3 bg-[#2a1620] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-[#ff7180]">⚠ {activeEvent.title}</p>
                  <p className="truncate text-[7px] uppercase tracking-[0.1em] text-[#e5bd64]">Tap the flashing building, then choose your response</p>
                </div>
                <span className="shrink-0 text-[7px] font-black uppercase tracking-[0.14em] text-[#ffb39d]">{activeEvent.trackId}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-2">
                {getEventChoices(activeEvent, pending.selected).map((choice, index) => (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={selectedBuildingId !== activeTargetTrackId}
                    onClick={() => handleEventChoice(choice.id)}
                    className="min-w-0 rounded-xl border border-[#60404c] bg-[#241922] px-2.5 py-2 text-left hover:border-[#f6cd63] hover:bg-[#31202c] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#ff5367]/20 text-[8px] font-black text-[#ffd96d]">{index + 1}</span>
                      <span className="truncate text-[8px] font-black uppercase tracking-[0.08em] text-white">{choice.label}</span>
                    </span>
                    <span className="mt-1 block line-clamp-2 text-[7px] leading-3 text-[#bca9b3]">{choice.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default MissionSimulation;
