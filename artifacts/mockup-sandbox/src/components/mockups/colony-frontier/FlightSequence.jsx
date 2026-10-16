import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BatteryCharging, Check, ChevronRight, CirclePause, CirclePlay, Gauge as GaugeIcon, RotateCcw, ShieldCheck, Thermometer, Wind, Zap } from "lucide-react";
import { technologyTracks } from "./_shared/gameData";
import { loadPendingMission } from "./missionRuntime";

const G0 = 9.80665;
const TICK_MS = 580;
const TIER_LEVEL = { Foundation: 0, Frontier: 1, Apex: 2, Research: 3 };
const PHASES = [
  { id: "liftoff", title: "Liftoff", hint: "Clear the pad and keep the vehicle close to vertical." },
  { id: "ascent", title: "Ascent", hint: "Follow the pitch programme without building excessive crew load." },
  { id: "descent", title: "Trajectory turn", hint: "Roll toward the approach profile. Watch the angular rate." },
  { id: "landing", title: "Surface approach", hint: "Trim the nose toward vertical and manage throttle for a soft touchdown." },
];
const STAR_FIELD = Array.from({ length: 58 }, (_, i) => ({
  x: (i * 173 + 41) % 1000,
  y: (i * 67 + 13) % 300,
  r: i % 9 === 0 ? 1.8 : i % 4 === 0 ? 1.2 : 0.7,
  opacity: 0.22 + ((i * 13) % 65) / 100,
}));
const RANGE_ZONES = {
  oxygen: [
    { from: 0, to: 20, color: "#d85d5d", label: "EXTREME" },
    { from: 20, to: 70, color: "#d5a34e", label: "CRITICAL" },
    { from: 70, to: 100, color: "#64b68b", label: "TARGET" },
  ],
  energy: [
    { from: 0, to: 15, color: "#d85d5d", label: "EXTREME" },
    { from: 15, to: 60, color: "#d5a34e", label: "CRITICAL" },
    { from: 60, to: 100, color: "#64b68b", label: "TARGET" },
  ],
  pressure: [
    { from: 50, to: 70, color: "#d85d5d", label: "EXTREME" },
    { from: 70, to: 90, color: "#d5a34e", label: "CRITICAL" },
    { from: 90, to: 105, color: "#64b68b", label: "TARGET" },
    { from: 105, to: 110, color: "#d5a34e", label: "CRITICAL" },
    { from: 110, to: 120, color: "#d85d5d", label: "EXTREME" },
  ],
  temperature: [
    { from: 270, to: 285, color: "#d85d5d", label: "EXTREME" },
    { from: 285, to: 293, color: "#d5a34e", label: "CRITICAL" },
    { from: 293, to: 299, color: "#64b68b", label: "TARGET" },
    { from: 299, to: 305, color: "#d5a34e", label: "CRITICAL" },
    { from: 305, to: 315, color: "#d85d5d", label: "EXTREME" },
  ],
  radiation: [
    { from: 0, to: 0.0005, color: "#64b68b", label: "TARGET" },
    { from: 0.0005, to: 0.001, color: "#d5a34e", label: "CRITICAL" },
    { from: 0.001, to: 0.002, color: "#d85d5d", label: "EXTREME" },
  ],
  acceleration: [
    { from: 0, to: 2.5, color: "#64b68b", label: "TARGET" },
    { from: 2.5, to: 4, color: "#d5a34e", label: "CRITICAL" },
    { from: 4, to: 5, color: "#d85d5d", label: "EXTREME" },
  ],
  angular: [
    { from: 0, to: 5, color: "#64b68b", label: "TARGET" },
    { from: 5, to: 15, color: "#d5a34e", label: "CRITICAL" },
    { from: 15, to: 20, color: "#d85d5d", label: "EXTREME" },
  ],
  attitude: [
    { from: 0, to: 2, color: "#64b68b", label: "TARGET" },
    { from: 2, to: 8, color: "#d5a34e", label: "CRITICAL" },
    { from: 8, to: 15, color: "#d85d5d", label: "EXTREME" },
  ],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function phaseForElapsed(seconds) {
  if (seconds < 10) return PHASES[0];
  if (seconds < 30) return PHASES[1];
  if (seconds < 50) return PHASES[2];
  return PHASES[3];
}

function makeInitialFlightState(pendingMission) {
  const selected = pendingMission?.selected ?? {};
  const rank = (id) => TIER_LEVEL[selected?.[id]] ?? 0;
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const equipmentMass = technologyTracks.reduce((mass, track) => {
    const tier = selected[track.id];
    return mass + (tier ? (track.tiers?.[tier]?.mass ?? 0) : 0);
  }, 0);
  const oxygen = 7.5 + rank("oxygen") * 1.25 + rank("habitat") * 0.25;
  const energy = 400_000 + rank("battery") * 75_000;
  return {
    elapsed_seconds: 0,
    oxygen_kg: oxygen,
    oxygen_initial_kg: oxygen,
    oxygen_rate_kg_s: Math.max(0.0003, 0.001 * (1 - 0.12 * rank("oxygen"))),
    energy_j: energy,
    energy_initial_j: energy,
    generation_w: 1_000 + rank("solar") * 200 + rank("grid") * 100,
    load_w: 850 + Math.max(0, selectedCount - 8) * 50 + rank("thermal") * 50,
    cabin_gas_mass_kg: 36 + rank("habitat") * 1.5,
    molar_mass_kg_mol: 0.029,
    cabin_volume_m3: 30,
    temperature_k: 293.15,
    heater_w: 0,
    cooling_w: 0,
    thermal_capacity_j_k: 120_000 + rank("thermal") * 15_000,
    radiation_gy: 0,
    radiation_rate_gy_s: 0.00000001 * (1 - 0.2 * rank("radiation")),
    vehicle_mass_kg: 9_000 + equipmentMass * 0.5,
    thrust_n: 150_000,
    drag_n: 10_000 + (pendingMission?.campaign === "mars" ? 2_500 : 0),
    throttle_fraction: 0.92,
    pitch_deg: 0,
    pitch_trim_deg: 0,
    angular_velocity_deg_s: 0,
    altitude_m: 0,
    vertical_speed_m_s: 0,
    horizontal_speed_m_s: 0,
    horizontal_position_m: 0,
    landing_stopping_distance_m: 10,
    landing_approach_started: false,
    restraints_intact: true,
    flight_control_ok: true,
  };
}

function stateFromTelemetry(previous, calculated) {
  const keys = [
    "elapsed_seconds", "oxygen_kg", "oxygen_initial_kg", "oxygen_rate_kg_s", "energy_j",
    "energy_initial_j", "generation_w", "load_w", "temperature_k", "radiation_gy",
    "pitch_deg", "pitch_trim_deg", "angular_velocity_deg_s", "altitude_m",
    "vertical_speed_m_s", "horizontal_speed_m_s", "horizontal_position_m",
    "landing_approach_started", "throttle_fraction",
  ];
  const next = { ...previous };
  for (const key of keys) {
    if (calculated[key] !== undefined) next[key] = calculated[key];
  }
  return next;
}

function resultStatus(criticalFactors, id, value, zones) {
  if (criticalFactors.includes(id)) {
    const zone = zones.find((item, index) => value >= item.from && (index === zones.length - 1 ? value <= item.to : value < item.to));
    return zone?.label ?? "CRITICAL";
  }
  return "TARGET";
}

function polar(angle, radius = 68) {
  const radians = (angle * Math.PI) / 180;
  return [110 + radius * Math.cos(radians), 100 + radius * Math.sin(radians)];
}

function arcPath(startAngle, endAngle, radius = 68) {
  const [x1, y1] = polar(startAngle, radius);
  const [x2, y2] = polar(endAngle, radius);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function SurvivalGauge({ title, value, min, max, display, unit, zones, criticalFactors, factorId }) {
  const valid = Number.isFinite(value);
  const bounded = clamp(valid ? value : min, min, max);
  const ratio = (bounded - min) / (max - min);
  const angle = -180 + ratio * 180;
  const [needleX, needleY] = polar(angle, 47);
  const status = valid ? resultStatus(criticalFactors, factorId, bounded, zones) : "WAITING";
  const statusColor = status === "TARGET" ? "#79c79c" : status === "EXTREME" ? "#ff7b72" : status === "WAITING" ? "#71858a" : "#e6b55c";

  return (
    <div className="border border-[#263b42] bg-[#09141a] px-3 pb-3 pt-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#a6b8b3]">{title}</p>
        <span className="pt-0.5 font-mono text-[8px] tracking-[0.12em]" style={{ color: statusColor }}>{status}</span>
      </div>
      <svg viewBox="0 0 220 132" className="mx-auto mt-1 block w-full max-w-[215px]" role="img" aria-label={`${title}: ${valid ? display + " " + unit : "awaiting telemetry"}, ${status}`}>
        {zones.map((zone, index) => {
          const start = -180 + ((zone.from - min) / (max - min)) * 180;
          const end = -180 + ((zone.to - min) / (max - min)) * 180;
          return <path key={index} d={arcPath(start + 1.1, end - 1.1)} fill="none" stroke={zone.color} strokeWidth="12" strokeLinecap="butt" opacity="0.94" />;
        })}
        <path d={arcPath(-180, 0, 53)} fill="none" stroke="#20323a" strokeWidth="1" />
        <line x1="110" y1="100" x2={needleX} y2={needleY} stroke="#e9efe6" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="110" cy="100" r="5" fill="#e9efe6" />
        <circle cx="110" cy="100" r="2" fill="#15242a" />
        <text x="110" y="121" fill="#f0f2e9" fontSize="15" textAnchor="middle" fontFamily="ui-monospace, SFMono-Regular, monospace">{valid ? display : "—"}</text>
      </svg>
      <div className="flex items-center justify-center gap-1 text-[9px] text-[#627b80]">
        <span>{min}</span><span className="text-[#40575e]">/</span><span>{max} {unit}</span>
      </div>
    </div>
  );
}

function Terminal({ text, terminalRef, stage, onSkip }) {
  return (
    <section className="border border-[#2b4446] bg-[#071014]">
      <div className="flex items-center justify-between border-b border-[#20373a] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#e7b45b]" />
          <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#93aaa2]">Flight computer / diagnostic log</span>
        </div>
        {stage === "diagnostics" && <button type="button" onClick={onSkip} className="text-[9px] uppercase tracking-[0.12em] text-[#e7b45b] hover:text-[#f5d391]">Skip animation ↗</button>}
      </div>
      <div ref={terminalRef} className="h-[205px] overflow-y-auto px-4 py-3 font-mono text-[10px] leading-[1.75] text-[#a6c4b5]">
        <pre className="whitespace-pre-wrap break-words">{text}<span className="terminal-cursor">█</span></pre>
      </div>
    </section>
  );
}

function ControlSlider({ label, value, min, max, step, display, onChange, disabled, accent = "#e7b45b" }) {
  return (
    <label className="block border-b border-[#1e353b] py-3 last:border-0">
      <span className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.1em] text-[#b5c7be]">
        {label}<output className="font-mono text-[#f0c77e]">{display}</output>
      </span>
      <input disabled={disabled} className="mt-3 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-40" style={{ accentColor: accent }} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function FlightSequence() {
  const pendingMission = loadPendingMission();
  const [flightState, setFlightState] = useState(() => makeInitialFlightState(pendingMission));
  const [telemetry, setTelemetry] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [stage, setStage] = useState("boot");
  const [revealed, setRevealed] = useState(false);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [launchAllowed, setLaunchAllowed] = useState(false);
  const [diagnosticOutcome, setDiagnosticOutcome] = useState(false);
  const [terminalText, setTerminalText] = useState("[BOOT] COLONY FRONTIER FLIGHT COMPUTER\n[SYS] Establishing vehicle telemetry...\n");
  const [terminalChars, setTerminalChars] = useState(0);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  const terminalRef = useRef(null);
  const stateRef = useRef(flightState);
  const previousPhaseRef = useRef(null);
  const previousCriticalRef = useRef(null);
  stateRef.current = flightState;

  const missionTitle = pendingMission
    ? `${pendingMission.campaign === "mars" ? "Mars" : "Moon"} Mission ${pendingMission.missionNumber}: ${pendingMission.missionTitle}`
    : "Mission simulation";
  const phase = phaseForElapsed(numberOr(flightState.elapsed_seconds, 0));
  const criticalFactors = verdict?.critical_factors ?? [];
  const criticalCount = numberOr(verdict?.critical_count, 0);
  const isTerminalBusy = stage === "boot" || stage === "diagnostics";
  const controlsDisabled = isTerminalBusy || stage === "success" || stage === "failure";
  const landed = stage === "success";
  const lost = stage === "failure";
  const hasWarnings = Boolean(verdict?.warnings?.length || criticalCount > 0);

  const oxygenPercent = telemetry && telemetry.oxygen_initial_kg > 0
    ? telemetry.oxygen_kg / telemetry.oxygen_initial_kg * 100
    : flightState.oxygen_initial_kg > 0 ? flightState.oxygen_kg / flightState.oxygen_initial_kg * 100 : NaN;
  const energyPercent = telemetry && telemetry.energy_initial_j > 0
    ? telemetry.energy_j / telemetry.energy_initial_j * 100
    : flightState.energy_initial_j > 0 ? flightState.energy_j / flightState.energy_initial_j * 100 : NaN;
  const pressureKpa = telemetry ? telemetry.pressure_pa / 1000 : NaN;
  const temperatureK = telemetry ? telemetry.temperature_k : flightState.temperature_k;
  const radiationGy = telemetry ? telemetry.radiation_gy : flightState.radiation_gy;
  const accelerationG = telemetry ? telemetry.acceleration_g : NaN;
  const angularAcceleration = telemetry ? Math.abs(telemetry.angular_acceleration_deg_s2) : 0;
  const pitchError = telemetry ? Math.abs(telemetry.pitch_error_deg) : 0;

  const rocketX = clamp(500 + numberOr(flightState.horizontal_position_m, 0) * 0.018, 300, 760);
  const rocketAltitude = Math.max(0, numberOr(flightState.altitude_m, 0));
  const rocketY = phase.id === "landing"
    ? 334 - clamp(rocketAltitude / 1200, 0, 1) * 138
    : 334 - clamp(rocketAltitude / 10000, 0, 1) * 220;
  const elapsed = Math.floor(numberOr(flightState.elapsed_seconds, 0));
  const progress = clamp((elapsed / 75) * 100, 0, 100);
  const stageLabel = {
    boot: "Initialising",
    diagnostics: "Checking systems",
    ready: "Go for launch",
    hold: "Launch on hold",
    flight: running ? "Flight in progress" : "Flight paused",
    success: "Touchdown verified",
    failure: "Mission lost",
  }[stage] ?? "Flight computer";

  function appendTerminalLine(line) {
    setTerminalText((previous) => `${previous}${previous.endsWith("\n") ? "" : "\n"}${line}\n`);
  }

  async function runPreflight() {
    setStage("diagnostics");
    setLaunchAllowed(false);
    setDiagnosticOutcome(false);
    setError("");
    setTerminalChars(0);
    setTerminalText("[BOOT] CHECKLIST SESSION OPEN\n[LINK] Python calculation service ........ REQUESTING\n[AUTH] Rust mission authority ............ REQUESTING\n");
    try {
      const state = stateRef.current;
      const response = await fetch("/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "preflight", dt_seconds: 0, state }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pre-flight telemetry could not be calculated.");
      if (!data.calculated || !data.verdict) throw new Error("The flight services returned an incomplete report.");
      setTelemetry(data.calculated);
      setVerdict(data.verdict);
      setFlightState((previous) => stateFromTelemetry(previous, data.calculated));
      const outcome = data.verdict.launch_allowed === true && data.verdict.alive === true;
      setDiagnosticOutcome(outcome);
      setLaunchAllowed(outcome);
      const findings = data.verdict.critical_factors ?? [];
      const checkRows = [
        ["OXYGEN RESERVE", data.calculated.oxygen_kg >= data.calculated.required_oxygen_kg, findings.includes("oxygen reserve")],
        ["ELECTRICAL RESERVE", data.calculated.energy_j >= data.calculated.required_energy_j, findings.includes("electrical reserve")],
        ["CABIN PRESSURE", data.calculated.pressure_pa >= 70000 && data.calculated.pressure_pa <= 110000, findings.includes("cabin pressure")],
        ["CABIN TEMPERATURE", data.calculated.temperature_k >= 285 && data.calculated.temperature_k <= 305, findings.includes("cabin temperature")],
        ["RADIATION MONITOR", data.calculated.radiation_gy <= 0.001, findings.includes("radiation dose")],
        ["CREW LOAD MODEL", data.calculated.acceleration_g <= 4, findings.includes("linear acceleration / crew load")],
        ["ATTITUDE / RATE", Math.abs(data.calculated.pitch_error_deg) <= 8 && Math.abs(data.calculated.angular_acceleration_deg_s2) <= 15, findings.includes("pitch error") || findings.includes("angular acceleration")],
        ["UPWARD FORCE MARGIN", data.calculated.net_vertical_force_n > 0, false],
        ["RESTRAINTS / FLIGHT CONTROLS", data.calculated.restraints_intact && data.calculated.flight_control_ok, false],
      ];
      const rows = checkRows.map(([label, pass, warning]) => {
        const status = !pass ? "FAIL" : warning ? "WARN" : "PASS";
        return `[CHECK] ${label.padEnd(30, ".")} ${status}`;
      });
      const passCount = checkRows.filter((row) => row[1] && !row[2]).length;
      const warnCount = checkRows.filter((row) => row[1] && row[2]).length;
      const failCount = checkRows.filter((row) => !row[1]).length;
      const report = [
        "[BOOT] COLONY FRONTIER FLIGHT COMPUTER",
        "[LINK] Python calculation service ........ CONNECTED",
        "[AUTH] Rust mission authority ............ ONLINE",
        ...rows,
        `[SUMMARY] ${passCount} PASS / ${warnCount} WARN / ${failCount} FAIL`,
        `[SURVIVAL] ${findings.length} factor(s) outside target range`,
        outcome ? "[GO / NO-GO] LAUNCH AUTHORISED" : "[GO / NO-GO] HOLD — CORRECT THE FAULTS AND RECHECK",
      ];
      setTerminalText(report.join("\n") + "\n");
      setTerminalChars(0);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      setDiagnosticOutcome(false);
      setLaunchAllowed(false);
      setVerdict(null);
      setStage("hold");
      setTerminalText([
        "[BOOT] COLONY FRONTIER FLIGHT COMPUTER",
        "[LINK] Python calculation service ........ NO DATA",
        "[AUTH] Rust mission authority ............ UNVERIFIED",
        "[GO / NO-GO] HOLD — DO NOT IGNITE",
        `[ERROR] ${message}`,
      ].join("\n") + "\n");
      setTerminalChars(0);
    }
  }

  async function advanceFlight() {
    if (busy || stage !== "flight") return;
    setBusy(true);
    setError("");
    try {
      const state = stateRef.current;
      const currentPhase = phaseForElapsed(numberOr(state.elapsed_seconds, 0));
      const response = await fetch("/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: currentPhase.id, dt_seconds: 1, state }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Flight telemetry update failed.");
      if (!data.calculated || !data.verdict) throw new Error("The flight services returned an incomplete report.");
      setTelemetry(data.calculated);
      setVerdict(data.verdict);
      setFlightState((previous) => stateFromTelemetry(previous, data.calculated));
      setTick((previous) => previous + 1);
      if (data.verdict.alive === false || data.verdict.mission_status === "MISSION_LOSS") {
        setRunning(false);
        setStage("failure");
      } else if (data.verdict.mission_status === "SUCCESS") {
        setRunning(false);
        setStage("success");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setRunning(false);
    } finally {
      setBusy(false);
    }
  }

  function updateControl(key, value) {
    setFlightState((previous) => ({ ...previous, [key]: value }));
    if (stage === "ready") {
      setStage("hold");
      setLaunchAllowed(false);
      setDiagnosticOutcome(false);
      setVerdict(null);
      appendTerminalLine("[SYSTEM] Controls changed since last check. Run pre-flight again before ignition.");
    }
  }

  function adjustTrim(amount) {
    updateControl("pitch_trim_deg", clamp(numberOr(stateRef.current.pitch_trim_deg, 0) + amount, -12, 12));
  }

  function adjustThrottle(amount) {
    updateControl("throttle_fraction", clamp(numberOr(stateRef.current.throttle_fraction, 0.92) + amount, 0.1, 1));
  }

  function ignite() {
    if (!launchAllowed || busy || stage !== "ready") return;
    setStage("flight");
    setRunning(true);
    setTick((previous) => previous + 1);
    appendTerminalLine("[IGNITION] Throttle command accepted. Rust launch clearance confirmed.");
  }

  function retryFlight() {
    const fresh = makeInitialFlightState(pendingMission);
    stateRef.current = fresh;
    setFlightState(fresh);
    setTelemetry(null);
    setVerdict(null);
    setStage("boot");
    setRunning(false);
    setBusy(false);
    setLaunchAllowed(false);
    setDiagnosticOutcome(false);
    setError("");
    setTick(0);
    setTerminalChars(0);
    setTerminalText("[SYS] Flight state reset. Reinitialising diagnostic bus...\n");
    window.setTimeout(() => { void runPreflight(); }, 250);
  }

  useEffect(() => {
    const revealTimer = window.setTimeout(() => setRevealed(true), 160);
    const diagnosticsTimer = window.setTimeout(() => { void runPreflight(); }, 760);
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(diagnosticsTimer);
    };
  }, []);

  useEffect(() => {
    if (!terminalText || terminalChars >= terminalText.length) return undefined;
    const delay = terminalChars < 110 ? 10 : 5;
    const timer = window.setTimeout(() => {
      setTerminalChars((previous) => Math.min(previous + 1, terminalText.length));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [terminalText, terminalChars]);

  useEffect(() => {
    if (stage === "diagnostics" && terminalText.length > 0 && terminalChars >= terminalText.length) {
      setStage(diagnosticOutcome ? "ready" : "hold");
    }
  }, [stage, terminalText, terminalChars, diagnosticOutcome]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalChars, terminalText]);

  useEffect(() => {
    if (stage !== "flight" || !running || busy) return undefined;
    const timer = window.setTimeout(() => { void advanceFlight(); }, TICK_MS);
    return () => window.clearTimeout(timer);
  }, [stage, running, busy, tick]);

  useEffect(() => {
    if (stage !== "flight") {
      previousPhaseRef.current = null;
      previousCriticalRef.current = null;
      return;
    }
    if (previousPhaseRef.current !== phase.id) {
      previousPhaseRef.current = phase.id;
      appendTerminalLine(`[GUIDANCE] ${phase.title.toUpperCase()} PROFILE ACTIVE — T+${elapsed}s`);
    }
  }, [phase.id, stage]);

  useEffect(() => {
    if (stage !== "flight" || !verdict) return;
    if (previousCriticalRef.current !== null && previousCriticalRef.current !== criticalCount) {
      appendTerminalLine(criticalCount === 0
        ? "[SURVIVAL] All factors have returned to target range."
        : `[SURVIVAL] ${criticalCount} critical factor(s): ${criticalFactors.join(", ")}`);
    }
    previousCriticalRef.current = criticalCount;
  }, [stage, criticalCount]);

  useEffect(() => {
    if (stage === "failure" && verdict) {
      appendTerminalLine("[ABORT] Rust mission authority returned MISSION_LOSS.");
      for (const reason of verdict.reasons ?? []) appendTerminalLine(`[FAULT] ${reason}`);
    }
  }, [stage]);

  useEffect(() => {
    if (stage !== "success") return undefined;
    const timer = window.setTimeout(() => { window.location.href = "/preview/MissionSimulation"; }, 2200);
    return () => window.clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== "flight") return undefined;
    function onKeyDown(event) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) event.preventDefault();
      if (event.repeat) return;
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") adjustTrim(-2);
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") adjustTrim(2);
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") adjustThrottle(0.05);
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") adjustThrottle(-0.05);
      if (event.key === " ") setRunning((previous) => !previous);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stage]);

  const displayTerminal = terminalText.slice(0, terminalChars);
  const sceneStatus = lost
    ? "Flight terminated"
    : landed
      ? "Surface contact"
      : stage === "flight"
        ? busy ? "Calculating telemetry" : running ? "Telemetry live" : "Simulation paused"
        : stage === "ready" ? "Checks complete" : stage === "hold" ? "No launch clearance" : "Diagnostics running";
  const currentAltitudeLabel = rocketAltitude >= 1000 ? `${(rocketAltitude / 1000).toFixed(2)} km` : `${Math.round(rocketAltitude)} m`;
  const criticalCounterColor = criticalCount >= 3 ? "#ff7770" : criticalCount > 0 ? "#e3b256" : "#79c79c";
  const pitchDisplay = telemetry ? telemetry.pitch_deg.toFixed(1) : flightState.pitch_deg.toFixed(1);
  const targetPitchDisplay = telemetry ? telemetry.target_pitch_deg.toFixed(1) : "0.0";
  const speedDisplay = telemetry
    ? Math.hypot(telemetry.vertical_speed_m_s, telemetry.horizontal_speed_m_s).toFixed(1)
    : "0.0";

  return (
    <main className="min-h-screen bg-[#050b0f] font-sans text-[#e4ebe4]">
      <style>{`
        @keyframes terminalBlink { 0%,48% {opacity:1} 49%,100% {opacity:0} }
        @keyframes engineFlicker { 0%,100% {opacity:.72; transform:scaleY(.9)} 50% {opacity:1; transform:scaleY(1.08)} }
        @keyframes beaconPulse { 0%,100% {opacity:.4; transform:scale(.92)} 50% {opacity:1; transform:scale(1.08)} }
        @keyframes gridDrift { from { transform:translateY(0) } to { transform:translateY(26px) } }
        .terminal-cursor { color:#e9ba62; animation:terminalBlink 1s steps(1,end) infinite; }
        .engine-flame { transform-origin:0 -21px; animation:engineFlicker .16s linear infinite; }
        .surface-beacon { transform-origin:center; animation:beaconPulse 1.8s ease-in-out infinite; }
        .range-input { accent-color:#e7b45b; }
        .flight-scroll { scrollbar-color:#2d494b #081217; scrollbar-width:thin; }
      `}</style>
      <div className="mx-auto max-w-[1680px] px-3 pb-10 pt-4 sm:px-5 lg:px-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[#243a40] pb-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.28em] text-[#9bb2a7]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e7b45b]" /> Colony Frontier <span className="text-[#3e5b5e]">/</span> Flight operations
            </div>
            <h1 className="text-2xl font-semibold tracking-[0.03em] text-[#f0f1e7] sm:text-3xl">{stage === "success" ? "Approach complete" : stage === "failure" ? "Flight terminated" : "Launch & survival"}</h1>
            <p className="mt-1 text-xs text-[#829a95]">{missionTitle} <span className="px-1.5 text-[#3c565a]">·</span> Pilot-in-command simulation</p>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-[8px] uppercase tracking-[0.2em] text-[#708987]">Mission elapsed</p>
              <p className="mt-1 font-mono text-lg text-[#e9c179]">T+{String(elapsed).padStart(3, "0")}s</p>
            </div>
            <div className="h-9 w-px bg-[#263c41]" />
            <div className="text-right">
              <p className="text-[8px] uppercase tracking-[0.2em] text-[#708987]">Flight status</p>
              <p className={`mt-1 text-[10px] font-bold uppercase tracking-[0.16em] ${lost ? "text-[#ff8078]" : landed ? "text-[#83d4a4]" : hasWarnings ? "text-[#e7b45b]" : "text-[#a8c8b4]"}`}>{stageLabel}</p>
            </div>
          </div>
        </header>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="border border-[#293f45] bg-[#08141a]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#20353b] px-4 py-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#a2b8ae]">2D flight deck</p>
                <p className="mt-1 text-[10px] text-[#657f80]">{phase.title} <span className="px-1 text-[#3c5358]">/</span> {phase.hint}</p>
              </div>
              <div className="flex items-center gap-4 font-mono text-[10px]">
                <span className="text-[#87a39a]">ALT <strong className="ml-1 text-[#e7e8de]">{currentAltitudeLabel}</strong></span>
                <span className="text-[#87a39a]">VEL <strong className="ml-1 text-[#e7e8de]">{speedDisplay} m/s</strong></span>
                <span className={`border px-2 py-1 ${stage === "failure" ? "border-[#7e3f43] text-[#ff837a]" : stage === "success" ? "border-[#426b54] text-[#86d5a5]" : "border-[#3a5257] text-[#bdc9b9]"}`}>{sceneStatus}</span>
              </div>
            </div>

            <div className="relative overflow-hidden">
              <svg viewBox="0 0 1000 430" preserveAspectRatio="xMidYMid meet" className="block w-full" role="img" aria-label="Side-on animated rocket flight view">
                <defs>
                  <linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06121c" />
                    <stop offset="68%" stopColor="#132a32" />
                    <stop offset="100%" stopColor="#26362f" />
                  </linearGradient>
                  <linearGradient id="hullGradient" x1="0" x2="1">
                    <stop offset="0%" stopColor="#6f8580" />
                    <stop offset="46%" stopColor="#e2e4d8" />
                    <stop offset="100%" stopColor="#879a92" />
                  </linearGradient>
                  <linearGradient id="flameGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f8e5a3" />
                    <stop offset="45%" stopColor="#eaa15a" />
                    <stop offset="100%" stopColor="#bd5646" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <rect width="1000" height="430" fill="url(#skyGradient)" />
                {STAR_FIELD.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={star.r} fill="#dbe6d9" opacity={star.opacity} />)}
                <path d="M0 286 C110 276 145 292 245 281 S430 271 535 287 S750 271 1000 282 L1000 430 L0 430 Z" fill="#13272a" opacity="0.56" />
                <path d="M0 339 C140 321 210 344 342 330 S590 344 690 329 S880 338 1000 321 L1000 430 L0 430 Z" fill="#24342f" />
                <path d="M0 368 C210 359 340 372 520 366 S820 369 1000 356" fill="none" stroke="#71816b" strokeWidth="1" opacity="0.42" />
                <path d="M0 388 H1000" stroke="#a2ae89" strokeWidth="1" opacity="0.25" />
                {Array.from({ length: 22 }, (_, i) => <path key={i} d={`M${i * 49} 394 l-10 8 h20 z`} fill="#455444" opacity="0.9" />)}
                <path d="M200 352 Q340 245 514 218 T820 276" fill="none" stroke="#9bb8a2" strokeWidth="1.2" strokeDasharray="4 8" opacity="0.48" />
                <circle className="surface-beacon" cx="830" cy="320" r="12" fill="none" stroke="#d5b368" strokeWidth="1.5" />
                <circle cx="830" cy="320" r="3.5" fill="#e9c179" />
                <path d="M830 300 V291 M830 340 V349 M810 320 H800 M850 320 H860" stroke="#d5b368" strokeWidth="1.2" opacity="0.8" />
                <g transform={`translate(${rocketX.toFixed(1)} ${rocketY.toFixed(1)}) rotate(${numberOr(flightState.pitch_deg, 0).toFixed(2)})`}>
                  {running && !lost && <path className="engine-flame" d={`M -8 21 Q 0 ${28 + 20 * numberOr(flightState.throttle_fraction, 0.9)} 8 21 Z`} fill="url(#flameGradient)" />}
                  <path d="M0 -38 C-7 -30 -11 -18 -11 -7 L-11 18 Q0 24 11 18 L11 -7 C11 -18 7 -30 0 -38 Z" fill="url(#hullGradient)" stroke="#d9e0d4" strokeWidth="1" />
                  <path d="M0 -38 C-3 -31 -4 -23 -4 -16 L4 -16 C4 -23 3 -31 0 -38 Z" fill="#edf0e7" opacity="0.75" />
                  <path d="M-11 8 L-20 22 L-10 19 M11 8 L20 22 L10 19" fill="#647b75" stroke="#b2c4b7" strokeWidth="1" />
                  <path d="M-7 -3 H7 M-8 4 H8" stroke="#7c9892" strokeWidth="1" />
                  <circle cx="0" cy="-11" r="4.1" fill="#244d59" stroke="#b6d3c8" strokeWidth="1" />
                  <path d="M-6 21 H6" stroke="#d8e0d7" strokeWidth="2" />
                </g>
                <text x="24" y="28" fill="#7d9b96" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, monospace" letterSpacing="2">FLIGHT PATH / SIDE VIEW</text>
                <text x="24" y="47" fill="#4e706f" fontSize="9" fontFamily="ui-monospace, SFMono-Regular, monospace">SIMULATION DISPLAY — NOT TO SCALE</text>
                <text x="956" y="24" textAnchor="end" fill="#86a09a" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, monospace">TARGET</text>
                <text x="956" y="40" textAnchor="end" fill="#d8bb79" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, monospace">SITE / {phase.id === "landing" ? "FINAL APPROACH" : "GUIDANCE"}</text>
              </svg>
              <div className="absolute bottom-3 left-3 flex flex-wrap gap-x-4 gap-y-1 bg-[#061015]/75 px-3 py-2 font-mono text-[9px] text-[#78918b]">
                <span>PITCH <strong className="text-[#dce4d9]">{pitchDisplay}°</strong></span>
                <span>TARGET <strong className="text-[#dce4d9]">{targetPitchDisplay}°</strong></span>
                <span>TRIM <strong className="text-[#e7bf72]">{numberOr(flightState.pitch_trim_deg, 0).toFixed(0)}°</strong></span>
                <span>THROTTLE <strong className="text-[#dce4d9]">{Math.round(numberOr(flightState.throttle_fraction, 0) * 100)}%</strong></span>
              </div>
            </div>
            <div className="flex h-1.5 bg-[#14262b]">
              <div className="bg-[#d2aa61] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <aside className="border border-[#293f45] bg-[#08141a]">
            <div className="border-b border-[#20353b] px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#a2b8ae]">Pilot inputs</p>
              <p className="mt-1 text-[10px] text-[#657f80]">Corrections apply to the next calculation step.</p>
            </div>
            <div className="px-4 py-2">
              <div className="flex items-center justify-between gap-2 py-3">
                <span className="text-[10px] uppercase tracking-[0.12em] text-[#b5c7be]">Attitude trim</span>
                <span className="font-mono text-[11px] text-[#e7bf72]">{numberOr(flightState.pitch_trim_deg, 0) > 0 ? "+" : ""}{numberOr(flightState.pitch_trim_deg, 0).toFixed(0)}°</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button disabled={controlsDisabled} onClick={() => adjustTrim(-2)} type="button" className="grid h-10 place-items-center border border-[#334b4f] bg-[#0d1b20] text-[#dce6da] hover:border-[#d4ad66] disabled:opacity-40" aria-label="Pitch left"><ArrowLeft size={15} /></button>
                <button disabled={controlsDisabled} onClick={() => updateControl("pitch_trim_deg", 0)} type="button" className="border border-[#334b4f] bg-[#0d1b20] text-[9px] font-bold uppercase tracking-[0.1em] text-[#93aaa1] hover:border-[#d4ad66] disabled:opacity-40">Centre</button>
                <button disabled={controlsDisabled} onClick={() => adjustTrim(2)} type="button" className="grid h-10 place-items-center border border-[#334b4f] bg-[#0d1b20] text-[#dce6da] hover:border-[#d4ad66] disabled:opacity-40" aria-label="Pitch right"><ArrowRight size={15} /></button>
              </div>
              <ControlSlider label="Engine throttle" value={flightState.throttle_fraction} min={0.1} max={1} step={0.01} display={`${Math.round(flightState.throttle_fraction * 100)}%`} onChange={(value) => updateControl("throttle_fraction", value)} disabled={controlsDisabled} />
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button disabled={controlsDisabled} onClick={() => adjustThrottle(-0.05)} type="button" className="flex h-9 items-center justify-center gap-2 border border-[#334b4f] text-[9px] uppercase tracking-[0.12em] text-[#9bb0a7] hover:border-[#d4ad66] disabled:opacity-40"><ArrowDown size={13} /> -5%</button>
                <button disabled={controlsDisabled} onClick={() => adjustThrottle(0.05)} type="button" className="flex h-9 items-center justify-center gap-2 border border-[#334b4f] text-[9px] uppercase tracking-[0.12em] text-[#9bb0a7] hover:border-[#d4ad66] disabled:opacity-40"><ArrowUp size={13} /> +5%</button>
              </div>
              <ControlSlider label="Oxygen use" value={flightState.oxygen_rate_kg_s} min={0.0003} max={0.012} step={0.0001} display={`${flightState.oxygen_rate_kg_s.toFixed(4)} kg/s`} onChange={(value) => updateControl("oxygen_rate_kg_s", value)} disabled={controlsDisabled} />
              <ControlSlider label="Electrical load" value={flightState.load_w} min={200} max={3000} step={50} display={`${Math.round(flightState.load_w)} W`} onChange={(value) => updateControl("load_w", value)} disabled={controlsDisabled} />
              <ControlSlider label="Cabin heat balance" value={flightState.heater_w - flightState.cooling_w} min={-3000} max={3000} step={100} display={`${Math.round(flightState.heater_w - flightState.cooling_w)} W`} onChange={(value) => setFlightState((previous) => {
                const next = { ...previous, heater_w: Math.max(0, value), cooling_w: Math.max(0, -value) };
                if (stage === "ready") { setStage("hold"); setLaunchAllowed(false); setVerdict(null); }
                return next;
              })} disabled={controlsDisabled} />
              <div className="mt-4 border-t border-[#1e353b] pt-3 text-[9px] leading-5 text-[#6f8987]">
                <p className="mb-1 font-bold uppercase tracking-[0.15em] text-[#91aaa0]">Keyboard</p>
                <p>A / ← and D / →: trim attitude</p>
                <p>W / ↑ and S / ↓: throttle</p>
                <p>Space: pause or resume simulation</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 pb-4">
                {stage === "ready" && <button type="button" onClick={ignite} disabled={!launchAllowed || busy} className="flex flex-1 items-center justify-center gap-2 bg-[#d8b46d] px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#14201b] hover:bg-[#efd18c] disabled:opacity-40"><Zap size={14} /> Ignite engines</button>}
                {stage === "hold" && <button type="button" onClick={() => { void runPreflight(); }} disabled={busy} className="flex flex-1 items-center justify-center gap-2 bg-[#d8b46d] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#14201b] hover:bg-[#efd18c] disabled:opacity-40"><RotateCcw size={13} /> Run checks again</button>}
                {stage === "flight" && <button type="button" onClick={() => setRunning((previous) => !previous)} className="flex flex-1 items-center justify-center gap-2 border border-[#45625a] bg-[#10231f] px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#b8d7c2] hover:border-[#84b89a]">{running ? <CirclePause size={14} /> : <CirclePlay size={14} />}{running ? "Pause" : "Resume"}</button>}
                {lost && <button type="button" onClick={retryFlight} className="flex flex-1 items-center justify-center gap-2 border border-[#86494b] bg-[#31191b] px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#ffaba2]"><RotateCcw size={13} /> Retry flight</button>}
                {landed && <button type="button" onClick={() => { window.location.href = "/preview/MissionSimulation"; }} className="flex flex-1 items-center justify-center gap-2 bg-[#7bc89d] px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#0a1a18]">Enter colony operations <ChevronRight size={14} /></button>}
              </div>
              {error && <div className="mb-4 border border-[#794448] bg-[#281719] p-3 text-[10px] leading-5 text-[#ffaea6]"><AlertTriangle size={13} className="mr-1 inline" />{error}{stage === "flight" && <button onClick={() => setRunning(true)} type="button" className="ml-2 underline underline-offset-2">Resume</button>}</div>}
              {(stage === "success" || stage === "failure") && <button type="button" onClick={() => { window.location.href = "/preview/MainMenu"; }} className="mb-4 w-full border border-[#2b4446] px-3 py-2 text-[9px] uppercase tracking-[0.14em] text-[#819892] hover:text-[#dfe8dd]">Return to mission control</button>}
              {stage === "hold" && <p className="pb-3 text-[9px] leading-5 text-[#c5a56b]">Launch stays locked until the Python report is validated by Rust and every blocking check is cleared.</p>}
            </div>
          </aside>
        </section>

        <section className="mb-5 border border-[#293f45] bg-[#08141a]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#20353b] px-4 py-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#a2b8ae]">Crew survival envelope</p>
              <p className="mt-1 text-[10px] text-[#657f80]">Aim for green. Yellow needs correction; four simultaneous critical factors end the flight.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[8px] uppercase tracking-[0.16em] text-[#718985]">Critical factors</p>
                <p className="font-mono text-lg" style={{ color: criticalCounterColor }}>{criticalCount}<span className="text-[10px] text-[#677e7f]"> / 3</span></p>
              </div>
              <div className="h-8 w-px bg-[#263c41]" />
              <div className="text-[9px] leading-4 text-[#829995]">{criticalCount >= 3 ? "EMERGENCY — one more causes loss" : criticalCount > 0 ? "Correct the highlighted factors" : "All tracked factors nominal"}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[#1c3036] sm:grid-cols-3 lg:grid-cols-4">
            <SurvivalGauge title="Oxygen reserve" value={oxygenPercent} min={0} max={100} display={Number.isFinite(oxygenPercent) ? oxygenPercent.toFixed(0) : "—"} unit="%" zones={RANGE_ZONES.oxygen} criticalFactors={criticalFactors} factorId="oxygen reserve" />
            <SurvivalGauge title="Electrical reserve" value={energyPercent} min={0} max={100} display={Number.isFinite(energyPercent) ? energyPercent.toFixed(0) : "—"} unit="%" zones={RANGE_ZONES.energy} criticalFactors={criticalFactors} factorId="electrical reserve" />
            <SurvivalGauge title="Cabin pressure" value={pressureKpa} min={50} max={120} display={Number.isFinite(pressureKpa) ? pressureKpa.toFixed(1) : "—"} unit="kPa" zones={RANGE_ZONES.pressure} criticalFactors={criticalFactors} factorId="cabin pressure" />
            <SurvivalGauge title="Cabin temperature" value={temperatureK} min={270} max={315} display={temperatureK.toFixed(1)} unit="K" zones={RANGE_ZONES.temperature} criticalFactors={criticalFactors} factorId="cabin temperature" />
            <SurvivalGauge title="Radiation dose" value={radiationGy} min={0} max={0.002} display={radiationGy.toExponential(1)} unit="Gy" zones={RANGE_ZONES.radiation} criticalFactors={criticalFactors} factorId="radiation dose" />
            <SurvivalGauge title="Linear / crew load" value={accelerationG} min={0} max={5} display={Number.isFinite(accelerationG) ? accelerationG.toFixed(2) : "—"} unit="g" zones={RANGE_ZONES.acceleration} criticalFactors={criticalFactors} factorId="linear acceleration / crew load" />
            <SurvivalGauge title="Angular acceleration" value={angularAcceleration} min={0} max={20} display={angularAcceleration.toFixed(1)} unit="deg/s²" zones={RANGE_ZONES.angular} criticalFactors={criticalFactors} factorId="angular acceleration" />
            <SurvivalGauge title="Pitch error" value={pitchError} min={0} max={15} display={pitchError.toFixed(1)} unit="deg" zones={RANGE_ZONES.attitude} criticalFactors={criticalFactors} factorId="pitch error" />
          </div>
          {verdict?.warnings?.length > 0 && <div className="border-t border-[#293f45] px-4 py-3 text-[10px] leading-5 text-[#c9aa6c]"><AlertTriangle size={13} className="mr-1 inline" />{verdict.warnings.join(" ")}</div>}
          {lost && <div className="border-t border-[#754144] bg-[#241416] px-4 py-3 text-xs leading-6 text-[#ffaaa3]"><strong className="uppercase tracking-[0.14em]">Mission loss.</strong> {verdict?.reasons?.join(" ") || "The Rust authority terminated the flight."}</div>}
          {landed && <div className="border-t border-[#3d6b50] bg-[#0d241b] px-4 py-4 text-xs leading-6 text-[#b8dfc2]"><strong className="uppercase tracking-[0.14em]">Touchdown confirmed.</strong> Crew survival checks passed. Moving to colony operations…</div>}
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Terminal text={displayTerminal} terminalRef={terminalRef} stage={stage} onSkip={() => setTerminalChars(terminalText.length)} />
          <section className="border border-[#293f45] bg-[#08141a] px-4 py-3">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#a2b8ae]"><ShieldCheck size={14} /> Authority / telemetry</div>
            <div className="mt-3 divide-y divide-[#20353b]">
              <div className="flex items-center justify-between py-2 text-[10px]"><span className="text-[#718b87]">Python model</span><span className={telemetry ? "text-[#7cc79d]" : "text-[#768b8b]"}>{telemetry ? "RESPONDING" : "WAITING"}</span></div>
              <div className="flex items-center justify-between py-2 text-[10px]"><span className="text-[#718b87]">Rust verdict</span><span className={verdict ? verdict.alive ? "text-[#7cc79d]" : "text-[#ff827a]" : "text-[#768b8b]"}>{verdict ? verdict.mission_status.replaceAll("_", " ") : "UNVERIFIED"}</span></div>
              <div className="flex items-center justify-between py-2 text-[10px]"><span className="text-[#718b87]">Upward force</span><span className="font-mono text-[#d8e3d7]">{telemetry ? `${(telemetry.net_vertical_force_n / 1000).toFixed(1)} kN` : "—"}</span></div>
              <div className="flex items-center justify-between py-2 text-[10px]"><span className="text-[#718b87]">Angular rate</span><span className="font-mono text-[#d8e3d7]">{telemetry ? `${telemetry.angular_velocity_deg_s.toFixed(1)}°/s` : "—"}</span></div>
              <div className="flex items-center justify-between py-2 text-[10px]"><span className="text-[#718b87]">Linear acceleration</span><span className="font-mono text-[#d8e3d7]">{telemetry ? `${telemetry.linear_acceleration_m_s2.toFixed(2)} m/s²` : "—"}</span></div>
              <div className="flex items-center justify-between py-2 text-[10px]"><span className="text-[#718b87]">Landing impact</span><span className="font-mono text-[#d8e3d7]">{telemetry?.landing_impact_g != null ? `${telemetry.landing_impact_g.toFixed(2)} g` : "PENDING"}</span></div>
            </div>
          </section>
        </div>

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#21363a] pt-4 text-[9px] leading-5 text-[#617b7c]">
          <p>Simulation model: SI units internally. Thresholds are illustrative gameplay rules, not real-world launch limits.</p>
          <button type="button" onClick={() => { window.location.href = "/preview/MainMenu"; }} className="uppercase tracking-[0.15em] hover:text-[#d9e4d7]">Abort to mission control ↗</button>
        </footer>
      </div>
      {stage === "hold" && !telemetry && <div className="sr-only" role="alert">Launch is on hold because verified telemetry is unavailable.</div>}
      <div aria-hidden="true" className={`pointer-events-none fixed inset-0 z-[100] bg-[#020508] transition-opacity duration-[1100ms] ease-out ${revealed ? "opacity-0" : "opacity-100"}`} />
      {stage === "success" && <div className="fixed inset-0 z-[90] grid place-items-center bg-[#03090c]/90 px-4 backdrop-blur-sm">
        <div className="max-w-lg border border-[#4a785a] bg-[#0a1915] p-8 text-center shadow-2xl shadow-black/40">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[#659975] text-[#92d9a7]"><Check size={22} /></div>
          <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.25em] text-[#93c7a2]">Rust authority · success</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#eef1e6]">Surface contact confirmed</h2>
          <p className="mt-3 text-sm leading-6 text-[#9cb7a6]">Survival checks passed. Transfer to colony operations is ready.</p>
          <button onClick={() => { window.location.href = "/preview/MissionSimulation"; }} type="button" className="mt-6 inline-flex items-center gap-2 bg-[#83c99d] px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#102019]">Continue <ChevronRight size={15} /></button>
        </div>
      </div>}
    </main>
  );
}
