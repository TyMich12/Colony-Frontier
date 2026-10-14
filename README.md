# Colony Frontier

A Moon/Mars colony-management game with mission loadouts, research, system repairs, rover operations and a 3D colony view.

## Technology stack

- **HTML + CSS** for the browser interface and visual styling.
- **JavaScript/JSX** for game screens and interaction. All former TypeScript source/config files have been removed on this branch.
- **Python** for flight and astronaut-survival formulae.
- **Rust** for the authoritative flight-state decision: alive, mission loss or successful landing.

The original game's screens and mechanics were migrated to JavaScript/JSX to keep the experience similar. A liftoff → ascent → descent → landing stage now runs before returning to the existing colony mission simulation. The minigame's internal logic was not specifically rewritten as part of the flight integration.

## Run locally

Requirements: Node.js, pnpm, Python 3.10+, and Rust/Cargo.

Start three terminals from this repository:

1. Rust authority:
   ```sh
   cd rewrite/server
   cargo run
   ```
2. Python formula service:
   ```sh
   cd rewrite
   python app.py
   ```
3. Game UI:
   ```sh
   pnpm --dir artifacts/mockup-sandbox run dev
   ```

Open **http://127.0.0.1:5173/preview/MainMenu**. The flight stage sends calculations to Python through Vite's `/simulate` proxy; Python submits the resulting telemetry to Rust.

For the full architecture and validation notes, see [rewrite/README.md](rewrite/README.md) and [LANGUAGE_MIGRATION_REPORT.md](LANGUAGE_MIGRATION_REPORT.md).

## Gameplay model

Oxygen, electrical energy, cabin pressure, temperature, accumulated radiation, G-force, restraints and landing impact influence the Rust verdict. Numerical limits are illustrative game-balance values only, not real-world astronaut safety or medical limits.
