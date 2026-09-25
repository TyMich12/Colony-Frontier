import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { ArrowLeft, ChevronRight, Rotate3D, Scan, X, ZoomIn } from "lucide-react";
import { GameShell, SectionLabel } from "./_shared/GameShell";
import { formatCredits, tierMeta, type TechnologyTrack, type Tier } from "./_shared/gameData";

type Shape = "box" | "panel" | "cylinder" | "dish" | "wheel" | "sphere" | "antenna" | "pipe";

type Vec3 = { x: number; y: number; z: number };

type ComponentSpec = {
  name: string;
  role: string;
  principle: string;
  explanation: string;
  shape: Shape;
  center: Vec3;
  size: Vec3;
  color: string;
};

type Architecture = {
  title: string;
  basis: string;
  flow: string[];
  parts: ComponentSpec[];
  tierNote: string;
};

const P = {
  body: "#526970",
  dark: "#243941",
  steel: "#9aa9a8",
  blue: "#62bfd8",
  cyan: "#8bdce8",
  green: "#8fcf70",
  gold: "#e0a35e",
  copper: "#c98245",
  violet: "#aa8add",
  white: "#e1eee8",
  red: "#d87575",
};

const TIER_LEVEL: Record<Tier, number> = {
  Foundation: 1,
  Frontier: 2,
  Apex: 3,
  Research: 4,
};

const TIER_NAMES: Record<Tier, string> = {
  Foundation: "CONVENTIONAL FLIGHT HARDWARE",
  Frontier: "MATURED HIGH-PERFORMANCE HARDWARE",
  Apex: "ADVANCED AUTONOMOUS HARDWARE",
  Research: "NASA-STYLE DEVELOPMENT CONCEPT",
};

function v(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function c(
  name: string,
  role: string,
  principle: string,
  explanation: string,
  shape: Shape,
  center: Vec3,
  size: Vec3,
  color: string,
): ComponentSpec {
  return { name, role, principle, explanation, shape, center, size, color };
}

const architectureBase: Record<string, Omit<Architecture, "parts" | "tierNote"> & {
  base: ComponentSpec[];
  upgrades: Record<Exclude<Tier, "Foundation">, ComponentSpec[]>;
}> = {
  solar: {
    title: "Photovoltaic Power Assembly",
    basis: "Real spacecraft photovoltaic arrays, roll-out solar arrays, power conditioning, deployment booms and battery-backed distribution. NASA’s ROSA/iROSA work is a major reference for the upper tiers.",
    flow: ["Sunlight", "PV cells", "MPPT / power conditioning", "DC bus", "Storage + loads"],
    base: [
      c("PV power wing", "Converts incident sunlight into DC power.", "Photovoltaic effect", "Semiconductor junctions convert absorbed photons into mobile charge carriers. Cells are wired into strings so useful voltage and current reach the spacecraft power electronics.", "panel", v(-185, -20, 0), v(205, 16, 120), P.blue),
      c("Array substrate", "Provides structural support and electrical routing.", "Lightweight structural mechanics", "A space array couples a flexible or rigid structural member to conductors, cell interconnects, protective materials and deployment hardware.", "panel", v(185, -20, 0), v(205, 16, 120), P.cyan),
      c("Power processing unit", "Regulates the raw array electrical output.", "DC-DC conversion", "Power electronics keep voltage inside an acceptable bus range and can implement maximum-power-point tracking so the array operates near its useful operating point.", "box", v(0, 5, 35), v(105, 78, 86), P.gold),
      c("Deployment hinge", "Positions and deploys the array.", "Kinematics + stored strain energy", "Deployment hardware controls how the array changes from a compact launch configuration to its operating area while limiting structural loads.", "cylinder", v(0, 10, -45), v(52, 55, 52), P.steel),
      c("Battery interface", "Routes generation to storage and loads.", "Energy balance", "Surplus generation can charge a battery while the stored energy can support loads when the array is dark or temporarily unavailable.", "box", v(0, 80, 0), v(88, 38, 62), P.green),
    ],
    upgrades: {
      Frontier: [
        c("Roll-out solar blanket", "Deploys a large collecting area from a compact package.", "Elastic strain deployment", "Roll-out solar architectures use lightweight booms and a flexible blanket to package a large collecting surface in a small launch volume.", "panel", v(0, -55, 0), v(300, 12, 150), P.blue),
        c("Array rotary joint", "Allows controlled array pointing.", "Angular tracking", "A rotary drive changes the array normal relative to the Sun, improving the incidence angle and therefore available electrical power.", "cylinder", v(0, -10, 90), v(48, 72, 48), P.copper),
      ],
      Apex: [
        c("High-efficiency multi-junction wing", "Raises conversion efficiency using layered semiconductor junctions.", "Multi-junction photovoltaic conversion", "Multi-junction cells stack semiconductor band gaps so a wider range of photon energies can contribute to electrical output.", "panel", v(-190, 90, 5), v(190, 12, 110), P.violet),
        c("Autonomous array controller", "Optimizes pointing, health and power production.", "Feedback control", "Sensors estimate array position, electrical performance and faults; software can command pointing and isolate degraded strings.", "box", v(110, 55, 55), v(78, 50, 68), P.violet),
      ],
      Research: [
        c("Electrostatic dust-mitigation layer", "Attempts to reduce electrostatic dust accumulation on exposed surfaces.", "Electrostatic particle transport", "Research systems apply controlled electric fields to move or repel charged dust from surfaces. This is a development concept rather than routine flight hardware.", "panel", v(-200, 125, 0), v(190, 10, 115), P.gold),
        c("Autonomous fault-isolation node", "Detects degraded strings and reroutes power.", "Distributed fault management", "Local electronics compare voltage, current and temperature signatures to identify failed branches and keep healthy power paths online.", "sphere", v(112, 115, -12), v(58, 58, 58), P.orange),
      ],
    },
  },
  battery: {
    title: "Rechargeable Energy Storage Pack",
    basis: "Aerospace lithium-ion battery packs and NASA’s SABERS solid-state lithium-sulfur/selenium research inform the progression.",
    flow: ["Electrical input", "Cell stack", "BMS", "Thermal management", "DC bus"],
    base: [
      c("Cell module bank", "Stores electrochemical energy.", "Redox chemistry", "During discharge, chemical potential drives ions through the electrolyte and electrons through the external circuit. Charging reverses the process.", "box", v(-75, 0, 0), v(135, 125, 100), P.steel),
      c("Battery management unit", "Monitors cells and protects operating limits.", "Feedback control", "Voltage, current and temperature measurements allow the controller to estimate state of charge and disconnect unsafe conditions.", "box", v(95, 5, 35), v(90, 66, 72), P.blue),
      c("Contactor / fuse bay", "Connects and disconnects the high-power path.", "Circuit protection", "Contactors provide controlled electrical isolation, while fuses or current protection limit damage during abnormal current events.", "box", v(0, 96, -40), v(92, 42, 70), P.copper),
      c("Cold plate", "Conducts cell heat toward the thermal system.", "Conduction", "Battery heat must be transported away from cells to maintain acceptable temperature and reduce performance loss over repeated cycles.", "panel", v(0, -85, 0), v(250, 12, 120), P.blue),
      c("Cell temperature sensors", "Measure local thermal conditions.", "Instrumentation", "Distributed temperature measurements help detect imbalance and hot spots before they compromise the pack.", "sphere", v(25, 45, 68), v(28, 28, 28), P.gold),
    ],
    upgrades: {
      Frontier: [
        c("Active thermal plate", "Improves heat removal from the cell modules.", "Forced two-phase / pumped heat transfer", "A more capable thermal interface can increase allowable charge and discharge rates by controlling temperature gradients through the pack.", "panel", v(-72, -5, 60), v(135, 10, 92), P.cyan),
        c("Cell-balancing network", "Equalizes individual cell states.", "Electrical balancing", "Balancing circuits trim differences between series cells so no single cell reaches an unsafe voltage limit before its neighbors.", "box", v(98, 65, -20), v(72, 36, 62), P.green),
      ],
      Apex: [
        c("High-power pack busbar", "Reduces resistive loss between dense cell groups.", "I^2R loss management", "Short, low-resistance current paths reduce waste heat during high-power operation and improve the usable electrical output of the pack.", "box", v(-12, 20, 92), v(190, 20, 34), P.gold),
        c("Predictive thermal controller", "Forecasts temperature rise before it becomes limiting.", "Model-based control", "A controller can combine measured temperatures, current demand and thermal models to pre-position cooling before a hot spot develops.", "sphere", v(110, 75, 62), v(42, 42, 42), P.violet),
      ],
      Research: [
        c("SABERS-style solid-state stack", "Represents NASA research into dense solid-state sulfur-selenium cells.", "Solid-state electrochemistry", "NASA’s SABERS portfolio investigates sulfur-selenium cathodes, a solid electrolyte, holey-graphene structures and bipolar stacking. This is research hardware, not standard flight battery equipment.", "box", v(-60, 10, 0), v(160, 105, 74), P.gold),
        c("Bipolar graphene interconnect", "Packs multiple electrochemical layers with fewer interfaces.", "Bipolar cell architecture", "Bipolar stacking places cells in series through conductive plates, reducing inactive interconnect mass and changing how the pack rejects heat.", "panel", v(-60, 10, 45), v(155, 7, 76), P.cyan),
      ],
    },
  },
  oxygen: {
    title: "Oxygen Generation & Air Revitalization",
    basis: "Based on ISS ECLSS oxygen-generation hardware and Mars oxygen production concepts such as NASA/JPL’s MOXIE solid-oxide electrolysis.",
    flow: ["Feed", "Pump", "Electrochemical stack", "Gas conditioning", "O₂ buffer"],
    base: [
      c("Feed pump", "Moves the process fluid through the loop.", "Pressure-driven flow", "The pump establishes the pressure difference required to push the feed through filters, valves and reaction hardware.", "cylinder", v(-105, 25, 0), v(50, 80, 50), P.blue),
      c("Electrolysis stack", "Splits the feed into product gases.", "Electrochemistry", "For water electrolysis, electrical energy drives the reaction that produces hydrogen and oxygen. For MOXIE-style hardware, hot solid-oxide cells separate oxygen from Mars CO₂.", "box", v(0, 10, 0), v(110, 135, 92), P.gold),
      c("Gas conditioner", "Removes unwanted moisture and contaminants.", "Gas separation", "Product gas can require drying, filtering and purity control before entering storage or a life-support loop.", "cylinder", v(92, 15, 35), v(58, 92, 58), P.steel),
      c("Oxygen buffer tank", "Smooths generation and demand.", "Mass balance", "Storage decouples the instantaneous production rate from crew or process demand so the generator does not need to follow every short-term load change.", "cylinder", v(145, 90, -15), v(62, 120, 62), P.cyan),
      c("Pressure / composition sensors", "Measure the process state.", "Feedback instrumentation", "Pressure, temperature and gas-composition readings provide the controller with the information needed to regulate production safely.", "sphere", v(-5, 105, 55), v(30, 30, 30), P.green),
    ],
    upgrades: {
      Frontier: [
        c("Redundant electrolyzer module", "Keeps production available after a single module fault.", "Redundant architecture", "Parallel reaction modules allow the system to continue operating while one branch is isolated for maintenance.", "box", v(0, 10, -95), v(105, 120, 78), P.blue),
        c("Drying / purification cassette", "Improves oxygen product quality.", "Adsorption + filtration", "A replaceable conditioning stage removes residual moisture and particulates before storage or cabin delivery.", "cylinder", v(120, -25, 55), v(48, 80, 48), P.green),
      ],
      Apex: [
        c("High-temperature SOXE chamber", "Represents a scaled solid-oxide oxygen-production core.", "Solid-oxide electrolysis", "MOXIE demonstrated solid-oxide electrolysis on Mars by processing atmospheric CO₂ at high temperature. Scaling requires careful thermal, sealing and gas-flow design.", "box", v(-5, 15, 20), v(145, 120, 100), P.gold),
        c("Regenerative heat exchanger", "Recovers heat within the process loop.", "Sensible heat recovery", "A heat exchanger transfers energy between hot product streams and incoming feed, reducing the external heating requirement.", "cylinder", v(-125, -35, 52), v(52, 70, 52), P.copper),
      ],
      Research: [
        c("Autonomous atmosphere manager", "Coordinates production, storage and cabin demand.", "Closed-loop process control", "Software continuously reconciles oxygen demand, production rate, storage pressure and fault states to keep the atmosphere inside its operating envelope.", "box", v(118, 75, 75), v(90, 54, 74), P.violet),
        c("Distributed leak / purity monitor", "Detects small changes in atmosphere quality.", "Sensor fusion", "Multiple sensors can compare pressure decay, oxygen concentration and local conditions to distinguish production faults from leakage or demand changes.", "sphere", v(-120, 102, -45), v(42, 42, 42), P.orange),
      ],
    },
  },
  water: {
    title: "Regenerative Water Recovery System",
    basis: "Based on NASA ECLSS water recovery: wastewater collection, filtration beds, catalytic oxidation, conductivity monitoring and storage.",
    flow: ["Wastewater", "Pretreatment", "Multi-filtration", "Catalytic oxidation", "Product tank"],
    base: [
      c("Pretreatment vessel", "Conditions incoming wastewater.", "Chemical conditioning", "Pretreatment reduces fouling, corrosion and biological activity before the main separation stages.", "cylinder", v(-125, 20, 0), v(64, 102, 64), P.blue),
      c("Multi-filtration beds", "Remove suspended and dissolved contaminants.", "Adsorption + filtration", "A sequence of filtration media removes contaminants by particle capture and adsorption before the polishing stage.", "box", v(-25, 18, 0), v(118, 128, 90), P.steel),
      c("Catalytic oxidizer", "Breaks down remaining dissolved organics.", "Catalytic oxidation", "NASA’s water processor architecture uses catalytic treatment after filtration to oxidize remaining organic contaminants.", "cylinder", v(83, 25, 35), v(58, 115, 58), P.gold),
      c("Product tank", "Stores recovered water.", "Mass balance", "Recovered water is accumulated in a controlled tank before being released to crew, hygiene or process users.", "cylinder", v(145, 88, -10), v(70, 125, 70), P.cyan),
      c("Conductivity sensor", "Checks water quality.", "Electrical conductivity", "Conductivity provides a fast indication of dissolved ionic contamination and can trigger reprocessing if the product is outside its acceptance range.", "sphere", v(75, 98, 70), v(32, 32, 32), P.green),
    ],
    upgrades: {
      Frontier: [
        c("Humidity condensate inlet", "Adds cabin humidity water to the recovery stream.", "Condensation", "Cabin humidity can be condensed and returned to the water processor, increasing recovery without bringing additional water from Earth.", "pipe", v(-170, -25, 75), v(44, 28, 150), P.cyan),
        c("Brine concentration module", "Reduces residual water left in rejected brine.", "Phase separation", "A more capable processor can recover additional water while concentrating the remaining contaminants into a smaller waste stream.", "cylinder", v(15, -55, 72), v(46, 75, 46), P.green),
      ],
      Apex: [
        c("Membrane separation stage", "Adds high-selectivity membrane treatment.", "Pressure-driven membrane transport", "Membranes selectively transport water or reject particular contaminants, allowing compact multi-stage purification.", "panel", v(-15, 100, 18), v(190, 10, 110), P.blue),
        c("Autonomous water-quality controller", "Routes streams based on measured quality.", "Closed-loop process control", "Sensor data controls valves and treatment cycles so marginal product is reprocessed rather than sent to storage.", "box", v(105, 100, 50), v(76, 42, 62), P.violet),
      ],
      Research: [
        c("Advanced membrane cassette", "Represents next-generation compact membrane recovery research.", "Selective transport", "High-performance membrane stacks can increase recovery while reducing hardware volume; exact materials and architectures remain development-dependent.", "panel", v(-40, 120, -20), v(220, 8, 120), P.cyan),
        c("Self-diagnosing treatment manifold", "Tracks fouling and predicts maintenance needs.", "Digital condition monitoring", "Pressure drop, conductivity and flow signatures can identify a fouling filter or degrading catalyst before the system loses recovery performance.", "sphere", v(108, 118, 82), v(46, 46, 46), P.orange),
      ],
    },
  },
  co2: {
    title: "Carbon-Dioxide Removal & Recovery",
    basis: "Based on ISS air-revitalization architectures using cabin fans, regenerable sorbents, valves and downstream CO₂ processing.",
    flow: ["Cabin air", "Blower", "Sorbent bed", "Regeneration", "Recovered CO₂"],
    base: [
      c("Cabin blower", "Moves cabin air through the separation hardware.", "Forced convection", "The fan establishes airflow so cabin gas contacts the sorbent material at a useful rate.", "cylinder", v(-135, 5, 0), v(62, 96, 62), P.blue),
      c("Primary sorbent bed", "Captures carbon dioxide from cabin air.", "Adsorption", "Porous sorbent materials preferentially retain CO₂ molecules while much of the remaining cabin gas passes through.", "box", v(-32, 10, 0), v(115, 135, 90), P.steel),
      c("Regeneration valve manifold", "Switches the bed between capture and regeneration states.", "Cyclic adsorption", "Valves change pressure or flow conditions so the sorbent can release accumulated CO₂ and return to service.", "box", v(72, 10, 45), v(82, 68, 70), P.copper),
      c("CO₂ buffer tank", "Stores separated carbon dioxide.", "Gas storage", "A buffer smooths the flow between cyclic capture equipment and any downstream conversion process.", "cylinder", v(135, 90, -20), v(62, 115, 62), P.cyan),
      c("Gas composition sensor", "Measures CO₂ and cabin-air quality.", "Spectroscopic / electrochemical sensing", "Continuous measurements provide feedback for bed performance and warn if cabin CO₂ begins to rise.", "sphere", v(-35, 95, 60), v(34, 34, 34), P.green),
    ],
    upgrades: {
      Frontier: [
        c("Twin regenerable bed", "Allows one bed to capture while the other regenerates.", "Continuous cyclic operation", "Staggered bed cycles reduce interruptions in CO₂ removal and can increase average recovery performance.", "box", v(-32, 10, -95), v(108, 128, 78), P.blue),
        c("Regeneration vacuum pump", "Drives the release phase.", "Pressure-swing regeneration", "A lower pressure can reduce the equilibrium loading of an adsorbent, helping release the captured CO₂ for collection.", "cylinder", v(90, -55, 78), v(48, 72, 48), P.gold),
      ],
      Apex: [
        c("Four-bed control block", "Coordinates multiple sorbent beds.", "Sequenced process control", "Multiple staggered beds can increase continuity and allow one bed to be serviced while other beds remain operational.", "box", v(0, -70, 60), v(170, 55, 95), P.violet),
        c("CO₂ compression stage", "Raises recovered gas pressure for downstream use.", "Gas compression", "Compression reduces the storage volume of recovered CO₂ and can prepare it for chemical processing.", "cylinder", v(150, -5, 60), v(58, 96, 58), P.gold),
      ],
      Research: [
        c("Resource-recovery reactor interface", "Feeds recovered carbon into synthesis processes.", "Carbon utilization", "Instead of venting captured CO₂, a future colony system could route it to oxygen production, fuels or other chemical-resource pathways where practical.", "box", v(120, 80, 72), v(105, 65, 90), P.green),
        c("Predictive sorbent-health node", "Estimates remaining sorbent performance.", "Condition-based maintenance", "Pressure, temperature and CO₂ breakthrough data can be combined to estimate when a bed needs replacement or regeneration adjustment.", "sphere", v(-105, 105, -55), v(44, 44, 44), P.orange),
      ],
    },
  },
  thermal: {
    title: "Pumped Fluid Thermal-Control Loop",
    basis: "Based on spacecraft cold plates, pumped fluid loops, heat exchangers, multi-layer insulation and radiators.",
    flow: ["Heat sources", "Cold plate", "Pump", "Radiator", "Infrared emission"],
    base: [
      c("Equipment cold plate", "Collects heat from electronics and power hardware.", "Conduction", "A conductive interface lowers thermal resistance between hot equipment and the circulating coolant path.", "box", v(0, 50, 0), v(175, 35, 110), P.steel),
      c("Pump", "Circulates the working fluid.", "Pressure-driven flow", "The pump supplies the pressure head needed to overcome line and component losses while maintaining a target flow rate.", "cylinder", v(-90, -15, 45), v(62, 70, 62), P.blue),
      c("Fluid manifold", "Routes coolant between branches.", "Conservation of mass", "A manifold distributes the circulating fluid among equipment branches and reunites the streams before heat rejection.", "pipe", v(0, -15, -55), v(260, 26, 30), P.cyan),
      c("Radiator panel", "Rejects heat into space.", "Thermal radiation", "A radiator converts internal thermal energy into electromagnetic radiation; unlike on Earth, vacuum provides essentially no convective cooling.", "panel", v(0, -115, 10), v(285, 12, 155), P.blue),
      c("MLI / insulation blanket", "Limits unwanted heat leakage.", "Thermal resistance", "Low-emittance layers reduce radiative exchange and help separate hot and cold portions of the spacecraft.", "panel", v(125, 70, -82), v(150, 10, 90), P.gold),
    ],
    upgrades: {
      Frontier: [
        c("Redundant pump", "Maintains circulation after one pump fault.", "Fault tolerance", "A parallel pump path lets the system maintain reduced or nominal flow after a single pump becomes unavailable.", "cylinder", v(40, -15, 62), v(58, 66, 58), P.green),
        c("Heat exchanger", "Transfers heat between thermal loops.", "Conjugate heat transfer", "Separate fluid loops can exchange thermal energy through a conductive wall without mixing their working fluids.", "box", v(92, 20, 35), v(82, 70, 74), P.copper),
      ],
      Apex: [
        c("Two-phase thermal control unit", "Uses phase change to transport large heat loads.", "Latent heat", "A working fluid can absorb significant energy during phase transition, enabling high heat transport with a relatively small mass flow.", "cylinder", v(-80, 95, -45), v(70, 92, 70), P.violet),
        c("Distributed thermal controller", "Balances temperature across equipment zones.", "Closed-loop thermal control", "Multiple temperature sensors allow valves and pumps to redistribute heat before a local component exceeds its operating limits.", "sphere", v(110, 65, 70), v(46, 46, 46), P.violet),
      ],
      Research: [
        c("Advanced heat-pipe radiator module", "Represents development of highly passive heat transport.", "Capillary phase-change transport", "Heat pipes move energy through evaporation and condensation driven by capillary action, with no conventional mechanical pump inside the pipe.", "panel", v(0, -130, 40), v(310, 10, 175), P.cyan),
        c("Autonomous thermal digital twin", "Predicts hot spots and controls the network.", "Model-based thermal management", "A continuously updated thermal model can compare predicted and measured temperatures and pre-emptively change flow or radiator allocation.", "box", v(120, 110, 50), v(90, 55, 72), P.orange),
      ],
    },
  },
  comms: {
    title: "Deep-Space Communications Terminal",
    basis: "Based on spacecraft RF communications, high-gain antennas and NASA optical-communications demonstrations such as DSOC.",
    flow: ["Onboard data", "Encoder / transceiver", "RF or laser terminal", "Pointing", "Earth station"],
    base: [
      c("Communications processor", "Packages telemetry and science data.", "Digital communications", "Data are framed, encoded and queued before the physical transmitter converts them into a signal suitable for the space link.", "box", v(-95, 12, 0), v(110, 92, 95), P.steel),
      c("RF transceiver", "Generates and receives radio-frequency signals.", "Modulation + demodulation", "Information is mapped onto a carrier wave for transmission; received signals are amplified, down-converted and decoded.", "box", v(15, 10, 30), v(100, 105, 90), P.gold),
      c("High-gain parabolic antenna", "Concentrates transmitted and received energy.", "Antenna gain", "A dish focuses electromagnetic radiation into a narrow beam, increasing gain but making pointing more critical.", "dish", v(80, -55, -5), v(180, 180, 40), P.steel),
      c("Azimuth / elevation gimbal", "Points the terminal toward the remote station.", "Precision attitude kinematics", "Two-axis motion changes the antenna boresight so the beam stays aligned as the spacecraft or Moon/Mars surface moves relative to Earth.", "cylinder", v(82, 32, -5), v(50, 72, 50), P.copper),
      c("Pointing sensor", "Provides fine line-of-sight information.", "Optical feedback", "The pointing sensor measures the line of sight and supplies error signals to the gimbal controller.", "sphere", v(25, 92, 70), v(34, 34, 34), P.blue),
    ],
    upgrades: {
      Frontier: [
        c("Redundant RF amplifier", "Maintains transmit capability after a single amplifier fault.", "Redundant architecture", "Parallel amplifier paths allow the terminal to isolate a failed unit without losing the complete link.", "box", v(-40, -70, 70), v(78, 54, 70), P.green),
        c("Low-noise receiver front end", "Improves reception of extremely weak signals.", "Noise figure", "Reducing front-end noise increases the usable signal-to-noise ratio for weak deep-space links.", "cylinder", v(175, 25, 55), v(48, 74, 48), P.cyan),
      ],
      Apex: [
        c("Optical laser transceiver", "Adds a laser communications path.", "Photon communications", "NASA’s DSOC demonstrated high-bandwidth optical communications beyond the Earth-Moon system using a flight laser transceiver and ground optical terminals.", "cylinder", v(115, -35, 55), v(52, 88, 52), P.violet),
        c("Fine-pointing telescope", "Keeps a narrow optical beam aligned.", "Closed-loop pointing", "Laser links require much finer pointing than broad RF beams, so a dedicated fine-pointing sensor and actuator maintain line-of-sight accuracy.", "dish", v(125, -105, 45), v(92, 92, 28), P.cyan),
      ],
      Research: [
        c("Photon-counting receiver", "Represents advanced low-light optical reception.", "Single-photon detection", "Future optical terminals can use extremely sensitive detectors to recover faint photon streams over long distances; detector and atmospheric limits remain important.", "sphere", v(178, -20, 72), v(52, 52, 52), P.orange),
        c("Autonomous link manager", "Selects RF, optical and relay paths.", "Adaptive communications", "Software can evaluate link availability, pointing state, weather constraints and required data volume to choose a communications path.", "box", v(-115, 105, 60), v(96, 54, 72), P.orange),
      ],
    },
  },
  habitat: {
    title: "Pressurized Surface Habitat",
    basis: "Based on pressure-vessel engineering, ISS-derived ECLSS, lunar habitation concepts and regolith-based environmental protection.",
    flow: ["Outside environment", "Shielding", "Pressure shell", "ECLSS", "Crew"],
    base: [
      c("Pressure vessel", "Contains the breathable atmosphere.", "Pressure-stress mechanics", "The pressure difference between the interior and exterior produces structural loads in the shell. Cylindrical and spherical forms are efficient pressure-vessel geometries.", "cylinder", v(0, 0, 0), v(275, 210, 275), P.body),
      c("Airlock module", "Controls crew transfer between pressure and vacuum.", "Pressure isolation", "An airlock cycles between pressure states so the main cabin volume is not directly opened to the external environment.", "cylinder", v(0, 10, 165), v(82, 112, 82), P.steel),
      c("ECLSS rack", "Controls atmospheric and water life-support functions.", "Closed-loop life support", "ECLSS manages pressure, oxygen, carbon dioxide, ventilation, waste and water. NASA’s regenerative ECLSS combines water recovery and oxygen-generation functions.", "box", v(-82, 15, 112), v(92, 142, 65), P.blue),
      c("Thermal radiator wing", "Rejects habitat heat.", "Thermal radiation", "Internal metabolic and equipment heat must eventually be radiated away. The radiator keeps the cabin and hardware inside their allowable temperature ranges.", "panel", v(190, -55, 0), v(155, 12, 190), P.cyan),
      c("Environmental shielding", "Reduces radiation and micrometeoroid exposure.", "Material attenuation", "Additional mass between the crew volume and the environment can attenuate some radiation and provide impact protection.", "panel", v(0, -142, 0), v(330, 20, 330), P.gold),
    ],
    upgrades: {
      Frontier: [
        c("Regolith shielding bay", "Provides a thick local-material protective layer.", "Areal-density shielding", "Lunar or Martian regolith can be placed around or over a habitat to increase shielding without launching all shielding mass from Earth.", "panel", v(0, -178, -10), v(365, 34, 365), P.steel),
        c("Secondary pressure bulkhead", "Creates another pressure boundary.", "Compartmentalisation", "A second pressure boundary reduces the volume lost after a local leak and can divide the habitat into isolatable zones.", "cylinder", v(0, 30, -105), v(215, 125, 215), P.blue),
      ],
      Apex: [
        c("Inflatable habitation volume", "Adds deployable crew volume behind a rigid core.", "Membrane pressure architecture", "Inflatable habitat concepts use layered restraint, pressure and micrometeoroid-protection systems to create a large volume from a compact launch package.", "cylinder", v(0, 5, -20), v(310, 235, 310), P.green),
        c("Automated isolation valve tree", "Closes damaged sections during emergencies.", "Fault isolation", "Pressure sensors and fast valves can isolate a suspected leak so the remainder of the habitat stays habitable.", "box", v(115, 88, 105), v(88, 48, 66), P.violet),
      ],
      Research: [
        c("Water-wall radiation shield", "Uses stored water as both a consumable and shielding mass.", "Hydrogen-rich attenuation", "Hydrogen-rich materials such as water are studied for radiation protection because they can reduce exposure while serving another mission purpose.", "cylinder", v(-25, -175, 0), v(345, 34, 345), P.cyan),
        c("Autonomous pressure-health network", "Tracks structural and atmospheric health continuously.", "Sensor fusion", "Distributed pressure, acoustic and environmental measurements can identify abnormal leak signatures and automatically isolate affected zones.", "sphere", v(128, 120, 82), v(48, 48, 48), P.orange),
      ],
    },
  },
  radiation: {
    title: "Radiation Protection & Monitoring",
    basis: "Based on spacecraft dosimetry, radiation sensing and research into mass shielding using water, polymers and local regolith.",
    flow: ["Solar / galactic radiation", "Shielding", "Protected volume", "Detector", "Dose management"],
    base: [
      c("Hydrogen-rich shield panel", "Reduces radiation reaching the protected volume.", "Particle attenuation", "Hydrogen-rich materials are investigated because their nuclear interactions can make them useful shielding materials for certain space-radiation environments.", "panel", v(0, -110, 0), v(300, 28, 245), P.cyan),
      c("Polymer shielding tile", "Adds lightweight shielding material.", "Mass attenuation", "Layering different materials can change the way primary particles and secondary radiation interact before reaching crew systems.", "box", v(-112, -15, 55), v(78, 112, 75), P.gold),
      c("Radiation detector", "Measures the radiation field.", "Particle detection", "Radiation detectors convert interactions in a sensitive material into electrical pulses that can be counted or classified.", "box", v(40, 10, 105), v(58, 76, 58), P.violet),
      c("Protected electronics bay", "Defines a shielded region for sensitive hardware.", "Geometric shielding", "Protection depends on material, thickness, geometry, radiation spectrum and the location of the electronics or crew volume.", "box", v(0, 80, -10), v(155, 86, 120), P.body),
      c("Crew dosimeter node", "Measures dose at a representative crew location.", "Dosimetry", "Personal or area dosimeters provide measurements that can be accumulated over time to track radiation exposure.", "sphere", v(-88, 98, 80), v(30, 30, 30), P.red),
    ],
    upgrades: {
      Frontier: [
        c("Regolith shielding panel", "Represents local-material shielding.", "Areal-density design", "Using local regolith can provide substantial shielding mass after emplacement, reducing the need to transport equivalent material from Earth.", "panel", v(0, -140, -45), v(335, 35, 280), P.steel),
        c("Solar-particle-event shelter core", "Provides a more highly shielded crew refuge.", "Storm-shelter geometry", "A compact volume surrounded by extra shielding can lower exposure during intense solar-particle events compared with a uniformly shielded habitat.", "cylinder", v(0, 30, 0), v(175, 135, 175), P.gold),
      ],
      Apex: [
        c("Distributed radiation sensor network", "Maps the radiation field around the colony.", "Spatial sampling", "Multiple sensors can identify directional and temporal changes instead of relying on a single measurement point.", "sphere", v(130, 100, 95), v(46, 46, 46), P.violet),
        c("Automated shelter controller", "Changes crew-zone configuration during events.", "Event-triggered control", "A controller can combine sensor measurements with event thresholds and close the shelter or restrict access automatically.", "box", v(-128, 105, 70), v(82, 48, 66), P.blue),
      ],
      Research: [
        c("Adaptive shielding array", "Represents research into reconfigurable protection.", "Dynamic shielding management", "Future systems could combine movable shielding mass, habitat zoning and continuous sensing to place protection where exposure is highest.", "panel", v(0, -175, 40), v(380, 26, 300), P.cyan),
        c("Real-time dose model", "Predicts exposure across the colony.", "Radiation transport modelling", "A computational model can combine detector data, shielding geometry and event characteristics to estimate dose throughout protected spaces.", "sphere", v(135, 125, 30), v(52, 52, 52), P.orange),
      ],
    },
  },
  grid: {
    title: "Surface Power Distribution Grid",
    basis: "Based on lunar surface power architectures with generation, conversion, protected distribution and storage, including NASA fission-surface-power concepts.",
    flow: ["Generation", "Conversion", "DC distribution bus", "Protection", "Loads + storage"],
    base: [
      c("Generation node", "Provides the grid’s electrical source.", "Energy conversion", "A local grid can combine electrical generation sources with storage. The appropriate source depends on sunlight, mission location and reliability requirements.", "box", v(-125, 0, 0), v(105, 128, 105), P.gold),
      c("Power converter", "Regulates source and bus voltage.", "Power electronics", "Converters control voltage and current so different generators, storage units and loads can share a stable distribution network.", "box", v(0, 8, 0), v(105, 116, 92), P.blue),
      c("Distribution bus", "Transfers power to remote loads.", "Electrical conduction", "High-current conductors carry energy between nodes. Resistive heating scales with current squared times resistance, so distribution voltage and conductor mass matter.", "pipe", v(72, 18, -10), v(240, 26, 34), P.cyan),
      c("Fault-protection switchgear", "Disconnects failed branches.", "Circuit interruption", "Fast protection limits abnormal current and isolates a fault so other healthy branches can continue operating.", "box", v(92, 94, 45), v(86, 58, 72), P.copper),
      c("Battery storage node", "Buffers generation against demand.", "Load balancing", "Storage absorbs energy when generation exceeds the load and returns it when generation or distribution capacity falls.", "cylinder", v(-25, 100, 78), v(82, 135, 82), P.green),
    ],
    upgrades: {
      Frontier: [
        c("Ring-bus tie", "Creates an alternate route around a failed segment.", "Network redundancy", "A ring or meshed topology can preserve service to a load from the opposite direction after a cable or switchgear fault.", "pipe", v(0, -50, 90), v(260, 22, 30), P.green),
        c("Remote power node", "Extends controlled power distribution to distant loads.", "Distributed conversion", "Local conversion and protection can reduce losses and limit the impact of a fault far from the main power station.", "box", v(170, -35, 72), v(82, 80, 72), P.blue),
      ],
      Apex: [
        c("Fission surface power interface", "Represents integration of continuous nuclear generation.", "Nuclear-to-electric conversion", "NASA’s fission surface power work investigates compact systems capable of reliable lunar or Mars power independent of sunlight.", "box", v(-132, -75, 0), v(118, 95, 118), P.violet),
        c("Autonomous microgrid controller", "Balances sources, storage and critical loads.", "Optimal control", "Software can prioritize life support, communications and other mission-critical loads while shedding lower-priority demand during faults.", "sphere", v(55, 125, 80), v(50, 50, 50), P.violet),
      ],
      Research: [
        c("Multi-source power router", "Coordinates solar, storage and continuous generation.", "Bidirectional power routing", "A future colony grid could dynamically route power between diverse generation and storage nodes while maintaining protection boundaries.", "box", v(10, -100, 75), v(155, 68, 96), P.gold),
        c("Black-start recovery controller", "Rebuilds a collapsed grid automatically.", "Sequential grid restoration", "After a major fault, software can bring sources and loads back online in a controlled sequence rather than energising the entire network simultaneously.", "sphere", v(135, 115, 20), v(48, 48, 48), P.orange),
      ],
    },
  },
  science: {
    title: "Planetary Science Instrument Suite",
    basis: "Based on real planetary instruments: optical systems, spectrometers, detectors, sample handling and onboard calibration.",
    flow: ["Target / sample", "Collection", "Analyzer", "Detector", "Calibrated data"],
    base: [
      c("Collection optics", "Collects light or radiation from the target.", "Geometric optics", "Lenses, mirrors and apertures determine how much signal reaches the instrument and what spatial or spectral information is retained.", "cylinder", v(-110, 0, 0), v(78, 145, 78), P.steel),
      c("Spectral analyzer", "Separates signal by wavelength, energy or other property.", "Spectral dispersion", "Gratings, filters or related analyzers separate components of a signal so their physical signatures can be measured independently.", "box", v(0, 5, 20), v(110, 105, 92), P.gold),
      c("Detector array", "Converts the measured interaction into an electrical signal.", "Transduction", "A detector responds to photons, particles or heat and converts the physical interaction into measurable charge or current.", "panel", v(82, 12, 72), v(92, 10, 86), P.blue),
      c("Sample carousel", "Positions samples or targets repeatably.", "Precision mechanism", "A controlled mechanical positioner lets the instrument place different samples, standards or viewing directions in the measurement path.", "cylinder", v(70, -70, -62), v(72, 22, 72), P.copper),
      c("Calibration target", "Provides a known reference signal.", "Metrology", "Calibration links instrument output to a known standard and helps distinguish actual target changes from instrument drift.", "sphere", v(5, 92, 78), v(40, 40, 40), P.green),
    ],
    upgrades: {
      Frontier: [
        c("Cryogenic detector package", "Reduces thermal noise for sensitive measurements.", "Noise suppression", "Cooling a detector can reduce thermally generated noise, improving sensitivity when the mission requires extremely small signals.", "cylinder", v(125, 62, -20), v(62, 90, 62), P.cyan),
        c("Autonomous calibration wheel", "Performs repeated reference checks.", "Instrument self-calibration", "A reference sequence allows onboard software to track drift and compensate measurement data without relying on constant commands from Earth.", "cylinder", v(-50, -72, 68), v(54, 28, 54), P.green),
      ],
      Apex: [
        c("Miniature sample-handling arm", "Moves samples between preparation and measurement positions.", "Robotic kinematics", "A small precision manipulator adds controlled sample transfer and can support more complex analyses than a fixed sample port.", "antenna", v(75, 78, 30), v(28, 150, 28), P.violet),
        c("Onboard science processor", "Performs initial feature extraction and data triage.", "Edge computing", "Processing data near the instrument can identify high-value observations and reduce the amount of raw information that must be transmitted.", "box", v(-95, 92, 72), v(92, 55, 70), P.violet),
      ],
      Research: [
        c("Multi-modal analysis bench", "Combines optical, thermal and chemical measurements.", "Sensor fusion", "Combining complementary measurements can reduce ambiguity and produce a richer physical interpretation of a sample or environment.", "box", v(20, 120, -20), v(165, 58, 110), P.gold),
        c("Autonomous experiment planner", "Chooses the next measurement from scientific and resource constraints.", "Closed-loop science autonomy", "A future instrument can rank observations using target uncertainty, sample state and available power or time, then schedule measurements automatically.", "sphere", v(130, 118, 65), v(50, 50, 50), P.orange),
      ],
    },
  },
  navigation: {
    title: "Autonomous Guidance, Navigation & Control",
    basis: "Based on inertial sensing, optical navigation, guidance computers and autonomous terrain-relative navigation used in planetary missions.",
    flow: ["Sensors", "State estimate", "Map / orbit", "Guidance", "Actuators"],
    base: [
      c("Inertial measurement unit", "Measures acceleration and angular motion.", "Inertial sensing", "Accelerometers and gyroscopes provide high-rate motion information, allowing the navigation computer to propagate the vehicle state between external fixes.", "box", v(-105, 0, 0), v(92, 88, 82), P.steel),
      c("Optical navigation camera", "Observes terrain or celestial references.", "Computer vision", "Images of landmarks, terrain or celestial bodies can provide geometry that constrains position and attitude.", "cylinder", v(-10, -5, 62), v(58, 78, 58), P.blue),
      c("Navigation computer", "Fuses measurements into an estimated state.", "State estimation", "The computer combines sensor measurements with a motion model to estimate position, velocity and attitude despite noise and incomplete information.", "box", v(92, 18, 0), v(110, 112, 96), P.gold),
      c("Guidance solver", "Turns mission goals into a desired trajectory.", "Optimal guidance", "Guidance chooses the path and timing that satisfy constraints such as fuel, terrain, communication and arrival conditions.", "box", v(35, 98, 72), v(82, 48, 66), P.violet),
      c("Actuator interface", "Sends commands to wheels, thrusters or steering devices.", "Feedback control", "The controller compares desired and estimated states, then commands physical actuators to reduce navigation error.", "sphere", v(110, 98, 78), v(38, 38, 38), P.green),
    ],
    upgrades: {
      Frontier: [
        c("Star-tracker head", "Provides precision attitude reference from stars.", "Celestial navigation", "A star tracker identifies star patterns and uses them as an absolute reference for spacecraft attitude.", "cylinder", v(35, -75, 80), v(48, 86, 48), P.cyan),
        c("Dual-redundant IMU", "Maintains inertial data after a sensor fault.", "Redundant measurement", "Multiple inertial sensors can be cross-checked so one failed or biased unit does not immediately compromise navigation.", "box", v(-105, -82, 0), v(82, 68, 76), P.green),
      ],
      Apex: [
        c("Terrain-relative navigation camera", "Matches observed terrain against a stored map.", "Map-relative localisation", "NASA terrain-relative navigation systems compare observed terrain with a stored map to estimate position and avoid unsafe regions during planetary landing.", "cylinder", v(-20, -78, 70), v(62, 95, 62), P.violet),
        c("Hazard map processor", "Builds and updates a local traversability map.", "Probabilistic mapping", "Terrain observations can be transformed into a local map containing slopes, hazards and confidence estimates for the guidance planner.", "box", v(95, -78, 80), v(96, 54, 70), P.violet),
      ],
      Research: [
        c("Autonomous navigation stack", "Runs navigation with minimal Earth intervention.", "Multi-sensor autonomy", "A future surface vehicle can fuse inertial, optical, wheel and map data locally so delayed communications do not stop routine navigation.", "box", v(128, 88, 72), v(112, 62, 88), P.orange),
        c("Fault-tolerant estimator", "Maintains a state estimate through sensor failures.", "Robust estimation", "The estimator can down-weight or reject inconsistent sensors while continuing from the remaining independent measurements.", "sphere", v(-95, 112, 62), v(48, 48, 48), P.orange),
      ],
    },
  },
  rover: {
    title: "Planetary Rover Mobility & Autonomy",
    basis: "Based on NASA rover mobility engineering, including Perseverance’s six wheels, rocker-bogie suspension, grousers, wheel encoders and onboard autonomy.",
    flow: ["Electrical power", "Motor", "Gear reduction", "Wheel + suspension", "Terrain"],
    base: [
      c("Rocker arm", "Carries wheels over uneven terrain.", "Suspension kinematics", "A rocker-bogie suspension links the wheels so the chassis can maintain contact while crossing rocks and depressions.", "box", v(0, 35, 0), v(255, 22, 46), P.steel),
      c("Mobility wheel set", "Transmits torque into regolith.", "Traction + slip", "NASA planetary rover wheels use cleats or grousers to improve traction. Actual motion depends on soil strength, normal load and slip.", "wheel", v(-145, 55, 72), v(58, 72, 58), P.steel),
      c("Drive actuator", "Provides wheel torque.", "Electromechanical conversion", "An electric motor converts electrical power into shaft torque, which is then delivered through a reduction stage to the wheel.", "cylinder", v(0, 15, 70), v(58, 82, 58), P.copper),
      c("Differential", "Balances rocker motion across the chassis.", "Passive suspension geometry", "A differential links left and right rocker assemblies, allowing articulation while controlling relative chassis roll.", "cylinder", v(0, -20, 0), v(52, 70, 52), P.gold),
      c("Wheel encoder", "Measures wheel rotation for odometry.", "Rotational sensing", "Encoders report angular motion. Because wheels can slip, wheel odometry is normally combined with other navigation measurements.", "sphere", v(145, 72, -70), v(28, 28, 28), P.blue),
    ],
    upgrades: {
      Frontier: [
        c("Adaptive suspension linkage", "Improves contact over larger obstacles.", "Load redistribution", "Additional compliance or active adjustment can distribute wheel loads and maintain traction as the rover traverses rough terrain.", "box", v(0, 10, -62), v(225, 18, 34), P.green),
        c("High-efficiency geartrain", "Reduces actuator losses.", "Torque-speed transformation", "Reduction gearing trades wheel speed for wheel torque, allowing small electric motors to generate useful tractive force.", "cylinder", v(0, 18, -85), v(54, 74, 54), P.gold),
      ],
      Apex: [
        c("Hazard-detection camera mast", "Looks ahead for terrain hazards.", "Perception", "Stereo or multi-angle imagery gives the autonomy system depth and shape information needed to plan a safe route.", "antenna", v(85, -70, 0), v(34, 175, 34), P.violet),
        c("Autonomous wheel-slip controller", "Adjusts torque when wheels begin to spin.", "Feedback control", "Slip estimates can be used to reduce torque or change wheel commands before the rover digs itself into loose terrain.", "box", v(-75, -75, 65), v(92, 52, 70), P.violet),
      ],
      Research: [
        c("Per-wheel terrain estimator", "Infers local soil conditions from each wheel.", "Terramechanics estimation", "A future rover could combine motor current, wheel speed and slip to estimate how the terrain is supporting each wheel.", "sphere", v(-120, 110, 72), v(46, 46, 46), P.orange),
        c("Autonomous mobility planner", "Optimizes route for energy, traction and science value.", "Constrained planning", "Instead of simply avoiding obstacles, the planner can trade slope, energy, wheel slip, communications and scientific objectives when choosing routes.", "box", v(90, 108, 70), v(115, 60, 82), P.orange),
      ],
    },
  },
  extraction: {
    title: "Subsurface Regolith / Ice Excavation Rig",
    basis: "Based on planetary drilling, rotary-percussive excavation, material transport and subsurface sensing concepts used in NASA exploration technology.",
    flow: ["Regolith / ice", "Drill bit", "Cuttings transport", "Collector", "Processing"],
    base: [
      c("Drill mast", "Supports and feeds the excavation tool.", "Axial load mechanics", "The mast carries drilling reaction forces and controls the depth or feed rate of the tool into the substrate.", "cylinder", v(0, -25, 0), v(62, 190, 62), P.steel),
      c("Cutting head", "Fractures and removes material.", "Cutting / fracture mechanics", "The tool geometry determines how force and torque are applied to rock, regolith or ice and controls the size and energy cost of excavation.", "cylinder", v(0, 105, 0), v(88, 58, 88), P.gold),
      c("Auger transport shaft", "Moves cuttings away from the cutting face.", "Granular transport", "Helical flighting can lift granular material as the shaft rotates, moving cuttings toward a collector without a separate conveyor.", "cylinder", v(65, 10, 45), v(48, 165, 48), P.copper),
      c("Sample hopper", "Collects the excavated material.", "Material handling", "The hopper buffers the excavation flow so downstream processing can operate at a controlled rate.", "box", v(120, 70, 0), v(105, 105, 105), P.blue),
      c("Subsurface sensor head", "Measures conditions at the excavation front.", "In-situ sensing", "Depth, temperature, load or material-response measurements can help identify where useful deposits or difficult layers are encountered.", "sphere", v(-68, 95, 62), v(36, 36, 36), P.green),
    ],
    upgrades: {
      Frontier: [
        c("Rotary-percussive actuator", "Adds impact energy to hard material.", "Percussive drilling", "Periodic impacts can fracture hard material while rotation removes the loosened material, reducing the continuous cutting load.", "cylinder", v(0, -70, 75), v(70, 82, 70), P.violet),
        c("Cuttings separator", "Separates coarse material before processing.", "Particle-size separation", "Screens or separators can remove unwanted particle sizes and protect downstream equipment from large fragments.", "box", v(125, -10, 78), v(100, 62, 80), P.green),
      ],
      Apex: [
        c("Cryogenic drilling stage", "Represents hardware for colder subsurface deposits.", "Low-temperature material mechanics", "Ice-rich deposits can behave differently from dry regolith. Thermal control and tool geometry become critical when working in cold subsurface material.", "cylinder", v(-95, 70, 70), v(64, 115, 64), P.cyan),
        c("Autonomous drilling controller", "Adjusts rate and torque from tool feedback.", "Adaptive control", "Motor current, vibration, depth and penetration rate can be used to adjust drilling commands when the material changes.", "box", v(-120, -40, 75), v(92, 58, 72), P.violet),
      ],
      Research: [
        c("Integrated ice-processing head", "Combines excavation and first-stage volatile capture.", "Integrated resource extraction", "An advanced concept can reduce the number of transfer steps by capturing or conditioning volatile-bearing material close to the excavation interface.", "cylinder", v(0, 118, 0), v(105, 66, 105), P.gold),
        c("Subsurface tomography module", "Maps material properties ahead of the cutter.", "Geophysical imaging", "Geophysical sensing can estimate subsurface boundaries before full excavation, reducing unnecessary drilling and helping target promising deposits.", "sphere", v(-100, 105, -60), v(50, 50, 50), P.orange),
      ],
    },
  },
  isru: {
    title: "In-Situ Resource Utilization Processing Plant",
    basis: "Based on NASA ISRU concepts for using local water, atmospheric CO₂ and oxygen-bearing planetary materials rather than launching every consumable from Earth.",
    flow: ["Local resource", "Feed system", "Reaction / separation", "Product storage", "Colony use"],
    base: [
      c("Feed hopper", "Introduces local solid or granular material.", "Material handling", "A controlled feed prevents a processing reactor from being overloaded and makes the resource flow measurable.", "box", v(-125, 20, 0), v(112, 125, 112), P.steel),
      c("Process reactor", "Transforms or releases useful constituents.", "Thermochemistry / electrochemistry", "ISRU processes can use heat, chemical reactions or electrochemical reactions to separate useful products from local material.", "cylinder", v(0, 20, 0), v(100, 155, 100), P.gold),
      c("Product separator", "Separates useful output from waste.", "Phase / mass separation", "The desired product must be separated from residual solids, gases or liquids before storage or use.", "box", v(90, 18, 45), v(90, 112, 80), P.blue),
      c("Product storage tank", "Buffers production for downstream users.", "Mass balance", "Storage decouples processing rate from the rate at which propellant, oxygen, water or other products are consumed.", "cylinder", v(150, 100, -5), v(70, 130, 70), P.cyan),
      c("Process controller", "Regulates temperature, pressure and flow.", "Feedback control", "Sensors close the loop around the process so feed rate, heat input and valve position remain within safe operating limits.", "box", v(-35, 105, 70), v(82, 52, 70), P.green),
    ],
    upgrades: {
      Frontier: [
        c("Heat-recovery exchanger", "Recovers process heat.", "Energy recycling", "Exchanging heat between hot products and incoming feed reduces the external energy required per unit of processed material.", "cylinder", v(-100, -45, 65), v(52, 90, 52), P.copper),
        c("Dust-separation cyclone", "Removes fine particles from gas streams.", "Inertial separation", "A cyclone uses swirling flow to drive particles toward the wall so they can be removed from a moving gas stream.", "cylinder", v(92, -65, 80), v(58, 92, 58), P.steel),
      ],
      Apex: [
        c("Electrochemical oxygen module", "Adds oxygen production from an appropriate feedstock.", "Electrolysis", "Electrochemical systems can separate oxygen from compounds such as water or carbon dioxide when sufficient electrical energy is supplied.", "box", v(0, -78, -75), v(122, 72, 95), P.violet),
        c("Autonomous process optimizer", "Adjusts operating conditions for yield and power.", "Optimization control", "Software can trade throughput, power use, product purity and equipment temperature rather than running each subsystem at fixed settings.", "sphere", v(126, 105, 72), v(48, 48, 48), P.violet),
      ],
      Research: [
        c("Molten-regolith electrolysis chamber", "Represents an advanced oxygen / metals extraction concept.", "High-temperature electrochemistry", "Molten-regolith electrolysis can separate oxygen and useful metals from lunar soil at high temperature. The architecture is developmental and demanding in materials and power.", "cylinder", v(-10, 95, -5), v(120, 170, 120), P.gold),
        c("Closed-loop product analyser", "Measures multiple products continuously.", "Mass-spectrometric process monitoring", "Continuous composition measurements allow the plant to detect changes in feedstock and adjust separation or reaction conditions before product quality drifts.", "box", v(125, 115, 75), v(98, 58, 80), P.orange),
      ],
    },
  },
  agriculture: {
    title: "Controlled-Environment Agriculture Module",
    basis: "Based on controlled-environment agriculture, hydroponic root zones, LED lighting, environmental control and plant-growth research for spaceflight.",
    flow: ["Power + photons", "Root zone", "Plant canopy", "CO₂ / humidity control", "Food + biomass"],
    base: [
      c("LED grow canopy", "Supplies photosynthetically useful light.", "Photosynthesis", "Plants use absorbed photons to drive photosynthetic reactions. LEDs allow light intensity and spectral content to be controlled without sunlight.", "panel", v(0, -95, 0), v(260, 18, 165), P.gold),
      c("Hydroponic root trays", "Deliver water and nutrients to plants.", "Mass transport", "A controlled root zone supplies water, dissolved nutrients and oxygen while limiting the amount of free water that can escape into the cabin.", "panel", v(0, 65, 0), v(235, 24, 150), P.green),
      c("Nutrient reservoir", "Stores and meters the plant solution.", "Fluid balance", "A reservoir buffers nutrient concentration and provides a controlled source for pumps and irrigation lines.", "cylinder", v(-120, 95, 62), v(58, 92, 58), P.blue),
      c("Air circulation duct", "Controls air movement through the canopy.", "Convection + mass transfer", "Moving air helps manage temperature, boundary-layer thickness, humidity and CO₂ availability around leaves.", "pipe", v(120, 10, 35), v(210, 24, 28), P.cyan),
      c("Climate sensor cluster", "Measures growth-environment conditions.", "Feedback control", "Temperature, humidity, CO₂ and light measurements let controllers maintain a target crop environment and detect condensation or stress.", "sphere", v(95, 85, 78), v(34, 34, 34), P.green),
    ],
    upgrades: {
      Frontier: [
        c("Recirculating nutrient pump", "Returns solution through the root zone.", "Closed-loop fluid circulation", "Recirculation reduces water loss and keeps dissolved nutrients moving instead of relying on single-pass irrigation.", "cylinder", v(-95, 20, 82), v(48, 72, 48), P.copper),
        c("Condensate recovery coil", "Captures water leaving the crop as humidity.", "Condensation", "Plant transpiration adds water vapour to the cabin atmosphere. Cooling a surface below the dew point condenses part of that water for recovery.", "panel", v(115, -10, -65), v(110, 14, 90), P.blue),
      ],
      Apex: [
        c("Spectral lighting controller", "Tunes LED intensity and spectrum to crop requirements.", "Photon management", "Different wavelengths can affect photosynthesis and plant morphology. A controlled system can vary the light recipe instead of operating one fixed spectrum.", "box", v(0, -150, 55), v(150, 52, 82), P.violet),
        c("Autonomous crop camera", "Tracks plant growth and detects visible stress.", "Machine vision", "Images can be compared over time to estimate canopy growth, leaf state and anomalies before they become obvious to a human operator.", "cylinder", v(92, -45, 85), v(42, 62, 42), P.violet),
      ],
      Research: [
        c("Multi-layer vertical farm", "Stacks crop planes to increase food output per floor area.", "Controlled-environment scaling", "Vertical growing layers can raise production density but require careful light distribution, airflow, thermal management and nutrient balancing.", "panel", v(0, 5, -85), v(255, 210, 16), P.gold),
        c("Autonomous nutrient-balancing node", "Adjusts nutrient concentration and water flow.", "Closed-loop agronomy control", "Sensor measurements can be compared with crop targets so nutrient strength, irrigation rate and recirculation are adjusted automatically.", "sphere", v(-130, 125, -45), v(50, 50, 50), P.orange),
      ],
    },
  },
  maintenance: {
    title: "Robotic Inspection & Maintenance System",
    basis: "Based on robotic servicing concepts, precision manipulators, machine vision, torque sensing and autonomous fault detection.",
    flow: ["Inspect", "Diagnose", "Position", "Service", "Verify"],
    base: [
      c("Manipulator base", "Anchors the robotic arm to the service deck.", "Structural load transfer", "The base reacts the arm’s joint and tool forces into the vehicle or habitat structure while maintaining precise alignment.", "cylinder", v(80, 58, 0), v(82, 95, 82), P.steel),
      c("Shoulder / elbow joints", "Provides multi-axis arm motion.", "Robot kinematics", "Rotating joints place the end effector at a desired position and orientation while the controller avoids mechanical limits.", "cylinder", v(55, -10, 0), v(48, 175, 48), P.blue),
      c("Inspection camera", "Provides visual condition information.", "Machine vision", "Cameras can reveal damaged insulation, connector state, contamination, fastener condition and other visible maintenance indicators.", "sphere", v(-35, -120, 65), v(48, 48, 48), P.cyan),
      c("Tool changer", "Switches between maintenance tools.", "Mechanical coupling", "A standardized tool interface allows one manipulator to perform different tasks rather than dedicating a separate robot to each job.", "box", v(-28, -105, 0), v(64, 62, 64), P.copper),
      c("Force / torque sensor", "Measures mechanical interaction with the workpiece.", "Force feedback", "Force sensing lets the controller detect contact, binding and abnormal resistance instead of relying only on position.", "sphere", v(-32, -145, -52), v(36, 36, 36), P.green),
    ],
    upgrades: {
      Frontier: [
        c("Linear service axis", "Extends reach along a rail or track.", "Prismatic robot motion", "A rail adds translational workspace without making the arm itself excessively long or heavy.", "pipe", v(0, 88, -82), v(280, 22, 26), P.green),
        c("Automatic tool magazine", "Stores multiple end effectors.", "Tool automation", "A magazine lets the robot swap drills, grippers, drivers, cameras and other task-specific tools without human intervention.", "box", v(160, 95, 58), v(105, 110, 90), P.gold),
      ],
      Apex: [
        c("Dexterous service wrist", "Adds fine orientation and manipulation capability.", "Redundant kinematics", "Multiple small joints allow the end effector to approach connectors and fasteners from constrained angles while controlling applied force.", "cylinder", v(-28, -150, -10), v(42, 70, 42), P.violet),
        c("Predictive inspection computer", "Finds developing faults from sensor data.", "Condition monitoring", "Images, motor current, force signatures and equipment telemetry can be compared against expected behaviour to flag maintenance needs.", "box", v(155, 12, 65), v(98, 58, 78), P.violet),
      ],
      Research: [
        c("Autonomous repair planner", "Creates and verifies multi-step maintenance sequences.", "Task-level autonomy", "A high-level planner can sequence inspection, tool selection, manipulation and verification while stopping when observations disagree with the expected state.", "sphere", v(165, 118, 72), v(50, 50, 50), P.orange),
        c("Self-calibrating force module", "Maintains accurate force measurements over time.", "Online calibration", "The sensor system can compare known reference motions and loads with measured output, helping preserve manipulation accuracy over long service intervals.", "box", v(70, 110, 78), v(84, 44, 65), P.orange),
      ],
    },
  },
};

function derivedArchitecture(track: TechnologyTrack, tier: Tier): Architecture {
  const source = architectureBase[track.id] ?? architectureBase.solar;
  const level = TIER_LEVEL[tier];
  const parts = [
    ...source.base,
    ...(level >= 2 ? source.upgrades.Frontier : []),
    ...(level >= 3 ? source.upgrades.Apex : []),
    ...(level >= 4 ? source.upgrades.Research : []),
  ];
  const scale = 0.84 + level * 0.045;
  const scaled = parts.map((part) => ({
    ...part,
    center: v(
      part.center.x * scale,
      part.center.y * scale,
      part.center.z * scale,
    ),
    size: v(
      part.size.x * scale,
      part.size.y * scale,
      part.size.z * scale,
    ),
  }));

  return {
    title: source.title,
    basis: source.basis,
    flow: source.flow,
    parts: scaled,
    tierNote: TIER_NAMES[tier],
  };
}

function rotatePoint(p: Vec3, rotation: { x: number; y: number }) {
  const ry = rotation.y * Math.PI / 180;
  const rx = rotation.x * Math.PI / 180;
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const x1 = p.x * cy - p.z * sy;
  const z1 = p.x * sy + p.z * cy;
  return {
    x: x1,
    y: p.y * cx - z1 * sx,
    z: p.y * sx + z1 * cx,
  };
}

function project(
  p: Vec3,
  rotation: { x: number; y: number },
  zoom: number,
  width: number,
  height: number,
) {
  const r = rotatePoint(p, rotation);
  const camera = 780;
  const scale = camera / Math.max(280, camera - r.z);
  return {
    x: width / 2 + r.x * scale * zoom,
    y: height / 2 + r.y * scale * zoom,
    depth: r.z,
    scale,
  };
}

function rgba(hex: string, alpha: number) {
  const n = hex.replace("#", "");
  const value = parseInt(n, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  part: ComponentSpec,
  rotation: { x: number; y: number },
  zoom: number,
  width: number,
  height: number,
  offset: Vec3,
  active: boolean,
) {
  const sx = part.size.x / 2;
  const sy = part.size.y / 2;
  const sz = part.size.z / 2;
  const corners = [
    v(-sx, -sy, -sz), v(sx, -sy, -sz), v(sx, sy, -sz), v(-sx, sy, -sz),
    v(-sx, -sy, sz), v(sx, -sy, sz), v(sx, sy, sz), v(-sx, sy, sz),
  ].map((p) => v(
    p.x + part.center.x + offset.x,
    p.y + part.center.y + offset.y,
    p.z + part.center.z + offset.z,
  ));
  const pts = corners.map((p) => project(p, rotation, zoom, width, height));
  const faces = [
    { ids: [0, 1, 2, 3], shade: 0.52 },
    { ids: [4, 7, 6, 5], shade: 0.87 },
    { ids: [0, 4, 5, 1], shade: 0.70 },
    { ids: [1, 5, 6, 2], shade: 0.80 },
    { ids: [2, 6, 7, 3], shade: 0.62 },
    { ids: [4, 0, 3, 7], shade: 0.42 },
  ];
  faces.sort((a, b) => {
    const za = a.ids.reduce((sum, i) => sum + pts[i].depth, 0) / 4;
    const zb = b.ids.reduce((sum, i) => sum + pts[i].depth, 0) / 4;
    return za - zb;
  });
  for (const face of faces) {
    ctx.beginPath();
    face.ids.forEach((i, index) => {
      if (index === 0) ctx.moveTo(pts[i].x, pts[i].y);
      else ctx.lineTo(pts[i].x, pts[i].y);
    });
    ctx.closePath();
    ctx.fillStyle = rgba(part.color, face.shade);
    ctx.fill();
    ctx.strokeStyle = active ? P.white : rgba(P.white, 0.26);
    ctx.lineWidth = active ? 2.6 : 0.9;
    ctx.stroke();
  }
  if (active) {
    const cp = project(v(part.center.x + offset.x, part.center.y + offset.y, part.center.z + offset.z), rotation, zoom, width, height);
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, Math.max(12, 20 * cp.scale * zoom), 0, Math.PI * 2);
    ctx.strokeStyle = rgba(P.white, 0.36);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  part: ComponentSpec,
  rotation: { x: number; y: number },
  zoom: number,
  width: number,
  height: number,
  offset: Vec3,
  active: boolean,
) {
  const sx = part.size.x / 2;
  const sy = part.size.y / 2;
  const sz = part.size.z / 2;
  const corners = [
    v(-sx, -sy, -sz), v(sx, -sy, -sz), v(sx, sy, -sz), v(-sx, sy, -sz),
    v(-sx, -sy, sz), v(sx, -sy, sz), v(sx, sy, sz), v(-sx, sy, sz),
  ].map((p) => v(
    p.x + part.center.x + offset.x,
    p.y + part.center.y + offset.y,
    p.z + part.center.z + offset.z,
  ));
  const pts = corners.map((p) => project(p, rotation, zoom, width, height));
  ctx.beginPath();
  [0, 1, 2, 3].forEach((i, index) => {
    if (index === 0) ctx.moveTo(pts[i].x, pts[i].y);
    else ctx.lineTo(pts[i].x, pts[i].y);
  });
  ctx.closePath();
  ctx.fillStyle = rgba(part.color, active ? 0.78 : 0.60);
  ctx.fill();
  ctx.strokeStyle = active ? P.white : rgba(P.white, 0.38);
  ctx.lineWidth = active ? 2.6 : 1;
  ctx.stroke();
  for (let i = 1; i < 9; i += 1) {
    const t = i / 9;
    const a = { x: pts[0].x + (pts[1].x - pts[0].x) * t, y: pts[0].y + (pts[1].y - pts[0].y) * t };
    const b = { x: pts[3].x + (pts[2].x - pts[3].x) * t, y: pts[3].y + (pts[2].y - pts[3].y) * t };
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = rgba(P.white, 0.18);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function drawCylinder(
  ctx: CanvasRenderingContext2D,
  part: ComponentSpec,
  rotation: { x: number; y: number },
  zoom: number,
  width: number,
  height: number,
  offset: Vec3,
  active: boolean,
) {
  const radius = part.size.x / 2;
  const halfHeight = part.size.y / 2;
  const top = project(v(part.center.x + offset.x, part.center.y - halfHeight + offset.y, part.center.z + offset.z), rotation, zoom, width, height);
  const bottom = project(v(part.center.x + offset.x, part.center.y + halfHeight + offset.y, part.center.z + offset.z), rotation, zoom, width, height);
  const rx = radius * top.scale * zoom;
  const ry = Math.max(5, radius * 0.35 * top.scale * zoom);
  ctx.fillStyle = rgba(part.color, active ? 0.82 : 0.70);
  ctx.beginPath();
  ctx.ellipse(top.x, top.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(part.color, 0.56);
  ctx.fillRect(top.x - rx, top.y, rx * 2, bottom.y - top.y);
  ctx.fillStyle = rgba(part.color, 0.66);
  ctx.beginPath();
  ctx.ellipse(bottom.x, bottom.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = active ? P.white : rgba(P.white, 0.30);
  ctx.lineWidth = active ? 2.4 : 1;
  ctx.stroke();
}

function drawDish(
  ctx: CanvasRenderingContext2D,
  part: ComponentSpec,
  rotation: { x: number; y: number },
  zoom: number,
  width: number,
  height: number,
  offset: Vec3,
  active: boolean,
) {
  const p = project(v(part.center.x + offset.x, part.center.y + offset.y, part.center.z + offset.z), rotation, zoom, width, height);
  const r = part.size.x * 0.5 * p.scale * zoom;
  ctx.fillStyle = rgba(part.color, active ? 0.76 : 0.62);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * 0.48, rotation.y * Math.PI / 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = active ? P.white : rgba(P.white, 0.40);
  ctx.lineWidth = active ? 2.8 : 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x, p.y - r * 0.72);
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x, p.y - r * 0.72, Math.max(3, r * 0.08), 0, Math.PI * 2);
  ctx.fillStyle = P.gold;
  ctx.fill();
}

function drawWheel(
  ctx: CanvasRenderingContext2D,
  part: ComponentSpec,
  rotation: { x: number; y: number },
  zoom: number,
  width: number,
  height: number,
  offset: Vec3,
  active: boolean,
) {
  const p = project(v(part.center.x + offset.x, part.center.y + offset.y, part.center.z + offset.z), rotation, zoom, width, height);
  const r = part.size.x * 0.5 * p.scale * zoom;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(0.12 + rotation.x * Math.PI / 240);
  ctx.fillStyle = rgba(part.color, active ? 0.84 : 0.70);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.66, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = active ? P.white : rgba(P.white, 0.34);
  ctx.lineWidth = active ? 2.6 : 1;
  ctx.stroke();
  ctx.fillStyle = P.dark;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.26, r * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 12; i += 1) {
    const a = i * Math.PI * 2 / 12;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.68);
    ctx.lineTo(Math.cos(a) * r * 0.54, Math.sin(a) * r * 0.92);
    ctx.strokeStyle = rgba(P.gold, 0.55);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSphere(
  ctx: CanvasRenderingContext2D,
  part: ComponentSpec,
  rotation: { x: number; y: number },
  zoom: number,
  width: number,
  height: number,
  offset: Vec3,
  active: boolean,
) {
  const p = project(v(part.center.x + offset.x, part.center.y + offset.y, part.center.z + offset.z), rotation, zoom, width, height);
  const r = part.size.x * 0.5 * p.scale * zoom;
  const gradient = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.12, p.x, p.y, r);
  gradient.addColorStop(0, P.white);
  gradient.addColorStop(0.18, part.color);
  gradient.addColorStop(1, P.dark);
  ctx.fillStyle = gradient;
  ctx.globalAlpha = active ? 0.95 : 0.78;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = active ? P.white : rgba(P.white, 0.30);
  ctx.lineWidth = active ? 2.4 : 1;
  ctx.stroke();
}

function drawAntenna(
  ctx: CanvasRenderingContext2D,
  part: ComponentSpec,
  rotation: { x: number; y: number },
  zoom: number,
  width: number,
  height: number,
  offset: Vec3,
  active: boolean,
) {
  const a = project(v(part.center.x + offset.x, part.center.y + part.size.y / 2 + offset.y, part.center.z + offset.z), rotation, zoom, width, height);
  const b = project(v(part.center.x + offset.x, part.center.y - part.size.y / 2 + offset.y, part.center.z + offset.z), rotation, zoom, width, height);
  ctx.strokeStyle = active ? P.white : rgba(P.steel, 0.72);
  ctx.lineWidth = Math.max(5, part.size.x * 0.18 * a.scale * zoom);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.fillStyle = part.color;
  ctx.beginPath();
  ctx.arc(b.x, b.y, Math.max(4, part.size.x * 0.32 * b.scale * zoom), 0, Math.PI * 2);
  ctx.fill();
}

function drawPipe(
  ctx: CanvasRenderingContext2D,
  part: ComponentSpec,
  rotation: { x: number; y: number },
  zoom: number,
  width: number,
  height: number,
  offset: Vec3,
  active: boolean,
) {
  const start = project(v(part.center.x - part.size.x / 2 + offset.x, part.center.y + offset.y, part.center.z + offset.z), rotation, zoom, width, height);
  const end = project(v(part.center.x + part.size.x / 2 + offset.x, part.center.y + offset.y, part.center.z + offset.z), rotation, zoom, width, height);
  ctx.strokeStyle = active ? P.white : rgba(part.color, 0.78);
  ctx.lineWidth = Math.max(7, part.size.y * start.scale * zoom);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.lineCap = "butt";
}

function drawPart(
  ctx: CanvasRenderingContext2D,
  part: ComponentSpec,
  rotation: { x: number; y: number },
  zoom: number,
  width: number,
  height: number,
  offset: Vec3,
  active: boolean,
) {
  if (part.shape === "panel") drawPanel(ctx, part, rotation, zoom, width, height, offset, active);
  else if (part.shape === "cylinder") drawCylinder(ctx, part, rotation, zoom, width, height, offset, active);
  else if (part.shape === "dish") drawDish(ctx, part, rotation, zoom, width, height, offset, active);
  else if (part.shape === "wheel") drawWheel(ctx, part, rotation, zoom, width, height, offset, active);
  else if (part.shape === "sphere") drawSphere(ctx, part, rotation, zoom, width, height, offset, active);
  else if (part.shape === "antenna") drawAntenna(ctx, part, rotation, zoom, width, height, offset, active);
  else if (part.shape === "pipe") drawPipe(ctx, part, rotation, zoom, width, height, offset, active);
  else drawBox(ctx, part, rotation, zoom, width, height, offset, active);
}

function CanvasSystem({
  architecture,
  selected,
  setSelected,
  isolateIndex,
}: {
  architecture: Architecture;
  selected: number;
  setSelected: (index: number) => void;
  isolateIndex?: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState({ x: -16, y: -28 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const zoomRef = useRef(1);
  const hitTargets = useRef<{ index: number; x: number; y: number; r: number }[]>([]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const width = rect.width;
      const height = rect.height;

      const bg = ctx.createRadialGradient(width * 0.5, height * 0.42, 15, width * 0.5, height * 0.5, Math.max(width, height) * 0.74);
      bg.addColorStop(0, "#173b45");
      bg.addColorStop(0.44, "#0a1c24");
      bg.addColorStop(1, "#03090d");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(126,174,169,.10)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const all = architecture.parts
        .map((part, index) => ({ part, index }))
        .filter((item) => isolateIndex == null || item.index === isolateIndex);

      const explodeFactor = isolateIndex == null ? 1 : 0.42;
      hitTargets.current = [];

      const ordered = [...all].sort((a, b) => {
        return rotatePoint(a.part.center, rotation).z - rotatePoint(b.part.center, rotation).z;
      });

      ordered.forEach(({ part, index }) => {
        const radial = rotatePoint(part.center, { x: 0, y: 0 });
        const offset = isolateIndex == null
          ? v(radial.x * 0.03 * (TIER_LEVELFromArchitecture(architecture) - 1), radial.y * 0.02 * (TIER_LEVELFromArchitecture(architecture) - 1), radial.z * 0.03 * (TIER_LEVELFromArchitecture(architecture) - 1))
          : v((part.center.x - radial.x) * explodeFactor, (part.center.y - radial.y) * explodeFactor, (part.center.z - radial.z) * explodeFactor);

        const center = project(
          v(part.center.x + offset.x, part.center.y + offset.y, part.center.z + offset.z),
          rotation,
          zoom,
          width,
          height,
        );
        const targetRadius = Math.max(
          20,
          Math.min(58, Math.max(part.size.x, part.size.y, part.size.z) * 0.21 * center.scale * zoom),
        );
        hitTargets.current.push({ index, x: center.x, y: center.y, r: targetRadius });
        drawPart(ctx, part, rotation, zoom, width, height, offset, index === selected);
      });

      ctx.fillStyle = "#9bd6d5";
      ctx.font = "700 10px monospace";
      ctx.fillText(isolateIndex == null ? "SYSTEM / INTERACTIVE 3D" : "COMPONENT / ISOLATED 3D", 18, 23);
      ctx.fillStyle = "rgba(220,235,230,.58)";
      ctx.font = "10px monospace";
      ctx.fillText("DRAG ROTATE   •   WHEEL ZOOM   •   CLICK A PART", 18, height - 18);

      if (isolateIndex != null) {
        ctx.fillStyle = rgba(P.gold, 0.88);
        ctx.font = "700 11px monospace";
        ctx.fillText(architecture.parts[isolateIndex]?.name.toUpperCase() ?? "COMPONENT", 18, 44);
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setZoom((value) => Math.max(0.45, Math.min(2.15, value - event.deltaY * 0.00115)));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      observer.disconnect();
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [architecture, selected, rotation, zoom, isolateIndex]);

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    moved.current = false;
    setDragging(true);
    lastPointer.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!dragging) return;
    const dx = event.clientX - lastPointer.current.x;
    const dy = event.clientY - lastPointer.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
    setRotation((value) => ({
      x: Math.max(-78, Math.min(78, value.x - dy * 0.34)),
      y: value.y + dx * 0.34,
    }));
    lastPointer.current = { x: event.clientX, y: event.clientY };
  }

  function pointerUp(event: PointerEvent<HTMLCanvasElement>) {
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function click(event: PointerEvent<HTMLCanvasElement>) {
    if (moved.current || isolateIndex != null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hits = hitTargets.current
      .map((target) => ({
        ...target,
        distance: Math.hypot(target.x - x, target.y - y),
      }))
      .sort((a, b) => a.distance - b.distance);
    const hit = hits.find((target) => target.distance <= target.r);
    if (hit) setSelected(hit.index);
  }

  return (
    <div className="overflow-hidden border border-[#29434a] bg-[#061017]">
      <div className="flex items-center justify-between border-b border-[#29434a] bg-[#08151b] px-4 py-3">
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.16em] text-[#a8bdb7]">
          <Rotate3D className="h-4 w-4" style={{ color: tierMeta[getTierFromArchitecture(architecture)].color }} />
          Category-specific engineering assembly
        </div>
        <div className="text-[9px] uppercase tracking-[.13em]" style={{ color: tierMeta[getTierFromArchitecture(architecture)].color }}>
          {TIER_LEVELFromArchitecture(architecture)}/4 · {getTierFromArchitecture(architecture)}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="block h-[570px] w-full touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onClick={click}
      />
      {!isolateIndex && (
        <div className="grid border-t border-[#29434a] bg-[#09151b] sm:grid-cols-2 lg:grid-cols-3">
          {architecture.parts.map((part, index) => (
            <button
              key={part.name}
              type="button"
              onClick={() => setSelected(index)}
              className={
                "border-r border-b border-[#29434a] px-3 py-3 text-left transition-colors " +
                (selected === index ? "bg-[#162d31]" : "hover:bg-[#0e2228]")
              }
            >
              <p className="text-[8px] font-bold uppercase tracking-[.16em]" style={{ color: tierMeta[getTierFromArchitecture(architecture)].color }}>
                COMPONENT {String(index + 1).padStart(2, "0")}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[.06em] text-[#dce7df]">{part.name}</p>
              <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-[#718c87]">{part.role}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TIER_LEVELFromArchitecture(architecture: Architecture) {
  return architecture.tierNote === TIER_NAMES.Foundation ? 1
    : architecture.tierNote === TIER_NAMES.Frontier ? 2
    : architecture.tierNote === TIER_NAMES.Apex ? 3
    : 4;
}

function getTierFromArchitecture(architecture: Architecture): Tier {
  return architecture.tierNote === TIER_NAMES.Foundation ? "Foundation"
    : architecture.tierNote === TIER_NAMES.Frontier ? "Frontier"
    : architecture.tierNote === TIER_NAMES.Apex ? "Apex"
    : "Research";
}

function ComponentDetail({
  architecture,
  part,
  index,
  tier,
  onClose,
}: {
  architecture: Architecture;
  part: ComponentSpec;
  index: number;
  tier: Tier;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#010609]/95 p-4 backdrop-blur-md" onClick={onClose}>
      <div
        className="max-h-[94vh] w-full max-w-6xl overflow-y-auto border border-[#4f6965] bg-[#08161d] shadow-[0_35px_120px_rgba(0,0,0,.88)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#29434a] bg-[#0b2027] p-5 md:p-7">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.22em]" style={{ color: tierMeta[tier].color }}>
              Component {String(index + 1).padStart(2, "0")} · {tier} · Isolated engineering view
            </p>
            <h2 className="mt-2 text-2xl font-semibold uppercase tracking-[.1em] text-[#eef3e7]">{part.name}</h2>
            <p className="mt-2 max-w-3xl text-sm text-[#72b9d4]">{part.role}</p>
          </div>
          <button type="button" onClick={onClose} className="border border-[#435d5a] p-2 text-[#b8cbc4] hover:border-[#efb658]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1.2fr)_360px] md:p-7">
          <div>
            <CanvasSystem
              architecture={architecture}
              selected={index}
              setSelected={() => undefined}
              isolateIndex={index}
            />
            <div className="mt-4 flex items-center gap-2 border border-[#334e52] bg-[#0c1a21] px-4 py-3 text-[9px] uppercase tracking-[.13em] text-[#819a94]">
              <ZoomIn className="h-4 w-4" style={{ color: tierMeta[tier].color }} />
              This view is isolated. Drag to rotate and place the cursor over the model before using the wheel to zoom.
            </div>
          </div>

          <div className="space-y-4">
            <section className="border border-[#3d5b50] bg-[#0d2028] p-5">
              <SectionLabel>Engineering principle</SectionLabel>
              <h3 className="mt-2 text-lg font-semibold text-[#e5eadf]">{part.principle}</h3>
              <p className="mt-4 text-sm leading-7 text-[#b9c9c2]">{part.explanation}</p>
            </section>

            <section className="border border-[#29434a] bg-[#0b1a21] p-5">
              <SectionLabel>Why this tier is different</SectionLabel>
              <p className="mt-3 text-sm leading-6 text-[#aabdb6]">{architecture.tierNote}</p>
              <p className="mt-3 text-sm leading-6 text-[#aabdb6]">{architecture.basis}</p>
            </section>

            <section className="border border-[#29434a] bg-[#08151b] p-5">
              <SectionLabel>Hardware record</SectionLabel>
              <dl className="mt-3 space-y-3 text-[9px] uppercase tracking-[.13em]">
                <div className="flex justify-between gap-5">
                  <dt className="text-[#748c86]">Physical form</dt>
                  <dd className="text-right text-[#d8e4de]">{part.shape}</dd>
                </div>
                <div className="flex justify-between gap-5">
                  <dt className="text-[#748c86]">Model envelope</dt>
                  <dd className="font-mono text-right text-[#d8e4de]">
                    {Math.round(part.size.x)} × {Math.round(part.size.y)} × {Math.round(part.size.z)} model units
                  </dd>
                </div>
              </dl>
            </section>

            <div className="border border-[#29434a] bg-[#08151b] p-4 text-[9px] leading-5 uppercase tracking-[.11em] text-[#718b86]">
              The model is educational, not a flight-certified CAD drawing. The subsystem choices and physical principles are grounded in real aerospace hardware or documented research concepts; dimensions, packaging and some integration details are intentionally simplified.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TechnicalViewer({
  track,
  tier,
  onBack,
}: {
  track: TechnologyTrack;
  tier: Tier;
  onBack: () => void;
}) {
  const architecture = derivedArchitecture(track, tier);
  const accent = tierMeta[tier].color;
  const [selected, setSelected] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const selectedPart = architecture.parts[selected] ?? architecture.parts[0];

  useEffect(() => {
    setSelected(0);
    setDetailOpen(false);
  }, [track.id, tier]);

  return (
    <GameShell active="lab" eyebrow="Engineering visualization / systems knowledge" title="Technical Viewer">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-[#3a5559] bg-[#0c1a21] px-4 py-3">
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#b8d1c5] hover:text-[#f0f4e8]">
          <ArrowLeft className="h-4 w-4" />
          Back to Technology Lab
        </button>
        <span className="text-[10px] font-bold uppercase tracking-[.16em]" style={{ color: accent }}>
          {track.category} · {track.tiers[tier].name} · {tier}
        </span>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionLabel>How it works</SectionLabel>
            <h2 className="mt-2 text-2xl font-semibold uppercase tracking-[.11em] text-[#f0f4e8]">{track.tiers[tier].name}</h2>
            <p className="mt-2 max-w-5xl text-sm leading-6 text-[#91aaa3]">{architecture.title} · {architecture.basis}</p>
          </div>
          <div className="border border-[#3b5751] bg-[#0b1920] px-4 py-3 text-right">
            <p className="text-[8px] font-bold uppercase tracking-[.2em] text-[#738a83]">Technology progression</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: accent }}>{architecture.tierNote}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <CanvasSystem
            architecture={architecture}
            selected={selected}
            setSelected={setSelected}
          />

          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="mt-4 flex w-full items-center justify-between border border-[#536d61] bg-[#11252a] px-5 py-4 text-left hover:border-[#efb658]"
          >
            <span>
              <span className="block text-[9px] font-bold uppercase tracking-[.2em]" style={{ color: accent }}>Isolate selected component</span>
              <span className="mt-1 block text-[10px] uppercase tracking-[.12em] text-[#789690]">{selectedPart.name} · full engineering detail</span>
            </span>
            <Scan className="h-5 w-5 text-[#efb658]" />
          </button>

          <div className="mt-5 border border-[#29434a] bg-[#0b1a21] p-5">
            <SectionLabel>System flow</SectionLabel>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {architecture.flow.map((step, index) => (
                <div key={step} className="flex items-center gap-2">
                  <div className="border border-[#3c5a60] bg-[#10232a] px-3 py-2 text-[9px] font-bold uppercase tracking-[.13em] text-[#c6d7cf]">{step}</div>
                  {index < architecture.flow.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-[#efb658]" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="border border-[#3d5b50] bg-[#0d2028] p-5">
            <SectionLabel>Selected component</SectionLabel>
            <h3 className="mt-2 text-xl font-semibold uppercase tracking-[.07em] text-[#eef3e7]">{selectedPart.name}</h3>
            <p className="mt-2 text-xs uppercase tracking-[.14em] text-[#72b9d4]">{selectedPart.role}</p>
            <div className="mt-5 border-l-2 border-[#efb658] bg-[#15262b] px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#efb658]">Engineering principle</p>
              <p className="mt-1 text-sm font-semibold text-[#e5eadf]">{selectedPart.principle}</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#aebeb7]">{selectedPart.explanation}</p>
            <button type="button" onClick={() => setDetailOpen(true)} className="mt-5 w-full border border-[#536d61] bg-[#11252a] px-4 py-3 text-[9px] font-bold uppercase tracking-[.17em] text-[#cfe1d7] hover:border-[#efb658]">
              Inspect component in full detail
            </button>
          </section>

          <section className="border border-[#29434a] bg-[#0b1a21] p-5">
            <SectionLabel>Tier hardware</SectionLabel>
            <div className="mt-3 space-y-3 text-[9px] uppercase tracking-[.14em]">
              <div className="flex justify-between gap-4"><span className="text-[#87958c]">Technology</span><span className="text-right text-[#e4eadf]">{track.tiers[tier].name}</span></div>
              <div className="flex justify-between gap-4"><span className="text-[#87958c]">Mass</span><span className="font-mono text-[#d9e5d8]">{track.tiers[tier].mass.toLocaleString()} kg</span></div>
              <div className="flex justify-between gap-4"><span className="text-[#87958c]">Mission cost</span><span className="font-mono text-[#d9e5d8]">{formatCredits(track.tiers[tier].cost)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-[#87958c]">Components modeled</span><span className="font-mono text-[#d9e5d8]">{architecture.parts.length}</span></div>
            </div>
          </section>

          <div className="border border-[#29434a] bg-[#08151b] p-4 text-[9px] leading-5 uppercase tracking-[.11em] text-[#718b86]">
            Cursor-over-canvas wheel zoom is captured by the 3D viewer itself. Page scrolling remains available everywhere else.
          </div>
        </aside>
      </div>

      {detailOpen && (
        <ComponentDetail
          architecture={architecture}
          part={selectedPart}
          index={selected}
          tier={tier}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </GameShell>
  );
}

export default TechnicalViewer;
