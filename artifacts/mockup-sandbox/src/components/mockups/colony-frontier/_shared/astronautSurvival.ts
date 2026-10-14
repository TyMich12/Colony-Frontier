/**
 * Astronaut survival rules for launch/liftoff and descent/landing.
 *
 * This module is intentionally isolated from MissionSimulation and all minigames.
 * It provides deterministic, configurable GAMEPLAY thresholds, not a real-world
 * medical predictor or certified flight-safety model.
 */

export type FlightPhase = "liftoff" | "ascent" | "descent" | "landing";

export type SurvivalStatus = "READY" | "WARNING" | "CRITICAL" | "MISSION_LOSS" | "SUCCESS";

export type AstronautFlightState = {
  phase: FlightPhase;
  elapsedSeconds: number;
  oxygenKg: number;
  oxygenConsumptionKgPerSecond: number;
  electricalEnergyJ: number;
  electricalLoadW: number;
  electricalGenerationW: number;
  cabinPressurePa: number;
  cabinTemperatureK: number;
  accumulatedRadiationGy: number;
  accelerationG: number;
  /** Estimated landing impact load in g; used only during landing. */
  landingImpactG?: number;
  /** True when the vehicle's landing/crew restraint system reports intact. */
  restraintsIntact: boolean;
  /** Set by the existing flight model if attitude/control is unrecoverable. */
  unrecoverableFlightControlFailure: boolean;
};

export type SurvivalConfig = {
  expectedFlightSeconds: number;
  emergencyReserveSeconds: number;
  minimumOxygenKg: number;
  minimumEnergyJ: number;
  minimumPressurePa: number;
  maximumPressurePa: number;
  minimumTemperatureK: number;
  maximumTemperatureK: number;
  maximumRadiationGy: number;
  maximumSustainedAccelerationG: number;
  maximumLandingImpactG: number;
};

export type SurvivalCheck = {
  status: SurvivalStatus;
  launchAllowed: boolean;
  reasons: string[];
  warnings: string[];
};

export const DEFAULT_SURVIVAL_CONFIG: SurvivalConfig = {
  // All values are illustrative game-balance parameters, not real flight limits.
  expectedFlightSeconds: 600,
  emergencyReserveSeconds: 300,
  minimumOxygenKg: 0.05,
  minimumEnergyJ: 10_000,
  minimumPressurePa: 70_000,
  maximumPressurePa: 110_000,
  minimumTemperatureK: 285,
  maximumTemperatureK: 305,
  maximumRadiationGy: 0.001,
  maximumSustainedAccelerationG: 4,
  maximumLandingImpactG: 8,
};

const clampNonNegative = (value: number): number => Math.max(0, value);
const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

function validateState(state: AstronautFlightState): string[] {
  const numericValues: Array<[string, number]> = [
    ["elapsedSeconds", state.elapsedSeconds],
    ["oxygenKg", state.oxygenKg],
    ["oxygenConsumptionKgPerSecond", state.oxygenConsumptionKgPerSecond],
    ["electricalEnergyJ", state.electricalEnergyJ],
    ["electricalLoadW", state.electricalLoadW],
    ["electricalGenerationW", state.electricalGenerationW],
    ["cabinPressurePa", state.cabinPressurePa],
    ["cabinTemperatureK", state.cabinTemperatureK],
    ["accumulatedRadiationGy", state.accumulatedRadiationGy],
    ["accelerationG", state.accelerationG],
  ];
  return numericValues
    .filter(([, value]) => !isFiniteNumber(value))
    .map(([name]) => `Invalid or non-finite value: ${name}`);
}

/** Estimate the oxygen reserve required for flight plus an emergency buffer. */
export function requiredOxygenKg(
  consumptionKgPerSecond: number,
  config: SurvivalConfig = DEFAULT_SURVIVAL_CONFIG,
): number {
  return clampNonNegative(consumptionKgPerSecond) *
    (config.expectedFlightSeconds + config.emergencyReserveSeconds);
}

/** Estimate electrical energy required for flight plus an emergency buffer. */
export function requiredEnergyJ(
  loadW: number,
  generationW: number,
  config: SurvivalConfig = DEFAULT_SURVIVAL_CONFIG,
): number {
  return Math.max(0, loadW - generationW) *
    (config.expectedFlightSeconds + config.emergencyReserveSeconds);
}

/** Run before ignition. Any reason blocks launch; warnings alone do not. */
export function evaluatePrelaunch(
  state: AstronautFlightState,
  config: SurvivalConfig = DEFAULT_SURVIVAL_CONFIG,
): SurvivalCheck {
  const reasons = validateState(state);
  const warnings: string[] = [];

  if (reasons.length > 0) {
    return { status: "MISSION_LOSS", launchAllowed: false, reasons, warnings };
  }

  if (state.oxygenKg < requiredOxygenKg(state.oxygenConsumptionKgPerSecond, config)) {
    reasons.push("Oxygen does not cover the planned flight and emergency reserve.");
  }
  if (state.electricalEnergyJ < requiredEnergyJ(state.electricalLoadW, state.electricalGenerationW, config)) {
    reasons.push("Electrical energy does not cover the planned flight and emergency reserve.");
  }
  if (state.cabinPressurePa < config.minimumPressurePa || state.cabinPressurePa > config.maximumPressurePa) {
    reasons.push("Cabin pressure is outside the configured launch range.");
  }
  if (state.cabinTemperatureK < config.minimumTemperatureK || state.cabinTemperatureK > config.maximumTemperatureK) {
    reasons.push("Cabin temperature is outside the configured launch range.");
  }
  if (state.accumulatedRadiationGy > config.maximumRadiationGy) {
    reasons.push("Accumulated radiation exceeds the configured game limit.");
  }
  if (state.accelerationG > config.maximumSustainedAccelerationG) {
    reasons.push("Predicted launch acceleration exceeds the configured game limit.");
  }
  if (!state.restraintsIntact) {
    reasons.push("Crew restraints are not reported as intact.");
  }
  if (state.unrecoverableFlightControlFailure) {
    reasons.push("Flight-control system reports an unrecoverable fault.");
  }

  return {
    status: reasons.length ? "MISSION_LOSS" : "READY",
    launchAllowed: reasons.length === 0,
    reasons,
    warnings,
  };
}

/**
 * Advance resource balances by one simulation step. Call from the existing
 * flight loop; do not call from or modify a minigame.
 */
export function advanceSurvivalState(
  state: AstronautFlightState,
  deltaSeconds: number,
  radiationRateGyPerSecond: number,
): AstronautFlightState {
  const dt = clampNonNegative(deltaSeconds);
  return {
    ...state,
    elapsedSeconds: state.elapsedSeconds + dt,
    oxygenKg: clampNonNegative(
      state.oxygenKg - clampNonNegative(state.oxygenConsumptionKgPerSecond) * dt,
    ),
    electricalEnergyJ: clampNonNegative(
      state.electricalEnergyJ +
      (state.electricalGenerationW - state.electricalLoadW) * dt,
    ),
    accumulatedRadiationGy: clampNonNegative(
      state.accumulatedRadiationGy + clampNonNegative(radiationRateGyPerSecond) * dt,
    ),
  };
}

/**
 * Evaluate the current flight step. A warning/critical fault is not itself a
 * death verdict: only explicit game-loss conditions return MISSION_LOSS.
 */
export function evaluateFlightStep(
  state: AstronautFlightState,
  config: SurvivalConfig = DEFAULT_SURVIVAL_CONFIG,
): SurvivalCheck {
  const reasons = validateState(state);
  const warnings: string[] = [];
  if (reasons.length) {
    return { status: "MISSION_LOSS", launchAllowed: false, reasons, warnings };
  }

  if (state.unrecoverableFlightControlFailure) {
    reasons.push("Unrecoverable flight-control failure.");
  }
  if (!state.restraintsIntact) {
    reasons.push("Crew restraint system failure.");
  }
  if (state.oxygenKg <= 0) {
    reasons.push("Oxygen reserve depleted.");
  }
  if (state.electricalEnergyJ <= 0) {
    reasons.push("Electrical energy depleted.");
  }
  if (state.cabinPressurePa <= 0) {
    reasons.push("Cabin pressure lost completely.");
  }

  if (state.cabinPressurePa < config.minimumPressurePa || state.cabinPressurePa > config.maximumPressurePa) {
    warnings.push("Cabin pressure is outside the normal game range.");
  }
  if (state.cabinTemperatureK < config.minimumTemperatureK || state.cabinTemperatureK > config.maximumTemperatureK) {
    warnings.push("Cabin temperature is outside the normal game range.");
  }
  if (state.accumulatedRadiationGy > config.maximumRadiationGy) {
    warnings.push("Configured radiation dose limit exceeded.");
  }
  if (state.accelerationG > config.maximumSustainedAccelerationG) {
    warnings.push("Acceleration exceeds the configured game limit.");
  }

  if (state.phase === "landing") {
    if (state.landingImpactG === undefined || !Number.isFinite(state.landingImpactG)) {
      warnings.push("Landing impact has not been measured by the flight model.");
    } else if (state.landingImpactG > config.maximumLandingImpactG) {
      reasons.push("Landing impact exceeds the configured unrecoverable-impact limit.");
    }
  }

  if (reasons.length) {
    return { status: "MISSION_LOSS", launchAllowed: false, reasons, warnings };
  }
  if (warnings.length) {
    return { status: "CRITICAL", launchAllowed: false, reasons, warnings };
  }
  return { status: "READY", launchAllowed: true, reasons, warnings };
}

/** Call after the landing model confirms touchdown and recovery requirements. */
export function evaluateLandingSuccess(
  state: AstronautFlightState,
  config: SurvivalConfig = DEFAULT_SURVIVAL_CONFIG,
): SurvivalCheck {
  const check = evaluateFlightStep(state, config);
  if (check.status === "MISSION_LOSS") return check;
  if (state.phase !== "landing") {
    return {
      status: "CRITICAL",
      launchAllowed: false,
      reasons: ["Landing success can only be evaluated during the landing phase."],
      warnings: check.warnings,
    };
  }
  if (check.warnings.length) {
    return {
      status: "CRITICAL",
      launchAllowed: false,
      reasons: ["Touchdown occurred, but recovery checks are not all clear."],
      warnings: check.warnings,
    };
  }
  return { status: "SUCCESS", launchAllowed: false, reasons: [], warnings: [] };
}
