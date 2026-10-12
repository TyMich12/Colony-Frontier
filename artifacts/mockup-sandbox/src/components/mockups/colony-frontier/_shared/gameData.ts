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
      Foundation: tier("Helios-1 Array", 850, 3, "12 kW rated output", "Basic solar generation; reliable during normal sunlight."),
      Frontier: tier("Helios-X Array", 1250, 6.5, "20 kW rated output", "Higher output and improved low-angle sunlight performance."),
      Apex: tier("Helios-XR Array", 1750, 12, "32 kW rated output", "Very high output with automated tracking and improved dust tolerance."),
      Research: tier("Helios-Nova Array", 1600, 15, "60 kW rated output", "Research-generation array: 60 kW rated output at 0/2, with a major capacity jump over Apex, autonomous tracking, and strong dust resistance.", 5)
    },
  },
  {
    id: "battery",
    category: "Battery",
    shortName: "BAT",
    description: "Stores excess power for night and emergencies.",
    tiers: {
      Foundation: tier("Atlas Battery Pack", 700, 2.5, "1,200 kWh nominal capacity", "Stores excess electricity for nighttime and emergencies."),
      Frontier: tier("Atlas-L Battery Pack", 1050, 5, "1,800 kWh nominal capacity", "Larger capacity and faster charging."),
      Apex: tier("Atlas-V Battery Bank", 1500, 9.5, "3,000 kWh nominal capacity", "Very large capacity with advanced power management."),
      Research: tier("Atlas-Sovereign Storage Core", 1300, 14, "5,000 kWh nominal capacity", "Research-generation storage: 5,000 kWh nominal at 0/2, with a major capacity jump over Apex and high-rate power electronics.", 5)
    },
  },
  {
    id: "oxygen",
    category: "Oxygen",
    shortName: "O2",
    description: "Produces and regulates breathable oxygen.",
    tiers: {
      Foundation: tier("AeroLife-1", 420, 2, "3 kg O₂/day", "Produces and regulates breathable oxygen."),
      Frontier: tier("AeroLife-2", 650, 4.5, "4.2 kg O₂/day", "Higher production and more efficient oxygen recycling."),
      Apex: tier("AeroLife-X", 950, 8, "5.8 kg O₂/day", "High-output production with automated atmospheric management."),
      Research: tier("AeroLife-Aegis", 800, 13, "8 kg O₂/day", "Research-generation oxygen loop: 8 kg O₂/day at 0/2, with a major production jump and automatic emergency balancing.", 1)
    },
  },
  {
    id: "water",
    category: "Water",
    shortName: "H2O",
    description: "Reclaims and purifies water from colony waste streams.",
    tiers: {
      Foundation: tier("AquaLoop-1", 380, 1.8, "60% water recovery", "Basic water recycling."),
      Frontier: tier("AquaLoop-2", 600, 3.8, "72% water recovery", "Recovers more water from waste and humidity."),
      Apex: tier("AquaLoop-X", 900, 7, "88% water recovery", "Very high-efficiency recycling and purification."),
      Research: tier("AquaLoop-Eternis", 750, 12, "98% water recovery", "Research-generation water loop: 98% recovery at 0/2, with a major step in recovery and wastewater throughput.", 5)
    },
  },
  {
    id: "co2",
    category: "CO₂",
    shortName: "CO2",
    description: "Keeps habitat air breathable and recovers useful carbon.",
    tiers: {
      Foundation: tier("Carbon-1 Scrubber", 300, 1.5, "3 kg CO₂/day removal", "Removes CO₂ from habitat air."),
      Frontier: tier("Carbon-2 Scrubber", 470, 3.2, "4.5 kg CO₂/day removal", "Higher removal rate and lower power consumption."),
      Apex: tier("Carbon-X Scrubber", 700, 6, "6.5 kg CO₂/day removal", "Highly efficient CO₂ removal with partial resource recovery."),
      Research: tier("Carbon-Synthesis Cor", 600, 10, "9 kg CO₂/day removal", "Research-generation CO₂ system: 9 kg/day removal at 0/2, with a major capacity jump and useful carbon-compound recovery.", 1)
    },
  },
  {
    id: "thermal",
    category: "Thermal",
    shortName: "THM",
    description: "Maintains livable temperatures through the lunar cycle.",
    tiers: {
      Foundation: tier("Thermo-1", 500, 2, "4 kW heat rejection", "Basic heating and cooling."),
      Frontier: tier("Thermo-L", 750, 4.5, "7 kW heat rejection", "Better insulation and heat redistribution."),
      Apex: tier("Thermo-X", 1100, 8.5, "12 kW heat rejection", "Advanced thermal regulation and heat recovery."),
      Research: tier("Thermo-Aegis", 900, 13, "20 kW heat rejection", "Research-generation thermal system: 20 kW heat rejection at 0/2, with a major radiator/loop-capacity jump.", 1)
    },
  },
  {
    id: "comms",
    category: "Comms",
    shortName: "COM",
    description: "Connects the settlement to Earth and deep space.",
    tiers: {
      Foundation: tier("Relay-1", 180, 1.2, "2 Mbps throughput", "Basic settlement-to-Earth communications."),
      Frontier: tier("Relay-X", 300, 2.8, "12 Mbps throughput", "Greater range and reliability."),
      Apex: tier("DeepLink-XR", 480, 5.5, "50 Mbps throughput", "High-bandwidth deep-space communications with redundancy."),
      Research: tier("DeepLink-Quantum", 400, 10, "200 Mbps throughput", "Research-generation communications: 200 Mbps at 0/2, with a major bandwidth jump and autonomous redundant routing.", 1)
    },
  },
  {
    id: "habitat",
    category: "Habitat",
    shortName: "HAB",
    description: "Provides pressurized, protected living space.",
    tiers: {
      Foundation: tier("Haven-1 Module", 2400, 8, "8 kPa/24 h standard-fault loss", "Basic pressurized living space."),
      Frontier: tier("Haven-L Module", 3400, 14, "4 kPa/24 h standard-fault loss", "Larger, better insulated, and more efficient habitat."),
      Apex: tier("Haven-X Module", 4800, 24, "1.5 kPa/24 h standard-fault loss", "Advanced life-support integration and stronger structural protection."),
      Research: tier("Haven-Genesis Module", 4200, 35, "0.30 kPa/24 h standard-fault loss", "Research-generation habitat: 0.30 kPa/24 h standard-fault pressure loss at 0/2, with a major leak-resilience jump and automated isolation.", 10)
    },
  },
  {
    id: "radiation",
    category: "Radiation",
    shortName: "RAD",
    description: "Shields crew and systems from solar events.",
    tiers: {
      Foundation: tier("Shield-1", 450, 1.5, "10% reference-event dose avoided", "Basic radiation protection."),
      Frontier: tier("Shield-L", 850, 4, "18% reference-event dose avoided", "Improved shielding and greater protection."),
      Apex: tier("Shield-X", 1400, 8.5, "30% reference-event dose avoided", "Advanced radiation shielding."),
      Research: tier("Shield-Aegis", 1200, 14, "50% reference-event dose avoided", "Research-generation shielding: 50% reference-event dose avoided at 0/2, with a major protected-zone jump and active shelter management.", 1)
    },
  },
  {
    id: "grid",
    category: "Power Grid",
    shortName: "PWR",
    description: "Distributes and prioritizes power across systems.",
    tiers: {
      Foundation: tier("Grid-1", 220, 1, "8 kW transfer capacity", "Distributes power between systems."),
      Frontier: tier("Grid-L", 400, 2.5, "22 kW transfer capacity", "Better load balancing and redundancy."),
      Apex: tier("Grid-X", 650, 5, "50 kW transfer capacity", "Automatically prioritizes critical systems."),
      Research: tier("Grid-Nexus", 550, 9, "120 kW transfer capacity", "Research-generation grid: 120 kW transfer at 0/2, with a major transfer-capacity jump and adaptive cascade response.", 10)
    },
  },
  {
    id: "science",
    category: "Science",
    shortName: "SCI",
    description: "Turns field observations into research progress.",
    tiers: {
      Foundation: tier("Lab-1", 300, 1.5, "2 assays/day", "Basic scientific experiments."),
      Frontier: tier("Lab-L", 550, 3.5, "8 assays/day", "More advanced experiments and analysis."),
      Apex: tier("Lab-X", 900, 7, "24 assays/day", "High-level automated scientific analysis."),
      Research: tier("Lab-Omnis", 750, 12, "60 assays/day", "Research-generation laboratory: 60 assays/day at 0/2, with a major throughput jump and parallel multi-system analysis.", 1)
    },
  },
  {
    id: "navigation",
    category: "Navigation",
    shortName: "NAV",
    description: "Keeps vehicles and cargo on safe routes.",
    tiers: {
      Foundation: tier("Nav-1", 100, 0.6, "50 m reference position error", "Basic navigation and positioning."),
      Frontier: tier("Nav-L", 180, 1.5, "15 m reference position error", "Improved precision and autonomous routing."),
      Apex: tier("Nav-X", 300, 3, "3 m reference position error", "Advanced autonomous navigation."),
      Research: tier("Nav-Sovereig", 250, 7, "0.20 m reference position error", "Research-generation navigation: 0.20 m reference position error at 0/2, with a major precision jump and colony-wide autonomous routing.", 1)
    },
  },
  {
    id: "rover",
    category: "Rover",
    shortName: "ROV",
    description: "Explores terrain and transports tools and samples.",
    tiers: {
      Foundation: tier("Scout-1 Rover", 180, 1, "2 km/h safe speed", "Basic transport and exploration."),
      Frontier: tier("Pathfinder-L Rover", 350, 2.5, "4 km/h safe speed", "Greater range, payload, and navigation capability."),
      Apex: tier("Odyssey-X Rover", 650, 5.5, "7 km/h safe speed", "Highly autonomous exploration and resource operations."),
      Research: tier("Odyssey-Titan Rover", 550, 9, "12 km/h safe speed", "Research-generation rover: 12 km/h safe rough-terrain speed at 0/2, with a major speed/range jump and repair assistance.", 1)
    },
  },
  {
    id: "extraction",
    category: "Extraction",
    shortName: "EXT",
    description: "Reaches subsurface deposits and brings them home.",
    tiers: {
      Foundation: tier("Drill-1", 450, 2, "100 kg regolith/day", "Extracts accessible subsurface resources."),
      Frontier: tier("CryoDrill-L", 750, 4.5, "250 kg regolith/day", "Reaches deeper and colder deposits more efficiently."),
      Apex: tier("CryoDrill-X", 1200, 8.5, "600 kg regolith/day", "High-output autonomous extraction."),
      Research: tier("CryoForge-X", 1050, 14, "1,500 kg regolith/day", "Research-generation extraction: 1,500 kg regolith/day at 0/2, with a major throughput jump and integrated separation.", 1)
    },
  },
  {
    id: "isru",
    category: "ISRU",
    shortName: "ISRU",
    description: "Turns local material into useful colony supplies.",
    tiers: {
      Foundation: tier("Forge-1", 650, 3, "1 kg product/day", "Processes local materials into basic usable resources."),
      Frontier: tier("Forge-L", 1100, 6.5, "5 kg product/day", "Produces more materials with greater efficiency."),
      Apex: tier("Forge-X", 1700, 12, "15 kg product/day", "Produces construction materials, processed resources, and industrial products."),
      Research: tier("Forge-Genesis", 1500, 20, "40 kg product/day", "Research-generation ISRU: 40 kg product/day at 0/2, with a major production jump and wide-spectrum resource conversion.", 1)
    },
  },
  {
    id: "agriculture",
    category: "Agriculture",
    shortName: "AGR",
    description: "Grows food inside a controlled closed loop.",
    tiers: {
      Foundation: tier("GreenPod-1", 700, 3, "0.5 kg dry-food-equivalent/day", "Small controlled crop production."),
      Frontier: tier("AgriCore-L", 1100, 6, "1.8 kg dry-food-equivalent/day", "Larger production with improved water and light efficiency."),
      Apex: tier("AgriCore-X", 1700, 11, "4 kg dry-food-equivalent/day", "Highly automated agriculture integrated with CO₂, water, and oxygen systems."),
      Research: tier("AgriCore-Eden", 1450, 18, "8 kg dry-food-equivalent/day", "Research-generation agriculture: 8 kg dry-food-equivalent/day at 0/2, with a major yield jump and closed-loop resource recovery.", 1)
    },
  },
  {
    id: "maintenance",
    category: "Maintenance",
    shortName: "MNT",
    description: "Keeps colony hardware operational between missions.",
    tiers: {
      Foundation: tier("Service-1", 250, 1.5, "5 condition points/job", "Basic manual maintenance equipment."),
      Frontier: tier("Service-L", 450, 3.5, "15 condition points/job", "Automated diagnostics and maintenance assistance."),
      Apex: tier("Service-X", 750, 6.5, "35 condition points/job", "Autonomous maintenance of many colony systems."),
      Research: tier("Service-Sentinel", 650, 11, "60 condition points/job", "Research-generation maintenance: restores 60 condition points/job at 0/2, with a major repair-throughput jump and predictive diagnostics.", 1)
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