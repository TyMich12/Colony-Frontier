use axum::{http::StatusCode, routing::{get, post}, Json, Router};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

#[derive(Debug, Deserialize)]
struct FlightReport {
    phase: String,
    elapsed_seconds: f64,
    oxygen_kg: f64,
    energy_j: f64,
    pressure_pa: f64,
    temperature_k: f64,
    radiation_gy: f64,
    acceleration_g: f64,
    landing_impact_g: Option<f64>,
    restraints_intact: bool,
    flight_control_ok: bool,
    #[serde(default)]
    oxygen_initial_kg: f64,
    #[serde(default)]
    oxygen_rate_kg_s: f64,
    #[serde(default)]
    required_oxygen_kg: f64,
    #[serde(default)]
    energy_initial_j: f64,
    #[serde(default)]
    generation_w: f64,
    #[serde(default)]
    load_w: f64,
    #[serde(default)]
    required_energy_j: f64,
    #[serde(default)]
    pitch_deg: f64,
    #[serde(default)]
    target_pitch_deg: f64,
    #[serde(default)]
    pitch_error_deg: f64,
    #[serde(default)]
    angular_velocity_deg_s: f64,
    #[serde(default)]
    angular_acceleration_deg_s2: f64,
    #[serde(default)]
    altitude_m: f64,
    #[serde(default)]
    vertical_speed_m_s: f64,
    #[serde(default)]
    horizontal_speed_m_s: f64,
    #[serde(default)]
    horizontal_position_m: f64,
    #[serde(default)]
    linear_acceleration_m_s2: f64,
    #[serde(default)]
    thrust_n: f64,
    #[serde(default)]
    vehicle_mass_kg: f64,
    #[serde(default)]
    net_vertical_force_n: f64,
    #[serde(default)]
    throttle_fraction: f64,
    #[serde(default)]
    touchdown: bool,
}

#[derive(Debug, Deserialize)]
struct MissionReport {
    phase: String,
    elapsed_seconds: f64,
    oxygen_percent: f64,
    water_percent: f64,
    food_percent: f64,
    power_percent: f64,
    battery_percent: f64,
    battery_minimum_soc_percent: f64,
    habitat_percent: f64,
    temperature_c: f64,
    radiation_index: f64,
    oxygen_kg: f64,
    energy_j: f64,
    pressure_pa: f64,
    temperature_k: f64,
    radiation_gy: f64,
}

#[derive(Debug, Serialize)]
struct Verdict {
    alive: bool,
    mission_status: String,
    reasons: Vec<String>,
    warnings: Vec<String>,
    critical_count: usize,
    critical_factors: Vec<String>,
    launch_allowed: bool,
}

fn make_verdict(
    alive: bool,
    mission_status: &str,
    reasons: Vec<String>,
    warnings: Vec<String>,
    critical_factors: Vec<String>,
    launch_allowed: bool,
) -> Verdict {
    let critical_count = critical_factors.len();
    Verdict {
        alive,
        mission_status: mission_status.to_string(),
        reasons,
        warnings,
        critical_count,
        critical_factors,
        launch_allowed,
    }
}

fn finite(values: &[f64]) -> bool {
    values.iter().all(|v| v.is_finite())
}

/// A factor is "critical" when it has left its narrow target band.
/// Rust derives this list from calculated telemetry; it never trusts a client count.
fn critical_factors(report: &FlightReport) -> Vec<String> {
    let mut factors = Vec::new();

    if report.oxygen_initial_kg > 0.0 &&
        report.oxygen_kg / report.oxygen_initial_kg < 0.70 {
        factors.push("oxygen reserve".to_string());
    }
    if report.energy_initial_j > 0.0 &&
        report.energy_j / report.energy_initial_j < 0.60 {
        factors.push("electrical reserve".to_string());
    }
    if report.pressure_pa < 90_000.0 || report.pressure_pa > 105_000.0 {
        factors.push("cabin pressure".to_string());
    }
    if report.temperature_k < 293.0 || report.temperature_k > 299.0 {
        factors.push("cabin temperature".to_string());
    }
    if report.radiation_gy > 0.0005 {
        factors.push("radiation dose".to_string());
    }
    if report.acceleration_g > 2.5 {
        factors.push("linear acceleration / crew load".to_string());
    }
    if report.angular_acceleration_deg_s2.abs() > 5.0 {
        factors.push("angular acceleration".to_string());
    }
    if report.pitch_error_deg.abs() > 2.0 {
        factors.push("pitch error".to_string());
    }

    factors
}

fn evaluate_mission(report: MissionReport) -> Verdict {
    let values = [
        report.elapsed_seconds, report.oxygen_percent, report.water_percent,
        report.food_percent, report.power_percent, report.battery_percent,
        report.battery_minimum_soc_percent, report.habitat_percent,
        report.temperature_c, report.radiation_index, report.oxygen_kg,
        report.energy_j, report.pressure_pa, report.temperature_k,
        report.radiation_gy,
    ];
    let mut reasons = Vec::new();
    let mut warnings = Vec::new();

    if !finite(&values) {
        reasons.push("Python supplied a non-finite colony simulation value.".to_string());
    }
    if report.elapsed_seconds < 0.0 ||
       values[1..8].iter().any(|v| *v < 0.0 || *v > 100.0) ||
       report.radiation_index < 0.0 || report.radiation_index > 100.0 {
        reasons.push("Colony telemetry contains an out-of-range resource meter.".to_string());
    }
    if report.temperature_c < -100.0 || report.temperature_c > 100.0 {
        reasons.push("Colony telemetry contains an invalid temperature.".to_string());
    }
    if !report.temperature_c.is_finite() || !report.temperature_k.is_finite() {
        reasons.push("Colony temperature is not finite.".to_string());
    }

    // Preserve the colony minigame's existing survival rules.
    if report.oxygen_percent <= 1.5 {
        reasons.push("Cabin oxygen reserve fell below the minimum safe operating margin.".to_string());
    }
    if report.water_percent <= 1.0 {
        reasons.push("The usable water reserve was exhausted before recovery could be restored.".to_string());
    }
    if report.food_percent <= 1.5 {
        reasons.push("Usable food reserves were exhausted before sustainable production or resupply could be restored.".to_string());
    }
    if report.habitat_percent <= 1.0 {
        reasons.push("Habitat integrity fell below its simulated pressure-boundary limit.".to_string());
    }
    if report.power_percent <= 5.0 &&
       report.battery_percent <= report.battery_minimum_soc_percent + 0.5 {
        reasons.push("Generation cannot sustain the colony and the battery has reached its protected reserve.".to_string());
    }
    if report.temperature_c <= 16.05 || report.temperature_c >= 27.95 {
        reasons.push("Cabin temperature passed the simulated crew-safe operating envelope.".to_string());
    }
    if report.radiation_index >= 90.0 {
        reasons.push("Modelled effective dose rate exceeded the emergency shelter threshold.".to_string());
    }
    if report.oxygen_kg <= 0.0 || report.energy_j < 0.0 || report.pressure_pa < 0.0 {
        reasons.push("Derived colony telemetry contains an impossible negative resource.".to_string());
    }

    if report.pressure_pa < 70_000.0 || report.pressure_pa > 110_000.0 {
        warnings.push("Derived cabin pressure is outside the configured game range.".to_string());
    }
    if report.temperature_k < 285.0 || report.temperature_k > 305.0 {
        warnings.push("Cabin temperature is outside the configured normal range.".to_string());
    }
    if report.radiation_gy > 0.001 {
        warnings.push("Configured radiation warning threshold exceeded.".to_string());
    }

    let alive = reasons.is_empty();
    let mission_status = if !alive {
        "MISSION_LOSS"
    } else if report.phase == "recovery" {
        "SUCCESS"
    } else {
        "IN_PROGRESS"
    };
    make_verdict(alive, mission_status, reasons, warnings, Vec::new(), alive)
}

fn evaluate(report: FlightReport) -> Verdict {
    let values = [
        report.elapsed_seconds, report.oxygen_kg, report.energy_j,
        report.pressure_pa, report.temperature_k, report.radiation_gy,
        report.acceleration_g, report.oxygen_initial_kg, report.oxygen_rate_kg_s,
        report.required_oxygen_kg, report.energy_initial_j, report.generation_w,
        report.load_w, report.required_energy_j, report.pitch_deg,
        report.target_pitch_deg, report.pitch_error_deg, report.angular_velocity_deg_s,
        report.angular_acceleration_deg_s2, report.altitude_m,
        report.vertical_speed_m_s, report.horizontal_speed_m_s,
        report.horizontal_position_m, report.linear_acceleration_m_s2,
        report.thrust_n, report.vehicle_mass_kg, report.net_vertical_force_n,
        report.throttle_fraction,
    ];
    let mut reasons = Vec::new();
    let mut warnings = Vec::new();

    if !finite(&values) {
        reasons.push("Python supplied a non-finite flight telemetry value.".to_string());
    }
    if report.elapsed_seconds < 0.0 || report.oxygen_kg < 0.0 ||
       report.energy_j < 0.0 || report.radiation_gy < 0.0 ||
       report.acceleration_g < 0.0 || report.vehicle_mass_kg < 0.0 ||
       report.altitude_m < 0.0 || report.throttle_fraction < 0.0 ||
       report.throttle_fraction > 1.0 {
        reasons.push("Flight telemetry contains an impossible negative or out-of-range quantity.".to_string());
    }

    let critical = critical_factors(&report);

    // A pre-flight check is a HOLD/READY decision, not a death event.
    if report.phase == "preflight" {
        if report.oxygen_kg < report.required_oxygen_kg {
            reasons.push("Oxygen reserve does not cover the planned flight and emergency buffer.".to_string());
        }
        if report.energy_j < report.required_energy_j {
            reasons.push("Electrical energy does not cover the planned flight and emergency buffer.".to_string());
        }
        if report.pressure_pa < 70_000.0 || report.pressure_pa > 110_000.0 {
            reasons.push("Cabin pressure is outside the launch operating limits.".to_string());
        }
        if report.temperature_k < 285.0 || report.temperature_k > 305.0 {
            reasons.push("Cabin temperature is outside the launch operating limits.".to_string());
        }
        if report.radiation_gy > 0.001 {
            reasons.push("Radiation dose exceeds the configured pre-launch limit.".to_string());
        }
        if report.acceleration_g > 4.0 {
            reasons.push("Predicted crew load exceeds the launch limit.".to_string());
        }
        if report.net_vertical_force_n <= 0.0 {
            reasons.push("Current thrust setting does not provide positive upward force margin.".to_string());
        }
        if !report.flight_control_ok {
            reasons.push("Flight-control system is not ready.".to_string());
        }
        if !report.restraints_intact {
            reasons.push("Crew restraints are not confirmed intact.".to_string());
        }
        if critical.len() >= 4 {
            reasons.push(format!("{} survival factors are outside the target band; reduce this to fewer than four before launch.", critical.len()));
        }
        if !critical.is_empty() {
            warnings.push(format!("Outside target band: {}.", critical.join(", ")));
        }
        let launch_allowed = reasons.is_empty();
        return make_verdict(
            true,
            if launch_allowed { "READY" } else { "HOLD" },
            reasons,
            warnings,
            critical,
            launch_allowed,
        );
    }

    if !report.flight_control_ok {
        reasons.push("Flight control is unrecoverable.".to_string());
    }
    if !report.restraints_intact {
        reasons.push("Crew restraints have failed.".to_string());
    }
    if report.oxygen_kg <= 0.0 {
        reasons.push("Oxygen reserve depleted.".to_string());
    }
    if report.energy_j <= 0.0 {
        reasons.push("Electrical energy depleted.".to_string());
    }
    if report.pressure_pa <= 0.0 {
        reasons.push("Cabin pressure lost.".to_string());
    }
    if critical.len() >= 4 {
        reasons.push(format!("{} survival factors are critical at once. Rust has terminated the flight.", critical.len()));
    }

    if report.pressure_pa < 70_000.0 || report.pressure_pa > 110_000.0 {
        warnings.push("Cabin pressure outside the configured hard limits.".to_string());
    }
    if report.temperature_k < 285.0 || report.temperature_k > 305.0 {
        warnings.push("Cabin temperature outside the configured hard limits.".to_string());
    }
    if report.radiation_gy > 0.001 {
        warnings.push("Configured radiation threshold exceeded.".to_string());
    }
    if report.acceleration_g > 4.0 {
        warnings.push("Configured crew-load threshold exceeded.".to_string());
    }
    if !critical.is_empty() && critical.len() < 4 {
        warnings.push(format!("Critical factors ({}/4): {}.", critical.len(), critical.join(", ")));
    }

    if report.phase == "landing" && report.touchdown {
        match report.landing_impact_g {
            Some(g) if !g.is_finite() => reasons.push("Landing impact is not finite.".to_string()),
            Some(g) if g > 8.0 => reasons.push("Landing impact exceeds the configured game limit.".to_string()),
            None => reasons.push("Touchdown was reported without an impact calculation.".to_string()),
            _ => {}
        }
    }

    let alive = reasons.is_empty();
    let mission_status = if !alive {
        "MISSION_LOSS"
    } else if report.phase == "landing" && report.touchdown {
        "SUCCESS"
    } else if !critical.is_empty() {
        "WARNING"
    } else {
        "IN_FLIGHT"
    };

    make_verdict(alive, mission_status, reasons, warnings, critical, false)
}

async fn evaluate_mission_route(
    Json(report): Json<MissionReport>,
) -> Result<Json<Verdict>, (StatusCode, String)> {
    if report.phase != "minigame" && report.phase != "recovery" {
        return Err((StatusCode::BAD_REQUEST, "Unknown colony mission phase".to_string()));
    }
    Ok(Json(evaluate_mission(report)))
}

async fn health() -> &'static str {
    "Colony Frontier Rust authority online"
}

async fn evaluate_route(
    Json(report): Json<FlightReport>,
) -> Result<Json<Verdict>, (StatusCode, String)> {
    if report.phase != "preflight" && report.phase != "liftoff" &&
       report.phase != "ascent" && report.phase != "descent" &&
       report.phase != "landing" {
        return Err((StatusCode::BAD_REQUEST, "Unknown flight phase".to_string()));
    }
    Ok(Json(evaluate(report)))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/health", get(health))
        .route("/evaluate", post(evaluate_route))
        .route("/evaluate-mission", post(evaluate_mission_route));
    let address = SocketAddr::from(([127, 0, 0, 1], 8081));
    println!("Colony Frontier Rust authority listening on http://{address}");
    let listener = tokio::net::TcpListener::bind(address).await.expect("bind Rust authority");
    axum::serve(listener, app).await.expect("serve Rust authority");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn healthy_report(phase: &str) -> MissionReport {
        MissionReport {
            phase: phase.to_string(),
            elapsed_seconds: 120.0,
            oxygen_percent: 88.0,
            water_percent: 86.0,
            food_percent: 84.0,
            power_percent: 72.0,
            battery_percent: 70.0,
            battery_minimum_soc_percent: 20.0,
            habitat_percent: 94.0,
            temperature_c: 21.0,
            radiation_index: 10.0,
            oxygen_kg: 7.04,
            energy_j: 352_000.0,
            pressure_pa: 101_325.0,
            temperature_k: 294.15,
            radiation_gy: 0.0001,
        }
    }

    fn healthy_flight_report(phase: &str) -> FlightReport {
        FlightReport {
            phase: phase.to_string(),
            elapsed_seconds: 1.0,
            oxygen_kg: 7.49,
            energy_j: 400_000.0,
            pressure_pa: 101_325.0,
            temperature_k: 293.15,
            radiation_gy: 0.00001,
            acceleration_g: 1.5,
            landing_impact_g: None,
            restraints_intact: true,
            flight_control_ok: true,
            oxygen_initial_kg: 7.5,
            oxygen_rate_kg_s: 0.001,
            required_oxygen_kg: 0.9,
            energy_initial_j: 400_000.0,
            generation_w: 1_200.0,
            load_w: 900.0,
            required_energy_j: 10_000.0,
            pitch_deg: 0.0,
            target_pitch_deg: 0.0,
            pitch_error_deg: 0.0,
            angular_velocity_deg_s: 0.0,
            angular_acceleration_deg_s2: 0.0,
            altitude_m: 2.0,
            vertical_speed_m_s: 1.0,
            horizontal_speed_m_s: 0.0,
            horizontal_position_m: 0.0,
            linear_acceleration_m_s2: 1.0,
            thrust_n: 150_000.0,
            vehicle_mass_kg: 9_000.0,
            net_vertical_force_n: 40_000.0,
            throttle_fraction: 0.92,
            touchdown: false,
        }
    }

    #[test]
    fn healthy_colony_remains_in_progress_during_minigame() {
        let verdict = evaluate_mission(healthy_report("minigame"));
        assert!(verdict.alive);
        assert_eq!(verdict.mission_status, "IN_PROGRESS");
        assert!(verdict.reasons.is_empty());
    }

    #[test]
    fn depleted_oxygen_causes_authoritative_mission_loss() {
        let mut report = healthy_report("minigame");
        report.oxygen_percent = 1.0;
        report.oxygen_kg = 0.08;
        let verdict = evaluate_mission(report);
        assert!(!verdict.alive);
        assert_eq!(verdict.mission_status, "MISSION_LOSS");
        assert!(verdict.reasons.iter().any(|reason| reason.contains("oxygen")));
    }

    #[test]
    fn successful_recovery_requires_a_survivable_colony_state() {
        let success = evaluate_mission(healthy_report("recovery"));
        assert!(success.alive);
        assert_eq!(success.mission_status, "SUCCESS");

        let mut failed = healthy_report("recovery");
        failed.temperature_c = 28.0;
        failed.temperature_k = 301.15;
        let failure = evaluate_mission(failed);
        assert!(!failure.alive);
        assert_eq!(failure.mission_status, "MISSION_LOSS");
    }

    #[test]
    fn preflight_returns_ready_without_marking_a_crew_failure() {
        let verdict = evaluate(healthy_flight_report("preflight"));
        assert!(verdict.alive);
        assert!(verdict.launch_allowed);
        assert_eq!(verdict.mission_status, "READY");
    }

    #[test]
    fn three_critical_factors_warn_but_four_end_the_flight() {
        let mut three = healthy_flight_report("ascent");
        three.pressure_pa = 85_000.0;
        three.temperature_k = 280.0;
        three.acceleration_g = 3.0;
        let warned = evaluate(three);
        assert!(warned.alive);
        assert_eq!(warned.critical_count, 3);

        let mut four = healthy_flight_report("ascent");
        four.pressure_pa = 85_000.0;
        four.temperature_k = 280.0;
        four.acceleration_g = 3.0;
        four.pitch_error_deg = 5.0;
        let failed = evaluate(four);
        assert!(!failed.alive);
        assert_eq!(failed.critical_count, 4);
        assert_eq!(failed.mission_status, "MISSION_LOSS");
    }

    #[test]
    fn touchdown_requires_a_safe_impact() {
        let mut report = healthy_flight_report("landing");
        report.touchdown = true;
        report.landing_impact_g = Some(2.0);
        assert_eq!(evaluate(report).mission_status, "SUCCESS");

        let mut report = healthy_flight_report("landing");
        report.touchdown = true;
        report.landing_impact_g = Some(9.0);
        assert_eq!(evaluate(report).mission_status, "MISSION_LOSS");
    }
}
