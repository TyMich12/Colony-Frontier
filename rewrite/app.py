"""Python formula service and static web server for Colony Frontier.

Python calculates derived simulation values. Rust owns the final survival verdict.
All numerical limits are illustrative game parameters, not real-world flight rules.
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
R_UNIVERSAL = 8.314462618
PLANNED_FLIGHT_SECONDS = 600.0
EMERGENCY_RESERVE_SECONDS = 300.0
MIN_OXYGEN_KG = 0.05
MIN_ENERGY_J = 10_000.0


def clamp(value, low, high):
    return max(low, min(high, value))


def calculate_flight(payload):
    """Advance a small, deterministic 2D flight model by one time step."""
    phase = str(payload.get("phase", "liftoff"))
    if phase not in {"preflight", "liftoff", "ascent", "descent", "landing"}:
        raise ValueError("Unknown flight phase")
    dt = clamp(float(payload.get("dt_seconds", 1.0)), 0.0, 10.0)
    state = payload.get("state", {})
    if not isinstance(state, dict):
        raise ValueError("Flight state must be an object")

    def number(key, default):
        value = float(state.get(key, default))
        if not math.isfinite(value):
            raise ValueError(f"Flight input {key} must be finite")
        return value

    elapsed = max(0.0, number("elapsed_seconds", 0.0))
    oxygen_before = max(0.0, number("oxygen_kg", 7.5))
    energy_before = max(0.0, number("energy_j", 400_000.0))
    oxygen_initial = max(MIN_OXYGEN_KG, number("oxygen_initial_kg", oxygen_before))
    energy_initial = max(MIN_ENERGY_J, number("energy_initial_j", energy_before))
    oxygen_rate = max(0.0, number("oxygen_rate_kg_s", 0.001))
    generation_w = max(0.0, number("generation_w", 1_200.0))
    load_w = max(0.0, number("load_w", 900.0))

    # Life support: reserve balances and cabin thermal state.
    oxygen = max(0.0, oxygen_before - oxygen_rate * dt)
    energy = max(0.0, energy_before + (generation_w - load_w) * dt)
    temperature = number("temperature_k", 293.15)
    heater_w = number("heater_w", 0.0)
    cooling_w = number("cooling_w", 0.0)
    thermal_capacity = max(1.0, number("thermal_capacity_j_k", 120_000.0))
    temperature += (heater_w - cooling_w) * dt / thermal_capacity

    # Ideal gas approximation for a sealed cabin.
    gas_mass = max(0.0, number("cabin_gas_mass_kg", 36.0))
    molar_mass = max(0.001, number("molar_mass_kg_mol", 0.029))
    cabin_volume = max(0.1, number("cabin_volume_m3", 30.0))
    pressure = max(0.0, (gas_mass / molar_mass) * R_UNIVERSAL * temperature / cabin_volume)

    radiation_rate = max(0.0, number("radiation_rate_gy_s", 1e-8))
    radiation = max(0.0, number("radiation_gy", 0.0) + radiation_rate * dt)

    # Guidance pitch is measured away from vertical. The player adjusts a trim
    # offset; the guidance target changes by flight phase.
    elapsed_next = elapsed + dt
    if phase in {"preflight", "liftoff"}:
        phase_target_pitch = 0.0
    elif phase == "ascent":
        phase_target_pitch = clamp((elapsed_next - 8.0) * 0.6, 0.0, 18.0)
    elif phase == "descent":
        phase_target_pitch = 70.0
    else:
        phase_target_pitch = 0.0
    pitch_trim = clamp(number("pitch_trim_deg", 0.0), -12.0, 12.0)
    target_pitch = clamp(phase_target_pitch + pitch_trim, -15.0, 82.0)
    pitch = clamp(number("pitch_deg", 0.0), -89.0, 89.0)
    angular_velocity = clamp(number("angular_velocity_deg_s", 0.0), -30.0, 30.0)
    angular_acceleration = clamp((target_pitch - pitch) * 1.4 - angular_velocity * 1.6, -8.0, 8.0)
    if dt > 0.0:
        angular_velocity = clamp(angular_velocity + angular_acceleration * dt, -30.0, 30.0)
        pitch = clamp(pitch + angular_velocity * dt, -89.0, 89.0)
    pitch_error = target_pitch - pitch

    # Entering the surface approach is a deliberate gameplay time cut: the
    # preceding ascent/descent represents the transfer trajectory. The final
    # approach then models a short, player-controlled landing window.
    landing_started = bool(state.get("landing_approach_started", False))
    altitude = max(0.0, number("altitude_m", 0.0))
    vertical_speed = number("vertical_speed_m_s", 0.0)
    horizontal_speed = number("horizontal_speed_m_s", 0.0)
    horizontal_position = number("horizontal_position_m", 0.0)
    if phase == "landing" and not landing_started:
        altitude = 350.0
        vertical_speed = -18.0
        horizontal_speed = 0.0
        landing_started = True

    mass = max(1.0, number("vehicle_mass_kg", 9_000.0))
    throttle = clamp(number("throttle_fraction", 0.92), 0.0, 1.0)
    base_thrust = max(0.0, number("thrust_n", 150_000.0))
    thrust = base_thrust * throttle
    base_drag = max(0.0, number("drag_n", 10_000.0))
    pitch_rad = math.radians(pitch)
    # Quadratic aerodynamic drag keeps high-speed lateral movement bounded.
    drag_x = 0.15 * horizontal_speed * abs(horizontal_speed)
    drag_y_dynamic = 0.15 * vertical_speed * abs(vertical_speed)
    force_x = thrust * math.sin(pitch_rad) - drag_x
    force_y = thrust * math.cos(pitch_rad) - base_drag - drag_y_dynamic
    acceleration_x = force_x / mass
    acceleration_y = force_y / mass - G0
    proper_acceleration_g = math.hypot(force_x, force_y) / mass / G0
    net_vertical_force = force_y - mass * G0

    if dt > 0.0:
        horizontal_speed += acceleration_x * dt
        vertical_speed += acceleration_y * dt
        horizontal_position += horizontal_speed * dt
        altitude += vertical_speed * dt

    touchdown = False
    impact_g = None
    stopping_distance = max(0.1, number("landing_stopping_distance_m", 10.0))
    if phase == "landing" and altitude <= 0.0:
        impact_speed = abs(vertical_speed)
        impact_g = (impact_speed * impact_speed / (2.0 * stopping_distance)) / G0
        touchdown = True
        altitude = 0.0
        vertical_speed = 0.0
    elif phase != "landing":
        altitude = max(0.0, altitude)

    required_oxygen = max(MIN_OXYGEN_KG, oxygen_rate * (PLANNED_FLIGHT_SECONDS + EMERGENCY_RESERVE_SECONDS))
    required_energy = max(MIN_ENERGY_J, max(0.0, load_w - generation_w) *
                          (PLANNED_FLIGHT_SECONDS + EMERGENCY_RESERVE_SECONDS))

    result = {
        "phase": phase,
        "elapsed_seconds": elapsed_next,
        "oxygen_kg": oxygen,
        "oxygen_initial_kg": oxygen_initial,
        "oxygen_rate_kg_s": oxygen_rate,
        "required_oxygen_kg": required_oxygen,
        "energy_j": energy,
        "energy_initial_j": energy_initial,
        "generation_w": generation_w,
        "load_w": load_w,
        "required_energy_j": required_energy,
        "pressure_pa": pressure,
        "temperature_k": temperature,
        "radiation_gy": radiation,
        "acceleration_g": proper_acceleration_g,
        "linear_acceleration_m_s2": math.hypot(acceleration_x, acceleration_y),
        "landing_impact_g": impact_g,
        "touchdown": touchdown,
        "restraints_intact": bool(state.get("restraints_intact", True)),
        "flight_control_ok": bool(state.get("flight_control_ok", True)),
        "pitch_deg": pitch,
        "target_pitch_deg": target_pitch,
        "pitch_error_deg": pitch_error,
        "angular_velocity_deg_s": angular_velocity,
        "angular_acceleration_deg_s2": angular_acceleration,
        "altitude_m": altitude,
        "vertical_speed_m_s": vertical_speed,
        "horizontal_speed_m_s": horizontal_speed,
        "horizontal_position_m": horizontal_position,
        "thrust_n": thrust,
        "vehicle_mass_kg": mass,
        "net_vertical_force_n": net_vertical_force,
        "throttle_fraction": throttle,
        "landing_approach_started": landing_started,
    }
    for key, value in result.items():
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError(f"Formula produced a non-finite value for {key}")
    return result


def calculate_mission_survival(payload):
    """Convert existing colony-minigame meters into a report for Rust."""
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

    # These equivalents connect the minigame's meters to one telemetry contract.
    oxygen_kg = metrics["oxygen_percent"] * 0.08
    energy_j = metrics["battery_percent"] / 100.0 * 400_000.0 + metrics["power_percent"] / 100.0 * 100_000.0
    pressure_pa = 101_325.0 * (metrics["oxygen_percent"] / 88.0) * (metrics["habitat_percent"] / 94.0)
    temperature_k = metrics["temperature_c"] + 273.15
    radiation_gy = metrics["radiation_index"] / 100.0 * 0.001
    result = {
        "phase": phase, "elapsed_seconds": elapsed, **metrics,
        "oxygen_kg": oxygen_kg, "energy_j": energy_j,
        "pressure_pa": max(0.0, pressure_pa), "temperature_k": temperature_k,
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
