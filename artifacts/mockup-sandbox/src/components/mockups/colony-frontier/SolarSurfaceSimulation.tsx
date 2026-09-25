import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { Moon, Power, Sparkles, Sun, Wind, Gauge } from "lucide-react";
import { SolarFarm } from "./solar-surface/solar-farm";
import { Terrain, Rocks } from "./solar-surface/terrain";
import { DustParticles } from "./solar-surface/dust-particles";
import {
  CELL_EFFICIENCY,
  solarLive,
  type SolarTier,
  type TerrainKind,
} from "./solar-surface/state";

type Props = { tier: SolarTier };

function SunLight({ elevation }: { elevation: number }) {
  const el = (elevation * Math.PI) / 180;
  const az = -0.7;
  const dist = 55;
  const x = Math.cos(el) * Math.cos(az) * dist;
  const y = Math.max(2, Math.sin(el) * dist);
  const z = Math.cos(el) * Math.sin(az) * dist;

  return (
    <directionalLight
      position={[x, y, z]}
      intensity={3.2}
      color="#fff6ec"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-camera-near={1}
      shadow-camera-far={140}
      shadow-camera-left={-34}
      shadow-camera-right={34}
      shadow-camera-top={34}
      shadow-camera-bottom={-34}
    />
  );
}

function useLive() {
  const [live, setLive] = useState({
    deploy: 0,
    powerKW: 0,
    efficiency: 0,
    dust: 0,
    activeAreaM2: 0,
    atmosphericTau: 0,
    atmosphericTransmission: 1,
    surfaceIrradiance: 0,
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setLive({
        deploy: solarLive.deploy,
        powerKW: solarLive.powerKW,
        efficiency: solarLive.efficiency,
        dust: solarLive.dust,
        activeAreaM2: solarLive.activeAreaM2,
        atmosphericTau: solarLive.atmosphericTau,
        atmosphericTransmission: solarLive.atmosphericTransmission,
        surfaceIrradiance: solarLive.surfaceIrradiance,
      });
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  return live;
}

function Readout({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col rounded-md border border-white/10 bg-black/40 px-3 py-2">
      <span className="text-[10px] uppercase tracking-widest text-white/40">{label}</span>
      <span className="font-mono text-lg leading-tight" style={{ color: accent ?? "#e6edf5" }}>
        {value}
        {unit ? <span className="ml-1 text-xs text-white/40">{unit}</span> : null}
      </span>
    </div>
  );
}

function SolarScene({
  terrain,
  dust,
  sun,
  deployed,
  tier,
}: {
  terrain: TerrainKind;
  dust: number;
  sun: number;
  deployed: boolean;
  tier: SolarTier;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [24, 14, 24], fov: 42, near: 0.1, far: 400 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <color attach="background" args={["#000004"]} />
      <fog attach="fog" args={["#050608", 70, 150]} />
      <SunLight elevation={sun} />
      <ambientLight intensity={0.06} color="#93a7c4" />
      <hemisphereLight args={[0x0a0e18, terrain === "moon" ? "#2a2825" : "#3a1c12", 0.35]} />

      <Environment resolution={256} background={false}>
        <Lightformer intensity={2.4} color="#fff3e0" position={[10, 12, 6]} scale={[10, 10, 1]} />
        <Lightformer
          intensity={0.35}
          color={terrain === "moon" ? "#2a2825" : "#3a1c12"}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, -2, 0]}
          scale={[30, 30, 1]}
        />
        <Lightformer intensity={0.25} color="#22304a" position={[-12, 4, -10]} scale={[10, 10, 1]} />
      </Environment>

      <Stars radius={200} depth={80} count={2600} factor={4} saturation={0} fade speed={0.5} />

      <group>
        <SolarFarm
          deployTarget={deployed ? 1 : 0}
          dust={dust}
          sunElevation={sun}
          terrain={terrain}
          tier={tier}
        />
        <Terrain kind={terrain} />
        <Rocks kind={terrain} />
        <DustParticles kind={terrain} dust={dust} />
      </group>

      <OrbitControls
        enablePan={false}
        minDistance={10}
        maxDistance={80}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 3, 0]}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}

export function SolarSurfaceSimulation({ tier }: Props) {
  const [deployed, setDeployed] = useState(false);
  const [terrain, setTerrain] = useState<TerrainKind>("moon");
  const [dust, setDust] = useState(8);
  const [autoDust, setAutoDust] = useState(false);
  const [sun, setSun] = useState(32);
  const live = useLive();

  useEffect(() => {
    if (!autoDust) return;
    const id = window.setInterval(() => setDust((value) => Math.min(100, value + 1)), 350);
    return () => window.clearInterval(id);
  }, [autoDust]);

  const dustLossPct = Math.round((dust / 100) * 45);
  const nominalCellEfficiency = CELL_EFFICIENCY[tier] * 100;

  return (
    <div className="relative overflow-hidden border border-[#2e4a50] bg-black">
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute left-5 top-5 max-w-md select-none">
          <h1 className="font-mono text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300/90">
            Helios Surface Array
          </h1>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-white/50">
            {terrain === "moon" ? "Lunar" : "Martian"} colony power installation · {tier} Solar technology
          </p>
        </div>

        <div className="absolute right-5 top-5 grid w-48 grid-cols-1 gap-2">
          <Readout label="Power Output" value={live.powerKW.toFixed(1)} unit="kW" accent="#5ef0b0" />
          <Readout label="System Efficiency" value={(live.efficiency * 100).toFixed(1)} unit="%" accent="#7fd0ff" />
          <Readout label="Deployment" value={(live.deploy * 100).toFixed(0)} unit="%" />
          <Readout
            label="Dust Loss"
            value={"-" + dustLossPct}
            unit="%"
            accent={dustLossPct > 20 ? "#ffb36a" : "#e6edf5"}
          />
        </div>

        <div className="absolute left-5 top-28 border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-sm">
          <p className="text-[9px] uppercase tracking-[.14em] text-white/40">Calculated model</p>
          <p className="mt-1 font-mono text-[10px] text-white/75">{live.activeAreaM2.toFixed(1)} m² active PV area</p>
          <p className="mt-1 text-[9px] text-white/35">
            Tier cell efficiency: {nominalCellEfficiency.toFixed(0)}%
          </p>
          {terrain === "mars" && (
            <>
              <p className="mt-1 text-[9px] text-white/35">
                Atmospheric optical depth: τ = {live.atmosphericTau.toFixed(2)}
              </p>
              <p className="mt-1 text-[9px] text-white/35">
                Direct transmission: {(live.atmosphericTransmission * 100).toFixed(1)}%
              </p>
              <p className="mt-1 text-[9px] text-white/35">
                Surface direct irradiance: {live.surfaceIrradiance.toFixed(0)} W/m²
              </p>
            </>
          )}
          {terrain === "moon" && (
            <p className="mt-1 text-[9px] text-white/35">
              Surface irradiance: {live.surfaceIrradiance.toFixed(0)} W/m²
            </p>
          )}
        </div>
      </div>

      <div className="h-[650px] w-full">
        <SolarScene terrain={terrain} dust={dust} sun={sun} deployed={deployed} tier={tier} />
      </div>

      <div className="absolute bottom-5 left-1/2 z-20 w-[min(94vw,760px)] -translate-x-1/2 rounded-xl border border-white/10 bg-black/55 p-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setDeployed((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
          >
            <Power className="h-4 w-4" />
            {deployed ? "Retract Array" : "Deploy Array"}
          </button>

          <div className="inline-flex overflow-hidden rounded-lg border border-white/15">
            <button
              type="button"
              onClick={() => setTerrain("moon")}
              className={"inline-flex items-center gap-1.5 px-3 py-2 text-sm transition " + (terrain === "moon" ? "bg-white/90 text-black" : "bg-transparent text-white/70 hover:bg-white/10")}
            >
              <Moon className="h-4 w-4" /> Moon
            </button>
            <button
              type="button"
              onClick={() => setTerrain("mars")}
              className={"inline-flex items-center gap-1.5 px-3 py-2 text-sm transition " + (terrain === "mars" ? "bg-orange-500/90 text-black" : "bg-transparent text-white/70 hover:bg-white/10")}
            >
              <span className="h-3 w-3 rounded-full bg-orange-500" /> Mars
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setDust(0);
              setAutoDust(false);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            <Sparkles className="h-4 w-4" /> Clean Panels
          </button>

          <button
            type="button"
            onClick={() => setAutoDust((value) => !value)}
            className={"inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition " + (autoDust ? "border-amber-400/60 bg-amber-500/20 text-amber-200" : "border-white/15 text-white/80 hover:bg-white/10")}
          >
            <Wind className="h-4 w-4" /> Dust Buildup {autoDust ? "On" : "Off"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/50">
              <Wind className="h-3.5 w-3.5" /> Dust Coverage · {Math.round(dust)}%
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={dust}
              onChange={(event) => setDust(Number(event.target.value))}
              className="accent-amber-400"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/50">
              <Sun className="h-3.5 w-3.5" /> Sun Elevation · {Math.round(sun)}°
            </span>
            <input
              type="range"
              min={0}
              max={90}
              value={sun}
              onChange={(event) => setSun(Number(event.target.value))}
              className="accent-yellow-300"
            />
          </label>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/35">
          <Gauge className="h-3.5 w-3.5" />
          {terrain === "mars"
            ? "Mars: P uses G₀ × sin(e) × exp(−τ / sin(e)) × A × η × deployment × dust × 0.92"
            : "Moon: P uses G₀ × sin(e) × A × η × deployment × dust × 0.92"}
          {" · "}
          τ = 0.50 is the normal/quiescent Mars atmosphere model; panel dust is modelled separately.
        </p>
      </div>
    </div>
  );
}
