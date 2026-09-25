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

// Mars surface solar power is atmosphere-limited.
// NASA describes normal/quiescent Martian optical depth as approximately 0.5.
// The model below uses the NASA Beer-Lambert direct-beam relationship
// G_b = G_0 exp(-tau * airmass), with a horizontal-surface projection term.
export const MARS_DEFAULT_OPTICAL_DEPTH = 0.5;
export const MARS_AIRMASS_LIMIT_ZENITH_DEG = 80;
export const MARS_AIRMASS_LIMIT_COS_ZENITH =
  Math.cos((MARS_AIRMASS_LIMIT_ZENITH_DEG * Math.PI) / 180);

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
  atmosphericTau: number;
  atmosphericTransmission: number;
  surfaceIrradiance: number;
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

export function marsAirmass(sunElevation: number): number {
  const elevation = Math.max(0, Math.min(90, sunElevation));
  const cosZenith = Math.sin((elevation * Math.PI) / 180);

  // NASA's Mars airmass approximation is 1/cos(z) for zenith angles
  // up to about 80°. Below 10° elevation we cap the value rather than
  // allowing the plane-parallel approximation to diverge.
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

  // Horizontal-array direct-beam term:
  // G_bh = G_0 * cos(z) * exp(-tau * m(z))
  // and cos(z) = sin(elevation).
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
  const dustFactor = dustEfficiency(dust);

  const watts =
    surfaceIrradiance *
    area *
    CELL_EFFICIENCY[tier] *
    ARRAY_DERATING *
    Math.max(0, Math.min(1, deployment)) *
    dustFactor;

  return watts / 1000;
}
