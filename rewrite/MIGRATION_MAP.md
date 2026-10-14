# Colony Frontier migration map

This rewrite lives beside the existing game on branch `rust-python-rewrite`. The original implementation is retained so the replacement can be validated without destroying the playable baseline.

## Language boundaries

| Area | Target | Responsibility |
|---|---|---|
| User interface | HTML | Semantic screens and controls |
| Visual design | CSS | Layout, responsive HUD, animations |
| Browser interaction | JavaScript | Input, presentation, requests, scene transitions |
| Simulation mathematics | Python | Resource and physics formulae; derived telemetry |
| Authoritative rules | Rust | Validate telemetry and decide alive/lost/success |

## Migration order

1. **Flight simulation foundation:** liftoff, ascent, descent, landing; Python calculations routed to Rust verdicts.
2. **Mission lifecycle:** launch readiness, phase transitions, failure recovery, mission completion.
3. **Colony systems:** power, oxygen, water, habitat, thermal, radiation, communications, navigation, rover, extraction, agriculture, science and maintenance.
4. **Progression:** campaign selection, loadouts, technologies, upgrades, repairs, rewards and saved game state.
5. **Existing minigame handoff:** retain its implementation and internals; add only a narrow integration boundary after the current trigger and return contract have been confirmed.
6. **Parity and removal:** compare old/new behavior, add tests for migrated rules, and only then make the new-language implementation the default.

## Non-negotiable constraints

- Do not edit or replace the existing minigame or its internals.
- Do not introduce TypeScript into the rewrite directory.
- Python provides calculated telemetry; Rust is the final authority for alive/loss/success.
- Never silently delete old functionality. Mark a system migrated only after its behavior and state persistence have been accounted for.
- Current numeric limits are illustrative game-balance values, not real-world safety thresholds.
