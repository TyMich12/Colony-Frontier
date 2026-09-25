export type TerrainKind = "moon" | "mars";
export type SolarTier = "Foundation" | "Frontier" | "Apex" | "Research";

// Physical geometry used by the 3D model. These are deliberately explicit so the
// visual scale and the electrical area calculation cannot silently drift apart.
export const PANEL_SEGMENT_LENGTH_M = 2.8;
export const PANEL_SEGMENT_WIDTH_M = 3.2;
export const NUM_SEGMENTS = 5;
export const NUM_WINGS = 4;
export const ACTIVE_WIDTH_FRACTION = 0.9;
export const ACTIVE_LENGTH_FRACTION = 0.9;

export const BASE_SEGMENT_PHYSICAL_AREA_M2 =
  PANEL_SEGMENT_LENGTH_M * PANEL_SEGMENT_WIDTH_M;
export const BASE_PHYSICAL_AREA_M2 =
  BASE_SEGMENT_PHYSICAL_AREA_M2 * NUM_SEGMENTS * NUM_WINGS;
export const BASE_ACTIVE_AREA_M2 =
  BASE_PHYSICAL_AREA_M2 * ACTIVE_WIDTH_FRACTION * ACTIVE_LENGTH_FRACTION;

export const INSTALLATION_LINEAR_SCALE: Record<TerrainKind, number> = {
  moon: 1.2,
  mars: 1.0,
};

export const SOLAR_IRRADIANCE_W_M2: Record<TerrainKind, number> = {
  // NASA planetary fact sheets: solar irradiance at the top of each body's atmosphere.
  moon: 1361.0,
  mars: 586.2,
};

export const MARS_DEFAULT_OPTICAL_DEPTH = 0.5;
export const MARS_AIRMASS_LIMIT_ZENITH_DEG = 80;
export const MARS_AIRMASS_LIMIT_COS_ZENITH =
  Math.cos((MARS_AIRMASS_LIMIT_ZENITH_DEG * Math.PI) / 180);

// Dust loading is represented by the 0–100 simulation index. The rendering coverage
// is a separate visual quantity; the power model uses an empirical exponential
// transmission curve, as observed for dust-covered PV cells.
export const MARS_PANEL_DUST_MAX_OPTICAL_DEPTH = Math.log(4); // 25% dust transmission at index 100.
export const LUNAR_PANEL_DUST_MAX_OPTICAL_DEPTH = Math.log(12.5); // 8% dust transmission at index 100.

// 92% is an explicit balance-of-system/electrical-loss assumption for this simulation.
// Cell conversion efficiency remains separate and visible in the model.
export const SYSTEM_ELECTRICAL_EFFICIENCY = 0.92;
export const ARRAY_DERATING = 1.0;

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
  dustCoverageFraction: number;
  sunElevation: number;
  irradiance: number;
  activeAreaM2: number;
  physicalAreaM2: number;
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
  dustCoverageFraction: 0,
  sunElevation: 32,
  irradiance: SOLAR_IRRADIANCE_W_M2.moon,
  activeAreaM2: 0,
  physicalAreaM2: 0,
  atmosphericTau: 0,
  atmosphericTransmission: 1,
  surfaceIrradiance: 0,
  dustRemainingFraction: 1,
  dustLossPct: 0,
};

/**
 * Approximate visible dust coverage represented by the 0–100 loading index.
 * This is a visual coverage model, not a claim that pixel coverage directly
 * determines optical transmission.
 */
export function dustCoverageFraction(dustPct: number): number {
  const x = Math.max(0, Math.min(100, dustPct)) / 100;
  return x <= 0 ? 0 : 1 - Math.exp(-4.2 * Math.pow(x, 1.15));
}

export function dustRemainingFraction(
  terrain: TerrainKind,
  dustPct: number,
): number {
  const x = Math.max(0, Math.min(100, dustPct)) / 100;

  const opticalDepth =
    (terrain === "mars"
      ? MARS_PANEL_DUST_MAX_OPTICAL_DEPTH
      : LUNAR_PANEL_DUST_MAX_OPTICAL_DEPTH) * x;

  // Beer-Lambert form: T = exp(-tau). NASA testing reports approximately
  // exponential power degradation as dust loading increases on PV cells.
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

export function physicalAreaForTerrain(terrain: TerrainKind): number {
  const scale = INSTALLATION_LINEAR_SCALE[terrain];
  return BASE_PHYSICAL_AREA_M2 * scale * scale;
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

  // P = G_surface × A_active × eta_cell × eta_system × deployment × T_dust.
  const watts =
    surfaceIrradiance *
    area *
    CELL_EFFICIENCY[tier] *
    SYSTEM_ELECTRICAL_EFFICIENCY *
    ARRAY_DERATING *
    Math.max(0, Math.min(1, deployment)) *
    dustFactor;

  return watts / 1000;
}
