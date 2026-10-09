import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Car,
  Clock,
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
  type ActiveFault,
  type MissionMetrics,
  type MissionOperation,
  type PendingMission,
  type SampleStage,
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
  { id: "co2-scrubber-loading", trackId: "co2", title: "CO₂ scrubber bed loading", subtitle: "The cabin scrubber is losing removal margin as the filter bed loads.", summary: "The air system remains within its safe operating range, but the CO₂ scrubber needs a purge or recovery cycle before cabin air quality margin narrows." },
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

function eventTargetIsDeployed(event: MissionEvent, selected: Record<string, Tier>): boolean {
  // A power event uses the grid only when it was deployed; otherwise it targets the always-required battery.
  const targetId = event.trackId === "power"
    ? (selected.grid ? "grid" : selected.battery ? "battery" : selected.solar ? "solar" : null)
    : event.trackId;
  return Boolean(targetId && isTier(selected[targetId]));
}

function pickNextEvent(
  environmentLabel: "MOON" | "MARS",
  selected: Record<string, Tier>,
  resolvedEventIds: string[],
  scheduleIndex: number,
  metrics: MissionMetrics,
): MissionEvent {
  const available = EVENT_DEFS.filter((event) => eventTargetIsDeployed(event, selected));
  const unresolved = available.filter((event) => !resolvedEventIds.includes(event.id));
  const has = (eventId: string) => {
    const event = available.find((candidate) => candidate.id === eventId);
    return event ?? null;
  };

  // Scripted moments are preferred, but only when their actual target exists in this loadout.
  if (scheduleIndex === 0) {
    const dustEvent = has("solar-dust");
    if (dustEvent) return dustEvent;
  }

  const environmentEventId =
    scheduleIndex === 1
      ? environmentLabel === "MOON" ? "micrometeoroid-impact" : "regional-dust-front"
      : scheduleIndex === 3
        ? environmentLabel === "MOON" ? "polar-shadow-cold-soak" : "mars-comm-relay-loss"
        : null;

  if (environmentEventId && !resolvedEventIds.includes(environmentEventId)) {
    const environmentEvent = has(environmentEventId);
    if (environmentEvent) return environmentEvent;
  }

  // Prefer incidents on optional modules that the player actually packed.
  const optionalIds = Object.keys(selected).filter((id) => !starterCategories.has(id) && isTier(selected[id]));
  const optionalEvents = unresolved.filter((event) => optionalIds.includes(event.trackId));
  if (scheduleIndex % 2 === 1 && optionalEvents.length > 0) {
    return optionalEvents[Math.floor((scheduleIndex - 1) / 2) % optionalEvents.length];
  }

  const candidates = [
    { value: metrics.battery, eventId: "battery-thermal" },
    { value: metrics.oxygen, eventId: "oxygen-filter" },
    { value: metrics.water, eventId: "water-filter" },
    { value: metrics.habitat, eventId: "habitat-pressure" },
    { value: Math.max(0, 100 - Math.abs(metrics.temperature - 21) * 8), eventId: selected.thermal ? "thermal-drift" : "battery-thermal" },
    { value: metrics.power, eventId: selected.grid ? "grid-overload" : "core-power" },
  ].flatMap((candidate) => {
    const event = has(candidate.eventId);
    return event ? [{ ...candidate, event }] : [];
  });

  const weakest = candidates.sort((a, b) => a.value - b.value)[0];
  if (weakest) return weakest.event;

  // Final safety net: choose any deployed system event; never strand the player at an unbuilt facility.
  return unresolved[0] ?? available[0] ?? EVENT_DEFS.find((event) => event.trackId === "battery")!;
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
    "co2-scrubber-loading": [
      { id: "scrub", label: "Purge the scrubber bed", detail: "Run the regeneration cycle and restore CO₂ removal margin." },
      { id: "recover", label: "Recover carbon compounds", detail: "Use the recovery stage for a slower cycle that preserves useful carbon feedstock." },
      { id: "ignore", label: "Continue with reduced margin", detail: "Save power for now, but accept lower air-quality margin until the next cycle." },
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
  sampleStages,
  activeEvent,
  roverTask,
}: {
  pending: PendingMission;
  elapsed: number;
  resolvedEvents: string[];
  sampleStages: Record<string, SampleStage>;
  activeEvent: MissionEvent | null;
  roverTask: string;
}) {
  const day = Math.min(14, Math.floor(elapsed / 30) + 1);
  const eventGoal = EVENT_TIMES.length;
  const surveyedCount = Object.values(sampleStages).filter((stage) => stage !== "UNSURVEYED").length;
  const analysedCount = Object.values(sampleStages).filter((stage) => stage === "ANALYSED").length;
  const taskRows = [
    { label: "SURVIVE", value: `DAY ${day.toString().padStart(2, "0")} / 14`, done: elapsed >= TOTAL_MISSION_SECONDS },
    { label: "RESOLVE INCIDENTS", value: `${resolvedEvents.length} / ${eventGoal}`, done: resolvedEvents.length >= eventGoal },
    { label: "FIELD RESEARCH", value: `${analysedCount} ANALYSED`, done: analysedCount > 0 },
    { label: "SITES MAPPED", value: `${surveyedCount} / ${Math.max(1, RESOURCE_NODES[pending.campaign === "mars" ? "MARS" : "MOON"].length)}`, done: surveyedCount > 0 },
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
  node,
  stage,
  hasRover,
  hasExtraction,
  hasScience,
  operation,
  actionBusy,
  onAction,
  onClose,
}: {
  node: ResourceNode;
  stage: SampleStage;
  hasRover: boolean;
  hasExtraction: boolean;
  hasScience: boolean;
  operation: MissionOperation | null;
  actionBusy: boolean;
  onAction: (action: string) => void;
  onClose: () => void;
}) {
  const flow: { id: SampleStage; title: string; detail: string }[] = [
    { id: "UNSURVEYED", title: "1 · Survey & classify", detail: "Map the site, estimate terrain hazards, and record a baseline spectral signature." },
    { id: "SURVEYED", title: "2 · Collect & seal", detail: "Use a core tool or field sampler. Record coordinates and seal the sample to avoid contamination." },
    { id: "COLLECTED", title: "3 · Return the sample", detail: "Transport the labelled container to the habitat lab and preserve chain of custody." },
    { id: "DELIVERED", title: "4 · Analyse in the lab", detail: "Run mineral / ice-composition tests and record evidence, not just a visual guess." },
    { id: "ANALYSED", title: "5 · File the result", detail: "The analysis is stored in the mission record and contributes to research value." },
  ];
  const stageIndex = flow.findIndex((item) => item.id === stage);
  const isThisOperation = Boolean(operation && operation.targetId === node.id);
  const canStart = !operation && !actionBusy;
  const nextAction =
    stage === "UNSURVEYED" ? { id: "survey", label: hasRover ? "Start rover survey" : "Start remote survey", seconds: hasRover ? 12 : 22, detail: hasRover ? "Rover mapping + close-range instrument readings." : "Orbital / fixed-sensor scan; slower and lower confidence." } :
    stage === "SURVEYED" ? { id: "sample", label: hasExtraction ? "Collect core sample" : "Collect field sample", seconds: hasExtraction ? (hasRover ? 16 : 21) : (hasRover ? 24 : 30), detail: hasExtraction ? "Drill / sampler consumes energy; sealed core retained for analysis." : "Crew EVA sampler is slower and increases exposure." } :
    stage === "COLLECTED" ? { id: "transfer", label: hasRover ? "Return sample to lab" : "Carry sample to lab", seconds: hasRover ? 12 : 22, detail: hasRover ? "Rover transports the sealed sample along the site route." : "Crew transfer takes longer and adds EVA exposure." } :
    stage === "DELIVERED" ? { id: "analyze", label: hasScience ? "Run lab analysis" : "Run portable assay", seconds: hasScience ? 20 : 32, detail: hasScience ? "Spectrometry with the selected science system." : "Portable assay is slower and produces a lower-confidence result." } :
    null;
  const progress = isThisOperation && operation ? Math.round(100 * (1 - operation.remainingSeconds / operation.totalSeconds)) : 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex justify-center px-3 sm:bottom-5">
      <div className="pointer-events-auto max-h-[82vh] w-[min(94vw,540px)] overflow-y-auto rounded-[26px] border border-[#526e62] bg-[#0b1718]/[0.98] shadow-[0_24px_70px_rgba(0,0,0,0.68)] backdrop-blur-md">
        <div className="flex items-start gap-3 border-b border-[#304d46] bg-gradient-to-r from-[#1a332e] to-[#102126] px-5 py-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#527467] bg-[#0a1517]">
            <FlaskConical className="h-6 w-6 text-[#f0cf69]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#86bba3]">{node.kind} DEPOSIT · FIELD OPERATIONS</p>
            <h2 className="mt-1 text-lg font-black uppercase tracking-[0.06em] text-white">{node.label}</h2>
            <p className="mt-1 text-[11px] leading-4 text-[#a7bdb4]">{node.description}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#43584b] bg-[#0c1717] text-xl text-[#9bb0a0] hover:border-[#f0cf69] hover:text-white" aria-label="Close resource panel">×</button>
        </div>

        <div className="space-y-2 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#a9bbb3]">Sample chain of custody</p>
              <p className="mt-1 text-[10px] text-[#6f918b]">Each phase takes time; the next step unlocks only when the previous step finishes.</p>
            </div>
            <span className="shrink-0 rounded-full border border-[#547b68] bg-[#16372d] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#a7e1bc]">{stage === "ANALYSED" ? "COMPLETE" : `STEP ${Math.max(1, stageIndex + 1)} / 5`}</span>
          </div>

          {flow.map((item, index) => {
            const done = index < stageIndex;
            const current = item.id === stage;
            return (
              <div key={item.id} className={`flex gap-3 rounded-xl border p-3 ${done ? "border-[#315d4a] bg-[#122820]" : current ? "border-[#a18645] bg-[#272619]" : "border-[#243b3e] bg-[#101e21] opacity-65"}`}>
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${done ? "bg-[#7cc99a] text-[#0c2117]" : current ? "bg-[#e4bd59] text-[#201f16]" : "bg-[#26383b] text-[#78938d]"}`}>{done ? "✓" : index + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.07em] text-white">{item.title}</p>
                    <span className={`text-[8px] font-bold uppercase tracking-[0.1em] ${done ? "text-[#80d4a1]" : current ? "text-[#f0cf69]" : "text-[#637e7c]"}`}>{done ? "Complete" : current ? "Ready" : "Awaiting previous step"}</span>
                  </div>
                  <p className="mt-1 text-[9px] leading-4 text-[#93aaa4]">{item.detail}</p>
                </div>
              </div>
            );
          })}

          {isThisOperation && operation && (
            <div className="rounded-2xl border border-[#647d85] bg-[#13252c] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[#f0cf69]"><Clock className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-[0.1em]">{operation.label}</p></div>
                <p className="shrink-0 font-mono text-sm text-white">{Math.ceil(operation.remainingSeconds)}s</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#263b41]"><div className="h-full rounded-full bg-[#e5bf5d] transition-[width]" style={{ width: `${progress}%` }} /></div>
              <p className="mt-2 text-[9px] leading-4 text-[#96b2b5]">The simulation continues while this operation runs. A serious incident can interrupt the work and pause this timer until the crew responds.</p>
            </div>
          )}

          {nextAction && !isThisOperation && (
            <button type="button" disabled={!canStart} onClick={() => onAction(nextAction.id)} className="w-full rounded-2xl border border-[#8b7445] bg-[#dfb956] p-4 text-left text-[#172018] transition hover:bg-[#f0cf70] disabled:cursor-not-allowed disabled:opacity-40">
              <span className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.08em]">{nextAction.label}</span>
                <span className="shrink-0 rounded-full border border-[#554821]/40 bg-[#f7dc8d] px-2.5 py-1 font-mono text-[10px] font-bold">~{nextAction.seconds}s</span>
              </span>
              <span className="mt-1.5 block text-[10px] leading-4 text-[#3e4c37]">{nextAction.detail}</span>
              <span className="mt-2 flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.15em]"><Clock className="h-3 w-3" /> Start operation</span>
            </button>
          )}

          {stage === "ANALYSED" && (
            <div className="rounded-2xl border border-[#315d4a] bg-[#122820] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8fe0ad]">Sample analysed and logged</p>
              <p className="mt-1 text-[10px] leading-4 text-[#b7cec0]">Field data is stored in the mission record. Analyse other sites to build a broader resource map.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#263f3e] pt-3 text-[9px]">
            <span className="text-[#7e9a92]">Rover: {hasRover ? "available" : "not deployed"} · Drill: {hasExtraction ? "available" : "field sampler only"} · Science lab: {hasScience ? "available" : "portable assay"}</span>
            {actionBusy && <span className="font-bold uppercase tracking-[0.12em] text-[#e9c65e]">Operation running</span>}
          </div>
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
  const [surveyedNodes, setSurveyedNodes] = useState<string[]>(() => runtime?.surveyedNodes ?? []);
  const [sampleStages, setSampleStages] = useState<Record<string, SampleStage>>(() => runtime?.sampleStages ?? Object.fromEntries((runtime?.surveyedNodes ?? []).map((id) => [id, "SURVEYED" as SampleStage])));
  const [resourceYield, setResourceYield] = useState(runtime?.resourceYield ?? 0);
  const [activeOperation, setActiveOperation] = useState<MissionOperation | null>(() => runtime?.activeOperation ?? null);
  const [operationResult, setOperationResult] = useState<string | null>(() => runtime?.operationResult ?? null);
  const [activeFaults, setActiveFaults] = useState<Record<string, ActiveFault>>(() => runtime?.activeFaults ?? {});
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const operationCompletionRef = useRef<string | null>(null);
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
  const activeEventCandidate = activeEventId ? EVENT_DEFS.find((event) => event.id === activeEventId) ?? null : null;
  const storedEventIsInvalid = Boolean(
    activeEventId && pending && (!activeEventCandidate || !eventTargetIsDeployed(activeEventCandidate, pending.selected)),
  );
  const activeEvent = activeEventCandidate && pending && eventTargetIsDeployed(activeEventCandidate, pending.selected)
    ? activeEventCandidate
    : null;
  const activeTargetTrackId = activeEvent?.trackId === "power"
    ? (pending?.selected.grid ? "grid" : pending?.selected.battery ? "battery" : pending?.selected.solar ? "solar" : null)
    : activeEvent?.trackId ?? null;
  const selectedResource = selectedResourceId
    ? RESOURCE_NODES[pending?.campaign === "mars" ? "MARS" : "MOON"].find((node) => node.id === selectedResourceId)
    : undefined;
  const environmentLabel = pending?.campaign === "mars" ? "MARS" : "MOON";
  const environmentTitle = pending?.campaign === "mars" ? "Utopia Planitia" : "Mare Tranquillitatis";

  const finishOperation = useCallback((operation: MissionOperation) => {
    const node = RESOURCE_NODES[pending?.campaign === "mars" ? "MARS" : "MOON"].find((item) => item.id === operation.targetId);
    let message = "";

    switch (operation.kind) {
      case "SURVEY":
        if (node) {
          setSampleStages((current) => ({ ...current, [node.id]: "SURVEYED" }));
          setSurveyedNodes((current) => current.includes(node.id) ? current : [...current, node.id]);
          message = `SURVEY COMPLETE · ${node.label}. Terrain and spectral signatures are mapped. Next: collect a sealed physical sample from the marked location.`;
          setRoverTask("SURVEY COMPLETE");
          setScore((value) => clamp(value + (pending?.selected.rover ? 5 : 3)));
        }
        break;
      case "COLLECT":
        if (node) {
          setSampleStages((current) => ({ ...current, [node.id]: "COLLECTED" }));
          message = `SAMPLE SECURED · ${node.label}. The core is bagged and labelled with site coordinates and collection time. Next: transfer it to the analysis bench.`;
          setRoverTask("SAMPLE SECURED");
          setScore((value) => clamp(value + 4));
        }
        break;
      case "TRANSFER":
        if (node) {
          setSampleStages((current) => ({ ...current, [node.id]: "DELIVERED" }));
          message = `CHAIN OF CUSTODY COMPLETE · ${node.label} arrived in the lab. The sample is ready for mineralogical / compositional analysis.`;
          setRoverTask("SAMPLE DELIVERED");
          setScore((value) => clamp(value + 4));
        }
        break;
      case "ANALYZE":
        if (node) {
          setSampleStages((current) => ({ ...current, [node.id]: "ANALYSED" }));
          setResourceYield((value) => value + 1);
          const scienceBonus = pending?.selected.science ? tierLevel(pending.selected.science) * 2 : 0;
          setScore((value) => clamp(value + 9 + scienceBonus));
          message = `ANALYSIS COMPLETE · ${node.label}. The lab recorded a usable field result. Research value: +${1 + scienceBonus} units. Your mission report now includes the result.`;
          setRoverTask("ANALYSIS COMPLETE");
        }
        break;
      case "UPGRADE": {
        const track = technologyTracks.find((item) => item.id === operation.targetId);
        const level = operation.targetLevel ?? 1;
        setBuildings((current) => {
          const previous = current[operation.targetId] ?? { condition: 100, dust: 0, status: "ONLINE", upgradeLevel: 0 };
          const upgradeLevel = Math.max(previous.upgradeLevel ?? 0, level);
          const condition = clamp(previous.condition + 5);
          return { ...current, [operation.targetId]: { ...previous, upgradeLevel, condition, status: buildingStatus(condition) } };
        });
        setScore((value) => clamp(value + 4));
        message = `RETROFIT COMPLETE · ${track?.category ?? operation.targetId} now has field-upgrade level ${level}/2. The new hardware kit is online and its output / wear model has improved.`;
        break;
      }
    }

    if (message) {
      setOperationResult(message);
      setAiMessage(message);
    }
    setActionBusy(false);
    setActiveOperation(null);
  }, [pending]);

  useEffect(() => {
    if (!storedEventIsInvalid) return;
    setActiveEventId(null);
    setAiMessage("A saved incident targeted hardware not included in this loadout. The stale alert was cleared, and the mission can continue.");
  }, [storedEventIsInvalid, activeEventId]);

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
    if (!activeOperation || results || manualPaused || activeEventId) return;

    const timer = window.setInterval(() => {
      setActiveOperation((current) => {
        if (!current) return current;
        const remaining = Math.max(0, current.remainingSeconds - speed);
        if (remaining <= 0) {
          if (operationCompletionRef.current !== current.id) {
            operationCompletionRef.current = current.id;
            window.setTimeout(() => finishOperation(current), 0);
          }
          return null;
        }
        return { ...current, remainingSeconds: remaining };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeOperation, activeEventId, finishOperation, manualPaused, results, speed]);

  useEffect(() => {
    if (!pending || results || manualPaused) return;

    const timer = window.setInterval(() => {
      setElapsed((current) => {
        const next = Math.min(TOTAL_MISSION_SECONDS, current + 0.25 * speed);

        if (!activeEventId && eventPointerRef.current < EVENT_TIMES.length && next >= EVENT_TIMES[eventPointerRef.current]) {
          const event = pickNextEvent(environmentLabel, pending.selected, resolvedEventIds, eventPointerRef.current, metrics);
          eventPointerRef.current += 1;
          setTimeout(() => {
            setActiveEventId(event.id);
            setSelectedBuildingId(null);
            setSelectedResourceId(null);
            setAiMessage(`CRITICAL INCIDENT: ${event.title}. The affected system has taken an immediate hit. Life support and other systems continue to evolve until you respond.`);

            const targetId = event.trackId === "power"
              ? (pending.selected.grid ? "grid" : pending.selected.battery ? "battery" : "solar")
              : event.trackId;
            setBuildings((current) => {
              const previous = current[targetId];
              if (!previous) return current;
              const damage = 3 + Math.min(5, eventPointerRef.current * 0.4);
              const condition = clamp(previous.condition - damage);
              const nextBuildings = { ...current, [targetId]: { ...previous, condition, status: buildingStatus(condition) } };
              if (event.id === "solar-dust" || event.id === "regional-dust-front") {
                nextBuildings.solar = { ...(current.solar ?? { condition: 100, dust: 0, status: "ONLINE" }), dust: clamp((current.solar?.dust ?? 0) + 12) };
              }
              return nextBuildings;
            });
            setMetrics((current) => {
              switch (event.id) {
                case "solar-dust":
                case "regional-dust-front": return { ...current, power: clamp(current.power - 5), battery: clamp(current.battery - 3) };
                case "battery-thermal": return { ...current, battery: clamp(current.battery - 7), power: clamp(current.power - 2) };
                case "oxygen-filter":
                case "co2-scrubber-loading": return { ...current, oxygen: clamp(current.oxygen - 6) };
                case "water-filter": return { ...current, water: clamp(current.water - 6) };
                case "habitat-pressure": return { ...current, habitat: clamp(current.habitat - 5) };
                case "micrometeoroid-impact": return { ...current, habitat: clamp(current.habitat - 3) };
                case "radiation-burst": return { ...current, radiation: clamp(current.radiation + 7) };
                case "polar-shadow-cold-soak":
                  return { ...current, temperature: clamp(current.temperature - 2.5, 16, 28), battery: clamp(current.battery - 5), power: clamp(current.power - 2) };
                case "thermal-drift":
                  return { ...current, temperature: clamp(current.temperature + (current.temperature < 21 ? -2.0 : 2.0), 16, 28), battery: clamp(current.battery - 4) };
                case "grid-overload":
                case "core-power": return { ...current, power: clamp(current.power - 7), battery: clamp(current.battery - 4) };
                case "agriculture-stress": return { ...current, food: clamp(current.food - 6) };
                default: return current;
              }
            });
          }, 0);
        }

        if (next >= TOTAL_MISSION_SECONDS && !activeEventId && !activeOperation) {
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
        const powerBase = 72 + solarTier * 7.5 + solarUpgrade * 4.5 - solarDust * 0.4 - optionalCount * 2.0 + (pending.selected.grid ? tierLevel(pending.selected.grid) * 4 : 0);
        const demandPenalty = Math.max(0, 70 - powerBase);
        const batteryDelta = (powerBase > 85 ? 0.006 : powerBase > 73 ? -0.009 : -0.042 - demandPenalty * 0.0012) + batteryTier * 0.01 + batteryUpgrade * 0.014;
        const dt = 0.25 * speed;
        const faultImpact = Object.values(activeFaults).reduce((impact, fault) => {
          const amount = dt * fault.severity;
          switch (fault.eventId) {
            case "solar-dust":
            case "regional-dust-front": impact.power += 0.1 * amount; break;
            case "battery-thermal": impact.battery += 0.095 * amount; impact.power += 0.035 * amount; break;
            case "oxygen-filter":
            case "co2-scrubber-loading": impact.oxygen += 0.085 * amount; break;
            case "water-filter": impact.water += 0.075 * amount; break;
            case "habitat-pressure":
            case "micrometeoroid-impact": impact.habitat += 0.08 * amount; break;
            case "radiation-burst": impact.radiation += 0.12 * amount; break;
            case "polar-shadow-cold-soak":
            case "thermal-drift": impact.temperature += 0.055 * amount; impact.battery += 0.035 * amount; break;
            case "grid-overload":
            case "core-power": impact.power += 0.09 * amount; impact.battery += 0.04 * amount; break;
            case "agriculture-stress": impact.food += 0.08 * amount; break;
            default: break;
          }
          return impact;
        }, { power: 0, battery: 0, oxygen: 0, water: 0, food: 0, habitat: 0, radiation: 0, temperature: 0 });

        return {
          power: clamp(powerBase - faultImpact.power),
          battery: clamp(current.battery + batteryDelta * speed - faultImpact.battery),
          oxygen: clamp(current.oxygen - (0.0085 - oxygenTier * 0.0018 - oxygenUpgrade * 0.0008) * speed - faultImpact.oxygen),
          water: clamp(current.water - (0.0075 - waterTier * 0.0016 - waterUpgrade * 0.0007) * speed - faultImpact.water),
          food: clamp(current.food - Math.max(0.0014, 0.0065 - (pending.selected.agriculture ? tierLevel(pending.selected.agriculture) * 0.0019 : 0) - foodUpgrade * 0.0011) * speed - faultImpact.food),
          temperature: clamp(current.temperature + (21 - current.temperature) * (0.009 + (thermalTier + thermalUpgrade) * 0.0045) * speed + Math.sign(current.temperature - 21 || 1) * faultImpact.temperature, 16, 28),
          radiation: clamp(current.radiation + 0.003 * speed + faultImpact.radiation),
          habitat: clamp(current.habitat - Math.max(0.001, 0.0045 - habitatUpgrade * 0.0012) * speed - faultImpact.habitat),
        };
      });

      setBuildings((current) => {
        const next = { ...current };
        for (const [trackId, state] of Object.entries(next)) {
          const tier = pending.selected[trackId];
          const level = tier ? tierLevel(tier) : 0;
          const wear = trackId === "solar" ? 0.013 : 0.0075;
          const faultWear = Object.values(activeFaults)
            .filter((fault) => fault.targetTrackId === trackId)
            .reduce((sum, fault) => sum + 0.12 * fault.severity * 0.25 * speed, 0);
          next[trackId] = {
            ...state,
            condition: clamp(state.condition - Math.max(0.00025, wear - level * 0.0022 - (state.upgradeLevel ?? 0) * 0.002) * speed - faultWear),
            status: buildingStatus(clamp(state.condition - Math.max(0.00025, wear - level * 0.0022 - (state.upgradeLevel ?? 0) * 0.002) * speed - faultWear)),
            dust: trackId === "solar" ? clamp(state.dust + Math.max(0.003, 0.018 - level * 0.004 - (state.upgradeLevel ?? 0) * 0.004) * speed) : state.dust,
          };
        }
        return next;
      });

      const dt = 0.25 * speed;
      if (Object.keys(activeFaults).length > 0) {
        setActiveFaults((current) => Object.fromEntries(Object.entries(current).map(([key, fault]) => {
          const overdue = fault.remainingSeconds <= dt;
          return [key, {
            ...fault,
            remainingSeconds: Math.max(0, fault.remainingSeconds - dt),
            // After the response window expires, the fault cascades until a real repair action clears it.
            severity: overdue ? Math.min(3, fault.severity + 0.025 * dt) : fault.severity,
          }];
        })) as Record<string, ActiveFault>);
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [activeEventId, activeFaults, buildings, manualPaused, metrics, pending, resolvedEventIds, results, speed]);

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
      surveyedNodes,
      sampleStages,
      resourceYield,
      activeOperation,
      operationResult,
      activeFaults,
    });
  }, [activeEventId, activeFaults, activeOperation, aiMessage, buildings, decisions, elapsed, metrics, operationResult, pending, resourceYield, resolvedEventIds, results, roverTask, sampleStages, score, surveyedNodes]);

  useEffect(() => {
    if (!results || !pending || completionSavedRef.current) return;
    completionSavedRef.current = true;

    const finalState = loadGameState();
    const alreadyComplete = finalState.completedMissions.includes(pending.missionId);
    const firstTime = !pending.replay && !alreadyComplete;
    const analysedSamples = Object.values(sampleStages).filter((stage) => stage === "ANALYSED").length;
    // Field science earns extra XP only on the first clear; replay farming is intentionally limited.
    const researchBonusXp = firstTime ? analysedSamples * 120 : 0;
    const missionXpReward = pending.rewardXp + researchBonusXp;
    const nextState = {
      ...finalState,
      credits: finalState.credits + pending.rewardCredits,
      xp: finalState.xp + missionXpReward,
      researchTokens: finalState.researchTokens + (firstTime ? pending.rewardResearchTokens : 0),
      completedMissions: firstTime ? Array.from(new Set([...finalState.completedMissions, pending.missionId])) : finalState.completedMissions,
      lastMissionReward: firstTime
        ? {
            missionId: pending.missionId,
            title: pending.missionTitle,
            credits: pending.rewardCredits,
            xp: missionXpReward,
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

    const level = tierLevel(pending.selected[activeTargetTrackId ?? activeEvent.trackId] ?? "Foundation");

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

      case "co2-scrubber-loading":
        if (choiceId === "scrub") {
          setBuildings((current) => ({ ...current, co2: { ...(current.co2 ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.co2?.condition ?? 100) + 8 + level * 2), status: "ONLINE" } }));
          setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + 4), power: clamp(current.power - 3) }));
          setScore((value) => clamp(value + 7));
          setAiMessage("The CO₂ scrubber bed was regenerated. Cabin air-quality margin improved.");
        } else if (choiceId === "recover") {
          setBuildings((current) => ({ ...current, co2: { ...(current.co2 ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.co2?.condition ?? 100) + 4 + level), status: "ONLINE" } }));
          setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + 2), food: clamp(current.food + 1), power: clamp(current.power - 2) }));
          setScore((value) => clamp(value + 6));
          setAiMessage("Carbon recovery completed at a lower throughput; air quality and material recovery both benefited.");
        } else {
          setBuildings((current) => ({ ...current, co2: { ...(current.co2 ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.co2?.condition ?? 100) - 7), status: buildingStatus(clamp((current.co2?.condition ?? 100) - 7)) } }));
          setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen - 3) }));
          setScore((value) => clamp(value - 6));
          setAiMessage("Scrubber loading was left unresolved. Cabin air-quality margin narrowed.");
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
          setMetrics((current) => ({ ...current, battery: clamp(current.battery - 7), power: clamp(current.power - 3), temperature: clamp(current.temperature + (21 - current.temperature) * 0.38, 16, 28) }));
          setScore((value) => clamp(value + 7));
          setAiMessage("Heater power was increased to protect exposed hardware during the cold-soak transition.");
        } else if (choiceId === "reroute") {
          setMetrics((current) => ({ ...current, battery: clamp(current.battery - 1), power: clamp(current.power + 2), temperature: clamp(current.temperature + (21 - current.temperature) * 0.24, 16, 28) }));
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

    // A deliberate "carry on / ignore / defer" choice creates a live fault, not just a one-off penalty.
    const unsafeChoices = new Set(["ignore", "continue", "defer", "force", "push", "hold", "maintain"]);
    if (unsafeChoices.has(choiceId)) {
      const targetTrackId = activeTargetTrackId ?? activeEvent.trackId;
      const missionStage = Math.max(1, Number.parseInt(pending.missionNumber.replace(/[^0-9]/g, ""), 10) || 1);
      const severity = 1 + Math.min(0.9, (missionStage - 1) * 0.08 + eventPointerRef.current * 0.04);
      const remainingSeconds = 48 + Math.min(30, missionStage * 3);
      setActiveFaults((current) => ({
        ...current,
        [activeEvent.id]: { eventId: activeEvent.id, targetTrackId, title: activeEvent.title, remainingSeconds, severity },
      }));
      setAiMessage(`UNRESOLVED FAULT · ${activeEvent.title}. It will continue degrading ${targetTrackId.toUpperCase()} for about ${Math.round(remainingSeconds)} simulated seconds unless the remaining fault is repaired.`);
    }

    setActiveEventId(null);
  };

  const beginOperation = (
    kind: MissionOperation["kind"],
    targetId: string,
    label: string,
    durationSeconds: number,
    targetLevel?: number,
  ) => {
    if (!pending || activeOperation || actionBusy || activeEventId || results) return;
    const operation: MissionOperation = {
      id: `${kind.toLowerCase()}-${targetId}-${Date.now()}`,
      kind,
      targetId,
      label,
      totalSeconds: durationSeconds,
      remainingSeconds: durationSeconds,
      ...(targetLevel !== undefined ? { targetLevel } : {}),
    };
    operationCompletionRef.current = null;
    setActiveOperation(operation);
    setActionBusy(true);
    setOperationResult(null);
    setManualActions((value) => value + 1);
    setAiMessage(`${label} started. Estimated duration: ${durationSeconds} seconds at 1× simulation speed.`);
  };

  const handleResourceAction = (nodeId: string, action: string) => {
    if (!pending || activeOperation || actionBusy || activeEventId || results) return;
    const nodes = RESOURCE_NODES[pending.campaign === "mars" ? "MARS" : "MOON"];
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return;
    const stage = sampleStages[nodeId] ?? (surveyedNodes.includes(nodeId) ? "SURVEYED" : "UNSURVEYED");
    const hasRover = pending.selected.rover !== undefined;
    const hasExtraction = pending.selected.extraction !== undefined;
    const hasScience = pending.selected.science !== undefined;

    if (action === "survey" && stage === "UNSURVEYED") {
      const duration = hasRover ? 12 : 22;
      beginOperation("SURVEY", nodeId, `Surveying ${node.label}`, duration);
      setRoverTask(hasRover ? `MAPPING ${node.label.toUpperCase()}` : `REMOTE SCAN ${node.label.toUpperCase()}`);
      setMetrics((current) => ({ ...current, power: clamp(current.power - (hasRover ? 2 : 3)), battery: clamp(current.battery - 1) }));
      return;
    }
    if (action === "sample" && stage === "SURVEYED") {
      const duration = hasExtraction ? (hasRover ? 16 : 21) : (hasRover ? 24 : 30);
      if (metrics.power < 7 || metrics.battery < 3) {
        setOperationResult("COLLECTION HELD · Sampling requires at least 7% power and 3% battery reserve. Restore the energy margin first.");
        return;
      }
      beginOperation("COLLECT", nodeId, `Collecting sealed core sample · ${node.label}`, duration);
      setMetrics((current) => ({ ...current, power: clamp(current.power - (hasExtraction ? 5 : 3)), battery: clamp(current.battery - 2), radiation: clamp(current.radiation + (hasRover ? 0 : 1.5)) }));
      setRoverTask(hasExtraction ? "DRILLING CORE" : hasRover ? "SAMPLING SITE" : "EVA SAMPLING");
      return;
    }
    if (action === "transfer" && stage === "COLLECTED") {
      const duration = hasRover ? 12 : 22;
      beginOperation("TRANSFER", nodeId, `Transferring sealed sample · ${node.label}`, duration);
      setRoverTask(hasRover ? "CARRYING SAMPLE" : "EVA SAMPLE RETURN");
      if (!hasRover) setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen - 1.5), radiation: clamp(current.radiation + 1.5) }));
      return;
    }
    if (action === "analyze" && stage === "DELIVERED") {
      const scienceTier = tierLevel(pending.selected.science ?? "Foundation");
      const duration = hasScience ? Math.max(12, 20 - scienceTier * 2) : 32;
      if (metrics.power < 5) {
        setOperationResult("ANALYSIS HELD · Insufficient power for the spectrometer / field assay. Restore power before analysing.");
        return;
      }
      beginOperation("ANALYZE", nodeId, `Analysing sample · ${node.label}`, duration);
      setMetrics((current) => ({ ...current, power: clamp(current.power - (hasScience ? 3 : 5)) }));
      setRoverTask(hasScience ? "LAB ANALYSIS" : "PORTABLE ASSAY");
      return;
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
    if (!pending?.selected[trackId] || actionBusy || activeOperation || activeEventId || results) return;
    if (action === "upgrade") {
      const current = buildings[trackId] ?? { condition: 100, dust: 0, status: "ONLINE", upgradeLevel: 0 };
      if ((current.upgradeLevel ?? 0) >= 2) {
        setAiMessage(`${trackId.toUpperCase()} has reached its maximum module upgrade level.`);
        return;
      }
      if (metrics.power < 8 || metrics.battery < 5) {
        setAiMessage("Retrofit unavailable: reserve at least 8% power and 5% battery before isolating this system.");
        return;
      }
      const targetLevel = (current.upgradeLevel ?? 0) + 1;
      const equipmentTier = tierLevel(pending.selected[trackId]);
      const duration = 18 + equipmentTier * 2 + (current.upgradeLevel ?? 0) * 3;
      setMetrics((value) => ({ ...value, power: clamp(value.power - 8), battery: clamp(value.battery - 5) }));
      beginOperation("UPGRADE", trackId, `Installing upgrade kit · ${technologyTracks.find((track) => track.id === trackId)?.category ?? trackId}`, duration, targetLevel);
      return;
    }
    const repairActions: Record<string, string[]> = {
      solar: ["clean", "tune"],
      battery: ["balance", "reserve"],
      oxygen: ["reset", "boost"],
      water: ["flush", "purify"],
      co2: ["scrub", "recover"],
      thermal: ["dump", "insulate"],
      comms: ["repoint", "test"],
      habitat: ["repair", "seal"],
      radiation: ["shield", "shelter"],
      grid: ["balance-grid", "prioritize"],
      science: ["calibrate", "experiment"],
      navigation: ["nav-calibrate", "route"],
      rover: ["survey", "return", "inspect"],
      extraction: ["extract-test", "extract"],
      isru: ["process", "purge"],
      agriculture: ["tune-crops", "harvest"],
      maintenance: ["service", "diagnostics"],
    };
    const repairedFaultIds = Object.values(activeFaults)
      .filter((fault) => fault.targetTrackId === trackId && (repairActions[trackId] ?? []).includes(action))
      .map((fault) => fault.eventId);
    if (repairedFaultIds.length > 0) {
      const repairedSet = new Set(repairedFaultIds);
      setActiveFaults((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !repairedSet.has(id))));
      setOperationResult(`FAULT CLEARED · ${trackId.toUpperCase()} intervention completed. The unresolved incident is removed from the active fault register; check system condition and reserves before resuming optional work.`);
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
    const researchOpportunity = pending?.selected.science !== undefined || decisions.some((decision) => decision.eventId === "science-anomaly") || Object.values(sampleStages).some((stage) => stage === "ANALYSED");
    return { colonyHealth, decisionQuality, researchOpportunity, radiationScore };
  }, [decisions, metrics, pending, sampleStages, score]);

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
    const analysedSamples = Object.values(sampleStages).filter((stage) => stage === "ANALYSED").length;
    const researchBonusXp = pending && !pending.replay ? analysedSamples * 120 : 0;
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
                  <div className="flex justify-between text-sm"><span className="text-[#9baaa3]">XP</span><span className="font-mono text-[#b4d0b6]">+{(pending.rewardXp + researchBonusXp).toLocaleString()}</span></div>
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

        {!activeEvent && (
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

        )}
        {!activeEvent && (
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

        )}
        {!activeEvent && (
        <MissionTaskRibbon
          pending={pending}
          elapsed={elapsed}
          resolvedEvents={resolvedEventIds}
          sampleStages={sampleStages}
          activeEvent={activeEvent}
          roverTask={roverTask}
        />

        )}

        {!activeEvent && (
          <>
            <button
              type="button"
              onClick={() => setDashboardOpen((open) => !open)}
              className="pointer-events-auto absolute right-3 top-3 z-40 flex items-center gap-2 rounded-xl border border-[#526c68] bg-[#0a171c]/[0.94] px-3 py-2.5 text-left shadow-[0_8px_28px_rgba(0,0,0,0.42)] backdrop-blur-md transition hover:border-[#e8c568]"
              aria-expanded={dashboardOpen}
              aria-label={dashboardOpen ? "Close systems dashboard" : "Open systems dashboard"}
            >
              <Gauge className="h-4 w-4 text-[#eac568]" />
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white">Systems</span>
              <span className="font-mono text-[10px] text-[#a8ddb8]">{Math.round(performance.colonyHealth)}%</span>
              {Object.keys(activeFaults).length > 0 && <span className="rounded-full bg-[#d74d59] px-1.5 py-0.5 text-[8px] font-black text-white">{Object.keys(activeFaults).length}!</span>}
              <span className="text-xs text-[#8eaaa4]">{dashboardOpen ? "−" : "+"}</span>
            </button>

            {dashboardOpen && (
              <aside className="pointer-events-auto absolute right-3 top-[58px] z-40 max-h-[76vh] w-[min(94vw,390px)] overflow-y-auto rounded-2xl border border-[#405b5e] bg-[#081419]/[0.97] shadow-[0_22px_62px_rgba(0,0,0,0.65)] backdrop-blur-xl">
                <div className="sticky top-0 z-10 border-b border-[#30484c] bg-[#102329]/[0.98] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#e8c568]">Telemetry / live board</p>
                      <h2 className="mt-1 text-sm font-black uppercase tracking-[0.1em] text-white">Colony systems</h2>
                    </div>
                    <button type="button" onClick={() => setDashboardOpen(false)} className="rounded-lg border border-[#425a5d] px-2.5 py-1.5 text-xs text-[#b4c4c2]" aria-label="Close systems dashboard">×</button>
                  </div>
                  <p className="mt-2 text-[9px] leading-4 text-[#87a29f]">Healthy systems still need monitoring. Warning colours show loss of margin, not simply whether a disaster has fired.</p>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3">
                  {[
                    { label: "Power margin", value: metrics.power, display: `${Math.round(metrics.power)}%`, inverse: false },
                    { label: "Battery reserve", value: metrics.battery, display: `${Math.round(metrics.battery)}%`, inverse: false },
                    { label: "O₂ / life support", value: metrics.oxygen, display: `${Math.round(metrics.oxygen)}%`, inverse: false },
                    { label: "Water reserve", value: metrics.water, display: `${Math.round(metrics.water)}%`, inverse: false },
                    { label: "Food reserve", value: metrics.food, display: `${Math.round(metrics.food)}%`, inverse: false },
                    { label: "Habitat integrity", value: metrics.habitat, display: `${Math.round(metrics.habitat)}%`, inverse: false },
                    { label: "Temperature", value: clamp(100 - Math.abs(metrics.temperature - 21) * 12), display: `${metrics.temperature.toFixed(1)}°C`, inverse: false },
                    { label: "Radiation dose index", value: clamp(metrics.radiation * 3.33), display: metrics.radiation.toFixed(1), inverse: true },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-xl border border-[#253d42] bg-[#102025] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#8da8a4]">{metric.label}</p>
                        <p className="shrink-0 font-mono text-sm font-bold" style={{ color: resourceColor(metric.value, metric.inverse) }}>{metric.display}</p>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#26383d]">
                        <div className="h-full rounded-full transition-[width]" style={{ width: `${clamp(metric.value)}%`, background: resourceColor(metric.value, metric.inverse) }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-3 pb-3">
                  <div className="flex items-center justify-between gap-2 px-1 pb-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#b5c8c1]">Deployed equipment</p>
                    <span className="text-[8px] uppercase tracking-[0.1em] text-[#718e8b]">{selectedTracks.length} systems</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedTracks.map((track) => {
                      const state = buildings[track.id] ?? { condition: 100, dust: 0, status: "ONLINE" };
                      const fault = Object.values(activeFaults).find((item) => item.targetTrackId === track.id);
                      return (
                        <button key={track.id} type="button" onClick={() => { setSelectedResourceId(null); setSelectedBuildingId(track.id); setDashboardOpen(false); }} className="w-full rounded-xl border border-[#263d42] bg-[#0d1b20] p-2.5 text-left transition hover:border-[#b9a15d]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 text-[9px] font-black uppercase tracking-[0.08em] text-[#e4ece4]">{track.category} <span className="font-normal text-[#75918d]">· {pending.selected[track.id]}</span></span>
                            <span className="shrink-0 font-mono text-[10px] font-bold" style={{ color: resourceColor(state.condition) }}>{Math.round(state.condition)}%</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#25363a]"><div className="h-full rounded-full" style={{ width: `${clamp(state.condition)}%`, background: resourceColor(state.condition) }} /></div>
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <span className="text-[8px] uppercase tracking-[0.1em]" style={{ color: resourceColor(state.condition) }}>{fault ? "FAULT ACTIVE" : state.status}</span>
                            {track.id === "solar" && <span className="text-[8px] text-[#d7be72]">Dust {Math.round(state.dust)}%</span>}
                            {(state.upgradeLevel ?? 0) > 0 && <span className="text-[8px] text-[#e8c568]">Retrofit L{state.upgradeLevel}/2</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeOperation && (
                  <div className="border-t border-[#30484c] bg-[#11242a] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#e8c568]">Work in progress</p>
                      <span className="font-mono text-[10px] text-white">{Math.ceil(activeOperation.remainingSeconds)}s</span>
                    </div>
                    <p className="mt-1 text-[10px] text-[#d8e5df]">{activeOperation.label}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#2b3d40]"><div className="h-full bg-[#dfbb58]" style={{ width: `${clamp(100 * (1 - activeOperation.remainingSeconds / activeOperation.totalSeconds))}%` }} /></div>
                    {manualPaused && <p className="mt-2 text-[8px] text-[#e9ca7c]">Mission paused · operation clock paused</p>}
                  </div>
                )}

                <div className="border-t border-[#30484c] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#b5c8c1]">Active fault register</p>
                    <span className={`text-[8px] font-black uppercase tracking-[0.1em] ${Object.keys(activeFaults).length ? "text-[#ff8187]" : "text-[#84d4a2]"}`}>{Object.keys(activeFaults).length ? `${Object.keys(activeFaults).length} unresolved` : "No ongoing faults"}</span>
                  </div>
                  {Object.keys(activeFaults).length === 0 ? (
                    <p className="mt-2 text-[9px] leading-4 text-[#76928f]">Ignored incidents will appear here and continue to affect the relevant system until the fault clears.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {Object.values(activeFaults).map((fault) => (
                        <div key={fault.eventId} className="rounded-xl border border-[#713b44] bg-[#26161d] p-2.5">
                          <div className="flex items-start justify-between gap-2"><p className="text-[9px] font-bold text-[#fff0ec]">{fault.title}</p><span className="font-mono text-[9px] text-[#ff9aa3]">{fault.remainingSeconds > 0 ? `${Math.ceil(fault.remainingSeconds)}s` : "OVERDUE"}</span></div>
                          <p className="mt-1 text-[8px] uppercase tracking-[0.1em] text-[#d59097]">Degrading {fault.targetTrackId.toUpperCase()} · severity {fault.severity.toFixed(1)}×</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
            )}

            {operationResult && (
              <div className="pointer-events-auto absolute left-1/2 top-1/2 z-40 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#5d8a6b] bg-[#0b1c1c]/[0.98] p-4 shadow-[0_18px_58px_rgba(0,0,0,0.68)]">
                <div className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#85d9a2]" />
                  <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#91ddb0]">Operation report</p><p className="mt-1 text-[11px] leading-5 text-[#d7e6de]">{operationResult}</p></div>
                  <button type="button" onClick={() => setOperationResult(null)} className="rounded-lg border border-[#3d6052] px-2 py-1 text-xs text-[#c3d7cb]" aria-label="Dismiss operation report">×</button>
                </div>
              </div>
            )}

            {activeOperation && (
              <div className="pointer-events-none absolute bottom-[96px] left-1/2 z-30 w-[min(92vw,520px)] -translate-x-1/2 rounded-2xl border border-[#526e71] bg-[#0b171c]/[0.94] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3"><p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-[#e9c86b]">{activeOperation.label}</p><span className="font-mono text-[11px] text-white">{Math.ceil(activeOperation.remainingSeconds)}s</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#283b40]"><div className="h-full rounded-full bg-[#e1bb58] transition-[width]" style={{ width: `${clamp(100 * (1 - activeOperation.remainingSeconds / activeOperation.totalSeconds))}%` }} /></div>
              </div>
            )}
          </>
        )}

        {selectedResource && !activeEvent && (
          <ResourceInspector
            node={selectedResource}
            stage={sampleStages[selectedResource.id] ?? (surveyedNodes.includes(selectedResource.id) ? "SURVEYED" : "UNSURVEYED")}
            hasRover={pending.selected.rover !== undefined}
            hasExtraction={pending.selected.extraction !== undefined}
            hasScience={pending.selected.science !== undefined}
            operation={activeOperation}
            actionBusy={actionBusy}
            onAction={(action) => handleResourceAction(selectedResource.id, action)}
            onClose={() => setSelectedResourceId(null)}
          />
        )}

        {!activeEvent && selectedTrack && selectedTier && !selectedResource && (
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
          <div className="absolute inset-0 z-[80] grid place-items-center bg-[#05080c]/[0.80] p-3 backdrop-blur-sm sm:p-5">
            <section className="pointer-events-auto max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-[26px] border-2 border-[#d95363] bg-[#0b1118]/[0.99] shadow-[0_25px_100px_rgba(0,0,0,0.8)]">
              <header className="sticky top-0 z-10 border-b border-[#733842] bg-gradient-to-r from-[#421c27] via-[#25161e] to-[#15141c] px-5 py-4 sm:px-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#c95160] bg-[#6e2634]/40 text-[#ff8088]"><AlertTriangle className="h-6 w-6" /></div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#ff858b]">Critical incident · respond now</p>
                      <h1 className="mt-1 text-lg font-black uppercase tracking-[0.06em] text-white sm:text-2xl">{activeEvent.title}</h1>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[#d9b4bb]">Affected asset · {(activeTargetTrackId ?? activeEvent.trackId).toUpperCase()} · {environmentLabel}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-[#ee6e78] bg-[#721f2c]/50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#ffc1c2]">Live fault · 1 active</span>
                </div>
                <p className="mt-4 max-w-3xl text-[11px] leading-5 text-[#e4d9df]">{activeEvent.subtitle} {activeEvent.summary}</p>
                <div className="mt-3 rounded-xl border border-[#7a3543] bg-[#29151d] px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#ffb6bc]">This is not a cosmetic warning</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#dcbac1]">The mission clock and life-support simulation keep running while you decide. Non-essential controls are disabled here. A poor response leaves a fault that continues degrading its system after this panel closes.</p>
                </div>
              </header>

              <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  <section className="rounded-2xl border border-[#33484f] bg-[#101e25] p-4">
                    <div className="flex items-center gap-2 text-[#e8c568]"><Activity className="h-4 w-4" /><p className="text-[9px] font-black uppercase tracking-[0.18em]">Current telemetry</p></div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[
                        { label: "Target condition", value: Math.round(buildings[activeTargetTrackId ?? activeEvent.trackId]?.condition ?? 100), display: `${Math.round(buildings[activeTargetTrackId ?? activeEvent.trackId]?.condition ?? 100)}%` },
                        { label: "Power margin", value: metrics.power, display: `${Math.round(metrics.power)}%` },
                        { label: "Battery reserve", value: metrics.battery, display: `${Math.round(metrics.battery)}%` },
                        { label: "Life support", value: Math.min(metrics.oxygen, metrics.water), display: `${Math.round(Math.min(metrics.oxygen, metrics.water))}%` },
                      ].map((item) => (
                        <div key={item.label} className="rounded-xl border border-[#2d4248] bg-[#0b171d] p-3">
                          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#8fa7ab]">{item.label}</p>
                          <p className="mt-1 font-mono text-lg font-bold" style={{ color: resourceColor(item.value) }}>{item.display}</p>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#273a40]"><div className="h-full rounded-full" style={{ width: `${clamp(item.value)}%`, background: resourceColor(item.value) }} /></div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {activeOperation && (
                    <section className="rounded-2xl border border-[#8a7141] bg-[#2a2518] p-4">
                      <div className="flex items-center gap-2 text-[#f1cf77]"><Clock className="h-4 w-4" /><p className="text-[9px] font-black uppercase tracking-[0.16em]">Operation suspended by incident</p></div>
                      <p className="mt-2 text-[11px] font-bold text-white">{activeOperation.label}</p>
                      <p className="mt-1 text-[10px] text-[#cdbb8e]">{Math.ceil(activeOperation.remainingSeconds)} seconds remain. Work resumes after this response is chosen.</p>
                    </section>
                  )}

                  <section className="rounded-2xl border border-[#33484f] bg-[#101e25] p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#b6c8c4]">Operational consequence</p>
                    <p className="mt-2 text-[10px] leading-5 text-[#93aaa9]">Use the readings to choose between restoring the system, protecting the rest of the colony, or accepting an operational limitation. No choice is free: power, reserve, time or hardware life may be affected.</p>
                    {Object.keys(activeFaults).length > 0 && <p className="mt-3 rounded-lg border border-[#7d3b45] bg-[#2b171e] px-3 py-2 text-[9px] text-[#ffb3b6]">{Object.keys(activeFaults).length} unresolved fault(s) are already degrading the colony.</p>}
                  </section>
                </div>

                <section>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ff868e]">Response console</p><h2 className="mt-1 text-base font-black uppercase tracking-[0.07em] text-white">Choose your action</h2></div>
                    <span className="text-[8px] uppercase tracking-[0.12em] text-[#80989a]">Decision recorded</span>
                  </div>
                  <div className="space-y-2.5">
                    {getEventChoices(activeEvent, pending.selected).map((choice, index) => {
                      const unsafe = ["ignore", "continue", "defer", "force", "push", "hold", "maintain"].includes(choice.id);
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => handleEventChoice(choice.id)}
                          className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${unsafe ? "border-[#6a4148] bg-[#21191f] hover:border-[#db727c] hover:bg-[#2d1b23]" : "border-[#385c55] bg-[#142922] hover:border-[#e9c568] hover:bg-[#1d382d]"}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[10px] font-black ${unsafe ? "bg-[#6a2d3a] text-[#ffc4c3]" : "bg-[#d9b654] text-[#1b2119]"}`}>{index + 1}</span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-black uppercase tracking-[0.04em] text-white">{choice.label}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.1em] ${unsafe ? "bg-[#652c37] text-[#ffb1b5]" : "bg-[#224538] text-[#9ce0b4]"}`}>{unsafe ? "Ongoing risk" : "Mitigation"}</span>
                              </span>
                              <span className="mt-1.5 block text-[10px] leading-5 text-[#acbfc0]">{choice.detail}</span>
                              {unsafe && <span className="mt-2 block text-[9px] font-bold text-[#ff9ba4]">Choosing this leaves a persistent fault that continues draining the affected system.</span>}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default MissionSimulation;
