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

    // These failure conditions mirror the existing minigame's resource rules.
    // The minigame still simulates resources and events; Rust owns the verdict.
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
    Verdict { alive, mission_status: mission_status.to_string(), reasons, warnings }
}

#[derive(Debug, Serialize)]
struct Verdict {
    alive: bool,
    mission_status: String,
    reasons: Vec<String>,
    warnings: Vec<String>,
}

fn finite(values: &[f64]) -> bool {
    values.iter().all(|v| v.is_finite())
}

fn evaluate(report: FlightReport) -> Verdict {
    let values = [
        report.elapsed_seconds, report.oxygen_kg, report.energy_j,
        report.pressure_pa, report.temperature_k, report.radiation_gy,
        report.acceleration_g,
    ];
    let mut reasons = Vec::new();
    let mut warnings = Vec::new();

    if !finite(&values) {
        reasons.push("Python supplied a non-finite simulation value.".to_string());
    }
    if report.elapsed_seconds < 0.0 || report.oxygen_kg < 0.0 ||
       report.energy_j < 0.0 || report.radiation_gy < 0.0 ||
       report.acceleration_g < 0.0 {
        reasons.push("Simulation state contains an impossible negative quantity.".to_string());
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

    if report.pressure_pa < 70_000.0 || report.pressure_pa > 110_000.0 {
        warnings.push("Cabin pressure outside the configured game range.".to_string());
    }
    if report.temperature_k < 285.0 || report.temperature_k > 305.0 {
        warnings.push("Cabin temperature outside the configured game range.".to_string());
    }
    if report.radiation_gy > 0.001 {
        warnings.push("Configured radiation threshold exceeded.".to_string());
    }
    if report.acceleration_g > 4.0 {
        warnings.push("Configured acceleration threshold exceeded.".to_string());
    }
    if report.phase == "landing" {
        match report.landing_impact_g {
            Some(g) if !g.is_finite() => reasons.push("Landing impact is not finite.".to_string()),
            Some(g) if g > 8.0 => reasons.push("Landing impact exceeds the configured game limit.".to_string()),
            None => warnings.push("Landing impact has not been calculated.".to_string()),
            _ => {}
        }
    }

    let alive = reasons.is_empty();
    let mission_status = if !alive {
        "MISSION_LOSS"
    } else if !warnings.is_empty() {
        "WARNING"
    } else if report.phase == "landing" {
        "SUCCESS"
    } else {
        "IN_FLIGHT"
    };

    Verdict { alive, mission_status: mission_status.to_string(), reasons, warnings }
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
    if report.phase != "liftoff" && report.phase != "ascent" &&
       report.phase != "descent" && report.phase != "landing" {
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
    println!("Rust mission authority listening on http://{address}");
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
}
