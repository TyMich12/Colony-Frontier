import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleDot,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import {
  GameShell,
  LinkArrow,
  ProgressBar,
  SectionLabel,
} from "./_shared/GameShell";

type MissionStatus = "complete" | "current" | "available" | "locked";

type Mission = {
  number: string;
  title: string;
  subtitle: string;
  status: MissionStatus;
  x: string;
  y: string;
  prerequisite?: string;
  objective: string;
  duration: string;
  reward: string;
  xp: string;
  token: string;
  technology: string;
  difficulty: number;
};

const missions: Mission[] = [
  { number: "01", title: "First Light", subtitle: "First Light", status: "current", x: "6%", y: "49%", duration: "14 Earth days", objective: "Stabilize the landing site and bring every Foundation system online.", reward: "$10M", xp: "500", token: "+1", technology: "Improved Energy Storage", difficulty: 1 },
  { number: "02", title: "Blackout", subtitle: "Hold the heat", status: "locked", x: "17%", y: "27%", prerequisite: "Complete Survival", duration: "21 Earth days", objective: "Maintain heat and power through the first lunar night.", reward: "$12M", xp: "750", token: "+1", technology: "Thermal Storage Technology", difficulty: 2 },
  { number: "03", title: "Echoes Below", subtitle: "Ice below", status: "locked", x: "31%", y: "55%", prerequisite: "Complete The Long Night", duration: "30 Earth days", objective: "Locate and extract subsurface ice before the thermal window closes.", reward: "$14M", xp: "1,000", token: "+1", technology: "Water / Ice Extraction", difficulty: 2 },
  { number: "04", title: "Signal Drift", subtitle: "Keep the grid alive", status: "locked", x: "45%", y: "23%", prerequisite: "Complete The Shadow", duration: "35 Earth days", objective: "Restore power distribution during a high-dust equipment failure.", reward: "$16M", xp: "1,250", token: "+1", technology: "Autonomous Maintenance Rover", difficulty: 3 },
  { number: "05", title: "Sudden Pressure", subtitle: "Patch the breach", status: "locked", x: "59%", y: "52%", prerequisite: "Complete Contamination", duration: "45 Earth days", objective: "Repair a damaged habitat shell before pressure loss becomes critical.", reward: "$18M", xp: "1,500", token: "+1", technology: "Improved Habitat Structure", difficulty: 3 },
  { number: "06", title: "Solar Veil", subtitle: "Under the storm", status: "locked", x: "70%", y: "28%", prerequisite: "Complete Impact", duration: "60 Earth days", objective: "Protect crew and systems through a major radiation event.", reward: "$20M", xp: "1,750", token: "+2", technology: "Regolith Shielding", difficulty: 4 },
  { number: "07", title: "Hidden Yield", subtitle: "Make more from less", status: "locked", x: "82%", y: "52%", prerequisite: "Complete Stormfall", duration: "90 Earth days", objective: "Keep the colony supplied while external deliveries are delayed.", reward: "$23M", xp: "2,000", token: "+2", technology: "Local Resource Processing", difficulty: 4 },
  { number: "08", title: "Chain Reaction", subtitle: "A foothold becomes home", status: "locked", x: "93%", y: "25%", prerequisite: "Complete The Inheritance", duration: "120 Earth days", objective: "Prevent a systems cascade and prove the Moon can sustain a colony.", reward: "$27M", xp: "2,500", token: "+3", technology: "Advanced Colony Management", difficulty: 5 },
];

const statusCopy: Record<MissionStatus, string> = {
  complete: "COMPLETE",
  current: "IN PROGRESS",
  available: "AVAILABLE",
  locked: "LOCKED",
};

export function CampaignMap() {
  const [selected, setSelected] = useState("01");
  const activeMission = missions.find((mission) => mission.number === selected) ?? missions[0];

  return (
    <GameShell active="campaign" eyebrow="Campaign // Lunar Operations" title="Moon Campaign">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
        <section className="min-w-0">
          <div className="mb-5 flex items-center justify-between border-y border-[#29434a] py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#789293]">Operation status</p>
              <p className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-[#dce9dc]">Mission 01 / 08 · starting route</p>
            </div>
            <div className="w-36">
              <div className="mb-2 flex justify-between text-[9px] uppercase tracking-[0.2em] text-[#799394]">
                <span>Moon progress</span><span className="text-[#efb658]">0%</span>
              </div>
              <ProgressBar value={0} />
            </div>
          </div>

          <div className="relative min-h-[400px] overflow-hidden border border-[#29474e] bg-[#09151d] px-5 py-8 sm:px-8">
            <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_17%_56%,rgba(234,180,85,0.16),transparent_2px),radial-gradient(circle_at_72%_16%,rgba(111,190,183,0.18),transparent_1px),radial-gradient(circle_at_88%_68%,rgba(111,190,183,0.14),transparent_1px)] [background-size:160px_140px,220px_180px,190px_160px]" />
            <div className="mb-7 flex items-center justify-between">
              <div>
                <SectionLabel>Lunar route // Mare Tranquillitatis</SectionLabel>
                <p className="text-xs text-[#789091]">Every step changes what comes next.</p>
              </div>
              <Moon className="h-7 w-7 text-[#d7e7c0]" strokeWidth={1.1} />
            </div>

            <div className="relative h-[255px]">
              <svg className="absolute inset-x-2 top-8 h-[170px] w-[calc(100%-16px)] overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 40" aria-hidden="true">
                <path d="M 2 28 C 8 8, 11 8, 18 15 S 26 33, 32 25 S 40 8, 46 12 S 55 31, 60 24 S 68 8, 72 13 S 80 31, 86 24 S 94 9, 99 10" fill="none" stroke="#31545a" strokeDasharray="1.4 1.4" strokeWidth="0.5" />
                <path d="M 2 28 C 8 8, 11 8, 18 15 S 26 33, 32 25" fill="none" stroke="#efb658" strokeWidth="0.8" />
              </svg>

              {missions.map((mission) => {
                const isSelected = mission.number === selected;
                const isLocked = mission.status === "locked";
                return (
                  <button
                    key={mission.number}
                    onClick={() => setSelected(mission.number)}
                    className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center transition duration-200 hover:scale-105 focus:outline-none focus:ring-1 focus:ring-[#efb658] ${isSelected ? "scale-110" : ""}`}
                    style={{ left: mission.x, top: mission.y }}
                    aria-label={`Select mission ${mission.number}, ${mission.title}`}
                  >
                    <span className={`grid h-11 w-11 place-items-center border ${isSelected ? "border-[#f5c56b] bg-[#efb658] text-[#17201b] shadow-[0_0_0_6px_rgba(239,182,88,0.12),0_0_28px_rgba(239,182,88,0.3)]" : mission.status === "complete" ? "border-[#82bca1] bg-[#173a37] text-[#aee0b5]" : isLocked ? "border-[#324b50] bg-[#102128] text-[#5e7778]" : "border-[#a5bf92] bg-[#1a302d] text-[#dce9c5]"}`}>
                      {mission.status === "complete" ? <Check className="h-4 w-4" /> : isLocked ? <LockKeyhole className="h-4 w-4" /> : <span className="text-xs font-bold">{mission.number}</span>}
                    </span>
                    <span className={`whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.17em] ${isSelected ? "text-[#f4c46d]" : isLocked ? "text-[#60787b]" : "text-[#c5d8c0]"}`}>
                      {mission.title}
                    </span>
                    <span className="whitespace-nowrap text-[8px] uppercase tracking-[0.12em] text-[#657f80]">{statusCopy[mission.status]}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-5 border-t border-[#233d43] pt-4 text-[9px] uppercase tracking-[0.16em] text-[#719091]">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#82bca1]" /> Secured</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#efb658]" /> Active route</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#405d60]" /> Unavailable</span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 border border-[#765d2f] bg-[#211f17] px-5 py-4">
            <Trophy className="h-5 w-5 shrink-0 text-[#efb658]" />
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#efb658]">Moon complete</p>
              <p className="mt-1 text-xs text-[#9a9f87]">Secure all eight lunar missions to establish a permanent foothold.</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-[#806b3f] sm:block" />
          </div>
        </section>

        <aside className="border border-[#2b484d] bg-[#0b1a21]">
          <div className="border-b border-[#2b484d] px-6 py-5">
            <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[#efb658]"><CircleDot className="h-3 w-3" /> Mission brief</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#718c8d]">Mission {activeMission.number} / 08</p>
            <h2 className="mt-2 text-2xl font-semibold uppercase tracking-[0.13em] text-[#eef3e7]">{activeMission.title}</h2>
            <p className="mt-1 text-xs uppercase tracking-[0.21em] text-[#88a39d]">{activeMission.subtitle}</p>
          </div>
          <div className="space-y-6 px-6 py-6">
            {activeMission.status === "locked" ? (
              <div className="border border-[#304a4e] bg-[#101f26] p-4">
                <LockKeyhole className="mb-4 h-5 w-5 text-[#6a8585]" />
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#92a99e]">Mission locked</p>
                <p className="mt-2 text-sm leading-6 text-[#788f90]">Prerequisite required: <span className="text-[#d0dec4]">{activeMission.prerequisite}</span>.</p>
              </div>
            ) : (
              <>
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.26em] text-[#769092]">Objective</p>
                   <p className="text-sm leading-6 text-[#dbe7da]">{activeMission.objective}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-[#29434a] bg-[#0f2429] p-3">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-[#71898b]">Difficulty</p>
                    <p className="mt-2 text-sm font-semibold text-[#efb658]">
                      <span className="text-[#efb658]">{"★".repeat(activeMission.difficulty)}</span>
                      <span className="text-[#405d60]">{"★".repeat(5 - activeMission.difficulty)}</span>
                    </p>
                  </div>
                  <div className="border border-[#29434a] bg-[#0f2429] p-3"><p className="text-[9px] uppercase tracking-[0.18em] text-[#71898b]">Duration</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#d9e5d3]"><Zap className="h-4 w-4 text-[#efb658]" /> {activeMission.duration}</p></div>
                </div>
                <div>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.26em] text-[#769092]">Mission reward</p>
                  <div className="grid grid-cols-3 gap-2">
                     <div className="border-l-2 border-[#efb658] pl-3"><p className="text-lg font-semibold text-[#f0bf67]">{activeMission.reward}</p><p className="text-[8px] uppercase tracking-[0.14em] text-[#71898b]">Funding</p></div>
                     <div className="border-l-2 border-[#76bba6] pl-3"><p className="text-lg font-semibold text-[#b3d7bd]">{activeMission.xp}</p><p className="text-[8px] uppercase tracking-[0.14em] text-[#71898b]">XP</p></div>
                     <div className="border-l-2 border-[#9caf84] pl-3"><p className="text-lg font-semibold text-[#cbd9b2]">{activeMission.token}</p><p className="text-[8px] uppercase tracking-[0.14em] text-[#71898b]">Research</p></div>
                  </div>
                </div>
                <div className="flex items-center gap-3 border-t border-[#29434a] pt-5">
                  <ShieldCheck className="h-5 w-5 text-[#8fc8c4]" />
                   <div><p className="text-[9px] uppercase tracking-[0.18em] text-[#71898b]">Technology unlocked</p><p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#d5e4ce]">{activeMission.technology}</p></div>
                </div>
                {activeMission.status === "current" && <a href="/__mockup/preview/colony-frontier/MissionLoadout" className="flex w-full items-center justify-between bg-[#efb658] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.21em] text-[#1a211d] transition hover:bg-[#f6cb7b]">Prepare mission <ArrowRight className="h-4 w-4" /></a>}
                {activeMission.status === "complete" && <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#89c9a8]"><ShieldCheck className="h-4 w-4" /> Mission secured</div>}
              </>
            )}
          </div>
        </aside>
      </div>
      <div className="mt-5 flex items-center justify-between border border-[#315158] bg-[#0d2428] px-5 py-4">
        <div className="flex items-center gap-3"><Sparkles className="h-4 w-4 text-[#efb658]" /><span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#a8c4ad]">End reward</span><span className="text-sm font-semibold uppercase tracking-[0.14em] text-[#edf2e6]">Mars Unlocked</span></div>
        <LinkArrow />
      </div>
    </GameShell>
  );
}

export default CampaignMap;
