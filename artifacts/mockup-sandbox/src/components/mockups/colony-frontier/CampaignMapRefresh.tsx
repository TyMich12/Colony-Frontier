import { useState } from "react";
import {
  Check,
  CircleDot,
  FlaskConical,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Target,
  Trophy,
} from "lucide-react";
import {
  GameShell,
  LinkArrow,
  ProgressBar,
  SectionLabel,
} from "./_shared/GameShell";
import { loadGameState } from "./gameState";

type MissionStatus = "current" | "locked";
type CampaignId = "moon" | "mars";

type Mission = {
  number: string;
  title: string;
  status: MissionStatus;
  duration: string;
  credits: string;
  xp: string;
  research: string;
  difficulty: number;
  objective: string;
  opportunity: string;
  technology: string;
  prerequisite?: string;
};

const moonMissions: Mission[] = [
  {
    number: "01",
    title: "First Light",
    status: "current",
    duration: "14 Earth days",
    credits: "$10M",
    xp: "500",
    research: "+1",
    difficulty: 1,
    objective: "Establish the first lunar outpost and survive 14 Earth days.",
    opportunity: "Lunar Environmental Study",
    technology: "Improved Energy Storage",
  },
  {
    number: "02",
    title: "Blackout",
    status: "locked",
    duration: "21 Earth days",
    credits: "$12M",
    xp: "750",
    research: "+1",
    difficulty: 2,
    objective: "Survive a prolonged period of extremely limited sunlight.",
    opportunity: "Thermal Environment Survey",
    technology: "Thermal Storage Technology",
    prerequisite: "Complete Survival",
  },
  {
    number: "03",
    title: "Echoes Below",
    status: "locked",
    duration: "30 Earth days",
    credits: "$14M",
    xp: "1,000",
    research: "+1",
    difficulty: 2,
    objective: "Explore a permanently shadowed region and retrieve a useful resource.",
    opportunity: "Subsurface Ice Characterisation",
    technology: "Water / Ice Extraction",
    prerequisite: "Complete The Long Night",
  },
  {
    number: "04",
    title: "Signal Drift",
    status: "locked",
    duration: "35 Earth days",
    credits: "$16M",
    xp: "1,250",
    research: "+1",
    difficulty: 3,
    objective: "Maintain a stable settlement while an unseen systems fault develops.",
    opportunity: "Dust Behaviour Study",
    technology: "Autonomous Maintenance Rover",
    prerequisite: "Complete The Shadow",
  },
  {
    number: "05",
    title: "Sudden Pressure",
    status: "locked",
    duration: "45 Earth days",
    credits: "$18M",
    xp: "1,500",
    research: "+1",
    difficulty: 3,
    objective: "Detect, isolate, and repair an unexpected structural anomaly.",
    opportunity: "Structural Impact Analysis",
    technology: "Improved Habitat Structure",
    prerequisite: "Complete Contamination",
  },
  {
    number: "06",
    title: "Solar Veil",
    status: "locked",
    duration: "60 Earth days",
    credits: "$20M",
    xp: "1,750",
    research: "+2",
    difficulty: 4,
    objective: "Keep crew and critical systems within safe operating limits.",
    opportunity: "Radiation Mapping",
    technology: "Regolith Shielding",
    prerequisite: "Complete Impact",
  },
  {
    number: "07",
    title: "Hidden Yield",
    status: "locked",
    duration: "90 Earth days",
    credits: "$23M",
    xp: "2,000",
    research: "+3",
    difficulty: 4,
    objective: "Turn local material and limited reserves into a growing colony.",
    opportunity: "Local Resource Discovery",
    technology: "Local Resource Processing",
    prerequisite: "Complete Stormfall",
  },
  {
    number: "08",
    title: "Chain Reaction",
    status: "locked",
    duration: "120 Earth days",
    credits: "$27M",
    xp: "2,500",
    research: "+3",
    difficulty: 5,
    objective: "Prevent a chain reaction from reaching any critical colony system.",
    opportunity: "Cascade Prevention Study",
    technology: "Advanced Colony Management",
    prerequisite: "Complete The Inheritance",
  },
];

const marsMissions: Mission[] = [
  {
    number: "01",
    title: "Red Horizon",
    status: "locked",
    duration: "30 Earth days",
    credits: "$20M",
    xp: "1,000",
    research: "+1",
    difficulty: 2,
    objective: "Land on Mars and survive 30 Earth days.",
    opportunity: "Martian Landing Site Survey",
    technology: "Improved Power Management",
    prerequisite: "Complete the Moon Campaign",
  },
  {
    number: "02",
    title: "Veilfall",
    status: "locked",
    duration: "45 Earth days",
    credits: "$22M",
    xp: "1,250",
    research: "+1",
    difficulty: 3,
    objective: "Manage falling solar output caused by atmospheric dust.",
    opportunity: "Dust Composition Analysis",
    technology: "Dust-Resistant Solar",
    prerequisite: "Complete Arrival",
  },
  {
    number: "03",
    title: "Deep Signal",
    status: "locked",
    duration: "60 Earth days",
    credits: "$25M",
    xp: "1,500",
    research: "+1",
    difficulty: 3,
    objective: "Find accessible subsurface ice and return a verified sample.",
    opportunity: "Ice Deposit Characterisation",
    technology: "Ice Extraction",
    prerequisite: "Complete The Dust",
  },
  {
    number: "04",
    title: "Cold Front",
    status: "locked",
    duration: "90 Earth days",
    credits: "$28M",
    xp: "1,750",
    research: "+1",
    difficulty: 4,
    objective: "Survive extreme cold threatening habitat, batteries, and machinery.",
    opportunity: "Subsurface Thermal Study",
    technology: "Advanced Thermal Regulation",
    prerequisite: "Complete The Water Search",
  },
  {
    number: "05",
    title: "Waypoint",
    status: "locked",
    duration: "120 Earth days",
    credits: "$31M",
    xp: "2,000",
    research: "+1",
    difficulty: 4,
    objective: "Operate multiple rovers with charging, routing, and recovery.",
    opportunity: "Autonomous Navigation Trial",
    technology: "Autonomous Rover Technology",
    prerequisite: "Complete Martian Winter",
  },
  {
    number: "06",
    title: "Redout",
    status: "locked",
    duration: "150 Earth days",
    credits: "$34M",
    xp: "2,250",
    research: "+2",
    difficulty: 5,
    objective: "Prepare the colony for a major approaching storm.",
    opportunity: "Storm Prediction Model",
    technology: "Storm Prediction System",
    prerequisite: "Complete The Rover Network",
  },
  {
    number: "07",
    title: "Green Thread",
    status: "locked",
    duration: "180 Earth days",
    credits: "$37M",
    xp: "2,500",
    research: "+2",
    difficulty: 5,
    objective: "Make agriculture a major part of the colony.",
    opportunity: "Closed-Loop Agriculture Experiment",
    technology: "Closed-Loop Agriculture",
    prerequisite: "Complete Dust Storm",
  },
  {
    number: "08",
    title: "Pressure Point",
    status: "locked",
    duration: "210 Earth days",
    credits: "$40M",
    xp: "2,750",
    research: "+2",
    difficulty: 6,
    objective: "Detect, isolate, and repair a structural failure.",
    opportunity: "Habitat Failure Analysis",
    technology: "Modular Habitat System",
    prerequisite: "Complete The Greenhouse",
  },
  {
    number: "09",
    title: "Native Forge",
    status: "locked",
    duration: "240 Earth days",
    credits: "$43M",
    xp: "3,000",
    research: "+2",
    difficulty: 6,
    objective: "Turn Mars itself into your supply chain.",
    opportunity: "New Resource Discovery",
    technology: "Advanced ISRU",
    prerequisite: "Complete Habitat Breach",
  },
  {
    number: "10",
    title: "Isolation",
    status: "locked",
    duration: "270 Earth days",
    credits: "$46M",
    xp: "3,250",
    research: "+2",
    difficulty: 7,
    objective: "Manage the colony without normal resupply from Earth.",
    opportunity: "Advanced Waste Recovery",
    technology: "Advanced Recycling",
    prerequisite: "Complete ISRU",
  },
  {
    number: "11",
    title: "Veil of Red",
    status: "locked",
    duration: "300 Earth days",
    credits: "$50M",
    xp: "3,500",
    research: "+4",
    difficulty: 7,
    objective: "Survive the major Mars cascade across all colony systems.",
    opportunity: "Cascade Prediction",
    technology: "Planetary Resilience",
    prerequisite: "Complete The Supply Gap",
  },
  {
    number: "12",
    title: "Second Horizon",
    status: "locked",
    duration: "330 Earth days",
    credits: "$55M",
    xp: "3,750",
    research: "+3",
    difficulty: 8,
    objective: "Build a second settlement and share resources between them.",
    opportunity: "Inter-Settlement Optimisation",
    technology: "Colony Grid Architecture",
    prerequisite: "Complete The Great Dust Storm",
  },
  {
    number: "13",
    title: "No Lifeline",
    status: "locked",
    duration: "1 Earth year",
    credits: "$60M",
    xp: "4,000",
    research: "+3",
    difficulty: 8,
    objective: "Achieve autonomy with no meaningful emergency support from Earth.",
    opportunity: "Local Manufacturing Breakthrough",
    technology: "Self-Sufficient Colony Technology",
    prerequisite: "Complete The Expansion",
  },
  {
    number: "14",
    title: "Critical Mass",
    status: "locked",
    duration: "1 Earth year",
    credits: "$65M",
    xp: "4,500",
    research: "+4",
    difficulty: 9,
    objective: "Triage multiple simultaneous system failures. Not everything can be saved.",
    opportunity: "Autonomous Colony Management",
    technology: "Advanced Colony Management",
    prerequisite: "Complete The Independent Colony",
  },
  {
    number: "15",
    title: "New Dawn",
    status: "locked",
    duration: "1 Martian year (~687 Earth days)",
    credits: "$75M",
    xp: "5,000",
    research: "+5",
    difficulty: 10,
    objective: "Survive one complete Martian year with zero external resupply.",
    opportunity: "Mars Biosphere — Final Research Opportunity",
    technology: "Closed-Loop Colony Core",
    prerequisite: "Complete Cascade",
  },
];

const campaignMeta: Record<
  CampaignId,
  { label: string; eyebrow: string; title: string; total: string; maxDifficulty: number }
> = {
  moon: {
    label: "Moon",
    eyebrow: "Campaign // Lunar Operations",
    title: "Moon Campaign",
    total: "08",
    maxDifficulty: 5,
  },
  mars: {
    label: "Mars",
    eyebrow: "Campaign // Martian Operations",
    title: "Mars Campaign",
    total: "15",
    maxDifficulty: 10,
  },
};

function difficultyStars(difficulty: number, max: number) {
  const filled = Math.min(difficulty, max);
  const empty = Math.max(0, max - filled);
  return (
    <>
      <span className="text-[#efb658]">{"★".repeat(filled)}</span>
      <span className="text-[#405d60]">{"★".repeat(empty)}</span>
    </>
  );
}

export function CampaignMapRefresh() {
  const [campaign, setCampaign] = useState<CampaignId>("moon");
  const [selected, setSelected] = useState("01");
  const gameState = loadGameState();
  const completed = new Set(gameState.completedMissions);
  const moonComplete = moonMissions.every((mission) => completed.has(`moon-${mission.number}`));
  const missions = campaign === "moon" ? moonMissions : marsMissions;
  const meta = campaignMeta[campaign];
  const activeMission =
    missions.find((mission) => mission.number === selected) ?? missions[0];

  function missionKey(number: string) {
    return `${campaign}-${number}`;
  }

  function getMissionStatus(number: string): "current" | "locked" | "complete" {
    if (completed.has(missionKey(number))) return "complete";
    const index = missions.findIndex((mission) => mission.number === number);
    if (campaign === "mars" && !moonComplete) return "locked";
    const previousComplete = missions
      .slice(0, index)
      .every((mission) => completed.has(missionKey(mission.number)));
    return previousComplete ? "current" : "locked";
  }

  const activeStatus = getMissionStatus(activeMission.number);

  function switchCampaign(id: CampaignId) {
    setCampaign(id);
    setSelected("01");
  }

  return (
    <GameShell
      active="campaign"
      eyebrow={meta.eyebrow}
      title={meta.title}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border border-[#47553d] bg-[#172a2a] px-5 py-4">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-4 w-4 text-[#efb658]" />
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#dce9cd]">
            Research opportunities are optional
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => switchCampaign("moon")}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
              campaign === "moon"
                ? "bg-[#efb658] text-[#17201b]"
                : "border border-[#34545a] text-[#8aaba8] hover:text-[#d5e5ce]"
            }`}
          >
            Moon
          </button>
          <button
            type="button"
            onClick={() => switchCampaign("mars")}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
              campaign === "mars"
                ? "bg-[#efb658] text-[#17201b]"
                : "border border-[#34545a] text-[#8aaba8] hover:text-[#d5e5ce]"
            }`}
          >
            Mars
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_370px]">
        <section className="min-w-0">
          <div className="mb-5 flex items-center justify-between border-y border-[#29434a] py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#789293]">
                Operation status
              </p>
              <p className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-[#dce9dc]">
                Mission 01 / {meta.total} · starting route
              </p>
            </div>
            <div className="w-36">
              <div className="mb-2 flex justify-between text-[9px] uppercase tracking-[0.2em] text-[#799394]">
                <span>{meta.label} progress</span>
                <span className="text-[#efb658]">0%</span>
              </div>
              <ProgressBar value={0} />
            </div>
          </div>

          <div className="relative overflow-hidden border border-[#29474e] bg-[#09151d] px-5 py-8 sm:px-8">
            <div className="mb-7 flex items-center justify-between">
              <div>
                <SectionLabel>
                  {campaign === "moon"
                    ? "Lunar route // Mare Tranquillitatis"
                    : "Martian route // Utopia Planitia"}
                </SectionLabel>
                <p className="text-xs text-[#789091]">
                  Titles reveal intent only after the mission is earned.
                </p>
              </div>
              {campaign === "moon" ? (
                <Moon className="h-7 w-7 text-[#d7e7c0]" strokeWidth={1.1} />
              ) : (
                <Target className="h-7 w-7 text-[#d77a5a]" strokeWidth={1.1} />
              )}
            </div>

            <div className="relative min-h-[420px]">
              <svg
                className="absolute inset-x-2 top-8 h-[220px] w-[calc(100%-16px)] overflow-visible"
                preserveAspectRatio="none"
                viewBox="0 0 100 40"
                aria-hidden="true"
              >
                <path
                  d="M 2 28 C 8 8, 11 8, 18 15 S 26 33, 32 25 S 40 8, 46 12 S 55 31, 60 24 S 68 8, 72 13 S 80 31, 86 24 S 94 9, 99 10"
                  fill="none"
                  stroke="#31545a"
                  strokeDasharray="1.4 1.4"
                  strokeWidth="0.5"
                />
                <path
                  d="M 2 28 C 8 8, 11 8, 18 15 S 26 33, 32 25"
                  fill="none"
                  stroke="#efb658"
                  strokeWidth="0.8"
                />
              </svg>
              {missions.map((mission) => {
                const isSelected = mission.number === selected;
                const count = missions.length;
                const leftPct = 6 + ((Number(mission.number) - 1) / (count - 1)) * 88;
                return (
                  <button
                    key={mission.number}
                    type="button"
                    onClick={() => setSelected(mission.number)}
                    className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center transition hover:scale-105 focus:outline-none focus:ring-1 focus:ring-[#efb658] ${
                      isSelected ? "scale-110" : ""
                    }`}
                    style={{
                      left: `${leftPct}%`,
                      top: Number(mission.number) % 2 ? "52%" : "30%",
                    }}
                    aria-label={`Select mission ${mission.number}, ${mission.title}`}
                  >
                    <span
                      className={`grid h-11 w-11 place-items-center border ${
                        isSelected
                          ? "border-[#f5c56b] bg-[#efb658] text-[#17201b] shadow-[0_0_0_6px_rgba(239,182,88,0.12)]"
                          : "border-[#324b50] bg-[#102128] text-[#5e7778]"
                      }`}
                    >
                      {getMissionStatus(mission.number) === "complete" ? (
                        <Check className="h-4 w-4" />
                      ) : getMissionStatus(mission.number) === "current" ? (
                        <span className="text-xs font-bold">{mission.number}</span>
                      ) : (
                        <LockKeyhole className="h-4 w-4" />
                      )}
                    </span>
                    <span
                      className={`whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.13em] ${
                        isSelected ? "text-[#f4c46d]" : "text-[#60787b]"
                      }`}
                    >
                      {mission.title}
                    </span>
                    <span className="whitespace-nowrap text-[8px] uppercase tracking-[0.12em] text-[#657f80]">
                      {getMissionStatus(mission.number) === "complete" ? "COMPLETE" : getMissionStatus(mission.number) === "current" ? "IN PROGRESS" : "LOCKED"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-5 border-t border-[#233d43] pt-4 text-[9px] uppercase tracking-[0.16em] text-[#719091]">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#efb658]" /> Active
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#405d60]" /> Unavailable
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 border border-[#765d2f] bg-[#211f17] px-5 py-4">
            <Trophy className="h-5 w-5 shrink-0 text-[#efb658]" />
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#efb658]">
                {campaign === "moon" ? "Moon complete" : "Mars complete"}
              </p>
              <p className="mt-1 text-xs text-[#9a9f87]">
                {campaign === "moon"
                  ? "Complete all eight lunar missions to authorize Mars."
                  : "Complete all fifteen Martian missions to achieve planetary independence."}
              </p>
            </div>
            {campaign === "moon" && <LinkArrow />}
          </div>
        </section>

        <aside className="border border-[#2b484d] bg-[#0b1a21]">
          <div className="border-b border-[#2b484d] px-6 py-5">
            <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[#efb658]">
              <CircleDot className="h-3 w-3" /> Mission brief
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#718c8d]">
              Mission {activeMission.number} / {meta.total}
            </p>
            <h2 className="mt-2 text-2xl font-semibold uppercase tracking-[0.13em] text-[#eef3e7]">
              {activeMission.title}
            </h2>
          </div>
          <div className="space-y-6 px-6 py-6">
            {activeStatus === "locked" ? (
              <div className="border border-[#304a4e] bg-[#101f26] p-4">
                <LockKeyhole className="mb-4 h-5 w-5 text-[#6a8585]" />
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#92a99e]">
                  Mission locked
                </p>
                <p className="mt-2 text-sm leading-6 text-[#788f90]">
                  Prerequisite required:{" "}
                  <span className="text-[#d0dec4]">
                    {activeMission.prerequisite}
                  </span>
                </p>
              </div>
            ) : activeStatus === "complete" ? (
              <div className="border border-[#405c4e] bg-[#102822] p-4">
                <Check className="mb-4 h-5 w-5 text-[#8fc8a7]" />
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#8fc8a7]">
                  Mission complete
                </p>
                <p className="mt-2 text-sm leading-6 text-[#9bb3aa]">
                  This mission has been completed. The next mission is now available.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.26em] text-[#769092]">
                    Objective
                  </p>
                  <p className="text-sm leading-6 text-[#dbe7da]">
                    {activeMission.objective}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-[#29434a] bg-[#0f2429] p-3">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-[#71898b]">
                      Difficulty
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {difficultyStars(activeMission.difficulty, meta.maxDifficulty)}
                    </p>
                  </div>
                  <div className="border border-[#29434a] bg-[#0f2429] p-3">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-[#71898b]">
                      Duration
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#d9e5d3]">
                      {activeMission.duration}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.26em] text-[#769092]">
                    Mission reward
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="border-l-2 border-[#efb658] pl-3">
                      <p className="text-lg font-semibold text-[#f0bf67]">
                        {activeMission.credits}
                      </p>
                      <p className="text-[8px] uppercase tracking-[0.14em] text-[#71898b]">
                        Funding
                      </p>
                    </div>
                    <div className="border-l-2 border-[#76bba6] pl-3">
                      <p className="text-lg font-semibold text-[#b3d7bd]">
                        {activeMission.xp}
                      </p>
                      <p className="text-[8px] uppercase tracking-[0.14em] text-[#71898b]">
                        XP
                      </p>
                    </div>
                    <div className="border-l-2 border-[#9caf84] pl-3">
                      <p className="text-lg font-semibold text-[#cbd9b2]">
                        {activeMission.research}
                      </p>
                      <p className="text-[8px] uppercase tracking-[0.14em] text-[#71898b]">
                        Research
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border border-[#405c4e] bg-[#102822] p-4">
                  <div className="flex items-center gap-2 text-[#b7d5a0]">
                    <FlaskConical className="h-4 w-4" />
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em]">
                      Optional Research Opportunity
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-[#d9e5d3]">
                    {activeMission.opportunity}
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[#8ba99c]">
                    Only source of Research Tokens · Reward{" "}
                    {activeMission.research}
                  </p>
                </div>
                <div className="flex items-center gap-3 border-t border-[#29434a] pt-5">
                  <ShieldCheck className="h-5 w-5 text-[#8fc8c4]" />
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.18em] text-[#71898b]">
                      Technology reward
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#d5e4ce]">
                      {activeMission.technology}
                    </p>
                  </div>
                </div>
                <a
                  href="/preview/MissionLoadout"
                  className="flex w-full items-center justify-between bg-[#efb658] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.21em] text-[#1a211d] transition hover:bg-[#f6cb7b]"
                >
                  Prepare Mission {activeMission.number} <Target className="h-4 w-4" />
                </a>
              </>
            )}
          </div>
        </aside>
      </div>
    </GameShell>
  );
}

export default CampaignMapRefresh;
