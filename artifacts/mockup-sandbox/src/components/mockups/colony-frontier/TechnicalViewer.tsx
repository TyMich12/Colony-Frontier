import { useEffect, useRef, useState } from "react";
import type { PointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { ArrowLeft, Rotate3D, ChevronRight } from "lucide-react";
import { GameShell, SectionLabel } from "./_shared/GameShell";
import { formatCredits, tierMeta, type TechnologyTrack, type Tier } from "./_shared/gameData";

type Part = {
  name: string;
  role: string;
  principle: string;
  explanation: string;
};

const systems: Record<string, { title: string; basis: string; flow: string[]; parts: Part[] }> = {
  solar: {
    title: "Photovoltaic Power System",
    basis: "Based on real spacecraft photovoltaic arrays, power conditioning, deployment and battery-backed power architectures.",
    flow: ["Sunlight", "PV cells", "Power conditioning", "DC bus", "Loads / storage"],
    parts: [
      { name: "PV cell array", role: "Converts sunlight into DC electrical power.", principle: "Photovoltaic effect", explanation: "Semiconductor junctions absorb photons and generate charge carriers. Interconnected cells deliver the resulting current as DC power." },
      { name: "Array substrate", role: "Supports cells and electrical connections.", principle: "Structural + electrical integration", explanation: "Space arrays combine lightweight structural members, conductors, connectors and protective materials." },
      { name: "Power conditioning", role: "Regulates array output.", principle: "DC power conversion", explanation: "Power electronics regulate voltage and current and route power to the distribution system." },
      { name: "Storage interface", role: "Connects generation to storage.", principle: "Energy balance", explanation: "Surplus generation can charge storage while stored energy supports loads when generation falls." },
      { name: "Pointing / deployment", role: "Positions or deploys the array.", principle: "Solar incidence", explanation: "Power depends strongly on the angle between sunlight and the array surface normal." }
    ]
  },
  battery: {
    title: "Rechargeable Space Battery",
    basis: "Based on rechargeable aerospace battery cells, battery-management electronics and thermal control.",
    flow: ["Power input", "Electrochemical cells", "Battery management", "Power interface", "Loads"],
    parts: [
      { name: "Cell stack", role: "Stores and releases electrical energy.", principle: "Redox reactions", explanation: "Discharge drives electrons through the external circuit; charging reverses the electrochemical process." },
      { name: "Separator", role: "Keeps electrodes electrically apart.", principle: "Ion conduction", explanation: "A porous separator permits ionic transport while helping prevent direct electrical contact between electrodes." },
      { name: "Battery management", role: "Monitors voltage, current and temperature.", principle: "Feedback control", explanation: "Monitoring and protection keep cells within operating limits and help maintain balanced state of charge." },
      { name: "Thermal interface", role: "Moves heat away from cells.", principle: "Heat transfer", explanation: "Battery performance and lifetime depend strongly on temperature." },
      { name: "Power interface", role: "Connects storage to the electrical bus.", principle: "Power conversion", explanation: "Converters and switching hardware match battery voltage to the spacecraft or surface bus." }
    ]
  },
  oxygen: {
    title: "Oxygen Generation System",
    basis: "Based on NASA ECLSS oxygen generation and air-revitalization technology, with Mars oxygen production informed by MOXIE.",
    flow: ["Feed", "Pump", "Electrochemical stack", "Conditioning", "O₂ storage / cabin"],
    parts: [
      { name: "Feed pump", role: "Moves gas or water through the system.", principle: "Pressure-driven flow", explanation: "Pumps establish the pressure difference required to move process fluid through filters, valves and reaction hardware." },
      { name: "Electrochemical stack", role: "Separates a feed stream into products.", principle: "Electrochemistry", explanation: "Water electrolysis produces oxygen and hydrogen. MOXIE-style solid-oxide electrolysis processes CO₂ to produce oxygen." },
      { name: "Gas conditioning", role: "Controls product quality.", principle: "Separation", explanation: "Produced gas can require drying, filtering, compression and purity monitoring." },
      { name: "Sensors", role: "Measure process conditions.", principle: "Instrumentation", explanation: "Pressure, temperature and composition measurements provide feedback to controllers." },
      { name: "O₂ buffer", role: "Smooths production and demand.", principle: "Mass balance", explanation: "A buffer decouples instantaneous production from instantaneous oxygen demand." }
    ]
  },
  water: {
    title: "Closed-Loop Water Recovery",
    basis: "Based on NASA spacecraft water-recovery research and environmental control and life-support systems.",
    flow: ["Wastewater", "Pretreatment", "Separation", "Polishing", "Recovered water"],
    parts: [
      { name: "Pretreatment", role: "Protects the recovery process.", principle: "Chemical conditioning", explanation: "Pretreatment can reduce biological activity, corrosion and fouling before the main recovery stages." },
      { name: "Membrane / filter", role: "Removes contaminants.", principle: "Mass separation", explanation: "Filters and membranes separate suspended and dissolved contaminants from the water stream." },
      { name: "Polishing reactor", role: "Breaks down remaining organics.", principle: "Chemical oxidation", explanation: "Advanced treatment can oxidize dissolved organic compounds into simpler products." },
      { name: "Product tank", role: "Stores recovered water.", principle: "Mass balance", explanation: "Recovered water is stored and monitored before being supplied to crew systems." },
      { name: "Quality sensors", role: "Verify the output stream.", principle: "Process control", explanation: "Measurements such as temperature, pressure and conductivity help verify water quality." }
    ]
  },
  "co2": {
    title: "Carbon-Dioxide Removal",
    basis: "Based on NASA ECLSS air-revitalization systems that remove CO₂ from crew cabin air.",
    flow: ["Cabin air", "Sorbent bed", "Regeneration", "CO₂ stream", "Downstream processing"],
    parts: [
      { name: "Cabin blower", role: "Circulates cabin air.", principle: "Forced convection", explanation: "Fans maintain the airflow needed to expose cabin air to the separation material." },
      { name: "Sorbent bed", role: "Captures carbon dioxide.", principle: "Adsorption", explanation: "Molecular-sieve materials can capture CO₂ molecules and release them during regeneration." },
      { name: "Regeneration valves", role: "Switch capture and regeneration modes.", principle: "Cyclic adsorption", explanation: "Valves and pressure control allow a sorbent bed to be reused." },
      { name: "CO₂ interface", role: "Routes recovered CO₂.", principle: "Resource recovery", explanation: "Recovered CO₂ can be sent to downstream processing instead of being treated only as waste." }
    ]
  },
  thermal: {
    title: "Spacecraft Thermal-Control Loop",
    basis: "Based on spacecraft cold plates, pumped thermal loops, insulation and radiators.",
    flow: ["Heat source", "Cold plate", "Fluid loop", "Radiator", "Space"],
    parts: [
      { name: "Equipment cold plate", role: "Collects heat from equipment.", principle: "Conduction", explanation: "Heat flows from warmer equipment into a conductive thermal interface." },
      { name: "Pump", role: "Circulates working fluid.", principle: "Convection", explanation: "A pump maintains mass flow so heat can be transported to the radiator." },
      { name: "Fluid lines", role: "Transport thermal energy.", principle: "Energy transport", explanation: "The circulating fluid carries sensible heat from sources toward heat-rejection hardware." },
      { name: "Radiator", role: "Rejects heat to space.", principle: "Thermal radiation", explanation: "In vacuum, a radiator rejects energy primarily through electromagnetic radiation." },
      { name: "Thermal insulation", role: "Limits unwanted heat transfer.", principle: "Thermal resistance", explanation: "Insulation reduces conductive and radiative heat exchange with the environment." }
    ]
  },
  comms: {
    title: "Deep-Space Communications Link",
    basis: "Based on spacecraft communications architectures, directional antennas, transceivers and link-budget engineering.",
    flow: ["Onboard data", "Transceiver", "Antenna", "Space link", "Ground receiver"],
    parts: [
      { name: "Data interface", role: "Packages science and engineering data.", principle: "Digital communications", explanation: "Onboard computers format, packetize and prepare data for transmission." },
      { name: "Transceiver", role: "Creates and receives the communications signal.", principle: "Modulation", explanation: "A transceiver maps information onto a carrier, amplifies transmission and processes received signals." },
      { name: "High-gain antenna", role: "Directs electromagnetic energy.", principle: "Antenna gain", explanation: "A directional antenna concentrates transmitted and received energy into a narrower angular region." },
      { name: "Pointing system", role: "Maintains link alignment.", principle: "Attitude control", explanation: "Spacecraft attitude knowledge and control maintain the required communications geometry." },
      { name: "Ground station", role: "Receives and decodes the signal.", principle: "Link budget", explanation: "Performance depends on power, antenna gains, distance, frequency, losses and receiver sensitivity." }
    ]
  },
  habitat: {
    title: "Pressurized Surface Habitat",
    basis: "Based on NASA lunar habitation concepts, pressure-vessel engineering and ECLSS.",
    flow: ["External environment", "Structure / shielding", "Pressure vessel", "ECLSS", "Crew"],
    parts: [
      { name: "Pressure shell", role: "Contains the breathable atmosphere.", principle: "Pressure containment", explanation: "The pressure vessel carries stresses caused by the pressure difference between inside and outside." },
      { name: "Airlock", role: "Separates cabin atmosphere from the outside.", principle: "Pressure isolation", explanation: "An airlock permits transfer without directly exposing the main pressure volume to vacuum." },
      { name: "ECLSS interface", role: "Controls atmosphere, water and waste.", principle: "Closed-loop life support", explanation: "ECLSS manages pressure, oxygen, CO₂, water, ventilation and waste streams." },
      { name: "Thermal control", role: "Manages internal and external heat.", principle: "Heat transfer", explanation: "Habitat heat loads must be transported and rejected while external thermal inputs are controlled." },
      { name: "External shielding", role: "Adds environmental protection.", principle: "Mass attenuation", explanation: "Additional material can reduce exposure to radiation and micrometeoroid-related hazards." }
    ]
  },
  radiation: {
    title: "Radiation Protection System",
    basis: "Based on spacecraft radiation monitoring and research into lunar regolith, water and hydrogen-rich shielding.",
    flow: ["Radiation field", "Shielding", "Protected volume", "Sensors", "Crew / electronics"],
    parts: [
      { name: "Shielding layer", role: "Reduces radiation reaching protected systems.", principle: "Attenuation", explanation: "Material between a source and a protected volume can reduce transmitted radiation." },
      { name: "Hydrogen-rich layer", role: "Provides useful shielding for some radiation.", principle: "Particle interactions", explanation: "Hydrogen-rich materials are investigated for protection against energetic particle radiation and secondary neutrons." },
      { name: "Radiation sensor", role: "Measures the radiation environment.", principle: "Particle detection", explanation: "Detectors convert radiation interactions into measurable electrical signals." },
      { name: "Protected volume", role: "Defines the shielded region.", principle: "Geometry", explanation: "Performance depends on material, thickness, geometry, source direction and radiation spectrum." }
    ]
  },
  "power-grid": {
    title: "Surface Power Distribution Network",
    basis: "Based on NASA lunar surface power concepts involving generation, storage, management and distribution.",
    flow: ["Generation", "Conditioning", "Distribution bus", "Protection", "Loads / storage"],
    parts: [
      { name: "Power source", role: "Generates electrical power.", principle: "Energy conversion", explanation: "Generation can use photovoltaic, fission or other mission-dependent technologies." },
      { name: "Power converter", role: "Matches sources to the distribution bus.", principle: "Power electronics", explanation: "Converters regulate voltage and current so sources, storage and loads operate together." },
      { name: "Distribution cable", role: "Transfers power across the surface.", principle: "Electrical conduction", explanation: "Conductors carry current between nodes; resistive losses depend on current and resistance." },
      { name: "Protection unit", role: "Isolates faults.", principle: "Circuit protection", explanation: "Switching and protection hardware can disconnect abnormal branches while preserving healthy parts of the network." },
      { name: "Storage node", role: "Buffers generation and demand.", principle: "Load balancing", explanation: "Storage can absorb surplus generation and supply loads when generation falls." }
    ]
  },
  science: {
    title: "Planetary Science Instrument Suite",
    basis: "Based on real planetary instruments that convert optical, thermal, chemical or particle interactions into calibrated measurements.",
    flow: ["Target", "Collection", "Analyzer", "Detector", "Digital data"],
    parts: [
      { name: "Sensor aperture", role: "Admits the measured signal.", principle: "Signal collection", explanation: "Optics or sampling interfaces define what portion of the environment reaches the detector." },
      { name: "Filter / analyzer", role: "Selects useful signal information.", principle: "Physical filtering", explanation: "Filters or analyzers can isolate wavelengths, energies, masses or other properties." },
      { name: "Detector", role: "Converts an interaction into a signal.", principle: "Transduction", explanation: "Detectors transform photons, particles, heat or other interactions into electrical measurements." },
      { name: "Readout electronics", role: "Amplify and digitize signals.", principle: "Signal processing", explanation: "Low-level detector signals are conditioned and converted into digital data." },
      { name: "Calibration reference", role: "Provides a known reference.", principle: "Metrology", explanation: "Calibration establishes the relationship between instrument output and a known physical quantity." }
    ]
  },
  navigation: {
    title: "Autonomous Navigation System",
    basis: "Based on spacecraft and rover guidance, navigation and control systems using inertial, optical and other measurements.",
    flow: ["Sensors", "State estimate", "Guidance", "Controller", "Vehicle motion"],
    parts: [
      { name: "Inertial measurement unit", role: "Measures acceleration and angular motion.", principle: "Inertial sensing", explanation: "Accelerometers and gyroscopes propagate an estimate of vehicle state between external observations." },
      { name: "Optical navigation sensor", role: "Measures terrain or landmarks.", principle: "Computer vision", explanation: "Images provide geometric information about terrain, landmarks or celestial bodies." },
      { name: "Navigation computer", role: "Combines measurements into a state estimate.", principle: "State estimation", explanation: "Algorithms combine imperfect measurements with a motion model to estimate position, velocity and attitude." },
      { name: "Guidance planner", role: "Selects a safe path.", principle: "Guidance", explanation: "Guidance converts mission objectives and constraints into a desired trajectory or local path." },
      { name: "Control actuators", role: "Apply steering or motion commands.", principle: "Feedback control", explanation: "Controllers compare desired and estimated states and command actuators to reduce error." }
    ]
  },
  rover: {
    title: "Planetary Rover Mobility System",
    basis: "Based on NASA planetary rover mobility engineering, wheel-soil interaction testing and active suspension concepts.",
    flow: ["Electrical power", "Motor", "Geartrain", "Wheel", "Regolith / terrain"],
    parts: [
      { name: "Mobility wheel", role: "Transmits drive force to terrain.", principle: "Traction", explanation: "Wheel geometry, grousers, soil properties, slip and normal force determine how torque becomes motion." },
      { name: "Drive actuator", role: "Provides wheel torque.", principle: "Electromechanical conversion", explanation: "An electric motor converts electrical power into mechanical torque." },
      { name: "Suspension / steering", role: "Maintains wheel contact.", principle: "Kinematics", explanation: "Suspension geometry distributes loads and helps the rover negotiate uneven terrain." },
      { name: "Wheel encoder", role: "Measures wheel rotation.", principle: "Odometry", explanation: "Wheel rotation provides a motion estimate, although slip can make it differ from actual ground motion." },
      { name: "Mobility controller", role: "Coordinates wheel torque and steering.", principle: "Feedback control", explanation: "Control software can adapt wheel commands using estimated vehicle and terrain state." }
    ]
  },
  extraction: {
    title: "Regolith / Ice Excavation System",
    basis: "Based on NASA excavation and drilling technology for lunar and planetary regolith, including rotary-percussive drilling.",
    flow: ["Terrain / ice", "Cutting tool", "Transport", "Collector", "Processor"],
    parts: [
      { name: "Cutting / drill tool", role: "Applies force to planetary material.", principle: "Soil mechanics", explanation: "Cutting geometry and applied force determine how material fractures, shears or moves." },
      { name: "Drive actuator", role: "Supplies rotational or percussive energy.", principle: "Mechanical power", explanation: "Actuators convert electrical energy into torque, rotation or impact motion." },
      { name: "Fluted transport path", role: "Moves cuttings away from the tool.", principle: "Granular transport", explanation: "Helical flutes can carry excavated material upward as a drill rotates." },
      { name: "Subsurface sensor", role: "Measures conditions during excavation.", principle: "Instrumentation", explanation: "Sensors can measure depth, temperature or other properties during collection." },
      { name: "Collector", role: "Contains excavated material.", principle: "Material handling", explanation: "Collected material must be transferred while limiting loss and contamination." }
    ]
  },
  isru: {
    title: "In-Situ Resource Utilization Processor",
    basis: "Based on NASA ISRU concepts for using local water, oxygen-bearing minerals, CO₂ and other resources.",
    flow: ["Local resource", "Feed system", "Reactor", "Separation", "Useful product"],
    parts: [
      { name: "Resource feed", role: "Introduces local material.", principle: "Material handling", explanation: "Regolith, ice, atmospheric gas or another local resource enters a controlled processing path." },
      { name: "Process reactor", role: "Separates or transforms the resource.", principle: "Thermochemistry / electrochemistry", explanation: "ISRU processes can use heat, electrochemical reactions or mechanical separation to release products." },
      { name: "Product separator", role: "Separates useful products.", principle: "Mass separation", explanation: "Useful product must be separated from unwanted solids, gases or liquids." },
      { name: "Product storage", role: "Buffers production.", principle: "Mass balance", explanation: "Storage decouples production rate from the rate at which a habitat, vehicle or process consumes the product." },
      { name: "Process controller", role: "Regulates temperature, pressure and flow.", principle: "Feedback control", explanation: "Sensors and control logic keep the process inside operating limits." }
    ]
  },
  agriculture: {
    title: "Controlled-Environment Agriculture",
    basis: "Based on controlled-environment plant growth, hydroponic systems and closed-loop life-support research.",
    flow: ["Power / light", "Root zone", "Plant canopy", "Air control", "Food / biomass"],
    parts: [
      { name: "Plant lighting", role: "Provides photons for photosynthesis.", principle: "Photosynthesis", explanation: "Plants use absorbed light energy to drive photosynthetic reactions." },
      { name: "Root-zone system", role: "Delivers water and nutrients.", principle: "Mass transport", explanation: "Hydroponic systems deliver water and dissolved nutrients directly to the root zone." },
      { name: "Atmosphere control", role: "Controls CO₂, humidity and airflow.", principle: "Gas exchange", explanation: "Airflow, humidity and CO₂ affect transpiration and photosynthetic performance." },
      { name: "Thermal / humidity control", role: "Maintains growth conditions.", principle: "Energy and mass balance", explanation: "Temperature and humidity affect metabolism, water loss and condensation risk." },
      { name: "Growth sensors", role: "Measure the environment.", principle: "Feedback control", explanation: "Sensors monitor variables such as temperature, humidity, light and water conditions." }
    ]
  },
  maintenance: {
    title: "Robotic Maintenance System",
    basis: "Based on robotic servicing, spacecraft maintenance concepts, sensors, actuators and fault-detection systems.",
    flow: ["Inspection", "Diagnosis", "Manipulation", "Verification", "Return to service"],
    parts: [
      { name: "Inspection camera", role: "Provides visual condition data.", principle: "Machine vision", explanation: "Cameras can identify visible changes, alignment issues, contamination or component states." },
      { name: "Robotic manipulator", role: "Moves tools and components.", principle: "Robot kinematics", explanation: "A manipulator uses joints and actuators to place an end effector at a desired pose." },
      { name: "Tool interface", role: "Performs maintenance work.", principle: "Mechanical work", explanation: "Tools transfer force or torque to fasteners, connectors, covers or service interfaces." },
      { name: "Force / torque sensor", role: "Measures interaction with hardware.", principle: "Feedback control", explanation: "Force feedback helps detect contact and prevent excessive loads." },
      { name: "Maintenance controller", role: "Plans and verifies the operation.", principle: "Autonomy + fault detection", explanation: "Control software can sequence actions, compare sensor data with expected states and stop when conditions become abnormal." }
    ]
  }
};


type Vec3 = { x: number; y: number; z: number };
type MeshPart = {
  id: number;
  name: string;
  center: Vec3;
  size: Vec3;
  shape: "box" | "cylinder" | "panel" | "dish" | "antenna";
  color: string;
};

const TIER_LEVEL: Record<Tier, number> = {
  Foundation: 1,
  Frontier: 2,
  Apex: 3,
  Research: 4,
};

const PALETTE = {
  body: "#526b72",
  bodyDark: "#253940",
  metal: "#9aaba9",
  glass: "#5fa7b8",
  copper: "#d49a55",
  green: "#91c96f",
  purple: "#a888dc",
  orange: "#e4a15e",
  blue: "#6bbbd0",
  white: "#dce9e5",
};

function project(p: Vec3, rotation: { x: number; y: number }, zoom: number, width: number, height: number) {
  const ry = rotation.y * Math.PI / 180;
  const rx = rotation.x * Math.PI / 180;
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const x1 = p.x * cy - p.z * sy;
  const z1 = p.x * sy + p.z * cy;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const y1 = p.y * cx - z1 * sx;
  const z2 = p.y * sx + z1 * cx;
  const camera = 760;
  const scale = camera / (camera - z2);
  return {
    x: width / 2 + x1 * scale * zoom,
    y: height / 2 + y1 * scale * zoom,
    depth: z2,
    scale,
  };
}

function rotatePoint(p: Vec3, rotation: { x: number; y: number }) {
  const ry = rotation.y * Math.PI / 180;
  const rx = rotation.x * Math.PI / 180;
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const x1 = p.x * cy - p.z * sy;
  const z1 = p.x * sy + p.z * cy;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  return {
    x: x1,
    y: p.y * cx - z1 * sx,
    z: p.y * sx + z1 * cx,
  };
}

function buildMeshes(track: TechnologyTrack, tier: Tier, parts: Part[]): MeshPart[] {
  const level = TIER_LEVEL[tier];
  const id = (i: number) => i;
  const base: MeshPart[] = [
    { id: id(0), name: parts[0]?.name ?? "Primary assembly", center: { x: 0, y: 0, z: 0 }, size: { x: 210, y: 92, z: 150 }, shape: "box", color: PALETTE.body },
    { id: id(1), name: parts[1]?.name ?? "Secondary assembly", center: { x: 0, y: -18, z: 20 }, size: { x: 130, y: 60, z: 95 }, shape: "box", color: PALETTE.bodyDark },
    { id: id(2), name: parts[2]?.name ?? "Control module", center: { x: 0, y: -4, z: 95 }, size: { x: 80, y: 48, z: 45 }, shape: "box", color: PALETTE.copper },
    { id: id(3), name: parts[3]?.name ?? "Thermal module", center: { x: -125, y: 12, z: 5 }, size: { x: 48, y: 100, z: 80 }, shape: "cylinder", color: PALETTE.blue },
    { id: id(4), name: parts[4]?.name ?? "Interface", center: { x: 125, y: 5, z: 12 }, size: { x: 44, y: 88, z: 76 }, shape: "cylinder", color: PALETTE.green },
  ];

  if (track.id === "solar") {
    base[0] = { ...base[0], size: { x: 175, y: 72, z: 125 }, color: PALETTE.bodyDark };
    base.push({ id: 10, name: parts[0]?.name ?? "PV array", center: { x: -180, y: -12, z: 0 }, size: { x: 155, y: 10, z: 92 }, shape: "panel", color: PALETTE.blue });
    base.push({ id: 11, name: parts[0]?.name ?? "PV array", center: { x: 180, y: -12, z: 0 }, size: { x: 155, y: 10, z: 92 }, shape: "panel", color: PALETTE.blue });
    base.push({ id: 12, name: parts[2]?.name ?? "Power conditioning", center: { x: 0, y: -75, z: 0 }, size: { x: 105, y: 28, z: 60 }, shape: "box", color: PALETTE.copper });
  } else if (track.id === "comms" || track.id === "navigation") {
    base.push({ id: 10, name: parts[2]?.name ?? "Antenna", center: { x: 0, y: -110, z: 15 }, size: { x: 105, y: 130, z: 105 }, shape: "dish", color: PALETTE.metal });
    base.push({ id: 11, name: parts[3]?.name ?? "Pointing system", center: { x: 0, y: -62, z: 20 }, size: { x: 26, y: 70, z: 26 }, shape: "cylinder", color: PALETTE.copper });
  } else if (track.id === "rover") {
    base[0] = { ...base[0], center: { x: 0, y: -25, z: 0 }, size: { x: 190, y: 55, z: 125 }, color: PALETTE.bodyDark };
    const wheels = [-145, -48, 48, 145];
    wheels.forEach((x, i) => base.push({ id: 10 + i, name: parts[0]?.name ?? "Mobility wheel", center: { x, y: 45, z: i % 2 ? -72 : 72 }, size: { x: 42, y: 72, z: 42 }, shape: "cylinder", color: PALETTE.metal }));
    base.push({ id: 20, name: parts[2]?.name ?? "Suspension", center: { x: 0, y: 28, z: 0 }, size: { x: 220, y: 16, z: 90 }, shape: "box", color: PALETTE.copper });
  } else if (track.id === "habitat") {
    base[0] = { ...base[0], size: { x: 220, y: 145, z: 220 }, shape: "cylinder", color: PALETTE.body };
    base.push({ id: 10, name: parts[1]?.name ?? "Airlock", center: { x: 0, y: 0, z: 125 }, size: { x: 65, y: 70, z: 60 }, shape: "cylinder", color: PALETTE.metal });
    base.push({ id: 11, name: parts[4]?.name ?? "Shielding", center: { x: 0, y: -100, z: 0 }, size: { x: 260, y: 20, z: 260 }, shape: "panel", color: PALETTE.copper });
  } else if (track.id === "thermal") {
    base.push({ id: 10, name: parts[3]?.name ?? "Radiator", center: { x: 0, y: -100, z: 0 }, size: { x: 260, y: 12, z: 150 }, shape: "panel", color: PALETTE.blue });
    base.push({ id: 11, name: parts[1]?.name ?? "Pump", center: { x: 0, y: 5, z: 100 }, size: { x: 46, y: 46, z: 46 }, shape: "cylinder", color: PALETTE.copper });
  } else if (track.id === "water" || track.id === "oxygen" || track.id === "co2" || track.id === "isru") {
    base.push({ id: 10, name: parts[1]?.name ?? "Process reactor", center: { x: 0, y: -100, z: 0 }, size: { x: 65, y: 150, z: 65 }, shape: "cylinder", color: PALETTE.green });
    base.push({ id: 11, name: parts[3]?.name ?? "Product storage", center: { x: 105, y: 25, z: 0 }, size: { x: 55, y: 100, z: 55 }, shape: "cylinder", color: PALETTE.blue });
  } else if (track.id === "radiation") {
    base.push({ id: 10, name: parts[0]?.name ?? "Shielding", center: { x: 0, y: -115, z: 0 }, size: { x: 300, y: 18, z: 240 }, shape: "panel", color: PALETTE.copper });
    base.push({ id: 11, name: parts[2]?.name ?? "Radiation sensor", center: { x: 0, y: -40, z: 110 }, size: { x: 30, y: 60, z: 30 }, shape: "cylinder", color: PALETTE.purple });
  } else if (track.id === "extraction") {
    base.push({ id: 10, name: parts[0]?.name ?? "Drill", center: { x: 0, y: 125, z: 0 }, size: { x: 52, y: 190, z: 52 }, shape: "cylinder", color: PALETTE.metal });
    base.push({ id: 11, name: parts[2]?.name ?? "Transport", center: { x: 0, y: 0, z: 110 }, size: { x: 35, y: 150, z: 35 }, shape: "cylinder", color: PALETTE.copper });
  } else if (track.id === "agriculture") {
    base[0] = { ...base[0], size: { x: 220, y: 95, z: 160 }, color: PALETTE.bodyDark };
    base.push({ id: 10, name: parts[0]?.name ?? "Lighting", center: { x: 0, y: -95, z: 0 }, size: { x: 220, y: 12, z: 160 }, shape: "panel", color: PALETTE.orange });
    base.push({ id: 11, name: parts[1]?.name ?? "Root zone", center: { x: 0, y: 45, z: 0 }, size: { x: 170, y: 18, z: 110 }, shape: "panel", color: PALETTE.green });
  } else if (track.id === "maintenance") {
    base.push({ id: 10, name: parts[1]?.name ?? "Manipulator", center: { x: 110, y: -75, z: 0 }, size: { x: 28, y: 180, z: 28 }, shape: "cylinder", color: PALETTE.metal });
    base.push({ id: 11, name: parts[0]?.name ?? "Inspection camera", center: { x: 110, y: -170, z: 0 }, size: { x: 50, y: 50, z: 50 }, shape: "cylinder", color: PALETTE.blue });
  }

  if (level >= 2) {
    base.push({ id: 30, name: "Frontier redundant module", center: { x: -80, y: -90, z: 45 }, size: { x: 70, y: 42, z: 70 }, shape: "box", color: PALETTE.blue });
    base.push({ id: 31, name: "Frontier service manifold", center: { x: 80, y: -82, z: 45 }, size: { x: 70, y: 42, z: 70 }, shape: "box", color: PALETTE.green });
  }
  if (level >= 3) {
    base.push({ id: 40, name: "Apex control electronics", center: { x: 0, y: 90, z: -70 }, size: { x: 105, y: 42, z: 70 }, shape: "box", color: PALETTE.purple });
    base.push({ id: 41, name: "Apex thermal interface", center: { x: -115, y: 70, z: -20 }, size: { x: 45, y: 85, z: 45 }, shape: "cylinder", color: PALETTE.copper });
  }
  if (level >= 4) {
    base.push({ id: 50, name: "Research instrumentation", center: { x: 0, y: -10, z: 145 }, size: { x: 72, y: 72, z: 72 }, shape: "cylinder", color: PALETTE.orange });
    base.push({ id: 51, name: "Research autonomy node", center: { x: 0, y: 105, z: 65 }, size: { x: 80, y: 38, z: 55 }, shape: "box", color: PALETTE.orange });
  }
  return base;
}

function drawBox(ctx: CanvasRenderingContext2D, mesh: MeshPart, rotation: { x: number; y: number }, zoom: number, width: number, height: number, active: boolean) {
  const sx = mesh.size.x / 2, sy = mesh.size.y / 2, sz = mesh.size.z / 2;
  const corners: Vec3[] = [
    { x: -sx, y: -sy, z: -sz }, { x: sx, y: -sy, z: -sz }, { x: sx, y: sy, z: -sz }, { x: -sx, y: sy, z: -sz },
    { x: -sx, y: -sy, z: sz }, { x: sx, y: -sy, z: sz }, { x: sx, y: sy, z: sz }, { x: -sx, y: sy, z: sz },
  ].map(p => ({ x: p.x + mesh.center.x, y: p.y + mesh.center.y, z: p.z + mesh.center.z }));
  const pts = corners.map(p => project(p, rotation, zoom, width, height));
  const faces = [
    { ids: [0,1,2,3], shade: 0.58 }, { ids: [4,7,6,5], shade: 0.86 },
    { ids: [0,4,5,1], shade: 0.72 }, { ids: [1,5,6,2], shade: 0.8 },
    { ids: [2,6,7,3], shade: 0.64 }, { ids: [4,0,3,7], shade: 0.48 },
  ];
  faces.sort((a,b) => {
    const za = a.ids.reduce((s,i)=>s+pts[i].depth,0)/4;
    const zb = b.ids.reduce((s,i)=>s+pts[i].depth,0)/4;
    return za-zb;
  });
  for (const face of faces) {
    ctx.beginPath();
    face.ids.forEach((i,j)=>j?ctx.lineTo(pts[i].x,pts[i].y):ctx.moveTo(pts[i].x,pts[i].y));
    ctx.closePath();
    ctx.fillStyle = mesh.color;
    ctx.globalAlpha = face.shade;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = active ? PALETTE.white : "rgba(180,210,205,.38)";
    ctx.lineWidth = active ? 2.2 : 1;
    ctx.stroke();
  }
}

function drawPanel(ctx: CanvasRenderingContext2D, mesh: MeshPart, rotation: { x: number; y: number }, zoom: number, width: number, height: number, active: boolean) {
  const sx = mesh.size.x/2, sy = mesh.size.y/2, sz = mesh.size.z/2;
  const corners = [
    {x:-sx,y:-sy,z:-sz},{x:sx,y:-sy,z:-sz},{x:sx,y:sy,z:-sz},{x:-sx,y:sy,z:-sz},
    {x:-sx,y:-sy,z:sz},{x:sx,y:-sy,z:sz},{x:sx,y:sy,z:sz},{x:-sx,y:sy,z:sz},
  ].map(p=>({x:p.x+mesh.center.x,y:p.y+mesh.center.y,z:p.z+mesh.center.z}));
  const pts=corners.map(p=>project(p,rotation,zoom,width,height));
  ctx.beginPath(); [0,1,2,3].forEach((i,j)=>j?ctx.lineTo(pts[i].x,pts[i].y):ctx.moveTo(pts[i].x,pts[i].y)); ctx.closePath();
  ctx.fillStyle=mesh.color; ctx.globalAlpha=.72; ctx.fill(); ctx.globalAlpha=1;
  ctx.strokeStyle=active?PALETTE.white:"rgba(180,210,205,.5)"; ctx.lineWidth=active?3:1; ctx.stroke();
  for(let i=1;i<5;i++){ const t=i/5; const a={x:pts[0].x+(pts[1].x-pts[0].x)*t,y:pts[0].y+(pts[1].y-pts[0].y)*t}; const b={x:pts[3].x+(pts[2].x-pts[3].x)*t,y:pts[3].y+(pts[2].y-pts[3].y)*t}; ctx.strokeStyle="rgba(220,240,235,.22)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
}

function drawCylinder(ctx: CanvasRenderingContext2D, mesh: MeshPart, rotation: { x: number; y: number }, zoom: number, width: number, height: number, active: boolean) {
  const r=mesh.size.x/2, h=mesh.size.y/2;
  const top=project({x:mesh.center.x,y:mesh.center.y-h,z:mesh.center.z},rotation,zoom,width,height);
  const bottom=project({x:mesh.center.x,y:mesh.center.y+h,z:mesh.center.z},rotation,zoom,width,height);
  const rx=r*top.scale*zoom, ry=Math.max(8,r*.34*top.scale*zoom);
  ctx.fillStyle=mesh.color;ctx.globalAlpha=.82;ctx.beginPath();ctx.ellipse(top.x,top.y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  ctx.fillStyle=mesh.color;ctx.globalAlpha=.7;ctx.fillRect(top.x-rx,top.y,rx*2,bottom.y-top.y);ctx.globalAlpha=1;
  ctx.beginPath();ctx.ellipse(bottom.x,bottom.y,rx,ry,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=active?PALETTE.white:"rgba(180,210,205,.45)";ctx.lineWidth=active?2.5:1.1;ctx.stroke();
}

function drawDish(ctx: CanvasRenderingContext2D, mesh: MeshPart, rotation: { x: number; y: number }, zoom: number, width: number, height: number, active: boolean) {
  const p=project(mesh.center,rotation,zoom,width,height);
  const r=mesh.size.x/2*p.scale*zoom;
  ctx.fillStyle=mesh.color;ctx.globalAlpha=.72;ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.48,rotation.y*Math.PI/180,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  ctx.strokeStyle=active?PALETTE.white:"rgba(180,210,205,.55)";ctx.lineWidth=active?3:1;ctx.stroke();
  ctx.strokeStyle=PALETTE.copper;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-r*.7);ctx.stroke();
}

function CanvasModel({ track, tier, parts, selected, setSelected }: {
  track: TechnologyTrack; tier: Tier; parts: Part[]; selected: number; setSelected: (index: number) => void;
}) {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const [rotation,setRotation]=useState({x:-18,y:-30});
  const [zoom,setZoom]=useState(1);
  const [dragging,setDragging]=useState(false);
  const last=useRef({x:0,y:0});
  const meshes=useRef<MeshPart[]>([]);
  const hitTargets=useRef<{mesh:MeshPart; x:number;y:number;r:number;index:number}[]>([]);
  const level=TIER_LEVEL[tier];
  const accent=tierMeta[tier].color;

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const rect=canvas.getBoundingClientRect(); const dpr=window.devicePixelRatio||1;
    canvas.width=Math.round(rect.width*dpr); canvas.height=Math.round(rect.height*dpr);
    const ctx=canvas.getContext("2d"); if(!ctx) return;
    ctx.scale(dpr,dpr);
    const w=rect.width,h=rect.height;
    ctx.clearRect(0,0,w,h);
    const gradient=ctx.createRadialGradient(w*.5,h*.42,20,w*.5,h*.5,Math.max(w,h)*.7);
    gradient.addColorStop(0,"#173d45"); gradient.addColorStop(.48,"#0b1d25"); gradient.addColorStop(1,"#050c11");
    ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="rgba(126,174,169,.12)";ctx.lineWidth=1;
    for(let x=0;x<w;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    for(let y=0;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    const scene=buildMeshes(track,tier,parts);
    meshes.current=scene;
    const sorted=[...scene].sort((a,b)=>{
      const za=rotatePoint(a.center,rotation).z, zb=rotatePoint(b.center,rotation).z; return za-zb;
    });
    hitTargets.current=[];
    sorted.forEach(mesh=>{
      const p=project(mesh.center,rotation,zoom,w,h);
      const radius=Math.max(24,Math.max(mesh.size.x,mesh.size.y,mesh.size.z)*.34*p.scale*zoom);
      const index=parts.findIndex(x=>x.name===mesh.name);
      const partIndex=index>=0?index:Math.min(parts.length-1,mesh.id%Math.max(1,parts.length));
      hitTargets.current.push({mesh,x:p.x,y:p.y,r:radius,index:partIndex});
      const active=mesh.id===selected || partIndex===selected;
      if(mesh.shape==="panel") drawPanel(ctx,mesh,rotation,zoom,w,h,active);
      else if(mesh.shape==="cylinder") drawCylinder(ctx,mesh,rotation,zoom,w,h,active);
      else if(mesh.shape==="dish") drawDish(ctx,mesh,rotation,zoom,w,h,active);
      else drawBox(ctx,mesh,rotation,zoom,w,h,active);
    });
    ctx.fillStyle=accent;ctx.font="700 10px monospace";ctx.fillText("3D SYSTEM VIEW  /  TIER "+tier.toUpperCase(),18,24);
    ctx.fillStyle="rgba(220,235,230,.62)";ctx.font="10px monospace";ctx.fillText("DRAG: ROTATE     WHEEL: ZOOM     CLICK: INSPECT",18,h-18);
  },[track,tier,parts,selected,rotation,zoom,accent]);

  function pointerDown(e:PointerEvent<HTMLCanvasElement>){setDragging(true);last.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}
  function pointerMove(e:PointerEvent<HTMLCanvasElement>){if(!dragging)return;const dx=e.clientX-last.current.x,dy=e.clientY-last.current.y;setRotation(r=>({x:Math.max(-75,Math.min(75,r.x-dy*.35)),y:r.y+dx*.35}));last.current={x:e.clientX,y:e.clientY};}
  function pointerUp(){setDragging(false);}
  function click(e:PointerEvent<HTMLCanvasElement>){if(dragging)return;const rect=e.currentTarget.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;const hit=hitTargets.current.slice().sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y)).find(t=>Math.hypot(t.x-x,t.y-y)<=t.r);if(hit)setSelected(hit.index);}
  function wheel(e:ReactWheelEvent<HTMLCanvasElement>){e.preventDefault();e.stopPropagation();setZoom(z=>Math.max(.55,Math.min(1.8,z-e.deltaY*.001)));}
  return <div className="relative overflow-hidden border border-[#29434a] bg-[#061017]">
    <div className="flex items-center justify-between border-b border-[#29434a] bg-[#08151b] px-4 py-3">
      <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.16em] text-[#a8bdb7]"><Rotate3D className="h-4 w-4" style={{color:accent}}/>Real-time 3D engineering model</div>
      <div className="text-[9px] uppercase tracking-[.13em]" style={{color:accent}}>Complexity {level}/4</div>
    </div>
    <canvas ref={canvasRef} className="block h-[560px] w-full touch-none cursor-grab active:cursor-grabbing" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onClick={click} onWheel={wheel} />
    <div className="grid border-t border-[#29434a] bg-[#09151b] sm:grid-cols-5">
      {parts.map((part,index)=><button key={part.name} type="button" onClick={()=>setSelected(index)} className={"border-r border-[#29434a] px-3 py-3 text-left last:border-r-0 "+(selected===index?"bg-[#172a2d]":"hover:bg-[#0f2228]")}><p className="text-[8px] font-bold uppercase tracking-[.15em]" style={{color:accent}}>COMPONENT 0{index+1}</p><p className="mt-1 text-[9px] font-semibold uppercase tracking-[.08em] text-[#dce7df]">{part.name}</p></button>)}
    </div>
  </div>;
}

function ComponentDetail({ part, index, accent, onClose }: { part: Part; index: number; accent: string; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02080b]/90 p-5 backdrop-blur-sm" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-[#526d68] bg-[#0a171e] shadow-[0_30px_100px_rgba(0,0,0,.75)]" onClick={e=>e.stopPropagation()}>
      <div className="flex items-start justify-between border-b border-[#29434a] bg-[#0d2028] p-6">
        <div><p className="text-[9px] font-bold uppercase tracking-[.22em]" style={{color:accent}}>Component 0{index+1} · Detailed engineering view</p><h2 className="mt-2 text-2xl font-semibold uppercase tracking-[.1em] text-[#eef3e7]">{part.name}</h2><p className="mt-2 text-sm text-[#72b9d4]">{part.role}</p></div>
        <button type="button" onClick={onClose} className="border border-[#3e5b5b] px-3 py-2 text-[9px] font-bold uppercase tracking-[.15em] text-[#b8cbc4] hover:border-[#efb658]">Close</button>
      </div>
      <div className="grid gap-5 p-6 md:grid-cols-[220px_1fr]">
        <div className="flex min-h-[220px] items-center justify-center border border-[#29434a] bg-[radial-gradient(circle,#1b4048,#071219_70%)]">
          <div className="relative h-32 w-40 [perspective:600px]"><div className="absolute inset-4 border-2 border-[#6bbbd0] bg-[#24454d] shadow-[0_0_30px_rgba(107,187,208,.18)] [transform:rotateX(58deg)_rotateZ(-28deg)]"/><div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[#e4a15e] bg-[#193037] shadow-[0_0_25px_rgba(228,161,94,.25)]"/></div>
        </div>
        <div className="space-y-5">
          <section><p className="text-[9px] font-bold uppercase tracking-[.2em]" style={{color:accent}}>Engineering principle</p><h3 className="mt-2 text-lg font-semibold text-[#e5eadf]">{part.principle}</h3></section>
          <section><p className="text-[9px] font-bold uppercase tracking-[.2em]" style={{color:accent}}>How it works</p><p className="mt-2 text-sm leading-7 text-[#b9c9c2]">{part.explanation}</p></section>
          <section className="border border-[#29434a] bg-[#0c1b22] p-4"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#efb658]">Engineering note</p><p className="mt-2 text-xs leading-6 text-[#8ea7a0]">This component is represented as a conceptual engineering assembly. The physical principles, subsystem relationships and terminology are grounded in real aerospace technology; dimensions and internal packaging are simplified for the educational model.</p></section>
        </div>
      </div>
    </div>
  </div>;
}

export function TechnicalViewer({ track, tier, onBack }: { track: TechnologyTrack; tier: Tier; onBack: () => void }) {
  const system = systems[track.id] || systems.solar;
  const [selected, setSelected] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const part = system.parts[selected];
  const accent=tierMeta[tier].color;
  return (
    <GameShell active="lab" eyebrow="Engineering visualization / systems knowledge" title="Technical Viewer">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-[#3a5559] bg-[#0c1a21] px-4 py-3">
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#b8d1c5] hover:text-[#f0f4e8]"><ArrowLeft className="h-4 w-4" />Back to Technology Lab</button>
        <span className="text-[10px] font-bold uppercase tracking-[.16em]" style={{color:accent}}>{track.category} · {tier}</span>
      </div>
      <div className="mb-6">
        <SectionLabel>How it works</SectionLabel>
        <h2 className="mt-2 text-2xl font-semibold uppercase tracking-[.12em] text-[#f0f4e8]">{track.tiers[tier].name}</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-[#91aaa3]">{system.title} · {system.basis}</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <CanvasModel track={track} tier={tier} parts={system.parts} selected={selected} setSelected={setSelected} />
          <button type="button" onClick={()=>setDetailOpen(true)} className="mt-4 flex w-full items-center justify-between border border-[#536d61] bg-[#11252a] px-5 py-4 text-left hover:border-[#efb658]"><span><span className="block text-[9px] font-bold uppercase tracking-[.2em]" style={{color:accent}}>Open full component detail</span><span className="mt-1 block text-[10px] uppercase tracking-[.12em] text-[#789690]">Isolate and study {part.name}</span></span><ChevronRight className="h-5 w-5 text-[#efb658]" /></button>
          <div className="mt-5 border border-[#29434a] bg-[#0b1a21] p-5"><SectionLabel>System flow</SectionLabel><div className="mt-4 flex flex-wrap items-center gap-2">{system.flow.map((step,i)=><div key={step} className="flex items-center gap-2"><div className="border border-[#3c5a60] bg-[#10232a] px-3 py-2 text-[9px] font-bold uppercase tracking-[.13em] text-[#c6d7cf]">{step}</div>{i<system.flow.length-1&&<ChevronRight className="h-3.5 w-3.5 text-[#efb658]"/>}</div>)}</div></div>
        </div>
        <aside className="space-y-4">
          <section className="border border-[#3d5b50] bg-[#0d2028] p-5"><SectionLabel>Selected component</SectionLabel><h3 className="mt-2 text-xl font-semibold uppercase tracking-[.08em] text-[#eef3e7]">{part.name}</h3><p className="mt-2 text-xs uppercase tracking-[.14em] text-[#72b9d4]">{part.role}</p><div className="mt-5 border-l-2 border-[#efb658] bg-[#15262b] px-4 py-3"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#efb658]">Engineering principle</p><p className="mt-1 text-sm font-semibold text-[#e5eadf]">{part.principle}</p></div><p className="mt-4 text-sm leading-6 text-[#aebeb7]">{part.explanation}</p><button type="button" onClick={()=>setDetailOpen(true)} className="mt-5 w-full border border-[#536d61] bg-[#11252a] px-4 py-3 text-[9px] font-bold uppercase tracking-[.17em] text-[#cfe1d7] hover:border-[#efb658]">Inspect component in detail</button></section>
          <section className="border border-[#29434a] bg-[#0b1a21] p-5"><SectionLabel>Tier hardware</SectionLabel><div className="mt-3 space-y-3 text-[9px] uppercase tracking-[.14em]"><div className="flex justify-between gap-4"><span className="text-[#87958c]">Technology</span><span className="text-right text-[#e4eadf]">{track.tiers[tier].name}</span></div><div className="flex justify-between gap-4"><span className="text-[#87958c]">Mass</span><span className="font-mono text-[#d9e5d8]">{track.tiers[tier].mass.toLocaleString()} kg</span></div><div className="flex justify-between gap-4"><span className="text-[#87958c]">Mission cost</span><span className="font-mono text-[#d9e5d8]">{formatCredits(track.tiers[tier].cost)}</span></div></div></section>
          <div className="border border-[#29434a] bg-[#08151b] p-4 text-[9px] leading-5 uppercase tracking-[.12em] text-[#718b86]">Educational model: a custom real-time 3D renderer is used here. Geometry is simplified for the browser, while subsystem relationships and engineering principles are based on real spacecraft, lunar-surface and planetary technology.</div>
        </aside>
      </div>
      {detailOpen && <ComponentDetail part={part} index={selected} accent={accent} onClose={()=>setDetailOpen(false)} />}
    </GameShell>
  );
}

export default TechnicalViewer;
