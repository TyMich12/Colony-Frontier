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
            "vertical_speed_m_s": 1,
            "landing_stopping_distance_m": 1,
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

    def test_landing_impact_is_only_returned_for_landing(self):
        state = self.base_state()
        flight = calculate_flight({"phase": "descent", "dt_seconds": 0, "state": state})
        landing = calculate_flight({"phase": "landing", "dt_seconds": 0, "state": state})
        self.assertIsNone(flight["landing_impact_g"])
        self.assertGreaterEqual(landing["landing_impact_g"], 0)

    def test_electrical_energy_balance(self):
        state = self.base_state()
        state["load_w"] = 1500
        state["generation_w"] = 1000
        result = calculate_flight({"phase": "ascent", "dt_seconds": 2, "state": state})
        self.assertAlmostEqual(result["energy_j"], 499000)


if __name__ == "__main__":
    unittest.main()
