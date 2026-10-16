import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUp, ChevronRight, RotateCcw, ShieldCheck, Zap } from "lucide-react";
import { clearMissionRuntime, loadPendingMission } from "./missionRuntime";

type Phase = "boot" | "ready" | "flight" | "success" | "failure";
type Telemetry = {
  oxygen: number;
  energy: number;
  pressure: number;
  temperature: number;
  radiation: number;
  acceleration: number;
  angularAcceleration: number;
  pitch: number;
  angularVelocity: number;
  altitude: number;
  verticalSpeed: number;
  elapsed: number;
  throttle: number;
  trim: number;
  electricalLoad: number;
  oxygenFlow: number;
  heatBalance: number;
};

type Factor = {
  id: keyof Pick<Telemetry, "oxygen" | "energy" | "pressure" | "temperature" | "radiation" | "acceleration" | "angularAcceleration" | "pitch">;
  label: string;
  value: number;
  display: string;
  severity: "SURVIVAL" | "CRITICAL" | "EXTREME";
  note: string;
  position: number;
};

const G0 = 9.80665;
const FLIGHT_DURATION = 20;
function buildDiagnosticText(t: Telemetry): string {
  const factors = buildFactors(t, false);
  const status = (id: Factor["id"]) => {
    const factor = factors.find((item) => item.id === id);
    if (!factor) return "NO DATA";
    return factor.severity === "EXTREME" ? "FAIL" : factor.severity === "CRITICAL" ? "WARN" : "PASS";
  };
  const validTelemetry = Object.values(t).every((value) => Number.isFinite(value));
  const yellow = factors.filter((factor) => factor.severity === "CRITICAL").length;
  const red = factors.filter((factor) => factor.severity === "EXTREME").length;
  const checksPassed = validTelemetry && red === 0 && yellow < 4;
  return [
    "[BOOT] Colony Frontier launch console / build 05.0",
    "[LINK] Local flight simulation ........... " + (validTelemetry ? "CONNECTED" : "NO DATA"),
    "[CHECK] Crew oxygen reserve .............. " + status("oxygen"),
    "[CHECK] Electrical reserve ............... " + status("energy"),
    "[CHECK] Cabin pressure ................... " + status("pressure"),
    "[CHECK] Cabin temperature ................ " + status("temperature"),
    "[CHECK] Radiation exposure ............... " + status("radiation"),
    "[CHECK] Flight acceleration .............. " + status("acceleration"),
    "[CHECK] Guidance / pitch error ........... " + status("pitch"),
    "[CHECK] Control model .................... " + (validTelemetry ? "PASS" : "NO DATA"),
    "[SUMMARY] " + (factors.length - yellow - red) + " pass; " + yellow + " warning; " + red + " extreme.",
    "[GO/NO-GO] " + (checksPassed ? "LAUNCH AUTHORISED" : "HOLD — REVIEW RED / INVALID READINGS"),
    "",
    "[NOTE] Three at-risk factors = emergency; four or more = mission loss.",
    "[SYS ] Adjust controls, then re-run checks before ignition.",
  ].join("\n");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function classify(value: number, survivalMin: number, survivalMax: number, extremeMin: number, extremeMax: number): Factor["severity"] {
  if (value < extremeMin || value > extremeMax) return "EXTREME";
  if (value < survivalMin || value > survivalMax) return "CRITICAL";
  return "SURVIVAL";
}

function buildFactors(t: Telemetry, inFlight: boolean): Factor[] {
  const entries: Array<Omit<Factor, "severity" | "position"> & { limits: [number, number, number, number] }> = [
    { id: "oxygen", label: "Oxygen reserve", value: t.oxygen, display: `${Math.round(t.oxygen)}%`, note: "usable reserve", limits: [45, 100, 15, 115] },
    { id: "energy", label: "Electrical reserve", value: t.energy, display: `${Math.round(t.energy)}%`, note: "main bus reserve", limits: [35, 100, 12, 115] },
    { id: "pressure", label: "Cabin pressure", value: t.pressure, display: `${t.pressure.toFixed(1)} kPa`, note: "target 95–105 kPa", limits: [75, 115, 58, 130] },
    { id: "temperature", label: "Cabin temperature", value: t.temperature, display: `${t.temperature.toFixed(1)} °C`, note: "target 18–26 °C", limits: [10, 32, -2, 46] },
    { id: "radiation", label: "Radiation dose", value: t.radiation, display: `${t.radiation.toFixed(2)} mGy`, note: "accumulated dose", limits: [0, 0.65, 0, 1.5] },
    { id: "acceleration", label: "Linear acceleration", value: t.acceleration, display: `${t.acceleration.toFixed(2)} g`, note: "keep below 3.2 g", limits: [0.2, 3.2, -0.1, 4.2] },
    { id: "angularAcceleration", label: "Angular acceleration", value: Math.abs(t.angularAcceleration), display: `${Math.abs(t.angularAcceleration).toFixed(1)} °/s²`, note: "limit rapid rotation", limits: [0, 8, 0, 18] },
    { id: "pitch", label: "Pitch error", value: Math.abs(t.pitch - (inFlight ? targetPitch(t.elapsed) + t.trim : 90 + t.trim)), display: `${Math.abs(t.pitch - (inFlight ? targetPitch(t.elapsed) + t.trim : 90 + t.trim)).toFixed(1)}°`, note: "difference from guidance target", limits: [0, 8, 0, 22] },
  ];

  return entries.map((entry) => {
    const [min, max, extremeMin, extremeMax] = entry.limits;
    let severity = classify(entry.value, min, max, extremeMin, extremeMax);
    // Radiation is a one-sided dose limit, not a two-sided operating band.
    if (entry.id === "radiation") {
      severity = entry.value > 1.0 ? "EXTREME" : entry.value > 0.65 ? "CRITICAL" : "SURVIVAL";
    }
    // Angular acceleration is an absolute value and should never be considered out of range on the low side.
    if (entry.id === "angularAcceleration") {
      severity = entry.value > 18 ? "EXTREME" : entry.value > 8 ? "CRITICAL" : "SURVIVAL";
    }
    let position = 50;
    if (entry.id === "radiation") {
      position = entry.value <= 0.65 ? 41 + (entry.value / 0.65) * 18 : entry.value <= 1 ? 59 + ((entry.value - 0.65) / 0.35) * 23 : 82 + Math.min(18, (entry.value - 1) * 36);
    } else if (entry.id === "angularAcceleration" || entry.id === "pitch") {
      const upper = entry.id === "pitch" ? 22 : 18;
      const criticalStart = entry.id === "pitch" ? 8 : 8;
      position = entry.value <= criticalStart ? 50 + (entry.value / criticalStart) * 9 : entry.value <= upper ? 59 + ((entry.value - criticalStart) / (upper - criticalStart)) * 23 : 82 + Math.min(18, (entry.value - upper) * 2);
    } else if (entry.value < min) {
      position = entry.value >= extremeMin
        ? 18 + ((entry.value - extremeMin) / Math.max(0.001, min - extremeMin)) * 23
        : Math.max(0, 18 - (extremeMin - entry.value) * 3);
    } else if (entry.value > max) {
      position = entry.value <= extremeMax
        ? 59 + ((entry.value - max) / Math.max(0.001, extremeMax - max)) * 23
        : Math.min(100, 82 + (entry.value - extremeMax) * 3);
    } else {
      position = 41 + ((entry.value - min) / Math.max(0.001, max - min)) * 18;
    }
    if (!inFlight && entry.id === "acceleration") severity = "SURVIVAL";
    return { ...entry, severity, position: clamp(position, 0, 100) };
  });
}

function targetPitch(elapsed: number) {
  if (elapsed < 4) return 88;
  if (elapsed < 9) return 80 - (elapsed - 4) * 2.2;
  if (elapsed < 15) return 69 - (elapsed - 9) * 3.1;
  return 50;
}

function DonutEnvelope({ risk, label }: { risk: number; label: string }) {
  const angle = -135 + clamp(risk, 0, 100) * 2.7;
  return (
    <div className="relative mx-auto h-44 w-44 shrink-0">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: "conic-gradient(from 225deg, #d9534f 0deg 38deg, #d6a84c 38deg 91deg, #6ebc91 91deg 179deg, #d6a84c 179deg 232deg, #d9534f 232deg 270deg, transparent 270deg 360deg)" }}
      />
      <div className="absolute inset-[14px] rounded-full border border-[#28434a] bg-[#0a171d]" />
      <div className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
        <span className="absolute left-1/2 top-[2px] h-5 w-1 -translate-x-1/2 rounded-full bg-[#f3d18b] shadow-[0_0_12px_rgba(243,209,139,.65)]" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#779b9b]">{label}</span>
        <span className="mt-1 font-mono text-3xl font-semibold text-[#edf4ec]">{Math.round(risk)}<span className="text-sm text-[#779b9b]">/100</span></span>
        <span className="mt-1 text-[9px] uppercase tracking-[0.18em] text-[#a5b6ac]">stress index</span>
      </div>
    </div>
  );
}

function ThresholdBar({ position }: { position: number }) {
  return (
    <div className="relative mt-3 h-2 overflow-hidden rounded-sm bg-[#1b3035]">
      <div className="absolute inset-y-0 left-0 w-[18%] bg-[#d9534f]" />
      <div className="absolute inset-y-0 left-[18%] w-[23%] bg-[#d6a84c]" />
      <div className="absolute inset-y-0 left-[41%] w-[18%] bg-[#6ebc91]" />
      <div className="absolute inset-y-0 left-[59%] w-[23%] bg-[#d6a84c]" />
      <div className="absolute inset-y-0 right-0 w-[18%] bg-[#d9534f]" />
      <div className="absolute -top-1 h-4 w-[3px] bg-white shadow-[0_0_7px_rgba(255,255,255,.8)]" style={{ left: `${position}%` }} />
    </div>
  );
}

function RocketScene({ telemetry, phase, critical }: { telemetry: Telemetry; phase: Phase; critical: boolean }) {
  const rotation = clamp(telemetry.pitch - 90, -50, 12);
  const translateY = phase === "flight" ? -Math.min(telemetry.altitude / 180, 90) : phase === "success" ? -90 : 0;
  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden border-0 bg-[linear-gradient(180deg,#07121c_0%,#102b37_58%,#1a3435_100%)]">
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(167,202,192,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(167,202,192,.12)_1px,transparent_1px)] [background-size:42px_42px]" />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-label="Planned ascent trajectory">
        <defs><filter id="trajectoryGlow"><feGaussianBlur stdDeviation="3.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <path d="M 500 635 C 510 540, 555 465, 615 385 S 735 230, 835 120" fill="none" stroke="#6ebc91" strokeWidth="3" strokeDasharray="9 8" opacity="0.95" filter="url(#trajectoryGlow)"/>
        <path d={critical ? "M 615 385 C 650 335, 690 275, 735 230 S 790 165, 835 120" : "M 615 385 C 650 335, 690 275, 735 230 S 790 165, 835 120"} fill="none" stroke={critical ? "#f05252" : "#6ebc91"} strokeWidth="5" strokeDasharray="7 8" opacity={critical ? "1" : "0.5"}/>
        <circle cx="835" cy="120" r="9" fill={critical ? "#f05252" : "#6ebc91"} stroke="#e9f4e9" strokeWidth="2"/>
        <text x="850" y="115" fill={critical ? "#ff8888" : "#9be0b7"} fontSize="15" fontFamily="monospace">TARGET TRAJECTORY</text>
      </svg>
      <div className="absolute right-7 top-6 h-14 w-14 rounded-full border border-[#9bb9ad]/60 bg-[#b8c9b7]/10 shadow-[0_0_35px_rgba(175,208,187,.12)]" />
      <div className="absolute bottom-0 left-0 right-0 h-12 border-t border-[#637f72] bg-[#172a27]" />
      <div className="absolute bottom-12 left-0 right-0 h-5 bg-[linear-gradient(180deg,transparent,rgba(7,16,24,.65))]" />
      <div className="absolute bottom-[54px] left-[16%] h-10 w-16 border-b border-[#547168] opacity-70" />
      <div className="absolute bottom-[54px] right-[17%] h-16 w-24 border-b border-[#547168] opacity-60" />
      <div className="absolute left-[50%] bottom-[12%] w-[clamp(100px,13vw,190px)] transition-transform duration-200 ease-out" style={{ transform: `translate(-50%, ${translateY}px) rotate(${rotation}deg)` }}>
        <svg viewBox="0 0 100 190" className="h-[min(58vh,520px)] w-full drop-shadow-[0_0_28px_rgba(239,182,88,.32)]" role="img" aria-label="2D launch vehicle">
          <path d="M50 6 C34 25 31 42 31 67 L31 129 L18 154 L34 149 L41 171 L50 160 L59 171 L66 149 L82 154 L69 129 L69 67 C69 42 66 25 50 6Z" fill="#dce3d8" stroke="#91a9a2" strokeWidth="2" />
          <path d="M50 10 C41 28 41 40 41 52 L59 52 C59 40 59 28 50 10Z" fill="#efb658" />
          <rect x="39" y="61" width="22" height="31" rx="4" fill="#193b45" stroke="#8db5b4" strokeWidth="2" />
          <path d="M40 105 H60 V128 H40Z" fill="#b6c7bd" />
          <path d="M42 171 L50 187 L58 171Z" fill={phase === "flight" ? "#f1a45a" : "#59716f"} />
          {phase === "flight" && <path d="M44 173 L50 205 L56 173Z" fill="#f3d18b" opacity=".9" />}
        </svg>
      </div>
      <div className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[#9db7ad]">
        FLIGHT PATH / 2D VIEW
      </div>
      <div className="absolute bottom-3 right-4 text-right font-mono text-[10px] text-[#d7e8bd]">
        <div>ALT {Math.round(telemetry.altitude).toLocaleString()} m</div>
        <div>V/S {telemetry.verticalSpeed.toFixed(1)} m/s</div>
      </div>
      {phase === "success" && <div className="absolute left-4 bottom-4 border border-[#6ebc91] bg-[#0b201c]/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9be0b7]">Ascent stable</div>}
      {phase === "failure" && <div className="absolute inset-0 grid place-items-center bg-[#260e12]/75 text-sm font-bold uppercase tracking-[0.2em] text-[#ff8a8a]">Flight terminated</div>}
    </div>
  );
}

export function FlightSequence() {
  const pending = loadPendingMission();
  const [phase, setPhase] = useState<Phase>("boot");
  const [terminalText, setTerminalText] = useState("");
  const [telemetry, setTelemetry] = useState<Telemetry>({
    oxygen: 94, energy: 91, pressure: 101.3, temperature: 21.5, radiation: 0.08,
    acceleration: 0, angularAcceleration: 0, pitch: 90, angularVelocity: 0,
    altitude: 0, verticalSpeed: 0, elapsed: 0, throttle: 0.78, trim: 0,
    electricalLoad: 0.55, oxygenFlow: 0.35, heatBalance: 0,
  });
  const telemetryRef = useRef(telemetry);
  const diagnosticsTimerRef = useRef<number | null>(null);
  telemetryRef.current = telemetry;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      if (!["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "s", "a", "d", "q", "e", "o", "p", "h", "j"].includes(key)) return;
      event.preventDefault();
      setTelemetry((old) => {
        const next = { ...old };
        if (key === "arrowup" || key === "w") next.throttle = clamp(old.throttle + 0.03, 0.3, 1);
        if (key === "arrowdown" || key === "s") next.throttle = clamp(old.throttle - 0.03, 0.3, 1);
        if (key === "arrowleft" || key === "a") next.trim = clamp(old.trim - 1, -18, 18);
        if (key === "arrowright" || key === "d") next.trim = clamp(old.trim + 1, -18, 18);
        if (key === "q") next.electricalLoad = clamp(old.electricalLoad - 0.05, 0.2, 1.4);
        if (key === "e") next.electricalLoad = clamp(old.electricalLoad + 0.05, 0.2, 1.4);
        if (key === "o") next.oxygenFlow = clamp(old.oxygenFlow - 0.05, 0.1, 1);
        if (key === "p") next.oxygenFlow = clamp(old.oxygenFlow + 0.05, 0.1, 1);
        if (key === "h") next.heatBalance = clamp(old.heatBalance - 0.5, -5, 5);
        if (key === "j") next.heatBalance = clamp(old.heatBalance + 0.5, -5, 5);
        telemetryRef.current = next;
        return next;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const diagnosticText = buildDiagnosticText(telemetryRef.current);
    let index = 0;
    const timer = window.setInterval(() => {
      index += 3;
      setTerminalText(diagnosticText.slice(0, index));
      if (index >= diagnosticText.length) {
        window.clearInterval(timer);
        diagnosticsTimerRef.current = null;
        setTerminalText(diagnosticText);
        setPhase("ready");
      }
    }, 12);
    diagnosticsTimerRef.current = timer;
    return () => {
      window.clearInterval(timer);
      diagnosticsTimerRef.current = null;
    };
  }, []);

  const factors = useMemo(() => buildFactors(telemetry, phase === "flight" || telemetry.elapsed > 0), [telemetry, phase]);
  const criticalCount = factors.filter((factor) => factor.severity === "CRITICAL").length;
  const extremeCount = factors.filter((factor) => factor.severity === "EXTREME").length;
  // Each factor has exactly one severity, so yellow + red counts distinct at-risk factors once.
  const atRiskCount = criticalCount + extremeCount;
  const riskIndex = Math.min(100, factors.reduce((total, factor) => total + (factor.severity === "EXTREME" ? 18 : factor.severity === "CRITICAL" ? 9 : 0), 0) + Math.max(0, telemetry.acceleration - 1) * 7 + Math.abs(telemetry.pitch - 90) * 0.3);
  const readyToLaunch = atRiskCount < 4 && extremeCount === 0;

  useEffect(() => {
    if (phase !== "flight") return;
    const timer = window.setInterval(() => {
      const old = telemetryRef.current;
      const dt = 0.2;
      const elapsed = old.elapsed + dt;
      const desiredPitch = targetPitch(elapsed) + old.trim;
      const angularAcceleration = clamp((desiredPitch - old.pitch) * 0.8 - old.angularVelocity * 1.25, -18, 18);
      const angularVelocity = clamp(old.angularVelocity + angularAcceleration * dt, -22, 22);
      const pitch = clamp(old.pitch + angularVelocity * dt, 15, 105);
      const acceleration = clamp(old.throttle * 3.65 - 0.18, 0.1, 4.1);
      const verticalSpeed = Math.max(0, old.verticalSpeed + (acceleration * G0 * Math.sin(pitch * Math.PI / 180) - G0 * 0.08) * dt);
      const altitude = old.altitude + verticalSpeed * dt;
      const energy = clamp(old.energy - Math.max(0, old.electricalLoad * 1.7 - 0.6) * dt, 0, 110);
      const oxygen = clamp(old.oxygen - old.oxygenFlow * 0.025 * dt, 0, 110);
      const pressure = clamp(old.pressure - Math.max(0, 0.3 - old.oxygenFlow) * 0.002 * dt, 0, 140);
      const temperature = clamp(old.temperature + old.heatBalance * 0.035 * dt - (old.temperature - 21.5) * 0.001, -10, 60);
      const radiation = old.radiation + 0.0007 * dt;
      const next = { ...old, elapsed, angularAcceleration, angularVelocity, pitch, acceleration, verticalSpeed, altitude, energy, oxygen, pressure, temperature, radiation };
      telemetryRef.current = next;
      setTelemetry(next);

      const nextFactors = buildFactors(next, true);
      const critical = nextFactors.filter((factor) => factor.severity === "CRITICAL").length;
      const extreme = nextFactors.filter((factor) => factor.severity === "EXTREME").length;
      const atRisk = critical + extreme;
      if (atRisk >= 4) {
        setPhase("failure");
        window.clearInterval(timer);
      } else if (elapsed >= FLIGHT_DURATION) {
        setPhase("success");
        window.clearInterval(timer);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [phase]);

  function changeControl(key: "throttle" | "trim" | "electricalLoad" | "oxygenFlow" | "heatBalance", value: number) {
    setTelemetry((old) => {
      const next = { ...old, [key]: value };
      telemetryRef.current = next;
      return next;
    });
  }

  function skipDiagnostics() {
    if (diagnosticsTimerRef.current !== null) window.clearInterval(diagnosticsTimerRef.current);
    diagnosticsTimerRef.current = null;
    const report = buildDiagnosticText(telemetryRef.current);
    setTerminalText(report);
    setPhase("ready");
  }

  function beginFlight() {
    if (!readyToLaunch) {
      setTerminalText(buildDiagnosticText(telemetryRef.current));
      return;
    }
    setTelemetry((old) => ({ ...old, elapsed: 0, altitude: 0, verticalSpeed: 0, angularVelocity: 0, angularAcceleration: 0, acceleration: 0 }));
    setPhase("flight");
  }

  function retry() {
    const resetTelemetry: Telemetry = {
      oxygen: 94, energy: 91, pressure: 101.3, temperature: 21.5, radiation: 0.08,
      acceleration: 0, angularAcceleration: 0, pitch: 90, angularVelocity: 0,
      altitude: 0, verticalSpeed: 0, elapsed: 0, throttle: 0.78, trim: 0,
      electricalLoad: 0.55, oxygenFlow: 0.35, heatBalance: 0,
    };
    telemetryRef.current = resetTelemetry;
    setTelemetry(resetTelemetry);
    setTerminalText(buildDiagnosticText(resetTelemetry));
    setPhase("ready");
  }

  function enterMission() {
    // The loadout and rewards are already stored by MissionLoadout. Only a verified
    // successful ascent hands control to the existing colony mission.
    clearMissionRuntime();
    window.location.href = "/preview/MissionSimulation";
  }

  const [helpOpen, setHelpOpen] = useState(true);

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] w-screen overflow-hidden bg-[#03090d] text-[#edf4ec] [font-family:Arial,sans-serif]">
      <style>{`@keyframes cfLaunchFade { from { opacity: 0; } to { opacity: 1; } } @keyframes cfCurtain { from { opacity: 1; } to { opacity: 0; visibility: hidden; } .cf-hud { background: rgba(4,14,19,.88); backdrop-filter: blur(8px); }`}</style>
      <RocketScene telemetry={telemetry} phase={phase} critical={atRiskCount >= 3 || extremeCount > 0} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(2,8,12,.55)_100%)]" />
      <header className="cf-hud absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 border-b border-[#294148] px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center border border-[#526c62] bg-[#10221f]"><span className={`h-2.5 w-2.5 rounded-full ${phase === "failure" ? "bg-[#f05252]" : "bg-[#6ebc91] shadow-[0_0_12px_#6ebc91]"}`} /></span>
          <div className="min-w-0"><p className="truncate text-[8px] font-bold uppercase tracking-[0.25em] text-[#8aa99a]">Colony-Frontier · Flight Simulator</p><h1 className="truncate text-sm font-black uppercase tracking-[0.12em]">Ascent Operations</h1></div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`hidden border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.14em] sm:inline-block ${phase === "flight" ? "border-[#efb658] text-[#efb658]" : phase === "failure" ? "border-[#f05252] text-[#ff8888]" : phase === "success" ? "border-[#6ebc91] text-[#9be0b7]" : "border-[#35515a] text-[#a5b6ac]"}`}>{phase === "boot" ? "Diagnostics" : phase === "ready" ? "Ready" : phase === "flight" ? "Ascent live" : phase === "success" ? "Ascent complete" : "Mission lost"}</span>
          <button type="button" title="Open the flight control guide and keyboard shortcuts" onClick={() => setHelpOpen(true)} className="border border-[#6ebc91] bg-[#10251f] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#9be0b7] hover:bg-[#19372c]">? Controls</button>
        </div>
      </header>

      <div className="pointer-events-none absolute left-1/2 top-[12%] z-10 -translate-x-1/2 text-center">
        <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-[#8aa99a] sm:text-[10px]">Mission {pending?.missionNumber ?? "—"} · {pending?.missionTitle ?? "Launch vehicle"}</p>
        <p className="mt-1 font-mono text-[10px] text-[#9be0b7] sm:text-xs">TARGET TRAJECTORY <span className="text-[#6ebc91]">━ GREEN</span> <span className="ml-2 text-[#ff8888]">━ RED = CRITICAL</span></p>
      </div>

      <aside className="cf-hud absolute bottom-3 left-3 z-20 w-[min(31vw,330px)] space-y-2 border border-[#294148] p-3 sm:bottom-5 sm:left-5 sm:p-4">
        <div className="flex items-center justify-between gap-2"><h2 className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#efb658] sm:text-[10px]">Flight diagnostics</h2><span className="font-mono text-[9px] text-[#8aa99a]">{factors.length} checks</span></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="border border-[#294148] bg-[#0b1a21] p-2"><p className="text-[8px] uppercase text-[#8aa99a]">At risk</p><p className={`mt-1 text-xl font-bold ${atRiskCount >= 3 ? "text-[#ff8888]" : atRiskCount ? "text-[#efb658]" : "text-[#9be0b7]"}`}>{atRiskCount}</p></div>
          <div className="border border-[#294148] bg-[#0b1a21] p-2"><p className="text-[8px] uppercase text-[#8aa99a]">Stress index</p><p className="mt-1 text-xl font-bold text-[#edf4ec]">{Math.round(riskIndex)}<span className="text-xs text-[#8aa99a]">/100</span></p></div>
        </div>
        <div className="space-y-2">
          {factors.slice(0,5).map((factor) => <div key={factor.id} className="border-b border-[#1b3035] pb-1.5 last:border-0">
            <div className="flex items-center justify-between gap-2"><span className="truncate text-[9px] text-[#dce8df]">{factor.label}</span><span className={`shrink-0 font-mono text-[9px] ${factor.severity === "SURVIVAL" ? "text-[#9be0b7]" : factor.severity === "CRITICAL" ? "text-[#efb658]" : "text-[#ff8888]"}`}>{factor.display}</span></div>
            <div className="relative mt-1 h-2 overflow-hidden rounded-sm bg-[#1b3035]"><div className="absolute inset-y-0 left-0 w-[18%] bg-[#d9534f]"/><div className="absolute inset-y-0 left-[18%] w-[23%] bg-[#d6a84c]"/><div className="absolute inset-y-0 left-[41%] w-[18%] bg-[#6ebc91]"/><div className="absolute inset-y-0 left-[59%] w-[23%] bg-[#d6a84c]"/><div className="absolute inset-y-0 right-0 w-[18%] bg-[#d9534f]"/><div className="absolute -top-0.5 h-3 w-[3px] bg-white" style={{left:`${factor.position}%`}}/></div>
          </div>)}
        </div>
        <p className="text-[8px] leading-relaxed text-[#8aa99a]">Green = within safe limits · amber = warning · red = critical.</p>
      </aside>

      <aside className="cf-hud absolute bottom-3 right-3 z-20 w-[min(31vw,330px)] space-y-3 border border-[#294148] p-3 sm:bottom-5 sm:right-5 sm:p-4">
        <div className="grid grid-cols-2 gap-2">
          {[
            ["TIME", `${telemetry.elapsed.toFixed(1)} s`],
            ["ALTITUDE", `${Math.round(telemetry.altitude).toLocaleString()} m`],
            ["VERTICAL SPEED", `${telemetry.verticalSpeed.toFixed(1)} m/s`],
            ["PITCH / TARGET", `${telemetry.pitch.toFixed(0)}° / ${(targetPitch(telemetry.elapsed)+telemetry.trim).toFixed(0)}°`],
          ].map(([label,value])=><div key={label} className="border border-[#294148] bg-[#0b1a21] p-2"><p className="text-[7px] uppercase tracking-[0.12em] text-[#8aa99a] sm:text-[8px]">{label}</p><p className="mt-1 font-mono text-xs text-[#d7e8bd] sm:text-sm">{value}</p></div>)}
        </div>
        <div className="flex items-center justify-between"><h2 className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#efb658]">Pilot controls</h2><button type="button" onClick={() => setHelpOpen(true)} className="text-[8px] text-[#9be0b7] underline">What does what?</button></div>
        <Control label="Throttle" explanation="Thrust and acceleration" value={telemetry.throttle} min={0.3} max={1} step={0.01} display={`${Math.round(telemetry.throttle*100)}%`} onChange={(value)=>changeControl("throttle",value)} />
        <Control label="Pitch trim" explanation="Corrects the guidance angle" value={telemetry.trim} min={-18} max={18} step={1} display={`${telemetry.trim>0?"+":""}${telemetry.trim}°`} onChange={(value)=>changeControl("trim",value)} />
        <div className="hidden space-y-2 md:block">
          <Control label="Electrical load" explanation="Higher uses battery faster" value={telemetry.electricalLoad} min={0.2} max={1.4} step={0.05} display={`${telemetry.electricalLoad.toFixed(2)}×`} onChange={(value)=>changeControl("electricalLoad",value)} />
          <Control label="Oxygen flow" explanation="Higher flow uses oxygen faster" value={telemetry.oxygenFlow} min={0.1} max={1} step={0.05} display={`${telemetry.oxygenFlow.toFixed(2)}×`} onChange={(value)=>changeControl("oxygenFlow",value)} />
          <Control label="Cabin heat" explanation="Negative cools; positive heats" value={telemetry.heatBalance} min={-5} max={5} step={0.5} display={`${telemetry.heatBalance>0?"+":""}${telemetry.heatBalance.toFixed(1)}`} onChange={(value)=>changeControl("heatBalance",value)} />
        </div>
        {phase === "boot" && <button type="button" onClick={skipDiagnostics} className="w-full border border-[#526c62] px-3 py-2 text-[9px] font-bold uppercase text-[#dce8df]">Skip checks animation</button>}
        {phase === "ready" && <button type="button" onClick={beginFlight} disabled={!readyToLaunch} className={`w-full px-3 py-3 text-[9px] font-bold uppercase tracking-[0.15em] ${readyToLaunch ? "bg-[#efb658] text-[#172126]" : "cursor-not-allowed bg-[#351316] text-[#ff8888]"}`}>{readyToLaunch ? "▲ Ignite engines" : "Launch blocked · clear red factors"}</button>}
        {phase === "flight" && <p className="border border-[#efb658]/50 bg-[#241e14] px-3 py-2 text-[9px] uppercase text-[#efb658]">Ascent live · adjust controls</p>}
        {phase === "failure" && <div className="space-y-2 border border-[#d9534f]/60 bg-[#260e12] p-3"><p className="text-xs font-bold uppercase text-[#ff8888]">Mission lost</p><button type="button" onClick={retry} className="w-full bg-[#efb658] px-3 py-2 text-[9px] font-bold uppercase text-[#172126]">↻ Reset flight</button></div>}
        {phase === "success" && <div className="space-y-2 border border-[#6ebc91]/60 bg-[#0b201c] p-3"><p className="text-xs font-bold uppercase text-[#9be0b7]">Ascent successful</p><button type="button" onClick={enterMission} className="w-full bg-[#6ebc91] px-3 py-3 text-[9px] font-bold uppercase text-[#071812]">Enter colony mission →</button></div>}
      </aside>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 text-center md:block"><p className="font-mono text-[10px] text-[#d7e8bd]">THRUST {Math.round(telemetry.throttle*100)}% · ENERGY {Math.round(telemetry.energy)}% · O₂ {Math.round(telemetry.oxygen)}%</p><p className="mt-1 text-[8px] uppercase tracking-[0.2em] text-[#8aa99a]">Flight path is schematic · maintain green guidance corridor</p></div>

      {helpOpen && <div className="absolute inset-0 z-50 grid place-items-center bg-[#02070b]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="flight-help-title">
        <div className="w-full max-w-xl border border-[#6ebc91] bg-[#07151b] p-5 shadow-[0_0_50px_rgba(110,188,145,.16)] sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#efb658]">Pilot briefing</p><h2 id="flight-help-title" className="mt-2 text-lg font-black uppercase tracking-[0.12em] sm:text-2xl">How to fly this mission</h2></div><button type="button" aria-label="Close controls guide" onClick={()=>setHelpOpen(false)} className="border border-[#526c62] px-3 py-2 text-sm text-[#dce8df]">✕</button></div>
          <p className="mt-3 text-xs leading-relaxed text-[#a5b6ac]">Keep the rocket close to the planned trajectory. Green means the guidance path is safe; red means critical flight conditions. Make small adjustments and watch the readings.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="border border-[#294148] bg-[#0b1a21] p-3"><h3 className="text-[10px] font-bold uppercase text-[#9be0b7]">Movement</h3><p className="mt-2 text-xs leading-relaxed text-[#dce8df]"><b>W / ↑</b> increase throttle<br/><b>S / ↓</b> decrease throttle<br/><b>A / ←</b> pitch trim left<br/><b>D / →</b> pitch trim right</p></div>
            <div className="border border-[#294148] bg-[#0b1a21] p-3"><h3 className="text-[10px] font-bold uppercase text-[#9be0b7]">Systems</h3><p className="mt-2 text-xs leading-relaxed text-[#dce8df]"><b>Q / E</b> electrical load − / +<br/><b>O / P</b> oxygen flow − / +<br/><b>H / J</b> cabin heat − / +</p></div>
            <div className="border border-[#294148] bg-[#0b1a21] p-3 sm:col-span-2"><h3 className="text-[10px] font-bold uppercase text-[#efb658]">What the controls do</h3><p className="mt-2 text-xs leading-relaxed text-[#a5b6ac]"><b>Throttle:</b> changes thrust and acceleration. <b>Pitch trim:</b> offsets the target angle. <b>Electrical load:</b> higher settings drain the reserve faster. <b>Oxygen flow:</b> higher settings use oxygen faster and help cabin pressure. <b>Cabin heat:</b> negative cools, positive warms the cabin. Use the side sliders for fine adjustments.</p></div>
          </div>
          <button type="button" onClick={()=>setHelpOpen(false)} className="mt-5 w-full bg-[#6ebc91] px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#071812]">Got it · enter flight deck</button>
        </div>
      </div>}
    </div>
  );
}

function Control({ label, explanation, value, min, max, step, display, onChange }: { label: string; explanation: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void }) {
  return (
    <label className="mb-4 block last:mb-0">
      <span className="flex items-center justify-between gap-3 text-[10px] text-[#dce8df]"><span>{label}</span><span className="font-mono text-[#efb658]">{display}</span></span>
      <span className="mt-1 block text-[9px] leading-relaxed text-[#779b9b]">{explanation}</span>
      <input aria-label={label} title={explanation} className="mt-2 w-full accent-[#efb658]" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="mt-1 flex justify-between text-[8px] uppercase tracking-[0.12em] text-[#6f8c8b]"><span>{min}</span><span>{max}</span></span>
    </label>
  );
}

export default FlightSequence;
