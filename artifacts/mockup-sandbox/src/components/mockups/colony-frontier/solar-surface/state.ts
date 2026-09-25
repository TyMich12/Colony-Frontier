export type TerrainKind = "moon" | "mars";
export type SolarTier = "Foundation" | "Frontier" | "Apex" | "Research";

export const BASE_SEGMENT_AREA_M2 = (2.8 * 0.9) * (3.2 * 0.9);
export const NUM_SEGMENTS = 5;
export const NUM_WINGS = 4;
export const BASE_ACTIVE_AREA_M2 = BASE_SEGMENT_AREA_M2 * NUM_SEGMENTS * NUM_WINGS;

export const INSTALLATION_LINEAR_SCALE: Record<TerrainKind, number> = {
  moon: 1.2,
  mars: 1.0,
};

export const SOLAR_IRRADIANCE_W_M2: Record<TerrainKind, number> = {
  moon: 1361.0,
  mars: 586.2,
};

export const MARS_DEFAULT_OPTICAL_DEPTH = 0.5;
export const MARS_AIRMASS_LIMIT_ZENITH_DEG = 80;
export const MARS_AIRMASS_LIMIT_COS_ZENITH =
  Math.cos((MARS_AIRMASS_LIMIT_ZENITH_DEG * Math.PI) / 180);

// The power model uses P = G × A × η. No arbitrary extra derating is applied.\nexport const ARRAY_DERATING = 1.0;
export const MARS_SEVERE_DUST_REMAINING = 0.05;
export const LUNAR_DUST_REFERENCE_MG_CM2 = 3.0;
export const LUNAR_DUST_REFERENCE_REMAINING = 0.08;

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
  atmosphericTau: number;
  atmosphericTransmission: number;
  surfaceIrradiance: number;
  dustRemainingFraction: number;
  dustLossPct: number;
}

export const solarLive: SolarLiveState = {
  deploy: 0,
  powerKW: 0,
  efficiency: 0,
  dust: 0,
  sunElevation: 32,
  irradiance: SOLAR_IRRADIANCE_W_M2.moon,
  activeAreaM2: 0,
  atmosphericTau: 0,
  atmosphericTransmission: 1,
  surfaceIrradiance: 0,
  dustRemainingFraction: 1,
  dustLossPct: 0,
};

export function dustRemainingFraction(
  terrain: TerrainKind,
  dustPct: number,
): number {
  const x = Math.max(0, Math.min(100, dustPct)) / 100;

  const opticalDepth =
    (terrain === "mars"
      ? MARS_PANEL_DUST_MAX_OPTICAL_DEPTH
      : LUNAR_PANEL_DUST_MAX_OPTICAL_DEPTH) * x;

  // Beer-Lambert transmission: T = e^(-τ).
  return Math.exp(-opticalDepth);
}

export function dustEfficiency(
  terrain: TerrainKind,
  dustPct: number,
): number {
  return dustRemainingFraction(terrain, dustPct);
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

export function marsAirmass(sunElevation: number): number {
  const elevation = Math.max(0, Math.min(90, sunElevation));
  const cosZenith = Math.sin((elevation * Math.PI) / 180);
  return 1 / Math.max(cosZenith, MARS_AIRMASS_LIMIT_COS_ZENITH);
}

export function marsDirectTransmission(sunElevation: number): number {
  if (sunElevation <= 0) return 0;
  return Math.exp(-MARS_DEFAULT_OPTICAL_DEPTH * marsAirmass(sunElevation));
}

export function surfaceIrradianceForTerrain(
  terrain: TerrainKind,
  sunElevation: number,
): number {
  const elevationRad = (Math.max(0, Math.min(90, sunElevation)) * Math.PI) / 180;
  const projection = Math.max(0, Math.sin(elevationRad));

  if (terrain === "moon") {
    return SOLAR_IRRADIANCE_W_M2.moon * projection;
  }

  return SOLAR_IRRADIANCE_W_M2.mars * projection * marsDirectTransmission(sunElevation);
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
  const area = activeAreaForTerrain(terrain);
  const surfaceIrradiance = surfaceIrradianceForTerrain(terrain, sunElevation);
  const dustFactor = dustEfficiency(terrain, dust);

  const watts =
    surfaceIrradiance *
    area *
    CELL_EFFICIENCY[tier] *
    ARRAY_DERATING *
    Math.max(0, Math.min(1, deployment)) *
    dustFactor;

  return watts / 1000;
}
