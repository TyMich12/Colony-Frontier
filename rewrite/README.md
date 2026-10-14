# Colony Frontier — JavaScript + Rust + Python migration

This branch removes the existing TypeScript source files while keeping the game close to its existing screens and flow.

## Languages and responsibilities

- **HTML/CSS:** page structure and visual presentation.
- **JavaScript/JSX:** existing game screens, controls, 3D map components and state handling. JSX is compiled by Vite; no TypeScript files are required.
- **Python:** flight simulation equations for oxygen, electrical energy, cabin pressure, temperature, radiation, acceleration and landing impact.
- **Rust:** the authoritative verdict service. It validates the telemetry calculated by Python and decides whether the astronaut remains alive, the mission is lost, or landing is successful.

## Run the integrated game locally

Requires Node.js, pnpm, Python 3.10+, and Rust/Cargo.

Open three terminals from the repository root:

1. **Terminal A — Rust decision service**
   ```sh
   cd rewrite/server
   cargo run
   ```
   Rust listens at `http://127.0.0.1:8081`.

2. **Terminal B — Python formula service**
   ```sh
   cd rewrite
   python app.py
   ```
   Python listens at `http://127.0.0.1:8080` and forwards each computed flight report to Rust.

3. **Terminal C — the game UI**
   ```sh
   pnpm --dir artifacts/mockup-sandbox run dev
   ```
   Open `http://127.0.0.1:5173/preview/MainMenu`.

Choose a Moon or Mars mission and configure its loadout. Launch now enters the liftoff/ascent/descent/landing sequence. After the Rust authority accepts a successful landing, the game continues to the existing `MissionSimulation` screen. The Vite development server proxies the `/simulate` request to Python.

You can also open `http://127.0.0.1:8080` to inspect the standalone flight-controls prototype served by Python.

## Validation

The GitHub Actions validation workflow builds the migrated Vite workspace, tests the Python formulae, and compiles the Rust service. The language migration report is in the repository root as `LANGUAGE_MIGRATION_REPORT.md`.

## Scope and safety

The existing game was mechanically transpiled to JavaScript/JSX to preserve its established screens and calculations. No TypeScript source/config files remain on this branch. The standalone flight model's numerical limits are illustrative game-balance values, not real astronaut safety or medical limits.
