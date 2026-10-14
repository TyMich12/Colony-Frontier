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


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def do_POST(self):
        if self.path != "/simulate":
            self.send_error(404, "Unknown endpoint")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 64_000:
                raise ValueError("Request body missing or too large")
            payload = json.loads(self.rfile.read(length))
            calculated = calculate_flight(payload)
            request = urllib.request.Request(
                RUST_URL,
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
