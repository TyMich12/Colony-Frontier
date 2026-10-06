import { useEffect, useState } from "react";
import {
  loadGameState,
  resetGameState,
  saveGameState,
  STARTING_GAME_STATE,
} from "./gameState";

import {
  ChevronRight,
  CircleCheck,
  Clock3,
  Cpu,
  LockKeyhole,
  Map,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  X,
} from "lucide-react";

import {
  GameShell,
  LinkArrow,
  ProgressBar,
  SectionLabel,
} from "./_shared/GameShell";

const routes = {
  moon: "/preview/CampaignMapRefresh",
  lab: "/preview/TechnologyLabRefresh",
  loadout: "/preview/MissionLoadout",
};

export function MainMenu() {
  const [showMarsBrief, setShowMarsBrief] = useState(false);
  const [showStartingPopup, setShowStartingPopup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProgramRecord, setShowProgramRecord] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [devMessage, setDevMessage] = useState("");
  const [showDevConsole, setShowDevConsole] = useState(false);
  const [devCredits, setDevCredits] = useState(String(loadGameState().credits));
  const [devXp, setDevXp] = useState(String(loadGameState().xp));
  const [devResearch, setDevResearch] = useState(String(loadGameState().researchTokens));
  const liveState = loadGameState();
  const moonCompletedCount = liveState.completedMissions.filter((id) => id.startsWith("moon-")).length;
  const marsCompletedCount = liveState.completedMissions.filter((id) => id.startsWith("mars-")).length;
  const moonComplete = moonCompletedCount >= 8;
  const marsComplete = marsCompletedCount >= 15;
  const activeCampaign = moonComplete ? "Mars" : "Moon";
  const activeCompleted = moonComplete ? marsCompletedCount : moonCompletedCount;
  const activeTotal = moonComplete ? 15 : 8;
  const activeMissionNumber = Math.min(activeTotal, activeCompleted + 1);
  const activeProgress = Math.round((activeCompleted / activeTotal) * 100);


  useEffect(() => {
    const existing = localStorage.getItem("colony-frontier-game-state");

    if (!existing) {
      saveGameState(STARTING_GAME_STATE);
      setShowStartingPopup(true);
    }
  }, []);

  const confirmReset = () => {
    resetGameState();
    saveGameState(STARTING_GAME_STATE);
    setShowResetConfirm(false);
    setResetComplete(true);
  };

  return (
    <GameShell
      active="menu"
      eyebrow="Program command / home"
      title="Mission control"
    >
      <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="relative overflow-hidden border border-[#36545a] bg-[#0b1b22]/80 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.22)] md:p-9">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-[#9bbf9a]/20">
            <div className="absolute inset-7 rounded-full border border-[#9bbf9a]/15" />
            <div className="absolute inset-[4.5rem] rounded-full bg-[#efb658]/10" />
          </div>

          <div className="relative z-10 max-w-2xl">
            <div className="mb-14 flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.27em] text-[#88a59f]">
                <Radio className="h-4 w-4 text-[#efb658]" />
                Command uplink stable
              </div>

              <span className="border border-[#3e6061] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.22em] text-[#9bb8aa]">
                CFP-01
              </span>
            </div>

            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.34em] text-[#efb658]">
              The first world is never given
            </p>

            <h2 className="max-w-xl text-4xl font-semibold uppercase leading-[0.98] tracking-[0.1em] text-[#f1f3df] md:text-6xl">
              Build what can
              <span className="block text-[#b9d5a9]">outlast you.</span>
            </h2>

            <p className="mt-7 max-w-lg text-sm leading-7 text-[#9bb2ae]">
              Direct a fragile settlement from first landing to planetary
              independence. Every shipment, habitat, and research decision
              compounds.
            </p>

            <a
              href={moonComplete ? `${routes.moon}?campaign=mars` : routes.moon}
              className="group mt-9 inline-flex items-center gap-5 border border-[#efb658] bg-[#efb658] px-5 py-4 text-[11px] font-bold uppercase tracking-[0.23em] text-[#142127] transition hover:bg-[#f8cc79]"
            >
              {marsComplete ? "Review Mars campaign" : moonComplete ? "Continue Mars campaign" : "Begin Moon campaign"}
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>

            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-[10px] uppercase tracking-[0.2em] text-[#78938f]">
              <span className="flex items-center gap-2">
                <CircleCheck className="h-3.5 w-3.5 text-[#78c39e]" />
                Save synced
              </span>

              <span className="flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5" />
                Last brief 16:42 UTC
              </span>
            </div>
          </div>
        </section>

        <aside className="border border-[#36545a] bg-[#0a171e] p-6 md:p-7">
          <SectionLabel>Program status</SectionLabel>

          <div className="mb-7 flex items-end justify-between border-b border-[#284047] pb-5">
            <div>
              <p className="text-3xl font-semibold tracking-[0.08em] text-[#f0f1dc]">
                {String(activeMissionNumber).padStart(2, "0")}
              </p>

              <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-[#789690]">
                {activeCampaign} mission
              </p>
            </div>

            <span className="border border-[#477466] bg-[#19362f] px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[#91d0ad]">
              {marsComplete ? "Complete" : "In progress"}
            </span>
          </div>

          <div className="space-y-6">
            <div>
              <div className="mb-2 flex justify-between text-[10px] uppercase tracking-[0.19em]">
                <span className="text-[#d9e4cd]">
                  {activeCampaign} / Mission {String(activeMissionNumber).padStart(2, "0")}
                </span>

                <span className="text-[#efb658]">{activeProgress}%</span>
              </div>

              <ProgressBar value={activeProgress} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[#263f45] bg-[#0d2228] p-4">
                <p className="font-mono text-xl text-[#d6e2c7]">
                  {String(moonCompletedCount + marsCompletedCount).padStart(2, "0")}
                </p>

                <p className="mt-2 text-[9px] uppercase tracking-[0.15em] text-[#78938f]">
                  Missions secured
                </p>
              </div>

              <div className="border border-[#263f45] bg-[#0d2228] p-4">
                <p className="font-mono text-xl text-[#d6e2c7]">
                  {liveState.researchTokens}
                </p>

                <p className="mt-2 text-[9px] uppercase tracking-[0.15em] text-[#78938f]">
                  Research tokens
                </p>
              </div>
            </div>
          </div>

          <a
            href={routes.moon}
            className="mt-8 flex items-center justify-between border-t border-[#284047] pt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a9c49f] transition hover:text-[#efb658]"
          >
            Open campaign map
            <LinkArrow />
          </a>
        </aside>
      </div>

      <div className="mt-10">
        <SectionLabel>Available programs</SectionLabel>

        <div className="grid gap-4 md:grid-cols-[1.35fr_1fr_1fr]">
          <a
            href={routes.moon}
            className="group relative flex min-h-[180px] flex-col justify-between overflow-hidden border border-[#6d7651] bg-[#182c2a] p-6 transition hover:-translate-y-0.5 hover:border-[#efb658]"
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full border border-[#a7c58e]/30" />

            <div className="relative flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center border border-[#849e76] bg-[#263c31] text-[#d7e8bd]">
                <Map className="h-5 w-5" />
              </div>

              <span className="text-[9px] uppercase tracking-[0.2em] text-[#b5d39e]">
                Active
              </span>
            </div>

            <div className="relative">
              <h3 className="text-xl font-semibold uppercase tracking-[0.12em] text-[#edf2dc]">
                Moon campaign
              </h3>

              <p className="mt-2 max-w-xs text-xs leading-5 text-[#a8bca7]">
                Establish the first permanent foothold beyond Earth.
              </p>
            </div>
          </a>

          {moonComplete ? (
            <a
              href="/preview/CampaignMapRefresh?campaign=mars"
              className="group flex min-h-[180px] flex-col justify-between border border-[#6d7651] bg-[#182c2a] p-6 text-left transition hover:border-[#efb658]"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center border border-[#849e76] bg-[#263c31] text-[#d7e8bd]">
                  <Target className="h-5 w-5" />
                </div>
                <span className="text-[9px] uppercase tracking-[0.2em] text-[#b5d39e]">
                  {marsComplete ? "Complete" : "Unlocked"}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold uppercase tracking-[0.12em] text-[#edf2dc]">
                  Mars campaign
                </h3>
                <p className="mt-2 text-xs leading-5 text-[#a8bca7]">
                  {marsComplete ? "Planetary independence achieved." : "Continue the colony beyond the Moon."}
                </p>
              </div>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setShowMarsBrief(true)}
              className="group flex min-h-[180px] flex-col justify-between border border-[#32474a] bg-[#0d1b22] p-6 text-left transition hover:border-[#66776c]"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center border border-[#3c5151] bg-[#17282c] text-[#7c9390]">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <span className="text-[9px] uppercase tracking-[0.2em] text-[#788c88]">
                  Locked
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold uppercase tracking-[0.12em] text-[#b6c4bb]">
                  Mars campaign
                </h3>
                <p className="mt-2 text-xs leading-5 text-[#7d9692]">
                  Unlock after completing the Moon campaign.
                </p>
              </div>
            </button>
          )}

          <a
            href={routes.lab}
            className="group flex min-h-[180px] flex-col justify-between border border-[#32474a] bg-[#0d1b22] p-6 transition hover:border-[#efb658]"
          >
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center border border-[#3c5151] bg-[#17282c] text-[#efb658]">
                <Cpu className="h-5 w-5" />
              </div>

              <span className="text-[9px] uppercase tracking-[0.2em] text-[#a1b4a5]">
                Open
              </span>
            </div>

            <div>
              <h3 className="text-xl font-semibold uppercase tracking-[0.12em] text-[#dce8d5]">
                Technology lab
              </h3>

              <p className="mt-2 text-xs leading-5 text-[#8ba39d]">
                Shape the systems that make survival repeatable.
              </p>
            </div>
          </a>
        </div>
      </div>

      <div className="mt-10 grid gap-4 border-t border-[#284047] pt-7 sm:grid-cols-3">
        <a
          href={moonComplete ? `${routes.loadout}?campaign=mars` : routes.loadout}
          className="flex items-center gap-4 p-2 text-[#9bb3aa] transition hover:text-[#efb658]"
        >
          <SlidersHorizontal className="h-4 w-4" />

          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
            Mission loadout
          </span>

          <ChevronRight className="ml-auto h-4 w-4" />
        </a>

        <button
          type="button"
          onClick={() => setShowProgramRecord(true)}
          className="flex items-center gap-4 p-2 text-[#9bb3aa] transition hover:text-[#efb658]"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
            Program record
          </span>

          <ChevronRight className="ml-auto h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            setResetComplete(false);
            setShowSettings(true);
          }}
          className="flex items-center gap-4 p-2 text-[#9bb3aa] transition hover:text-[#efb658]"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
            Settings
          </span>

          <ChevronRight className="ml-auto h-4 w-4" />
        </button>
      </div>

      {showSettings && (
        <div
          className="fixed inset-0 z-30 grid place-items-center bg-[#050d12]/80 p-5 backdrop-blur-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <div className="w-full max-w-lg border border-[#52655b] bg-[#08171f] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-9">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 text-[#efb658]">
                <SlidersHorizontal className="h-5 w-5" />

                <span className="text-[10px] font-bold uppercase tracking-[0.25em]">
                  Command settings
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowSettings(false)}
                aria-label="Close settings"
                className="text-[#78938f] transition hover:text-[#f0f1dc]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <h2
              id="settings-title"
              className="mt-8 text-2xl font-semibold uppercase tracking-[0.1em] text-[#eff1dc]"
            >
              Settings
            </h2>

            <p className="mt-4 text-sm leading-7 text-[#a8bbb1]">
              Manage your local campaign data and program preferences.
            </p>

            <div className="mt-7 border border-[#3e5550] bg-[#101f23] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#e8e9d9]">
                    Developer access
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[#9ca9a2]">
                    Enter the developer code to open the resource console for testing.
                  </p>
                </div>
                <span className="shrink-0 border border-[#405c4e] bg-[#102822] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-[#8fc8a7]">
                  {loadGameState().devMode ? "Active" : "Locked"}
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={devCode}
                  onChange={(event) => setDevCode(event.target.value)}
                  placeholder="Developer code"
                  autoComplete="off"
                  className="min-w-0 flex-1 border border-[#40565a] bg-[#08171f] px-3 py-3 font-mono text-sm text-[#e7eee5] outline-none placeholder:text-[#536a69] focus:border-[#efb658]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (devCode === "DevTyson") {
                      const current = loadGameState();
                      const nextState = {
                        ...current,
                        devMode: true,
                      };
                      saveGameState(nextState);
                      setDevMessage("Developer mode enabled.");
                      setDevCredits(String(nextState.credits));
                      setDevXp(String(nextState.xp));
                      setDevResearch(String(nextState.researchTokens));
                      setDevCode("");
                      setShowDevConsole(true);
                    } else {
                      setDevMessage("Invalid developer code.");
                    }
                  }}
                  className="shrink-0 border border-[#6d7651] bg-[#182c2a] px-4 py-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[#c9debc] transition hover:border-[#efb658] hover:text-[#efb658]"
                >
                  Activate
                </button>
              </div>

              {devMessage && (
                <p className="mt-3 text-xs leading-5 text-[#9bb3aa]">
                  {devMessage}
                </p>
              )}
            </div>

            <div className="mt-4 border border-[#594a35] bg-[#1a2020] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#e8e9d9]">
                    Reset campaign data
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-[#9ca9a2]">
                    Return Colony-Frontier to its original starting state.
                    Your credits, XP, research, mission progress, and
                    technology unlocks will be cleared.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="shrink-0 border border-[#9b6c45] bg-[#2a2220] px-4 py-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[#e6b078] transition hover:border-[#efb658] hover:text-[#efb658]"
                >
                  Reset Campaign
                </button>
              </div>
            </div>

            {resetComplete && (
              <div className="mt-5 border border-[#477466] bg-[#19362f] p-4 text-xs leading-5 text-[#a9d4b8]">
                Campaign data has been reset. Starting resources are restored
                to $30M, 0 XP, and 0 RT.
              </div>
            )}
          </div>
        </div>
      )}

      {showProgramRecord && (
        <div
          className="fixed inset-0 z-30 grid place-items-center bg-[#050d12]/80 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="program-record-title"
        >
          <div className="w-full max-w-lg border border-[#52655b] bg-[#08171f] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between border-b border-[#2d4648] bg-[#10242a] px-6 py-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#efb658]">Colony record</p>
                <h2 id="program-record-title" className="mt-2 text-xl font-bold uppercase tracking-[0.12em] text-[#edf2df]">Program record</h2>
              </div>
              <button type="button" onClick={() => setShowProgramRecord(false)} aria-label="Close program record" className="text-[#78938f] hover:text-[#f0f1dc]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 p-6 sm:grid-cols-2">
              <div className="border border-[#334d50] bg-[#0d2027] p-4">
                <p className="text-[9px] uppercase tracking-[0.18em] text-[#78938f]">Treasury</p>
                <p className="mt-2 font-mono text-xl text-[#efb658]">{liveState.credits.toFixed(1)}M Credits</p>
              </div>
              <div className="border border-[#334d50] bg-[#0d2027] p-4">
                <p className="text-[9px] uppercase tracking-[0.18em] text-[#78938f]">Experience</p>
                <p className="mt-2 font-mono text-xl text-[#e7eee5]">{liveState.xp.toLocaleString()} XP</p>
              </div>
              <div className="border border-[#334d50] bg-[#0d2027] p-4">
                <p className="text-[9px] uppercase tracking-[0.18em] text-[#78938f]">Research Tokens</p>
                <p className="mt-2 font-mono text-xl text-[#b9d5a9]">{liveState.researchTokens} RT</p>
              </div>
              <div className="border border-[#334d50] bg-[#0d2027] p-4">
                <p className="text-[9px] uppercase tracking-[0.18em] text-[#78938f]">Technology tiers</p>
                <p className="mt-2 font-mono text-xl text-[#d7e8bd]">{liveState.unlockedTechnologies.length}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 px-6 pb-6">
              <div className="border border-[#334d50] bg-[#0d2027] p-4">
                <p className="text-[9px] uppercase tracking-[0.18em] text-[#78938f]">Moon</p>
                <p className="mt-2 font-mono text-lg text-[#d7e8bd]">{moonCompletedCount} / 8</p>
              </div>
              <div className="border border-[#334d50] bg-[#0d2027] p-4">
                <p className="text-[9px] uppercase tracking-[0.18em] text-[#78938f]">Mars</p>
                <p className="mt-2 font-mono text-lg text-[#d7e8bd]">{marsCompletedCount} / 15</p>
              </div>
            </div>

            <div className="border-t border-[#29434a] bg-[#0b171d] px-6 py-5">
              <button
                type="button"
                onClick={() => setShowProgramRecord(false)}
                className="w-full border border-[#40565a] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a9bbb3] hover:border-[#efb658] hover:text-[#efb658]"
              >
                Close record
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-[#03090c]/90 p-5 backdrop-blur-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-confirm-title"
        >
          <div className="w-full max-w-md border border-[#8a6549] bg-[#08171f] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-center gap-3 text-[#efb658]">
              <ShieldCheck className="h-5 w-5" />

              <span className="text-[10px] font-bold uppercase tracking-[0.25em]">
                Confirmation required
              </span>
            </div>

            <h2
              id="reset-confirm-title"
              className="mt-7 text-xl font-semibold uppercase tracking-[0.1em] text-[#eff1dc]"
            >
              Reset campaign data?
            </h2>

            <p className="mt-4 text-sm leading-6 text-[#aabbb2]">
              Are you sure you want to start over? This will permanently
              clear your current credits, XP, research tokens, completed
              missions, and technology unlocks.
            </p>

            <p className="mt-4 text-xs uppercase tracking-[0.14em] text-[#d09a6a]">
              This action cannot be undone.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="border border-[#40565a] bg-[#17282d] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a9bbb3] transition hover:border-[#668078] hover:text-[#e6eee4]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmReset}
                className="border border-[#a06f47] bg-[#493027] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f0c19a] transition hover:border-[#efb658] hover:text-[#efb658]"
              >
                Reset & Start Over
              </button>
            </div>
          </div>
        </div>
      )}

      {showMarsBrief && (
        <div
          className="fixed inset-0 z-20 grid place-items-center bg-[#050d12]/80 p-5 backdrop-blur-none"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg border border-[#52655b] bg-[#08171f] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-9">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 text-[#efb658]">
                <ShieldCheck className="h-5 w-5" />

                <span className="text-[10px] font-bold uppercase tracking-[0.25em]">
                  Access protocol
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowMarsBrief(false)}
                aria-label="Close briefing"
                className="text-[#78938f] transition hover:text-[#f0f1dc]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <h2 className="mt-8 text-2xl font-semibold uppercase tracking-[0.1em] text-[#eff1dc]">
              Mars campaign is sealed
            </h2>

            <p className="mt-4 text-sm leading-7 text-[#a8bbb1]">
              The interplanetary transfer window remains classified. Prove
              that your program can sustain a world before committing lives
              and hardware to the long crossing.
            </p>

            <div className="mt-7 border border-[#334d50] bg-[#0b1a21] p-4">
              <div className="flex items-center gap-3 text-[#cbd9c2]">
                <Target className="h-4 w-4 text-[#efb658]" />

                <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
                  Requirement
                </span>
              </div>

              <p className="mt-3 text-xs leading-5 text-[#8ea49e]">
                Complete all primary objectives in the Moon campaign to
                authorize Mars.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowMarsBrief(false)}
              className="mt-7 w-full border border-[#6a7f69] bg-[#1a332e] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#c9debc] transition hover:border-[#efb658] hover:text-[#efb658]"
            >
              Acknowledge briefing
            </button>
          </div>
        </div>
      )}

      {showDevConsole && (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-[#02080c]/85 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dev-console-title"
        >
          <div className="w-full max-w-lg border-2 border-[#efb658] bg-[#08171f] shadow-[0_0_50px_rgba(239,182,88,0.18)]">
            <div className="flex items-start justify-between border-b border-[#3d5148] bg-[#172a2a] px-6 py-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#efb658]">Developer access</p>
                <h2 id="dev-console-title" className="mt-2 text-xl font-bold uppercase tracking-[0.12em] text-[#edf2df]">Resource console</h2>
                <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-[#819b96]">Edit test resources and apply them to the saved campaign.</p>
              </div>
              <button type="button" onClick={() => setShowDevConsole(false)} aria-label="Close developer console" className="text-[#78938f] hover:text-[#f0f1dc]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-3">
              <label className="border border-[#334d50] bg-[#0d2027] p-4">
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#78938f]">Credits (M)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={devCredits}
                  onChange={(event) => setDevCredits(event.target.value)}
                  className="mt-3 w-full border border-[#40565a] bg-[#08171f] px-3 py-2 font-mono text-lg text-[#efb658] outline-none focus:border-[#efb658]"
                />
              </label>
              <label className="border border-[#334d50] bg-[#0d2027] p-4">
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#78938f]">XP</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={devXp}
                  onChange={(event) => setDevXp(event.target.value)}
                  className="mt-3 w-full border border-[#40565a] bg-[#08171f] px-3 py-2 font-mono text-lg text-[#e7eee5] outline-none focus:border-[#efb658]"
                />
              </label>
              <label className="border border-[#334d50] bg-[#0d2027] p-4">
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#78938f]">Research Tokens</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={devResearch}
                  onChange={(event) => setDevResearch(event.target.value)}
                  className="mt-3 w-full border border-[#40565a] bg-[#08171f] px-3 py-2 font-mono text-lg text-[#b9d5a9] outline-none focus:border-[#efb658]"
                />
              </label>
            </div>

            <div className="border-t border-[#29434a] bg-[#0b171d] px-6 py-5">
              <p className="text-[9px] uppercase tracking-[0.14em] leading-5 text-[#78938f]">
                Values are saved immediately. Credits are stored in millions, matching the campaign economy.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowDevConsole(false)} className="border border-[#40565a] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a9bbb3] hover:border-[#789293] hover:text-[#e6eee4]">
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const current = loadGameState();
                    const credits = Number(devCredits);
                    const xp = Number(devXp);
                    const researchTokens = Number(devResearch);
                    if (![credits, xp, researchTokens].every(Number.isFinite) || credits < 0 || xp < 0 || researchTokens < 0) {
                      setDevMessage("Enter valid non-negative values.");
                      return;
                    }
                    const nextState = {
                      ...current,
                      devMode: true,
                      credits,
                      xp: Math.floor(xp),
                      researchTokens: Math.floor(researchTokens),
                    };
                    saveGameState(nextState);
                    setDevCredits(String(nextState.credits));
                    setDevXp(String(nextState.xp));
                    setDevResearch(String(nextState.researchTokens));
                    setDevMessage("Developer resources updated.");
                    setShowDevConsole(false);
                  }}
                  className="border border-[#efb658] bg-[#efb658] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#17201b] hover:bg-[#f6cb7b]"
                >
                  Apply values
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStartingPopup && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="starting-program-title"
        >
          <div className="w-full max-w-lg border border-[#6f8058] bg-[#08171f] shadow-[0_0_40px_rgba(110,200,130,0.2)]">
            <div className="border-b border-[#2d4648] bg-[#162d30] px-6 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#efb658]">
                Colony Command
              </div>

              <h2
                id="starting-program-title"
                className="mt-2 text-2xl font-bold uppercase tracking-[0.12em] text-[#e7eee5]"
              >
                Programme Initialised
              </h2>
            </div>

            <div className="space-y-6 p-6">
              <p className="text-sm leading-6 text-[#b9c7bd]">
                Your colony programme has been approved for initial
                deployment. Command has allocated your starting resources.
              </p>

              <div className="grid grid-cols-3 gap-3">
                <div className="border border-[#2d4648] bg-[#101f26] p-4">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-[#718f80]">
                    Credits
                  </div>

                  <div className="mt-2 text-xl font-bold text-[#efb658]">
                    $30M
                  </div>
                </div>

                <div className="border border-[#2d4648] bg-[#101f26] p-4">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-[#718f80]">
                    XP
                  </div>

                  <div className="mt-2 text-xl font-bold text-[#e7eee5]">
                    0
                  </div>
                </div>

                <div className="border border-[#2d4648] bg-[#101f26] p-4">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-[#718f80]">
                    Research
                  </div>

                  <div className="mt-2 text-xl font-bold text-[#e7eee5]">
                    0 RT
                  </div>
                </div>
              </div>

              <div className="border border-[#2d4648] bg-[#101f26] p-4 text-xs leading-5 text-[#9eafa4]">
                Foundation-level technologies are available for initial
                deployment. Further technologies will unlock as your colony
                programme progresses.
              </div>

              <button
                type="button"
                onClick={() => setShowStartingPopup(false)}
                className="w-full bg-[#efb658] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.21em] text-[#1a211d] transition hover:bg-[#f6cb7b]"
              >
                Begin Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </GameShell>
  );
}

export default MainMenu;
