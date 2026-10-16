# Colony Frontier — Launch Survival & Flight-Control Master Sheet

**Purpose:** This is the companion document to [Colony Frontier Master System Performance & Upgrade Table](./COLONY_FRONTIER_MASTER_SYSTEM_BALANCE.md). The existing table describes colony hardware and upgrades; this sheet describes the crewed vehicle's launch checks, survival envelope, pilot controls, and the hand-off into the colony mission.

**Implementation status:** The first playable version is implemented on the original `TyMich12/Colony-Frontier` repository's `main` branch in the existing React + TypeScript stack. Python and Rust are intentionally deferred until the feature is complete. Thresholds below are gameplay values for tuning, not flight-certified engineering limits.

## Player flow

1. **Deploy mission.** The loadout is validated and saved using the existing mission runtime.
2. **Fade into launch control.** A dark launch console appears and prints system checks letter by letter, like a flight-computer diagnostic terminal.
3. **Check the envelope.** The player sees the survival gauge, factor readings, and green / amber / red threshold bands.
4. **Set controls.** The player adjusts throttle, pitch trim, electrical load, oxygen flow, and cabin heat balance.
5. **Ignite and fly.** The 2D rocket moves and rotates while the target pitch changes through the ascent profile. Readings update continuously.
6. **Resolve.** Four or more critical factors cause mission loss. A successful 20-second ascent unlocks the existing colony simulation.
7. **Retry if needed.** Failure does not erase the pending mission. The player can change controls and reset the flight.

## Threshold language

| State | Colour | Meaning | Rule |
|---|---|---|---|
| **SURVIVAL** | Green | Within the intended operating band | Aim to keep every factor here. |
| **CRITICAL** | Amber / yellow | Outside the target band but not yet at an extreme limit | Three critical factors are survivable; four or more ends the run. |
| **EXTREME** | Red | Beyond an extreme limit | Launch is inhibited while any red factor is present. In flight, two or more simultaneous extreme factors also cause mission loss. |

The circular envelope is a quick stress summary. Each individual factor card is the authoritative display for that factor's state. Red is not a fourth countable critical level; it is shown separately as an extreme factor.

## Monitored factors

The first implementation tracks eight factors. The bands are deliberately readable rather than pretending to be real spacecraft qualification values.

| Factor | Green / survival band | Amber / critical band | Red / extreme band | Player influence |
|---|---|---|---|---|
| Oxygen reserve | 45–100% | 15–45% | Below 15% or above 115% | Oxygen-flow control changes consumption rate. |
| Electrical reserve | 35–100% | 12–35% | Below 12% or above 115% | Electrical load controls the rate at which stored energy is used. |
| Cabin pressure | 75–115 kPa in this prototype | Below 75 or above 115 kPa | Below 58 or above 130 kPa | Oxygen-flow setting affects the simplified pressure trend. |
| Cabin temperature | 10–32 °C | Below 10 or above 32 °C | Below −2 or above 46 °C | Heat-balance control shifts cabin temperature. |
| Radiation dose | At or below 0.65 mGy | Above 0.65 mGy | Above 1.0 mGy | Accumulates during flight; currently not directly pilot-controlled. |
| Linear acceleration | 0.2–3.2 g | Above 3.2 g, or too low to maintain flight | Above 4.2 g | Throttle is the main influence. |
| Angular acceleration | At or below 8 °/s² | Above 8 °/s² | Above 18 °/s² | Pitch trim affects the gap between vehicle attitude and target. |
| Pitch error | At or below 8° | Above 8° | Above 22° | Pitch trim; the guidance target changes as ascent progresses. |

**Implementation note:** The pressure, oxygen, and temperature relationships are intentionally simplified for gameplay. Values such as pressure and dose need further balancing and physical-model review before a later Python/Rust port. Do not interpret these prototype bands as crew medical advice or real launch criteria.

## Controls and flight model

| Control / value | What it does | Current model |
|---|---|---|
| Main throttle | Raises or lowers thrust and linear acceleration | Acceleration is estimated from throttle, then used to update vertical speed and altitude. |
| Pitch trim | Adds a pilot offset to the guidance target | The target angle changes during ascent; a damped controller updates angular acceleration, angular velocity, and pitch. |
| Electrical load | Represents the electrical draw on the vehicle | Higher load drains the electrical reserve faster. |
| Oxygen flow | Sets the simplified oxygen use / pressure trend | Higher flow consumes more reserve; pressure changes are a simplified gameplay approximation. |
| Cabin heat balance | Adds or removes heat | Positive values warm the cabin; negative values cool it. |
| Radiation | Accumulates with elapsed flight time | Currently a background exposure term, not a controllable system. |

### Equations used by the prototype

These equations explain the gameplay model and are not a full rocket flight-dynamics solver.

- **Angular acceleration:** `alpha = clamp((targetPitch - pitch) × 0.8 - angularVelocity × 1.25, -18, 18)`
- **Angular velocity:** `angularVelocity_next = clamp(angularVelocity + alpha × dt, -22, 22)`
- **Pitch:** `pitch_next = clamp(pitch + angularVelocity × dt, 15°, 105°)`
- **Linear acceleration:** `a_g = clamp(throttle × 3.65 - 0.18, 0.1, 4.1)`
- **Vertical speed:** `v_next = max(0, v + (a_g × 9.80665 × sin(pitch) - 0.08 × 9.80665) × dt)`
- **Altitude:** `h_next = h + v_next × dt`
- **Electrical reserve:** decreases according to the difference between the selected electrical load and a baseline supply term.
- **Oxygen reserve:** decreases in proportion to the selected oxygen-flow setting.
- **Temperature:** changes with heat balance and a small pull toward a nominal cabin temperature.
- **Radiation dose:** increases with elapsed time.

The model updates at 0.2-second simulated intervals. The target pitch starts near vertical and gradually lowers through the ascent. The success gate is currently a 20-second controlled ascent with the vehicle still inside the survival envelope.

## Failure and success conditions

- **Pre-launch:** ignition is disabled if any factor is red/extreme or if four or more factors are critical.
- **In flight:** mission loss occurs at four or more simultaneous critical factors, or two or more simultaneous extreme factors.
- **Success:** the ascent timer reaches 20 seconds without crossing the loss conditions.
- **After success:** the player explicitly selects **Enter colony mission**, which opens the existing `MissionSimulation` screen.
- **After failure:** the player reviews the readings and can reset the flight. The pending mission and loadout remain available.

## Implementation map

| File | Responsibility |
|---|---|
| `artifacts/mockup-sandbox/src/components/mockups/colony-frontier/FlightSequence.tsx` | Diagnostic terminal, survival envelope, factor gauges, 2D rocket, pilot controls, and launch result. |
| `artifacts/mockup-sandbox/src/components/mockups/colony-frontier/MissionLoadout.tsx` | Sends a deployed mission to the new launch sequence. |
| `artifacts/mockup-sandbox/src/components/mockups/colony-frontier/MissionSimulation.tsx` | Existing colony minigame; remains the destination after successful ascent. |
| `artifacts/mockup-sandbox/src/components/mockups/colony-frontier/missionRuntime.ts` | Stores the pending mission and existing mission runtime. |

## Collaborator test checklist

- [ ] Deploy a valid Moon mission and confirm the dark fade-in and typewriter diagnostics appear.
- [ ] Confirm the launch console displays the correct mission number and title.
- [ ] Adjust each control and confirm the readout changes.
- [ ] Keep pitch close to the target during ascent and confirm the rocket visibly rotates and rises.
- [ ] Force an amber reading and confirm the critical counter increments.
- [ ] Reach four critical factors and confirm the run fails.
- [ ] Trigger a red factor before ignition and confirm launch is inhibited.
- [ ] Complete a successful ascent and confirm **Enter colony mission** opens the original minigame.
- [ ] Refresh at the launch screen and verify the pending mission is still available.
- [ ] Repeat with a Mars mission and with a replay.

## Known limitations / next tuning pass

- This is a first playable prototype; it has not yet been verified through a complete manual browser playthrough.
- The survival gauge is a visual stress summary; individual factor states determine the displayed critical / extreme counts.
- The simplified model uses throttle, trim, electrical load, oxygen flow, and heat balance; it does not yet model a real thrust curve, vehicle mass change, aerodynamic drag, gravity turn, staging, or a proper navigation solution.
- The current success condition is a timed ascent, not orbital insertion or a full landing sequence.
- Review the thresholds with collaborators, then centralise the equations and limits before porting the finished feature to Python calculations and Rust-authoritative survival decisions.
