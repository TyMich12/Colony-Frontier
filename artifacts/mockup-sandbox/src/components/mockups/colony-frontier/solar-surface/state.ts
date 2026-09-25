export type TerrainKind = "moon" | "mars";
export type SolarTier = "Foundation" | "Frontier" | "Apex" | "Research";

export const BASE_SEGMENT_AREA_M2 = (2.8 * 0.9) * (3.2 * 0.9);
export const NUM_SEGMENTS = 5;
export const NUM_WINGS = 4;
export const BASE_ACTIVE_AREA_M2 = BASE_SEGMENT_AREA_M2 * NUM_SEGMENTS * NUM_WINGS;

// The Moon installation is intentionally larger in Colony Frontier.
export const INSTALLATION_LINEAR_SCALE: Record<TerrainKind, number> = {
  moon: 1.2,
  mars: 1.0,
};

export const SOLAR_IRRADIANCE_W_M2: Record<TerrainKind, number> = {
  moon: 1361.0,
  mars: 586.2,
};

export const MARS_CLEAR_SKY_TRANSMISSION = 0.80;
export const ARRAY_DERATING = 0.92;
export const DUST_MAX_LOSS = 0.45;

export const CELL_EFFICIENCY: Record<SolarTier, number> = {
  Foundation: 0.28,
  Frontier: 0.30,
  Apex: 0.32,
  Research: 0.34,
};

export interface SolarLiveState {
  deploy: number;
  powerKW: number;
  efficiency: number;
  dust: number;
  sunElevation: number;
  irradiance: number;
  activeAreaM2: number;
}

export const solarLive: SolarLiveState = {
  deploy: 0,
  powerKW: 0,
  efficiency: 0,
  dust: 0,
  sunElevation: 32,
  irradiance: SOLAR_IRRADIANCE_W_M2.moon,
  activeAreaM2: 0,
};

export function dustEfficiency(dustPct: number): number {
  return 1 - (Math.max(0, Math.min(100, dustPct)) / 100) * DUST_MAX_LOSS;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function activeAreaForTerrain(terrain: TerrainKind): number {
  const scale = INSTALLATION_LINEAR_SCALE[terrain];
  return BASE_ACTIVE_AREA_M2 * scale * scale;
}

export function calculatePowerKW({
  terrain,
  tier,
  deployment,
  sunElevation,
  dust,
}: {
  terrain: TerrainKind;
  tier: SolarTier;
  deployment: number;
  sunElevation: number;
  dust: number;
}): number {
  const irradiance = SOLAR_IRRADIANCE_W_M2[terrain];
  const atmosphericFactor = terrain === "mars" ? MARS_CLEAR_SKY_TRANSMISSION : 1;
  const area = activeAreaForTerrain(terrain);
  const incidenceFactor = Math.max(0, Math.sin((sunElevation * Math.PI) / 180));
  const dustFactor = dustEfficiency(dust);

  const watts =
    irradiance *
    atmosphericFactor *
    area *
    CELL_EFFICIENCY[tier] *
    ARRAY_DERATING *
    Math.max(0, Math.min(1, deployment)) *
    incidenceFactor *
    dustFactor;

  return watts / 1000;
}