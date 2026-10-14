import { useState } from "react";
import { Activity, AlertTriangle, ArrowRight, BatteryCharging, CheckCircle2, Gauge, HeartPulse, RotateCcw, Shield, Thermometer, Wind, Zap } from "lucide-react";
import { GameShell, SectionLabel } from "./_shared/GameShell";
import { technologyTracks } from "./_shared/gameData";
import { loadPendingMission } from "./missionRuntime";

const FLIGHT_PHASES = [
  { id: "liftoff", title: "Liftoff", duration: 10, description: "Ignition, thrust build-up and initial acceleration." },
  { id: "ascent", title: "Ascent", duration: 20, description: "Maintain crew resources and a stable flight profile." },
  { id: "descent", title: "Descent", duration: 20, description: "Prepare the vehicle and reduce landing speed." },
  { id: "landing", title: "Landing", duration: 5, description: "Touch down and confirm that the crew can continue." },
];
const TIER_LEVEL = { Foundation: 0, Frontier: 1, Apex: 2, Research: 3 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function tierRank(selected, systemId) {
  return TIER_LEVEL[selected?.[systemId]] ?? 0;
}

function createInitialFlightState(pendingMission) {
  const selected = pendingMission?.selected ?? {};
  const rank = (id) => tierRank(selected, id);
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const equipmentMass = technologyTracks.reduce((mass, track) => {
    const tier = selected[track.id];
    return mass + (tier ? (track.tiers?.[tier]?.mass ?? 0) : 0);
  }, 0);

  // Selected mission equipment affects the flight profile. Values are gameplay
  // parameters, not certified real-world spacecraft or medical calculations.
  return {
    elapsed_seconds: 0,
    oxygen_kg: 7.5 + rank("oxygen") * 1.25 + rank("habitat") * 0.25,
    oxygen_rate_kg_s: Math.max(0.0003, 0.001 * (1 - 0.12 * rank("oxygen"))),
    energy_j: 400000 + rank("battery") * 75000,
    generation_w: 1000 + rank("solar") * 200 + rank("grid") * 100,
    load_w: 850 + Math.max(0, selectedCount - 8) * 50 + rank("thermal") * 50,
    cabin_gas_mass_kg: 36 + rank("habitat") * 1.5,
    molar_mass_kg_mol: 0.029,
    cabin_volume_m3: 30,
    temperature_k: 293.15,
    heater_w: 0,
    cooling_w: 0,
    thermal_capacity_j_k: 120000 + rank("thermal") * 15000,
    radiation_gy: 0,
    radiation_rate_gy_s: 0.00000001 * (1 - 0.2 * rank("radiation")),
    vehicle_mass_kg: 9000 + equipmentMass * 0.5,
    thrust_n: 150000,
    drag_n: 10000 + (pendingMission?.campaign === "mars" ? 2500 : 0),
    vertical_speed_m_s: 1,
    landing_stopping_distance_m: 1,
    restraints_intact: true,
    flight_control_ok: true,
  };
}

function Metric({ label, value, unit, icon: Icon, detail, warning }) {
  return (
    <div className="border border-[#29434a] bg-[#09171e] p-4">
      <div className="flex items-center justify-between gap-2 text-[#86a19d]">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em]">{label}</span>
        <Icon className="h-4 w-4 text-[#efb658]" />
      </div>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${warning ? "text-[#ff8b83]" : "text-[#f1f3df]"}`}>
        {value}<span className="ml-1 text-[10px] font-medium text-[#78918e]">{unit}</span>
      </p>
      <p className="mt-2 text-[9px] leading-4 text-[#78918e]">{detail}</p>
    </div>
  );
}

function ParameterSlider({ label, value, min, max, step, displayValue, onChange, warningText }) {
  return (
    <label className="block border-b border-[#253d43] py-3 last:border-b-0">
      <span className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#a9bfba]">
        {label}
        <output className="font-mono text-[#efb658]">{displayValue}</output>
      </span>
      <input className="mt-3 w-full accent-[#efb658]" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      {warningText && <span className="mt-1 block text-[9px] text-[#78918e]">{warningText}</span>}
    </label>
  );
}

export function FlightSequence() {
  const pendingMission = loadPendingMission();
  const [flightState, setFlightState] = useState(() => createInitialFlightState(pendingMission));
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseElapsed, setPhaseElapsed] = useState(0);
  const [preflightComplete, setPreflightComplete] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const phase = FLIGHT_PHASES[phaseIndex];
  const missionTitle = pendingMission
    ? `${pendingMission.campaign === "mars" ? "Mars" : "Moon"} Mission ${pendingMission.missionNumber}: ${pendingMission.missionTitle}`
    : "Flight simulation";

  const lost = Boolean(verdict && !verdict.alive);
  const landed = Boolean(verdict?.alive && verdict?.mission_status === "SUCCESS");
  const hasWarnings = Boolean(verdict?.warnings?.length);
  const progress = clamp(((phaseIndex + phaseElapsed / phase.duration) / FLIGHT_PHASES.length) * 100, 0, 100);

  async function simulate(deltaSeconds) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: phase.id, dt_seconds: deltaSeconds, state: flightState }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Flight simulation request failed.");
      setFlightState((previous) => ({
        ...previous,
        elapsed_seconds: data.calculated.elapsed_seconds,
        oxygen_kg: data.calculated.oxygen_kg,
        energy_j: data.calculated.energy_j,
        temperature_k: data.calculated.temperature_k,
        radiation_gy: data.calculated.radiation_gy,
      }));
      setTelemetry(data.calculated);
      setVerdict(data.verdict);
      setPreflightComplete(true);
      if (deltaSeconds > 0) setPhaseElapsed((previous) => previous + deltaSeconds);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function advancePhase() {
    if (!verdict?.alive || phaseIndex >= FLIGHT_PHASES.length - 1 || phaseElapsed < phase.duration) return;
    setPhaseIndex((previous) => previous + 1);
    setPhaseElapsed(0);
  }

  function restartFlight() {
    setFlightState(createInitialFlightState(pendingMission));
    setPhaseIndex(0);
    setPhaseElapsed(0);
    setPreflightComplete(false);
    setTelemetry(null);
    setVerdict(null);
    setError("");
  }

  function updateControl(key, value) {
    setFlightState((previous) => ({ ...previous, [key]: value }));
  }

  const primaryLabel = busy
    ? "Calculating flight state…"
    : landed
      ? "Touchdown verified"
      : lost
        ? "Mission lost"
        : !preflightComplete
          ? "Run preflight checks"
          : "Advance flight · 5 seconds";

  return (
    <GameShell active="loadout" eyebrow="Mission launch / flight operations" title="Liftoff & Descent">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border border-[#35535a] bg-[#0b1b22]/80 p-5">
        <div>
          <SectionLabel>Mission assignment</SectionLabel>
          <h2 className="mt-2 text-sm font-bold uppercase tracking-[0.14em] text-[#f1f3df]">{missionTitle}</h2>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-[#94aaa4]">The loadout shapes your starting reserves. Python calculates the flight telemetry, and the Rust authority decides if the astronaut is alive and whether the landing succeeds.</p>
        </div>
        <div className={`border px-3 py-2 text-[9px] font-bold uppercase tracking-[0.2em] ${lost ? "border-[#ff625c] bg-[#340e12] text-[#ff8b83]" : landed ? "border-[#72c69e] bg-[#102b25] text-[#8bd6ad]" : hasWarnings ? "border-[#c98b4f] bg-[#302213] text-[#efb658]" : "border-[#365d5d] bg-[#102526] text-[#91c6b5]"}`}>
          {lost ? "Mission loss" : landed ? "Landing successful" : hasWarnings ? "Warning" : verdict ? "Flight viable" : "Standby"}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="space-y-5">
          <div className="border border-[#35535a] bg-[#0b1b22]/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>Flight timeline</SectionLabel>
              <span className="font-mono text-[10px] text-[#efb658]">T+{Math.round(telemetry?.elapsed_seconds ?? 0)} s</span>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {FLIGHT_PHASES.map((item, index) => (
                <button key={item.id} type="button" onClick={() => {}} className={`border p-3 text-left ${index === phaseIndex ? "border-[#efb658] bg-[#26332c]" : index < phaseIndex ? "border-[#496b5e] bg-[#112720]" : "border-[#29434a] bg-[#09171e]"}`}>
                  <span className="block font-mono text-[9px] text-[#7f9992]">0{index + 1}</span>
                  <span className="mt-2 block text-[9px] font-bold uppercase tracking-[0.12em] text-[#e4ead9]">{item.title}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 h-1 overflow-hidden bg-[#20353b]"><div className="h-full bg-[#efb658] transition-all" style={{ width: `${progress}%` }} /></div>
            <h3 className="mt-5 text-xl font-semibold uppercase tracking-[0.09em] text-[#f1f3df]">{phase.title}</h3>
            <p className="mt-2 text-xs leading-6 text-[#91a9a2]">{phase.description} Phase time: {phaseElapsed}/{phase.duration} seconds.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {!preflightComplete && <button type="button" onClick={() => simulate(0)} disabled={busy} className="bg-[#efb658] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#142127] hover:bg-[#f6ca76] disabled:opacity-50">{primaryLabel}</button>}
              {preflightComplete && !lost && !landed && <button type="button" onClick={() => simulate(5)} disabled={busy} className="inline-flex items-center gap-2 bg-[#efb658] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#142127] hover:bg-[#f6ca76] disabled:opacity-50">{primaryLabel}<ArrowRight className="h-3.5 w-3.5" /></button>}
              {preflightComplete && !lost && phaseIndex < FLIGHT_PHASES.length - 1 && phaseElapsed >= phase.duration && <button type="button" onClick={advancePhase} disabled={busy} className="border border-[#58756b] bg-[#122821] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-[#b5d1c0] disabled:opacity-50">Advance to {FLIGHT_PHASES[phaseIndex + 1].title} →</button>}
              {lost && <button type="button" onClick={restartFlight} disabled={busy} className="inline-flex items-center gap-2 border border-[#a44b4b] bg-[#321619] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-[#ffaaa3]"><RotateCcw className="h-3.5 w-3.5" /> Retry flight</button>}
              {landed && <button type="button" onClick={() => { window.location.href = "/preview/MissionSimulation"; }} className="inline-flex items-center gap-2 bg-[#7bc8a1] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#0a1b1c]">Continue to colony operations <ArrowRight className="h-3.5 w-3.5" /></button>}
              <button type="button" onClick={() => { window.location.href = "/preview/MainMenu"; }} className="border border-[#2d4648] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-[#92aaa3] hover:border-[#718f80]">Abort to mission control</button>
            </div>
            {error && <p className="mt-4 border border-[#a44b4b] bg-[#321619] p-3 text-xs leading-5 text-[#ffaaa3]"><AlertTriangle className="mr-2 inline h-4 w-4" />{error} Start the Python and Rust services, then retry.</p>}
            {verdict && <div className={`mt-4 border p-4 ${lost ? "border-[#a44b4b] bg-[#321619]" : hasWarnings ? "border-[#9a784c] bg-[#2b2115]" : "border-[#365d5d] bg-[#0b2022]"}`}>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#e8eee0]"><Shield className="h-4 w-4" /> Rust mission authority: {verdict.mission_status.replaceAll("_", " ")}</div>
              {[...(verdict.reasons ?? []), ...(verdict.warnings ?? [])].length > 0
                ? <ul className="mt-3 list-disc space-y-1 pl-4 text-[10px] leading-5 text-[#d0d9ca]">{[...(verdict.reasons ?? []), ...(verdict.warnings ?? [])].map((reason, index) => <li key={index}>{reason}</li>)}</ul>
                : <p className="mt-2 text-[10px] leading-5 text-[#9db5aa]">No blocking fault reported. The astronaut remains alive.</p>}
            </div>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Oxygen reserve" value={(telemetry?.oxygen_kg ?? flightState.oxygen_kg).toFixed(2)} unit="kg" icon={Wind} detail="Breathable-gas reserve after consumption." warning={(telemetry?.oxygen_kg ?? flightState.oxygen_kg) <= 1} />
            <Metric label="Electrical energy" value={((telemetry?.energy_j ?? flightState.energy_j) / 1000).toFixed(1)} unit="kJ" icon={BatteryCharging} detail="Stored energy after electrical load." warning={(telemetry?.energy_j ?? flightState.energy_j) <= 50000} />
            <Metric label="Cabin pressure" value={telemetry ? (telemetry.pressure_pa / 1000).toFixed(1) : "—"} unit="kPa" icon={Gauge} detail="Calculated using the ideal gas law." warning={Boolean(telemetry && (telemetry.pressure_pa < 70000 || telemetry.pressure_pa > 110000))} />
            <Metric label="Cabin temperature" value={((telemetry?.temperature_k ?? flightState.temperature_k) - 273.15).toFixed(1)} unit="°C" icon={Thermometer} detail="Thermal energy balance over the last step." warning={Boolean(telemetry && (telemetry.temperature_k < 285 || telemetry.temperature_k > 305))} />
            <Metric label="Radiation dose" value={(telemetry?.radiation_gy ?? flightState.radiation_gy).toExponential(2)} unit="Gy" icon={Activity} detail="Accumulated illustrative dose in the game model." warning={Boolean(telemetry && telemetry.radiation_gy > 0.001)} />
            <Metric label="Acceleration" value={telemetry ? telemetry.acceleration_g.toFixed(2) : "—"} unit="g" icon={HeartPulse} detail="Net thrust minus drag, divided by mass." warning={Boolean(telemetry && telemetry.acceleration_g > 4)} />
          </div>
        </section>

        <aside className="h-fit border border-[#35535a] bg-[#0b1b22]/80 p-5">
          <SectionLabel>Flight controls</SectionLabel>
          <h3 className="mt-2 text-lg font-semibold uppercase tracking-[0.08em] text-[#f1f3df]">Protect the crew</h3>
          <p className="mt-2 text-[10px] leading-5 text-[#91a9a2]">Adjust the simulation inputs. Python recalculates telemetry at the next step; Rust makes the final survival decision.</p>
          <div className="mt-3">
            <ParameterSlider label="Oxygen consumption" value={flightState.oxygen_rate_kg_s} min={0.0002} max={0.16} step={0.0002} displayValue={flightState.oxygen_rate_kg_s.toFixed(4) + " kg/s"} onChange={(value) => updateControl("oxygen_rate_kg_s", value)} warningText="High consumption can exhaust the reserve before touchdown." />
            <ParameterSlider label="Electrical load" value={flightState.load_w} min={200} max={12000} step={100} displayValue={Math.round(flightState.load_w) + " W"} onChange={(value) => updateControl("load_w", value)} warningText="Load exceeding generation drains stored energy." />
            <ParameterSlider label="Cabin heat input" value={flightState.heater_w - flightState.cooling_w} min={-28000} max={28000} step={1000} displayValue={(flightState.heater_w - flightState.cooling_w).toLocaleString() + " W"} onChange={(value) => setFlightState((previous) => ({ ...previous, heater_w: Math.max(0, value), cooling_w: Math.max(0, -value) }))} warningText="Positive heats the cabin; negative cools it." />
            <ParameterSlider label="Vertical speed at landing" value={flightState.vertical_speed_m_s} min={0} max={20} step={0.5} displayValue={flightState.vertical_speed_m_s.toFixed(1) + " m/s"} onChange={(value) => updateControl("vertical_speed_m_s", value)} warningText="Excessive touchdown speed can exceed the impact limit." />
          </div>
          <div className="mt-4 border-t border-[#29434a] pt-4">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#8ba5a0]"><Zap className="h-3.5 w-3.5 text-[#efb658]" /> Loadout influence</div>
            <p className="mt-2 text-[10px] leading-5 text-[#78918e]">Oxygen, battery, solar, thermal, habitat and radiation technology tiers affect initial reserves, generation, heat capacity, cabin gas and dose rate.</p>
            {!pendingMission && <p className="mt-2 text-[10px] text-[#efb658]">No pending loadout was found; default flight parameters are active.</p>}
          </div>
        </aside>
      </div>
    </GameShell>
  );
}
