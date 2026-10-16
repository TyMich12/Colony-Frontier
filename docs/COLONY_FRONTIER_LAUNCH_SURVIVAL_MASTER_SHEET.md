# Colony Frontier — Launch Survival & Flight-Control Master Sheet

**Document type:** Collaborative design and implementation specification  
**Status:** Proposed design; numerical limits are prototype values and must be reconciled with the live model before they become authoritative.

This is a separate document from the **Master System Performance & Upgrade Table**. That existing table covers colony-system performance and upgrades. This sheet covers the crewed rocket's pre-flight checks, survival-factor gauges, player-controlled launch and 2D flight simulation.

## 1. Purpose

The player prepares a crewed rocket, watches a spacecraft-computer diagnostic sequence, and then actively controls the rocket during launch. They must keep survival factors in safe ranges while adjusting pitch and thrust. The interface should look like a spacecraft console, with animated diagnostic text, live gauges and a moving 2D rocket.

Visual effects must never fabricate a check result. JavaScript presents controls and telemetry, Python calculates derived values, and Rust remains the authority for survival and mission outcome.

## 2. Master feature and implementation table

| ID | Feature | What the player sees or does | Required behaviour | Acceptance check |
|---|---|---|---|---|
| LS-01 | Animated diagnostic terminal | Side panel prints checks letter by letter, with cursor and status | Checks run in a stable sequence and end in PASS, WARN, FAIL or NO DATA | Animation can be skipped without changing results |
| LS-02 | Survival-factor gauge | Circular dial or segmented arc with a pointer | Pointer shows current value relative to safe, caution and danger zones | Pointer and numeric reading always agree |
| LS-03 | Green target band | Narrow green section | Shows the preferred operating range | Zone label and units are visible |
| LS-04 | Yellow critical bands | Yellow sections on either side of green when low and high values are both hazardous | Warns that the player must correct the reading | Low-side and high-side hazards are tested separately |
| LS-05 | Red extreme zones | Red sections outside critical bands | Shows severe limit breaches clearly | A factor cannot count as both normal and critical |
| LS-06 | Critical counter | Example: CRITICAL 2 / 3 | Counts distinct factors currently in critical states, not frames spent in a state | One factor is counted once even over many simulation ticks |
| LS-07 | Critical-count outcome | Counter changes from caution to emergency to loss | Three simultaneous critical factors = red emergency; four or more = mission loss | Four distinct critical factors trigger a Rust-authoritative loss verdict |
| LS-08 | Player-controlled launch | Pitch left/right and throttle up/down controls | Controls change rocket orientation and thrust gradually | Input produces visible and measurable changes |
| LS-09 | 2D rocket scene | Side-view rocket, launch pad, horizon, altitude and trajectory cues | Rocket translates, rotates and accelerates in response to the simulation | Scene motion matches telemetry |
| LS-10 | Motion telemetry | Pitch, pitch error, speed, linear acceleration, angular velocity and angular acceleration | Values have units and update from the same state driving the scene | No decorative/random values presented as physics |
| LS-11 | Survival simulation | Oxygen, energy, pressure, temperature, radiation and crew load | Updates during pre-launch and flight | Same snapshot gives consistent results across the app |
| LS-12 | Rust authority | Outcome such as SUCCESS, IN_PROGRESS, WARNING or MISSION_LOSS | Validates telemetry and decides survival/mission state | UI cannot overrule Rust's verdict |
| LS-13 | Python calculation service | Derived flight and survival telemetry | Computes requested calculations and returns structured values | Invalid/non-finite inputs are rejected or safely handled |
| LS-14 | Retry/reset | Restart after failure | Clears timers, controls, telemetry, critical flags and terminal animation | Retry starts from a clean state |
| LS-15 | Readability | Units, text labels, icons and optional reduced motion | Colour is not the only way to identify a state | Every zone also has a text label or icon |

## 3. Gauge and threshold design

Use a segmented circular dial or arc gauge. A pointer marks the current value. The green target band should be relatively narrow. Yellow critical bands sit on either side where both low and high values are hazardous. Red zones sit beyond the critical bands.

Conceptual layout (not to scale):

    EXTREME LOW | LOW / CRITICAL | TARGET | HIGH / CRITICAL | EXTREME HIGH
        RED     |     YELLOW     | GREEN  |     YELLOW      | RED
                                   ▲
                                CURRENT

- **Green — TARGET:** preferred operating range.
- **Yellow — CRITICAL:** dangerous range that needs correction.
- **Red — EXTREME:** severe limit breach.
- Each factor has its own units and limits. Do not use one universal range for every factor.
- Use a one-sided gauge for factors that only have a one-sided hazard.
- Always show a numeric value and unit beside the gauge; colour alone is insufficient.

### 3.1 Proposed prototype thresholds

These are game-balance starting points, not real-world launch certification limits. Reconcile them with the current flight model before implementation.

| Factor | Unit | Green target | Yellow critical | Red extreme | Notes |
|---|---|---|---|---|---|
| Cabin pressure | kPa | 90–105 | 70 to below 90; above 105 to 110 | Below 70 or above 110 | Both too low and too high are unsafe |
| Cabin temperature | K | 293–299 | 285 to below 293; above 299 to 305 | Below 285 or above 305 | Optionally display °C as a secondary value |
| Oxygen reserve | % of planned reserve | 70–100% | 20 to below 70% | Below 20% | One-sided resource gauge |
| Electrical reserve | % of planned reserve | 60–100% | 15 to below 60% | Below 15% | Stored energy is not the same as power |
| Radiation dose | Gy | 0–0.0005 | Above 0.0005 to 0.001 | Above 0.001 | Cumulative dose |
| Linear acceleration / crew load | g | 0–2.5 g during nominal ascent | Above 2.5 to 4 g | Above 4 g | Document which acceleration model is displayed |
| Angular acceleration | deg/s² | 0–5 | Above 5 to 15 | Above 15 | Prototype gameplay limits; tune during playtesting |
| Pitch error | degrees | Within ±2° of target | More than ±2° up to ±8° | Beyond ±8° | Error is relative to the target pitch for the current phase |

**Boundary rule:** Every exact boundary must belong to one and only one zone. Use consistent inclusive/exclusive comparisons and test the boundary values. A factor must not be counted twice.

## 4. Critical-state counting and loss rule

Count **distinct factors currently in the yellow critical or red extreme state**. A factor contributes at most one count, regardless of how many frames it remains unsafe.

| Number of critical factors | UI state | Expected outcome |
|---:|---|---|
| 0 | Green / nominal | Continue normally |
| 1 | Yellow / caution | Name the factor and suggest a correction |
| 2 | Orange / high alert | Increase urgency; continue only if other rules permit |
| 3 | Red / emergency | Alarm and message: one more critical factor will cause mission loss |
| 4 or more | Mission failure | Rust returns the authoritative loss verdict; stop normal flight and offer retry |

The count rule does not automatically define every individual extreme limit. A single red extreme may cause immediate loss only if that factor is explicitly marked as an instant-failure condition in the Rust rules. Document those exceptions and test them.

Recommended state per factor:
- NORMAL: within the green target range.
- CRITICAL: within a yellow band.
- EXTREME: within a red band.
- UNAVAILABLE: no valid reading; treat as a telemetry fault, never as safe.

## 5. Pre-flight terminal / hacker-style checks

Use a side panel that reveals text character by character, with a blinking cursor and restrained scanline/glitch styling. Keep it readable and provide a **Skip animation** control.

Suggested output sequence:

1. [BOOT] Colony Frontier Flight Computer
2. [LINK] Python telemetry bridge ........ CONNECTED
3. [AUTH] Rust mission authority ........ READY
4. [CHECK] Crew oxygen reserve .......... PASS / WARN / FAIL
5. [CHECK] Electrical reserve ........... PASS / WARN / FAIL
6. [CHECK] Cabin pressure ............... PASS / WARN / FAIL
7. [CHECK] Cabin temperature ............ PASS / WARN / FAIL
8. [CHECK] Radiation exposure ........... PASS / WARN / FAIL
9. [CHECK] Flight controls / restraints . PASS / WARN / FAIL
10. [CHECK] Guidance and attitude sensors PASS / WARN / FAIL
11. [CHECK] Thrust and mass model ........ PASS / WARN / FAIL
12. [SUMMARY] N checks passed; N warnings; N failures
13. [GO/NO-GO] LAUNCH AUTHORISED / HOLD

Rules:
- Each line must reveal the real result of the check; animation is presentation only.
- Skipping animation changes presentation speed, never check outcomes.
- If Python or Rust cannot be reached, show NO DATA / HOLD. Never assume the crew is safe.
- Launch is enabled only when all required checks pass and Rust authorises launch.
- A warning can be non-blocking only if the check is explicitly configured as optional.

## 6. Player-controlled 2D launch

### 6.1 Scene requirements

Use a side-on 2D view containing the rocket, launch platform, ground/horizon, altitude cue, direction/velocity indicator and a simple trail or trajectory line. The rocket must visibly translate and rotate; it should not remain fixed while only the background moves. Camera tracking is allowed if altitude and motion remain understandable.

### 6.2 Controls

| Control | Changes | Feedback |
|---|---|---|
| Pitch left / right | Desired rocket orientation | Rocket rotates; pitch and pitch error update |
| Throttle down / up | Commanded thrust | Thrust reading and engine effect change |
| Stabilise / hold attitude | Requests guidance to reduce pitch error | Angular rate should move toward zero |
| Emergency abort, if enabled | Requests an abort/shutdown state | Clear status change; do not imply a safe landing is guaranteed |

Controls need clear labels, keyboard equivalents, sensible limits and visible feedback. Input must not teleport the rocket or set acceleration to arbitrary values instantly.

### 6.3 Flight phases

| Phase | Player task | Main checks |
|---|---|---|
| Pre-launch | Fix warnings and reach a go decision | Reserves, pressure, temperature, radiation, restraints and controls |
| Liftoff | Generate upward acceleration without losing attitude | Thrust versus weight, pitch and linear acceleration |
| Initial ascent | Hold target angle and keep loads within limits | Pitch error, angular rate/acceleration and crew load |
| Climb | Manage thrust and trajectory | Speed, altitude, fuel/energy, thermal and life-support telemetry |
| Approach / landing, if used | Reduce speed and align with target | Descent rate, landing angle and impact load |
| Verdict | Read the final outcome | Rust-authoritative SUCCESS / IN_PROGRESS / WARNING / MISSION_LOSS |

### 6.4 Target angle

The target angle must depend on flight phase, not remain fixed throughout flight. Start near vertical at liftoff, then gradually pitch over during ascent. Show current pitch, target pitch and signed error:

    pitchError = wrapTo180(currentPitch - targetPitch)

The player aims to keep pitch error in the green band. Over-correction should have consequences: the rocket continues rotating according to angular velocity and angular acceleration instead of snapping instantly to the target.

## 7. Core gameplay equations

Use SI units internally and convert only for display.

| Quantity | Prototype equation | Meaning |
|---|---|---|
| Net vertical force | F_net = T·cos(θ) − D_vertical − m·g | Upward thrust component minus drag and weight |
| Vertical acceleration | a_y = F_net / m | Vertical acceleration |
| Horizontal acceleration | a_x = (T·sin(θ) − D_horizontal) / m | Horizontal acceleration |
| Linear acceleration magnitude | a = sqrt(a_x² + a_y²) | Translational acceleration magnitude |
| Simplified crew load | g_load = abs(a_proper) / 9.80665 | Document whether proper or net acceleration is being shown |
| Angular acceleration | α = τ_net / I | Net torque divided by moment of inertia |
| Angular velocity | ω_next = ω + α·dt | Rotation-rate update |
| Pitch angle | θ_next = θ + ω_next·dt | Orientation update |
| Velocity | v_next = v + a·dt | Velocity update |
| Position | p_next = p + v_next·dt | Position update |
| Oxygen reserve | O2_next = max(0, O2_now − consumptionRate·dt) | Oxygen falls with use |
| Electrical energy | E_next = max(0, E_now + (P_generation − P_load)·dt) | Stored energy follows the power balance |
| Cabin pressure | P = (m_gas / M)·R·T / V | Ideal-gas estimate from gas mass, molar mass, temperature and volume |
| Thermal state | T_next = T_now + (P_heater − P_cooling)·dt / C_thermal | Simplified cabin thermal balance |
| Radiation dose | D_next = D_now + doseRate·dt | Cumulative exposure |

These are simplified gameplay equations, not a flight-qualified rocket model. Document the assumptions in code. Use a stable time step where practical, validate units, and reject or safely handle invalid inputs.

## 8. Architecture and source of truth

| Component | Responsibility | Must not do |
|---|---|---|
| JavaScript / React UI | Draw terminal, gauges, controls, 2D rocket and telemetry; collect player input | Make the final survival decision locally |
| Python calculation service | Calculate derived flight telemetry | Override Rust's verdict |
| Rust mission authority | Validate reports and decide survival/mission state | Trust a client-supplied alive flag without validating the report |
| Shared thresholds/config | Define limits, units, zone boundaries and config version | Let UI, Python and Rust silently use conflicting limits |
| Automated tests | Check equations, boundaries, critical counting, invalid values and verdicts | Test only the happy path |

Thresholds should have one documented source and a version identifier. If Python and Rust both need the values, generate both from shared configuration or add tests proving their values match.

## 9. Suggested telemetry contract

Adapt field names to the existing API, but preserve their meaning and units.

| Field | Type / unit | Description |
|---|---|---|
| simulation_time_s | number, seconds | Elapsed simulated time |
| phase | enum/string | Current flight phase |
| mass_kg | number, kg | Current vehicle mass |
| thrust_n | number, N | Commanded/effective thrust |
| pitch_deg | number, degrees | Current rocket pitch |
| target_pitch_deg | number, degrees | Target pitch for current phase |
| angular_velocity_deg_s | number, deg/s | Current pitch rate |
| angular_acceleration_deg_s2 | number, deg/s² | Current pitch acceleration |
| linear_acceleration_m_s2 | number, m/s² | Translational acceleration |
| oxygen_kg | number, kg | Remaining oxygen |
| energy_kj | number, kJ | Remaining electrical energy |
| pressure_kpa | number, kPa | Cabin pressure |
| temperature_k | number, K | Cabin temperature |
| radiation_dose_gy | number, Gy | Accumulated dose |
| critical_factors | list of factor IDs | Distinct factors currently in a critical state |
| telemetry_version | string | Schema/config version |

Treat all client values as untrusted. Rust should recompute or validate important derived values and make the authoritative decision.

## 10. Testing checklist

- [ ] Terminal reveals text character by character and can be skipped without changing results.
- [ ] Missing Python/Rust response produces HOLD / NO DATA, not a pass.
- [ ] Gauge pointer matches its numeric reading.
- [ ] Every factor has tests for all zone boundaries, including exact boundary values.
- [ ] Low-side and high-side hazards are tested separately for two-sided factors.
- [ ] One critical factor stays counted as one across many frames.
- [ ] Three critical factors show red emergency state.
- [ ] Four distinct critical factors cause Rust-authoritative mission loss.
- [ ] Invalid, NaN, infinite, negative or missing readings cannot be treated as safe.
- [ ] Pitch input changes rocket angle smoothly and within limits.
- [ ] Throttle affects thrust and acceleration; acceleration affects velocity; velocity affects position.
- [ ] Angular acceleration changes angular velocity, which changes pitch over time.
- [ ] Target pitch changes by phase and pitch error is correct.
- [ ] Retry resets telemetry, timers, critical flags and animation state.
- [ ] UI, Python and Rust agree on units, thresholds and verdict.

## 11. Suggested implementation order

1. Agree on the threshold table and decide which, if any, red extreme conditions cause instant failure.
2. Implement shared zone/critical-state logic and tests before styling the gauges.
3. Build the terminal and reusable gauge using mock telemetry.
4. Connect gauges to Python calculations and Rust evaluation responses.
5. Build the 2D rocket and wire pitch/throttle controls to simulation state.
6. Add angular dynamics, target-pitch schedule and trajectory feedback.
7. Connect failure, success, retry and existing mission flow.
8. Run the Vite build, Python tests and Rust tests, then manually playtest.

## 12. Decisions for collaborators

| Decision | Recommended starting point | Reason |
|---|---|---|
| Does three critical mean loss? | No: three is red emergency; four or more means loss | Matches the requested “more than 3” rule |
| Can one extreme instantly fail? | Only for explicitly listed hard-failure factors | Avoids hidden conflicts with the count rule |
| Gauge style | Segmented arc with pointer, numeric value and zone label | Readable and close to the requested diagram |
| Terminal animation | Side panel, character-by-character, skip button | Provides the hacker-style look without blocking play |
| Initial target angle | Near vertical at liftoff, then gradual pitch-over | Different phases require different targets |
| Physics fidelity | Simple, documented 2D gameplay model first | Easier to test and tune |
| Threshold values | Treat Section 3.1 as provisional | Must match the current flight model before implementation |
