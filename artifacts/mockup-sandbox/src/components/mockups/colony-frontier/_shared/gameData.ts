export type Tier = "Foundation" | "Frontier" | "Apex" | "Research";

export type Equipment = {
  name: string;
  mass: number;
  cost: number;
  efficiency: string;
  description: string;
  unlockXp: number;
  researchTokens: number;
};

export type TechnologyTrack = {
  id: string;
  category: string;
  shortName: string;
  description: string;
  tiers: Record<Tier, Equipment>;
};

const tierUnlocks: Record<Tier, { xp: number; tokens: number }> = {
  Foundation: { xp: 0, tokens: 0 },
  Frontier: { xp: 1000, tokens: 0 },
  Apex: { xp: 3000, tokens: 0 },
  Research: { xp: 10000, tokens: 1 },
};

function tier(
  name: string,
  mass: number,
  cost: number,
  efficiency: string,
  description: string,
  researchTokens?: number,
): Equipment {
  return {
    name,
    mass,
    cost,
    efficiency,
    description,
    unlockXp: 0,
    researchTokens: researchTokens ?? 0,
  };
}

export const technologyTracks: TechnologyTrack[] = [
  {
    id: "solar",
    category: "Solar",
    shortName: "SOL",
    description: "Power generation during sunlight windows.",
    tiers: {
      Foundation: tier("Helios-1 Array", 850, 3, "Reliable normal-sun output", "Basic solar generation; reliable during normal sunlight."),
      Frontier: tier("Helios-X Array", 1250, 6.5, "Improved low-angle performance", "Higher output and improved low-angle sunlight performance."),
      Apex: tier("Helios-X ArrayR", 1750, 12, "Automated tracking + dust tolerance", "Very high output with automated tracking and improved dust tolerance."),
      Research: tier("Helios-Nova Array", 1600, 15, "Extreme output in difficult light", "Extreme generation with autonomous tracking and strong dust resistance.", 5)
    },
  },
  {
    id: "battery",
    category: "Battery",
    shortName: "BAT",
    description: "Stores excess power for night and emergencies.",
    tiers: {
      Foundation: tier("Atlas Battery Pack", 700, 2.5, "Baseline emergency storage", "Stores excess electricity for nighttime and emergencies."),
      Frontier: tier("Atlas-L Battery Pack", 1050, 5, "Larger capacity + faster charging", "Larger capacity and faster charging."),
      Apex: tier("Atlas-V Battery Bank", 1500, 9.5, "Very high capacity + power management", "Very large capacity with advanced power management."),
      Research: tier("Atlas-Sovereign Storage Core", 1300, 14, "Massive density + rapid redistribution", "Massive energy density and highly efficient emergency storage.", 5)
    },
  },
  {
    id: "oxygen",
    category: "Oxygen",
    shortName: "O2",
    description: "Produces and regulates breathable oxygen.",
    tiers: {
      Foundation: tier("AeroLife-1", 420, 2, "90-day rated oxygen loop", "Produces and regulates breathable oxygen."),
      Frontier: tier("AeroLife-2", 650, 4.5, "Higher production + recycling", "Higher production and more efficient oxygen recycling."),
      Apex: tier("AeroLife-X", 950, 8, "Automated atmospheric management", "High-output production with automated atmospheric management."),
      Research: tier("AeroLife-Aegis", 800, 13, "Emergency atmospheric balancing", "Extremely efficient production and recycling with automatic emergency balancing.", 1)
    },
  },
  {
    id: "water",
    category: "Water",
    shortName: "H2O",
    description: "Reclaims and purifies water from colony waste streams.",
    tiers: {
      Foundation: tier("AquaLoop-1", 380, 1.8, "96% recovery", "Basic water recycling."),
      Frontier: tier("AquaLoop-2", 600, 3.8, "Waste + humidity recovery", "Recovers more water from waste and humidity."),
      Apex: tier("AquaLoop-X", 900, 7, "High-efficiency purification", "Very high-efficiency recycling and purification."),
      Research: tier("AquaLoop-Eternis", 750, 12, "Near-total recovery", "Near-total recovery of usable water streams; dramatically reduces external requirements.", 5)
    },
  },
  {
    id: "co2",
    category: "CO₂",
    shortName: "CO2",
    description: "Keeps habitat air breathable and recovers useful carbon.",
    tiers: {
      Foundation: tier("Carbon-1 Scrubber", 300, 1.5, "Basic CO₂ removal", "Removes CO₂ from habitat air."),
      Frontier: tier("Carbon-2 Scrubber", 470, 3.2, "Lower power consumption", "Higher removal rate and lower power consumption."),
      Apex: tier("Carbon-X Scrubber", 700, 6, "Partial resource recovery", "Highly efficient CO₂ removal with partial resource recovery."),
      Research: tier("Carbon-Synthesis Cor", 600, 10, "Useful carbon compound recovery", "Removes CO₂ while recovering useful carbon compounds for colony processes.", 1)
    },
  },
  {
    id: "thermal",
    category: "Thermal",
    shortName: "THM",
    description: "Maintains livable temperatures through the lunar cycle.",
    tiers: {
      Foundation: tier("Thermo-1", 500, 2, "Basic heating + cooling", "Basic heating and cooling."),
      Frontier: tier("Thermo-L", 750, 4.5, "Better insulation + redistribution", "Better insulation and heat redistribution."),
      Apex: tier("Thermo-X", 1100, 8.5, "Advanced thermal recovery", "Advanced thermal regulation and heat recovery."),
      Research: tier("Thermo-Aegis", 900, 13, "Highly efficient heat recovery", "Highly efficient heat redistribution, storage, and recovery.", 1)
    },
  },
  {
    id: "comms",
    category: "Comms",
    shortName: "COM",
    description: "Connects the settlement to Earth and deep space.",
    tiers: {
      Foundation: tier("Relay-1", 180, 1.2, "Basic Earth communications", "Basic settlement-to-Earth communications."),
      Frontier: tier("Relay-X", 300, 2.8, "Greater range + reliability", "Greater range and reliability."),
      Apex: tier("DeepLink-XR", 480, 5.5, "High-bandwidth redundancy", "High-bandwidth deep-space communications with redundancy."),
      Research: tier("DeepLink-Quantum", 400, 10, "Autonomous intelligent routing", "Ultra-high reliability autonomous communications with extreme redundancy.", 1)
    },
  },
  {
    id: "habitat",
    category: "Habitat",
    shortName: "HAB",
    description: "Provides pressurized, protected living space.",
    tiers: {
      Foundation: tier("Haven-1 Module", 2400, 8, "Basic pressurized living", "Basic pressurized living space."),
      Frontier: tier("Haven-L Module", 3400, 14, "Larger + better insulated", "Larger, better insulated, and more efficient habitat."),
      Apex: tier("Haven-X Module", 4800, 24, "Integrated life support + protection", "Advanced life-support integration and stronger structural protection."),
      Research: tier("Haven-Genesis Module", 4200, 35, "Resilient automated isolation", "Highly resilient habitat with automated emergency isolation.", 10)
    },
  },
  {
    id: "radiation",
    category: "Radiation",
    shortName: "RAD",
    description: "Shields crew and systems from solar events.",
    tiers: {
      Foundation: tier("Shield-1", 450, 1.5, "Basic radiation protection", "Basic radiation protection."),
      Frontier: tier("Shield-L", 850, 4, "Improved shielding", "Improved shielding and greater protection."),
      Apex: tier("Shield-X", 1400, 8.5, "Advanced radiation shielding", "Advanced radiation shielding."),
      Research: tier("Shield-Aegis", 1200, 14, "Active monitoring + shelter control", "Extremely high protection with active monitoring and automatic shelter management.", 1)
    },
  },
  {
    id: "grid",
    category: "Power Grid",
    shortName: "PWR",
    description: "Distributes and prioritizes power across systems.",
    tiers: {
      Foundation: tier("Grid-1", 220, 1, "Basic system distribution", "Distributes power between systems."),
      Frontier: tier("Grid-L", 400, 2.5, "Load balancing + redundancy", "Better load balancing and redundancy."),
      Apex: tier("Grid-X", 650, 5, "Critical-system prioritization", "Automatically prioritizes critical systems."),
      Research: tier("Grid-Nexus", 550, 9, "Adaptive cascade response", "Fully adaptive colony-wide power management during cascading failures.", 10)
    },
  },
  {
    id: "science",
    category: "Science",
    shortName: "SCI",
    description: "Turns field observations into research progress.",
    tiers: {
      Foundation: tier("Lab-1", 300, 1.5, "Basic experiments", "Basic scientific experiments."),
      Frontier: tier("Lab-L", 550, 3.5, "Advanced experiments + analysis", "More advanced experiments and analysis."),
      Apex: tier("Lab-X", 900, 7, "Automated scientific analysis", "High-level automated scientific analysis."),
      Research: tier("Lab-Omnis", 750, 12, "Multi-system analysis", "Analyzes resources, environmental conditions, and biological systems simultaneously.", 1)
    },
  },
  {
    id: "navigation",
    category: "Navigation",
    shortName: "NAV",
    description: "Keeps vehicles and cargo on safe routes.",
    tiers: {
      Foundation: tier("Nav-1", 100, 0.6, "Basic positioning", "Basic navigation and positioning."),
      Frontier: tier("Nav-L", 180, 1.5, "Precision + autonomous routing", "Improved precision and autonomous routing."),
      Apex: tier("Nav-X", 300, 3, "Advanced autonomous navigation", "Advanced autonomous navigation."),
      Research: tier("Nav-Sovereig", 250, 7, "Colony-wide autonomous routing", "Colony-wide autonomous navigation with minimal dependence on Earth.", 1)
    },
  },
  {
    id: "rover",
    category: "Rover",
    shortName: "ROV",
    description: "Explores terrain and transports tools and samples.",
    tiers: {
      Foundation: tier("Scout-1 Rover", 180, 1, "Basic transport + exploration", "Basic transport and exploration."),
      Frontier: tier("Pathfinder-L Rover", 350, 2.5, "Greater range + payload", "Greater range, payload, and navigation capability."),
      Apex: tier("Odyssey-X Rover", 650, 5.5, "Autonomous resource operations", "Highly autonomous exploration and resource operations."),
      Research: tier("Odyssey-Titan Rover", 550, 9, "Extreme range + repair assistance", "Extreme range, autonomous navigation, resource collection, and repair assistance.", 1)
    },
  },
  {
    id: "extraction",
    category: "Extraction",
    shortName: "EXT",
    description: "Reaches subsurface deposits and brings them home.",
    tiers: {
      Foundation: tier("Drill-1", 450, 2, "Accessible resource extraction", "Extracts accessible subsurface resources."),
      Frontier: tier("CryoDrill-L", 750, 4.5, "Deeper + colder deposits", "Reaches deeper and colder deposits more efficiently."),
      Apex: tier("CryoDrill-X", 1200, 8.5, "High-output autonomous extraction", "High-output autonomous extraction."),
      Research: tier("CryoForge-X", 1050, 14, "Deep extraction + separation", "Deep extraction combined with advanced processing and resource separation.", 1)
    },
  },
  {
    id: "isru",
    category: "ISRU",
    shortName: "ISRU",
    description: "Turns local material into useful colony supplies.",
    tiers: {
      Foundation: tier("Forge-1", 650, 3, "Basic local processing", "Processes local materials into basic usable resources."),
      Frontier: tier("Forge-L", 1100, 6.5, "Higher material efficiency", "Produces more materials with greater efficiency."),
      Apex: tier("Forge-X", 1700, 12, "Industrial products + supplies", "Produces construction materials, processed resources, and industrial products."),
      Research: tier("Forge-Genesis", 1500, 20, "Wide-spectrum resource conversion", "Turns a wide range of local resources into critical colony supplies.", 1)
    },
  },
  {
    id: "agriculture",
    category: "Agriculture",
    shortName: "AGR",
    description: "Grows food inside a controlled closed loop.",
    tiers: {
      Foundation: tier("GreenPod-1", 700, 3, "Small controlled crops", "Small controlled crop production."),
      Frontier: tier("AgriCore-L", 1100, 6, "Better water + light efficiency", "Larger production with improved water and light efficiency."),
      Apex: tier("AgriCore-X", 1700, 11, "Automated closed-loop growing", "Highly automated agriculture integrated with CO₂, water, and oxygen systems."),
      Research: tier("AgriCore-Eden", 1450, 18, "Major food-production capacity", "Extremely efficient closed-loop agriculture for a major portion of colony food.", 1)
    },
  },
  {
    id: "maintenance",
    category: "Maintenance",
    shortName: "MNT",
    description: "Keeps colony hardware operational between missions.",
    tiers: {
      Foundation: tier("Service-1", 250, 1.5, "Manual maintenance", "Basic manual maintenance equipment."),
      Frontier: tier("Service-L", 450, 3.5, "Automated diagnostics", "Automated diagnostics and maintenance assistance."),
      Apex: tier("Service-X", 750, 6.5, "Autonomous system maintenance", "Autonomous maintenance of many colony systems."),
      Research: tier("Service-Sentinel", 650, 11, "Predictive autonomous repair", "Detects, predicts, and responds to developing equipment failures.", 1)
    },
  },
];

export const tierMeta: Record<Tier, { color: string; short: string }> = {
  Foundation: { color: "#9fce82", short: "FDN" },
  Frontier: { color: "#72b9d4", short: "FRT" },
  Apex: { color: "#b68ee6", short: "APX" },
  Research: { color: "#e9a15d", short: "RSH" },
};

export const payloadProgression = [
  { phase: "Early Moon", capacity: 8000, unlock: "Starting capacity" },
  { phase: "Mid Moon", capacity: 12000, unlock: "Unlock after Mission 03" },
  { phase: "Late Moon", capacity: 16000, unlock: "Unlock after Mission 06" },
  { phase: "Early Mars", capacity: 12000, unlock: "Mars Campaign start" },
  { phase: "Mid Mars", capacity: 18000, unlock: "Unlock after Mars 03" },
  { phase: "Late Mars", capacity: 25000, unlock: "Unlock after Mars 06" },
] as const;

export const tierUnlockRequirements = tierUnlocks;

export const formatCredits = (value: number) =>
  `$${value.toFixed(value % 1 === 0 ? 0 : 1)}M`;