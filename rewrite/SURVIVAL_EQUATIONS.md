# Takeoff Survival Equations

This document organizes the survival checks for the **pre-launch / liftoff** phase of Colony Frontier. The limits below are game-balance parameters, not real-world spacecraft certification or medical limits.

## 1. Launch decision

Permit ignition only when all required checks pass:

```text
launch_allowed =
    inputs_are_finite
    AND oxygen_reserve_passes
    AND electrical_reserve_passes
    AND cabin_pressure_passes
    AND cabin_temperature_passes
    AND radiation_passes
    AND acceleration_passes
    AND restraints_intact
    AND flight_controls_ok
    AND (if modelled) positive_liftoff_margin
```

A failed mandatory check blocks launch. A warning should be shown separately from a mission-loss verdict.

## 2. Life support and stored resources

### 2.1 Oxygen reserve

**Required oxygen for planned flight and emergency buffer**

```text
T_required = T_flight + T_emergency
O2_required = r_O2 * T_required
```

Use the following pass condition:

```text
O2_available >= max(O2_minimum, O2_required)
```

Where:
- `O2_available`: oxygen reserve, kg.
- `r_O2`: oxygen consumption, kg/s.
- `T_flight`: expected flight duration, s.
- `T_emergency`: emergency reserve duration, s.
- `O2_minimum`: absolute minimum reserve, kg.

Configured game values: `T_flight = 600 s`, `T_emergency = 300 s`, `O2_minimum = 0.05 kg`. Therefore `T_required = 900 s`. With the default `r_O2 = 0.001 kg/s`, the duration-based requirement is `0.9 kg`; the default starting reserve of `7.5 kg` passes this check.

During flight, update the reserve each time step:

```text
O2_next = max(0, O2_now - r_O2 * dt)
```

### 2.2 Electrical energy

Net electrical deficit:

```text
P_deficit = max(0, P_load - P_generation)
E_required = P_deficit * T_required
```

Recommended pass condition, including a nonzero backup floor:

```text
E_available >= max(E_minimum, E_required)
```

Where:
- `P_load`: total electrical load, W.
- `P_generation`: generation, W.
- `E_available`: stored electrical energy, J.
- `E_minimum`: minimum retained energy, J.

Configured game value: `E_minimum = 10,000 J`. The current JavaScript helper calculates `E_required` but does not yet apply `E_minimum` in its pre-launch condition; using the `max` expression makes the stated minimum effective.

During flight:

```text
E_next = max(0, E_now + (P_generation - P_load) * dt)
```

### 2.3 Cabin pressure

Using the ideal-gas equation:

```text
P = n * R * T / V
n = m_gas / M
P = (m_gas / M) * R * T / V
```

Pass condition:

```text
70,000 Pa <= P <= 110,000 Pa
```

Where:
- `P`: cabin pressure, Pa.
- `m_gas`: cabin gas mass, kg.
- `M`: gas molar mass, kg/mol.
- `R = 8.314462618 J/(mol*K)`: universal gas constant.
- `T`: cabin temperature, K.
- `V`: cabin volume, m³.

The Python flight model recalculates pressure from gas mass, molar mass, temperature and volume. The pressure band is a configurable game rule.

### 2.4 Cabin temperature / thermal control

For one simulation time step:

```text
Q_net = P_heater - P_cooling
T_next = T_now + (Q_net * dt) / C_thermal
```

Pass condition:

```text
285 K <= T <= 305 K
```

Where:
- `P_heater`, `P_cooling`: heater and cooling power, W.
- `C_thermal`: effective thermal capacity, J/K.
- `dt`: time step, s.

The configured band corresponds to approximately `11.85 °C` to `31.85 °C`.

### 2.5 Radiation dose

Accumulated dose:

```text
D_next = D_now + r_D * dt
```

Pass condition:

```text
D_accumulated <= 0.001 Gy
```

Where `r_D` is the modelled dose rate in Gy/s. The configured radiation rate is reduced by higher radiation-protection technology tiers.

## 3. Vehicle dynamics and crew protection

### 3.1 Thrust-axis acceleration / g-load

The Python model currently computes thrust-axis acceleration as:

```text
a_thrust = abs(F_thrust - F_drag) / m_vehicle
g_load = a_thrust / g0
g0 = 9.80665 m/s²
```

Pass condition in the pre-launch helper:

```text
g_load <= 4 g
```

Where thrust and drag are in newtons and vehicle mass is in kilograms. This is the model's simplified thrust-axis load calculation; it is not the same as gravity-adjusted upward acceleration.

### 3.2 Liftoff capability (recommended additional check)

If the simulation is intended to verify that the vehicle can actually rise, check the vertical force margin as well:

```text
F_vertical_net = F_thrust - F_drag - m_vehicle * g0
a_vertical_net = F_vertical_net / m_vehicle
```

Require:

```text
F_vertical_net > 0
```

Equivalently, without drag, thrust-to-weight ratio must exceed one:

```text
TWR = F_thrust / (m_vehicle * g0)
TWR > 1
```

This liftoff-margin check is **not currently implemented** in the flight model. If drag is modelled, checking `F_vertical_net > 0` is the clearer condition.

### 3.3 Restraints and flight controls

These are discrete conditions rather than continuous equations:

```text
restraints_intact == true
flight_control_ok == true
```

A failed restraint or unrecoverable flight-control system blocks launch.

### 3.4 Input validity

Every numeric input used by the equations must be finite:

```text
is_finite(x) = (x is not NaN) AND (x is not +infinity) AND (x is not -infinity)
```

Reject non-finite input before using it in a calculation. Also reject negative physical quantities such as mass, volume, reserve, elapsed time, and consumption rates; clamp only those values the game intentionally allows to reach zero.

## 4. Current configuration summary

| Factor | Configured game check |
|---|---|
| Oxygen | At least the amount needed for 600 s flight + 300 s emergency reserve; recommended absolute floor 0.05 kg |
| Electricity | Enough to cover a modeled deficit; recommended minimum retained energy 10,000 J |
| Cabin pressure | 70–110 kPa |
| Cabin temperature | 285–305 K |
| Radiation dose | At most 0.001 Gy |
| Sustained acceleration | At most 4 g |
| Crew restraints | Must be intact |
| Flight controls | Must be operational |
| Liftoff force margin | Positive net upward force; recommended, not implemented |

## 5. Keep takeoff and landing checks separate

Landing impact is a later-phase check, not a pre-launch check. The current model estimates impact load as:

```text
g_impact = (v_landing² / (2 * s_stopping)) / g0
```

The configured game limit is `g_impact <= 8 g`; apply it only during landing.

## 6. Integration note

The reusable `_shared/astronautSurvival.js` helper contains the pre-launch equations, while `FlightSequence.jsx` currently sends telemetry to Python and Rust through a separate path. The launch screen should call the helper for pre-flight gating, and Python/Rust should use matching definitions for in-flight checks, so the game does not end up with conflicting versions of the same rule.
