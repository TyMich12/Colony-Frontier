import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LEVEL1_ENVIRONMENT, baselineStateIndex, getAdditionalMetricRow, getAdditionalRating, getBaselineRating, getBaselineRow, getRepairOption, getRepairOptions, getRepairEffectValue, getRetrofitInstallation, effectiveRepairTierIndex, interpolateSolarProfile } from "./_shared/simulationBalance";
import { Activity, AlertTriangle, BatteryCharging, Car, Clock, Check, CircleDot, Cloud, Compass, Droplets, Factory, FlaskConical, Gauge, Home, Pause, Pickaxe, Play, Radio, Shield, Sparkles, Sprout, Sun, Thermometer, Wind, Wrench, Zap, } from "lucide-react";
import { technologyTracks, tierMeta, } from "./_shared/gameData";
import { loadGameState, saveGameState } from "./gameState";
import { clearMissionRuntime, clearPendingMission, loadMissionRuntime, loadPendingMission, saveMissionRuntime, } from "./missionRuntime";
import { Colony3DMap } from "./Colony3DMap";
const TOTAL_MISSION_SECONDS = LEVEL1_ENVIRONMENT.missionDurationSeconds;
const GAME_TIME_ACCELERATION = LEVEL1_ENVIRONMENT.gameTimeAcceleration;
const EVENT_TIMES = [0.10, 0.21, 0.32, 0.44, 0.55, 0.67, 0.79, 0.91].map((fraction) => Math.round(TOTAL_MISSION_SECONDS * fraction));
const STARTING_REPAIR_PARTS_KG = 60; // On-site spares; game-balance assumption, no launch-mass change.
const REPAIR_GAP_PREFIX = "Unrestored fault gap · ";
const REPAIR_GAP_INITIAL_PREFIX = "Initial fault gap · ";
function getPrimaryRepairMetric(systemId) {
    return getRepairOptions(systemId)[0]?.metric ?? null;
}
function repairGapKey(metric) {
    return `${REPAIR_GAP_PREFIX}${metric}`;
}
function repairInitialGapKey(metric) {
    return `${REPAIR_GAP_INITIAL_PREFIX}${metric}`;
}
function getStandardRepairGap(systemId, selected) {
    const metric = getPrimaryRepairMetric(systemId);
    if (!metric || systemId === "solar" || systemId === "battery" || systemId === "maintenance")
        return 0;
    const availableOptions = getRepairOptions(systemId).filter((option) => option.metric === metric && option.requiredSystems.every((supportId) => Boolean(selected[supportId])));
    const maxRecoverable = availableOptions.reduce((best, option) => {
        const tierIndex = effectiveRepairTierIndex(selected[systemId] ?? "Foundation", option.requiredSystems, selected);
        return Math.max(best, getRepairEffectValue(option, tierIndex));
    }, 0);
    const rated = getBaselineRating(systemId, selected[systemId] ?? "Foundation", 0);
    return Math.min(Math.max(0, rated), maxRecoverable);
}
function repairAdjustedRating(systemId, ratedValue, repairMetrics, lowerIsBetter = false) {
    if (systemId === "solar" || systemId === "battery" || systemId === "maintenance")
        return ratedValue;
    const metric = getPrimaryRepairMetric(systemId);
    if (!metric)
        return ratedValue;
    const gap = Math.max(0, repairMetrics?.[repairGapKey(metric)] ?? 0);
    return lowerIsBetter ? ratedValue + gap : Math.max(0, ratedValue - gap);
}
function mergeRepairReading(readings, metric, value) {
    return /hotspot-fault diagnosis coverage|hotspot fault protection|faulted strings protected/i.test(metric)
        ? Math.max(readings[metric] ?? 0, value)
        : value;
}
function repairCapabilityFraction(systemId, selected, buildings) {
    const tier = selected[systemId];
    if (!tier)
        return 0;
    const rated = getBaselineRating(systemId, tier, buildings[systemId]?.upgradeLevel ?? 0);
    const effective = repairAdjustedRating(systemId, rated, buildings[systemId]?.repairMetrics);
    return rated > 0 ? clamp(effective / rated, 0, 1) : 1;
}
function solarFaultProtection(readings) {
    if (!readings)
        return 0;
    const coverage = clamp(readings["Hotspot-fault diagnosis coverage"] ?? 0, 0, 100) / 100;
    const protection = clamp(readings["Hotspot fault protection"] ?? 0, 0, 100) / 100;
    const protectedStrings = clamp(readings["Faulted strings protected from propagation"] ?? 0, 0, 10) / 10;
    return clamp(coverage * protection + protectedStrings, 0, 0.8);
}
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
};
const SYSTEM_ACTION_SECONDS = {
    clean: 9, tune: 7, balance: 8, reserve: 6, reset: 7, boost: 9,
    flush: 8, purify: 12, scrub: 8, recover: 9, dump: 7, insulate: 10,
    repoint: 8, test: 5, repair: 14, seal: 8, shield: 10, shelter: 6,
    "balance-grid": 8, prioritize: 5, calibrate: 9, experiment: 14,
    "nav-calibrate": 7, route: 5, survey: 12, return: 12, inspect: 4,
    "extract-test": 10, extract: 15, process: 12, purge: 7,
    "tune-crops": 12, harvest: 9, service: 12, diagnostics: 7,
    "fallback-solar": 7, "fallback-battery": 5, "fallback-grid": 4, "fallback-habitat": 6,
    "fallback-water": 7, "fallback-oxygen": 5, "fallback-co2": 6, "fallback-thermal": 6,
    "fallback-radiation": 5, "fallback-comms": 5, "fallback-navigation": 5, "fallback-rover": 5,
    "fallback-extraction": 6, "fallback-isru": 6, "fallback-science": 6, "fallback-agriculture": 5,
    "fallback-maintenance": 8,
    "solar-autonomous-clean": 12, "battery-thermal-recondition": 14, "oxygen-electrolyser-burst": 13,
    "water-distillate-recovery": 12, "co2-crop-loop": 12, "thermal-waste-heat-recovery": 12,
    "comms-priority-window": 9, "habitat-composite-patch": 16, "radiation-regolith-berm": 15,
    "grid-black-start": 13, "science-fusion": 16, "request-earth-report": 20,
    "extraction-waterjet": 18, "isru-oxygen-feed": 16, "agriculture-closed-loop": 16,
    "maintenance-overhaul": 18,
};
const LEGACY_REPAIR_ACTIONS = new Set([
    "fallback-solar", "fallback-battery", "fallback-grid", "fallback-habitat", "fallback-water", "fallback-oxygen",
    "fallback-co2", "fallback-thermal", "fallback-radiation", "fallback-comms", "fallback-navigation", "fallback-rover",
    "fallback-extraction", "fallback-isru", "fallback-science", "fallback-agriculture", "fallback-maintenance",
    "clean", "tune", "balance", "reserve", "reset", "boost", "flush", "purify", "scrub", "recover", "dump", "insulate",
    "repair", "seal", "shield", "shelter", "balance-grid", "prioritize", "nav-calibrate", "repoint", "calibrate", "purge", "tune-crops", "service",
    "solar-autonomous-clean", "battery-thermal-recondition", "oxygen-electrolyser-burst", "water-distillate-recovery",
    "co2-crop-loop", "thermal-waste-heat-recovery", "comms-priority-window", "habitat-composite-patch",
    "radiation-regolith-berm", "grid-black-start", "agriculture-closed-loop", "maintenance-overhaul",
]);
const SYSTEM_ACTION_EFFECTS = {
    clean: "Dust-coverage estimate −16 points (−24 with rover) · about 3.9 kJ restored per 10 simulated seconds at Foundation 0/2 while below target output",
    tune: "Available electrical power +0.36 kW · array condition index +1",
    balance: "Stored energy +0.60 kWh · available power +0.24 kW",
    reserve: "Stored energy +0.96 kWh · available power −0.24 kW",
    reset: "O₂ reserve +0.72 kg · available power −0.24 kW",
    boost: "O₂ reserve +1.44 kg · available power −0.48 kW · condition index −1",
    flush: "Recovered water +7.2 L · available power −0.24 kW",
    purify: "Recovered water +10.8 L · available power −0.48 kW",
    scrub: "O₂ reserve +0.48 kg · available power −0.12 kW",
    recover: "O₂ reserve +0.24 kg · available power −0.12 kW · condition index +1",
    dump: "Moves cabin temperature 36% closer to 21°C · available power −0.24 kW",
    insulate: "Moves cabin temperature 22% closer to 21°C · available power −0.12 kW · condition index +1",
    repoint: "Antenna condition index +1 · link alignment verified",
    test: "Communications link health verified at rated Mbit/s throughput · condition index +1",
    repair: "Habitat condition index +14 (+28 with Maintenance) · integrity index +5 · stored energy −0.24 kWh",
    seal: "Habitat condition index +3 · integrity index +3 · stored energy −0.12 kWh",
    shield: "Dose rate −0.0012 mSv/h · stored energy −0.12 kWh · condition index +1",
    shelter: "Dose rate −0.0018 mSv/h · stored energy −0.24 kWh · available power −0.12 kW",
    "balance-grid": "Available power +0.36 kW · stored energy +0.24 kWh · condition index +1",
    prioritize: "O₂ reserve +0.24 kg · water reserve +1.8 L · stored energy +0.36 kWh · available power −0.12 kW",
    calibrate: "Instrument condition index +1 · reference baseline verified",
    experiment: "Research data yield +1 unit · available power −0.24 kW",
    "nav-calibrate": "Position uncertainty improves · navigation condition index +1",
    route: "Rover route solution updated · position uncertainty improves",
    survey: "Maps the next site and enables sealed-specimen collection",
    return: "Rover returns to the launch pad",
    inspect: "Reports current system condition and fault state",
    "extract-test": "Feedstock yield +4 units · available power −0.48 kW · stored energy −0.12 kWh · condition index −1",
    extract: "Feedstock yield +5 units · available power −0.60 kW · stored energy −0.24 kWh",
    process: "Processed feedstock yield +3 units · available power −0.60 kW · stored energy −0.48 kWh",
    purge: "Process-line condition index +2 · available power −0.12 kW",
    "tune-crops": "Edible food reserve +2.1 kg · water reserve −3.6 L · available power −0.24 kW · condition index +1",
    harvest: "Edible food reserve +2.9 kg · water reserve −3.6 L · feedstock yield +1 unit",
    service: "Raises the weakest healthy system's condition index by 10 points",
    diagnostics: "Checks active faults and identifies the weakest healthy system",
    "fallback-solar": "BASIC · no optional systems · dust coverage −7 points · about 1.7 kJ restored per 10 simulated seconds at Foundation 0/2 while below target output",
    "fallback-battery": "Enables load shedding and reduces parasitic draw; stored energy is conserved, not created",
    "fallback-grid": "Manual breaker isolation reduces demand; available power margin improves by about 0.12 kW",
    "fallback-habitat": "Emergency seal patch · habitat integrity index +1.5 · condition index +3",
    "fallback-water": "Gravity-fed condensate recovery · water reserve +1.8 L · no powered purifier required",
    "fallback-oxygen": "Releases 0.24 kg O₂ from the built-in emergency buffer",
    "fallback-co2": "Passive sorbent swap · condition index +1 · cabin O₂ reserve margin improves",
    "fallback-thermal": "Closes passive insulation shutters, gently damping cabin temperature drift without a heater load",
    "fallback-radiation": "Moves crew behind passive shielding, reducing the modelled dose rate by up to 0.0003 mSv/h",
    "fallback-comms": "Resets the local low-rate beacon · condition index +1",
    "fallback-navigation": "Re-zeros inertial sensors for dead-reckoning · condition index +1",
    "fallback-rover": "Inspects wheel encoders and clears a local drive fault · condition index +2",
    "fallback-extraction": "Unloads the drill torque latch · condition index +1 without extracting material",
    "fallback-isru": "Isolates and purges the process line · condition index +1, no feedstock required",
    "fallback-science": "Re-zeros the bench instruments · condition index +1, no specimen consumed",
    "fallback-agriculture": "Harvests 0.42 kg of ready edible biomass without the complete water loop",
    "fallback-maintenance": "Manual walk-around service · condition index +2 on the weakest healthy module",
    "solar-autonomous-clean": "SPECIALIST · rover + maintenance + navigation · dust coverage −32 points · about 7.8 kJ restored per 10 simulated seconds at Foundation 0/2 while below target output",
    "battery-thermal-recondition": "Thermal conditioning improves battery health and recovers additional stored energy at a measured power cost",
    "oxygen-electrolyser-burst": "Electrolyses reclaimed water into extra oxygen · water and electrical energy consumed",
    "water-distillate-recovery": "Recovers more condensate using waste heat · water yield improves with an electrical cost",
    "co2-crop-loop": "Routes scrubbed CO₂ into the greenhouse loop · supports crop carbon supply and life-support balance",
    "thermal-waste-heat-recovery": "Recovers usable waste heat from the power system to reduce cabin-temperature drift",
    "comms-priority-window": "Reserves a high-gain uplink window using navigation timing",
    "habitat-composite-patch": "Uses processed structural composite and thermal-controlled curing for a stronger seal repair",
    "radiation-regolith-berm": "Uses excavated regolith mass to reduce the modelled residual dose rate",
    "grid-black-start": "Restarts the distribution bus from stored battery energy and stable solar input",
    "science-fusion": "Fuses analysed specimen data with navigation / thermal telemetry for higher research yield",
    "request-earth-report": "Earth Mission Control report · up to 20 simulated seconds; Navigation Research at 2/2 caches guidance locally",
    "extraction-waterjet": "Water-assisted drilling improves core recovery but consumes water and electrical energy",
    "isru-oxygen-feed": "Converts verified drill feedstock into oxygen-bearing products",
    "agriculture-closed-loop": "Combines water / CO₂ / thermal systems for increased edible biomass production",
    "maintenance-overhaul": "Uses comms, navigation and power-grid telemetry for multi-system preventive service",
};
const SYSTEM_LABELS = {
    solar: "Solar array", battery: "Battery bank", grid: "Power grid", habitat: "Habitat",
    water: "Water recovery", co2: "CO₂ scrubber", oxygen: "Oxygen loop", thermal: "Thermal control",
    radiation: "Radiation shielding", comms: "Communications relay", navigation: "Navigation",
    rover: "Rover", extraction: "Extraction drill", isru: "ISRU processor",
    science: "Science laboratory", agriculture: "Agriculture", maintenance: "Maintenance bay",
};
/**
 * Directed engineering graph. "all" are mandatory upstream connections; "any" describes
 * an alternate, redundant connection. Actions and live production both consult this graph.
 */
const SYSTEM_CONNECTIONS = {
    solar: { outputs: ["grid", "battery"] },
    battery: { outputs: ["grid", "oxygen", "water", "thermal", "comms", "radiation", "rover"] },
    grid: { any: ["solar", "battery"], outputs: ["water", "co2", "oxygen", "thermal", "comms", "navigation", "science", "maintenance"] },
    habitat: { outputs: ["water", "co2", "oxygen", "thermal", "radiation", "agriculture", "maintenance"] },
    water: { all: ["habitat"], any: ["grid", "battery"], outputs: ["oxygen", "agriculture", "extraction", "isru"] },
    co2: { all: ["habitat"], any: ["grid", "battery"], outputs: ["oxygen", "agriculture"] },
    oxygen: { all: ["water", "habitat"], any: ["grid", "battery"], outputs: ["agriculture", "co2"] },
    thermal: { all: ["habitat"], any: ["grid", "battery"], outputs: ["science", "agriculture"] },
    radiation: { all: ["habitat"], any: ["battery", "grid"], outputs: ["habitat"] },
    comms: { any: ["grid", "battery"], outputs: ["navigation", "rover", "science", "maintenance"] },
    navigation: { any: ["grid", "battery"], outputs: ["rover", "extraction", "science", "comms"] },
    rover: { any: ["battery", "grid"], outputs: ["extraction", "isru"] },
    extraction: { any: ["grid", "battery"], outputs: ["isru", "radiation"] },
    isru: { all: ["extraction"], any: ["grid", "battery"], outputs: ["agriculture", "habitat"] },
    science: { any: ["grid", "battery"], outputs: [] },
    agriculture: { all: ["water", "habitat"], any: ["grid", "battery"], outputs: ["co2", "oxygen"] },
    maintenance: { any: ["grid", "battery"], outputs: ["all systems"] },
};
// Each primary operation has all eight helper combinations: none, each helper alone, each pair,
// and all three. These are actual support-system variants, not cosmetic button changes.
const ACTION_VARIANT_PROFILES = {
    solar: { actionId: "clean", label: "Solar-array cleaning", helpers: ["rover", "maintenance", "navigation"] },
    battery: { actionId: "balance", label: "Battery-cell balancing", helpers: ["grid", "thermal", "maintenance"] },
    grid: { actionId: "balance-grid", label: "Power-bus balancing", helpers: ["battery", "maintenance", "comms"] },
    habitat: { actionId: "repair", label: "Habitat seal repair", helpers: ["maintenance", "thermal", "isru"] },
    water: { actionId: "flush", label: "Water-recovery flush", helpers: ["thermal", "co2", "maintenance"] },
    oxygen: { actionId: "reset", label: "Oxygen-loop reset", helpers: ["water", "co2", "thermal"] },
    co2: { actionId: "scrub", label: "CO₂ sorbent regeneration", helpers: ["oxygen", "agriculture", "maintenance"] },
    thermal: { actionId: "dump", label: "Thermal-loop correction", helpers: ["grid", "battery", "maintenance"] },
    comms: { actionId: "repoint", label: "High-gain antenna realignment", helpers: ["navigation", "maintenance", "grid"] },
    radiation: { actionId: "shelter", label: "Radiation shelter protocol", helpers: ["thermal", "battery", "maintenance"] },
    science: { actionId: "calibrate", label: "Science-instrument calibration", helpers: ["navigation", "comms", "thermal"] },
    navigation: { actionId: "nav-calibrate", label: "Navigation calibration", helpers: ["comms", "maintenance", "grid"] },
    rover: { actionId: "survey", label: "Rover field survey", helpers: ["navigation", "comms", "grid"] },
    extraction: { actionId: "extract-test", label: "Core-drill test run", helpers: ["rover", "navigation", "maintenance"] },
    isru: { actionId: "process", label: "ISRU feedstock processing", helpers: ["water", "thermal", "science"] },
    agriculture: { actionId: "tune-crops", label: "Controlled-crop tuning", helpers: ["water", "co2", "thermal"] },
    maintenance: { actionId: "service", label: "Preventative system service", helpers: ["comms", "navigation", "grid"] },
};
// Standalone repairs are always available. Optional integrations never require essential Solar or Habitat as support.
const SUPPORT_SHORT_LABELS = {
    solar: "Solar", battery: "Battery", grid: "Power grid", habitat: "Habitat",
    water: "Water recovery", co2: "CO₂ scrubber", oxygen: "Oxygen loop", thermal: "Thermal control",
    radiation: "Shielding", comms: "Comms relay", navigation: "Navigation", rover: "Rover",
    extraction: "Core drill", isru: "ISRU processor", science: "Science lab",
    agriculture: "Greenhouse", maintenance: "Maintenance bay",
};
function decodeActionVariant(systemId, actionId) {
    const profile = ACTION_VARIANT_PROFILES[systemId];
    const match = /^variant:([^:]+):([0-7])$/.exec(actionId);
    if (!profile || !match || match[1] !== profile.actionId)
        return null;
    const mask = Number(match[2]);
    return {
        baseActionId: profile.actionId,
        mask,
        supportSystems: profile.helpers.filter((_, bit) => (mask & (1 << bit)) !== 0),
    };
}
function buildSystemActionChoices(_systemId, actions) {
    // Keep the action list concise. Repair support combinations are selected through the
    // four numerical repair categories (Standalone, Enhanced, Dual-System, Fully Integrated),
    // not exposed as seven stale, separately generated action buttons.
    return actions;
}
const ACTION_REQUIREMENTS = {
    clean: { minPower: 2 },
    tune: { all: ["navigation", "comms"], any: ["grid", "battery"], minPower: 3 },
    balance: { minPower: 2 },
    reserve: { all: ["grid"], minPower: 2 },
    reset: { minPower: 3 },
    boost: { all: ["water", "co2", "habitat"], any: ["grid", "battery"], minPower: 5 },
    flush: { minPower: 3 },
    purify: { all: ["habitat", "oxygen", "co2"], any: ["grid", "battery"], minPower: 5 },
    scrub: { minPower: 2 },
    recover: { all: ["habitat", "oxygen"], any: ["grid", "battery"], minPower: 2 },
    dump: { minPower: 2 },
    insulate: { all: ["habitat"], any: ["grid", "battery"], minPower: 2 },
    repoint: { minPower: 2 },
    test: { all: ["navigation"], any: ["grid", "battery"], minPower: 2 },
    repair: { minPower: 2, minBattery: 1 },
    seal: { minPower: 2, minBattery: 1 },
    shield: { all: ["habitat", "maintenance"], any: ["battery", "grid"], minPower: 2, minBattery: 1 },
    shelter: { minPower: 2, minBattery: 2 },
    "balance-grid": { minPower: 3 },
    prioritize: { all: ["oxygen", "water", "battery"], minPower: 2 },
    calibrate: { minPower: 2 },
    experiment: { all: ["navigation", "comms", "thermal"], any: ["grid", "battery"], minPower: 3, analysedSample: true },
    "nav-calibrate": { minPower: 2 },
    route: { all: ["rover", "comms"], any: ["grid", "battery"], minPower: 2 },
    survey: { all: ["rover", "navigation", "comms"], any: ["grid", "battery"], minPower: 2, minBattery: 1 },
    return: { all: ["navigation"], any: ["battery", "grid"], minPower: 1 },
    inspect: {},
    "extract-test": { minPower: 5, minBattery: 2, surveyedSite: true },
    extract: { all: ["rover", "navigation", "water"], any: ["grid", "battery"], minPower: 7, minBattery: 3, surveyedSite: true },
    process: { minPower: 5, minBattery: 2, extractedFeed: true },
    purge: { all: ["extraction", "water"], any: ["grid", "battery"], minPower: 2 },
    "tune-crops": { minPower: 4 },
    harvest: { all: ["water", "co2", "oxygen", "thermal", "habitat"], any: ["grid", "battery"], minPower: 2 },
    service: { minPower: 2 },
    diagnostics: { all: ["comms"], any: ["grid", "battery"], minPower: 2 },
    "request-earth-report": { all: ["comms"], any: ["grid", "battery"], minPower: 1 },
    "solar-autonomous-clean": { all: ["rover", "maintenance", "navigation"], any: ["grid", "battery"], minPower: 2 },
    "battery-thermal-recondition": { all: ["thermal", "maintenance", "grid"], minPower: 3, minBattery: 2 },
    "oxygen-electrolyser-burst": { all: ["water", "grid", "thermal", "habitat"], minPower: 6, minBattery: 1 },
    "water-distillate-recovery": { all: ["thermal", "habitat", "grid"], minPower: 4 },
    "co2-crop-loop": { all: ["agriculture", "oxygen", "water"], any: ["grid", "battery"], minPower: 2 },
    "thermal-waste-heat-recovery": { all: ["grid", "battery", "habitat"], minPower: 2 },
    "comms-priority-window": { all: ["navigation", "grid"], minPower: 2 },
    "habitat-composite-patch": { all: ["maintenance", "thermal", "isru"], any: ["grid", "battery"], minPower: 3, minBattery: 2 },
    "radiation-regolith-berm": { all: ["habitat", "extraction", "isru"], minPower: 2 },
    "grid-black-start": { all: ["solar", "battery", "maintenance"], minPower: 2, minBattery: 3 },
    "science-fusion": { all: ["navigation", "comms", "thermal", "isru"], any: ["grid", "battery"], minPower: 3, analysedSample: true, extractedFeed: true },
    "extraction-waterjet": { all: ["rover", "navigation", "water", "maintenance"], any: ["grid", "battery"], minPower: 7, minBattery: 3, surveyedSite: true },
    "isru-oxygen-feed": { all: ["extraction", "water", "oxygen", "grid"], minPower: 4, extractedFeed: true },
    "agriculture-closed-loop": { all: ["water", "co2", "oxygen", "thermal", "habitat", "science"], any: ["grid", "battery"], minPower: 4 },
    "maintenance-overhaul": { all: ["comms", "navigation", "grid"], minPower: 3, minBattery: 2 },
    "repair-active": { minPower: 5, minBattery: 2 },
    upgrade: { minPower: 8, minBattery: 5 },
    sample: { all: ["rover", "navigation"], any: ["battery", "grid"], minPower: 7, minBattery: 3 },
    transfer: { all: ["rover", "navigation", "habitat"], any: ["battery", "grid"], minPower: 2, minBattery: 1 },
    analyze: { all: ["science", "habitat"], any: ["grid", "battery"], minPower: 5 },
};
function hasPartialRepairProgress(systemId, context) {
    const metric = getPrimaryRepairMetric(systemId);
    if (!metric)
        return false;
    const readings = context.buildings[systemId]?.repairMetrics;
    const remaining = readings?.[repairGapKey(metric)];
    const initial = readings?.[repairInitialGapKey(metric)];
    return typeof remaining === "number" && typeof initial === "number" && initial > 0 && remaining < initial - 0.0001;
}
function systemIsOperational(systemId, context, visiting = new Set()) {
    const activeFault = Object.values(context.activeFaults).some((fault) => fault.targetTrackId === systemId);
    if (!context.selected[systemId] || (activeFault && !hasPartialRepairProgress(systemId, context)))
        return false;
    if ((context.buildings[systemId]?.condition ?? 100) < 25)
        return false;
    if (visiting.has(systemId))
        return false;
    const nextVisiting = new Set(visiting);
    nextVisiting.add(systemId);
    const links = SYSTEM_CONNECTIONS[systemId];
    if (!links)
        return true;
    if ((links.all ?? []).some((dependency) => !systemIsOperational(dependency, context, nextVisiting)))
        return false;
    if (links.any?.length && !links.any.some((dependency) => systemIsOperational(dependency, context, nextVisiting)))
        return false;
    return true;
}
function collectSystemBlockers(systemId, context, blockers, visiting = new Set()) {
    if (visiting.has(systemId))
        return;
    if (!context.selected[systemId]) {
        blockers.push(`Install ${SYSTEM_LABELS[systemId] ?? systemId} first`);
        return;
    }
    const activeFault = Object.values(context.activeFaults).some((fault) => fault.targetTrackId === systemId);
    if (activeFault && !hasPartialRepairProgress(systemId, context)) {
        blockers.push(`Repair ${SYSTEM_LABELS[systemId] ?? systemId} first`);
        return;
    }
    if ((context.buildings[systemId]?.condition ?? 100) < 25) {
        blockers.push(`Service ${SYSTEM_LABELS[systemId] ?? systemId} above 25% condition`);
        return;
    }
    const nextVisiting = new Set(visiting);
    nextVisiting.add(systemId);
    const links = SYSTEM_CONNECTIONS[systemId];
    if (!links)
        return;
    for (const dependency of links.all ?? [])
        collectSystemBlockers(dependency, context, blockers, nextVisiting);
    if (links.any?.length && !links.any.some((dependency) => systemIsOperational(dependency, context))) {
        blockers.push(`Needs one working link: ${links.any.map((id) => SYSTEM_LABELS[id] ?? id).join(" or ")}`);
    }
}
// Repair support checks the helper's own health and an available energy bus without
// recursively making essential Solar or Habitat systems prerequisites.
function collectRepairSupportBlockers(systemId, context, blockers) {
    if (!context.selected[systemId]) {
        blockers.push(`Install ${SYSTEM_LABELS[systemId] ?? systemId} first`);
        return;
    }
    if (Object.values(context.activeFaults).some((fault) => fault.targetTrackId === systemId)) {
        blockers.push(`Repair ${SYSTEM_LABELS[systemId] ?? systemId} first`);
        return;
    }
    if ((context.buildings[systemId]?.condition ?? 100) < 25) {
        blockers.push(`Service ${SYSTEM_LABELS[systemId] ?? systemId} above 25% condition`);
        return;
    }
    if (systemId !== "battery" && systemId !== "grid") {
        const energyAvailable = ["battery", "grid"].some((energyId) => Boolean(context.selected[energyId]) &&
            !Object.values(context.activeFaults).some((fault) => fault.targetTrackId === energyId) &&
            (context.buildings[energyId]?.condition ?? 100) >= 25);
        if (!energyAvailable)
            blockers.push("Needs a healthy Battery or Power Grid; the grid may run from stored battery energy without Solar");
    }
}
function getActionBlockers(systemId, actionId, context, node) {
    if (actionId.startsWith("repair:")) {
        const option = getRepairOption(systemId, actionId.slice("repair:".length));
        if (!option)
            return ["Unknown repair procedure in workbook data"];
        const blockers = getActionBlockers(systemId, "repair-procedure", context, node);
        for (const helperId of option.requiredSystems)
            collectRepairSupportBlockers(helperId, context, blockers);
        return [...new Set(blockers)];
    }
    const variant = decodeActionVariant(systemId, actionId);
    if (variant) {
        const blockers = getActionBlockers(systemId, variant.baseActionId, context, node);
        for (const helperId of variant.supportSystems)
            collectSystemBlockers(helperId, context, blockers);
        return [...new Set(blockers)];
    }
    if (actionId === "inspect")
        return [];
    const blockers = [];
    const isRepair = actionId === "repair-active" || actionId === "repair-procedure";
    const stage = node ? context.sampleStages[node.id] ?? (context.surveyedNodes.includes(node.id) ? "SURVEYED" : "UNSURVEYED") : undefined;
    if (systemId !== "field") {
        if (!context.selected[systemId])
            blockers.push(`Install ${SYSTEM_LABELS[systemId] ?? systemId} first`);
        const ownFault = Object.values(context.activeFaults).some((fault) => fault.targetTrackId === systemId);
        const faultBlocksAction = ownFault && !hasPartialRepairProgress(systemId, context);
        if (faultBlocksAction && !isRepair && !LOCAL_FALLBACK_ACTIONS.has(actionId))
            blockers.push(`Repair the active ${SYSTEM_LABELS[systemId] ?? systemId} fault first`);
        if (!faultBlocksAction && !isRepair && !LOCAL_FALLBACK_ACTIONS.has(actionId) && (context.buildings[systemId]?.condition ?? 100) < 25)
            blockers.push(`Service ${SYSTEM_LABELS[systemId] ?? systemId} above 25% condition`);
        if (!faultBlocksAction && !isRepair && !LOCAL_FALLBACK_ACTIONS.has(actionId) && actionId !== "diagnostics" && actionId !== "service")
            collectSystemBlockers(systemId, context, blockers);
    }
    const rule = ACTION_REQUIREMENTS[actionId] ?? {};
    for (const required of rule.all ?? [])
        collectSystemBlockers(required, context, blockers);
    for (const group of [rule.any ?? [], ...(rule.anyGroups ?? [])]) {
        if (group.length && !group.some((systemId) => systemIsOperational(systemId, context))) {
            blockers.push(`Needs one working link: ${group.map((systemId) => SYSTEM_LABELS[systemId] ?? systemId).join(" or ")}`);
        }
    }
    if (rule.surveyedSite && context.surveyedNodes.length === 0 && !Object.values(context.sampleStages).some((value) => value !== "UNSURVEYED")) {
        blockers.push("Survey a field site before extraction");
    }
    if (rule.analysedSample && !Object.values(context.sampleStages).some((value) => value === "ANALYSED")) {
        blockers.push("Analyse at least one specimen in the science lab first");
    }
    if (rule.extractedFeed && context.resourceYield <= 0) {
        blockers.push("Run the extraction drill on a surveyed site before processing feed");
    }
    if (actionId === "repair-active" && !Object.values(context.activeFaults).some((fault) => fault.targetTrackId === systemId)) {
        blockers.push("There is no active fault on this system to repair");
    }
    if (actionId === "sample" && node) {
        if (stage !== "SURVEYED")
            blockers.push("Survey this site before collecting a specimen");
        if ((node.kind === "ICE" || node.kind === "MINERAL")) {
            collectSystemBlockers("extraction", context, blockers);
            collectSystemBlockers("rover", context, blockers);
            collectSystemBlockers("navigation", context, blockers);
        }
        else {
            collectSystemBlockers("rover", context, blockers);
        }
    }
    if (actionId === "transfer" && node && stage !== "COLLECTED")
        blockers.push("Secure a specimen at this site before returning it");
    if (actionId === "analyze" && node && stage !== "DELIVERED")
        blockers.push("Return the sealed specimen to the habitat laboratory first");
    if (rule.minPower !== undefined && context.metrics.power < rule.minPower)
        blockers.push(`Requires ${physicalThreshold("power", rule.minPower)}`);
    if (rule.minBattery !== undefined && context.metrics.battery < rule.minBattery)
        blockers.push(`Requires ${physicalThreshold("battery", rule.minBattery, ratedBatteryCapacityKWh(context.selected, context.buildings))}`);
    return [...new Set(blockers)];
}
const EVENT_DEFS = [
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
function isTier(value) {
    return value === "Foundation" || value === "Frontier" || value === "Apex" || value === "Research";
}
function tierLevel(tier) {
    if (!isTier(tier))
        return 0;
    return tier === "Foundation" ? 0 : tier === "Frontier" ? 1 : tier === "Apex" ? 2 : 3;
}
// All system capabilities come from exact workbook ratings for the selected tier and retrofit progress; never apply global tier or retrofit multipliers.
function ratedBatteryCapacityKWh(selected, buildings) {
    return selected.battery ? getBaselineRating("battery", selected.battery, buildings.battery?.upgradeLevel ?? 0) : RESOURCE_CAPACITIES.storedEnergyKWh;
}
function ratedPowerCapacityKW(selected, buildings) {
    if (selected.grid)
        return repairAdjustedRating("grid", getBaselineRating("grid", selected.grid, buildings.grid?.upgradeLevel ?? 0), buildings.grid?.repairMetrics);
    if (selected.solar)
        return getBaselineRating("solar", selected.solar, buildings.solar?.upgradeLevel ?? 0);
    if (selected.battery)
        return getAdditionalRating("battery", "continuous discharge power", selected.battery, buildings.battery?.upgradeLevel ?? 0);
    return RESOURCE_CAPACITIES.availablePowerKW;
}
function retrofitSecondaryPreview(systemId, tier, nextLevel) {
    const rated = (metric, unit) => {
        const value = getAdditionalRating(systemId, metric, tier, nextLevel);
        return value > 0 ? `${metric}: ${formatRating(value)} ${unit}` : "";
    };
    switch (systemId) {
        case "solar": return nextLevel === 1 ? "Applied on completion: solar dust index −15 points" : "Applied on completion: solar dust index −10 more points; residual array pointing error −2°";
        case "battery": return `Rated charge limit ${formatRating(getAdditionalRating("battery", "continuous charge power", tier, nextLevel))} kW; rated discharge limit ${formatRating(getAdditionalRating("battery", "continuous discharge power", tier, nextLevel))} kW. Actual flow follows the live power balance.`;
        case "oxygen": return rated("purity", "%") || "Higher rated oxygen production; power and life-support demand still apply";
        case "water": return `${formatRating(getAdditionalRating("water", "throughput", tier, nextLevel))} L/day wastewater throughput; recovery efficiency is shown separately`;
        case "comms": return rated("link availability", "%") || "Improves rated link throughput";
        case "grid": return rated("conversion efficiency", "%") || "Improves rated power-transfer capacity";
        case "rover": return rated("safe range", "km") || "Improves rated safe traverse speed";
        case "isru": return `${formatRating(getAdditionalRating("isru", "purity", tier, nextLevel))}% product purity; ${formatRating(getAdditionalRating("isru", "product recovery", tier, nextLevel))}% target-feedstock recovery`;
        case "science": return rated("accuracy", "%") || "Improves rated assay throughput";
        case "agriculture": return rated("water consumed", "L/kg dry food") || "Improves rated edible-food yield";
        case "habitat": return "Lower rated pressure loss for the standardised seal-fault case";
        case "radiation": return "Higher fraction of the defined reference-event dose avoided";
        case "co2": return "Higher rated CO₂ removal capacity; actual removal still depends on power and system availability";
        case "thermal": return "Higher rated heat-rejection capacity; cabin response still depends on operating conditions";
        case "extraction": return "Higher rated regolith extraction throughput; site, power and feedstock limits still apply";
        case "maintenance": return "More condition points restored by a completed maintenance job";
        case "navigation": return "Lower rated horizontal position error; terrain and reference geometry still matter";
        default: return "The rated capability shown above increases when commissioning completes";
    }
}
// This is a compressed command/processing queue, not the speed-of-light radio delay.
// At Research 2/2, local predictive caching can provide the report without waiting for Earth.
function earthReportDelaySeconds(tier, upgradeLevel) {
    if (tier === "Research" && upgradeLevel >= 2)
        return 0;
    return Math.max(0, 20 - tierLevel(tier) * 4.8 - Math.max(0, Math.min(2, upgradeLevel)) * 2);
}
function formatRating(value, digits = 2) {
    return Number.isInteger(value) ? String(value) : value.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}
function describeRepairOutcome(systemId, metric, unit, value, currentDust = 0) {
    const systemLabel = SYSTEM_LABELS[systemId] ?? systemId;
    const amount = formatRating(value);
    if (/dust removed from (existing deposit|array surface)/i.test(metric)) {
        const before = Math.max(0, currentDust);
        if (/of current dust/i.test(unit)) {
            const removed = before * Math.min(100, Math.max(0, value)) / 100;
            const after = Math.max(0, before - removed);
            return `Solar dust: ${formatRating(before)} → ${formatRating(after)} (−${formatRating(removed)} points; removes ${amount}% of current dust)`;
        }
        if (/dust-index points/i.test(unit)) {
            const removed = Math.min(before, Math.max(0, value));
            const after = Math.max(0, before - removed);
            return `Solar dust: ${formatRating(before)} → ${formatRating(after)} (−${formatRating(removed)} points)`;
        }
        return `Solar dust: −${amount} ${unit}`;
    }
    if (/usable energy restored/i.test(metric)) {
        return `Battery usable energy: +${amount} kWh restored (bounded by available capacity)`;
    }
    if (/safe cell-temperature operating window restored/i.test(metric)) {
        return `Battery thermal operating margin: +${amount} ${unit}`;
    }
    if (/charge\/discharge path availability restored/i.test(metric)) {
        return `Battery bidirectional power path: +${amount} ${unit}`;
    }
    if (/high-resistance cell connections isolated/i.test(metric)) {
        return `Battery suspect connections verified and isolated: ${amount} ${unit}`;
    }
    if (/failed array strings restored to service/i.test(metric)) {
        return `Solar array: +${amount} failed string(s) restored`;
    }
    if (/residual array pointing error after recalibration/i.test(metric)) {
        return `Solar pointing error: ${amount}° residual after recalibration`;
    }
    if (/pressure-loss rate reduced/i.test(metric)) {
        return `Habitat pressure-loss rate: −${amount} kPa/sol`;
    }
    if (/horizontal position error removed/i.test(metric)) {
        return `Navigation position error: −${amount} m`;
    }
    if (/dose avoided after repair/i.test(metric)) {
        return `Radiation: +${amount} ${unit} of reference-event dose avoided`;
    }
    if (/condition points restored/i.test(metric)) {
        return `Maintenance recovery: +${amount} condition points`;
    }
    if (/hotspot-fault diagnosis coverage/i.test(metric)) {
        return `Solar hot-spot faults detected: ${amount}%`;
    }
    if (/faulted strings protected from propagation/i.test(metric)) {
        return `Fault propagation prevented for ${amount} array string(s)`;
    }
    if (/faults protected/i.test(metric)) {
        return `Fault propagation prevented for ${amount} ${unit}`;
    }
    // Keep every procedure tied to its workbook-defined metric. A broad "restored" matcher
    // made unrelated repairs look like the same generic performance increase.
    return `${systemLabel}: ${amount} ${unit} — ${metric}`;
}
function describeRepairOptionOutcome(systemId, option, tierIndex, currentDust) {
    const value = getRepairEffectValue(option, tierIndex);
    const lines = [describeRepairOutcome(systemId, option.metric, option.unit, value, currentDust)];
    if (option.secondary && typeof option.secondary.values[tierIndex] === "number") {
        lines.push(describeRepairOutcome(systemId, option.secondary.metric, option.secondary.unit, option.secondary.values[tierIndex], currentDust));
    }
    if (option.tertiary && typeof option.tertiary.values[tierIndex] === "number") {
        lines.push(describeRepairOutcome(systemId, option.tertiary.metric, option.tertiary.unit, option.tertiary.values[tierIndex], currentDust));
    }
    return lines;
}
function dustTransmission(dust) {
    const points = LEVEL1_ENVIRONMENT.solarDustTransmissionCurve;
    const bounded = Math.max(0, Math.min(100, dust));
    for (let i = 1; i < points.length; i++) {
        if (bounded <= points[i].dust) {
            const low = points[i - 1], high = points[i];
            const portion = (bounded - low.dust) / (high.dust - low.dust);
            return low.transmission + (high.transmission - low.transmission) * portion;
        }
    }
    return points[points.length - 1].transmission;
}
function physicalSystemOutput(systemId, tier, upgradeLevel, _condition = 100, dust = 0, repairMetrics = {}, elapsedSeconds = LEVEL1_ENVIRONMENT.secondsPerEarthDay * 6, campaign = "moon", missionTitle = "", missionNumber = "") {
    const baseline = getBaselineRow(systemId);
    if (!baseline)
        return { label: "Rated system output", value: "No baseline recorded" };
    const stateIndex = baselineStateIndex(tier, upgradeLevel);
    const ratedValue = baseline.values[stateIndex] ?? 0;
    const rating = repairAdjustedRating(systemId, ratedValue, repairMetrics, systemId === "habitat" || systemId === "navigation");
    const extra = (needle) => {
        const metric = getAdditionalMetricRow(systemId, needle);
        const amount = metric?.values[stateIndex];
        return metric && typeof amount === "number" ? " · " + formatRating(amount) + " " + metric.unit : "";
    };
    let label = baseline.metric;
    let value = formatRating(rating) + " " + baseline.unit;
    switch (systemId) {
        case "solar": {
            const day7 = interpolateSolarProfile(7);
            const liveDay = Math.min(14, Math.max(0, elapsedSeconds / LEVEL1_ENVIRONMENT.secondsPerEarthDay));
            const liveProfile = interpolateSolarProfile(liveDay);
            const liveCellTemperatureLoss = liveProfile.cellTemperatureLoss ?? Math.min(0.8, Math.max(0, liveProfile.cellTempC - LEVEL1_ENVIRONMENT.referenceCellTemperatureC) * LEVEL1_ENVIRONMENT.cellTemperatureDeratePerC);
            const missionFraction = clamp(elapsedSeconds / TOTAL_MISSION_SECONDS, 0, 1);
            const blackoutMission = campaign === "moon" && (missionTitle.toLowerCase().includes("blackout") || missionNumber === "02");
            const liveSunlight = blackoutMission
                ? (liveDay >= 14 ? 0 : missionFraction < 0.16 ? 0.42 : missionFraction < 0.85 ? 0.14 : 0.28)
                : campaign === "mars"
                    ? Math.max(0.25, 0.78 + Math.sin(liveDay * Math.PI / 7) * 0.10)
                    : liveDay < 14 ? (liveDay < 1 ? 0.22 : liveProfile.sunlightGeometry) : 0;
            const pointingError = repairMetrics["Residual array pointing error after recalibration"] ?? 15;
            const checkpointKW = Math.min(rating, rating * day7.sunlightGeometry * (1 - day7.cellTemperatureLoss) * dustTransmission(dust) * Math.max(0, Math.cos(pointingError * Math.PI / 180)));
            const currentKW = _condition < 28 ? 0 : Math.min(rating, rating * liveSunlight * (1 - liveCellTemperatureLoss) * dustTransmission(dust) * Math.max(0, Math.cos(pointingError * Math.PI / 180)));
            label = "Solar output · rated / Day 7 checkpoint / current live output";
            value = `${formatRating(rating)} kW rated · ${checkpointKW.toFixed(3)} kW Day 7 · ${currentKW.toFixed(3)} kW current · ${(currentKW * LEVEL1_ENVIRONMENT.energyWindowSeconds / 3600).toFixed(5)} kWh / 10 sim s`;
            break;
        }
        case "battery": {
            const maxDischargeKW = getAdditionalRating("battery", "continuous discharge power", tier, upgradeLevel);
            label = "Nominal stored energy capacity · rated maximum discharge";
            value = formatRating(rating) + " kWh nominal · " + formatRating(maxDischargeKW) + " kW max";
            break;
        }
        case "water":
            value = formatRating(rating) + "% recovery" + extra("throughput");
            break;
        case "oxygen":
            value += extra("purity");
            break;
        case "comms":
            value += extra("link availability");
            break;
        case "grid":
            value += extra("conversion efficiency");
            break;
        case "science":
            value += extra("accuracy");
            break;
        case "rover":
            value += extra("safe range");
            break;
        case "isru":
            value += extra("purity") + extra("product recovery");
            break;
        case "agriculture":
            value += extra("water consumed");
            break;
        case "radiation":
            label = "Radiation avoided during reference event";
            value = formatRating(rating) + "% avoided";
            break;
        case "habitat":
        case "navigation":
            label += " (lower is better)";
            break;
        default: break;
    }
    return { label, value };
}
const LOCAL_FALLBACK_ACTIONS = new Set([
    "fallback-solar", "fallback-battery", "fallback-grid", "fallback-habitat",
    "fallback-water", "fallback-oxygen", "fallback-co2", "fallback-thermal",
    "fallback-radiation", "fallback-comms", "fallback-navigation", "fallback-rover",
    "fallback-extraction", "fallback-isru", "fallback-science", "fallback-agriculture",
    "fallback-maintenance",
]);
function fallbackEmergencyOverride(actionId, systemId, metrics, hasActiveFault) {
    if (hasActiveFault)
        return true;
    switch (actionId) {
        case "fallback-solar": return metrics.power < 32 || metrics.battery < 18;
        case "fallback-battery": return metrics.battery < 25 || metrics.power < 28;
        case "fallback-grid": return metrics.power < 30 || metrics.battery < 22;
        case "fallback-habitat": return metrics.habitat < 40;
        case "fallback-water": return metrics.water < 30;
        case "fallback-oxygen":
        case "fallback-co2": return metrics.oxygen < 30;
        case "fallback-thermal": return Math.abs(metrics.temperature - 21) > 3.5;
        case "fallback-radiation": return metrics.radiation > 35;
        case "fallback-comms": return metrics.power < 25;
        case "fallback-navigation": return metrics.power < 25 || metrics.battery < 25;
        case "fallback-rover": return metrics.battery < 25;
        case "fallback-extraction": return metrics.power < 25 || metrics.battery < 20;
        case "fallback-isru":
        case "fallback-science": return metrics.power < 25;
        case "fallback-agriculture": return metrics.food < 30 || metrics.water < 20;
        case "fallback-maintenance": return metrics.habitat < 40 || metrics.power < 25;
        default: return false;
    }
}
function clamp(value, min = 0, max = 100) {
    return Math.min(max, Math.max(min, value));
}
// Resource gauges are stored internally on a 0–100 scale, but the player sees the outpost's
// declared physical quantities, not fictitious percentages of power, energy, gas or water.
const RESOURCE_CAPACITIES = {
    availablePowerKW: 8,
    storedEnergyKWh: 1200,
    oxygenReserveKg: 24,
    waterReserveL: 180,
    foodReserveKg: 42,
};
function physicalResourceTelemetry(metrics, selected = {}, buildings = {}) {
    const batteryCapacityKWh = ratedBatteryCapacityKWh(selected, buildings);
    const powerCapacityKW = Math.max(1, ratedPowerCapacityKW(selected, buildings));
    return {
        power: `${(metrics.power / 100 * powerCapacityKW).toFixed(1)} kW power margin`,
        battery: `${(metrics.battery / 100 * batteryCapacityKWh).toFixed(2)} kWh`,
        oxygen: `${(metrics.oxygen / 100 * RESOURCE_CAPACITIES.oxygenReserveKg).toFixed(1)} kg O₂`,
        water: `${Math.round(metrics.water / 100 * RESOURCE_CAPACITIES.waterReserveL)} L`,
        food: `${(metrics.food / 100 * RESOURCE_CAPACITIES.foodReserveKg).toFixed(1)} kg food`,
        habitat: `Integrity index ${Math.round(metrics.habitat)}/100`,
        radiation: `${(metrics.radiation / 100 * 0.06).toFixed(3)} mSv/h effective dose rate`,
        temperature: `${metrics.temperature.toFixed(1)} °C`,
    };
}
function physicalThreshold(resource, points, batteryCapacityKWh = RESOURCE_CAPACITIES.storedEnergyKWh) {
    if (resource === "power")
        return `${(points / 100 * RESOURCE_CAPACITIES.availablePowerKW).toFixed(2)} kW available power`;
    return `${(points / 100 * batteryCapacityKWh).toFixed(2)} kWh stored energy`;
}
function buildingStatus(condition) {
    if (condition < 28)
        return "CRITICAL";
    if (condition < 55)
        return "DAMAGED";
    if (condition < 82)
        return "DEGRADED";
    return "ONLINE";
}
function formatWallClockCountdown(remainingSeconds, simulationSpeed = 1, timeAcceleration = 1) {
    const effectiveSpeed = simulationSpeed > 0 ? simulationSpeed : 1;
    return String(Math.ceil(Math.max(0, remainingSeconds) / (effectiveSpeed * Math.max(1, timeAcceleration))));
}
function formatMissionTime(seconds) {
    const bounded = Math.max(0, Math.min(TOTAL_MISSION_SECONDS, seconds));
    const day = Math.min(14, Math.floor(bounded / LEVEL1_ENVIRONMENT.secondsPerEarthDay) + 1);
    const dayProgress = bounded % LEVEL1_ENVIRONMENT.secondsPerEarthDay;
    const hour = Math.floor(dayProgress / 3600);
    const minute = Math.floor((dayProgress % 3600) / 60);
    return `DAY ${day.toString().padStart(2, "0")} · ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}
function initialMetrics(_selected) {
    // Starting reserves are scenario conditions, never a hidden bonus for higher technology.
    return { power: 72, battery: LEVEL1_ENVIRONMENT.batteryInitialSOCPercent, oxygen: 88, water: 86, food: 84, temperature: 21, radiation: 10, habitat: 94 };
}
function getMissionFailureReason(metrics) {
    if (metrics.oxygen <= 1.5)
        return "Cabin oxygen reserve fell below the minimum safe operating margin.";
    if (metrics.water <= 1)
        return "The usable water reserve was exhausted before recovery could be restored.";
    if (metrics.food <= 1.5)
        return "Usable food reserves were exhausted before sustainable production or resupply could be restored.";
    if (metrics.habitat <= 1)
        return "Habitat integrity fell below its simulated pressure-boundary limit.";
    if (metrics.power <= 5 && metrics.battery <= LEVEL1_ENVIRONMENT.batteryMinimumSOCPercent + 0.5)
        return "Generation cannot sustain the colony and the battery has reached its protected 20% reserve; critical electrical demand is no longer being met.";
    if (metrics.temperature <= 16.05 || metrics.temperature >= 27.95)
        return "Cabin temperature passed the simulated crew-safe operating envelope.";
    if (metrics.radiation >= 90)
        return "Modelled effective dose rate exceeded the emergency shelter threshold.";
    return null;
}
function initialBuildings(selected) {
    return Object.fromEntries(Object.keys(selected).map((trackId) => [
        trackId,
        { condition: 100, dust: 0, status: "ONLINE", upgradeLevel: 0 },
    ]));
}
function selectedTrackData(selected) {
    return technologyTracks.filter((track) => isTier(selected[track.id]));
}
function eventTargetIsDeployed(event, selected, environmentLabel) {
    const matchesEnvironment = !event.environment || event.environment === "BOTH" || event.environment === environmentLabel;
    // A power incident targets the grid if installed, otherwise the required battery / solar bus.
    const targetId = event.trackId === "power"
        ? (selected.grid ? "grid" : selected.battery ? "battery" : selected.solar ? "solar" : null)
        : event.trackId;
    return matchesEnvironment && Boolean(targetId && isTier(selected[targetId]));
}
function pickNextEvent(environmentLabel, selected, resolvedEventIds, scheduleIndex, metrics) {
    const available = EVENT_DEFS.filter((event) => eventTargetIsDeployed(event, selected, environmentLabel));
    const unresolved = available.filter((event) => !resolvedEventIds.includes(event.id));
    const has = (eventId) => {
        const event = available.find((candidate) => candidate.id === eventId);
        return event && !resolvedEventIds.includes(event.id) ? event : null;
    };
    // Scripted moments are preferred, but only when their actual target exists in this loadout.
    if (scheduleIndex === 0) {
        const dustEvent = has("solar-dust");
        if (dustEvent)
            return dustEvent;
    }
    const environmentEventId = scheduleIndex === 1
        ? environmentLabel === "MOON" ? "micrometeoroid-impact" : "regional-dust-front"
        : scheduleIndex === 3
            ? environmentLabel === "MOON" ? "polar-shadow-cold-soak" : "mars-comm-relay-loss"
            : null;
    if (environmentEventId && !resolvedEventIds.includes(environmentEventId)) {
        const environmentEvent = has(environmentEventId);
        if (environmentEvent)
            return environmentEvent;
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
    if (weakest)
        return weakest.event;
    // Final safety net: choose any deployed system event; never strand the player at an unbuilt facility.
    return unresolved[0] ?? available[0] ?? EVENT_DEFS.find((event) => event.trackId === "battery");
}
function getEventChoices(event, selected) {
    const hasRover = selected.rover !== undefined;
    const hasNavigation = selected.navigation !== undefined;
    const choices = {
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
function resourceColor(value, invert = false) {
    const effective = invert ? 100 - value : value;
    if (effective > 65)
        return "#8fc9a0";
    if (effective > 35)
        return "#efb658";
    return "#d77a5a";
}
function BuildingShape({ track, tier, runtime, selected, alerted, x, y, onClick, }) {
    const level = tierLevel(tier);
    const size = 38 + level * 7;
    const height = 18 + level * 8;
    const Icon = categoryIcons[track.category] ?? Zap;
    const damaged = runtime.condition < 82;
    const dusted = track.id === "solar" && runtime.dust > 2;
    const topFill = tierMeta[tier]?.color ?? tierMeta.Foundation.color;
    const sideFill = tier === "Research" ? "#203c3b" : tier === "Apex" ? "#1d3440" : "#172a32";
    return (<g transform={`translate(${x} ${y})`} onClick={onClick} style={{ cursor: "pointer" }}>
      {alerted && (<>
          <ellipse cx="0" cy="4" rx={size * 1.15} ry={size * 0.68} fill="none" stroke="#ff8a65" strokeWidth="3" opacity="0.9"/>
          <ellipse cx="0" cy="4" rx={size * 0.98} ry={size * 0.56} fill="#ff8a65" opacity="0.08"/>
        </>)}
      <polygon points={`-${size},0 0,${size * 0.55} ${size},0 0,-${size * 0.55}`} fill="#0b171d" stroke={alerted ? "#ff8a65" : selected ? "#f5c86c" : "#55746d"} strokeWidth={alerted || selected ? 3 : 1.4}/>
      <polygon points={`-${size},0 0,${size * 0.55} 0,${size * 0.55 + height} -${size},${height}`} fill={sideFill}/>
      <polygon points={`0,${size * 0.55} ${size},0 ${size},${height} 0,${size * 0.55 + height}`} fill="#10242c"/>

      {track.id === "solar" ? (<g>
          {Array.from({ length: 2 + level }).map((_, index) => (<polygon key={index} points={`-${size * 0.7 + index * 5},-${size * 0.22} -${size * 0.05 + index * 5},-${size * 0.48} ${size * 0.5 + index * 5},-${size * 0.15} 0,${size * 0.1}`} fill="#244852" stroke={dusted ? "#8f7960" : "#6fb2c6"} opacity={dusted ? 0.7 : 0.95}/>))}
          <line x1="0" y1={-size * 0.05} x2="0" y2={-size * 0.75} stroke="#76939a" strokeWidth="2"/>
        </g>) : track.id === "habitat" ? (<g>
          <ellipse cx="0" cy={-height * 0.72} rx={size * 0.66} ry={size * 0.38} fill="#294f57" opacity="0.96"/>
          <ellipse cx="0" cy={-height * 0.82} rx={size * 0.38} ry={size * 0.2} fill="#6b7f73" opacity="0.45"/>
        </g>) : track.id === "battery" ? (<g>
          {Array.from({ length: 2 + level }).map((_, index) => (<rect key={index} x={-size * 0.55 + index * size * 0.34} y={-height * 0.95} width={size * 0.25} height={height * 1.55} rx="4" fill="#1d3c45" stroke="#688684" strokeWidth="1.2"/>))}
        </g>) : track.id === "rover" ? (<g>
          <rect x={-size * 0.62} y={-height * 0.85} width={size * 1.24} height={height * 0.72} rx="5" fill="#6a6e69" stroke="#c4b88e" strokeWidth="1.5"/>
          <circle cx={-size * 0.45} cy="-1" r="6" fill="#1b2528" stroke="#9ca39b"/>
          <circle cx={size * 0.45} cy="-1" r="6" fill="#1b2528" stroke="#9ca39b"/>
        </g>) : track.id === "agriculture" ? (<g>
          <polygon points={`-${size * 0.65},0 0,-${size * 0.42} ${size * 0.65},0 0,${size * 0.42}`} fill="#37584f" stroke="#7cae8c" strokeWidth="1.2"/>
          <line x1={-size * 0.3} y1="0" x2={size * 0.3} y2="0" stroke="#91c29d" strokeWidth="2" opacity="0.7"/>
        </g>) : track.id === "comms" ? (<g>
          <ellipse cx="0" cy={-height * 1.2} rx={size * 0.48} ry={size * 0.25} fill="#34555d" stroke="#a2bac0" strokeWidth="1.1"/>
          <line x1="0" y1={-height * 1.05} x2="0" y2={-height * 2} stroke="#829a9f" strokeWidth="2"/>
        </g>) : track.id === "extraction" || track.id === "isru" ? (<g>
          <rect x={-size * 0.25} y={-height * 1.55} width={size * 0.5} height={height * 1.2} fill="#475c58" stroke="#a4ae91" strokeWidth="1.2"/>
          <line x1="0" y1={-height * 1.55} x2={size * 0.68} y2={-height * 2.1} stroke="#b0a27c" strokeWidth="4"/>
        </g>) : (<g>
          <rect x={-size * 0.55} y={-height * 1.15} width={size * 1.1} height={height * 1.15} rx="5" fill={topFill} opacity="0.75" stroke="#b7c8b7" strokeWidth="1"/>
          {Array.from({ length: 1 + level }).map((_, index) => (<rect key={index} x={-size * 0.36 + index * size * 0.24} y={-height} width={size * 0.14} height={height * 0.35} rx="1" fill="#e0d9b2" opacity="0.55"/>))}
        </g>)}

      <Icon x={-10} y={-height * 2.25} width={20} height={20} color={selected ? "#f6c96f" : "#b9d4ca"}/>
      <text x="0" y={size * 0.92} textAnchor="middle" fill={selected ? "#f7cf79" : "#b0c4bf"} fontSize="11" fontWeight="700" letterSpacing="1.3">{track.category.toUpperCase()}</text>
      <text x="0" y={size * 0.92 + 14} textAnchor="middle" fill="#6e8d8b" fontSize="8" letterSpacing="0.7">{isTier(tier) ? tier.toUpperCase() : "FOUNDATION"}</text>
      {damaged && <circle cx={size * 0.76} cy={-size * 0.1} r="5" fill="#d77a5a"/>}
    </g>);
}
const RESOURCE_NODES = {
    // Four sites sit beyond the facility pads and service-road perimeter. Their coordinates
    // map to world-space positions near (±30, ±25), so field work requires an actual outbound trip.
    MOON: [
        { id: "moon-ice", label: "ICE DEPOSIT", kind: "ICE", x: -160, y: 120, description: "A cold-trap site beyond the west perimeter with a strong water-ice signature." },
        { id: "moon-mineral", label: "ILMENITE RIDGE", kind: "MINERAL", x: 1160, y: 440, description: "A mineral ridge beyond the east service lanes; core drilling can verify the ilmenite-rich signal." },
        { id: "moon-science", label: "CRATER SAMPLE", kind: "SCIENCE", x: 1204, y: -20, description: "A remote crater ejecta deposit outside the south-east perimeter." },
        { id: "moon-regolith", label: "REGOLITH FIELD", kind: "REGOLITH", x: -160, y: 550, description: "A broad regolith field beyond the western ridge suitable for rover mapping." },
    ],
    MARS: [
        { id: "mars-ice", label: "SUBSURFACE ICE", kind: "ICE", x: -160, y: 120, description: "Orbital data suggests shallow buried water ice beyond the west side of the outpost." },
        { id: "mars-mineral", label: "IRON RIDGE", kind: "MINERAL", x: 1160, y: 440, description: "An iron-rich ridge beyond the outpost's east traffic lanes." },
        { id: "mars-science", label: "BASALT OUTCROP", kind: "SCIENCE", x: 1204, y: -20, description: "A remote basalt outcrop beyond the south-east perimeter, suitable for geological sampling." },
        { id: "mars-regolith", label: "DUST PLAIN", kind: "REGOLITH", x: -160, y: 550, description: "A distant dust plain beyond the west-north service road." },
    ],
};
function IsometricMap({ tracks, selected, buildings, onSelect, selectedBuildingId, elapsed, environmentLabel, environmentTitle, activeEventTrackId, selectedResourceId, surveyedNodes, onSelectResource, roverTask, roverTargetNodeId, speed, }) {
    return (<Colony3DMap tracks={tracks} selected={selected} buildings={buildings} selectedBuildingId={selectedBuildingId} elapsed={elapsed} environmentLabel={environmentLabel === "MARS" ? "MARS" : "MOON"} environmentTitle={environmentTitle} activeEventTrackId={activeEventTrackId} selectedResourceId={selectedResourceId} surveyedNodes={surveyedNodes} resourceNodes={RESOURCE_NODES[environmentLabel === "MARS" ? "MARS" : "MOON"]} onSelect={onSelect} onSelectResource={onSelectResource} roverTask={roverTask} roverTargetNodeId={roverTargetNodeId} simulationSpeed={speed}/>);
}
function MissionTaskRibbon({ pending, elapsed, resolvedEvents, sampleStages, activeEvent, roverTask, }) {
    const day = Math.min(14, Math.floor(Math.max(0, elapsed) / LEVEL1_ENVIRONMENT.secondsPerEarthDay) + 1);
    const eventGoal = EVENT_TIMES.length;
    const surveyedCount = Object.values(sampleStages).filter((stage) => stage !== "UNSURVEYED").length;
    const analysedCount = Object.values(sampleStages).filter((stage) => stage === "ANALYSED").length;
    const taskRows = [
        { label: "SURVIVE", value: `DAY ${day.toString().padStart(2, "0")} / 14`, done: elapsed >= TOTAL_MISSION_SECONDS },
        { label: "RESOLVE INCIDENTS", value: `${resolvedEvents.length} / ${eventGoal}`, done: resolvedEvents.length >= eventGoal },
        { label: "FIELD RESEARCH", value: `${analysedCount} ANALYSED`, done: analysedCount > 0 },
        { label: "SITES MAPPED", value: `${surveyedCount} / ${Math.max(1, RESOURCE_NODES[pending.campaign === "mars" ? "MARS" : "MOON"].length)}`, done: surveyedCount > 0 },
    ];
    return (<div className="pointer-events-none absolute left-3 top-3 z-30 w-[min(88vw,270px)]">
      <div className="pointer-events-auto overflow-hidden rounded-xl border-2 border-[#d3a84a] bg-[#172026]/92 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        <div className="border-b border-[#4d5050] bg-[#101b20] px-3 py-2"><p className="text-[7px] font-black uppercase tracking-[0.15em] text-[#92a6a4]">Simulated Seconds</p><p className="mt-0.5 font-mono text-[10px] font-bold text-[#e2f0e8]">{Math.floor(Math.max(0, elapsed)).toLocaleString()} s</p><p className="mt-1 text-[7px] font-black uppercase tracking-[0.15em] text-[#f2c960]">Game Time · Day {day} / 14</p></div>
        <div className="flex items-center gap-2 border-b border-[#4d5050] bg-[#27363a] px-3 py-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#e2b84f] text-[9px] font-black text-[#20261e]">★</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[8px] font-black uppercase tracking-[0.18em] text-[#f4db87]">{pending.missionTitle}</p>
            <p className="text-[7px] uppercase tracking-[0.15em] text-[#92a6a4]">Mission objectives</p>
          </div>
        </div>
        <div className="space-y-1.5 p-2">
          {taskRows.map((task) => (<div key={task.label} className="flex items-center justify-between gap-3 rounded-lg bg-[#0d171c]/75 px-2.5 py-1.5">
              <span className={`text-[7px] font-black uppercase tracking-[0.12em] ${task.done ? "text-[#7fe19f]" : "text-[#d8e0da]"}`}>
                {task.done ? "✓ " : "○ "}{task.label}
              </span>
              <span className={`shrink-0 text-[7px] font-mono font-bold ${task.done ? "text-[#7fe19f]" : "text-[#f2c960]"}`}>{task.value}</span>
            </div>))}
          <div className="px-1 pt-0.5 text-[7px] uppercase tracking-[0.1em] text-[#728886]">
            {activeEvent ? `Target: ${activeEvent.trackId.toUpperCase()}` : roverTask !== "STANDBY" ? roverTask : "Keep the settlement stable."}
          </div>
        </div>
      </div>
    </div>);
}
function MetricBar({ icon, label, value, suffix = "%", invert = false, }) {
    const safe = clamp(value);
    const displayValue = suffix === "°" ? value.toFixed(1) : Math.round(value);
    return (<div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.16em]">
        <span className="flex min-w-0 items-center gap-1.5 text-[#9eb0aa]">{icon}<span className="truncate">{label}</span></span>
        <span style={{ color: resourceColor(safe, invert) }} className="font-mono font-bold">{displayValue}{suffix}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-[#29434a] bg-[#0a171c]">
        <div className="h-full" style={{ width: `${clamp(value)}%`, background: resourceColor(safe, invert), boxShadow: `0 0 10px ${resourceColor(safe, invert)}55` }}/>
      </div>
    </div>);
}
function BuildingInspector({ track, tier, runtime, onAction, onClose, hasMaintenance, actionBusy, operation, activeFault, activeEvent, eventChoices, onEventChoice, power, battery, batteryCapacityKWh, batteryFlowKW, metrics, getBlockers, selected, earthReport, earthReportAtSeconds, elapsedSeconds, fallbackReadyAt, partsInventoryKg, simulationSpeed, campaign, missionTitle, missionNumber, }) {
    const missionStage = Math.max(1, Number.parseInt((missionNumber ?? "").replace(/[^0-9]/g, ""), 10) || 1);
    const isFirstMission = missionStage === 1;
    const actionMap = {
        solar: [
            { id: "fallback-solar", label: "Manual panel brush", detail: "Small dust removal and a tiny generation recovery; needs no grid, battery, or rover." },
            { id: "clean", label: "Clean array", detail: "Use rover or maintenance support for a stronger cleaning pass." },
            { id: "tune", label: "Tune tracking", detail: "Use navigation + comms to optimise solar angle and track the Sun." },
            { id: "solar-autonomous-clean", label: "Autonomous cleaning pass", detail: "Rover + maintenance + navigation verify the cleaning result and reduce panel wear." },
        ],
        battery: [
            { id: "fallback-battery", label: "Isolate parasitic draw", detail: "Local BMS recovery protects a little usable reserve without relying on the grid." },
            { id: "balance", label: "Balance cells", detail: "Solar + grid support a higher-quality charge-balancing cycle." },
            { id: "reserve", label: "Set reserve", detail: "Grid control protects emergency storage and reshapes the power margin." },
            { id: "battery-thermal-recondition", label: "Thermal BMS reconditioning", detail: "Thermal control + maintenance + grid enable stronger cell conditioning." },
        ],
        grid: [
            { id: "fallback-grid", label: "Emergency load shedding", detail: "Manual breakers isolate non-critical loads and recover a tiny power margin." },
            { id: "balance-grid", label: "Balance bus", detail: "Solar + battery stabilise the distribution bus." },
            { id: "prioritize", label: "Prioritize critical", detail: "Oxygen + water + battery enable life-support-first load scheduling." },
            { id: "grid-black-start", label: "Black-start the bus", detail: "Solar, a charged battery, and maintenance restart the grid with a stronger recovery." },
        ],
        habitat: [
            { id: "fallback-habitat", label: "Emergency seal patch", detail: "Apply a small manual pressure patch with no powered repair rig." },
            { id: "repair", label: "Repair seal", detail: hasMaintenance ? "Maintenance support enables a stronger structural seal repair." : "Requires maintenance bay + thermal control." },
            { id: "seal", label: "Pressure check", detail: "Maintenance + thermal control support a focused leak-isolation cycle." },
            { id: "habitat-composite-patch", label: "Cure structural composite", detail: "ISRU material + maintenance + thermal control create a stronger, longer-lasting patch." },
        ],
        water: [
            { id: "fallback-water", label: "Gravity-fed recovery", detail: "Recover a small amount of condensate without powered purification." },
            { id: "flush", label: "Flush loop", detail: "Habitat + oxygen + CO₂ processing help restore the water-recovery path." },
            { id: "purify", label: "Deep purify", detail: "The same life-support loop plus more power yields a larger clean-water gain." },
            { id: "water-distillate-recovery", label: "Waste-heat distillation", detail: "Thermal control + habitat + grid recover more water using waste heat." },
        ],
        oxygen: [
            { id: "fallback-oxygen", label: "Release oxygen reserve", detail: "Release a small amount from the local contingency bottle; no external loop is required." },
            { id: "reset", label: "Reset loop", detail: "Water + CO₂ + habitat systems restore normal oxygen processing." },
            { id: "boost", label: "Boost output", detail: "Run a higher-power oxygen cycle using the complete life-support loop." },
            { id: "oxygen-electrolyser-burst", label: "Electrolyse reclaimed water", detail: "Water + grid + thermal control enable extra oxygen production at a water and energy cost." },
        ],
        co2: [
            { id: "fallback-co2", label: "Swap passive sorbent", detail: "A manual sorbent cartridge provides a small air-quality improvement without the full loop." },
            { id: "scrub", label: "Run scrubber", detail: "Habitat + oxygen loop support stronger CO₂ removal." },
            { id: "recover", label: "Recover carbon", detail: "Recover useful carbon compounds while maintaining cabin air quality." },
            { id: "co2-crop-loop", label: "Greenhouse carbon exchange", detail: "Agriculture + water + oxygen reuse captured CO₂ in a controlled crop loop." },
        ],
        thermal: [
            { id: "fallback-thermal", label: "Close insulation shutters", detail: "Passive insulation gently damps temperature drift without a heater load." },
            { id: "dump", label: "Dump heat", detail: "Habitat + an energy source let the thermal loop move temperature toward its target." },
            { id: "insulate", label: "Protect thermal", detail: "Use powered thermal control to reduce drift and protect equipment condition." },
            { id: "thermal-waste-heat-recovery", label: "Recover waste heat", detail: "Grid + battery + habitat route usable waste heat back into the thermal loop." },
        ],
        comms: [
            { id: "fallback-comms", label: "Reset low-rate beacon", detail: "Restore a basic local beacon; high-rate Earth reports need a working communication path." },
            { id: "repoint", label: "Repoint antenna", detail: "Navigation and an energy source restore the high-gain pointing solution." },
            { id: "test", label: "Link test", detail: "Navigation support verifies the communications health and link margin." },
            { id: "comms-priority-window", label: "Schedule priority uplink", detail: "Navigation timing + grid reserve a high-gain Earth communication window." },
        ],
        radiation: [
            { id: "fallback-radiation", label: "Crew shelter lockdown", detail: "Use passive habitat shielding to reduce near-term exposure." },
            { id: "shield", label: "Check shielding", detail: "Habitat + maintenance improve the shielding inspection and protection plan." },
            { id: "shelter", label: "Shelter protocol", detail: "Use the habitat and stored/grid power for a stronger shelter response." },
            { id: "radiation-regolith-berm", label: "Build regolith berm", detail: "Habitat + extraction + ISRU add shielding mass around the protected volume." },
        ],
        science: [
            { id: "fallback-science", label: "Bench recalibration", detail: "Perform a basic local instrument reference check without consuming a sample." },
            { id: "calibrate", label: "Calibrate", detail: "Navigation + comms + thermal control support reference-grade science calibration." },
            { id: "experiment", label: "Run experiment", detail: "An analysed specimen is required before an experiment can claim a science result." },
            { id: "science-fusion", label: "Fuse specimen datasets", detail: "Analyse a sample, verify extracted feed, and combine it with navigation/thermal telemetry." },
        ],
        navigation: [
            { id: "fallback-navigation", label: "Re-zero inertial sensors", detail: "Local dead-reckoning still works when the Earth link or relay is unavailable." },
            { id: "nav-calibrate", label: "Calibrate nav", detail: "A working comms link and energy source tighten the navigation solution." },
            { id: "route", label: "Plan route", detail: "Rover + comms support safe route planning for surface jobs." },
            { id: "request-earth-report", label: "Request Earth report", detail: "Fetch mission-control guidance. Navigation tier and retrofits shorten the simulated processing queue." },
        ],
        rover: [
            { id: "fallback-rover", label: "Check wheel encoders", detail: "Run a local manual check without depending on remote navigation." },
            { id: "survey", label: "Survey site", detail: "Rover + navigation + comms are required to reach and map a field site." },
            { id: "return", label: "Return home", detail: "Use navigation and an energy source to return to the launch lane." },
            { id: "inspect", label: "Inspect rover", detail: "Check wheels, payload, and navigation health." },
        ],
        extraction: [
            { id: "fallback-extraction", label: "Unload drill torque", detail: "Safely clear a local torque latch; no material is extracted." },
            { id: "extract-test", label: "Test drill", detail: "A surveyed site, rover, navigation, water, and sufficient power are required." },
            { id: "extract", label: "Extract sample", detail: "The drill produces a larger resource yield but consumes power and battery." },
            { id: "extraction-waterjet", label: "Water-assisted core drilling", detail: "Rover + navigation + water + maintenance improve yield but use water and energy." },
        ],
        isru: [
            { id: "fallback-isru", label: "Isolate process line", detail: "Purge and stabilise the local process line without feedstock." },
            { id: "process", label: "Process feed", detail: "A functioning drill and water loop must supply usable feedstock." },
            { id: "purge", label: "Purge line", detail: "Clear the feed system and reduce pressure risk." },
            { id: "isru-oxygen-feed", label: "Process oxygen-bearing feed", detail: "Verified drill feedstock + water + oxygen processing + grid are required." },
        ],
        agriculture: [
            { id: "fallback-agriculture", label: "Harvest ready biomass", detail: "Recover a small amount of already-mature food even if a support loop is offline." },
            { id: "tune-crops", label: "Tune crops", detail: "Water + CO₂ + oxygen + thermal + habitat are required for closed-loop tuning." },
            { id: "harvest", label: "Harvest", detail: "Collect mature crop output; a working life-support loop improves the yield." },
            { id: "agriculture-closed-loop", label: "Run full closed-loop grow", detail: "Science-guided crops combine water, CO₂, oxygen, thermal and habitat systems for a larger food gain." },
        ],
        maintenance: [
            { id: "fallback-maintenance", label: "Manual walk-around", detail: "A minor hands-on service remains possible without telemetry or powered bay tools." },
            { id: "service", label: "Service", detail: "Preventatively service the weakest colony system." },
            { id: "diagnostics", label: "Diagnostics", detail: "Scan for developing faults before they become events." },
            { id: "maintenance-overhaul", label: "Telemetry-guided overhaul", detail: "Comms + navigation + grid let maintenance service multiple systems more effectively." },
        ],
    };
    const allActions = buildSystemActionChoices(track.id, actionMap[track.id] ?? [{ id: "inspect", label: "Inspect system", detail: "Review current operating condition." }]);
    const [showRepairMethods, setShowRepairMethods] = useState(true);
    const [repairCategory, setRepairCategory] = useState("Standalone");
    const repairOptions = getRepairOptions(track.id);
    useEffect(() => {
        if (!activeFault)
            return;
        setShowRepairMethods(true);
        setRepairCategory("Standalone");
    }, [activeFault?.eventId, track.id]);
    const primaryRepairMetric = getPrimaryRepairMetric(track.id);
    const remainingRepairGap = primaryRepairMetric ? runtime.repairMetrics?.[repairGapKey(primaryRepairMetric)] : undefined;
    const actions = allActions.filter((action) => !/^variant:/.test(action.id) && !LEGACY_REPAIR_ACTIONS.has(action.id));
    const Icon = categoryIcons[track.category] ?? Factory;
    const condition = Math.round(runtime.condition);
    const dust = Math.round(runtime.dust);
    const upgradeLevel = runtime.upgradeLevel ?? 0;
    const nextInstallation = getRetrofitInstallation(track.id, tier, upgradeLevel);
    const nextInstallationSeconds = [12, 15, 18, 20][Math.min(3, upgradeLevel)];
    const connection = SYSTEM_CONNECTIONS[track.id] ?? {};
    const downstream = Object.entries(SYSTEM_CONNECTIONS).filter(([id, links]) => links.outputs?.includes(track.id) || (id === "maintenance" && track.id !== "maintenance" && links.outputs?.includes("all systems"))).map(([id]) => id);
    const connectionText = [
        ...(connection.all ?? []).map((id) => SYSTEM_LABELS[id] ?? id),
        ...(connection.any?.length ? [connection.any.map((id) => SYSTEM_LABELS[id] ?? id).join(" OR ")] : []),
    ];
    const connectionBlockers = getBlockers(track.id, "link-check");
    const canUpgrade = upgradeLevel < 2 && Boolean(nextInstallation) && power >= 8 && battery >= 5 && !operation && getBlockers(track.id, "upgrade").length === 0 && ((missionNumber ?? "").replace(/[^0-9]/g, "") === "1" || partsInventoryKg >= (nextInstallation?.materialKg ?? Number.POSITIVE_INFINITY));
    return (<div className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex justify-center px-3 sm:bottom-5">
      <div className="pointer-events-auto max-h-[84vh] w-[min(94vw,520px)] overflow-y-auto rounded-[26px] border border-[#6e7d7b] bg-[#0b1519]/[0.98] shadow-[0_24px_70px_rgba(0,0,0,0.62)] backdrop-blur-md">
        <div className="relative overflow-hidden border-b border-[#30454b] bg-gradient-to-r from-[#172b32] via-[#152329] to-[#111a1f] px-5 py-4">
          <div className="absolute right-[-30px] top-[-40px] h-32 w-32 rounded-full bg-[#f4c75e]/[0.06] blur-2xl"/>
          <div className="relative flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#415961] bg-[#081116]">
              <Icon className="h-6 w-6" style={{ color: tierMeta[tier].color }}/>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: tierMeta[tier].color }}>{track.category} · {tier}</p>
              <h2 className="mt-1 truncate text-lg font-black uppercase tracking-[0.06em] text-white sm:text-xl">{track.tiers[tier].name}</h2>
              <p className="mt-1 text-[11px] leading-4 text-[#9fb0b2]">{track.description}</p>
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#3c5056] bg-[#0a1317] text-xl text-[#9fb0b3] transition hover:border-[#f0c964] hover:text-white" aria-label="Close building panel">×</button>
          </div>
          <div className="mt-3 rounded-xl border border-[#314e4d] bg-[#0d1d21] px-3 py-2.5">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#87aaa2]">Rated operating output · current tier + retrofit</p>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[9px] text-[#b6c9c3]">{physicalSystemOutput(track.id, tier, upgradeLevel, runtime.condition, runtime.dust, runtime.repairMetrics, elapsedSeconds, campaign, missionTitle, missionNumber).label}</span>
              <span className="min-w-0 whitespace-normal break-words text-right font-mono text-[10px] font-black leading-5 text-[#a8edc2]">{physicalSystemOutput(track.id, tier, upgradeLevel, runtime.condition, runtime.dust, runtime.repairMetrics, elapsedSeconds, campaign, missionTitle, missionNumber).value}</span>
            </div>
            <p className="mt-1 text-[8px] leading-4 text-[#799994]">Retrofit {upgradeLevel}/2 changes only this rated capability. It does not restore condition, remove dust, clear faults or refill stored resources; the next tier is a separate rating state.</p>
            {runtime.repairMetrics && Object.keys(runtime.repairMetrics).some((metric) => !metric.startsWith(REPAIR_GAP_PREFIX) && !metric.startsWith(REPAIR_GAP_INITIAL_PREFIX)) && <div className="mt-2 border-t border-[#284542] pt-2"><p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#87aaa2]">Last measured repair / calibration outputs</p>{Object.entries(runtime.repairMetrics).filter(([metric]) => !metric.startsWith(REPAIR_GAP_PREFIX) && !metric.startsWith(REPAIR_GAP_INITIAL_PREFIX)).map(([metric, amount]) => <p key={metric} className="mt-1 text-[8px] leading-4 text-[#a8c6ba]">{metric}: <span className="font-mono text-[#d9f3e1]">{formatRating(amount)}</span></p>)}</div>}
          </div>
          {track.id === "battery" && (<div className="mt-3 rounded-xl border border-[#3a5b65] bg-[#0b1b22] px-3 py-2.5">
              <p className="text-[8px] font-black uppercase tracking-[0.15em] text-[#8fc9d8]">Live battery telemetry</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="text-[9px] text-[#a9c4c9]">Actual bus power transfer</span>
                <span className="font-mono text-[10px] font-black text-[#b9f0ff]">
                  {Math.abs(batteryFlowKW) < 0.01 ? "0.00 kW · idle" : Math.abs(batteryFlowKW).toFixed(2) + " kW · " + (batteryFlowKW > 0 ? "discharging" : "charging")}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="text-[9px] text-[#a9c4c9]">Stored energy</span>
                <span className="font-mono text-[10px] text-[#b9f0ff]">{(battery / 100 * batteryCapacityKWh).toFixed(1)} / {batteryCapacityKWh.toFixed(0)} kWh</span>
              </div>
              <p className="mt-1 text-[8px] leading-4 text-[#7fa6b0]">Rated maximum is a hardware limit, not the current output. Actual flow follows the live power deficit/surplus and stops at the protected 20% reserve.</p>
            </div>)}
          <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.16em]">
                <span className="text-[#87999d]">Equipment condition index</span>
                <span style={{ color: resourceColor(runtime.condition) }}>{condition}/100</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#22343a]">
                <div className="h-full rounded-full transition-all" style={{ width: `${condition}%`, background: resourceColor(runtime.condition) }}/>
              </div>
            </div>
            {track.id === "solar" && (<div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#87999d]">Dust load</p>
                <p className="mt-0.5 font-mono text-sm text-[#e9c865]">{dust}%</p>
              </div>)}
          </div>
        </div>

        <section className="mx-4 mt-3 rounded-xl border border-[#2d4d53] bg-[#0d2025] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#8dc9b6]">System connections</p>
            <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${connectionBlockers.length ? "bg-[#40242a] text-[#ffadb5]" : "bg-[#173d32] text-[#8ce3b0]"}`}>{connectionBlockers.length ? "LINKS OFFLINE" : "LINKS ONLINE"}</span>
          </div>
          <p className="mt-1.5 text-[9px] leading-4 text-[#a5c0c1]">{connectionText.length ? `Requires: ${connectionText.join(" · ")}` : "Upstream source system — produces or anchors a core colony resource."}</p>
          <p className="mt-1 text-[9px] leading-4 text-[#6fa294]">Feeds: {downstream.length ? downstream.map((id) => SYSTEM_LABELS[id] ?? id).join(" · ") : "No direct downstream consumer"}</p>
        </section>

        {track.id === "water" && (<section className="mx-4 mt-3 rounded-xl border border-[#2c6670] bg-gradient-to-br from-[#0c2931] to-[#0b1b23] p-3">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#8dd9eb]">Potable-water storage</p><p className="mt-1 text-[8px] leading-4 text-[#83aeb8]">Four independent reserve tanks · 45 L nominal per tank</p></div>
              <div className="text-right"><p className="font-mono text-sm font-black text-[#b9f0ff]">{Math.round(metrics.water / 100 * RESOURCE_CAPACITIES.waterReserveL)} L</p><p className="text-[8px] text-[#83aeb8]">of {RESOURCE_CAPACITIES.waterReserveL} L</p></div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((tank) => {
                const tankFill = clamp(metrics.water / 100 * 4 - tank) * 100;
                return <div key={tank} className="flex flex-col items-center gap-1">
                  <div className="relative h-16 w-9 overflow-hidden rounded-t-[13px] rounded-b-[8px] border-2 border-[#4c8995] bg-[#07161c] shadow-inner">
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#167ea2] to-[#65d8ee] transition-[height]" style={{ height: `${tankFill}%` }}/>
                    <div className="absolute inset-y-1 left-1 w-1 rounded-full bg-white/20"/>
                    <div className="absolute inset-x-1 top-1 h-1 rounded-full bg-[#8cd9e7]/35"/>
                  </div>
                  <span className="text-[7px] font-bold uppercase tracking-[0.08em] text-[#85b9c3]">Tank {tank + 1}</span>
                  <span className="font-mono text-[8px] text-[#c6f2fb]">{Math.round(tankFill / 100 * 45)} L</span>
                </div>;
            })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#24505a] pt-2 text-[8px]"><span className="text-[#83aeb8]">Water recovery status</span><span className={`font-black ${metrics.water < 28 ? "text-[#ff9aa2]" : "text-[#91e6c1]"}`}>{metrics.water < 28 ? "LOW RESERVE" : runtime.condition < 30 ? "RESTRICTED" : "TRACKING RESERVE"}</span></div>
          </section>)}
        {track.id === "agriculture" && (<section className="mx-4 mt-3 rounded-xl border border-[#4e7147] bg-gradient-to-br from-[#172a1b] to-[#101e18] p-3">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#b3e78c]">Edible food stores</p><p className="mt-1 text-[8px] leading-4 text-[#8eb28a]">Six sealed food containers · 7 kg nominal per container</p></div>
              <div className="text-right"><p className="font-mono text-sm font-black text-[#d6f7ad]">{(metrics.food / 100 * RESOURCE_CAPACITIES.foodReserveKg).toFixed(1)} kg</p><p className="text-[8px] text-[#8eb28a]">of {RESOURCE_CAPACITIES.foodReserveKg} kg</p></div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[0, 1, 2, 3, 4, 5].map((crate) => {
                const crateFill = clamp(metrics.food / 100 * 6 - crate) * 100;
                return <div key={crate} className="relative overflow-hidden rounded-md border border-[#657b48] bg-[#0b1711] p-1.5">
                  <div className="relative h-7 overflow-hidden rounded-sm border border-[#6e8650] bg-[#17271a]">
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#497b2d] to-[#b6df68] transition-[height]" style={{ height: `${crateFill}%` }}/>
                    <div className="absolute inset-y-0 left-1/2 w-px bg-[#d5f2a2]/35"/>
                    <div className="absolute inset-x-0 top-1/2 h-px bg-[#d5f2a2]/35"/>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-1"><span className="text-[7px] font-bold uppercase text-[#a8c68e]">Crate {crate + 1}</span><span className="font-mono text-[7px] text-[#d6f7ad]">{(crateFill / 100 * 7).toFixed(1)} kg</span></div>
                </div>;
            })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#344c31] pt-2 text-[8px]"><span className="text-[#8eb28a]">Crop production / crew use</span><span className={`font-black ${metrics.food < 28 ? "text-[#ff9aa2]" : "text-[#bdeca0]"}`}>{metrics.food < 28 ? "LOW RESERVE" : "STORAGE TRACKING"}</span></div>
            <p className="mt-2 text-[8px] leading-4 text-[#789776]">Crates represent the colony's stored edible dry-food equivalent. Crop output is added to this reserve; crew consumption removes food every simulated day.</p>
          </section>)}
        {track.id === "navigation" && (<section className="mx-4 mt-3 rounded-xl border border-[#435b73] bg-gradient-to-br from-[#101d2c] to-[#111b22] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8dc8e8]">Earth Mission Control</p>
              <span className="rounded-full border border-[#456c81] bg-[#162b3d] px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#a5d9f0]">{earthReport ? "REPORT RECEIVED" : "AWAITING UPLINK"}</span>
            </div>
            <div className="mt-2 flex items-start gap-2">
              <Radio className="mt-0.5 h-4 w-4 shrink-0 text-[#76bddf]"/>
              <p className="text-[9px] leading-4 text-[#a8c0d0]">
                {earthReport ? `Last report received at ${formatMissionTime(earthReportAtSeconds)}.` : `Mission ${formatMissionTime(elapsedSeconds)}: request a report for power, life support, faults, field science and the recommended next action.`}
                {" "}Queue estimate: <span className="font-bold text-[#f0cf69]">{earthReportDelaySeconds(tier, upgradeLevel) === 0 ? "INSTANT · local cache" : `${earthReportDelaySeconds(tier, upgradeLevel)} simulated seconds`}</span>.
              </p>
            </div>
            <p className="mt-2 text-[8px] leading-4 text-[#6f95aa]">This is a compressed Earth processing / command queue, not adjustable light-speed. Each higher Navigation tier shortens the queue more than both retrofits combined; Research with 2/2 caches guidance locally for instant delivery.</p>
            {earthReport && (<div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-[#2c4a5d] bg-[#07131f] p-3">
                <pre className="whitespace-pre-wrap font-mono text-[9px] leading-4 text-[#d1e3ee]">{earthReport}</pre>
              </div>)}
          </section>)}

        {operation && (<section className="mx-4 mt-4 rounded-2xl border border-[#5c9e87] bg-gradient-to-r from-[#12392f] to-[#10262c] p-4 shadow-[0_0_28px_rgba(79,210,158,0.10)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-[#a9f2c8]">
                <Activity className="h-4 w-4 shrink-0 animate-pulse"/>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em]">Work in progress</p>
                  <p className="mt-0.5 min-w-0 whitespace-normal break-words text-[10px] font-bold leading-4 text-white">{operation.label}</p>{operation.supportSystems?.length ? <p className="mt-1 text-[8px] font-semibold text-[#8fc8b0]">Systems: {[operation.targetId, ...operation.supportSystems].map((id) => SYSTEM_LABELS[id] ?? id).join(" + ")}</p> : null}
                </div>
              </div>
              <span className="shrink-0 rounded-lg border border-[#7dd6ad]/40 bg-[#071c19]/80 px-2.5 py-1.5 font-mono text-sm font-black text-[#b0ffd0]">{`${formatWallClockCountdown(operation.remainingSeconds, simulationSpeed)}s`}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#233f3e]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#31ce9b] to-[#f1d16a] transition-[width]" style={{ width: `${clamp(100 * (1 - operation.remainingSeconds / operation.totalSeconds))}%` }}/>
            </div>
            <p className="mt-2 text-[9px] leading-4 text-[#a1c8bb]">This system is busy until its final check completes. Other colony systems can work in parallel.</p>
          </section>)}

        {(activeFault || repairOptions.length > 0) && (<section className={`mx-4 mt-4 rounded-2xl border p-4 ${activeFault ? "border-[#a84c58] bg-gradient-to-r from-[#321a22] to-[#211a25] shadow-[0_0_28px_rgba(232,74,99,0.12)]" : "border-[#3a6660] bg-gradient-to-r from-[#122a28] to-[#142329]"}`}>
            <div className="flex items-start gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${activeFault ? "border-[#a54d5b] bg-[#5a2531] text-[#ff8992]" : "border-[#3c7565] bg-[#173a32] text-[#8fe0b5]"}`}>{activeFault ? <AlertTriangle className="h-5 w-5"/> : <Wrench className="h-5 w-5"/>}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-[9px] font-black uppercase tracking-[0.16em] ${activeFault ? "text-[#ff9aa2]" : "text-[#8dd9b7]"}`}>{activeFault ? "Unresolved equipment fault" : "Preventative service & repair"}</p>
                <h3 className="mt-1 text-[11px] font-black uppercase text-white">{activeFault?.title ?? "System recovery procedures"}</h3>
                {activeFault ? <p className="mt-1 text-[9px] leading-4 text-[#dcbac1]">Severity {activeFault.severity.toFixed(1)}× · {activeFault.remainingSeconds > 0 ? `${Math.ceil(activeFault.remainingSeconds)}s before the next escalation` : "escalation window expired"}. This fault remains until the procedure restores the relevant function and verification finishes.</p> : <p className="mt-1 text-[9px] leading-4 text-[#a5c8be]">Choose one of the four categories below to inspect exact effects, duration, energy and parts requirements. Standalone procedures require no optional support systems.</p>}
                {activeFault && typeof remainingRepairGap === "number" && track.id !== "solar" && track.id !== "maintenance" && <p className="mt-2 text-[8px] font-bold leading-4 text-[#ffcb8d]">Remaining performance shortfall: {formatRating(remainingRepairGap)} {repairOptions.find((option) => option.metric === primaryRepairMetric)?.unit ?? ""}. A partial repair leaves the fault active; choose another category/procedure to finish recovery.</p>}
              </div>
            </div>
            <button type="button" onClick={() => setShowRepairMethods((open) => !open)} className="mt-3 flex w-full items-center justify-between rounded-xl border border-[#526b74] bg-[#14272e] px-3 py-2.5 text-left hover:border-[#e8c568]">
              <span>
                <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-[#c7e5e0]">Repair catalogue · select a recovery category</span>
                <span className="mt-0.5 block text-[8px] text-[#8faeae]">{isFirstMission ? "Mission 1: inspect numerical effects, activation energy and repair duration." : `Stock: ${partsInventoryKg.toFixed(2)} kg · categories filter procedures and show live effects, duration, energy, parts, trade-offs and lock reasons.`}</span>
              </span>
              <span className="text-[9px] font-black text-[#f1cf70]">{showRepairMethods ? "HIDE −" : "VIEW OPTIONS +"}</span>
            </button>
            {showRepairMethods && <div className="mt-2 grid gap-2">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {["Standalone", "Enhanced", "Dual", "Integrated"].map((category) => {
                    const count = repairOptions.filter((option) => option.category === category).length;
                    const label = category === "Dual" ? "Dual-System" : category === "Integrated" ? "Fully Integrated" : category;
                    return (<button key={category} type="button" onClick={() => setRepairCategory(category)} aria-pressed={repairCategory === category} className={`rounded-lg border px-2 py-2 text-[8px] font-black uppercase tracking-[0.08em] transition ${category === "Standalone" ? (repairCategory === category ? "border-[#79d9a1] bg-[#286b49] text-white" : "border-[#32674b] bg-[#0b1519] text-[#9bdcb4] hover:border-[#79d9a1]") : category === "Enhanced" ? (repairCategory === category ? "border-[#72c8ff] bg-[#245b80] text-white" : "border-[#2c5b77] bg-[#0b1519] text-[#91d4ff] hover:border-[#72c8ff]") : category === "Dual" ? (repairCategory === category ? "border-[#c49bff] bg-[#5b3b86] text-white" : "border-[#5b4378] bg-[#0b1519] text-[#c6a7f4] hover:border-[#c49bff]") : (repairCategory === category ? "border-[#f0ca63] bg-[#9a7421] text-white" : "border-[#705b2b] bg-[#0b1519] text-[#e6c96f] hover:border-[#f0ca63]")}`}>
                      <span className="block">{label}</span>
                      <span className={`mt-0.5 block font-mono text-[7px] ${repairCategory === category ? "text-[#403a24]" : "text-[#759391]"}`}>
                        {count} {count === 1 ? "option" : "options"}
                      </span>
                    </button>);
                })}
              </div>
              <div className="rounded-lg border border-[#2e4c51] bg-[#0a1a20] px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#d5e9df]">
                  {repairCategory === "Standalone" ? "Standalone · no optional support required" :
                    repairCategory === "Enhanced" ? "Enhanced · one support system required" :
                        repairCategory === "Dual" ? "Dual-system · both listed support systems required" :
                            "Fully integrated · all three support systems required"}
                </p>
                <p className="mt-1 text-[8px] leading-4 text-[#86a6a1]">
                  Values shown are limited by the lowest technology tier among the target and required support systems. Exact effects, costs, and blockers are shown on each procedure.
                </p>
              </div>
              {repairOptions.filter((option) => option.category === repairCategory).map((option) => {
                    const blockers = getBlockers(track.id, `repair:${option.id}`);
                    const tierIndex = effectiveRepairTierIndex(tier, option.requiredSystems, selected);
                    const outcomeLines = describeRepairOptionOutcome(track.id, option, tierIndex, runtime.dust);
                    const supportLabels = option.requiredSystemNames.length ? option.requiredSystemNames.join(" + ") : "None — standalone";
                    return (<button key={option.id} type="button" onClick={() => onAction(`repair:${option.id}`)} disabled={actionBusy || Boolean(operation) || blockers.length > 0} className="rounded-xl border border-[#354f59] bg-[#0d1c22] px-3 py-3 text-left transition hover:border-[#e8c568] hover:bg-[#12262b] disabled:cursor-not-allowed disabled:opacity-40">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 whitespace-normal break-words text-[9px] font-black leading-4 text-[#e1eeee]">{option.name}</span>
                      <span className="shrink-0 rounded-md border border-[#526d88] bg-[#192c3e] px-2 py-1 font-mono text-[8px] font-black text-[#a9d8ff]">
                        {(option.category === "Standalone" ? [8, 9, 10, 12][tierIndex] : option.category === "Enhanced" ? [15, 16, 18, 20][tierIndex] : option.category === "Dual" ? [22, 24, 27, 30][tierIndex] : [30, 33, 36, 40][tierIndex])} s
                      </span>
                    </span>
                    <span className="mt-1 block min-w-0 whitespace-normal break-words text-[8px] leading-4 text-[#91aaa9]">{option.mechanism}</span>
                    <span className="mt-2 block min-w-0 whitespace-normal break-words text-[8px] font-bold leading-4 text-[#c4d9d6]">Requires: {supportLabels}</span>
                    <span className="mt-2 block text-[8px] font-black uppercase tracking-[0.08em] text-[#a9dbb7]">Expected numerical effect</span>
                    {outcomeLines.map((line, index) => (<span key={`${option.id}-effect-${index}`} className="mt-1 block text-[9px] font-semibold leading-4 text-[#d7f0df]">
                        {line}
                      </span>))}
                    <span className="mt-2 block min-w-0 whitespace-normal break-words text-[8px] leading-4 text-[#d8c18a]">
                      {missionStage === 1
                            ? `Activation cost: ${option.energyKWh} kWh`
                            : `Activation cost: ${option.energyKWh} kWh · ${option.partsMassKg} kg parts · ${option.kit}`}
                    </span>
                    <span className="mt-1 block min-w-0 whitespace-normal break-words text-[8px] leading-4 text-[#8fa7ab]">
                      {option.tradeoff}
                    </span>
                    <span className="mt-1 block min-w-0 whitespace-normal break-words text-[8px] leading-4 text-[#91b7b0]">
                      Limit: {option.cap}
                    </span>
                    <span className={`mt-1 block text-[8px] leading-4 ${blockers.length ? "text-[#ffadb5]" : "text-[#77b995]"}`}>
                      {blockers.length ? `LOCKED: ${blockers.join(" · ")}` : "Ready — select to start this procedure."}
                    </span>
                  </button>);
                })}
              {repairOptions.filter((option) => option.category === repairCategory).length === 0 && (<p className="rounded-lg border border-[#40565b] bg-[#0d1c22] p-3 text-[9px] text-[#aab8b9]">
                  No procedures are defined for this category and system.
                </p>)}
            </div>}
          </section>)}

        {activeEvent && eventChoices.length > 0 && (<section className="border-b border-[#733943] bg-[#21151b] p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#ff5367]/15 text-[#ff7380]"><CircleDot className="h-4 w-4"/></span>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ff7783]">Disaster response required</p>
                <h3 className="mt-0.5 text-xs font-black uppercase tracking-[0.06em] text-white">{activeEvent.title}</h3>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-[#d2bec4]">{activeEvent.summary}</p>
            <div className="mt-3 grid gap-2">
              {eventChoices.map((choice, index) => (<button key={choice.id} type="button" onClick={() => onEventChoice(choice.id)} disabled={actionBusy} className="rounded-xl border border-[#71404b] bg-[#2a1b22] p-2.5 text-left transition hover:border-[#f4cd6c] hover:bg-[#33222a] disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#ff5367]/15 text-[9px] font-black text-[#ffd875]">{index + 1}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.04em] text-white">{choice.label}</span>
                  </span>
                  <span className="mt-1 block pl-8 text-[9px] leading-4 text-[#c2afb7]">{choice.detail}</span>
                </button>))}
            </div>
          </section>)}

        {actions.length > 0 && (<section className="mx-4 mt-4 rounded-xl border border-[#304d53] bg-[#0c1b20] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-[9px] font-black uppercase tracking-[0.14em] text-[#dcebe4]">System operations</h3>
      <span className="text-[8px] text-[#8faeae]">Non-repair tasks only · repairs are in the category catalogue above</span>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {actions.map((action, index) => {
                const blockers = getBlockers(track.id, action.id);
                const emergencyOverride = action.id.startsWith("fallback-") && fallbackEmergencyOverride(action.id, track.id, metrics, Boolean(activeFault));
                const fallbackRemaining = action.id.startsWith("fallback-") && !emergencyOverride
                    ? Math.max(0, (fallbackReadyAt[`${track.id}:${action.id}`] ?? 0) - elapsedSeconds)
                    : 0;
                const locked = blockers.length > 0 || fallbackRemaining > 0;
                const lockMessage = blockers.length > 0
                    ? blockers.join(" · ")
                    : fallbackRemaining > 0
                        ? `Emergency backup recharge · ${formatWallClockCountdown(fallbackRemaining, simulationSpeed, GAME_TIME_ACCELERATION)} seconds`
                        : "";
                const variant = decodeActionVariant(track.id, action.id);
                const actionDuration = action.id === "request-earth-report" ? earthReportDelaySeconds(tier, upgradeLevel) : (SYSTEM_ACTION_SECONDS[variant?.baseActionId ?? action.id] ?? 6);
                const displayedActionDuration = actionDuration;
                const displayedActionDurationLabel = Number.isInteger(displayedActionDuration) ? displayedActionDuration.toFixed(0) : displayedActionDuration.toFixed(1);
                return (<button key={action.id} type="button" onClick={() => onAction(action.id)} disabled={actionBusy || Boolean(operation) || locked} className="group min-w-0 rounded-2xl border border-[#35505a] bg-[#14262d] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#f2cd64] hover:bg-[#1b343d] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0">
              <span className="flex items-start gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0a1519] text-[10px] font-black text-[#f4cf65]">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.05em] text-white">{action.label}</span>
                    <span className={action.id.startsWith("fallback-") ? "mt-1 inline-flex rounded px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.12em] border border-[#477e65] bg-[#173426] text-[#9ce3b2]" : "mt-1 inline-flex rounded px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.12em] border border-[#526d88] bg-[#192c3e] text-[#9ed1f1]"}>
                      {action.id.startsWith("fallback-") ? "Emergency backup" : "System task"}
                    </span>
                    <span className="rounded-md border border-[#45636a] bg-[#0b171b] px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#9de8c0]">{actionDuration === 0 ? "INSTANT" : `~${displayedActionDurationLabel}s`}</span>
                  </span>
                  <span className="mt-1.5 block text-[9px] leading-4 text-[#a9c2c4]">{action.id === "request-earth-report" ? `Earth Mission Control report · ${actionDuration === 0 ? "instant local predictive cache" : `${displayedActionDurationLabel}s real time`}` : `${SYSTEM_ACTION_EFFECTS[action.id] ?? action.detail}`}</span>
                  {locked ? <span className="mt-2 block rounded-lg border border-[#74424b] bg-[#2b1b20] px-2 py-1.5 text-[8px] font-bold leading-4 text-[#ffabb2]">{fallbackRemaining > 0 ? "BACKUP RECHARGING" : emergencyOverride ? "EMERGENCY OVERRIDE READY" : "LOCKED"} · {lockMessage}</span> : <span className="mt-2 block text-[8px] font-black uppercase tracking-[0.1em] text-[#83dba7]">{action.id.startsWith("fallback-") ? "Standalone operation ready" : "Prerequisites satisfied"}</span>}
                </span>
              </span>
            </button>);
            })}
    </div>
  </section>)}
    <div className="mx-4 mb-4 rounded-2xl border border-[#40575b] bg-[#101f24] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#e5c56b]">Module retrofit · {upgradeLevel}/2</p>
              {nextInstallation ? <>
                <p className="mt-1 text-[9px] font-bold leading-4 text-[#dcebe4]">{nextInstallation.currentProgress} → {nextInstallation.newProgress} · {nextInstallation.metric}: {nextInstallation.directGain}</p>
                <p className="mt-1 text-[8px] leading-4 text-[#e5c56b]">{(missionNumber ?? "").replace(/[^0-9]/g, "") === "1" ? `Activation cost: ${nextInstallation.energyKWh.toFixed(2)} kWh commissioning energy · ${nextInstallationSeconds} simulated seconds at 1×` : `Activation cost: ${nextInstallation.materialKg.toFixed(1)} kg on-site material + ${nextInstallation.energyKWh.toFixed(2)} kWh commissioning energy · ${nextInstallationSeconds} simulated seconds at 1×`}</p>
                {(missionNumber ?? "").replace(/[^0-9]/g, "") !== "1" && <p className="mt-1 text-[8px] leading-4 text-[#9cb0b2]">{nextInstallation.kit}. {nextInstallation.missionEffect}</p>}
                <p className="mt-1 text-[8px] leading-4 text-[#9ce3b2]">Secondary rating / effect: {retrofitSecondaryPreview(track.id, tier, upgradeLevel + 1)}</p>
                {(missionNumber ?? "").replace(/[^0-9]/g, "") !== "1" && <p className="mt-1 text-[8px] leading-4 text-[#9cb0b2]">Stock available: {partsInventoryKg.toFixed(1)} kg. Installation uses existing stock; it does not add launch mass or repair unrelated damage.</p>}
              </> : <p className="mt-1 text-[9px] leading-4 text-[#9cb0b2]">Both retrofit stages are complete for this selected tier.</p>}
            </div>
            <button type="button" onClick={() => onAction("upgrade")} disabled={actionBusy || Boolean(operation) || !canUpgrade} className="shrink-0 rounded-xl border border-[#8b7445] bg-[#d9b555] px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-[#1b211d] transition hover:bg-[#f0cd70] disabled:cursor-not-allowed disabled:opacity-40">
              {upgradeLevel >= 2 ? "MAX LEVEL" : "UPGRADE"}
            </button>
          </div>
          {!canUpgrade && upgradeLevel < 2 && (<p className="mt-2 text-[9px] leading-4 text-[#e3a2a0]">{(missionNumber ?? "").replace(/[^0-9]/g, "") !== "1" && partsInventoryKg < (nextInstallation?.materialKg ?? 0) ? `INSUFFICIENT MATERIAL · needs ${(nextInstallation?.materialKg ?? 0).toFixed(1)} kg; ${partsInventoryKg.toFixed(1)} kg available.` : getBlockers(track.id, "upgrade").join(" · ") || `Requires at least ${physicalThreshold("power", 8)} and ${physicalThreshold("battery", 5, batteryCapacityKWh)}.`}</p>)}
        </div>
        <div className="flex items-center justify-between border-t border-[#293e44] px-5 py-3">
          <span className={`text-[9px] font-bold uppercase tracking-[0.16em] ${actionBusy ? "text-[#f0c85f]" : "text-[#70858a]"}`}>{operation ? "WORK IN PROGRESS" : runtime.status}</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#7e9398]">Tap another facility to switch</span>
        </div>
      </div>
    </div>);
}
function ResourceInspector({ node, stage, sampleQuality, hasRover, hasExtraction, hasScience, operation, actionBusy, onAction, onClose, getBlockers, simulationSpeed, }) {
    const flow = [
        { id: "UNSURVEYED", title: "1 · Survey & classify", detail: "Map the site, estimate terrain hazards, and record a baseline spectral signature." },
        { id: "SURVEYED", title: "2 · Collect & seal", detail: "Use a core tool or field sampler. Record coordinates and seal the sample to avoid contamination." },
        { id: "COLLECTED", title: "3 · Return the sample", detail: "Transport the labelled container to the habitat lab and preserve chain of custody." },
        { id: "DELIVERED", title: "4 · Analyse in the lab", detail: "Run mineral / ice-composition tests and record evidence, not just a visual guess." },
        { id: "ANALYSED", title: "5 · File the result", detail: "The analysis is stored in the mission record and contributes to research value." },
    ];
    const stageIndex = flow.findIndex((item) => item.id === stage);
    const isThisOperation = Boolean(operation && operation.targetId === node.id);
    const nextAction = stage === "UNSURVEYED" ? { id: "survey", label: hasRover ? "Dispatch rover to survey" : "Site survey locked · rover required", seconds: 18, detail: "Needs a working rover, navigation, communications, and an operational power path." } :
        stage === "SURVEYED" ? { id: "sample", label: node.kind === "ICE" || node.kind === "MINERAL" ? (hasExtraction ? "Drill & collect core" : "Core sample locked · drill required") : "Collect field specimen", seconds: hasExtraction ? 20 : 27, detail: node.kind === "ICE" || node.kind === "MINERAL" ? "Subsurface ice/mineral cores need an extraction drill, rover, navigation, and energy." : "The rover must physically reach this surveyed site to collect and seal the surface specimen." } :
            stage === "COLLECTED" ? { id: "transfer", label: "Return sealed sample to habitat", seconds: 16, detail: "The rover drives the sealed container to the habitat so chain of custody is preserved. Navigation maintains return-route accuracy." } :
                stage === "DELIVERED" ? { id: "analyze", label: hasScience ? "Analyze in science laboratory" : "Analysis locked · laboratory required", seconds: 20, detail: "A deployed, operational science laboratory is mandatory. There is no portable-assay bypass." } :
                    null;
    const blockers = nextAction ? getBlockers("field", nextAction.id, node.id) : [];
    const canStart = !operation && !actionBusy && blockers.length === 0;
    const progress = isThisOperation && operation ? Math.round(100 * (1 - operation.remainingSeconds / operation.totalSeconds)) : 0;
    return (<div className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex justify-center px-3 sm:bottom-5">
      <div className="pointer-events-auto max-h-[82vh] w-[min(94vw,540px)] overflow-y-auto rounded-[26px] border border-[#526e62] bg-[#0b1718]/[0.98] shadow-[0_24px_70px_rgba(0,0,0,0.68)] backdrop-blur-md">
        <div className="flex items-start gap-3 border-b border-[#304d46] bg-gradient-to-r from-[#1a332e] to-[#102126] px-5 py-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#527467] bg-[#0a1517]">
            <FlaskConical className="h-6 w-6 text-[#f0cf69]"/>
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
            return (<div key={item.id} className={`flex gap-3 rounded-xl border p-3 ${done ? "border-[#315d4a] bg-[#122820]" : current ? "border-[#a18645] bg-[#272619]" : "border-[#243b3e] bg-[#101e21] opacity-65"}`}>
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${done ? "bg-[#7cc99a] text-[#0c2117]" : current ? "bg-[#e4bd59] text-[#201f16]" : "bg-[#26383b] text-[#78938d]"}`}>{done ? "✓" : index + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.07em] text-white">{item.title}</p>
                    <span className={`text-[8px] font-bold uppercase tracking-[0.1em] ${done ? "text-[#80d4a1]" : current ? "text-[#f0cf69]" : "text-[#637e7c]"}`}>{done ? "Complete" : current ? "Ready" : "Awaiting previous step"}</span>
                  </div>
                  <p className="mt-1 text-[9px] leading-4 text-[#93aaa4]">{item.detail}</p>
                </div>
              </div>);
        })}

          {stage !== "UNSURVEYED" && stage !== "SURVEYED" && sampleQuality !== undefined && (<div className="rounded-xl border border-[#344f50] bg-[#101f23] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#9ab5ae]">Specimen integrity</p>
                <span className="font-mono text-sm font-bold" style={{ color: sampleQuality >= 86 ? "#83d9a0" : sampleQuality >= 68 ? "#e7c568" : "#ff918b" }}>{Math.round(sampleQuality)}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#263b40]"><div className="h-full transition-[width]" style={{ width: `${clamp(sampleQuality)}%`, background: sampleQuality >= 86 ? "#83d9a0" : sampleQuality >= 68 ? "#e7c568" : "#ff918b" }}/></div>
              <p className="mt-2 text-[9px] leading-4 text-[#92aaa8]">{sampleQuality >= 86 ? "Good chain-of-custody: contamination risk is low, though composition still needs verification." : sampleQuality >= 68 ? "Moderate uncertainty: handling contamination or mixed material may limit interpretation." : "Compromised specimen: findings should remain provisional; consider collecting a better-sealed replicate."}</p>
            </div>)}

          {operation && !isThisOperation && (<div className="rounded-2xl border border-[#8a7141] bg-[#282519] p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#f0cf69]">System currently assigned</p>
              <p className="mt-1 text-[10px] font-bold text-white">{operation.label}</p>
              <p className="mt-1 text-[9px] leading-4 text-[#c7b98f]">This job is using the relevant field asset or laboratory. Open its target marker / system to see the countdown before assigning another task.</p>
            </div>)}

          {isThisOperation && operation && (<div className="rounded-2xl border border-[#647d85] bg-[#13252c] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[#f0cf69]"><Clock className="h-4 w-4"/><p className="text-[10px] font-black uppercase tracking-[0.1em]">{operation.label}</p></div>
                <p className="shrink-0 font-mono text-sm text-white">{`${formatWallClockCountdown(operation.remainingSeconds, simulationSpeed)}s`}</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#263b41]"><div className="h-full rounded-full bg-[#e5bf5d] transition-[width]" style={{ width: `${progress}%` }}/></div>
              <p className="mt-2 text-[9px] leading-4 text-[#96b2b5]">The simulation continues while this operation runs. A serious incident can interrupt the work and pause this timer until the crew responds.</p>
            </div>)}

          {nextAction && !isThisOperation && (<button type="button" disabled={!canStart} onClick={() => onAction(nextAction.id)} className="w-full rounded-2xl border border-[#8b7445] bg-[#dfb956] p-4 text-left text-[#172018] transition hover:bg-[#f0cf70] disabled:cursor-not-allowed disabled:opacity-40">
              <span className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.08em]">{nextAction.label}</span>
                <span className="shrink-0 rounded-full border border-[#554821]/40 bg-[#f7dc8d] px-2.5 py-1 font-mono text-[10px] font-bold">~{nextAction.seconds}s</span>
              </span>
              <span className="mt-1.5 block text-[10px] leading-4 text-[#3e4c37]">{nextAction.detail}</span>
              {blockers.length > 0 && <span className="mt-2 block rounded-lg border border-[#92515a]/50 bg-[#6d2d37]/10 px-2.5 py-2 text-[9px] font-bold leading-4 text-[#7e2c33]">LOCKED · {blockers.join(" · ")}</span>}
              <span className="mt-2 flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.15em]"><Clock className="h-3 w-3"/> {blockers.length ? "Resolve prerequisites first" : "Start operation"}</span>
            </button>)}

          {stage === "ANALYSED" && (<div className="rounded-2xl border border-[#315d4a] bg-[#122820] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8fe0ad]">Sample analysed and logged</p>
              <p className="mt-1 text-[10px] leading-4 text-[#b7cec0]">Field data is stored in the mission record. Analyse other sites to build a broader resource map.</p>
            </div>)}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#263f3e] pt-3 text-[9px]">
            <span className="text-[#7e9a92]">Rover: {hasRover ? "deployed" : "missing"} · Core drill: {hasExtraction ? "deployed" : "required for ICE/MINERAL"} · Science lab: {hasScience ? "deployed" : "required for analysis"}</span>
            {operation && <span className="font-bold uppercase tracking-[0.12em] text-[#a9f2c8]">Working · {formatWallClockCountdown(operation.remainingSeconds, simulationSpeed)}s</span>}
          </div>
        </div>
      </div>
    </div>);
}
function getAiAnalysis(metrics, score) {
    if (metrics.battery < 45)
        return "Your largest weakness was battery management during low-solar periods. Stored energy was used more aggressively than necessary.";
    if (metrics.water < 55)
        return "Your largest weakness was water recovery. The colony remained stable, but the recycling loop lost reserve that could have been protected earlier.";
    if (metrics.oxygen < 55)
        return "Your largest weakness was life-support margin. The oxygen loop remained functional, but several responses left less reserve than necessary.";
    if (metrics.habitat < 75)
        return "Your largest weakness was structural protection. Earlier inspection would have preserved more habitat margin.";
    if (score >= 85)
        return "You managed the colony proactively. Your decisions preserved reserves and prevented small faults from becoming large system problems.";
    return "The colony survived with a workable balance of power and life support. The next improvement is to intervene slightly earlier when reserves begin falling.";
}
export function MissionSimulation() {
    const pending = useMemo(() => loadPendingMission(), []);
    // Keep stage difficulty in component scope so all state updaters and effects can safely reuse it.
    const missionStage = pending ? Math.max(1, Number.parseInt((pending.missionNumber ?? "").replace(/[^0-9]/g, ""), 10) || 1) : 1;
    const stagePressure = pending ? 1 + Math.min(0.8, (missionStage - 1) * 0.06) + (pending.campaign === "mars" ? 0.12 : 0) : 1;
    const savedRuntime = pending ? loadMissionRuntime(pending.missionId) : null;
    // Never hydrate a completed 14-day snapshot into a fresh active mission.
    const runtime = savedRuntime && savedRuntime.elapsedSeconds < TOTAL_MISSION_SECONDS ? savedRuntime : null;
    const [selectedBuildingId, setSelectedBuildingId] = useState(null);
    const [elapsed, setElapsed] = useState(runtime?.elapsedSeconds ?? 0);
    const [metrics, setMetrics] = useState(() => runtime?.metrics ?? (pending ? initialMetrics(pending.selected) : initialMetrics({ solar: "Foundation" })));
    const [electricalReadings, setElectricalReadings] = useState({ generationKW: 0, actualSupplyKW: 0, consumptionKW: 2.55, batteryFlowKW: 0, enduranceHours: null, generationSources: [], demandSources: [] });
    const [pulseExpandedMetric, setPulseExpandedMetric] = useState(null);
    const [buildings, setBuildings] = useState(() => runtime?.buildings ?? (pending ? initialBuildings(pending.selected) : {}));
    const buildingsRef = useRef(buildings);
    buildingsRef.current = buildings;
    const [activeEventId, setActiveEventId] = useState(runtime?.activeEventId ?? null);
    const [resolvedEventIds, setResolvedEventIds] = useState(runtime?.resolvedEventIds ?? []);
    const [decisions, setDecisions] = useState(runtime?.decisions ?? []);
    const [aiMessage, setAiMessage] = useState(runtime?.aiMessage ?? "Mission AI online. I am monitoring power, life support, habitat condition, and system behaviour.");
    const [roverTask, setRoverTask] = useState(runtime?.roverTask ?? "STANDBY");
    const [score, setScore] = useState(runtime?.score ?? 72);
    const [selectedResourceId, setSelectedResourceId] = useState(null);
    const [surveyedNodes, setSurveyedNodes] = useState(() => runtime?.surveyedNodes ?? []);
    const [sampleStages, setSampleStages] = useState(() => runtime?.sampleStages ?? Object.fromEntries((runtime?.surveyedNodes ?? []).map((id) => [id, "SURVEYED"])));
    const [sampleQuality, setSampleQuality] = useState(() => runtime?.sampleQuality ?? {});
    const [resourceYield, setResourceYield] = useState(runtime?.resourceYield ?? 0);
    const [partsInventoryKg, setPartsInventoryKg] = useState(runtime?.partsInventoryKg ?? STARTING_REPAIR_PARTS_KG);
    const [activeOperations, setActiveOperations] = useState(() => {
        if (runtime?.activeOperations)
            return runtime.activeOperations;
        return runtime?.activeOperation ? { [runtime.activeOperation.operationKey ?? runtime.activeOperation.targetId]: runtime.activeOperation } : {};
    });
    const activeOperationsRef = useRef(activeOperations);
    activeOperationsRef.current = activeOperations;
    const activeOperation = Object.values(activeOperations)[0] ?? null;
    const [operationResult, setOperationResult] = useState(() => runtime?.operationResult ?? null);
    const [earthReport, setEarthReport] = useState(() => runtime?.earthReport ?? null);
    const [earthReportAtSeconds, setEarthReportAtSeconds] = useState(runtime?.earthReportAtSeconds ?? 0);
    const [fallbackReadyAt, setFallbackReadyAt] = useState(() => runtime?.fallbackReadyAt ?? {});
    const [activeFaults, setActiveFaults] = useState(() => runtime?.activeFaults ?? {});
    const [queuedIncidentRepair, setQueuedIncidentRepair] = useState(null);
    const activeFaultsRef = useRef(activeFaults);
    useEffect(() => { activeFaultsRef.current = activeFaults; }, [activeFaults]);
    const [emergencyPowerMode, setEmergencyPowerMode] = useState(runtime?.emergencyPowerMode ?? false);
    const [dashboardOpen, setDashboardOpen] = useState(false);
    const autoOpenedFaultIdsRef = useRef(new Set());
    useEffect(() => {
        if (activeEventId)
            return;
        const newFault = Object.values(activeFaults).find((fault) => !autoOpenedFaultIdsRef.current.has(fault.eventId));
        if (!newFault)
            return;
        autoOpenedFaultIdsRef.current.add(newFault.eventId);
        setSelectedResourceId(null);
        setSelectedBuildingId(newFault.targetTrackId);
        setDashboardOpen(false);
    }, [activeFaults, activeEventId]);
    const operationCompletionRef = useRef(new Set());
    const applyBuildingActionRef = useRef(() => { });
    const [manualActions, setManualActions] = useState(0);
    const [manualPaused, setManualPaused] = useState(false);
    const [speed, setSpeed] = useState(1);
    // Hysteresis prevents optional loads switching rapidly near the solar-demand threshold.
    const powerDeficitRef = useRef(false);
    const [results, setResults] = useState(false);
    const [missionFailed, setMissionFailed] = useState(false);
    const [missionFailureReason, setMissionFailureReason] = useState(null);
    const eventPointerRef = useRef(runtime?.eventsTriggered ?? ((runtime?.resolvedEventIds.length ?? 0) + (runtime?.activeEventId ? 1 : 0)));
    const eventResponseRef = useRef(null);
    const completionSavedRef = useRef(false);
    const selectedTracks = pending ? selectedTrackData(pending.selected) : [];
    const selectedTrack = selectedBuildingId ? selectedTracks.find((track) => track.id === selectedBuildingId) : undefined;
    const selectedTier = selectedTrack && pending ? pending.selected[selectedTrack.id] : undefined;
    const activeEventCandidate = activeEventId ? EVENT_DEFS.find((event) => event.id === activeEventId) ?? null : null;
    const missionEnvironmentLabel = pending?.campaign === "mars" ? "MARS" : "MOON";
    const storedEventIsInvalid = Boolean(activeEventId && pending && (!activeEventCandidate || !eventTargetIsDeployed(activeEventCandidate, pending.selected, missionEnvironmentLabel)));
    const activeEvent = activeEventCandidate && pending && eventTargetIsDeployed(activeEventCandidate, pending.selected, missionEnvironmentLabel)
        ? activeEventCandidate
        : null;
    const activeTargetTrackId = activeEvent?.trackId === "power"
        ? (pending?.selected.grid ? "grid" : pending?.selected.battery ? "battery" : pending?.selected.solar ? "solar" : null)
        : activeEvent?.trackId ?? null;
    const selectedResource = selectedResourceId
        ? RESOURCE_NODES[pending?.campaign === "mars" ? "MARS" : "MOON"].find((node) => node.id === selectedResourceId)
        : undefined;
    const currentMissionNodes = RESOURCE_NODES[pending?.campaign === "mars" ? "MARS" : "MOON"];
    const roverTaskTargetPrefix = ["SURVEYING ", "MAPPING ", "COLLECTING ", "AT SITE "].find((prefix) => roverTask.startsWith(prefix));
    const roverTaskTarget = roverTaskTargetPrefix
        ? currentMissionNodes.find((node) => node.label === roverTask.slice(roverTaskTargetPrefix.length))
        : undefined;
    const roverFieldWorkOrder = Object.values(activeOperations).find((operation) => operation.roverAssigned);
    const roverWorkOrderHasSiteTarget = roverFieldWorkOrder?.kind === "SURVEY" || roverFieldWorkOrder?.kind === "COLLECT";
    const roverTargetNodeId = roverFieldWorkOrder?.kind === "TRANSFER"
        ? null
        : roverWorkOrderHasSiteTarget
            ? roverFieldWorkOrder?.targetId ?? null
            : roverTaskTarget?.id ?? null;
    const environmentLabel = pending?.campaign === "mars" ? "MARS" : "MOON";
    const environmentTitle = pending?.campaign === "mars" ? "Utopia Planitia" : "Mare Tranquillitatis";
    const physicalTelemetry = physicalResourceTelemetry(metrics, pending?.selected ?? {}, buildings);
    const finishOperation = useCallback((operation) => {
        const node = RESOURCE_NODES[pending?.campaign === "mars" ? "MARS" : "MOON"].find((item) => item.id === operation.targetId);
        let message = "";
        switch (operation.kind) {
            case "SURVEY":
                if (node) {
                    setSampleStages((current) => ({ ...current, [node.id]: "SURVEYED" }));
                    setSurveyedNodes((current) => current.includes(node.id) ? current : [...current, node.id]);
                    message = `SURVEY COMPLETE · ${node.label}. Terrain and spectral signatures are mapped. Next: collect a sealed physical sample from the marked location.`;
                    setRoverTask(`AT SITE ${node.label}`);
                    setScore((value) => clamp(value + (pending?.selected.rover ? 5 : 3)));
                }
                break;
            case "COLLECT":
                if (node) {
                    const quality = clamp(operation.sampleQuality ?? 68, 35, 99);
                    setSampleStages((current) => ({ ...current, [node.id]: "COLLECTED" }));
                    setSampleQuality((current) => ({ ...current, [node.id]: quality }));
                    message = `SAMPLE SECURED · ${node.label}. Chain-of-custody label, coordinates and collection time are logged. Specimen integrity: ${Math.round(quality)}%. ${quality >= 86 ? "The sealed core has low contamination risk." : quality >= 68 ? "Some contamination / handling uncertainty remains; keep the lab result provisional." : "The sample is compromised; repeat collection if the site is important."} Next: return the sealed container to the lab without opening it.`;
                    setRoverTask(`AT SITE ${node.label}`);
                    setScore((value) => clamp(value + Math.round(2 + quality / 35)));
                }
                break;
            case "TRANSFER":
                if (node) {
                    setSampleStages((current) => ({ ...current, [node.id]: "DELIVERED" }));
                    message = `CHAIN OF CUSTODY COMPLETE · ${node.label} arrived in the lab. The sample is ready for mineralogical / compositional analysis.`;
                    setRoverTask(pending?.selected.rover ? "RETURNING" : "SAMPLE DELIVERED");
                    setScore((value) => clamp(value + 4));
                }
                break;
            case "ANALYZE":
                if (node) {
                    setSampleStages((current) => ({ ...current, [node.id]: "ANALYSED" }));
                    const scienceRatedThroughput = getBaselineRating("science", pending?.selected.science ?? "Foundation", buildingsRef.current.science?.upgradeLevel ?? 0);
                    const scienceThroughput = repairAdjustedRating("science", scienceRatedThroughput, buildingsRef.current.science?.repairMetrics);
                    const scienceThroughputFraction = scienceRatedThroughput > 0 ? clamp(scienceThroughput / scienceRatedThroughput, 0, 1) : 1;
                    const scienceAccuracy = getAdditionalRating("science", "accuracy", pending?.selected.science ?? "Foundation", buildingsRef.current.science?.upgradeLevel ?? 0) * scienceThroughputFraction;
                    const integrity = sampleQuality[node.id] ?? 64;
                    const confidence = clamp(integrity * 0.55 + scienceAccuracy * 0.45, 42, 99);
                    const finding = node.kind === "ICE"
                        ? confidence >= 82 ? "A strong volatile / ice signature is supported by the assay; preserve a sealed aliquot for confirmation." : "The volatile signature is suggestive but not conclusive; repeat the assay before treating this as a verified ice reserve."
                        : node.kind === "MINERAL"
                            ? confidence >= 82 ? "The spectral response supports a mineral-bearing deposit; follow-up measurements can refine the composition." : "The spectrum is mixed; the deposit remains a candidate rather than a confirmed resource."
                            : node.kind === "SCIENCE"
                                ? confidence >= 82 ? "The reference readings are internally consistent and suitable for comparison with later observations." : "Instrument and sample uncertainty remain high; repeat calibration before using this as a reference."
                                : confidence >= 82 ? "The sample supports a consistent regolith classification and can guide a follow-up collection." : "Particle and composition evidence are not decisive; collect a better-sealed replicate for confirmation.";
                    const researchUnits = confidence >= 82 ? 2 : 1;
                    setResourceYield((value) => value + researchUnits);
                    setScore((value) => clamp(value + Math.round(4 + confidence / 18)));
                    message = `LAB RESULT · ${node.label}. Confidence: ${Math.round(confidence)}% · specimen integrity ${Math.round(integrity)}%. ${finding} Research value: +${researchUnits} units. The measured science accuracy is ${scienceAccuracy}%; no tier multiplier is applied.`;
                    // Keep lab analysis from overwriting the rover’s independent travel state.
                }
                break;
            case "SYSTEM_ACTION": {
                const actionId = operation.actionId ?? "inspect";
                const integrated = decodeActionVariant(operation.targetId, actionId);
                const displayedActionId = integrated?.baseActionId ?? actionId;
                applyBuildingActionRef.current(operation.targetId, actionId);
                const track = technologyTracks.find((item) => item.id === operation.targetId);
                const outcome = SYSTEM_ACTION_EFFECTS[displayedActionId];
                const supports = integrated?.supportSystems.length
                    ? ` Integrated with ${integrated.supportSystems.map((id) => SUPPORT_SHORT_LABELS[id] ?? SYSTEM_LABELS[id] ?? id).join(" + ")}.`
                    : "";
                message = `ACTION COMPLETE · ${track?.category ?? operation.targetId} · ${displayedActionId}.${supports} ${outcome ? `Baseline outcome: ${outcome}. Higher-tier / retrofit efficiency is reflected in the actual result.` : "The completed work has been applied to the colony."}`;
                break;
            }
            case "UPGRADE": {
                const track = technologyTracks.find((item) => item.id === operation.targetId);
                const level = operation.targetLevel ?? 1;
                const installation = getRetrofitInstallation(operation.targetId, pending?.selected[operation.targetId], level - 1);
                setBuildings((current) => {
                    const previous = current[operation.targetId] ?? { condition: 100, dust: 0, status: "ONLINE", upgradeLevel: 0 };
                    const repairMetrics = { ...(previous.repairMetrics ?? {}) };
                    let dust = previous.dust;
                    if (operation.targetId === "solar") {
                        dust = clamp(dust - (level === 1 ? 15 : 10));
                        const pointingKey = "Residual array pointing error after recalibration";
                        repairMetrics[pointingKey] = Math.max(0, (repairMetrics[pointingKey] ?? 15) - 2);
                    }
                    return { ...current, [operation.targetId]: { ...previous, dust, repairMetrics, upgradeLevel: Math.max(previous.upgradeLevel ?? 0, level) } };
                });
                setScore((value) => clamp(value + 4));
                message = `RETROFIT COMPLETE · ${track?.category ?? operation.targetId} is now at ${level}/2. ${installation ? `${installation.metric}: ${installation.directGain}. ` : ""}${operation.targetId === "solar" ? `Applied secondary effect: dust reduced by ${level === 1 ? 15 : 10} points and residual pointing error reduced by 2°. ` : ""}The selected rated capability now comes directly from the workbook. Installation does not repair unrelated damage or clear faults.`;
                break;
            }
            case "REPAIR": {
                const repairTarget = operation.targetId;
                const faults = Object.values(activeFaultsRef.current).filter((fault) => fault.targetTrackId === repairTarget);
                const optionId = (operation.actionId ?? "").startsWith("repair:") ? (operation.actionId ?? "").slice("repair:".length) : "";
                const option = getRepairOption(repairTarget, optionId);
                const selectedTier = pending?.selected[repairTarget] ?? "Foundation";
                const selectedTiers = pending?.selected ?? {};
                const effectTierIndex = option ? effectiveRepairTierIndex(selectedTier, option.requiredSystems, selectedTiers) : 0;
                const outcome = option ? getRepairEffectValue(option, effectTierIndex) : 0;
                const secondaryValue = option?.secondary && typeof option.secondary.values[effectTierIndex] === "number" ? option.secondary.values[effectTierIndex] : null;
                const tertiaryValue = option?.tertiary && typeof option.tertiary.values[effectTierIndex] === "number" ? option.tertiary.values[effectTierIndex] : null;
                const priorRepairMetrics = buildingsRef.current[repairTarget]?.repairMetrics ?? {};
                const primaryMetric = getPrimaryRepairMetric(repairTarget);
                let remainingGapAfter = null;
                if (option && option.metric === primaryMetric && repairTarget !== "solar" && repairTarget !== "maintenance") {
                    const currentGap = typeof priorRepairMetrics[repairGapKey(primaryMetric)] === "number"
                        ? priorRepairMetrics[repairGapKey(primaryMetric)]
                        : getStandardRepairGap(repairTarget, selectedTiers);
                    remainingGapAfter = Math.max(0, currentGap - Math.max(0, outcome));
                }
                const currentDust = buildingsRef.current.solar?.dust ?? 0;
                const dustAfter = option && /dust removed from (existing deposit|array surface)/i.test(option.metric)
                    ? clamp(/of current dust/i.test(option.unit)
                        ? currentDust * (1 - Math.min(100, Math.max(0, outcome)) / 100)
                        : currentDust - Math.max(0, outcome), 0, 100)
                    : currentDust;
                if (option && /usable energy restored/i.test(option.metric)) {
                    const batteryCapacity = ratedBatteryCapacityKWh(pending?.selected ?? {}, buildingsRef.current);
                    if (batteryCapacity > 0) {
                        setMetrics((current) => ({
                            ...current,
                            battery: clamp(current.battery + (Math.max(0, outcome) / batteryCapacity) * 100),
                        }));
                    }
                }
                const dustFault = repairTarget === "solar" && faults.some((fault) => fault.eventId === "solar-dust" || fault.eventId === "regional-dust-front");
                const batteryEnergyRepair = repairTarget === "battery" && Boolean(option);
                const faultResolved = faults.length === 0 || batteryEnergyRepair || (dustFault
                    ? dustAfter <= 0.0001
                    : remainingGapAfter !== null
                        ? remainingGapAfter <= 0.0001
                        : false);
                setActiveFaults((current) => {
                    if (faultResolved)
                        return Object.fromEntries(Object.entries(current).filter(([, fault]) => fault.targetTrackId !== repairTarget));
                    return Object.fromEntries(Object.entries(current).map(([key, fault]) => [
                        key,
                        fault.targetTrackId === repairTarget
                            ? { ...fault, remainingSeconds: Math.max(fault.remainingSeconds, 18 * GAME_TIME_ACCELERATION), severity: Math.max(0.65, fault.severity * 0.78) }
                            : fault,
                    ]));
                });
                setBuildings((current) => {
                    const previous = current[repairTarget] ?? { condition: 100, dust: 0, status: "ONLINE", upgradeLevel: 0 };
                    const repairMetrics = { ...(previous.repairMetrics ?? {}) };
                    if (option) {
                        repairMetrics[option.metric] = mergeRepairReading(repairMetrics, option.metric, outcome);
                        if (option.secondary && secondaryValue !== null) {
                            repairMetrics[option.secondary.metric] = mergeRepairReading(repairMetrics, option.secondary.metric, secondaryValue);
                        }
                        if (option.tertiary && tertiaryValue !== null) {
                            repairMetrics[option.tertiary.metric] = mergeRepairReading(repairMetrics, option.tertiary.metric, tertiaryValue);
                        }
                        if (remainingGapAfter !== null && primaryMetric) {
                            repairMetrics[repairGapKey(primaryMetric)] = remainingGapAfter;
                        }
                        if (faultResolved && primaryMetric)
                            delete repairMetrics[repairInitialGapKey(primaryMetric)];
                    }
                    const repaired = { ...current, [repairTarget]: { ...previous, repairMetrics, status: buildingStatus(previous.condition) } };
                    if (option && /dust removed from (existing deposit|array surface)/i.test(option.metric)) {
                        const currentSolar = repaired.solar ?? { condition: 100, dust: 0, status: "ONLINE" };
                        repaired.solar = { ...currentSolar, dust: dustAfter };
                    }
                    if (option?.metric === "Additional condition points restored to a target system during the standard maintenance job") {
                        const target = Object.entries(repaired)
                            .filter(([id, state]) => id !== repairTarget && Boolean(pending?.selected[id]) && state.condition < 100 &&
                            !Object.values(activeFaultsRef.current).some((fault) => fault.targetTrackId === id))
                            .sort(([, a], [, b]) => a.condition - b.condition)[0];
                        if (target) {
                            const [targetId, state] = target;
                            const condition = clamp(state.condition + Math.max(0, outcome));
                            repaired[targetId] = { ...state, condition, status: buildingStatus(condition) };
                        }
                    }
                    return repaired;
                });
                setScore((value) => clamp(value + 6));
                const effectLines = option ? [
                    /dust removed from (existing deposit|array surface)/i.test(option.metric)
                        ? (/of current dust/i.test(option.unit)
                            ? `Solar dust: removed ${formatRating(outcome)}% of the deposit present when the repair finished`
                            : `Solar dust: −up to ${formatRating(outcome)} points (the dust index cannot fall below zero)`)
                        : describeRepairOutcome(repairTarget, option.metric, option.unit, outcome),
                    ...(option.secondary && secondaryValue !== null
                        ? [describeRepairOutcome(repairTarget, option.secondary.metric, option.secondary.unit, secondaryValue)]
                        : []),
                    ...(option.tertiary && tertiaryValue !== null
                        ? [describeRepairOutcome(repairTarget, option.tertiary.metric, option.tertiary.unit, tertiaryValue)]
                        : []),
                ] : [];
                const effectCopy = option ? effectLines.join(" · ") : "The fault state has been cleared using the fallback standalone service.";
                const faultStatusCopy = faultResolved
                    ? `${faults.length} fault(s) cleared.`
                    : repairTarget === "solar"
                        ? `Fault remains active: ${formatRating(dustAfter)} solar dust points remain. Choose another category/procedure.`
                        : `Fault remains active: ${formatRating(remainingGapAfter ?? 0)} ${option?.unit ?? ""} of ${primaryMetric ?? "performance"} restoration remains. Choose another category/procedure.`;
                message = `REPAIR VERIFIED · ${option?.name ?? "Standalone service"} complete on ${technologyTracks.find((track) => track.id === repairTarget)?.category ?? repairTarget}. ${effectCopy}. ${faultStatusCopy} Rated capability is capped at the selected tier's baseline; this procedure restores faulted capability and never adds a hidden performance multiplier.`;
                if (operation.roverAssigned)
                    setRoverTask("REPAIR VERIFIED");
                break;
            }
        }
        if (message) {
            setOperationResult(message);
            if (operation.kind !== "SYSTEM_ACTION")
                setAiMessage(message);
        }
        setActiveOperations((current) => {
            const entry = Object.entries(current).find(([, candidate]) => candidate.id === operation.id);
            if (!entry)
                return current;
            const next = { ...current };
            delete next[entry[0]];
            return next;
        });
    }, [pending, sampleQuality]);
    useEffect(() => {
        if (!operationResult)
            return;
        const timeout = window.setTimeout(() => setOperationResult(null), 6500);
        return () => window.clearTimeout(timeout);
    }, [operationResult]);
    useEffect(() => {
        if (!storedEventIsInvalid)
            return;
        setActiveEventId(null);
        setAiMessage("A saved incident targeted hardware not included in this loadout. The stale alert was cleared, and the mission can continue.");
    }, [storedEventIsInvalid, activeEventId]);
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key !== "Escape")
                return;
            setSelectedBuildingId(null);
            setSelectedResourceId(null);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);
    useEffect(() => {
        if (!pending || results || manualPaused || activeEventId)
            return;
        // One stable timer advances all independent system jobs. An incident pauses every job.
        const timer = window.setInterval(() => {
            if (Object.keys(activeOperationsRef.current).length === 0)
                return;
            setActiveOperations((current) => {
                let changed = false;
                const next = { ...current };
                for (const [key, operation] of Object.entries(current)) {
                    const remaining = Math.max(0, operation.remainingSeconds - 0.25 * Math.max(0, speed));
                    if (remaining <= 0) {
                        if (!operationCompletionRef.current.has(operation.id)) {
                            operationCompletionRef.current.add(operation.id);
                            window.setTimeout(() => finishOperation({ ...operation, remainingSeconds: 0 }), 0);
                        }
                        if (operation.remainingSeconds !== 0) {
                            next[key] = { ...operation, remainingSeconds: 0 };
                            changed = true;
                        }
                    }
                    else {
                        next[key] = { ...operation, remainingSeconds: remaining };
                        changed = true;
                    }
                }
                return changed ? next : current;
            });
        }, 250);
        return () => window.clearInterval(timer);
    }, [activeEventId, finishOperation, manualPaused, pending, results, speed]);
    useEffect(() => {
        if (!pending || missionFailed)
            return;
        const reason = getMissionFailureReason(metrics);
        if (!reason)
            return;
        setMissionFailureReason(reason);
        setMissionFailed(true);
        if (!results)
            setResults(true);
        setActiveEventId(null);
        setActiveOperations({});
        setAiMessage(`MISSION ABORTED · ${reason} Preserve the remaining equipment and review the failure report before redeploying.`);
    }, [metrics, missionFailed, pending, results]);
    useEffect(() => {
        if (!pending || results || manualPaused || activeEventId)
            return;
        const timer = window.setInterval(() => {
            // Resource systems use a gentler balance clock than the accelerated mission timeline.
            const resourceDt = 0.25 * speed * GAME_TIME_ACCELERATION * 0.25;
            setElapsed((current) => {
                const next = Math.min(TOTAL_MISSION_SECONDS, current + 0.25 * speed * GAME_TIME_ACCELERATION);
                const missionStage = Math.max(1, Number.parseInt((pending.missionNumber ?? "").replace(/[^0-9]/g, ""), 10) || 1);
                const scheduleShift = Math.min(TOTAL_MISSION_SECONDS * 0.04, (missionStage - 1) * TOTAL_MISSION_SECONDS * 0.003) + (pending.campaign === "mars" ? TOTAL_MISSION_SECONDS * 0.01 : 0);
                const nextEventAt = Math.max(TOTAL_MISSION_SECONDS * 0.01, EVENT_TIMES[eventPointerRef.current] - scheduleShift);
                if (!activeEventId && eventPointerRef.current < EVENT_TIMES.length && next >= nextEventAt) {
                    const eventIndex = eventPointerRef.current;
                    const event = pickNextEvent(environmentLabel, pending.selected, resolvedEventIds, eventIndex, metrics);
                    eventPointerRef.current += 1;
                    setTimeout(() => {
                        eventResponseRef.current = null;
                        setActiveEventId(event.id);
                        setIncidentRepairCategory("Standalone");
                        setSelectedBuildingId(null);
                        setSelectedResourceId(null);
                        setOperationResult(null);
                        setAiMessage(`CRITICAL INCIDENT: ${event.title}. The fault is live now; stored power, consumables and equipment condition continue to change until you respond.`);
                        const targetId = event.trackId === "power"
                            ? (pending.selected.grid ? "grid" : pending.selected.battery ? "battery" : "solar")
                            : event.trackId;
                        const shock = (1 + Math.min(1.3, (missionStage - 1) * 0.085 + eventIndex * 0.055 + (pending.campaign === "mars" ? 0.12 : 0))) * 0.45;
                        const faultSeverity = 0.85 + Math.min(1.5, (missionStage - 1) * 0.105 + eventIndex * 0.075 + (pending.campaign === "mars" ? 0.18 : 0));
                        const responseWindow = Math.max(16, 36 - missionStage * 0.8 - eventIndex * 1.25) * GAME_TIME_ACCELERATION;
                        // The fault is live while the incident panel is open, not merely a one-off score penalty.
                        setActiveFaults((current) => ({
                            ...current,
                            [event.id]: { eventId: event.id, targetTrackId: targetId, title: event.title, remainingSeconds: responseWindow, severity: faultSeverity },
                        }));
                        setBuildings((current) => {
                            const previous = current[targetId];
                            if (!previous)
                                return current;
                            const solarProtection = targetId === "solar" ? solarFaultProtection(current.solar?.repairMetrics) : 0;
                            const damage = Math.min(18, (5 + eventIndex * 0.65) * shock) * (1 - solarProtection);
                            const condition = clamp(previous.condition - damage);
                            const nextBuildings = { ...current, [targetId]: { ...previous, condition, status: buildingStatus(condition) } };
                            if (event.id === "solar-dust" || event.id === "regional-dust-front") {
                                nextBuildings.solar = { ...(current.solar ?? { condition: 100, dust: 0, status: "ONLINE" }), dust: clamp((current.solar?.dust ?? 0) + 12 * shock) };
                            }
                            const primaryMetric = getPrimaryRepairMetric(targetId);
                            if (primaryMetric && targetId !== "solar" && targetId !== "maintenance") {
                                const target = nextBuildings[targetId];
                                nextBuildings[targetId] = {
                                    ...target,
                                    repairMetrics: {
                                        ...(target.repairMetrics ?? {}),
                                        [repairGapKey(primaryMetric)]: getStandardRepairGap(targetId, pending.selected),
                                        [repairInitialGapKey(primaryMetric)]: getStandardRepairGap(targetId, pending.selected),
                                    },
                                };
                            }
                            return nextBuildings;
                        });
                        setMetrics((current) => {
                            switch (event.id) {
                                case "solar-dust":
                                case "regional-dust-front": return { ...current, power: clamp(current.power - 5 * shock), battery: clamp(current.battery - 3 * shock) };
                                case "battery-thermal": return { ...current, battery: clamp(current.battery - 7 * shock), power: clamp(current.power - 2 * shock) };
                                case "oxygen-filter":
                                case "co2-scrubber-loading": return { ...current, oxygen: clamp(current.oxygen - 6 * shock) };
                                case "water-filter": return { ...current, water: clamp(current.water - 6 * shock) };
                                case "habitat-pressure": return { ...current, habitat: clamp(current.habitat - 5 * shock) };
                                case "micrometeoroid-impact": return { ...current, habitat: clamp(current.habitat - 3 * shock), power: clamp(current.power - 2 * shock) };
                                case "radiation-burst": return { ...current, radiation: clamp(current.radiation + 7 * shock) };
                                case "polar-shadow-cold-soak":
                                    return { ...current, temperature: clamp(current.temperature - 2.5 * shock, 16, 28), battery: clamp(current.battery - 5 * shock), power: clamp(current.power - 2 * shock) };
                                case "thermal-drift":
                                    return { ...current, temperature: clamp(current.temperature + (current.temperature < 21 ? -2.0 : 2.0) * shock, 16, 28), battery: clamp(current.battery - 4 * shock) };
                                case "grid-overload":
                                case "core-power": return { ...current, power: clamp(current.power - 7 * shock), battery: clamp(current.battery - 4 * shock) };
                                case "agriculture-stress": return { ...current, food: clamp(current.food - 6 * shock), water: clamp(current.water - 2 * shock) };
                                case "comms-drift":
                                case "mars-comm-relay-loss": return { ...current, power: clamp(current.power - 2 * shock) };
                                case "rover-wheel":
                                case "extraction-lock":
                                case "isru-pressure": return { ...current, power: clamp(current.power - 3 * shock), battery: clamp(current.battery - 2 * shock) };
                                case "science-anomaly":
                                case "maintenance-alert": return { ...current, power: clamp(current.power - 1.5 * shock) };
                                default: return current;
                            }
                        });
                    }, 0);
                }
                if (next >= TOTAL_MISSION_SECONDS && !activeEventId && Object.keys(activeOperationsRef.current).length === 0) {
                    setTimeout(() => setResults(true), 0);
                }
                return next;
            });
            setMetrics((current) => {
                const dependencyContext = {
                    selected: pending.selected,
                    buildings,
                    activeFaults: activeFaultsRef.current,
                    metrics: current,
                    surveyedNodes,
                    sampleStages,
                    resourceYield,
                };
                const solarOnline = systemIsOperational("solar", dependencyContext);
                const batteryOnline = systemIsOperational("battery", dependencyContext);
                const gridOnline = systemIsOperational("grid", dependencyContext);
                const oxygenOnline = systemIsOperational("oxygen", dependencyContext);
                const waterOnline = systemIsOperational("water", dependencyContext);
                const thermalOnline = systemIsOperational("thermal", dependencyContext);
                const radiationOnline = systemIsOperational("radiation", dependencyContext);
                const agricultureOnline = systemIsOperational("agriculture", dependencyContext);
                const dt = 0.25 * speed * GAME_TIME_ACCELERATION;
                const resourceDt = dt;
                const missionFraction = clamp(elapsed / TOTAL_MISSION_SECONDS, 0, 1);
                const missionDay = Math.min(14, Math.max(0, elapsed / LEVEL1_ENVIRONMENT.secondsPerEarthDay));
                const solarDust = buildings.solar?.dust ?? 0;
                const solarUpgrade = buildings.solar?.upgradeLevel ?? 0;
                const batteryUpgrade = buildings.battery?.upgradeLevel ?? 0;
                const oxygenUpgrade = buildings.oxygen?.upgradeLevel ?? 0;
                const waterUpgrade = buildings.water?.upgradeLevel ?? 0;
                const foodUpgrade = buildings.agriculture?.upgradeLevel ?? 0;
                const thermalUpgrade = buildings.thermal?.upgradeLevel ?? 0;
                const habitatUpgrade = buildings.habitat?.upgradeLevel ?? 0;
                const gridUpgrade = buildings.grid?.upgradeLevel ?? 0;
                const radiationUpgrade = buildings.radiation?.upgradeLevel ?? 0;
                const blackoutMission = pending.campaign === "moon" && (pending.missionTitle.toLowerCase().includes("blackout") || pending.missionNumber === "02");
                const lunarProfile = pending.campaign === "moon" ? interpolateSolarProfile(missionDay) : null;
                const solarAvailability = blackoutMission
                    ? (missionDay >= 14 ? 0 : missionFraction < 0.16 ? 0.42 : missionFraction < 0.85 ? 0.14 : 0.28)
                    : pending.campaign === "mars"
                        ? Math.max(0.25, 0.78 + Math.sin(missionDay * Math.PI / 7) * 0.10)
                        : missionDay < 14
                            ? (missionDay < 1 ? 0.22 : lunarProfile?.sunlightGeometry ?? 0)
                            : 0;
                const cellTemperatureC = lunarProfile?.cellTempC ?? (pending.campaign === "mars" ? 42 + Math.sin(missionDay * Math.PI / 7) * 18 : 25);
                const cellTemperatureLoss = lunarProfile?.cellTemperatureLoss ?? Math.min(0.8, Math.max(0, cellTemperatureC - LEVEL1_ENVIRONMENT.referenceCellTemperatureC) * LEVEL1_ENVIRONMENT.cellTemperatureDeratePerC);
                const pointingError = buildings.solar?.repairMetrics?.["Residual array pointing error after recalibration"] ?? 15;
                const solarRatedKW = solarOnline ? getBaselineRating("solar", pending.selected.solar ?? "Foundation", solarUpgrade) : 0;
                const solarGeneration = solarOnline
                    ? Math.min(solarRatedKW, solarRatedKW * solarAvailability * (1 - cellTemperatureLoss) * dustTransmission(solarDust) * Math.max(0, Math.cos(pointingError * Math.PI / 180)))
                    : 0;
                const batteryCapacityKWh = ratedBatteryCapacityKWh(pending.selected, buildings);
                const storedEnergyKWh = batteryOnline ? batteryCapacityKWh * current.battery / 100 : 0;
                const batteryDischargeLimitKW = batteryOnline ? getAdditionalRating("battery", "continuous discharge power", pending.selected.battery ?? "Foundation", batteryUpgrade) : 0;
                const gridTransferLimitKW = pending.selected.grid
                    ? gridOnline
                        ? repairAdjustedRating("grid", getBaselineRating("grid", pending.selected.grid, gridUpgrade), buildings.grid?.repairMetrics)
                        : 0
                    : Number.POSITIVE_INFINITY;
                // Electrical load model (kW): reference-grounded where public NASA concept data
                // gives a comparable subsystem, with explicit game-design assumptions for smaller
                // electronics/control loads. These are not claimed to be measured flight-hardware values.
                // NASA TM / NTRS 20200001622 Table 8 gives a 6-crew ECLSS reference:
                // air revitalization + O2 generation 5.85 kW, water processing 1.29 kW,
                // biomass production 6.10 kW, and thermal control 1.03 kW.
                // Scale those four loads linearly to this game's 4-crew habitat (×4/6).
                // NASA NTRS 20050161948 gives a 2-kW unpressurized lunar rover reference;
                // NASA CR-2020-220368 gives 0.3–1.0 kW per communications transmitter and
                // 2–10 kW for support equipment. ISRU/extraction are modelled as pilot equipment
                // inside those broad ranges; actual values depend heavily on process and duty cycle.
                // The 2.55 kW core is a separate game-design allowance for fixed habitat controls,
                // lighting, avionics and miscellaneous loads; it does NOT include the modeled ECLSS
                // loads below. Passive radiation shielding uses no electricity.
                const batteryRecoveryActive = Object.values(activeOperationsRef.current).some((operation) => operation.kind === "REPAIR" && operation.targetId === "battery");
                const criticalReserveMode = current.battery <= 25 && solarGeneration < 2.55;
                const essentialLoadKW = emergencyPowerMode || batteryRecoveryActive || criticalReserveMode ? 2.0 : 2.55;
                const optionalSystemLoadKW = {
                    solar: 0.04, // Solar-array controller and sensor standby; game-design estimate.
                    battery: 0.03, // Battery-management electronics standby; game-design estimate.
                    water: 0.86, // 1.29 kW × 4/6 crew, NASA ECLSS reference.
                    grid: 0.05, // Distribution controller standby; game-design estimate.
                    science: 0.5, // Instrument workload; depends on the selected experiment.
                    rover: 2.0, // NASA conceptual 2-kW unpressurized lunar rover, while operating.
                    extraction: 2.0, // Lower end of NASA 2–10 kW support-equipment range; pilot drill assumption.
                    isru: 5.0, // Within NASA 2–10 kW support-equipment range; pilot processing assumption.
                    agriculture: 4.07, // 6.10 kW × 4/6 crew, NASA biomass-production reference.
                    maintenance: 0.15, // Standby diagnostic electronics; game-design estimate.
                    radiation: 0.02, // Active monitor electronics only; game-design estimate.
                    comms: 0.3, // Low end of NASA 0.3–1.0 kW per transmitter range.
                    navigation: 0.08, // Avionics workload; game-design estimate.
                    thermal: 0.69, // 1.03 kW × 4/6 crew, NASA ECLSS thermal-control reference.
                };
                const requestedLoads = Object.entries(optionalSystemLoadKW)
                    .filter(([systemId]) => Boolean(pending.selected[systemId]) && systemIsOperational(systemId, dependencyContext))
                    .map(([systemId, loadKW]) => ({ systemId, label: SYSTEM_LABELS[systemId] ?? systemId, kw: loadKW * (emergencyPowerMode ? 0.5 : 1) }));
                // NASA's reference reports CO₂ removal and oxygen generation as one combined 5.85-kW
                // air-system load, not separately. Count that combined load once whenever either
                // operational module is installed, rather than inventing an unsupported split.
                const airRevitalizationOnline = (Boolean(pending.selected.co2) && systemIsOperational("co2", dependencyContext)) ||
                    (Boolean(pending.selected.oxygen) && systemIsOperational("oxygen", dependencyContext));
                if (airRevitalizationOnline) {
                    requestedLoads.push({
                        systemId: "air-revitalization",
                        label: "Air revitalization (CO₂ removal + O₂ generation)",
                        kw: 3.9 * (emergencyPowerMode ? 0.5 : 1), // 5.85 kW × 4/6 crew.
                    });
                }
                const requestedOptionalLoadKW = batteryRecoveryActive ? 0 : requestedLoads.reduce((sum, source) => sum + source.kw, 0);
                // Do not convert solar-cell temperature directly into an extra electrical load:
                // that made demand rise with sunlight and double-counted thermal control when
                // the selected thermal-control subsystem was already included above. Array
                // temperature affects PV efficiency; thermal-control power is counted only
                // through the installed thermal subsystem's explicit load rating.
                const solarThermalLoadKW = 0;
                // Shed noncritical loads automatically when generation cannot meet demand and battery SOC is low.
                // Below 25%, retain only the emergency floor plus a small research load if the lab is deployed.
                const preliminaryLoadKW = essentialLoadKW + requestedOptionalLoadKW + solarThermalLoadKW;
                // Compare with full requested load and retain the previous mode inside a deadband.
                // A wider hysteresis band prevents optional systems rapidly switching on/off
                // when solar output is close to the requested colony load.
                if (solarGeneration < preliminaryLoadKW - 2.0)
                    powerDeficitRef.current = true;
                else if (solarGeneration > preliminaryLoadKW + 2.0)
                    powerDeficitRef.current = false;
                const deficitExpected = powerDeficitRef.current;
                const optionalLoadKW = batteryRecoveryActive ? 0
                    : deficitExpected && current.battery <= 24
                        ? (pending.selected.science ? 0.25 : 0)
                        : deficitExpected && current.battery <= 34
                            ? requestedOptionalLoadKW * 0.25
                            : requestedOptionalLoadKW;
                const nominalLoadKW = essentialLoadKW + optionalLoadKW + solarThermalLoadKW;
                const baseLoadKW = Math.max(2.0, nominalLoadKW);
                // Grid conversion efficiency is an active retrofit metric, not display-only telemetry.
                const gridConversionEfficiency = pending.selected.grid && gridOnline
                    ? clamp(getAdditionalRating("grid", "conversion efficiency", pending.selected.grid, gridUpgrade) / 100, 0, 1)
                    : 1;
                const solarToBusKW = Math.min(solarGeneration * gridConversionEfficiency, gridTransferLimitKW);
                const solarNetKW = solarToBusKW - baseLoadKW;
                const batteryChargeLimitKW = batteryOnline
                    ? Math.min(LEVEL1_ENVIRONMENT.batteryMaximumChargePowerKW, getAdditionalRating("battery", "continuous charge power", pending.selected.battery ?? "Foundation", batteryUpgrade))
                    : 0;
                const chargeEfficiency = LEVEL1_ENVIRONMENT.batteryChargeEfficiency;
                const dischargeEfficiency = LEVEL1_ENVIRONMENT.batteryDischargeEfficiency;
                const minimumStoredEnergyKWh = batteryCapacityKWh * LEVEL1_ENVIRONMENT.batteryMinimumSOCPercent / 100;
                const availableStoredEnergyKWh = Math.max(0, storedEnergyKWh - minimumStoredEnergyKWh);
                const tickHours = Math.max(0, resourceDt / 3600);
                const energyLimitedDischargeKW = tickHours > 0 ? availableStoredEnergyKWh * dischargeEfficiency / tickHours : 0;
                const energyLimitedChargeKW = tickHours > 0 ? Math.max(0, batteryCapacityKWh - storedEnergyKWh) / (tickHours * chargeEfficiency) : 0;
                // Positive flow is actual bus power delivered by the battery; negative flow is
                // actual bus power diverted into charging. Respect the real deficit/surplus, rated
                // power, remaining stored energy/capacity, and grid transfer headroom.
                const gridHeadroomForBatteryKW = Math.max(0, gridTransferLimitKW - solarToBusKW);
                const batteryFlowKW = solarNetKW >= 0
                    ? (batteryOnline ? -Math.min(solarNetKW, batteryChargeLimitKW, energyLimitedChargeKW) : 0)
                    : Math.min(-solarNetKW, batteryDischargeLimitKW, energyLimitedDischargeKW, gridHeadroomForBatteryKW);
                const deliveredSourceKW = Math.max(0, solarToBusKW + batteryFlowKW);
                const deliveredPowerKW = Math.min(deliveredSourceKW, gridTransferLimitKW);
                // Power health follows electricity actually reaching the bus, including battery
                // discharge and any grid transfer limit—not solar output alone.
                const powerBase = clamp(50 + 50 * (deliveredPowerKW - baseLoadKW) / Math.max(1, baseLoadKW));
                // "Generation" means newly generated electrical power, not energy released
                // from storage. Keep battery discharge in its own live telemetry channel.
                const generationSources = [
                    ...(solarToBusKW > 0.001 ? [{ label: "Solar array", kw: solarToBusKW }] : []),
                ];
                const optionalDemandSources = requestedLoads
                    .map((source) => ({
                    label: source.systemId === "solar" ? "Solar-array controller / sensors" : source.systemId === "battery" ? "Battery-management electronics" : source.label,
                    kw: !batteryRecoveryActive && requestedOptionalLoadKW > 0
                        ? source.kw * (optionalLoadKW / requestedOptionalLoadKW)
                        : 0,
                }))
                    .filter((source) => source.kw > 0.001);
                // System demand is the load consumed by colony systems. Battery charging is
                // a separate destination for surplus power, not part of the load being compared
                // against generation; including it here made demand rise in lockstep with charging.
                const demandSources = [
                    { label: "Core life support, electrolysis and habitat controls", kw: essentialLoadKW },
                    ...optionalDemandSources,
                ];
                setElectricalReadings({
                    // Generation is new solar power. System demand excludes charging; the battery
                    // flow is tracked separately so the power balance can be displayed consistently.
                    generationKW: solarToBusKW,
                    actualSupplyKW: deliveredPowerKW,
                    consumptionKW: nominalLoadKW,
                    batteryFlowKW,
                    generationSources,
                    demandSources,
                    // Estimate time until the protected SOC floor using the actual current deficit.
                    // A tiny deficit should correctly show a long endurance; do not force needless discharge.
                    enduranceHours: batteryFlowKW > 0.01
                        ? availableStoredEnergyKWh * dischargeEfficiency / batteryFlowKW
                        : null,
                });
                const batteryDeltaKWh = batteryOnline
                    ? (batteryFlowKW >= 0
                        ? -(batteryFlowKW / LEVEL1_ENVIRONMENT.batteryDischargeEfficiency) * resourceDt / 3600
                        : (-batteryFlowKW * LEVEL1_ENVIRONMENT.batteryChargeEfficiency) * resourceDt / 3600)
                    : 0;
                const batteryDelta = batteryCapacityKWh > 0 ? batteryDeltaKWh / batteryCapacityKWh * 100 : 0;
                const powerRecovery = (powerBase - current.power) * (1 - Math.exp(-resourceDt / 7200));
                const powerPathAvailable = deliveredPowerKW >= 2;
                const oxygenProductionKgDay = oxygenOnline && powerPathAvailable
                    ? repairAdjustedRating("oxygen", getBaselineRating("oxygen", pending.selected.oxygen ?? "Foundation", oxygenUpgrade), buildings.oxygen?.repairMetrics)
                    : 0;
                const oxygenBalanceKg = (oxygenProductionKgDay - 3.36) * resourceDt / LEVEL1_ENVIRONMENT.secondsPerEarthDay;
                const oxygenDelta = oxygenBalanceKg / 24 * 100;
                const waterRecoveryPct = repairAdjustedRating("water", getBaselineRating("water", pending.selected.water ?? "Foundation", waterUpgrade), buildings.water?.repairMetrics);
                const waterThroughputLDay = getAdditionalRating("water", "throughput", pending.selected.water ?? "Foundation", waterUpgrade);
                const circulatingWaterLDay = 20; // Four-crew loop-flow assumption; recovery reduces net make-up loss.
                const effectiveWaterRecoveryPct = waterOnline && powerPathAvailable ? waterRecoveryPct : 0;
                const recycledWaterLDay = Math.min(circulatingWaterLDay, waterThroughputLDay) * effectiveWaterRecoveryPct / 100;
                const crewWaterLossLDay = Math.max(0, circulatingWaterLDay - recycledWaterLDay);
                const foodProductionKgDay = agricultureOnline && powerPathAvailable
                    ? repairAdjustedRating("agriculture", getBaselineRating("agriculture", pending.selected.agriculture ?? "Foundation", foodUpgrade), buildings.agriculture?.repairMetrics)
                    : 0;
                const foodDemandKgDay = 2.48; // Four-crew edible dry-food planning demand.
                const cropWaterUseLPerKg = getAdditionalRating("agriculture", "water consumed", pending.selected.agriculture ?? "Foundation", foodUpgrade);
                const grossCropWaterLDay = foodProductionKgDay * cropWaterUseLPerKg;
                // The humidity/recovery loop returns a share of crop transpiration to the clean-water tank.
                // When water recovery or its power path is offline, that returned fraction is zero.
                const netCropWaterLossLDay = grossCropWaterLDay * (1 - effectiveWaterRecoveryPct / 100);
                const netWaterLossLDay = crewWaterLossLDay + netCropWaterLossLDay;
                const waterDelta = -netWaterLossLDay * resourceDt / LEVEL1_ENVIRONMENT.secondsPerEarthDay / RESOURCE_CAPACITIES.waterReserveL * 100;
                const foodDelta = (foodProductionKgDay - foodDemandKgDay) * resourceDt / LEVEL1_ENVIRONMENT.secondsPerEarthDay / RESOURCE_CAPACITIES.foodReserveKg * 100;
                const ambientTemperature = blackoutMission ? 16.5 : pending.campaign === "mars" ? 18.0 : 24.0;
                const thermalRatedKW = thermalOnline
                    ? repairAdjustedRating("thermal", getBaselineRating("thermal", pending.selected.thermal ?? "Foundation", thermalUpgrade), buildings.thermal?.repairMetrics)
                    : 0;
                const thermalNeedKW = 0.7 + Math.abs(ambientTemperature - 21) * 0.15;
                const thermalCoverage = Math.min(1, thermalRatedKW / Math.max(0.1, thermalNeedKW));
                const thermalTarget = thermalOnline ? 21 + (ambientTemperature - 21) * (1 - thermalCoverage) : ambientTemperature;
                const thermalResponse = thermalOnline ? 1 - Math.exp(-resourceDt / (7200 / Math.max(0.25, thermalCoverage))) : 1 - Math.exp(-resourceDt / 28800);
                const radiationAvoidedPct = radiationOnline
                    ? repairAdjustedRating("radiation", getBaselineRating("radiation", pending.selected.radiation ?? "Foundation", radiationUpgrade), buildings.radiation?.repairMetrics)
                    : 0;
                const radiationDelta = 0.8 * (1 - radiationAvoidedPct / 100) * resourceDt / LEVEL1_ENVIRONMENT.secondsPerEarthDay;
                const habitatPressureLossRate = repairAdjustedRating("habitat", getBaselineRating("habitat", pending.selected.habitat ?? "Foundation", habitatUpgrade), buildings.habitat?.repairMetrics, true);
                const habitatDelta = -(0.05 + (habitatPressureLossRate / 8) * 0.05) * resourceDt / LEVEL1_ENVIRONMENT.secondsPerEarthDay;
                const faultImpact = Object.values(activeFaults).reduce((impact, fault) => {
                    const isBeingRepaired = activeOperationsRef.current[fault.targetTrackId]?.kind === "REPAIR";
                    const amount = (resourceDt / LEVEL1_ENVIRONMENT.secondsPerEarthDay) * fault.severity * (isBeingRepaired ? 0.25 : 1);
                    switch (fault.eventId) {
                        case "solar-dust":
                        case "regional-dust-front":
                            impact.power += 0.34 * amount;
                            impact.battery += 0.08 * amount;
                            break;
                        case "battery-thermal":
                            impact.battery += 0.31 * amount;
                            impact.power += 0.16 * amount;
                            break;
                        case "oxygen-filter":
                            impact.oxygen += 0.28 * amount;
                            impact.habitat += 0.04 * amount;
                            break;
                        case "co2-scrubber-loading":
                            impact.oxygen += 0.25 * amount;
                            impact.habitat += 0.08 * amount;
                            break;
                        case "water-filter":
                            impact.water += 0.26 * amount;
                            break;
                        case "habitat-pressure":
                            impact.habitat += 0.3 * amount;
                            impact.oxygen += 0.05 * amount;
                            impact.water += 0.04 * amount;
                            break;
                        case "micrometeoroid-impact":
                            impact.habitat += 0.24 * amount;
                            impact.power += 0.12 * amount;
                            break;
                        case "radiation-burst":
                            impact.radiation += 0.28 * amount;
                            break;
                        case "polar-shadow-cold-soak":
                        case "thermal-drift":
                            impact.temperature += 0.21 * amount;
                            impact.battery += 0.12 * amount;
                            break;
                        case "grid-overload":
                        case "core-power":
                            impact.power += 0.3 * amount;
                            impact.battery += 0.17 * amount;
                            break;
                        case "agriculture-stress":
                            impact.food += 0.26 * amount;
                            impact.water += 0.05 * amount;
                            break;
                        case "comms-drift":
                        case "mars-comm-relay-loss":
                            impact.power += 0.1 * amount;
                            break;
                        case "rover-wheel":
                            impact.battery += 0.1 * amount;
                            break;
                        case "extraction-lock":
                            impact.power += 0.2 * amount;
                            impact.battery += 0.07 * amount;
                            break;
                        case "isru-pressure":
                            impact.power += 0.2 * amount;
                            impact.battery += 0.13 * amount;
                            break;
                        case "science-anomaly":
                        case "maintenance-alert":
                            impact.power += 0.07 * amount;
                            break;
                        default: break;
                    }
                    return impact;
                }, { power: 0, battery: 0, oxygen: 0, water: 0, food: 0, habitat: 0, radiation: 0, temperature: 0 });
                return {
                    power: clamp(current.power + powerRecovery - faultImpact.power),
                    battery: clamp(current.battery + batteryDelta - faultImpact.battery, LEVEL1_ENVIRONMENT.batteryMinimumSOCPercent),
                    oxygen: clamp(current.oxygen + oxygenDelta - faultImpact.oxygen),
                    water: clamp(current.water + waterDelta - faultImpact.water),
                    food: clamp(current.food + foodDelta - faultImpact.food),
                    temperature: clamp(current.temperature + (thermalTarget - current.temperature) * thermalResponse + Math.sign(current.temperature - thermalTarget || 1) * faultImpact.temperature, 16, 28),
                    radiation: clamp(current.radiation + radiationDelta + faultImpact.radiation),
                    habitat: clamp(current.habitat + habitatDelta - faultImpact.habitat),
                };
            });
            setBuildings((current) => {
                const next = { ...current };
                for (const [trackId, state] of Object.entries(next)) {
                    const wear = (trackId === "solar" ? 0.013 : 0.0075) * stagePressure;
                    const repairingTrack = activeOperationsRef.current[trackId]?.kind === "REPAIR";
                    const solarProtection = trackId === "solar" ? solarFaultProtection(state.repairMetrics) : 0;
                    const faultWear = Object.values(activeFaults)
                        .filter((fault) => fault.targetTrackId === trackId)
                        .reduce((sum, fault) => sum + 0.26 * fault.severity * (resourceDt / LEVEL1_ENVIRONMENT.secondsPerEarthDay) * (repairingTrack ? 0.25 : 1) * (1 - solarProtection), 0);
                    next[trackId] = {
                        ...state,
                        condition: clamp(state.condition - Math.max(0.00025, wear) * (resourceDt / GAME_TIME_ACCELERATION) - faultWear),
                        status: buildingStatus(clamp(state.condition - Math.max(0.00025, wear) * (resourceDt / GAME_TIME_ACCELERATION) - faultWear)),
                        dust: trackId === "solar" ? clamp(state.dust + 0.018 * (resourceDt / GAME_TIME_ACCELERATION) * stagePressure) : state.dust,
                    };
                }
                return next;
            });
            const dt = 0.25 * speed * GAME_TIME_ACCELERATION;
            if (Object.keys(activeFaults).length > 0) {
                setActiveFaults((current) => Object.fromEntries(Object.entries(current).map(([key, fault]) => {
                    const isBeingRepaired = activeOperationsRef.current[fault.targetTrackId]?.kind === "REPAIR";
                    const overdue = !isBeingRepaired && fault.remainingSeconds <= dt;
                    return [key, {
                            ...fault,
                            remainingSeconds: isBeingRepaired ? fault.remainingSeconds : Math.max(0, fault.remainingSeconds - dt),
                            // Overdue faults cascade faster; a live repair isolates most propagation until completion.
                            severity: overdue ? Math.min(4, fault.severity + 0.06 * stagePressure * dt) : fault.severity,
                        }];
                })));
            }
        }, 250);
        return () => window.clearInterval(timer);
    }, [activeEventId, activeFaults, buildings, elapsed, emergencyPowerMode, manualPaused, metrics, pending, resolvedEventIds, results, speed]);
    useEffect(() => {
        if (!pending || results)
            return;
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
            activeOperations,
            operationResult,
            earthReport,
            earthReportAtSeconds,
            fallbackReadyAt,
            activeFaults,
            partsInventoryKg,
            sampleQuality,
            emergencyPowerMode,
            eventsTriggered: eventPointerRef.current,
        });
    }, [activeEventId, activeFaults, activeOperation, activeOperations, aiMessage, buildings, decisions, elapsed, emergencyPowerMode, earthReport, earthReportAtSeconds, fallbackReadyAt, metrics, operationResult, pending, resourceYield, resolvedEventIds, results, roverTask, sampleQuality, sampleStages, score, surveyedNodes, partsInventoryKg]);
    useEffect(() => {
        if (!results || !pending || completionSavedRef.current)
            return;
        completionSavedRef.current = true;
        const finalState = loadGameState();
        const alreadyComplete = finalState.completedMissions.includes(pending.missionId);
        const failReasonAtFinish = getMissionFailureReason(metrics);
        const failedAtFinish = missionFailed || Boolean(failReasonAtFinish);
        const firstTime = !failedAtFinish && !pending.replay && !alreadyComplete;
        const analysedSampleIds = Object.entries(sampleStages).filter(([, stage]) => stage === "ANALYSED").map(([id]) => id);
        // Reward clean, useful science more than simply completing many low-quality collection loops.
        const scienceTier = tierLevel(pending.selected.science ?? "Foundation");
        const researchBonusXp = firstTime ? analysedSampleIds.reduce((sum, id) => sum + 80 + Math.round((sampleQuality[id] ?? 60) * 0.8) + scienceTier * 20, 0) : 0;
        // Unrepaired faults are carried into mission closeout and reduce payout, even if the colony survived.
        const unresolvedFaultPenalty = Math.min(0.45, Object.keys(activeFaults).length * 0.1);
        const missionXpReward = failedAtFinish ? 0 : Math.round((pending.rewardXp + researchBonusXp) * (1 - unresolvedFaultPenalty));
        const creditedMissionSalvage = failedAtFinish
            ? Math.round(pending.rewardCredits * 0.15 * 10) / 10
            : Math.round(pending.rewardCredits * (1 - unresolvedFaultPenalty) * 10) / 10;
        const nextState = {
            ...finalState,
            credits: finalState.credits + creditedMissionSalvage,
            xp: finalState.xp + missionXpReward,
            researchTokens: finalState.researchTokens + (firstTime ? pending.rewardResearchTokens : 0),
            completedMissions: firstTime ? Array.from(new Set([...finalState.completedMissions, pending.missionId])) : finalState.completedMissions,
            lastMissionReward: firstTime
                ? {
                    missionId: pending.missionId,
                    title: pending.missionTitle,
                    credits: creditedMissionSalvage,
                    xp: missionXpReward,
                    researchTokens: pending.rewardResearchTokens,
                }
                : undefined,
        };
        saveGameState(nextState);
        clearMissionRuntime();
        clearPendingMission();
    }, [activeFaults, metrics, missionFailed, pending, results, sampleQuality, sampleStages]);
    const handleEventChoice = (choiceId) => {
        if (!activeEvent || !pending || eventResponseRef.current === activeEvent.id)
            return;
        // Prevent double-clicks from resolving one incident twice while React updates the overlay.
        eventResponseRef.current = activeEvent.id;
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
                }
                else if (choiceId === "shed") {
                    setMetrics((current) => ({ ...current, power: clamp(current.power + 2), battery: clamp(current.battery + 8) }));
                    setScore((value) => clamp(value + 6));
                    setAiMessage("Load shedding protected your battery reserve while the array remained dirty.");
                }
                else {
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
                }
                else if (choiceId === "rebalance") {
                    setMetrics((current) => ({ ...current, battery: clamp(current.battery + 6), power: clamp(current.power + 2) }));
                    setScore((value) => clamp(value + 7));
                    setAiMessage("Load balancing was the strongest response: it protected the storage reserve without shutting down life support.");
                }
                else {
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
                }
                else if (choiceId === "reduce") {
                    setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + 2), battery: clamp(current.battery + 3) }));
                    setScore((value) => clamp(value + 5));
                    setAiMessage("Reducing non-essential habitation load bought the oxygen system time without spending much stored power.");
                }
                else {
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
                }
                else if (choiceId === "recover") {
                    setBuildings((current) => ({ ...current, co2: { ...(current.co2 ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.co2?.condition ?? 100) + 4 + level), status: "ONLINE" } }));
                    setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + 2), food: clamp(current.food + 1), power: clamp(current.power - 2) }));
                    setScore((value) => clamp(value + 6));
                    setAiMessage("Carbon recovery completed at a lower throughput; air quality and material recovery both benefited.");
                }
                else {
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
                }
                else if (choiceId === "ration") {
                    setMetrics((current) => ({ ...current, water: clamp(current.water + 2), battery: clamp(current.battery + 3) }));
                    setScore((value) => clamp(value + 5));
                    setAiMessage("Water conservation protected the reserve while the filter remained partially restricted.");
                }
                else {
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
                }
                else if (choiceId === "monitor") {
                    setMetrics((current) => ({ ...current, habitat: clamp(current.habitat + 1) }));
                    setScore((value) => clamp(value + 3));
                    setAiMessage("Monitoring worked, but it left less safety margin than an immediate inspection and seal.");
                }
                else {
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
                }
                else if (choiceId === "isolate") {
                    setMetrics((current) => ({ ...current, power: clamp(current.power - 2), battery: clamp(current.battery - 2) }));
                    setScore((value) => clamp(value + 6));
                    setAiMessage("The affected circuit was isolated. Some capability was lost, but the primary habitat power path remained protected.");
                }
                else {
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
                }
                else if (choiceId === "reroute") {
                    setMetrics((current) => ({ ...current, battery: clamp(current.battery - 1), power: clamp(current.power + 2), temperature: clamp(current.temperature + (21 - current.temperature) * 0.24, 16, 28) }));
                    setScore((value) => clamp(value + 8));
                    setAiMessage("Non-critical electrical loads were shed and thermal protection was prioritized.");
                }
                else {
                    setBuildings((current) => {
                        const next = { ...current };
                        for (const id of ["thermal", "solar"]) {
                            if (!next[id])
                                continue;
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
                }
                else if (choiceId === "protect") {
                    setBuildings((current) => ({ ...current, solar: { ...(current.solar ?? { condition: 100, dust: 0, status: "ONLINE" }), dust: clamp((current.solar?.dust ?? 0) + 3) } }));
                    setMetrics((current) => ({ ...current, power: clamp(current.power - 4) }));
                    setScore((value) => clamp(value + 6));
                    setAiMessage("Array operations were reduced while the dust front passed. Solar losses stayed manageable.");
                }
                else {
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
                }
                else if (choiceId === "repoint") {
                    setBuildings((current) => ({ ...current, comms: { ...(current.comms ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.comms?.condition ?? 100) + 7), status: "ONLINE" } }));
                    setScore((value) => clamp(value + 8));
                    setAiMessage("The relay antenna was repointed and the communications margin recovered.");
                }
                else {
                    setScore((value) => clamp(value - 5));
                    setAiMessage("The degraded link was held without intervention. Critical autonomy remained available, but communications margin stayed low.");
                }
                break;
            case "radiation-burst":
                if (choiceId === "shelter") {
                    setMetrics((current) => ({ ...current, radiation: clamp(current.radiation - 4), power: clamp(current.power - 3) }));
                    setScore((value) => clamp(value + 7));
                    setAiMessage("Shelter mode reduced radiation exposure and protected the crew while the event passed.");
                }
                else if (choiceId === "maintain") {
                    setMetrics((current) => ({ ...current, radiation: clamp(current.radiation + 4) }));
                    setScore((value) => clamp(value + 1));
                    setAiMessage("Surface operations continued, but the colony accepted higher radiation exposure.");
                }
                else {
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
                }
                else if (choiceId === "conserve") {
                    setMetrics((current) => ({ ...current, temperature: clamp(current.temperature + (21 - current.temperature) * 0.35, 16, 28), battery: clamp(current.battery + 3) }));
                    setScore((value) => clamp(value + 5));
                    setAiMessage("Energy conservation preserved the battery, but the temperature correction was slower.");
                }
                else {
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
                }
                else if (choiceId === "redundancy") {
                    setScore((value) => clamp(value + (pending.selected.navigation ? 7 : 2)));
                    setAiMessage(pending.selected.navigation ? "Navigation redundancy preserved communications while the primary link drifted." : "The current link remained open, but its margin stayed limited.");
                }
                else {
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
                }
                else if (choiceId === "shed") {
                    setMetrics((current) => ({ ...current, power: clamp(current.power + 3), battery: clamp(current.battery + 7) }));
                    setScore((value) => clamp(value + 6));
                    setAiMessage("Optional loads were shed before the grid became unstable. Battery reserve improved.");
                }
                else {
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
                }
                else if (choiceId === "recall") {
                    setRoverTask("RETURNING");
                    setScore((value) => clamp(value + 3));
                    setAiMessage("The rover was recalled safely. The survey objective will be less complete, but equipment risk is low.");
                }
                else {
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
                }
                else if (choiceId === "abort") {
                    setScore((value) => clamp(value + 2));
                    setAiMessage("The resource opportunity was abandoned, but the extraction equipment stayed protected.");
                }
                else {
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
                }
                else if (choiceId === "isolate") {
                    setScore((value) => clamp(value + 5));
                    setAiMessage("The processing line was isolated. Production slowed, but the rest of the colony stayed stable.");
                }
                else {
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
                }
                else if (choiceId === "conserve") {
                    setMetrics((current) => ({ ...current, battery: clamp(current.battery + 3), food: clamp(current.food - 1) }));
                    setScore((value) => clamp(value + 4));
                    setAiMessage("Power was conserved, but the greenhouse accepted a small production penalty.");
                }
                else {
                    setMetrics((current) => ({ ...current, food: clamp(current.food - 10) }));
                    setScore((value) => clamp(value - 7));
                    setAiMessage("Controlled-environment crop stress was left unresolved, reducing food-production reserve.");
                }
                break;
            case "science-anomaly":
                if (choiceId === "secure") {
                    setScore((value) => clamp(value + 9));
                    setAiMessage("Research data was secured safely. This was an efficient use of an optional science capability.");
                }
                else if (choiceId === "isolate") {
                    setBuildings((current) => ({ ...current, science: { ...(current.science ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.science?.condition ?? 100) + 3), status: "ONLINE" } }));
                    setScore((value) => clamp(value + 5));
                    setAiMessage("The instrument was isolated and protected. Some scientific value was preserved without adding much risk.");
                }
                else {
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
                }
                else if (choiceId === "monitor") {
                    setScore((value) => clamp(value + 3));
                    setAiMessage("Monitoring saved power, but the developing fault remains on the watch list.");
                }
                else {
                    setBuildings((current) => {
                        const candidates = Object.entries(current).sort(([, a], [, b]) => a.condition - b.condition);
                        const target = candidates[0]?.[0];
                        if (!target)
                            return current;
                        return { ...current, [target]: { ...current[target], condition: clamp(current[target].condition - 8), status: buildingStatus(clamp(current[target].condition - 8)) } };
                    });
                    setScore((value) => clamp(value - 8));
                    setAiMessage("The maintenance alert was ignored. The fault is now more likely to become a real repair task.");
                }
                break;
            default:
                setAiMessage("Mission AI recorded the decision and will include it in the final analysis.");
        }
        // "Carry on" is a risk decision, not a free dismissal. Safe responses clear the live
        // incident fault, while unsafe choices shorten the cascade window and worsen the plant.
        const unsafeChoices = new Set(["ignore", "continue", "defer", "force", "push", "hold", "maintain"]);
        if (unsafeChoices.has(choiceId)) {
            const targetTrackId = activeTargetTrackId ?? activeEvent.trackId;
            const missionStage = Math.max(1, Number.parseInt((pending.missionNumber ?? "").replace(/[^0-9]/g, ""), 10) || 1);
            const severity = 1.5 + Math.min(1.7, (missionStage - 1) * 0.12 + eventPointerRef.current * 0.075) + (pending.campaign === "mars" ? 0.15 : 0);
            const remainingSeconds = Math.max(14, 29 - missionStage * 0.8 - eventPointerRef.current * 1.1) * GAME_TIME_ACCELERATION;
            setActiveFaults((current) => ({
                ...current,
                [activeEvent.id]: { eventId: activeEvent.id, targetTrackId, title: activeEvent.title, remainingSeconds, severity },
            }));
            const cascadeHit = Math.min(6.5, 2.4 + missionStage * 0.28 + eventPointerRef.current * 0.25);
            setBuildings((current) => {
                const previous = current[targetTrackId];
                if (!previous)
                    return current;
                const condition = clamp(previous.condition - 2.5 - missionStage * 0.18);
                const nextTarget = { ...previous, condition, status: buildingStatus(condition) };
                const primaryMetric = getPrimaryRepairMetric(targetTrackId);
                if (primaryMetric && targetTrackId !== "solar" && targetTrackId !== "maintenance") {
                    nextTarget.repairMetrics = {
                        ...(previous.repairMetrics ?? {}),
                        [repairGapKey(primaryMetric)]: getStandardRepairGap(targetTrackId, pending.selected),
                        [repairInitialGapKey(primaryMetric)]: getStandardRepairGap(targetTrackId, pending.selected),
                    };
                }
                return { ...current, [targetTrackId]: nextTarget };
            });
            setMetrics((current) => {
                switch (activeEvent.id) {
                    case "solar-dust":
                    case "regional-dust-front": return { ...current, power: clamp(current.power - cascadeHit), battery: clamp(current.battery - cascadeHit * 0.6) };
                    case "battery-thermal": return { ...current, battery: clamp(current.battery - cascadeHit), power: clamp(current.power - cascadeHit * 0.35) };
                    case "oxygen-filter":
                    case "co2-scrubber-loading": return { ...current, oxygen: clamp(current.oxygen - cascadeHit) };
                    case "water-filter": return { ...current, water: clamp(current.water - cascadeHit) };
                    case "habitat-pressure":
                    case "micrometeoroid-impact": return { ...current, habitat: clamp(current.habitat - cascadeHit) };
                    case "radiation-burst": return { ...current, radiation: clamp(current.radiation + cascadeHit) };
                    case "polar-shadow-cold-soak":
                    case "thermal-drift": return { ...current, temperature: clamp(current.temperature + (current.temperature < 21 ? -1 : 1) * cascadeHit * 0.3, 16, 28), battery: clamp(current.battery - cascadeHit * 0.6) };
                    case "grid-overload":
                    case "core-power": return { ...current, power: clamp(current.power - cascadeHit), battery: clamp(current.battery - cascadeHit * 0.7) };
                    case "agriculture-stress": return { ...current, food: clamp(current.food - cascadeHit), water: clamp(current.water - cascadeHit * 0.4) };
                    default: return { ...current, power: clamp(current.power - cascadeHit * 0.45), battery: clamp(current.battery - cascadeHit * 0.35) };
                }
            });
            setAiMessage(`UNRESOLVED FAULT · ${activeEvent.title}. ${targetTrackId.toUpperCase()} is now cascading at ${severity.toFixed(1)}× severity. The response window is ${formatWallClockCountdown(remainingSeconds, speed, GAME_TIME_ACCELERATION)} seconds; inspect that facility and run a timed repair before the fault spreads further.`);
            setOperationResult(`FAULT NOT ISOLATED · You chose to continue. ${targetTrackId.toUpperCase()} has taken additional damage and will keep degrading other colony reserves. The fault register now contains this incident until a repair operation finishes.`);
        }
        else {
            setActiveFaults((current) => {
                const next = { ...current };
                delete next[activeEvent.id];
                return next;
            });
            setAiMessage(`INCIDENT STABILIZED · ${activeEvent.title}. The immediate cascade has been stopped. The equipment still took damage, so inspect its condition and reserves before resuming high-load operations.`);
        }
        setActiveEventId(null);
    };
    const checkActionPrerequisites = (systemId, actionId, nodeId) => {
        const nodes = RESOURCE_NODES[pending?.campaign === "mars" ? "MARS" : "MOON"];
        const node = nodeId ? nodes.find((item) => item.id === nodeId) : undefined;
        return getActionBlockers(systemId, actionId, {
            selected: pending?.selected ?? {},
            buildings,
            activeFaults,
            metrics,
            surveyedNodes,
            sampleStages,
            resourceYield,
            partsInventoryKg: missionStage === 1 ? Number.POSITIVE_INFINITY : partsInventoryKg,
        }, node);
    };
    const beginOperation = (kind, targetId, label, durationSeconds, targetLevel, specimenQuality, actionId, operationKey = targetId, roverAssigned = false, supportSystems = []) => {
        if (!pending || activeOperationsRef.current[operationKey] || activeEventId || results)
            return;
        const operation = {
            id: `${kind.toLowerCase()}-${targetId}-${Date.now()}`,
            kind,
            targetId,
            label,
            totalSeconds: durationSeconds,
            remainingSeconds: durationSeconds,
            operationKey,
            ...(roverAssigned ? { roverAssigned: true } : {}),
            ...(supportSystems.length ? { supportSystems: [...supportSystems] } : {}),
            ...(targetLevel !== undefined ? { targetLevel } : {}),
            ...(specimenQuality !== undefined ? { sampleQuality: specimenQuality } : {}),
            ...(actionId !== undefined ? { actionId } : {}),
        };
        operationCompletionRef.current.delete(operation.id);
        setActiveOperations((current) => ({ ...current, [operationKey]: operation }));
        if (durationSeconds <= 0) {
            operationCompletionRef.current.add(operation.id);
            window.setTimeout(() => finishOperation({ ...operation, remainingSeconds: 0 }), 0);
        }
        setOperationResult(null);
        setManualActions((value) => value + 1);
        setAiMessage(`${label} started. Estimated real-time duration: ${durationSeconds} seconds. Other systems remain available while this job runs.`);
    };
    const handleResourceAction = (nodeId, action) => {
        if (!pending || activeEventId || results)
            return;
        const nodes = RESOURCE_NODES[pending.campaign === "mars" ? "MARS" : "MOON"];
        const node = nodes.find((item) => item.id === nodeId);
        if (!node)
            return;
        const blockers = checkActionPrerequisites("field", action, nodeId);
        if (blockers.length > 0) {
            setOperationResult(`FIELD OPERATION LOCKED · ${blockers.join(" · ")}.`);
            setAiMessage(`FIELD OPERATION LOCKED · ${blockers.join(" · ")}.`);
            return;
        }
        const stage = sampleStages[nodeId] ?? (surveyedNodes.includes(nodeId) ? "SURVEYED" : "UNSURVEYED");
        const hasRover = pending.selected.rover !== undefined;
        const hasExtraction = pending.selected.extraction !== undefined;
        const hasScience = pending.selected.science !== undefined;
        const fieldWorkInProgress = Object.values(activeOperationsRef.current).some((operation) => operation.roverAssigned || ["SURVEY", "COLLECT", "TRANSFER"].includes(operation.kind) || (operation.kind === "SYSTEM_ACTION" && operation.targetId === "rover") || (hasRover && operation.kind === "SYSTEM_ACTION" && operation.targetId === "solar" && operation.actionId === "clean") || (hasRover && operation.kind === "REPAIR" && roverTask.startsWith("REPAIRING ")));
        if (activeOperationsRef.current[nodeId] || (hasRover && fieldWorkInProgress) || (hasScience && activeOperationsRef.current.science))
            return;
        const navigationErrorM = repairAdjustedRating("navigation", getBaselineRating("navigation", pending.selected.navigation ?? "Foundation", buildings.navigation?.upgradeLevel ?? 0), buildings.navigation?.repairMetrics, true);
        const navigationAccuracy = clamp(100 - navigationErrorM, 0, 100);
        const scienceBaseAccuracy = getAdditionalRating("science", "accuracy", pending.selected.science ?? "Foundation", buildings.science?.upgradeLevel ?? 0);
        const scienceAccuracy = scienceBaseAccuracy * (hasScience ? repairCapabilityFraction("science", pending.selected, buildings) : 1);
        const roverRatedSpeed = hasRover ? getBaselineRating("rover", pending.selected.rover ?? "Foundation", buildings.rover?.upgradeLevel ?? 0) : 0;
        const roverEffectiveSpeed = hasRover ? repairAdjustedRating("rover", roverRatedSpeed, buildings.rover?.repairMetrics) : 0;
        const roverTimeFactor = hasRover && roverRatedSpeed > 0 ? clamp(roverRatedSpeed / Math.max(0.1, roverEffectiveSpeed), 1, 4) : 1;
        const extractionFactor = hasExtraction ? repairCapabilityFraction("extraction", pending.selected, buildings) : 1;
        if (action === "survey" && stage === "UNSURVEYED") {
            const duration = 18 * roverTimeFactor;
            beginOperation("SURVEY", nodeId, `Surveying ${node.label}`, duration, undefined, undefined, undefined, hasRover ? "rover" : nodeId, hasRover);
            setRoverTask(`SURVEYING ${node.label}`);
            setMetrics((current) => ({ ...current, power: clamp(current.power - (hasRover ? 2 : 3)), battery: clamp(current.battery - 1) }));
            return;
        }
        if (action === "sample" && stage === "SURVEYED") {
            const duration = (hasExtraction ? 20 : 27) * roverTimeFactor;
            if (metrics.power < 7 || metrics.battery < 3) {
                setOperationResult(`COLLECTION HELD · Sampling requires at least ${physicalThreshold("power", 7)} and ${physicalThreshold("battery", 3, ratedBatteryCapacityKWh(pending.selected, buildings))}. Restore the energy margin first.`);
                return;
            }
            const equipmentFault = Object.values(activeFaults).some((fault) => ["rover", "extraction", "navigation"].includes(fault.targetTrackId));
            const quality = clamp((hasRover ? 60 : 45) + (hasExtraction ? 10 * extractionFactor : 0) + navigationAccuracy * 0.15 + scienceAccuracy * 0.10 - (equipmentFault ? 12 : 0), 38, 98);
            const adjustedDuration = duration * (emergencyPowerMode ? 1.25 : 1);
            beginOperation("COLLECT", nodeId, `Collecting sealed core sample · ${node.label}`, adjustedDuration, undefined, quality, undefined, hasRover ? "rover" : nodeId, hasRover);
            setMetrics((current) => ({ ...current, power: clamp(current.power - Math.max(2, hasExtraction ? 5 : hasRover ? 3 : 3.5)), battery: clamp(current.battery - 2), radiation: clamp(current.radiation + (hasRover ? 0 : 1.5)) }));
            setRoverTask(hasRover ? `COLLECTING ${node.label}` : hasExtraction ? "DRILLING CORE" : "EVA SAMPLING");
            return;
        }
        if (action === "transfer" && stage === "COLLECTED") {
            const duration = 16 * roverTimeFactor;
            beginOperation("TRANSFER", nodeId, `Transferring sealed sample · ${node.label}`, duration, undefined, undefined, undefined, hasRover ? "rover" : nodeId, hasRover);
            setRoverTask(`TRANSFERRING ${node.label}`);
            if (!hasRover)
                setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen - 1.5), radiation: clamp(current.radiation + 1.5) }));
            return;
        }
        if (action === "analyze" && stage === "DELIVERED") {
            const scienceRatedThroughput = getBaselineRating("science", pending.selected.science ?? "Foundation", buildings.science?.upgradeLevel ?? 0);
            const scienceThroughput = repairAdjustedRating("science", scienceRatedThroughput, buildings.science?.repairMetrics);
            const scienceThroughputFraction = scienceRatedThroughput > 0 ? clamp(scienceThroughput / scienceRatedThroughput, 0, 1) : 1;
            const duration = 20 / Math.max(0.25, scienceThroughputFraction);
            if (metrics.power < 5) {
                setOperationResult("ANALYSIS HELD · Insufficient power for the spectrometer / field assay. Restore power before analysing.");
                return;
            }
            beginOperation("ANALYZE", nodeId, `Analysing sample · ${node.label}`, duration, undefined, undefined, undefined, hasScience ? "science" : nodeId);
            setMetrics((current) => ({ ...current, power: clamp(current.power - (hasScience ? 3 : 5)) }));
            return;
        }
    };
    const runQuickCommand = (command) => {
        if (command === "survey") {
            const nodes = RESOURCE_NODES[pending?.campaign === "mars" ? "MARS" : "MOON"];
            const nextNode = nodes.find((node) => !surveyedNodes.includes(node.id)) ?? nodes[0];
            if (nextNode)
                handleResourceAction(nextNode.id, "survey");
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
    const handleBuildingAction = (trackId, action) => {
        if (!pending?.selected[trackId] || activeOperationsRef.current[trackId] || Object.values(activeOperationsRef.current).some((job) => job.supportSystems?.includes(trackId)) || activeEventId || results)
            return;
        const repairOption = action.startsWith("repair:") ? getRepairOption(trackId, action.slice("repair:".length)) : action === "repair-active" ? getRepairOptions(trackId).find((option) => option.category === "Standalone") : undefined;
        const integratedVariant = decodeActionVariant(trackId, action);
        const baseActionId = integratedVariant?.baseActionId ?? action;
        const integratedHelpers = integratedVariant?.supportSystems ?? [];
        const effectiveAction = repairOption || action === "repair-active" ? "repair-active" : baseActionId;
        const repairActionId = repairOption ? `repair:${repairOption.id}` : action;
        const fallbackKey = `${trackId}:${action}`;
        const hasOwnActiveFault = Object.values(activeFaults).some((fault) => fault.targetTrackId === trackId);
        const emergencyOverride = action.startsWith("fallback-") && fallbackEmergencyOverride(action, trackId, metrics, hasOwnActiveFault);
        const fallbackRemaining = (fallbackReadyAt[fallbackKey] ?? 0) - elapsed;
        if (action.startsWith("fallback-") && fallbackRemaining > 0 && !emergencyOverride) {
            setOperationResult(`EMERGENCY BACKUP RECHARGING · ${action.replace("fallback-", "").toUpperCase()} is available again in ${formatWallClockCountdown(fallbackRemaining, speed, GAME_TIME_ACCELERATION)} seconds.`);
            return;
        }
        const blockers = checkActionPrerequisites(trackId, action);
        if (blockers.length > 0) {
            setOperationResult(`ACTION LOCKED · ${blockers.join(" · ")}.`);
            setAiMessage(`ACTION LOCKED · ${blockers.join(" · ")}.`);
            return;
        }
        const roverOnFieldJob = pending.selected.rover !== undefined && Object.values(activeOperationsRef.current).some((operation) => operation.roverAssigned || ["SURVEY", "COLLECT", "TRANSFER"].includes(operation.kind) || (operation.kind === "SYSTEM_ACTION" && operation.targetId === "rover") || (operation.kind === "SYSTEM_ACTION" && operation.targetId === "solar" && operation.actionId === "clean") || (operation.kind === "REPAIR" && roverTask.startsWith("REPAIRING ")));
        if (roverOnFieldJob && (trackId === "rover" || baseActionId === "survey" || baseActionId === "return" || (baseActionId === "clean" && integratedHelpers.includes("rover")))) {
            setOperationResult("ROVER UNAVAILABLE · The rover is already committed to field work. Finish that job or return it to base before dispatching it elsewhere.");
            return;
        }
        if (baseActionId === "upgrade") {
            const current = buildings[trackId] ?? { condition: 100, dust: 0, status: "ONLINE", upgradeLevel: 0 };
            const currentLevel = current.upgradeLevel ?? 0;
            const installation = getRetrofitInstallation(trackId, pending.selected[trackId], currentLevel);
            if (!installation) {
                setAiMessage(`${trackId.toUpperCase()} is already at 2/2 retrofit progress for its selected technology tier.`);
                return;
            }
            if (missionStage !== 1 && partsInventoryKg + 1e-6 < installation.materialKg) {
                setOperationResult(`RETROFIT LOCKED · ${installation.kit} requires ${installation.materialKg.toFixed(1)} kg material; only ${partsInventoryKg.toFixed(1)} kg is available.`);
                return;
            }
            const batteryCapacity = ratedBatteryCapacityKWh(pending.selected, buildings);
            const availableEnergyKWh = (metrics.battery / 100) * batteryCapacity;
            if (availableEnergyKWh < installation.energyKWh) {
                setOperationResult(`RETROFIT LOCKED · Requires ${installation.energyKWh} kWh commissioning energy; stored energy is ${availableEnergyKWh.toFixed(1)} kWh. Recharge the battery before installation.`);
                return;
            }
            const targetLevel = currentLevel + 1;
            if (missionStage !== 1)
                setPartsInventoryKg((stock) => Math.max(0, stock - installation.materialKg));
            setMetrics((value) => ({ ...value, battery: clamp(value.battery - installation.energyKWh / batteryCapacity * 100) }));
            const installationSeconds = [12, 15, 18, 20][Math.min(3, currentLevel)];
            beginOperation("UPGRADE", trackId, `Installing ${installation.tier} retrofit ${installation.newProgress} · ${technologyTracks.find((track) => track.id === trackId)?.category ?? trackId}`, installationSeconds, targetLevel, undefined, "retrofit");
            setAiMessage(`RETROFIT STARTED · ${installation.metric}: ${installation.directGain}. Cost paid: ${missionStage === 1 ? "no spare parts in Mission 1" : `${installation.materialKg.toFixed(1)} kg on-site material`} and ${installation.energyKWh.toFixed(2)} kWh commissioning energy. Additional effect: ${retrofitSecondaryPreview(trackId, installation.tier, targetLevel)}. Installation takes ${installationSeconds} simulated seconds at 1× and scales with simulation speed.`);
            return;
        }
        const matchingFaults = Object.values(activeFaults).filter((fault) => fault.targetTrackId === trackId && effectiveAction === "repair-active");
        // Workbook repair procedures are also preventive maintenance: they can run without an active fault.
        if (repairOption || matchingFaults.length > 0) {
            const repairTargetId = trackId === "maintenance" && matchingFaults.length > 0 && !repairOption
                ? [...matchingFaults].sort((a, b) => b.severity - a.severity)[0].targetTrackId
                : trackId;
            if (activeOperationsRef.current[repairTargetId]) {
                setOperationResult(`REPAIR QUEUED · ${repairTargetId.toUpperCase()} already has a work order running. Finish that job before starting another repair on the same system.`);
                return;
            }
            const selectedRepair = repairOption ?? getRepairOptions(trackId).find((option) => option.category === "Standalone");
            if (!selectedRepair) {
                setOperationResult("REPAIR LOCKED · No standalone procedure is defined for this system in the balance workbook.");
                return;
            }
            const tierIndex = effectiveRepairTierIndex(pending.selected[repairTargetId] ?? "Foundation", selectedRepair.requiredSystems, pending.selected);
            const durationSeconds = selectedRepair.category === "Standalone" ? [8, 9, 10, 12][tierIndex] : selectedRepair.category === "Enhanced" ? [15, 16, 18, 20][tierIndex] : selectedRepair.category === "Dual" ? [22, 24, 27, 30][tierIndex] : [30, 33, 36, 40][tierIndex];
            const batteryCapacity = ratedBatteryCapacityKWh(pending.selected, buildings);
            const availableEnergyKWh = (metrics.battery / 100) * batteryCapacity;
            if (availableEnergyKWh < selectedRepair.energyKWh) {
                setOperationResult(`REPAIR LOCKED · ${selectedRepair.name} needs ${selectedRepair.energyKWh} kWh; stored energy is ${availableEnergyKWh.toFixed(2)} kWh.`);
                return;
            }
            if (missionStage !== 1 && partsInventoryKg < selectedRepair.partsMassKg) {
                setOperationResult(`REPAIR LOCKED · ${selectedRepair.name} needs ${selectedRepair.partsMassKg} kg parts; ${partsInventoryKg.toFixed(2)} kg is available.`);
                return;
            }
            setMetrics((current) => ({ ...current, battery: clamp(current.battery - selectedRepair.energyKWh / batteryCapacity * 100) }));
            if (missionStage !== 1)
                setPartsInventoryKg((current) => Math.max(0, current - selectedRepair.partsMassKg));
            const repairSupports = selectedRepair.requiredSystems;
            const roverCanAssist = pending.selected.rover !== undefined && repairSupports.includes("rover") && !roverOnFieldJob;
            if (roverCanAssist)
                setRoverTask(`REPAIRING ${repairTargetId}`);
            beginOperation("REPAIR", repairTargetId, `Repair · ${selectedRepair.name}`, durationSeconds, undefined, undefined, `repair:${selectedRepair.id}`, repairTargetId, roverCanAssist, repairSupports);
            setAiMessage(`REPAIR STARTED · ${selectedRepair.name}. Estimated real-time duration: ${durationSeconds} seconds. Consumes ${selectedRepair.energyKWh} kWh and ${missionStage === 1 ? "no spare parts (Mission 1 exemption)" : `${selectedRepair.partsMassKg} kg of parts`}. Support requirements: ${repairSupports.length ? selectedRepair.requiredSystemNames.join(" + ") : "none"}. ${repairTargetId === "battery" ? "Non-essential loads are temporarily paused; the battery charges only if solar generation exceeds critical demand." : "Normal power management continues during the repair."}`);
            return;
        }
        const actionLabels = {
            clean: "Clean solar array", tune: "Tune solar tracking", balance: "Balance battery cells", reserve: "Protect battery reserve",
            reset: "Reset oxygen loop", boost: "Boost oxygen processing", flush: "Flush water recovery", purify: "Deep-purify water",
            scrub: "Regenerate CO₂ scrubber", recover: "Recover carbon compounds", dump: "Rebalance thermal loop", insulate: "Apply thermal protection",
            repoint: "Repoint communications antenna", test: "Test communications link", repair: "Repair habitat seal", seal: "Run pressure check",
            shield: "Inspect radiation shielding", shelter: "Engage shelter protocol", "balance-grid": "Balance power bus", prioritize: "Prioritise life-support loads",
            calibrate: "Calibrate science instruments", experiment: "Run field experiment", "nav-calibrate": "Calibrate navigation", route: "Plan rover route",
            survey: "Dispatch rover survey", return: "Recall rover", inspect: "Inspect rover", "extract-test": "Test extraction drill", extract: "Collect extraction sample",
            process: "Process local feedstock", purge: "Purge ISRU line", "tune-crops": "Tune greenhouse controls", harvest: "Harvest crop output",
            service: "Run maintenance service", diagnostics: "Run predictive diagnostics", "request-earth-report": "Request Earth Mission Control report",
        };
        if (baseActionId === "survey") {
            const nodes = RESOURCE_NODES[pending.campaign === "mars" ? "MARS" : "MOON"];
            const nextNode = nodes.find((node) => !surveyedNodes.includes(node.id)) ?? nodes[0];
            if (nextNode)
                setRoverTask(`SURVEYING ${nextNode.label}`);
        }
        else if (baseActionId === "return") {
            setRoverTask("RETURNING");
        }
        else if (baseActionId === "clean" && integratedHelpers.includes("rover")) {
            setRoverTask("CLEANING ARRAY");
        }
        if (action.startsWith("fallback-")) {
            setFallbackReadyAt((current) => ({ ...current, [fallbackKey]: elapsed + 70 * GAME_TIME_ACCELERATION }));
        }
        const navigationQueueDuration = earthReportDelaySeconds(pending.selected.navigation ?? "Foundation", buildings.navigation?.upgradeLevel ?? 0);
        const commsRatedThroughput = pending.selected.comms
            ? getBaselineRating("comms", pending.selected.comms, buildings.comms?.upgradeLevel ?? 0)
            : 0;
        const commsThroughput = pending.selected.comms
            ? repairAdjustedRating("comms", commsRatedThroughput, buildings.comms?.repairMetrics)
            : 0;
        const commsQueueFactor = commsRatedThroughput > 0 ? clamp(commsRatedThroughput / Math.max(0.1, commsThroughput), 1, 5) : 1;
        const baseDuration = baseActionId === "request-earth-report"
            ? Math.ceil(navigationQueueDuration * commsQueueFactor)
            : (SYSTEM_ACTION_SECONDS[baseActionId] ?? 6);
        const duration = baseDuration;
        const supportsLabel = integratedHelpers.length
            ? ` · integrated with ${integratedHelpers.map((id) => SUPPORT_SHORT_LABELS[id] ?? SYSTEM_LABELS[id] ?? id).join(" + ")}`
            : "";
        beginOperation("SYSTEM_ACTION", trackId, `${actionLabels[baseActionId] ?? `Operate ${trackId}`}${supportsLabel}`, duration, undefined, undefined, action, trackId, (trackId === "rover" && pending.selected.rover !== undefined) ||
            (trackId === "solar" && baseActionId === "clean" && integratedHelpers.includes("rover")));
    };
    const applyBuildingAction = (trackId, action) => {
        if (!pending)
            return;
        const integratedVariant = decodeActionVariant(trackId, action);
        const baseActionId = integratedVariant?.baseActionId ?? action;
        const integratedHelpers = integratedVariant?.supportSystems ?? [];
        const gain = (amount) => amount;
        const cost = (amount) => amount;
        const conditionBoost = (amount) => {
            setBuildings((current) => {
                const previous = current[trackId] ?? { condition: 100, dust: 0, status: "ONLINE" };
                const condition = clamp(previous.condition + amount);
                return { ...current, [trackId]: { ...previous, condition, status: buildingStatus(condition) } };
            });
        };
        switch (baseActionId) {
            case "upgrade": {
                // Deliberately no side effects here: handleBuildingAction routes this action
                // through the workbook's timed, costed retrofit installer.
                setAiMessage("Generic upgrade shortcut disabled. Use the workbook-driven retrofit installation.");
                break;
            }
            case "fallback-solar": {
                const dustReduction = gain(7);
                setBuildings((current) => {
                    const previous = current.solar ?? { condition: 100, dust: 0, status: "ONLINE" };
                    const condition = clamp(previous.condition + gain(0.5));
                    return { ...current, solar: { ...previous, dust: clamp(previous.dust - dustReduction), condition, status: buildingStatus(condition) } };
                });
                setMetrics((current) => ({ ...current, power: clamp(current.power + gain(1)) }));
                setAiMessage(`MANUAL ARRAY BRUSH · Removed ${dustReduction.toFixed(1)} dust points and recovered a small amount of generation. A rover/maintenance cleaning pass is more effective.`);
                break;
            }
            case "fallback-battery":
                setEmergencyPowerMode(true);
                setMetrics((current) => ({ ...current, power: clamp(current.power + gain(1)) }));
                setAiMessage("LOCAL BATTERY-MANAGEMENT RESET · Parasitic loads are shed and emergency power mode is enabled. This protects stored charge; it does not create battery energy.");
                break;
            case "fallback-grid":
                setEmergencyPowerMode(true);
                setMetrics((current) => ({ ...current, power: clamp(current.power + gain(1)) }));
                setAiMessage("MANUAL LOAD SHED · Non-critical loads have been isolated at local breakers. The power margin rises slightly, but this does not generate electricity.");
                break;
            case "fallback-habitat":
                conditionBoost(3);
                setMetrics((current) => ({ ...current, habitat: clamp(current.habitat + gain(1.5)) }));
                setAiMessage("EMERGENCY SEAL PATCH · A small manual patch restored limited pressure margin. A maintenance/thermal-cured composite repair is stronger.");
                break;
            case "fallback-water":
                setMetrics((current) => ({ ...current, water: clamp(current.water + gain(1)) }));
                setAiMessage("GRAVITY-FED CONDENSATE RECOVERY · A small amount of water recovered without running the powered purification loop.");
                break;
            case "fallback-oxygen":
                setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + gain(1)) }));
                setAiMessage("CONTINGENCY OXYGEN RELEASE · A small quantity from the local emergency buffer has been added. It is finite; restore normal oxygen processing.");
                break;
            case "fallback-co2":
                conditionBoost(1);
                setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + gain(0.8)) }));
                setAiMessage("PASSIVE SORBENT CARTRIDGE SWAP · Basic CO₂ removal restored without the full powered recovery chain.");
                break;
            case "fallback-thermal":
                setMetrics((current) => ({ ...current, temperature: clamp(current.temperature + (21 - current.temperature) * 0.12, 16, 28) }));
                conditionBoost(0.5);
                setAiMessage("PASSIVE THERMAL SHUTTERS · Insulation reduces temperature drift without drawing heater power; it cannot actively control temperature.");
                break;
            case "fallback-radiation":
                setEmergencyPowerMode(true);
                conditionBoost(0.25);
                setAiMessage("SHELTER LOCKDOWN · Crew moved behind passive habitat shielding. This reduces future exposure rate; the already accumulated dose index is not erased.");
                break;
            case "fallback-comms":
                conditionBoost(1);
                setAiMessage("LOCAL LOW-RATE BEACON RESET · Short-range communications restored. High-rate Earth reports still need a working relay path.");
                break;
            case "fallback-navigation":
                conditionBoost(1);
                setScore((value) => clamp(value + gain(1)));
                setAiMessage("INERTIAL SENSOR RE-ZERO · Dead-reckoning baseline refreshed. Position uncertainty will still grow without external fixes.");
                break;
            case "fallback-rover":
                conditionBoost(2);
                setAiMessage("LOCAL WHEEL-ENCODER CHECK · Drive controller cleared and wheel telemetry checked. Remote path planning still needs navigation and comms.");
                break;
            case "fallback-extraction":
                conditionBoost(1);
                setMetrics((current) => ({ ...current, power: clamp(current.power - cost(0.5)) }));
                setAiMessage("DRILL TORQUE LATCH RELEASED · The actuator is unloaded safely. No resource was extracted.");
                break;
            case "fallback-isru":
                conditionBoost(1);
                setAiMessage("PROCESS LINE ISOLATED · Local valves closed and the pressure path stabilised. No feedstock was processed.");
                break;
            case "fallback-science":
                conditionBoost(1);
                setScore((value) => clamp(value + gain(1)));
                setAiMessage("BENCH REFERENCE CHECK · A local instrument reference was restored. No specimen was analysed or consumed.");
                break;
            case "fallback-agriculture":
                setMetrics((current) => ({ ...current, food: clamp(current.food + gain(1)) }));
                setAiMessage("EMERGENCY BIOMASS RECOVERY · A small reserve of already-mature edible biomass was collected. This does not replace active crop production.");
                break;
            case "fallback-maintenance": {
                const candidates = Object.entries(buildings)
                    .filter(([id]) => pending.selected[id] && !Object.values(activeFaults).some((fault) => fault.targetTrackId === id))
                    .sort(([, a], [, b]) => a.condition - b.condition);
                const target = candidates[0]?.[0];
                if (target)
                    setBuildings((current) => {
                        const previous = current[target];
                        const condition = clamp(previous.condition + gain(2));
                        return { ...current, [target]: { ...previous, condition, status: buildingStatus(condition) } };
                    });
                setAiMessage(target ? `MANUAL WALK-AROUND · Minor field service improved ${target.toUpperCase()} without needing the powered maintenance bay.` : "MANUAL WALK-AROUND · No healthy deployed module is available for minor service.");
                break;
            }
            case "solar-autonomous-clean": {
                const dustReduction = gain(32);
                setBuildings((current) => {
                    const previous = current.solar ?? { condition: 100, dust: 0, status: "ONLINE" };
                    const condition = clamp(previous.condition + gain(2));
                    return { ...current, solar: { ...previous, dust: clamp(previous.dust - dustReduction), condition, status: buildingStatus(condition) } };
                });
                setMetrics((current) => ({ ...current, power: clamp(current.power + gain(5)) }));
                if (pending.selected.rover)
                    setRoverTask("RETURNING");
                setAiMessage(`AUTONOMOUS ARRAY SERVICE · ${dustReduction.toFixed(1)} dust points removed, array condition checked, and generation margin restored.`);
                break;
            }
            case "battery-thermal-recondition":
                setMetrics((current) => ({ ...current, battery: clamp(current.battery + gain(10)), power: clamp(current.power + gain(2)) }));
                conditionBoost(3);
                setAiMessage("THERMAL BMS RECONDITIONING · Cells were brought back into their preferred operating band and actively balanced. This improves usable reserve, not the battery's stored energy limit.");
                break;
            case "oxygen-electrolyser-burst":
                setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + gain(5)), water: clamp(current.water - cost(3)), power: clamp(current.power - cost(4)) }));
                conditionBoost(1);
                setAiMessage("RECLAIMED-WATER ELECTROLYSIS · Oxygen production increased using water and electrical input; this is a conversion process, not free oxygen.");
                break;
            case "water-distillate-recovery":
                setMetrics((current) => ({ ...current, water: clamp(current.water + gain(6)), power: clamp(current.power - cost(3)) }));
                conditionBoost(1);
                setAiMessage("WASTE-HEAT DISTILLATION · More condensate was recovered by using available thermal energy, with a smaller net electric cost than an all-electric cycle.");
                break;
            case "co2-crop-loop": {
                const co2LoopFraction = repairCapabilityFraction("co2", pending?.selected ?? {}, buildingsRef.current);
                setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + gain(3)), food: clamp(current.food + gain(2) * co2LoopFraction), power: clamp(current.power - cost(3)) }));
                setAiMessage("GREENHOUSE CARBON EXCHANGE · Captured CO₂ was routed into the controlled crop loop. Crop benefit is limited by available scrubber throughput; metabolism and lighting remain dependent on water, oxygen and power.");
                break;
            }
            case "thermal-waste-heat-recovery":
                setMetrics((current) => ({ ...current, temperature: clamp(current.temperature + (21 - current.temperature) * 0.45, 16, 28), battery: clamp(current.battery + gain(1)), power: clamp(current.power - cost(1)) }));
                conditionBoost(1);
                setAiMessage("WASTE-HEAT RECOVERY · Recoverable thermal energy was redirected to the habitat, reducing temperature drift with a small control load.");
                break;
            case "comms-priority-window":
                conditionBoost(2);
                setScore((value) => clamp(value + gain(3)));
                setAiMessage("PRIORITY UPLINK WINDOW RESERVED · Navigation timing and grid scheduling improve link availability for a high-rate Earth report; they do not change radio propagation speed.");
                break;
            case "habitat-composite-patch":
                conditionBoost(20);
                setMetrics((current) => ({ ...current, habitat: clamp(current.habitat + gain(8)) }));
                setResourceYield((value) => Math.max(0, value - 1));
                setMetrics((current) => ({ ...current, battery: clamp(current.battery - cost(3)) }));
                setAiMessage("THERMALLY CURED COMPOSITE PATCH · Processed local material was used for a higher-strength structural repair. One unit of prepared feedstock was consumed.");
                break;
            case "radiation-regolith-berm":
                setMetrics((current) => ({ ...current, radiation: clamp(current.radiation - gain(5)), power: clamp(current.power - cost(2)) }));
                setResourceYield((value) => Math.max(0, value - 1));
                conditionBoost(1);
                setAiMessage("REGOLITH SHIELDING BERM · Local shielding mass was placed around the habitat. This reduces exposure, but it is not a substitute for a dedicated storm shelter.");
                break;
            case "grid-black-start":
                setMetrics((current) => ({ ...current, power: clamp(current.power + gain(8)), battery: clamp(current.battery - cost(5)) }));
                conditionBoost(2);
                setAiMessage("POWER-BUS BLACK START · A controlled restart restored part of the bus using battery energy and available solar input; battery reserves were consumed in the process.");
                break;
            case "science-fusion":
                setResourceYield((value) => value + gain(4));
                setScore((value) => clamp(value + gain(10)));
                setMetrics((current) => ({ ...current, power: clamp(current.power - cost(2)) }));
                setAiMessage("MULTI-MODAL SCIENCE FUSION · The analysed specimen and verified process telemetry were combined into a higher-value research result.");
                break;
            case "request-earth-report": {
                const openFaults = Object.values(activeFaults);
                const telemetry = physicalResourceTelemetry(metrics, pending?.selected ?? {}, buildings);
                const weakest = [
                    { label: "AVAILABLE POWER", value: metrics.power, display: telemetry.power },
                    { label: "STORED ENERGY", value: metrics.battery, display: telemetry.battery },
                    { label: "OXYGEN RESERVE", value: metrics.oxygen, display: telemetry.oxygen },
                    { label: "WATER RESERVE", value: metrics.water, display: telemetry.water },
                    { label: "FOOD RESERVE", value: metrics.food, display: telemetry.food },
                ].sort((a, b) => a.value - b.value)[0];
                const analysedCount = Object.values(sampleStages).filter((stage) => stage === "ANALYSED").length;
                const report = [
                    "EARTH MISSION CONTROL // OUTPOST OPERATIONS REPORT",
                    `MISSION: ${pending.missionTitle} · ${pending.campaign.toUpperCase()} · ${formatMissionTime(elapsed)}`,
                    `PHYSICAL TELEMETRY: available power ${telemetry.power} | stored energy ${telemetry.battery} | oxygen ${telemetry.oxygen} | water ${telemetry.water} | edible food ${telemetry.food} | cabin temperature ${telemetry.temperature} | ${telemetry.habitat} | ${telemetry.radiation}`,
                    `FIELD SCIENCE: ${surveyedNodes.length} site(s) mapped · ${analysedCount} specimen(s) analysed · ${resourceYield.toFixed(1)} resource / feedstock units logged`,
                    `FAULT REGISTER: ${openFaults.length ? openFaults.map((fault) => `${fault.targetTrackId.toUpperCase()} — ${fault.title}`).join("; ") : "no unresolved faults at report generation"}`,
                    `RECOMMENDED PRIORITY: ${openFaults.length ? "Repair " + openFaults[0].targetTrackId.toUpperCase() + " and verify the affected system before high-load work." : "Prioritise " + weakest.label + " at " + weakest.display + " and avoid non-essential power draw."}`,
                    "OPERATIONS NOTE: This is a compressed mission-control processing queue. Real signal propagation is determined by Earth–surface distance; the high-tier local cache can display a previously computed recommendation instantly.",
                ].join("\n");
                setEarthReport(report);
                setEarthReportAtSeconds(elapsed);
                setScore((value) => clamp(value + gain(1)));
                setAiMessage("EARTH REPORT RECEIVED · Live resource telemetry and an actionable operations recommendation have been added to the Navigation system.");
                break;
            }
            case "extraction-waterjet":
                setResourceYield((value) => value + gain(8));
                setMetrics((current) => ({ ...current, water: clamp(current.water - cost(4)), power: clamp(current.power - cost(5)), battery: clamp(current.battery - cost(3)) }));
                conditionBoost(-1);
                setAiMessage("WATER-ASSISTED CORE DRILLING · Drilling yielded more feedstock but consumed water and substantial electrical energy.");
                break;
            case "isru-oxygen-feed":
                setResourceYield((value) => value + gain(4));
                setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + gain(3)), power: clamp(current.power - cost(3)) }));
                conditionBoost(1);
                setAiMessage("OXYGEN-BEARING FEED PROCESSING · Verified regolith feed was processed into useful oxygen-bearing products; the output depends on composition and processing efficiency.");
                break;
            case "agriculture-closed-loop":
                setMetrics((current) => ({ ...current, food: clamp(current.food + gain(10)), water: clamp(current.water - cost(3)), power: clamp(current.power - cost(4)) }));
                conditionBoost(1);
                setAiMessage("CLOSED-LOOP CROP CYCLE · Water, CO₂, oxygen, thermal control and habitat services supported a larger harvest at a meaningful energy cost.");
                break;
            case "maintenance-overhaul": {
                const targets = Object.entries(buildings)
                    .filter(([id]) => pending.selected[id] && id !== "maintenance" && !Object.values(activeFaults).some((fault) => fault.targetTrackId === id))
                    .sort(([, a], [, b]) => a.condition - b.condition)
                    .slice(0, 3);
                setBuildings((current) => {
                    const next = { ...current };
                    for (const [id] of targets) {
                        const previous = next[id];
                        if (!previous)
                            continue;
                        const condition = clamp(previous.condition + gain(6));
                        next[id] = { ...previous, condition, status: buildingStatus(condition) };
                    }
                    return next;
                });
                setMetrics((current) => ({ ...current, power: clamp(current.power - cost(3)), battery: clamp(current.battery - cost(2)) }));
                setAiMessage(`TELEMETRY-GUIDED OVERHAUL · ${targets.length} healthy module(s) received preventative maintenance. Live faults still require their own isolation and verification.`);
                break;
            }
            case "clean": {
                const recovery = pending.selected.rover ? 24 : 16;
                setBuildings((current) => ({
                    ...current,
                    solar: {
                        ...(current.solar ?? { condition: 100, dust: 0, status: "ONLINE" }),
                        dust: clamp((current.solar?.dust ?? 0) - recovery),
                        condition: clamp((current.solar?.condition ?? 100) + gain(1)),
                        status: buildingStatus(clamp((current.solar?.condition ?? 100) + gain(1))),
                    },
                }));
                setMetrics((current) => ({ ...current, power: clamp(current.power + gain(4)) }));
                setAiMessage(pending.selected.rover ? "SOLAR CLEANING COMPLETE · Dust load fell and power generation recovered. The rover is returning to the launch lane." : "SOLAR CLEANING COMPLETE · Dust load fell and power generation recovered.");
                if (pending.selected.rover)
                    setRoverTask("RETURNING");
                break;
            }
            case "tune": {
                setBuildings((current) => ({ ...current, solar: { ...(current.solar ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: clamp((current.solar?.condition ?? 100) + gain(1)) } }));
                setMetrics((current) => ({ ...current, power: clamp(current.power + gain(3)) }));
                setAiMessage("Solar tracking solution tuned for the current illumination angle.");
                break;
            }
            case "balance":
                setMetrics((current) => ({ ...current, battery: clamp(current.battery + gain(5)), power: clamp(current.power + gain(2)) }));
                setAiMessage("Battery cells balanced against the colony load. Reserve margin improved.");
                break;
            case "reserve":
                setMetrics((current) => ({ ...current, battery: clamp(current.battery + gain(8)), power: clamp(current.power - cost(2)) }));
                setAiMessage("Emergency reserve mode engaged. Stored energy is protected at the expense of available load.");
                break;
            case "reset":
                setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + gain(3)), power: clamp(current.power - cost(2)) }));
                setAiMessage("Atmospheric processing loop reset completed.");
                break;
            case "boost":
                setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + gain(6)), power: clamp(current.power - cost(4)) }));
                conditionBoost(-1);
                setAiMessage("Oxygen output temporarily increased. The extra processing load is drawing power.");
                break;
            case "flush":
                setMetrics((current) => ({ ...current, water: clamp(current.water + gain(4)), power: clamp(current.power - cost(2)) }));
                setAiMessage("Water recovery loop flushed. Differential pressure has fallen.");
                break;
            case "purify":
                setMetrics((current) => ({ ...current, water: clamp(current.water + gain(6)), power: clamp(current.power - cost(4)) }));
                setAiMessage("Deep purification cycle completed. Water reserve improved at a higher energy cost.");
                break;
            case "scrub":
                setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + gain(2)), power: clamp(current.power - cost(1)) }));
                setAiMessage("CO₂ scrubber cycle increased. Cabin atmospheric margin improved.");
                break;
            case "recover":
                setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + gain(1)), power: clamp(current.power - cost(1)) }));
                conditionBoost(1);
                setAiMessage("Carbon-recovery stage completed and the scrubber was left in a stable state.");
                break;
            case "dump": {
                setMetrics((current) => ({
                    ...current,
                    temperature: clamp(current.temperature + (21 - current.temperature) * 0.36, 16, 28),
                    power: clamp(current.power - cost(2)),
                }));
                setAiMessage("Thermal loop was opened to dump stored heat and pull the habitat back toward its target temperature.");
                break;
            }
            case "insulate":
                setMetrics((current) => ({ ...current, temperature: clamp(current.temperature + (21 - current.temperature) * 0.22, 16, 28), power: clamp(current.power - cost(1)) }));
                conditionBoost(1);
                setAiMessage("Thermal protection mode engaged. Temperature drift has been reduced.");
                break;
            case "repoint":
                conditionBoost(1);
                setScore((value) => clamp(value + gain(3)));
                setAiMessage("High-gain antenna repointed. Communications geometry is back inside the preferred link budget.");
                break;
            case "test":
                conditionBoost(1);
                setScore((value) => clamp(value + gain(2)));
                setAiMessage("LINK TEST PASSED · Communications tracking is stable and the antenna condition check is logged.");
                break;
            case "repair": {
                const amount = pending.selected.maintenance ? 28 : 14;
                const next = clamp((buildings.habitat?.condition ?? 100) + amount);
                setBuildings((current) => ({ ...current, habitat: { ...(current.habitat ?? { condition: 100, dust: 0, status: "ONLINE" }), condition: next, status: buildingStatus(next) } }));
                setMetrics((current) => ({ ...current, habitat: clamp(current.habitat + gain(5)), battery: clamp(current.battery - cost(2)) }));
                setAiMessage(pending.selected.maintenance ? "Maintenance support completed a stronger habitat seal repair." : "Basic habitat seal repair completed. Structural margin restored.");
                break;
            }
            case "seal":
                setMetrics((current) => ({ ...current, habitat: clamp(current.habitat + gain(3)), battery: clamp(current.battery - cost(1)) }));
                conditionBoost(3);
                setAiMessage("Pressure-isolation cycle completed. Habitat leak margin improved.");
                break;
            case "shield":
                setMetrics((current) => ({ ...current, radiation: clamp(current.radiation - gain(2)), battery: clamp(current.battery - cost(1)) }));
                conditionBoost(1);
                setAiMessage("Shielding inspection completed. The protected volume is better prepared for elevated radiation.");
                break;
            case "shelter":
                setMetrics((current) => ({ ...current, radiation: clamp(current.radiation - gain(3)), battery: clamp(current.battery - cost(2)), power: clamp(current.power - cost(1)) }));
                setAiMessage("Shelter protocol enabled. Crew exposure risk is reduced while the protective mode is active.");
                break;
            case "balance-grid":
                setMetrics((current) => ({ ...current, power: clamp(current.power + gain(3)), battery: clamp(current.battery + gain(2)) }));
                conditionBoost(1);
                setAiMessage("Power distribution bus balanced across active loads.");
                break;
            case "prioritize":
                setMetrics((current) => ({ ...current, oxygen: clamp(current.oxygen + gain(1)), water: clamp(current.water + gain(1)), battery: clamp(current.battery + gain(3)), power: clamp(current.power - cost(1)) }));
                setAiMessage("Critical-load priority enabled. Life support and habitat systems now receive first access to reserve power.");
                break;
            case "calibrate":
                setScore((value) => clamp(value + gain(4)));
                conditionBoost(1);
                setAiMessage("Science instruments calibrated against the current environmental baseline.");
                break;
            case "experiment":
                setResourceYield((value) => value + gain(1));
                setScore((value) => clamp(value + gain(7)));
                setMetrics((current) => ({ ...current, power: clamp(current.power - cost(2)) }));
                setAiMessage("Experiment completed. A field observation has been converted into a research result.");
                break;
            case "nav-calibrate":
                setScore((value) => clamp(value + gain(3)));
                conditionBoost(1);
                setAiMessage("Navigation solution recalibrated. Vehicle route confidence improved.");
                break;
            case "route":
                conditionBoost(1);
                setScore((value) => clamp(value + gain(2)));
                setAiMessage("ROUTE PLAN COMPLETE · The navigation solution was refreshed and the safest available work corridor is recorded.");
                break;
            case "survey": {
                const nodes = RESOURCE_NODES[pending.campaign === "mars" ? "MARS" : "MOON"];
                const nextNode = nodes.find((node) => !surveyedNodes.includes(node.id)) ?? nodes[0];
                if (nextNode) {
                    setSurveyedNodes((current) => current.includes(nextNode.id) ? current : [...current, nextNode.id]);
                    setSampleStages((current) => ({ ...current, [nextNode.id]: "SURVEYED" }));
                    setRoverTask(`AT SITE ${nextNode.label}`);
                    setScore((value) => clamp(value + gain(2)));
                    setAiMessage(`SURVEY COMPLETE · ${nextNode.label} mapped and marked. The rover is at the site; select its marker to collect a sealed sample.`);
                }
                break;
            }
            case "return":
                setRoverTask("STANDBY");
                setAiMessage("ROVER RECALLED · It has returned to the launch lane and is ready for its next assignment.");
                break;
            case "inspect":
                setScore((value) => clamp(value + gain(1)));
                setAiMessage(`Inspection complete — ${trackId.toUpperCase()} is operating at ${Math.round(buildings[trackId]?.condition ?? 100)}% condition.`);
                break;
            case "extract-test":
                setResourceYield((value) => value + gain(4) * repairCapabilityFraction("extraction", pending?.selected ?? {}, buildingsRef.current));
                setMetrics((current) => ({ ...current, power: clamp(current.power - cost(4)), battery: clamp(current.battery - cost(1)) }));
                conditionBoost(-1);
                setScore((value) => clamp(value + gain(5)));
                setAiMessage("Short drill test complete. A usable resource signature was confirmed at the surveyed deposit.");
                break;
            case "extract":
                setResourceYield((value) => value + gain(5) * repairCapabilityFraction("extraction", pending?.selected ?? {}, buildingsRef.current));
                setMetrics((current) => ({ ...current, power: clamp(current.power - cost(5)), battery: clamp(current.battery - cost(2)) }));
                setScore((value) => clamp(value + gain(7)));
                setAiMessage("Extraction sample collected. Resource yield increased, but the operation consumed colony power.");
                break;
            case "process": {
                const processedMaterialKg = gain(3) * repairCapabilityFraction("isru", pending?.selected ?? {}, buildingsRef.current);
                setResourceYield((value) => value + processedMaterialKg);
                // Processed ISRU feed is the local source of retrofit / repair material stock.
                setPartsInventoryKg((value) => value + processedMaterialKg);
                setMetrics((current) => ({ ...current, power: clamp(current.power - cost(5)), battery: clamp(current.battery - cost(1)) }));
                setScore((value) => clamp(value + gain(5)));
                setAiMessage(`ISRU feed processed. Produced ${processedMaterialKg.toFixed(1)} kg of local material; available retrofit / repair stock is now ${(partsInventoryKg + processedMaterialKg).toFixed(1)} kg. Processing consumes power and battery energy.`);
                break;
            }
            case "purge":
                conditionBoost(2);
                setMetrics((current) => ({ ...current, power: clamp(current.power - cost(1)) }));
                setAiMessage("ISRU feed line purged. Pressure margin and process stability improved.");
                break;
            case "tune-crops":
                setMetrics((current) => ({ ...current, food: clamp(current.food + gain(5)), water: clamp(current.water - cost(2)), power: clamp(current.power - cost(2)) }));
                conditionBoost(1);
                setAiMessage("Controlled crop environment tuned. Food production increased with a modest water and power cost.");
                break;
            case "harvest":
                setMetrics((current) => ({ ...current, food: clamp(current.food + gain(7)), water: clamp(current.water - cost(2)) }));
                setResourceYield((value) => value + gain(1));
                setScore((value) => clamp(value + gain(3)));
                setAiMessage("Harvest cycle complete. Fresh food output has been added to the colony reserve.");
                break;
            case "service":
                {
                    const candidates = Object.entries(buildings).sort(([, a], [, b]) => a.condition - b.condition);
                    const target = candidates[0]?.[0];
                    if (target) {
                        const next = clamp(buildings[target].condition + gain(10));
                        setBuildings((current) => ({ ...current, [target]: { ...current[target], condition: next, status: buildingStatus(next) } }));
                        setAiMessage(`Maintenance service complete. ${target.toUpperCase()} received preventative service.`);
                    }
                }
                break;
            case "diagnostics": {
                setScore((value) => clamp(value + gain(3)));
                const faults = Object.values(activeFaults);
                const weakest = Object.entries(buildings).sort(([, a], [, b]) => a.condition - b.condition)[0];
                setAiMessage(faults.length
                    ? `DIAGNOSTICS COMPLETE · ${faults.length} unresolved fault(s): ${faults.map((fault) => `${fault.targetTrackId.toUpperCase()} / ${fault.title}`).join("; ")}. Open an affected system and use Isolate · repair · verify.`
                    : weakest
                        ? `DIAGNOSTICS COMPLETE · No unresolved incidents. The weakest equipment is ${weakest[0].toUpperCase()} at ${Math.round(weakest[1].condition)}% condition; schedule preventative service before another emergency.`
                        : "DIAGNOSTICS COMPLETE · No unresolved incidents detected.");
                break;
            }
            default:
                setAiMessage(`Inspection complete — ${trackId.toUpperCase()} is operating at ${Math.round(buildings[trackId]?.condition ?? 100)}% condition.`);
                break;
        }
    };
    applyBuildingActionRef.current = applyBuildingAction;
    const getRepairBlockers = (systemId, actionId) => {
        const blockers = checkActionPrerequisites(systemId, actionId);
        if (!actionId.startsWith("repair:"))
            return blockers;
        const option = getRepairOption(systemId, actionId.slice("repair:".length));
        if (!option)
            return [...blockers, "This repair procedure is missing from the balance catalogue."];
        const availableEnergyKWh = pending
            ? (metrics.battery / 100) * ratedBatteryCapacityKWh(pending.selected, buildings)
            : 0;
        if (availableEnergyKWh + 1e-6 < option.energyKWh) {
            blockers.push(`Insufficient stored energy: needs ${option.energyKWh} kWh; available ${availableEnergyKWh.toFixed(2)} kWh.`);
        }
        if (missionStage !== 1 && partsInventoryKg + 1e-6 < option.partsMassKg) {
            blockers.push(`Insufficient parts: needs ${option.partsMassKg} kg; stock is ${partsInventoryKg.toFixed(2)} kg.`);
        }
        const runningOperation = activeOperationsRef.current[systemId];
        if (runningOperation)
            blockers.push(`Target system already has an active work order: ${runningOperation.label}.`);
        const supportWork = Object.values(activeOperationsRef.current).find((job) => job.supportSystems?.includes(systemId));
        if (supportWork)
            blockers.push(`${SYSTEM_LABELS[systemId] ?? systemId} is supporting the active repair “${supportWork.label}”.`);
        return [...new Set(blockers)];
    };
    const askMissionAi = () => {
        const telemetry = physicalResourceTelemetry(metrics, pending?.selected ?? {}, buildings);
        const weakest = [
            { label: "stored energy", value: metrics.battery, display: telemetry.battery },
            { label: "oxygen reserve", value: metrics.oxygen, display: telemetry.oxygen },
            { label: "water reserve", value: metrics.water, display: telemetry.water },
            { label: "edible food", value: metrics.food, display: telemetry.food },
            { label: "habitat integrity", value: metrics.habitat, display: telemetry.habitat },
        ].sort((a, b) => a.value - b.value)[0];
        if (weakest.value < 45) {
            setAiMessage(`Mission AI diagnosis: your current weakest area is ${weakest.label} at ${weakest.display}. Prioritise that system before taking another optional risk.`);
        }
        else if (metrics.power < 55) {
            setAiMessage(`Mission AI diagnosis: available power is ${telemetry.power}, currently limiting operations. Reduce non-critical loads and protect stored energy (${telemetry.battery}).`);
        }
        else if (Math.abs(metrics.temperature - 21) > 2.5) {
            setAiMessage("Mission AI diagnosis: thermal conditions are drifting. Restoring the preferred temperature band will reduce long-term system stress.");
        }
        else {
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
        return (<div className="min-h-screen bg-[#050b10] p-8 text-[#e9f0e5]">
        <div className="mx-auto max-w-2xl border border-[#70483e] bg-[#1b1315] p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#d77a5a]">Mission runtime unavailable</p>
          <h1 className="mt-3 text-2xl font-semibold uppercase tracking-[0.12em]">No active mission deployment</h1>
          <p className="mt-3 text-sm leading-6 text-[#9aaba5]">Return to the campaign map and deploy a mission from the loadout screen.</p>
          <a href="/preview/CampaignMapRefresh" className="mt-6 inline-flex bg-[#efb658] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#171e1b]">Return to campaign map</a>
        </div>
      </div>);
    }
    if (results) {
        const reportFailureReason = missionFailureReason ?? getMissionFailureReason(metrics);
        const reportFailed = missionFailed || Boolean(reportFailureReason);
        const analysedSampleIds = Object.entries(sampleStages).filter(([, stage]) => stage === "ANALYSED").map(([id]) => id);
        const researchBonusXp = pending && !pending.replay ? analysedSampleIds.reduce((sum, id) => sum + 80 + Math.round((sampleQuality[id] ?? 60) * 0.8) + tierLevel(pending.selected.science ?? "Foundation") * 20, 0) : 0;
        const unresolvedFaultPenalty = Math.min(0.45, Object.keys(activeFaults).length * 0.1);
        const reportCredits = reportFailed ? Math.round(pending.rewardCredits * 0.15 * 10) / 10 : Math.round(pending.rewardCredits * (1 - unresolvedFaultPenalty) * 10) / 10;
        const reportXp = reportFailed ? 0 : Math.round((pending.rewardXp + researchBonusXp) * (1 - unresolvedFaultPenalty));
        const checks = [
            ["SURVIVAL", !reportFailed],
            ["POWER STABILITY", performance.colonyHealth >= 55],
            ["LIFE SUPPORT", Math.min(metrics.oxygen, metrics.water) >= 55],
            ["CREW SAFETY", performance.radiationScore >= 55],
            ["FAULT REGISTER CLEAR", Object.keys(activeFaults).length === 0],
            ["HABITAT INTEGRITY", metrics.habitat >= 75],
            ["RESOURCE MANAGEMENT", Math.min(metrics.food, metrics.water) >= 55],
            ["RESEARCH OPPORTUNITY", performance.researchOpportunity],
        ];
        return (<div className="min-h-screen bg-[#050b10] px-5 py-8 text-[#e9f0e5]">
        <div className="mx-auto max-w-6xl border border-[#3c5e59] bg-[#08151b] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="border-b border-[#304b4b] bg-[#0d252a] px-6 py-5">
            <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${reportFailed ? "text-[#ff858b]" : "text-[#8fc9a0]"}`}>{reportFailed ? "Mission failed · safety limit exceeded" : "Mission complete"}</p>
            <h1 className="mt-2 text-3xl font-semibold uppercase tracking-[0.13em] text-[#f1f4e8]">{pending.missionTitle}</h1>
            <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[#708b88]">{reportFailed ? (reportFailureReason ?? "Critical colony metric fell below its safe operating limit.") : "14 simulated days survived"} · {pending.replay ? "Replay operation" : "First deployment"}</p>
          </div>
          <div className="grid gap-5 p-6 lg:grid-cols-[1fr_360px]">
            <section className="space-y-3">
              {checks.map(([label, complete]) => (<div key={label} className="flex items-center justify-between border border-[#29434a] bg-[#0d2027] px-4 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c7d5cc]">{label}</span>
                  {complete ? (<span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8fc9a0]"><Check className="h-4 w-4"/> Complete</span>) : (<span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d77a5a]">Degraded</span>)}
                </div>))}
              <div className="grid gap-3 pt-3 sm:grid-cols-3">
                <div className="border border-[#344e4d] bg-[#102329] p-4"><p className="text-[8px] uppercase tracking-[0.2em] text-[#748e8b]">Colony health</p><p className="mt-1 text-2xl font-mono text-[#dfe9d9]">{performance.colonyHealth}%</p></div>
                <div className="border border-[#344e4d] bg-[#102329] p-4"><p className="text-[8px] uppercase tracking-[0.2em] text-[#748e8b]">Decision quality</p><p className="mt-1 text-2xl font-mono text-[#efb658]">{Math.round(performance.decisionQuality)}%</p></div>
                <div className="border border-[#344e4d] bg-[#102329] p-4"><p className="text-[8px] uppercase tracking-[0.2em] text-[#748e8b]">Runtime score</p><p className="mt-1 text-2xl font-mono text-[#9fce82]">{Math.round(score)}</p></div>
              </div>
            </section>
            <aside className="space-y-4">
              <div className="border border-[#46595a] bg-[#101f25] p-5">
                <div className="flex items-center gap-2 text-[#efb658]"><Sparkles className="h-4 w-4"/><p className="text-[9px] font-bold uppercase tracking-[0.22em]">Mission AI analysis</p></div>
                <p className="mt-3 text-sm leading-6 text-[#c8d7cf]">{getAiAnalysis(metrics, score)}</p>
                <p className="mt-3 text-[9px] uppercase tracking-[0.13em] text-[#788f8c]">Generated from your resource levels, equipment condition, and decisions.</p>
              </div>
              <div className="border border-[#6b5734] bg-[#1b1d18] p-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#efb658]">Rewards</p>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-[#9baaa3]">{reportFailed ? "Recovery salvage" : "Credits"}</span><span className="font-mono text-[#efb658]">+{reportCredits.toFixed(reportCredits % 1 === 0 ? 0 : 1)}M</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#9baaa3]">XP</span><span className="font-mono text-[#b4d0b6]">+{reportXp.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#9baaa3]">Research Tokens</span><span className="font-mono text-[#d4dfb7]">+{reportFailed ? "0" : pending.rewardResearchTokens}</span></div>
                  {!reportFailed && unresolvedFaultPenalty > 0 && <p className="mt-3 text-[9px] leading-4 text-[#e5bc76]">{Object.keys(activeFaults).length} unresolved fault(s) reduced the payout by {Math.round(unresolvedFaultPenalty * 100)}%. Repair and verify every affected system next time to preserve mission rewards.</p>}
                </div>
              </div>
              <a href={`/preview/CampaignMapRefresh?campaign=${pending.campaign}`} className={`flex w-full items-center justify-center gap-2 px-5 py-4 text-[10px] font-bold uppercase tracking-[0.22em] ${reportFailed ? "border border-[#70404a] bg-[#301b22] text-[#ffb3b9]" : "bg-[#efb658] text-[#17201b]"}`}>
                {reportFailed ? <AlertTriangle className="h-4 w-4"/> : <Check className="h-4 w-4"/>} {reportFailed ? "Review Campaign & Redeploy" : "Continue"}
              </a>
            </aside>
          </div>
        </div>
      </div>);
    }
    return (<div className="fixed inset-0 h-[100dvh] w-full overflow-hidden bg-[#05040a] text-white">
      <main className="relative h-full w-full overflow-hidden">
        <IsometricMap tracks={selectedTracks} selected={pending.selected} buildings={buildings} onSelect={(trackId) => {
            setSelectedResourceId(null);
            setSelectedBuildingId(trackId);
        }} selectedBuildingId={selectedBuildingId} elapsed={elapsed} environmentLabel={environmentLabel} environmentTitle={environmentTitle} activeEventTrackId={activeTargetTrackId} selectedResourceId={selectedResourceId} surveyedNodes={surveyedNodes} onSelectResource={(node) => {
            setSelectedResourceId(node.id);
            setSelectedBuildingId(null);
        }} roverTask={roverTask} roverTargetNodeId={roverTargetNodeId} speed={manualPaused || activeEvent ? 0 : speed}/>

        {!activeEvent && !dashboardOpen && (<div className="pointer-events-none absolute right-3 top-[58px] z-20 w-[min(92vw,500px)]">
            <div className="pointer-events-auto overflow-hidden rounded-xl border border-[#41696a] bg-[#08171b]/[0.94] px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.38)] backdrop-blur-xl">
              <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
                <span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.16em] text-[#b6e6d0]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4ce0a1]"/>Colony pulse</span>
                <span className="font-mono text-[8px] font-bold text-[#f0cf69]">STABILITY {Math.round(performance.colonyHealth)}/100</span>
              </div>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                {[
                { id: "generation", label: "Solar generation", value: metrics.power, display: `${electricalReadings.generationKW.toFixed(2)} kW`, icon: <Sun className="h-3 w-3"/> },
                { id: "demand", label: "Power demand", value: clamp(electricalReadings.consumptionKW / 16 * 100), display: `${electricalReadings.consumptionKW.toFixed(2)} kW`, icon: <Zap className="h-3 w-3"/> },
                { id: "battery", label: "Battery reserve", value: metrics.battery, display: physicalTelemetry.battery, icon: <BatteryCharging className="h-3 w-3"/> },
                { id: "batteryFlow", label: "Charging / discharging", value: electricalReadings.batteryFlowKW < 0 ? 80 : electricalReadings.batteryFlowKW > 0 ? 35 : metrics.battery <= LEVEL1_ENVIRONMENT.batteryMinimumSOCPercent + 0.5 ? 5 : 50, display: Math.abs(electricalReadings.batteryFlowKW) < 0.01 ? (metrics.battery <= LEVEL1_ENVIRONMENT.batteryMinimumSOCPercent + 0.5 ? "Reserve reached" : "Idle") : electricalReadings.batteryFlowKW < 0 ? `${(-electricalReadings.batteryFlowKW).toFixed(2)} kW charging` : `${electricalReadings.batteryFlowKW.toFixed(2)} kW discharging`, icon: <BatteryCharging className="h-3 w-3"/> },
            ].map((metric) => (<button key={metric.id} type="button" aria-expanded={pulseExpandedMetric === metric.id} onClick={() => setPulseExpandedMetric((current) => current === metric.id ? null : metric.id)} className={`min-w-0 rounded-lg border px-1.5 py-1 text-left transition-colors hover:border-[#d7bd6b] ${metric.value < 28 ? "border-[#d75d69] bg-[#321a21]" : metric.value < 55 ? "border-[#806b3d] bg-[#29251a]" : "border-[#274e46] bg-[#102822]"}`}>
                    <div className="flex items-center gap-1 text-[#99c3b3]">{metric.icon}<span className="text-[7px] font-black tracking-[0.04em]">{metric.label}</span><span className="ml-auto text-[8px]">{pulseExpandedMetric === metric.id ? "−" : "+"}</span></div>
                    <div className="mt-0.5 truncate font-mono text-[10px] font-black leading-4" style={{ color: resourceColor(metric.value) }}>{metric.display}</div>
                  </button>))}
              </div>
              {pulseExpandedMetric && (<div className="mt-1.5 rounded-lg border border-[#2d4a4e] bg-[#0b2024] p-2">
                  {pulseExpandedMetric === "generation" && (<>
                      <p className="mb-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#b6e6d0]">Solar generation · share of generated power</p>
                      {electricalReadings.generationSources.length ? electricalReadings.generationSources.map((source) => (<div key={source.label} className="flex items-center justify-between gap-3 py-0.5 text-[9px]"><span className="text-[#b5c9c4]">{source.label}</span><span className="shrink-0 font-mono text-[#f0cf69]">{electricalReadings.generationKW > 0 ? (source.kw / electricalReadings.generationKW * 100).toFixed(1) : "0.0"}% · {source.kw.toFixed(2)} kW</span></div>)) : <p className="text-[9px] text-[#ffb3b6]">No power is currently being supplied. Solar generation and battery discharge are both zero.</p>}
                      <p className="mt-1 text-[8px] text-[#789a96]">Battery discharge is shown separately under Charging / discharging because it uses stored energy; it is not new generation. This mission has no nuclear generator.</p>
                    </>)}
                  {pulseExpandedMetric === "demand" && (<>
                      <p className="mb-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#b6e6d0]">Power demand · share of total demand</p>
                      {electricalReadings.demandSources.map((source) => (<div key={source.label} className="flex items-center justify-between gap-3 py-0.5 text-[9px]"><span className="text-[#b5c9c4]">{source.label}</span><span className="shrink-0 font-mono text-[#f0cf69]">{electricalReadings.consumptionKW > 0 ? (source.kw / electricalReadings.consumptionKW * 100).toFixed(1) : "0.0"}% · {source.kw.toFixed(2)} kW</span></div>))}
                      <p className="mt-1 text-[8px] text-[#789a96]">Demand is the sum of active colony electrical loads only. Battery charging is shown separately in the power-balance panel, not added to system demand. Passive radiation shielding draws no electricity; active monitoring is counted. NASA reference loads are scaled estimates for this game's four-crew habitat, not universal hardware ratings.</p>
                    </>)}
                  {pulseExpandedMetric === "battery" && (<>
                      <p className="mb-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#b6e6d0]">Stored electrical energy</p>
                      <div className="flex items-center justify-between gap-3 py-0.5 text-[9px]"><span className="text-[#b5c9c4]">Battery bank</span><span className="font-mono text-[#f0cf69]">{physicalTelemetry.battery} · {metrics.battery.toFixed(1)}% charge</span></div>
                      <div className="flex items-center justify-between gap-3 py-0.5 text-[9px]"><span className="text-[#b5c9c4]">Protected reserve floor</span><span className="font-mono text-[#f0cf69]">{LEVEL1_ENVIRONMENT.batteryMinimumSOCPercent}% charge</span></div>
                      <div className="flex items-center justify-between gap-3 py-0.5 text-[9px]"><span className="text-[#b5c9c4]">Battery capacity</span><span className="font-mono text-[#f0cf69]">{ratedBatteryCapacityKWh(pending?.selected ?? {}, buildings).toFixed(0)} kWh</span></div>
                    </>)}
                  {pulseExpandedMetric === "batteryFlow" && (<>
                      <p className="mb-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#b6e6d0]">Power balance</p>
                      <div className="flex items-center justify-between gap-3 py-0.5 text-[9px]"><span className="text-[#b5c9c4]">Solar power available</span><span className="font-mono text-[#f0cf69]">{electricalReadings.generationKW.toFixed(2)} kW</span></div>
                      <div className="flex items-center justify-between gap-3 py-0.5 text-[9px]"><span className="text-[#b5c9c4]">Colony power demand</span><span className="font-mono text-[#f0cf69]">− {electricalReadings.consumptionKW.toFixed(2)} kW</span></div>
                      <div className="my-1 border-t border-[#30484c]"/>
                      <div className="flex items-center justify-between gap-3 py-0.5 text-[9px]"><span className="font-bold text-[#b5c9c4]">Net power (solar − demand)</span><span className="font-mono font-bold text-[#f0cf69]">{(electricalReadings.generationKW - electricalReadings.consumptionKW) > 0.01 ? "+" : ""}{(electricalReadings.generationKW - electricalReadings.consumptionKW).toFixed(2)} kW</span></div>
                      {electricalReadings.generationKW - electricalReadings.consumptionKW > 0.01 ? <p className="mt-1 text-[8px] leading-4 text-[#9ce3b2]">Surplus: solar makes more power than the colony needs. The battery is actually charging at {Math.max(0, -electricalReadings.batteryFlowKW).toFixed(2)} kW (limited by its charge rating and remaining capacity).</p> : electricalReadings.generationKW - electricalReadings.consumptionKW < -0.01 ? <p className="mt-1 text-[8px] leading-4 text-[#ffcb8d]">Shortfall: solar cannot meet demand. The battery is actually supplying {Math.max(0, electricalReadings.batteryFlowKW).toFixed(2)} kW; if that is less than the shortfall, some loads may be underpowered.</p> : <p className="mt-1 text-[8px] leading-4 text-[#9cb0b2]">Balanced: solar output is approximately equal to demand, so the battery is not meaningfully charging or discharging.</p>}
                      <div className="mt-1 flex items-center justify-between gap-3 py-0.5 text-[9px]"><span className="text-[#b5c9c4]">Time until battery reaches protected reserve</span><span className="font-mono text-[#f0cf69]">{electricalReadings.enduranceHours !== null && Number.isFinite(electricalReadings.enduranceHours) ? `${electricalReadings.enduranceHours.toFixed(2)} simulated h · ${Math.ceil(electricalReadings.enduranceHours * 3600 / Math.max(0.01, speed * GAME_TIME_ACCELERATION))} real s` : electricalReadings.batteryFlowKW < -0.01 ? "Charging — reserve is not being depleted" : "Not currently discharging"}</span></div></>)}
                </div>)}
              {(metrics.oxygen < 28 || metrics.water < 28) && (<div className="mt-1 rounded-md border border-[#d75d69] bg-[#321a21] px-2 py-1 text-[8px] font-bold text-[#ffb3b6]">LIFE SUPPORT WARNING · {metrics.oxygen < 28 ? "O₂ reserve low" : ""}{metrics.oxygen < 28 && metrics.water < 28 ? " · " : ""}{metrics.water < 28 ? "Water reserve low" : ""}</div>)}
              {Object.values(activeOperations).length > 0 && <p className="mt-1 text-right text-[7px] font-black uppercase tracking-[0.1em] text-[#92e7b7]">{Object.values(activeOperations).length} active job(s)</p>}
            </div>
          </div>)}

        {!activeEvent && (<div className="pointer-events-none absolute left-3 bottom-3 z-20 w-[min(86vw,390px)]">
          <div className="rounded-2xl border border-[#3d555b] bg-[#0b1519]/[0.90] px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.42)] backdrop-blur-sm">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#e8bd56]/[0.16] text-[#f2cd67]">
                <Zap className="h-3.5 w-3.5"/>
              </div>
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#d6e0dd]">Mission feed</p>
                <p className="mt-0.5 text-[10px] leading-4 text-[#94aaa9]">{aiMessage}</p>
              </div>
            </div>
          </div>
        </div>)}
        {!activeEvent && (<div className="pointer-events-auto absolute right-3 bottom-3 z-20 flex items-center gap-1.5">
          <button type="button" onClick={() => setManualPaused((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#40565b] bg-[#0b1519]/[0.92] text-[#e8eeee] shadow-[0_8px_25px_rgba(0,0,0,0.38)] backdrop-blur-sm hover:border-[#f0ca63]" aria-label={manualPaused ? "Resume mission" : "Pause mission"} title={manualPaused ? "Resume" : "Pause"}>
            {manualPaused ? <Play className="h-4 w-4"/> : <Pause className="h-4 w-4"/>}
          </button>
          <button type="button" onClick={() => { setEmergencyPowerMode((value) => !value); setAiMessage(!emergencyPowerMode ? "ECO POWER ON · Non-critical load is being shed. Generation margin improves, but battery efficiency and agriculture support are reduced until normal mode is restored." : "ECO POWER OFF · Normal loads restored. Check generation and reserve before continuing high-power work."); }} className={`rounded-xl border px-2.5 py-2 text-[8px] font-black tracking-[0.08em] shadow-[0_8px_25px_rgba(0,0,0,0.38)] backdrop-blur-sm ${emergencyPowerMode ? "border-[#f0ca63] bg-[#e1b952] text-[#1e211c]" : "border-[#40565b] bg-[#0b1519]/[0.92] text-[#aab8b9] hover:border-[#f0ca63]"}`} aria-pressed={emergencyPowerMode} title="Shed non-critical loads to protect power margin; agriculture and battery charging take a hit.">
            {emergencyPowerMode ? "ECO ON" : "ECO MODE"}
          </button>
          {[1, 2, 4].map((value) => (<button key={value} type="button" onClick={() => setSpeed(value)} className={`rounded-xl border px-2.5 py-2 text-[8px] font-black tracking-[0.1em] shadow-[0_8px_25px_rgba(0,0,0,0.38)] backdrop-blur-sm ${speed === value ? "border-[#f0ca63] bg-[#e1b952] text-[#1e211c]" : "border-[#40565b] bg-[#0b1519]/[0.92] text-[#aab8b9] hover:border-[#f0ca63]"}`} aria-label={`Set mission speed to ${value}x`}>
              {value}×
            </button>))}
        </div>)}
        {!activeEvent && (<MissionTaskRibbon pending={pending} elapsed={elapsed} resolvedEvents={resolvedEventIds} sampleStages={sampleStages} activeEvent={activeEvent} roverTask={roverTask}/>)}

        {!activeEvent && (<>
            <button type="button" onClick={() => setDashboardOpen((open) => !open)} className="pointer-events-auto absolute right-3 top-3 z-40 flex items-center gap-2 rounded-xl border border-[#526c68] bg-[#0a171c]/[0.94] px-3 py-2.5 text-left shadow-[0_8px_28px_rgba(0,0,0,0.42)] backdrop-blur-md transition hover:border-[#e8c568]" aria-expanded={dashboardOpen} aria-label={dashboardOpen ? "Close systems dashboard" : "Open systems dashboard"}>
              <Gauge className="h-4 w-4 text-[#eac568]"/>
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white">Systems</span>
              <span className="font-mono text-[10px] text-[#a8ddb8]">{Math.round(performance.colonyHealth)}%</span>
              {Object.values(activeOperations).length > 0 && <span className="rounded-full bg-[#1f775a] px-1.5 py-0.5 text-[8px] font-black text-[#d4ffe5] animate-pulse">{Object.values(activeOperations).length} WORK</span>}
              {Object.keys(activeFaults).length > 0 && <span className="rounded-full bg-[#d74d59] px-1.5 py-0.5 text-[8px] font-black text-white">{Object.keys(activeFaults).length}!</span>}
              <span className="text-xs text-[#8eaaa4]">{dashboardOpen ? "−" : "+"}</span>
            </button>

            {dashboardOpen && (<aside className="pointer-events-auto absolute right-3 top-[58px] z-40 max-h-[76vh] w-[min(94vw,390px)] overflow-y-auto rounded-2xl border border-[#405b5e] bg-[#081419]/[0.97] shadow-[0_22px_62px_rgba(0,0,0,0.65)] backdrop-blur-xl">
                <div className="sticky top-0 z-10 border-b border-[#30484c] bg-[#102329]/[0.98] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#e8c568]">Telemetry / live board</p>
                      <h2 className="mt-1 text-sm font-black uppercase tracking-[0.1em] text-white">Colony systems</h2>
                    </div>
                    <button type="button" onClick={() => setDashboardOpen(false)} className="rounded-lg border border-[#425a5d] px-2.5 py-1.5 text-xs text-[#b4c4c2]" aria-label="Close systems dashboard">×</button>
                  </div>
                  <p className="mt-2 text-[9px] leading-4 text-[#87a29f]">{emergencyPowerMode ? "ECO POWER ACTIVE · non-critical loads are shed. Available-power margin improves, but edible-food output / stored-energy charging are less efficient." : "Resource values are shown in physical units using the stated outpost capacity model. Warning colours indicate reduced operating margin."}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3">
                  {[
                    { label: "Power demand", value: clamp(electricalReadings.consumptionKW / 16 * 100), display: electricalReadings.consumptionKW.toFixed(2) + " kW", inverse: false },
                    { label: "Battery charging / discharging rate", value: electricalReadings.batteryFlowKW < 0 ? 80 : electricalReadings.batteryFlowKW > 0 ? 35 : 50, display: Math.abs(electricalReadings.batteryFlowKW).toFixed(2) + " kW " + (electricalReadings.batteryFlowKW < -0.01 ? "charging" : electricalReadings.batteryFlowKW > 0.01 ? "discharging" : "idle"), inverse: false },
                    { label: "Stored energy", value: metrics.battery, display: physicalTelemetry.battery, inverse: false },
                    { label: "O₂ reserve", value: metrics.oxygen, display: (metrics.oxygen / 100 * 24).toFixed(1) + " kg O₂", inverse: false },
                    { label: "Water reserve", value: metrics.water, display: Math.round(metrics.water / 100 * 180) + " L", inverse: false },
                    { label: "Food reserve", value: metrics.food, display: (metrics.food / 100 * 42).toFixed(1) + " kg food", inverse: false },
                    { label: "Hull integrity", value: metrics.habitat, display: Math.round(metrics.habitat) + "% integrity", inverse: false },
                    { label: "Temperature", value: clamp(100 - Math.abs(metrics.temperature - 21) * 12), display: `${metrics.temperature.toFixed(1)}°C`, inverse: false },
                    { label: "Radiation dose rate", value: clamp(metrics.radiation * 3.33), display: (metrics.radiation / 100 * 0.06).toFixed(3) + " mSv/h", inverse: true },
                ].map((metric) => (<div key={metric.label} className="rounded-xl border border-[#253d42] bg-[#102025] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#8da8a4]">{metric.label}</p>
                        <p className="shrink-0 font-mono text-sm font-bold" style={{ color: resourceColor(metric.value, metric.inverse) }}>{metric.display}</p>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#26383d]">
                        <div className="h-full rounded-full transition-[width]" style={{ width: `${clamp(metric.value)}%`, background: resourceColor(metric.value, metric.inverse) }}/>
                      </div>
                    </div>))}
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
                    return (<button key={track.id} type="button" onClick={() => { setSelectedResourceId(null); setSelectedBuildingId(track.id); setDashboardOpen(false); }} className="w-full rounded-xl border border-[#263d42] bg-[#0d1b20] p-2.5 text-left transition hover:border-[#b9a15d]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 text-[9px] font-black uppercase tracking-[0.08em] text-[#e4ece4]">{track.category} <span className="font-normal text-[#75918d]">· {pending.selected[track.id]}</span></span>
                            <span className="shrink-0 font-mono text-[10px] font-bold" style={{ color: resourceColor(state.condition) }}>{Math.round(state.condition)}%</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#25363a]"><div className="h-full rounded-full" style={{ width: `${clamp(state.condition)}%`, background: resourceColor(state.condition) }}/></div>
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <span className="text-[8px] uppercase tracking-[0.1em]" style={{ color: resourceColor(state.condition) }}>{fault ? "FAULT ACTIVE" : state.status}</span>
                            {track.id === "solar" && <span className="text-[8px] text-[#d7be72]">Dust {Math.round(state.dust)}%</span>}
                            {(state.upgradeLevel ?? 0) > 0 && <span className="text-[8px] text-[#e8c568]">Retrofit L{state.upgradeLevel}/2</span>}
                          </div>
                        </button>);
                })}
                  </div>
                </div>

                {Object.values(activeOperations).length > 0 && (<div className="border-t border-[#30484c] bg-[#11242a] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#a9f2c8]">Active work orders</p>
                      <span className="rounded-full bg-[#1e5944] px-2 py-1 text-[8px] font-black text-[#b7ffd1]">{Object.values(activeOperations).length} RUNNING</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {Object.values(activeOperations).map((job) => (<button key={job.id} type="button" onClick={() => {
                            const fieldNode = RESOURCE_NODES[pending.campaign === "mars" ? "MARS" : "MOON"].find((node) => node.id === job.targetId);
                            setSelectedResourceId(fieldNode?.id ?? null);
                            setSelectedBuildingId(fieldNode ? null : job.targetId);
                            setDashboardOpen(false);
                        }} className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#2a5a4a] bg-[#0c211d] px-2.5 py-2 text-left hover:border-[#76dda8]">
                          <span className="min-w-0 flex-1 text-left"><span className="block truncate text-[9px] font-bold text-[#e2f4e9]">{job.label}</span>{job.supportSystems?.length ? <span className="mt-0.5 block text-[8px] text-[#8fc8b0]">Systems: {[job.targetId, ...job.supportSystems].map((id) => SYSTEM_LABELS[id] ?? id).join(" + ")}</span> : null}<span className="mt-0.5 block text-[8px] font-mono text-[#b2d9c1]">{formatWallClockCountdown(job.remainingSeconds, speed)}s remaining</span></span>
                          <span className="shrink-0 text-[8px] font-black uppercase tracking-[0.1em] text-[#93e8b6]">Open system →</span>
                        </button>))}
                    </div>
                    <p className="mt-2 text-[8px] leading-4 text-[#88aaa0]">Countdowns appear inside each system panel, not over the map.</p>
                  </div>)}

                <div className="border-t border-[#30484c] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#b5c8c1]">Active fault register</p>
                    <span className={`text-[8px] font-black uppercase tracking-[0.1em] ${Object.keys(activeFaults).length ? "text-[#ff8187]" : "text-[#84d4a2]"}`}>{Object.keys(activeFaults).length ? `${Object.keys(activeFaults).length} unresolved` : "No ongoing faults"}</span>
                  </div>
                  {Object.keys(activeFaults).length === 0 ? (<p className="mt-2 text-[9px] leading-4 text-[#76928f]">Ignored incidents will appear here and continue to affect the relevant system until the fault clears.</p>) : (<div className="mt-2 space-y-2">
                      {Object.values(activeFaults).map((fault) => (<button key={fault.eventId} type="button" onClick={() => { setSelectedResourceId(null); setSelectedBuildingId(fault.targetTrackId); setDashboardOpen(false); }} className="w-full rounded-xl border border-[#713b44] bg-[#26161d] p-2.5 text-left transition hover:border-[#e7c567] hover:bg-[#302027]" title={`Open ${fault.targetTrackId} to inspect repair options`}>
                          <div className="flex items-start justify-between gap-2"><p className="text-[9px] font-bold text-[#fff0ec]">{fault.title}</p><span className="font-mono text-[9px] text-[#ff9aa3]">{fault.remainingSeconds > 0 ? `${formatWallClockCountdown(fault.remainingSeconds, speed, GAME_TIME_ACCELERATION)}s` : "OVERDUE"}</span></div>
                          <p className="mt-1 text-[8px] uppercase tracking-[0.1em] text-[#d59097]">Degrading {fault.targetTrackId.toUpperCase()} · severity {fault.severity.toFixed(1)}×</p>
                          <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-[#e8c568]">Inspect system → start timed repair</p>
                        </button>))}
                    </div>)}
                </div>
              </aside>)}

            {operationResult && (<div className="pointer-events-auto absolute left-1/2 top-1/2 z-40 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#5d8a6b] bg-[#0b1c1c]/[0.98] p-4 shadow-[0_18px_58px_rgba(0,0,0,0.68)]">
                <div className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#85d9a2]"/>
                  <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#91ddb0]">Operation report</p><p className="mt-1 text-[11px] leading-5 text-[#d7e6de]">{operationResult}</p></div>
                  <button type="button" onClick={() => setOperationResult(null)} className="rounded-lg border border-[#3d6052] px-2 py-1 text-xs text-[#c3d7cb]" aria-label="Dismiss operation report">×</button>
                </div>
              </div>)}


          </>)}

        {selectedResource && !activeEvent && (<ResourceInspector node={selectedResource} stage={sampleStages[selectedResource.id] ?? (surveyedNodes.includes(selectedResource.id) ? "SURVEYED" : "UNSURVEYED")} sampleQuality={sampleQuality[selectedResource.id]} hasRover={pending.selected.rover !== undefined} hasExtraction={pending.selected.extraction !== undefined} hasScience={pending.selected.science !== undefined} operation={activeOperations[selectedResource.id] ?? activeOperations.rover ?? activeOperations.science ?? Object.values(activeOperations).find((job) => ["SURVEY", "COLLECT", "TRANSFER"].includes(job.kind)) ?? null} actionBusy={Boolean(activeOperations[selectedResource.id] || activeOperations.rover || activeOperations.science || Object.values(activeOperations).find((job) => ["SURVEY", "COLLECT", "TRANSFER"].includes(job.kind)))} onAction={(action) => handleResourceAction(selectedResource.id, action)} onClose={() => setSelectedResourceId(null)} getBlockers={checkActionPrerequisites} simulationSpeed={speed}/>)}

        {!activeEvent && selectedTrack && selectedTier && !selectedResource && (<BuildingInspector track={selectedTrack} tier={selectedTier} runtime={buildings[selectedTrack.id] ?? { condition: 100, dust: 0, status: "ONLINE", upgradeLevel: 0 }} onAction={(action) => handleBuildingAction(selectedTrack.id, action)} onClose={() => setSelectedBuildingId(null)} hasMaintenance={pending.selected.maintenance !== undefined} operation={activeOperations[selectedTrack.id] ?? Object.values(activeOperations).find((job) => job.supportSystems?.includes(selectedTrack.id)) ?? null} activeFault={Object.values(activeFaults).find((fault) => fault.targetTrackId === selectedTrack.id) ?? null} actionBusy={Boolean(activeOperations[selectedTrack.id] || Object.values(activeOperations).some((job) => job.supportSystems?.includes(selectedTrack.id)))} activeEvent={activeEvent && selectedBuildingId === activeTargetTrackId ? activeEvent : null} eventChoices={activeEvent && selectedBuildingId === activeTargetTrackId ? getEventChoices(activeEvent, pending.selected) : []} onEventChoice={handleEventChoice} power={metrics.power} battery={metrics.battery} batteryCapacityKWh={ratedBatteryCapacityKWh(pending.selected, buildings)} batteryFlowKW={electricalReadings.batteryFlowKW} metrics={metrics} getBlockers={getRepairBlockers} selected={pending.selected} earthReport={earthReport} earthReportAtSeconds={earthReportAtSeconds} elapsedSeconds={elapsed} fallbackReadyAt={fallbackReadyAt} partsInventoryKg={partsInventoryKg} simulationSpeed={speed} campaign={pending.campaign} missionTitle={pending.missionTitle} missionNumber={pending.missionNumber}/>)}

        {activeEvent && (<div className="absolute inset-0 z-[80] grid place-items-center bg-[#05080c]/[0.80] p-3 backdrop-blur-sm sm:p-5">
            <section className="pointer-events-auto max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-[26px] border-2 border-[#d95363] bg-[#0b1118]/[0.99] shadow-[0_25px_100px_rgba(0,0,0,0.8)]">
              <header className="sticky top-0 z-10 border-b border-[#733842] bg-gradient-to-r from-[#421c27] via-[#25161e] to-[#15141c] px-5 py-4 sm:px-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#c95160] bg-[#6e2634]/40 text-[#ff8088]"><AlertTriangle className="h-6 w-6"/></div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#ff858b]">Critical incident · respond now</p>
                      <h1 className="mt-1 text-lg font-black uppercase tracking-[0.06em] text-white sm:text-2xl">{activeEvent.title}</h1>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[#d9b4bb]">Affected asset · {(activeTargetTrackId ?? activeEvent.trackId).toUpperCase()} · {environmentLabel}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-[#ee6e78] bg-[#721f2c]/50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#ffc1c2]">Live fault · {Object.keys(activeFaults).length} active</span>
                </div>
                <p className="mt-4 max-w-3xl text-[11px] leading-5 text-[#e4d9df]">{activeEvent.subtitle} {activeEvent.summary}</p>
                <div className="mt-3 rounded-xl border border-[#7a3543] bg-[#29151d] px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#ffb6bc]">This is not a cosmetic warning</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#f0c8cb]">The mission clock, resource simulation and all work timers are PAUSED while you decide. A poor response leaves a persistent fault that will keep degrading its system after you resume.</p>
                </div>
              </header>

              <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  <section className="rounded-2xl border border-[#33484f] bg-[#101e25] p-4">
                    <div className="flex items-center gap-2 text-[#e8c568]"><Activity className="h-4 w-4"/><p className="text-[9px] font-black uppercase tracking-[0.18em]">Current telemetry</p></div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[
                { label: "Target condition", value: Math.round(buildings[activeTargetTrackId ?? activeEvent.trackId]?.condition ?? 100), display: `${Math.round(buildings[activeTargetTrackId ?? activeEvent.trackId]?.condition ?? 100)}%` },
                { label: "Available power", value: metrics.power, display: physicalTelemetry.power },
                { label: "Stored energy", value: metrics.battery, display: physicalTelemetry.battery },
                { label: "Oxygen reserve", value: metrics.oxygen, display: physicalTelemetry.oxygen },
                { label: "Water reserve", value: metrics.water, display: physicalTelemetry.water },
            ].map((item) => (<div key={item.label} className="rounded-xl border border-[#2d4248] bg-[#0b171d] p-3">
                          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#8fa7ab]">{item.label}</p>
                          <p className="mt-1 font-mono text-lg font-bold" style={{ color: resourceColor(item.value) }}>{item.display}</p>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#273a40]"><div className="h-full rounded-full" style={{ width: `${clamp(item.value)}%`, background: resourceColor(item.value) }}/></div>
                        </div>))}
                    </div>
                  </section>

                  {Object.values(activeOperations).length > 0 && (<section className="rounded-2xl border border-[#8a7141] bg-[#2a2518] p-4">
                      <div className="flex items-center gap-2 text-[#f1cf77]"><Pause className="h-4 w-4"/><p className="text-[9px] font-black uppercase tracking-[0.16em]">Work orders safely paused</p></div>
                      <p className="mt-2 text-[10px] leading-4 text-[#f2e3bf]">{Object.values(activeOperations).length} system job(s) are paused while this decision is open. Their countdowns resume once you choose a response; open each system to inspect its timer.</p>
                    </section>)}

                  <section className="rounded-2xl border border-[#33484f] bg-[#101e25] p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#b6c8c4]">Operational consequence</p>
                    <p className="mt-2 text-[10px] leading-5 text-[#93aaa9]">Use the readings to choose between restoring the system, protecting the rest of the colony, or accepting an operational limitation. No choice is free: power, reserve, time or hardware life may be affected.</p>
                    {Object.keys(activeFaults).length > 0 && <p className="mt-3 rounded-lg border border-[#7d3b45] bg-[#2b171e] px-3 py-2 text-[9px] text-[#ffb3b6]">{Object.keys(activeFaults).length} unresolved fault(s) are already degrading the colony.</p>}
                  </section>
                </div>

                <div className="space-y-4">
                <section>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ff868e]">Response console</p><h2 className="mt-1 text-base font-black uppercase tracking-[0.07em] text-white">Choose your action</h2></div>
                    <span className="text-[8px] uppercase tracking-[0.12em] text-[#80989a]">Decision recorded</span>
                  </div>
                  <div className="space-y-2.5">
                    {getEventChoices(activeEvent, pending.selected).map((choice, index) => {
                const unsafe = ["ignore", "continue", "defer", "force", "push", "hold", "maintain"].includes(choice.id);
                return (<button key={choice.id} type="button" onClick={() => handleEventChoice(choice.id)} className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${unsafe ? "border-[#6a4148] bg-[#21191f] hover:border-[#db727c] hover:bg-[#2d1b23]" : "border-[#385c55] bg-[#142922] hover:border-[#e9c568] hover:bg-[#1d382d]"}`}>
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
                        </button>);
            })}
                  </div>
                </section>
                </div>
              </div>
            </section>
          </div>)}
      </main>
    </div>);
}
export default MissionSimulation;
