import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { ArrowLeft, ArrowRight, Moon, Power, Sparkles, Sun, Wind, Gauge } from "lucide-react";
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
    dustRemainingFraction: 1,
    dustCoverageFraction: 0,
    dustLossPct: 0,
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
        dustRemainingFraction: solarLive.dustRemainingFraction,
        dustCoverageFraction: solarLive.dustCoverageFraction,
        dustLossPct: solarLive.dustLossPct,
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
  onComponentSelect,
  selectedComponentName,
}: {
  terrain: TerrainKind;
  dust: number;
  sun: number;
  deployed: boolean;
  tier: SolarTier;
  onComponentSelect?: (name: string, role: string, explanation: string) => void;
  selectedComponentName?: string | null;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.25]}
      camera={{ position: [24, 14, 24], fov: 42, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <color attach="background" args={["#000004"]} />
      <fog attach="fog" args={["#050608", 70, 150]} />
      <SunLight elevation={sun} />
      <ambientLight intensity={0.06} color="#93a7c4" />
      <hemisphereLight args={[0x0a0e18, terrain === "moon" ? "#2a2825" : "#3a1c12", 0.35]} />



      <Stars radius={200} depth={80} count={2600} factor={4} saturation={0} fade speed={0.5} />

      <group>
        <SolarFarm
          deployTarget={deployed ? 1 : 0}
          dust={dust}
          sunElevation={sun}
          terrain={terrain}
          tier={tier}
          onComponentSelect={onComponentSelect}
          selectedComponentName={selectedComponentName}
        />
        <Terrain kind={terrain} />
        <Rocks kind={terrain} />
        <DustParticles kind={terrain} dust={dust} />
      </group>

      <OrbitControls
        enablePan={false}
        minDistance={10}
        maxDistance={32}
        minPolarAngle={0.12}
        maxPolarAngle={1.63}
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
  const [dust, setDust] = useState(0);
  const [autoDust, setAutoDust] = useState(false);
  const [sun, setSun] = useState(32);
  const [selectedComponent, setSelectedComponent] = useState<{
    name: string;
    role: string;
    explanation: string;
  } | null>(null);
  const live = useLive();

  const solarComponents = [
    { name: "PV cell matrix · segment 1", role: "Converts incident sunlight into DC electrical power.", explanation: "The photovoltaic cell matrix contains semiconductor junctions that convert absorbed photons into electrical current. Cells are interconnected in series and parallel to achieve the required voltage and current, while the protective front layer and substrate protect the cells from the surface environment." },
    { name: "Composite panel frame · segment 1", role: "Carries mechanical loads around the photovoltaic surface.", explanation: "The lightweight frame and stiffeners keep the photovoltaic surface within its allowable strain while resisting bending, torsion, launch vibration and thermal cycling." },
    { name: "Cell interconnect / bus network · segment 1", role: "Collects and routes current from the cell strings.", explanation: "Metal interconnects and bus paths combine the current produced by many cells and route it toward the array harness. Electrical resistance in these paths becomes a real power loss and heat source." },
    { name: "Panel hinge · between segments 1–2", role: "Allows controlled folding and deployment between segments.", explanation: "The hinge transfers deployment and operational loads while allowing the blanket to fold for launch and unfold on the surface. Real mechanisms must tolerate repeated thermal cycling and the local dust environment." },
    { name: "Array deployment boom", role: "Carries the structural load path from the hub to the PV wing.", explanation: "The boom transfers bending and torsional loads from the deployed wing back to the central structure. Its mass and stiffness are important because launch loads and deployment transients must be controlled without making the array excessively heavy." },
    { name: "Array deployment actuator", role: "Drives or controls controlled deployment.", explanation: "The actuator provides controlled motion as the array changes from its launch configuration to its operating geometry. Interfaces must survive launch vibration, vacuum, thermal cycling and long periods without maintenance." },
    { name: "Central structural base", role: "Anchors the four array wings and transfers loads into the installation.", explanation: "The central base distributes bending moments, deployment loads and thermal-mechanical stresses from the four wings into the colony structure or lander foundation." },
    { name: "Power conditioning enclosure", role: "Regulates and protects the electrical output.", explanation: "Power electronics regulate the photovoltaic output and protect the DC bus. Maximum-power-point tracking can keep the array near its useful operating point while converters manage voltage compatibility with storage and loads." },
    { name: "Avionics and monitoring unit", role: "Monitors electrical, thermal and deployment health.", explanation: "Sensors and flight electronics monitor voltage, current, temperature and actuator state. Those measurements allow the controller to detect degraded strings, abnormal temperatures and deployment faults." },
    { name: "Thermal radiator panel", role: "Rejects waste heat from the power electronics.", explanation: "Power conversion and electronics produce waste heat. In vacuum there is no convective cooling, so radiator surfaces reject heat primarily by thermal infrared radiation." },
    { name: "Wing deployment drive", role: "Provides controlled mechanical motion at the hub.", explanation: "The deployment drive controls the transition between stowed and deployed states and transfers actuator torque into the wing structure. Its bearings, gears or flexures must remain reliable through thermal cycling and dust exposure." },
  ];

  const selectNextComponent = () => {
    const currentIndex = solarComponents.findIndex((component) => component.name === selectedComponent?.name);
    const next = solarComponents[(currentIndex + 1 + solarComponents.length) % solarComponents.length];
    setSelectedComponent(next);
  };

  const selectPreviousComponent = () => {
    const currentIndex = solarComponents.findIndex((component) => component.name === selectedComponent?.name);
    const previous = solarComponents[(currentIndex - 1 + solarComponents.length) % solarComponents.length];
    setSelectedComponent(previous);
  };

  useEffect(() => {
    if (!autoDust) return;
    const id = window.setInterval(() => setDust((value) => Math.min(100, value + 1)), 350);
    return () => window.clearInterval(id);
  }, [autoDust]);

  const dustLossPct = live.dustLossPct;
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
            value={"-" + dustLossPct.toFixed(0)}
            unit="%"
            accent={dustLossPct > 20 ? "#ffb36a" : "#e6edf5"}
          />
          <Readout
            label="Dust Coverage"
            value={(live.dustCoverageFraction * 100).toFixed(1)}
            unit="%"
            accent={live.dustCoverageFraction > 0.9 ? "#ffb36a" : "#e6edf5"}
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
        <SolarScene
          terrain={terrain}
          dust={dust}
          sun={sun}
          deployed={deployed}
          tier={tier}
          onComponentSelect={(name, role, explanation) => setSelectedComponent({ name, role, explanation })}
          selectedComponentName={selectedComponent?.name ?? null}
        />
      </div>

      {selectedComponent && (
        <div className="pointer-events-auto absolute left-5 bottom-28 z-30 w-[min(92vw,390px)] border border-cyan-400/30 bg-black/80 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] uppercase tracking-[0.22em] text-cyan-300/70">Component selected</p>
              <h2 className="mt-1 text-base font-semibold uppercase tracking-[0.08em] text-white">{selectedComponent.name}</h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedComponent(null)}
              className="border border-white/15 px-2 py-1 text-xs text-white/60 hover:bg-white/10"
              aria-label="Close component information"
            >
              ×
            </button>
          </div>
          <p className="mt-3 text-xs font-medium text-cyan-100">{selectedComponent.role}</p>
          <p className="mt-2 text-xs leading-5 text-white/65">{selectedComponent.explanation}</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="text-[9px] uppercase tracking-[0.12em] text-white/30">Browse components</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectPreviousComponent}
                className="inline-flex items-center gap-2 border border-white/15 bg-white/5 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white/70 hover:bg-white/10"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={selectNextComponent}
                className="inline-flex items-center gap-2 border border-cyan-400/30 bg-cyan-400/5 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-200 hover:bg-cyan-400/15"
              >
                Next <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

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
            <Sparkles className="h-4 w-4" /> Clear Dust
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
              <Wind className="h-3.5 w-3.5" /> Dust Loading Index · {Math.round(dust)}
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
            ? "Mars: index 100 represents a severe dust-storm reference point; the electrical model leaves 25% of dust-free capacity."
            : "Moon: index 100 represents severe loading; the electrical model leaves 8% of dust-free capacity."}
          {" · "}
          Index 100 is a severe reference loading; the visual layer reaches about 99.9% coverage.
        </p>
      </div>
    </div>
  );
}
