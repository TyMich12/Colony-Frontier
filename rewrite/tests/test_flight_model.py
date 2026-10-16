import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import calculate_flight


class FlightFormulaTests(unittest.TestCase):
    def base_state(self):
        return {
            "elapsed_seconds": 0,
            "oxygen_kg": 8,
            "oxygen_rate_kg_s": 0.001,
            "energy_j": 500000,
            "generation_w": 1200,
            "load_w": 900,
            "cabin_gas_mass_kg": 36,
            "molar_mass_kg_mol": 0.029,
            "cabin_volume_m3": 30,
            "temperature_k": 293.15,
            "heater_w": 0,
            "cooling_w": 0,
            "thermal_capacity_j_k": 120000,
            "radiation_gy": 0,
            "radiation_rate_gy_s": 0.00000001,
            "vehicle_mass_kg": 12000,
            "thrust_n": 150000,
            "drag_n": 10000,
            "throttle_fraction": 0.92,
            "pitch_deg": 0,
            "pitch_trim_deg": 0,
            "angular_velocity_deg_s": 0,
            "altitude_m": 0,
            "vertical_speed_m_s": 0,
            "horizontal_speed_m_s": 0,
            "horizontal_position_m": 0,
            "landing_stopping_distance_m": 10,
            "landing_approach_started": False,
            "restraints_intact": True,
            "flight_control_ok": True,
        }

    def test_oxygen_consumption(self):
        result = calculate_flight({"phase": "ascent", "dt_seconds": 5, "state": self.base_state()})
        self.assertAlmostEqual(result["oxygen_kg"], 7.995)

    def test_cabin_pressure_is_near_one_atmosphere(self):
        result = calculate_flight({"phase": "liftoff", "dt_seconds": 0, "state": self.base_state()})
        self.assertGreater(result["pressure_pa"], 95000)
        self.assertLess(result["pressure_pa"], 105000)

    def test_landing_impact_is_only_calculated_on_touchdown(self):
        state = self.base_state()
        in_flight = calculate_flight({"phase": "descent", "dt_seconds": 0, "state": state})
        approach = calculate_flight({"phase": "landing", "dt_seconds": 0, "state": state})
        self.assertIsNone(in_flight["landing_impact_g"])
        self.assertFalse(approach["touchdown"])
        self.assertIsNone(approach["landing_impact_g"])

    def test_touchdown_calculates_impact_from_actual_vertical_speed(self):
        state = self.base_state()
        state.update({
            "altitude_m": 1,
            "vertical_speed_m_s": -30,
            "landing_approach_started": True,
        })
        result = calculate_flight({"phase": "landing", "dt_seconds": 1, "state": state})
        self.assertTrue(result["touchdown"])
        self.assertIsNotNone(result["landing_impact_g"])
        self.assertLess(result["landing_impact_g"], 8)

    def test_electrical_energy_balance(self):
        state = self.base_state()
        state["load_w"] = 1500
        state["generation_w"] = 1000
        result = calculate_flight({"phase": "ascent", "dt_seconds": 2, "state": state})
        self.assertAlmostEqual(result["energy_j"], 499000)

    def test_preflight_exposes_reserve_and_upward_force_checks(self):
        result = calculate_flight({"phase": "preflight", "dt_seconds": 0, "state": self.base_state()})
        self.assertAlmostEqual(result["required_oxygen_kg"], 0.9)
        self.assertGreaterEqual(result["energy_j"], result["required_energy_j"])
        self.assertGreater(result["net_vertical_force_n"], 0)
        self.assertAlmostEqual(result["pitch_error_deg"], 0)

    def test_pitch_trim_changes_target_and_angular_dynamics(self):
        state = self.base_state()
        state.update({"elapsed_seconds": 10, "pitch_trim_deg": 4})
        result = calculate_flight({"phase": "ascent", "dt_seconds": 1, "state": state})
        self.assertGreater(result["target_pitch_deg"], 4)
        self.assertNotEqual(result["pitch_deg"], 0)
        self.assertNotEqual(result["angular_acceleration_deg_s2"], 0)

    def test_throttle_changes_acceleration_and_force_margin(self):
        state = self.base_state()
        high = calculate_flight({"phase": "liftoff", "dt_seconds": 0, "state": state})
        state["throttle_fraction"] = 0.2
        low = calculate_flight({"phase": "liftoff", "dt_seconds": 0, "state": state})
        self.assertGreater(high["acceleration_g"], low["acceleration_g"])
        self.assertGreater(high["net_vertical_force_n"], low["net_vertical_force_n"])


if __name__ == "__main__":
    unittest.main()
