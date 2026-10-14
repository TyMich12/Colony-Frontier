# Colony Frontier — Rust/Python Rewrite

This is the new-language rewrite workspace, developed separately from the existing game so the current game and its minigame remain untouched while the replacement is built.

## Responsibilities

- **HTML/CSS:** interface and visual presentation.
- **JavaScript:** player controls, stage progression, HUD rendering, and requests.
- **Python:** simulation formulae for oxygen, electrical energy, cabin pressure, temperature, radiation, acceleration, and landing impact.
- **Rust:** authoritative mission-state decision. Rust validates Python's calculated values and decides whether the astronaut remains alive, whether the mission is lost, or whether landing succeeds.

## Run locally

Requires Rust/Cargo and Python 3.10+.

1. Terminal A: `cd rewrite/server`, then `cargo run` (Rust listens on `127.0.0.1:8081`).
2. Terminal B: `cd rewrite`, then `python app.py` (Python serves the UI and formula API on `127.0.0.1:8080`).
3. Open `http://127.0.0.1:8080`.

No TypeScript is used in this rewrite workspace.

## Status and limits

This is the first executable migration foundation, not yet a feature-complete replacement for every existing Colony Frontier system. The existing game is preserved while systems are migrated. The flight thresholds are game-balance placeholders, not real-world astronaut safety guidance. Do not use this toy model for real flight or medical decisions.
