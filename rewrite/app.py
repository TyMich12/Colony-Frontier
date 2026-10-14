"""Python formula service and static web server for Colony Frontier rewrite.

Python calculates simulation values. Rust is the final authority for alive/loss/success.
All thresholds are illustrative game parameters, not real-world safety limits.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import math
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"
RUST_URL = "http://127.0.0.1:8081/evaluate"
RUST_MISSION_URL = "http://127.0.0.1:8081/evaluate-mission"
G0 = 9.80665


def clamp(value, low, high):
    return max(low, min(high, value))


def calculate_flight(payload):
    """Advance one game step and calculate derived flight quantities."""
    dt = clamp(float(payload.get("dt_seconds", 1.0)), 0.0, 10.0)
    phase = str(payload.get("phase", "liftoff"))
    state = payload.get("state", {})

    # Resource formulae: oxygen usage and electrical energy balance.
    oxygen = max(0.0, float(state.get("oxygen_kg", 8.0)) -
                 max(0.0, float(state.get("oxygen_rate_kg_s", 0.001))) * dt)
    energy = max(0.0, float(state.get("energy_j", 500_000.0)) +
                 (float(state.get("generation_w", 1200.0)) -
                  float(state.get("load_w", 900.0))) * dt)

    temperature = float(state.get("temperature_k", 293.15))
    # Simple thermal balance: net heat divided by effective cabin heat capacity.
    heat_w = float(state.get("heater_w", 0.0)) - float(state.get("cooling_w", 0.0))
    heat_capacity_j_k = max(1.0, float(state.get("thermal_capacity_j_k", 120_000.0)))
    temperature = temperature + heat_w * dt / heat_capacity_j_k

    # Ideal gas law P = nRT/V using the updated cabin temperature.
    gas_mass_kg = max(0.0, float(state.get("cabin_gas_mass_kg", 36.0)))
    molar_mass_kg_mol = max(0.001, float(state.get("molar_mass_kg_mol", 0.029)))
    volume_m3 = max(0.1, float(state.get("cabin_volume_m3", 30.0)))
    moles = gas_mass_kg / molar_mass_kg_mol
    pressure = max(0.0, moles * 8.314462618 * temperature / volume_m3)

    radiation_rate = max(0.0, float(state.get("radiation_rate_gy_s", 0.00000001)))
    radiation = max(0.0, float(state.get("radiation_gy", 0.0)) + radiation_rate * dt)

    # Acceleration from net thrust: a = (thrust - drag) / mass; convert to g.
    mass_kg = max(1.0, float(state.get("vehicle_mass_kg", 12_000.0)))
    thrust_n = max(0.0, float(state.get("thrust_n", 150_000.0)))
    drag_n = max(0.0, float(state.get("drag_n", 10_000.0)))
    acceleration_g = abs((thrust_n - drag_n) / mass_kg) / G0

    # Landing impact approximation: v²/(2s)/g. Only meaningful in landing phase.
    vertical_speed = abs(float(state.get("vertical_speed_m_s", 1.0)))
    stopping_distance = max(0.1, float(state.get("landing_stopping_distance_m", 1.0)))
    impact_g = (vertical_speed * vertical_speed / (2.0 * stopping_distance)) / G0
    if phase != "landing":
        impact_g = None

    result = {
        "phase": phase,
        "elapsed_seconds": max(0.0, float(state.get("elapsed_seconds", 0.0)) + dt),
        "oxygen_kg": oxygen,
        "energy_j": energy,
        "pressure_pa": pressure,
        "temperature_k": temperature,
        "radiation_gy": radiation,
        "acceleration_g": acceleration_g,
        "landing_impact_g": impact_g,
        "restraints_intact": bool(state.get("restraints_intact", True)),
        "flight_control_ok": bool(state.get("flight_control_ok", True)),
    }
    for key, value in result.items():
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError(f"Formula produced a non-finite value for {key}")
    return result


def calculate_mission_survival(payload):
    """Convert existing colony-minigame meters into a report for Rust.

    The colony minigame already owns its resource simulation and event mechanics.
    This function derives a consistent telemetry snapshot without advancing or
    replacing that simulation.
    """
    phase = str(payload.get("phase", "minigame"))
    if phase not in {"minigame", "recovery"}:
        raise ValueError("Unknown colony mission phase")

    state = payload.get("state", {})
    if not isinstance(state, dict):
        raise ValueError("Mission state must be an object")

    def number(key, default=None):
        if key not in state and default is None:
            raise ValueError(f"Missing mission metric: {key}")
        value = float(state.get(key, default))
        if not math.isfinite(value):
            raise ValueError(f"Mission metric {key} must be finite")
        return value

    metrics = {
        "oxygen_percent": number("oxygen"),
        "water_percent": number("water"),
        "food_percent": number("food"),
        "power_percent": number("power"),
        "battery_percent": number("battery"),
        "habitat_percent": number("habitat"),
        "radiation_index": number("radiation"),
        "temperature_c": number("temperature"),
        "battery_minimum_soc_percent": number("battery_minimum_soc_percent", 20.0),
    }
    for key, value in metrics.items():
        if key.endswith("_percent") or key == "radiation_index":
            if not 0.0 <= value <= 100.0:
                raise ValueError(f"Mission metric {key} must be between 0 and 100")
    if not -100.0 <= metrics["temperature_c"] <= 100.0:
        raise ValueError("Mission temperature is outside the model's accepted range")
    if not 0.0 <= metrics["battery_minimum_soc_percent"] <= 100.0:
        raise ValueError("Battery minimum SOC must be between 0 and 100")

    elapsed = float(payload.get("elapsed_seconds", 0.0))
    if not math.isfinite(elapsed) or elapsed < 0.0:
        raise ValueError("Mission elapsed time must be finite and non-negative")

    # Convert the minigame's 0–100 resource meters into illustrative telemetry.
    # These derived values are for consistent game rules, not real vehicle data.
    oxygen_kg = metrics["oxygen_percent"] * 0.08
    energy_j = (
        metrics["battery_percent"] / 100.0 * 400_000.0
        + metrics["power_percent"] / 100.0 * 100_000.0
    )
    pressure_pa = 101_325.0 * (metrics["oxygen_percent"] / 88.0) * (metrics["habitat_percent"] / 94.0)
    temperature_k = metrics["temperature_c"] + 273.15
    radiation_gy = metrics["radiation_index"] / 100.0 * 0.001

    result = {
        "phase": phase,
        "elapsed_seconds": elapsed,
        **metrics,
        "oxygen_kg": oxygen_kg,
        "energy_j": energy_j,
        "pressure_pa": max(0.0, pressure_pa),
        "temperature_k": temperature_k,
        "radiation_gy": radiation_gy,
    }
    if not all(math.isfinite(value) for value in result.values() if isinstance(value, float)):
        raise ValueError("Mission formula produced a non-finite value")
    return result


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def do_POST(self):
        if self.path not in {"/simulate", "/mission-survival"}:
            self.send_error(404, "Unknown endpoint")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 64_000:
                raise ValueError("Request body missing or too large")
            payload = json.loads(self.rfile.read(length))
            if self.path == "/simulate":
                calculated = calculate_flight(payload)
                rust_url = RUST_URL
            else:
                calculated = calculate_mission_survival(payload)
                rust_url = RUST_MISSION_URL
            request = urllib.request.Request(
                rust_url,
                data=json.dumps(calculated).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=2.0) as response:
                verdict = json.loads(response.read().decode("utf-8"))
            self.send_json(200, {"calculated": calculated, "verdict": verdict})
        except urllib.error.URLError:
            self.send_json(503, {"error": "Rust authority is offline. Start the Rust service first."})
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": str(exc)})
        except Exception as exc:
            self.send_json(500, {"error": f"Simulation error: {exc}"})

    def send_json(self, status, body):
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8080), Handler)
    print("Colony Frontier Python service at http://127.0.0.1:8080")
    server.serve_forever()
