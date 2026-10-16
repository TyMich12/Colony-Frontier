import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUp, ChevronRight, RotateCcw, ShieldCheck, Zap } from "lucide-react";
import { GameShell } from "./_shared/GameShell";
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
const DIAGNOSTIC_TEXT = [
  "[BOOT] Colony Frontier launch console / build 04.9",
  "[LINK] Flight guidance bus ............... ONLINE",
  "[LIFE] Oxygen loop and cabin pressure .... CHECKED",
  "[PWR ] Main bus and reserve battery ...... CHECKED",
  "[THER] Cabin thermal controller .......... CHECKED",
  "[NAV ] Inertial reference and pitch servo  ONLINE",
  "[SAFE] Restraints / flight controls ...... CHECKED",
  "[RULE] Survival envelope loaded .......... READY",
  "",
  "[NOTE] Green = target band; amber = critical; red = extreme.",
  "[NOTE] Four or more critical factors means mission loss.",
  "[SYS ] Awaiting pilot input.",
].join("\n");

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

function RocketScene({ telemetry, phase }: { telemetry: Telemetry; phase: Phase }) {
  const rotation = clamp(telemetry.pitch - 90, -50, 12);
  const translateY = phase === "flight" ? -Math.min(telemetry.altitude / 180, 90) : phase === "success" ? -90 : 0;
  return (
    <div className="relative h-[290px] overflow-hidden border border-[#294148] bg-[linear-gradient(180deg,#091820_0%,#112b36_60%,#1a3435_100%)]">
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(167,202,192,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(167,202,192,.12)_1px,transparent_1px)] [background-size:30px_30px]" />
      <div className="absolute right-7 top-6 h-14 w-14 rounded-full border border-[#9bb9ad]/60 bg-[#b8c9b7]/10 shadow-[0_0_35px_rgba(175,208,187,.12)]" />
      <div className="absolute bottom-0 left-0 right-0 h-12 border-t border-[#637f72] bg-[#172a27]" />
      <div className="absolute bottom-12 left-0 right-0 h-5 bg-[linear-gradient(180deg,transparent,rgba(7,16,24,.65))]" />
      <div className="absolute bottom-[54px] left-[16%] h-10 w-16 border-b border-[#547168] opacity-70" />
      <div className="absolute bottom-[54px] right-[17%] h-16 w-24 border-b border-[#547168] opacity-60" />
      <div className="absolute left-1/2 bottom-[50px] w-[100px] transition-transform duration-200 ease-out" style={{ transform: `translate(-50%, ${translateY}px) rotate(${rotation}deg)` }}>
        <svg viewBox="0 0 100 190" className="h-[190px] w-[100px] drop-shadow-[0_0_18px_rgba(239,182,88,.18)]" role="img" aria-label="2D launch vehicle">
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
  telemetryRef.current = telemetry;

  useEffect(() => {
    let index = 0;
    const timer = window.setInterval(() => {
      index += 3;
      setTerminalText(DIAGNOSTIC_TEXT.slice(0, index));
      if (index >= DIAGNOSTIC_TEXT.length) {
        window.clearInterval(timer);
        setTerminalText(DIAGNOSTIC_TEXT);
        setPhase("ready");
      }
    }, 12);
    return () => window.clearInterval(timer);
  }, []);

  const factors = useMemo(() => buildFactors(telemetry, phase === "flight"), [telemetry, phase]);
  const criticalCount = factors.filter((factor) => factor.severity === "CRITICAL").length;
  const extremeCount = factors.filter((factor) => factor.severity === "EXTREME").length;
  const riskIndex = Math.min(100, factors.reduce((total, factor) => total + (factor.severity === "EXTREME" ? 18 : factor.severity === "CRITICAL" ? 9 : 0), 0) + Math.max(0, telemetry.acceleration - 1) * 7 + Math.abs(telemetry.pitch - 90) * 0.3);
  const readyToLaunch = criticalCount < 4 && extremeCount === 0;

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
      if (critical >= 4 || extreme >= 2) {
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

  function beginFlight() {
    if (!readyToLaunch) return;
    setTelemetry((old) => ({ ...old, elapsed: 0, altitude: 0, verticalSpeed: 0, angularVelocity: 0, angularAcceleration: 0, acceleration: 0 }));
    setPhase("flight");
  }

  function retry() {
    setTelemetry({
      oxygen: 94, energy: 91, pressure: 101.3, temperature: 21.5, radiation: 0.08,
      acceleration: 0, angularAcceleration: 0, pitch: 90, angularVelocity: 0,
      altitude: 0, verticalSpeed: 0, elapsed: 0, throttle: 0.78, trim: 0,
      electricalLoad: 0.55, oxygenFlow: 0.35, heatBalance: 0,
    });
    setTerminalText(DIAGNOSTIC_TEXT);
    setPhase("ready");
  }

  function enterMission() {
    // The loadout and rewards are already stored by MissionLoadout. Only a verified
    // successful ascent hands control to the existing colony mission.
    clearMissionRuntime();
    window.location.href = "/preview/MissionSimulation";
  }

  return (
    <GameShell active="loadout" eyebrow="Flight Operations / Launch Control" title="Ascent Simulation">
      <div className="relative" style={{ animation: "cfLaunchFade 850ms ease-out both" }}>
        <style>{`@keyframes cfLaunchFade { from { opacity: 0; } to { opacity: 1; } } @keyframes cfCurtain { from { opacity: 1; } to { opacity: 0; visibility: hidden; } }`}</style>
        <div className="pointer-events-none fixed inset-0 z-[100] bg-[#020609]" style={{ animation: "cfCurtain 1.1s ease-out forwards" }} />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border border-[#294148] bg-[#0a171d] px-5 py-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#efb658]">Mission {pending?.missionNumber ?? "—"} / {pending?.campaign?.toUpperCase() ?? "NO ACTIVE MISSION"}</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#e6eee5]">{pending?.missionTitle ?? "No mission staged"}</p>
            <p className="mt-1 text-[10px] text-[#88a3a2]">Guidance is yours. Keep the vehicle inside the survival envelope.</p>
          </div>
          <div className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] ${phase === "flight" ? "border-[#efb658] text-[#efb658]" : phase === "failure" ? "border-[#d9534f] text-[#ff8a8a]" : phase === "success" ? "border-[#6ebc91] text-[#9be0b7]" : "border-[#35515a] text-[#a5b6ac]"}`}>
            {phase === "boot" ? "Diagnostics running" : phase === "ready" ? "Awaiting ignition" : phase === "flight" ? "Ascent in progress" : phase === "success" ? "Ascent complete" : "Mission lost"}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <section className="min-w-0 space-y-5">
            <div className="border border-[#294148] bg-[#071219] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#7fa19d]">Flight computer / diagnostics</span>
                <span className={`h-2 w-2 rounded-full ${phase === "failure" ? "bg-[#d9534f]" : phase === "success" ? "bg-[#6ebc91]" : "animate-pulse bg-[#efb658]"}`} />
              </div>
              <pre className="min-h-[205px] whitespace-pre-wrap break-words font-mono text-[10px] leading-[1.8] text-[#a6c6b7]">{terminalText}<span className="animate-pulse text-[#efb658]">▌</span></pre>
            </div>

            <RocketScene telemetry={telemetry} phase={phase} />

            <div className="grid grid-cols-3 gap-2">
              {[
                ["MISSION TIME", `${telemetry.elapsed.toFixed(1)} s`],
                ["PITCH", `${telemetry.pitch.toFixed(1)}°`],
                ["TARGET", `${(targetPitch(telemetry.elapsed) + telemetry.trim).toFixed(1)}°`],
                ["ALTITUDE", `${Math.round(telemetry.altitude).toLocaleString()} m`],
                ["VERTICAL SPEED", `${telemetry.verticalSpeed.toFixed(1)} m/s`],
                ["THRUST SETTING", `${Math.round(telemetry.throttle * 100)}%`],
              ].map(([label, value]) => (
                <div key={label} className="border border-[#294148] bg-[#0b1a21] px-3 py-3">
                  <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-[#779b9b]">{label}</div>
                  <div className="mt-2 font-mono text-sm text-[#d7e8bd]">{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="min-w-0 space-y-5">
            <div className="border border-[#294148] bg-[#0b1a21] p-5">
              <div className="flex flex-wrap items-center gap-5">
                <DonutEnvelope risk={riskIndex} label="Envelope" />
                <div className="min-w-[120px] flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#779b9b]">Survival envelope</p>
                  <p className="mt-2 text-2xl font-semibold text-[#edf4ec]">{criticalCount} <span className="text-sm font-normal text-[#a5b6ac]">critical</span></p>
                  <p className="mt-1 text-xs text-[#a5b6ac]">{extremeCount} extreme factor{extremeCount === 1 ? "" : "s"} detected</p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#1b3035]">
                    <div className={`h-full transition-all ${criticalCount >= 4 || extremeCount >= 2 ? "bg-[#d9534f]" : criticalCount ? "bg-[#d6a84c]" : "bg-[#6ebc91]"}`} style={{ width: `${Math.min(100, criticalCount / 4 * 100)}%` }} />
                  </div>
                  <p className="mt-2 text-[9px] leading-relaxed text-[#779b9b]">0–3 critical factors: continue with caution. 4+: mission loss.</p>
                </div>
              </div>
            </div>

            <div className="border border-[#294148] bg-[#0b1a21] p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#779b9b]">Live factor readings</span>
                <span className="text-[9px] text-[#779b9b]">{factors.length} monitored</span>
              </div>
              <div className="space-y-4">
                {factors.map((factor) => (
                  <div key={factor.id} className="border-b border-[#1b3035] pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold text-[#dce8df]">{factor.label}</p>
                        <p className="mt-1 text-[9px] text-[#779b9b]">{factor.note}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-xs text-[#edf4ec]">{factor.display}</p>
                        <p className={`mt-1 text-[8px] font-bold uppercase tracking-[0.16em] ${factor.severity === "SURVIVAL" ? "text-[#6ebc91]" : factor.severity === "CRITICAL" ? "text-[#d6a84c]" : "text-[#d9534f]"}`}>{factor.severity}</p>
                      </div>
                    </div>
                    <ThresholdBar position={factor.position} />
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-[#294148] bg-[#0b1a21] p-5">
              <div className="mb-4 flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#efb658]" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#e6eee5]">Pilot controls</h2>
              </div>
              <Control label="Main throttle" value={telemetry.throttle} min={0.3} max={1} step={0.01} display={`${Math.round(telemetry.throttle * 100)}%`} onChange={(value) => changeControl("throttle", value)} />
              <Control label="Pitch trim" value={telemetry.trim} min={-18} max={18} step={1} display={`${telemetry.trim > 0 ? "+" : ""}${telemetry.trim}°`} onChange={(value) => changeControl("trim", value)} />
              <Control label="Electrical load" value={telemetry.electricalLoad} min={0.2} max={1.4} step={0.05} display={`${telemetry.electricalLoad.toFixed(2)}×`} onChange={(value) => changeControl("electricalLoad", value)} />
              <Control label="Oxygen flow" value={telemetry.oxygenFlow} min={0.1} max={1} step={0.05} display={`${telemetry.oxygenFlow.toFixed(2)}×`} onChange={(value) => changeControl("oxygenFlow", value)} />
              <Control label="Cabin heat balance" value={telemetry.heatBalance} min={-5} max={5} step={0.5} display={`${telemetry.heatBalance > 0 ? "+" : ""}${telemetry.heatBalance.toFixed(1)}`} onChange={(value) => changeControl("heatBalance", value)} />
              <p className="mt-4 flex items-start gap-2 text-[9px] leading-relaxed text-[#779b9b]"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[#d6a84c]" /> Guidance target changes through ascent. Use trim to keep pitch error low; excessive throttle increases acceleration and risk.</p>
            </div>

            {phase === "boot" && (
              <div className="border border-[#294148] bg-[#0b1a21] px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-[#a5b6ac]">Waiting for launch computer checks…</div>
            )}
            {phase === "ready" && (
              <button type="button" onClick={beginFlight} disabled={!readyToLaunch} className={`flex w-full items-center justify-center gap-2 px-5 py-4 text-[10px] font-bold uppercase tracking-[0.22em] transition ${readyToLaunch ? "bg-[#efb658] text-[#172126] hover:bg-[#f6ca76]" : "cursor-not-allowed border border-[#d9534f] bg-[#351316] text-[#ff8a8a]"}`}>
                <ArrowUp className="h-4 w-4" /> {readyToLaunch ? "Ignite engines" : "Launch inhibited — clear red factors"}
              </button>
            )}
            {phase === "flight" && (
              <div className="border border-[#efb658]/50 bg-[#241e14] px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-[#efb658]">Flight live · keep the vehicle within limits</div>
            )}
            {phase === "failure" && (
              <div className="border border-[#d9534f]/60 bg-[#260e12] p-4">
                <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-[#ff8a8a]"><AlertTriangle className="h-4 w-4" /> Mission lost</p>
                <p className="mt-2 text-xs leading-relaxed text-[#d4aaa9]">The vehicle exceeded the survival envelope. Review the amber and red factors, adjust the controls, then run the ascent again.</p>
                <button type="button" onClick={retry} className="mt-4 flex items-center gap-2 bg-[#efb658] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#172126]"><RotateCcw className="h-4 w-4" /> Reset flight</button>
              </div>
            )}
            {phase === "success" && (
              <div className="border border-[#6ebc91]/60 bg-[#0b201c] p-4">
                <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-[#9be0b7]"><ShieldCheck className="h-4 w-4" /> Ascent successful</p>
                <p className="mt-2 text-xs leading-relaxed text-[#b6d2c2]">The vehicle stayed inside the survival envelope and reached the transfer corridor. Continue to the colony mission.</p>
                <button type="button" onClick={enterMission} className="mt-4 flex w-full items-center justify-center gap-2 bg-[#6ebc91] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#071812]">Enter colony mission <ChevronRight className="h-4 w-4" /></button>
              </div>
            )}
          </section>
        </div>
      </div>
    </GameShell>
  );
}

function Control({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void }) {
  return (
    <label className="mb-4 block last:mb-0">
      <span className="flex items-center justify-between gap-3 text-[10px] text-[#dce8df]"><span>{label}</span><span className="font-mono text-[#efb658]">{display}</span></span>
      <input aria-label={label} className="mt-2 w-full accent-[#efb658]" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="mt-1 flex justify-between text-[8px] uppercase tracking-[0.12em] text-[#6f8c8b]"><span>{min}</span><span>{max}</span></span>
    </label>
  );
}

export default FlightSequence;
