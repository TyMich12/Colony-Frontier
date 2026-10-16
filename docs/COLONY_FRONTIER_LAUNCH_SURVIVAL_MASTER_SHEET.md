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

## Master feature and implementation table

This table is copied from the collaborator's launch-survival specification and is the acceptance checklist for the TypeScript implementation on `main`. It describes the required experience, not a requirement to merge the branch's separate Python/Rust services.

| ID | Feature | What the player sees or does | Required behaviour | Acceptance check |
|---|---|---|---|---|
| LS-01 | Animated diagnostic terminal | Flight-computer checks reveal line by line with a cursor and status | Check results are derived from current telemetry; the player can skip the animation | Skipping changes presentation only, not readings or launch eligibility |
| LS-02 | Survival-factor gauge | Envelope summary and individual factor bars | Visual status matches numeric readings | The same telemetry produces the same severity in every display |
| LS-03 | Green target band | Green survival range | Shows preferred operating range | Zone labels and units are visible |
| LS-04 | Yellow critical bands | Amber/yellow warning range | Warns that a reading needs correction | Low/high limits are tested separately where applicable |
| LS-05 | Red extreme zones | Red limit-breach range | Clearly identifies severe readings | A factor is classified in exactly one state |
| LS-06 | Critical counter | Distinct at-risk factor count | Counts each yellow or red factor once, not every simulation frame | A factor remains one count across repeated ticks |
| LS-07 | Critical-count outcome | Caution, emergency, and loss states | 0–2 at-risk factors: continue; 3: emergency; 4+: mission loss | Four distinct at-risk factors trigger failure |
| LS-08 | Player-controlled launch | Throttle and pitch-trim controls | Inputs affect thrust/acceleration and vehicle attitude over time | Changes are gradual and visible |
| LS-09 | 2D rocket scene | Rocket, launch pad, horizon, altitude and trajectory cues | Rocket rises and rotates in response to simulation state | Scene motion agrees with telemetry |
| LS-10 | Motion telemetry | Pitch, target pitch, speed, acceleration, altitude and elapsed time | Values use units and follow the same state as the scene | No random/decorative values are shown as physics |
| LS-11 | Survival simulation | Oxygen, energy, pressure, temperature, radiation and crew-load factors | Updates throughout flight | Resource trends are consistent with controls |
| LS-12 | Authoritative outcome | Success, warning/emergency, or mission loss | The simulation state determines the result | UI cannot report success after the loss condition is met |
| LS-13 | Calculation model | Deterministic local TypeScript flight calculations | Validates finite values and uses documented units | Invalid readings cannot be treated as safe |
| LS-14 | Retry/reset | Restart after failure | Resets telemetry, controls, timers and terminal state | Retry starts from a clean initial state |
| LS-15 | Readability and accessibility | Units, labels, colour plus text, skip control | Colour is not the only way to understand status | All factors show a numeric value and text status |

## Critical-state counting and launch rule

Count **distinct factors currently in either the yellow CRITICAL or red EXTREME state**. Each factor contributes at most one count, regardless of how many simulation ticks it remains outside its target band.

| At-risk factor count | UI state | Outcome |
|---:|---|---|
| 0 | Green / nominal | Continue |
| 1 | Yellow / caution | Name the factor and suggest correction |
| 2 | Orange / high alert | Continue while correcting readings |
| 3 | Red / emergency | Alarm; one more at-risk factor causes mission loss |
| 4 or more | Mission loss | Stop the flight and offer retry |

A red factor inhibits ignition. During flight, an individual red factor does not automatically end the mission in this prototype; four or more distinct yellow/red factors cause loss. This avoids counting the same factor twice or applying undocumented instant-failure rules. Thresholds remain prototype gameplay values, not real-world launch certification limits.

## Threshold language

| State | Colour | Meaning | Rule |
|---|---|---|---|
| **SURVIVAL** | Green | Within the intended operating band | Aim to keep every factor here. |
| **CRITICAL** | Amber / yellow | Outside the target band but not yet at an extreme limit | Counted as one at-risk factor; three at-risk factors trigger emergency. |
| **EXTREME** | Red | Beyond an extreme limit | Launch is inhibited while any red factor is present. In flight, each red factor counts once toward the four-factor loss threshold. |

The circular envelope is a quick stress summary. Each individual factor card is the authoritative display for that factor's state. Yellow and red factors both count once toward the at-risk total, while their severities remain visually distinct.

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

- **Pre-launch:** ignition is disabled if any factor is red/extreme or if four or more factors are at risk.
- **In flight:** mission loss occurs when four or more distinct factors are simultaneously yellow/critical or red/extreme. Three at-risk factors trigger an emergency warning; no undocumented single-factor instant-loss rule is used.
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
- [ ] Skip the diagnostic animation and confirm the report and readings are unchanged.
- [ ] Re-run diagnostics after changing controls and confirm results reflect current readings.
- [ ] Reach three distinct yellow/red factors and confirm emergency state.
- [ ] Reach four distinct yellow/red factors and confirm the run fails.
- [ ] Trigger a red factor before ignition and confirm launch is inhibited.
- [ ] Complete a successful ascent and confirm **Enter colony mission** opens the original minigame.
- [ ] Refresh at the launch screen and verify the pending mission is still available.
- [ ] Repeat with a Mars mission and with a replay.

## Known limitations / next tuning pass

- This is a first playable prototype; it has not yet been verified through a complete manual browser playthrough.
- The survival gauge is a visual stress summary; individual factor states determine the displayed critical / extreme counts.
- The simplified model uses throttle, trim, electrical load, oxygen flow, and heat balance; it does not yet model a real thrust curve, vehicle mass change, aerodynamic drag, gravity turn, staging, or a proper navigation solution.
- The current success condition is a timed ascent, not orbital insertion or a full landing sequence.
- The current main-branch implementation uses TypeScript locally; it does not require separate Python or Rust servers to launch the game. A later backend port should only happen after the feature and its tests are stable.
