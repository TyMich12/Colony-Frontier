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
        .route("/evaluate", post(evaluate_route));
    let address = SocketAddr::from(([127, 0, 0, 1], 8081));
    println!("Rust mission authority listening on http://{address}");
    let listener = tokio::net::TcpListener::bind(address).await.expect("bind Rust authority");
    axum::serve(listener, app).await.expect("serve Rust authority");
}
