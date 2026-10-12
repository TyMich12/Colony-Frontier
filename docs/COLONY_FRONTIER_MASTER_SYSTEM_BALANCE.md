# Colony-Frontier — Master System Performance & Upgrade Table

**Status: design baseline for review; not yet wired into live gameplay.** These are explicit game-balance targets under standard reference conditions, not claims that one real spacecraft design would achieve every rating. Before implementation, reconcile these targets with retrofit installation recipes, power draw, inventory, and the current simulation.

## How to read the table

- Every triplet is **0/2 → 1/2 → 2/2** for that tier.
- Tier order is **Foundation → Frontier → Apex → Research**.
- A tier is a major equipment replacement / technology-generation jump. Its 0/2 value should normally exceed the previous tier's 2/2 value by a clear margin.
- A retrofit is a small, locally installed improvement. Its steps should be smaller than a tier jump and have a concrete mechanism.
- “Higher is better” metrics increase; “lower is better” metrics decrease.
- Daily throughput uses a standard 24-hour simulation day. It must be converted to the game's accelerated clock consistently.
- These are target values. Do not combine them with old direct-gain retrofit bonuses until the implementation is reconciled; otherwise improvements may be counted twice.

## Main system ratings

| System | Primary metric | Unit / direction | Foundation 0/2 → 1/2 → 2/2 | Frontier 0/2 → 1/2 → 2/2 | Apex 0/2 → 1/2 → 2/2 | Research 0/2 → 1/2 → 2/2 |
|---|---|---|---:|---:|---:|---:|
| Solar Power | Rated electrical output at reference illumination | kW, higher | 12 → 12.4 → 12.8 | 20 → 20.6 → 21.2 | 32 → 33 → 34 | 50 → 52 → 54 |
| Energy Storage | Nominal stored energy capacity | kWh, higher | 1,200 → 1,240 → 1,280 | 1,800 → 1,860 → 1,920 | 3,000 → 3,100 → 3,200 | 5,000 → 5,200 → 5,400 |
| Oxygen | Oxygen production rate | kg O₂/day, higher | 3.0 → 3.1 → 3.2 | 4.2 → 4.3 → 4.4 | 5.8 → 6.0 → 6.2 | 8.0 → 8.2 → 8.4 |
| Water | Potable-water recovery efficiency | %, higher; cap 100% | 60 → 61 → 62 | 72 → 73 → 74 | 88 → 89 → 90 | 98 → 98.2 → 98.4 |
| CO₂ Control | Carbon-dioxide removal rate | kg CO₂/day, higher | 3.0 → 3.1 → 3.2 | 4.5 → 4.6 → 4.7 | 6.5 → 6.7 → 6.9 | 9.0 → 9.2 → 9.4 |
| Thermal Control | Heat rejection capacity | kW heat, higher | 4.0 → 4.1 → 4.2 | 7.0 → 7.2 → 7.4 | 12.0 → 12.4 → 12.8 | 20.0 → 20.5 → 21.0 |
| Communications | Usable data throughput | Mbps, higher | 2.0 → 2.1 → 2.2 | 12 → 12.5 → 13 | 50 → 52 → 54 | 200 → 210 → 220 |
| Habitat | Pressure loss through standard small seal fault | kPa/24 h lost, lower | 8.0 → 7.8 → 7.6 | 4.0 → 3.9 → 3.8 | 1.5 → 1.45 → 1.4 | 0.30 → 0.28 → 0.26 |
| Radiation | Dose avoided during defined reference solar-particle event | % of reference-event dose, higher | 10 → 10.5 → 11 | 18 → 18.5 → 19 | 30 → 31 → 32 | 50 → 51 → 52 |
| Rovers | Safe speed on reference rough terrain | km/h, higher | 2.0 → 2.1 → 2.2 | 4.0 → 4.1 → 4.2 | 7.0 → 7.2 → 7.4 | 12.0 → 12.3 → 12.6 |
| Resource Extraction | Regolith excavated under reference conditions | kg/24 h sim day, higher | 100 → 105 → 110 | 250 → 260 → 270 | 600 → 620 → 640 | 1,500 → 1,550 → 1,600 |
| ISRU | Usable target product output under standard recipe | kg product/24 h sim day, higher | 1.0 → 1.1 → 1.2 | 5.0 → 5.2 → 5.4 | 15 → 15.5 → 16 | 40 → 42 → 44 |
| Agriculture | Edible dry-food-equivalent yield | kg/day, higher | 0.50 → 0.52 → 0.54 | 1.8 → 1.85 → 1.9 | 4.0 → 4.1 → 4.2 | 8.0 → 8.2 → 8.4 |
| Maintenance | Condition points restored by standard maintenance job | condition points/job, higher | 5.0 → 5.5 → 6.0 | 15 → 15.5 → 16 | 35 → 36 → 37 | 60 → 62 → 64 |
| Power Grid | Continuous power-transfer capacity | kW, higher | 8.0 → 8.3 → 8.6 | 22 → 23 → 24 | 50 → 52 → 54 | 120 → 125 → 130 |
| Science | Detailed sample assays completed | assays/24 h sim day, higher | 2.0 → 2.1 → 2.2 | 8.0 → 8.3 → 8.6 | 24 → 25 → 26 | 60 → 63 → 66 |
| Navigation | Horizontal position error under reference terrain conditions | m error, lower | 50 → 48 → 46 | 15 → 14.5 → 14 | 3.0 → 2.8 → 2.6 | 0.20 → 0.18 → 0.16 |

## Additional system metrics

| System | Additional metric | Unit / direction | Foundation 0/2 → 1/2 → 2/2 | Frontier 0/2 → 1/2 → 2/2 | Apex 0/2 → 1/2 → 2/2 | Research 0/2 → 1/2 → 2/2 |
|---|---|---|---:|---:|---:|---:|
| Energy Storage | Maximum continuous discharge power | kW, higher | 10 → 10.2 → 10.4 | 22 → 23 → 24 | 45 → 47 → 49 | 100 → 105 → 110 |
| Energy Storage | Maximum continuous charge power | kW, higher | 10 → 10.2 → 10.4 | 22 → 23 → 24 | 45 → 47 → 49 | 100 → 105 → 110 |
| Water | Wastewater treatment throughput | L/24 h sim day, higher | 100 → 103 → 106 | 250 → 260 → 270 | 600 → 620 → 640 | 1,500 → 1,550 → 1,600 |
| Oxygen | Delivered oxygen purity | %, higher | 90 → 91 → 92 | 98 → 98.2 → 98.4 | 99.5 → 99.6 → 99.7 | 99.99 → 99.995 → 99.999 |
| Communications | Link availability on a clear reference path | %, higher | 80 → 81 → 82 | 94 → 94.5 → 95 | 98.5 → 98.7 → 98.9 | 99.9 → 99.92 → 99.94 |
| Power Grid | Power-conversion efficiency | %, higher | 85 → 86 → 87 | 94 → 94.5 → 95 | 98 → 98.2 → 98.4 | 99.5 → 99.6 → 99.7 |
| Rovers | Safe traverse range per charge | km, higher | 5.0 → 5.2 → 5.4 | 18 → 18.5 → 19 | 40 → 42 → 44 | 100 → 105 → 110 |
| ISRU | Product purity after processing | %, higher | 80 → 81 → 82 | 94 → 94.5 → 95 | 99 → 99.1 → 99.2 | 99.9 → 99.92 → 99.94 |
| Science | Valid-result accuracy on reference standards | %, higher | 85 → 86 → 87 | 95 → 95.5 → 96 | 99 → 99.2 → 99.4 | 99.9 → 99.92 → 99.94 |
| Agriculture | Freshwater consumed per kg dry-food-equivalent | L/kg, lower | 30 → 29 → 28 | 18 → 17.5 → 17 | 9.0 → 8.7 → 8.4 | 4.0 → 3.9 → 3.8 |
| ISRU | Product recovery from target feedstock | % theoretical yield, higher | 15 → 16 → 17 | 42 → 43 → 44 | 72 → 73 → 74 | 95 → 96 → 97 |

## What each tier means

| Tier | Engineering meaning | What should change in gameplay |
|---|---|---|
| **Foundation** | Robust, relatively simple, Earth-manufactured baseline hardware | Affordable and maintainable, but lower throughput, efficiency, redundancy, or precision. Suitable for getting the outpost running, not comfortably supporting every optional system at once. |
| **Frontier** | Improved components, better controls and materials, more capable actuators/processors | A meaningful step up: greater throughput, lower losses, better reliability, and fewer bottlenecks. It should be clearly better than a fully retrofitted Foundation system. |
| **Apex** | High-performance hardware with advanced control, improved thermal/material design, and stronger fault tolerance | Large gains to capacity and efficiency; supports heavier workloads and more demanding mission tasks. Higher purchase/launch mass, complexity, and potentially higher electrical draw are reasonable trade-offs. |
| **Research** | Cutting-edge, tightly integrated experimental equipment | The largest capability jump and best specialist performance. May be expensive, harder to maintain, use more power, or require advanced support systems. It should feel exceptional, not magically free of constraints. |

## What each retrofit level means

- **0/2 — stock hardware:** no locally installed retrofit kit.
- **1/2 — first field retrofit:** one focused improvement, such as better seals, a calibrated controller, a filter insert, a sensor, or a replaceable wear component.
- **2/2 — second field retrofit:** a further compatible improvement to the same system, not a duplicate full upgrade. It should provide a smaller additional gain than changing to a higher tier.

A retrofit must be an actual installed component or adjustment. It consumes local inventory/materials, commissioning energy, and simulation time. It must **not** silently repair damage, apply an unrelated percentage multiplier, or give the same benefit twice.

## Retrofit mechanisms and intended gameplay effects by system

| System | 0/2 → 1/2: first retrofit | 1/2 → 2/2: second retrofit | Tier upgrade should mainly improve |
|---|---|---|---|
| Solar Power | Clean/replace optical covers and calibrate array pointing; reduces dust/pointing losses in live output | Service hinges, actuators, and string-bypass controls; improves tracking and fault isolation | Rated array capacity, cell/array design, and controller capability |
| Energy Storage | Balance cells and calibrate battery-management limits; improves usable capacity modestly | Improve thermal interfaces and power electronics; raises safe charge/discharge capability | Pack capacity, power delivery, cycle life, and thermal management |
| Oxygen | Install a better catalyst/filter cartridge; modestly improves production or purity | Calibrate gas controls and improve contaminant monitoring; improves purity/stability | Electrolyser or oxygen-generation capacity and gas quality |
| Water | Fit a higher-performance filter/membrane insert; improves recovery slightly | Calibrate sensors and seal/flow controls; improves throughput and reduces losses | Recovery process, throughput, and water quality |
| CO₂ Control | Replace sorbent bed or filter media; improves removal rate | Calibrate regeneration and airflow controls; improves sustained removal | Sorbent capacity, regeneration rate, and removal throughput |
| Thermal Control | Improve loop seals/flow balancing; improves heat transfer modestly | Tune pump/valve controls and radiator deployment; increases effective rejection | Radiator area, coolant-loop capacity, and pump capability |
| Communications | Calibrate antenna pointing and connectors; improves usable link performance | Upgrade local amplifier/filter and timing calibration; improves throughput/availability | Antenna gain, radio/modem generation, and data rate |
| Habitat | Install a seal/gasket reinforcement kit; lowers leak rate | Add a secondary seal patch/pressure-monitor calibration; lowers leak rate further | Pressure-vessel/seal design and fault tolerance |
| Radiation | Add locally available shielding panels/regolith placement aids; improves event-specific dose reduction | Improve shielding coverage and monitoring/placement verification; small further gain | Shield material/layout and protected volume; account for secondary radiation and mass |
| Rovers | Tune wheel alignment/suspension and traction control; improves safe speed on reference terrain | Calibrate navigation/drive controls and improve wheel protection; modest speed/range gain | Drive train, suspension, sensors, battery, and terrain capability |
| Resource Extraction | Replace bucket teeth/cutting edge; improves excavation throughput | Tune feed control and service the conveyor/drive; improves throughput and jam resistance | Excavator size, drive torque, and material-handling capacity |
| ISRU | Replace catalyst/reactor insert; improves recipe-specific product output or recovery | Calibrate process sensors and seals; improves purity and repeatability | Reactor throughput, process control, and recipe capability |
| Agriculture | Tune irrigation emitters and root-zone flow; reduces freshwater per kg | Improve nutrient dosing and environmental sensing; improves yield stability/efficiency | Growing area, lighting, environmental control, and crop-system capability |
| Maintenance | Install improved tool/consumable kit; restores slightly more condition per job | Calibrate diagnostic tools and add precision service attachments; further improves repair quality | Tool capability, diagnostic coverage, and repair throughput |
| Power Grid | Replace connectors and balance branch loads; improves transfer/efficiency modestly | Calibrate converters and protective controls; improves transfer and fault isolation | Bus/converter capacity, cable rating, efficiency, and protection |
| Science | Add analyser insert/reference standards; improves assay throughput or quality | Calibrate optics/sensors and improve sample handling; improves valid results and repeatability | Instrument sensitivity, assay throughput, and measurement capability |
| Navigation | Calibrate inertial/ranging sensors; reduces position error | Add/tune timing and sensor-fusion module; reduces error further | Sensor suite, mapping, reference quality, and navigation algorithm |

## Balancing rules before coding

1. **One authoritative number per metric and state.** The live simulation, system inspector, retrofit preview, and status dashboard should all read the same value.
2. **Do not stack old direct gains on top of this table.** Decide whether a retrofit changes the selected table state or adds a separately displayed effect. Do one, not both.
3. **Tier changes must be a real equipment choice.** They should affect the appropriate capabilities and can carry mass, credit, support, and electrical-demand trade-offs.
4. **Capacity is not consumption.** Solar output, battery capacity, battery charge/discharge power, grid transfer capacity, and system electrical draw are separate quantities.
5. **Respect physical caps.** Percentages cannot exceed 100%; purity/efficiency values near 100% should have diminishing returns. A shield's event-specific protection is not universal radiation protection.
6. **Use the right clock and units.** Do not label a 24-hour throughput as per 10-second simulation tick. Convert it explicitly at the simulation boundary.
7. **Lower-is-better metrics must stay lower after upgrades.** Examples: habitat leak rate, navigation error, and water use per kg food.
8. **Power budget must be rebalanced after tier effects are connected.** Higher-tier equipment may draw more electricity; an upgrade must not increase output while accidentally leaving all operating costs unchanged.
9. **The standalone repair/mitigation option remains genuinely standalone.** It must require no other systems; optional/integrated options may use their stated support systems.
10. **These are balance targets, not universal scientific specifications.** In particular, research-tier range, throughput, purity, and accuracy need mission-specific plausibility checks.

## Implementation order

1. Review/approve these target values and mechanisms.
2. Reconcile each existing retrofit's `directGain`, materials, commissioning energy, and duration with the intended metric change.
3. Update the shared balance source once, with tests/checks for all 28 metrics and 12 states per metric.
4. Wire system inspectors, simulation behavior, and power draw to the shared source without double-counting.
5. Run a build and scenario checks for Foundation/Frontier/Apex/Research, all retrofit levels, and power-starved conditions.
