import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import calculate_mission_survival


class MissionSurvivalFormulaTests(unittest.TestCase):
    def base_state(self):
        return {
            "oxygen": 88,
            "water": 86,
            "food": 84,
            "power": 72,
            "battery": 70,
            "habitat": 94,
            "temperature": 21,
            "radiation": 10,
            "battery_minimum_soc_percent": 20,
        }

    def test_initial_telemetry_has_nominal_pressure(self):
        result = calculate_mission_survival({
            "phase": "minigame",
            "elapsed_seconds": 0,
            "state": self.base_state(),
        })
        self.assertAlmostEqual(result["pressure_pa"], 101325)
        self.assertAlmostEqual(result["temperature_k"], 294.15)
        self.assertEqual(result["phase"], "minigame")

    def test_recovery_phase_is_preserved_for_rust_verdict(self):
        result = calculate_mission_survival({
            "phase": "recovery",
            "elapsed_seconds": 1000,
            "state": self.base_state(),
        })
        self.assertEqual(result["phase"], "recovery")
        self.assertGreater(result["oxygen_kg"], 0)
        self.assertGreater(result["energy_j"], 0)

    def test_out_of_range_resource_meter_is_rejected(self):
        state = self.base_state()
        state["oxygen"] = 101
        with self.assertRaisesRegex(ValueError, "oxygen_percent"):
            calculate_mission_survival({
                "phase": "minigame",
                "elapsed_seconds": 10,
                "state": state,
            })

    def test_non_finite_elapsed_time_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "elapsed time"):
            calculate_mission_survival({
                "phase": "minigame",
                "elapsed_seconds": float("nan"),
                "state": self.base_state(),
            })


if __name__ == "__main__":
    unittest.main()
