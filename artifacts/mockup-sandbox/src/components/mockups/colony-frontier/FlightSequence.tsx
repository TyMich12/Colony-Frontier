import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Power, Radio, ShieldCheck, Volume2 } from "lucide-react";
import { loadPendingMission } from "./missionRuntime";

type Stage = "approach" | "boarding" | "startup" | "launch" | "landing" | "landed" | "outside";

const stageCopy: Record<Stage, { label: string; title: string; detail: string }> = {
  approach: { label: "PRE-LAUNCH / 01", title: "Crew transfer in progress", detail: "Suit checks complete. Proceed to the launch vehicle." },
  boarding: { label: "CREW ACCESS / 02", title: "Entering the spacecraft", detail: "Hatch sealed. Cabin pressure and restraints are being verified." },
  startup: { label: "SYSTEMS BOOT / 03", title: "Powering the vehicle", detail: "Flight computer online · life support nominal · guidance aligned." },
  launch: { label: "ASCENT / 04", title: "Leaving the launch pad", detail: "Main engines at thrust. Hold position while guidance stabilises." },
  landing: { label: "ARRIVAL / 05", title: "Lunar descent", detail: "Descent engines active. Landing zone acquired; dust plume detected." },
  landed: { label: "MISSION SITE / 06", title: "Touchdown confirmed", detail: "Engines shut down. The colony habitat is visible through the forward window." },
  outside: { label: "SURFACE OPERATIONS / 07", title: "Welcome to the frontier", detail: "Suit integrity confirmed. Transfer to the mission simulation." },
};

const timeline: Stage[] = ["approach", "boarding", "startup", "launch", "landing", "landed"];

export function FlightSequence() {
  const pending = loadPendingMission();
  const [stage, setStage] = useState<Stage>("approach");
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [manual, setManual] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    const lines = [
      "COLONY FRONTIER FLIGHT SYSTEM v05.0",
      "Checking crew life-support ........ PASS",
      "Cabin pressure seal ............... PASS",
      "Navigation and landing radar ...... ONLINE",
      "Thermal control loop .............. STABLE",
      "Guidance computer ................. READY",
      "Mission uplink .................... CONNECTED",
      "ALL PRIMARY SYSTEMS NOMINAL",
    ];
    let index = 0;
    let interval: number | undefined;
    const start = window.setTimeout(() => {
      setStage("boarding");
      interval = window.setInterval(() => {
        setBootLines((old) => {
          if (index >= lines.length) return old;
          const next = [...old, lines[index]];
          index += 1;
          if (index >= lines.length && interval) window.clearInterval(interval);
          return next;
        });
      }, 520);
      window.setTimeout(() => setStage((old) => old === "startup" ? old : "startup"), 1500);
    }, 2600);
    return () => {
      window.clearTimeout(start);
      if (interval) window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (stage !== "approach" && stage !== "boarding" && stage !== "startup" && stage !== "launch" && stage !== "landing") return;
    const next: Partial<Record<Stage, Stage>> = {
      approach: "boarding",
      boarding: "startup",
      startup: "launch",
      launch: "landing",
      landing: "landed",
    };
    const delay = stage === "approach" ? 3600 : stage === "boarding" ? 5000 : stage === "startup" ? 6500 : stage === "launch" ? 6500 : 5500;
    const timer = window.setTimeout(() => setStage((old) => old === stage ? (next[stage] ?? old) : old), delay);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const stageIndex = timeline.indexOf(stage);
  const skipAhead = () => {
    setManual(true);
    setStage((old) => {
      if (old === "approach") return "boarding";
      if (old === "boarding") return "startup";
      if (old === "startup") return "launch";
      if (old === "launch") return "landing";
      return "landed";
    });
  };

  const copy = stageCopy[stage];
  const isFlight = stage === "launch" || stage === "landing";
  const isLanded = stage === "landed" || stage === "outside";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050b12] text-[#e7f0eb]" style={{ fontFamily: "Arial, sans-serif" }}>
      <style>{`
        @keyframes starsDrift { from { transform: translate3d(0,0,0); } to { transform: translate3d(-55px,32px,0); } }
        @keyframes cabinPulse { 0%,100% { opacity:.4 } 50% { opacity:1 } }
        @keyframes engineFlicker { 0%,100% { transform:scaleY(.8); opacity:.72 } 50% { transform:scaleY(1.18); opacity:1 } }
        @keyframes shake { 0%,100% { transform:translate(0,0) } 25% { transform:translate(1px,-1px) } 50% { transform:translate(-1px,1px) } 75% { transform:translate(1px,1px) } }
        @keyframes dustRoll { from { transform:translateX(-8%) scaleY(.7); opacity:.25 } to { transform:translateX(8%) scaleY(1.2); opacity:.75 } }
        @keyframes walkIn { from { transform:translateX(-160px) scale(1); opacity:0 } to { transform:translateX(0) scale(.72); opacity:1 } }
        @keyframes hatchGlow { 0%,100% { box-shadow:0 0 12px #efb65833 } 50% { box-shadow:0 0 35px #efb65899 } }
        .stars { background-image:radial-gradient(2px 2px at 10% 22%,#d8e9f0 50%,transparent 60%),radial-gradient(1px 1px at 25% 68%,#c2d4e3 50%,transparent 60%),radial-gradient(1px 1px at 67% 31%,#fff 50%,transparent 60%),radial-gradient(2px 2px at 81% 75%,#c9dbe4 50%,transparent 60%),radial-gradient(1px 1px at 92% 18%,#fff 50%,transparent 60%),radial-gradient(1px 1px at 48% 42%,#d6e5ed 50%,transparent 60%); background-size:370px 270px; animation:starsDrift 28s linear infinite; }
        .rocket-shell { clip-path:polygon(50% 0%,63% 12%,67% 25%,67% 72%,86% 92%,64% 86%,58% 100%,50% 91%,42% 100%,36% 86%,14% 92%,33% 72%,33% 25%,37% 12%); }
        .hatch { animation:hatchGlow 2.8s ease-in-out infinite; }
        .scene-shake { animation:shake .16s linear infinite; }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(43,93,112,.32),transparent_50%),linear-gradient(180deg,#07111e,#10212a_70%,#080e12)]" />
      <div className="stars absolute inset-0 opacity-70" />
      <header className="relative z-20 flex items-center justify-between border-b border-[#334a4c] bg-[#071017]/70 px-5 py-4 backdrop-blur-md md:px-10">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center border border-[#6f8a7d] bg-[#14252b] text-[#efb658]"><Radio size={18} /></div>
          <div><p className="text-[9px] uppercase tracking-[.32em] text-[#9bb6ac]">Colony Frontier Program</p><p className="mt-1 text-xs font-bold uppercase tracking-[.18em]">Flight operations / {pending?.campaign ?? "Moon"} campaign</p></div>
        </div>
        <button onClick={() => setSoundOn((v) => !v)} className="flex items-center gap-2 border border-[#33494c] px-3 py-2 text-[9px] uppercase tracking-[.14em] text-[#a8c0b4]" aria-pressed={soundOn}><Volume2 size={14} /> Audio {soundOn ? "enabled" : "muted"}</button>
      </header>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-73px)] max-w-[1500px] gap-5 p-4 md:grid-cols-[minmax(0,1fr)_330px] md:p-7">
        <section className={`relative min-h-[580px] overflow-hidden border border-[#334d51] bg-[#0b1922] ${isFlight ? "scene-shake" : ""}`}>
          <div className="absolute inset-0" style={{ perspective: "1100px" }}>
            <div className="absolute inset-0 bg-[linear-gradient(180deg,#06101c_0%,#142d3b_52%,#53635c_100%)]" />
            <div className="stars absolute inset-0 opacity-60" />
            <div className="absolute left-[8%] top-[14%] h-24 w-24 rounded-full border border-[#b9cbbd]/40 bg-[#d8d8bd]/10 shadow-[0_0_70px_rgba(204,218,194,.12)]" />
            <div className="absolute bottom-0 left-0 right-0 h-[29%] border-t border-[#9eb5a2]/25 bg-[linear-gradient(180deg,#5a6255,#202b28_55%,#0c1719)]" style={{ transform: "rotateX(5deg) scale(1.1)", transformOrigin: "bottom" }} />
            <div className="absolute bottom-[20%] left-0 right-0 h-px bg-[#b5c5aa]/25" />
            <div className="absolute bottom-[14%] left-[6%] h-12 w-[88%] opacity-40" style={{ background: "repeating-linear-gradient(90deg,transparent 0 45px,#d1d6bf 46px 47px,transparent 48px 90px)" }} />
            <div className="absolute bottom-[28%] left-[7%] right-[7%] h-[1px] bg-[#b9c9b2]/30" />

            {stage === "approach" && <div className="absolute bottom-[23%] left-[18%] z-10" style={{ animation: "walkIn 3s ease-out both" }}><div className="relative h-28 w-12"><div className="absolute left-3 top-0 h-7 w-7 rounded-full border border-[#b6c8c5] bg-[#8fa4a4]" /><div className="absolute left-2 top-7 h-14 w-9 skew-x-[-5deg] rounded-t-xl border border-[#90a8a7] bg-gradient-to-r from-[#364a52] via-[#c4cfca] to-[#53636a]" /><div className="absolute left-0 top-10 h-12 w-3 rotate-12 rounded bg-[#7c9394]" /><div className="absolute left-6 top-16 h-12 w-3 -rotate-6 rounded bg-[#819392]" /><div className="absolute left-2 top-[68px] h-3 w-4 rounded bg-[#c5d0c9]" /></div></div>}

            <div className={`absolute bottom-[16%] left-1/2 z-10 w-[min(43%,310px)] -translate-x-1/2 transition-all duration-[1800ms] ${stage === "boarding" || stage === "startup" ? "scale-[1.15]" : stage === "launch" ? "translate-y-[-180px] scale-[.88]" : stage === "landing" ? "translate-y-[-70px] scale-[.9]" : ""}`} style={{ filter: "drop-shadow(0 16px 25px #0009)" }}>
              <div className="relative mx-auto h-[360px] w-[190px]" style={{ transformStyle: "preserve-3d", transform: "rotateY(-9deg)" }}>
                <div className="rocket-shell absolute inset-x-[32px] top-0 h-[315px] border-x border-[#e2e8df] bg-gradient-to-r from-[#465a61] via-[#e0e4dc] to-[#66787c]" />
                <div className="absolute left-[73px] top-[49px] h-[60px] w-[44px] rounded-[48%] border-[5px] border-[#7d8e8d] bg-[radial-gradient(circle_at_35%_30%,#9fd4df,#183b4d_55%,#06131c)] shadow-[0_0_25px_#75c4d933]" />
                <div className="absolute left-[64px] top-[131px] h-[3px] w-[62px] bg-[#647b7a]" />
                <div className="absolute left-[64px] top-[143px] h-[3px] w-[62px] bg-[#647b7a]" />
                <div className="absolute left-[64px] top-[155px] h-[3px] w-[62px] bg-[#647b7a]" />
                <div className="absolute left-[74px] top-[180px] h-[55px] w-[42px] border border-[#647b7a] bg-[#22363c]" />
                <div className="absolute bottom-[38px] left-[63px] h-[65px] w-[64px] bg-gradient-to-b from-[#596d71] to-[#111e24]" />
                <div className="absolute bottom-[7px] left-[72px] h-[38px] w-[46px] rounded-b-xl border border-[#8c9d96] bg-[#17262b]" />
                {(stage === "launch" || stage === "landing") && <div className="absolute bottom-[-90px] left-[78px] h-[115px] w-[34px] origin-top bg-gradient-to-b from-[#f9f0bb] via-[#f49b43] to-transparent" style={{ animation: "engineFlicker .18s ease-in-out infinite" }} />}
                {(stage === "boarding" || stage === "startup") && <div className="hatch absolute left-[126px] top-[155px] h-[88px] w-[30px] rounded-r-xl border border-[#efb658] bg-[#15242b]" />}
              </div>
            </div>

            {stage === "startup" && <div className="absolute inset-0 z-20 bg-[#071017]/55"><div className="absolute left-1/2 top-1/2 w-[min(90%,440px)] -translate-x-1/2 -translate-y-1/2 border border-[#587a74] bg-[#08151d]/95 p-5 shadow-[0_0_70px_#0009]"><p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-[#efb658]"><Power size={14} /> Flight computer startup</p><div className="space-y-1 font-mono text-[10px] leading-5 text-[#9bd3b1]">{bootLines.slice(-7).map((line) => <p key={line}><span className="text-[#efb658]">&gt;</span> {line}</p>)}</div><div className="mt-4 h-1.5 overflow-hidden bg-[#1e3439]"><div className="h-full bg-[#7bc69b] transition-all duration-500" style={{ width: `${Math.min(100, bootLines.length / 8 * 100)}%` }} /></div></div></div>}
            {stage === "launch" && <div className="absolute inset-0 z-10 bg-[linear-gradient(180deg,transparent_20%,rgba(243,151,61,.16),rgba(245,196,114,.22))]" />}
            {stage === "landing" && <><div className="absolute inset-x-0 bottom-[12%] z-10 h-32 rounded-[50%] bg-[#b3b8a0]/25 blur-2xl" style={{ animation: "dustRoll 2s ease-in-out infinite alternate" }} /><div className="absolute inset-0 bg-[#b9b8a1]/10" /></>}
            {isLanded && <div className="absolute bottom-[23%] right-[9%] z-10 w-[31%] min-w-[145px]"><div className="relative h-28 border border-[#b9cbb4] bg-gradient-to-b from-[#8b9e96] to-[#344a49] shadow-[0_0_35px_#c8d8c833]"><div className="absolute inset-x-4 top-3 h-12 border border-[#d1d7c6] bg-[linear-gradient(135deg,#1b4855,#87b9bd_50%,#203c4c)]" /><div className="absolute bottom-0 left-1/2 h-12 w-10 -translate-x-1/2 border-x border-t border-[#aabeb0] bg-[#182a30]" /><div className="absolute -top-3 left-1/2 h-3 w-20 -translate-x-1/2 bg-[#82938b]" /></div><p className="mt-2 text-center text-[8px] uppercase tracking-[.18em] text-[#c6d5c4]">Habitat / Alpha base</p></div>}
            {stage === "outside" && <div className="absolute inset-0 z-30 bg-[#071017]/30"><div className="absolute bottom-0 left-0 right-0 h-[36%] bg-[linear-gradient(180deg,#b0b19a,#4d5a4c)]" /></div>}
            <div className="absolute left-4 top-4 z-20 border border-[#58706d] bg-[#071017]/75 px-3 py-2 backdrop-blur"><p className="text-[8px] uppercase tracking-[.2em] text-[#a5bdb2]">Visual flight deck</p><p className="mt-1 font-mono text-[10px] text-[#d9e8d5]">CAM {String(Math.max(1, stageIndex + 1)).padStart(2, "0")} · {stage === "landed" || stage === "outside" ? "SURFACE" : isFlight ? "FLIGHT" : "EXTERNAL"}</p></div>
            {isLanded && <div className="absolute left-4 bottom-4 z-20 border border-[#719780] bg-[#071710]/80 px-3 py-2 text-[9px] uppercase tracking-[.15em] text-[#a6e0b4]"><CheckCircle2 className="mr-2 inline h-3 w-3" />Touchdown confirmed</div>}
          </div>
        </section>

        <aside className="flex flex-col border border-[#33494b] bg-[#0a161e]/95 p-5 backdrop-blur">
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.22em] text-[#efb658]"><ShieldCheck size={14} /> Mission sequence</div>
          <h1 className="mt-5 text-2xl font-semibold uppercase leading-tight tracking-[.07em]">{copy.title}</h1>
          <p className="mt-3 text-xs leading-6 text-[#9bb4ac]">{copy.detail}</p>
          <div className="mt-6 space-y-3">{timeline.map((item, index) => <div key={item} className="flex items-center gap-3 text-[9px] uppercase tracking-[.13em]"><span className={`grid h-6 w-6 place-items-center border ${index < stageIndex || (stage === "outside") ? "border-[#78c49a] bg-[#16362b] text-[#a7e6bb]" : index === stageIndex ? "border-[#efb658] bg-[#3b3020] text-[#efb658]" : "border-[#2d4347] text-[#5c7775]"}`}>{index < stageIndex ? "✓" : String(index + 1).padStart(2, "0")}</span><span className={index === stageIndex ? "text-[#f0d9a6]" : index < stageIndex ? "text-[#9bc7a8]" : "text-[#637d7a]"}>{stageCopy[item].title}</span></div>)}</div>
          <div className="mt-7 border-t border-[#2c4246] pt-4"><div className="flex items-center justify-between text-[9px] uppercase tracking-[.16em] text-[#7f9a96]"><span>Flight telemetry</span><span className="text-[#8ed2a6]">{isLanded ? "STABLE" : stage === "launch" ? "THRUST" : "NOMINAL"}</span></div><div className="mt-3 grid grid-cols-2 gap-2">{[{label:"CABIN",value:stage === "startup" ? "101.3 kPa" : "SEALED"},{label:"LIFE SUPPORT",value:"ONLINE"},{label:"GUIDANCE",value:stage === "launch" ? "ASCENT" : isLanded ? "LANDED" : "TRACK"},{label:"MISSION",value:pending?.missionTitle ?? "MISSION 01"}].map((item) => <div key={item.label} className="border border-[#2b4145] bg-[#0d2026] p-2"><p className="text-[7px] uppercase tracking-[.13em] text-[#718e88]">{item.label}</p><p className="mt-1 truncate font-mono text-[9px] text-[#d4e2d4]">{item.value}</p></div>)}</div></div>
          <div className="mt-auto pt-6">
            {stage === "landed" || stage === "outside" ? <button onClick={() => { setStage("outside"); window.setTimeout(() => { window.location.href = "/preview/MissionSimulation"; }, 1100); }} className="flex w-full items-center justify-center gap-2 bg-[#efb658] px-4 py-4 text-[10px] font-black uppercase tracking-[.18em] text-[#172126] transition hover:bg-[#f6ca76]"><ArrowRight size={15} /> Go Outside <ArrowRight size={14} /></button> : <button onClick={skipAhead} className="flex w-full items-center justify-center gap-2 border border-[#4c6665] px-4 py-3 text-[9px] font-bold uppercase tracking-[.15em] text-[#a9c4b8] transition hover:border-[#efb658] hover:text-[#efb658]"><ArrowRight size={14} /> {manual ? "Continue sequence" : "Skip to next sequence"}</button>}
            <p className="mt-3 text-center text-[8px] leading-4 text-[#647f7c]">Cinematic sequence · no external assets required · mission data stays in your local save.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default FlightSequence;
