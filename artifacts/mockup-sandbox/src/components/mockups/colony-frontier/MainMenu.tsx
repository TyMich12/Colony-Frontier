import { useState } from "react";
import {
  Award,
  ChevronRight,
  CircleCheck,
  Clock3,
  Cpu,
  LockKeyhole,
  Map,
  Radio,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { GameShell, LinkArrow, ProgressBar, SectionLabel } from "./_shared/GameShell";

const routes = {
  moon: "/__mockup/preview/colony-frontier/CampaignMap",
  lab: "/__mockup/preview/colony-frontier/TechnologyLab",
  loadout: "/__mockup/preview/colony-frontier/MissionLoadout",
  achievements: "/__mockup/preview/colony-frontier/Achievements",
  settings: "/__mockup/preview/colony-frontier/Settings",
};

export function MainMenu() {
  const [showMarsBrief, setShowMarsBrief] = useState(false);

  return (
    <GameShell active="menu" eyebrow="Program command / home" title="Mission control">
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
              Direct a fragile settlement from first landing to planetary independence.
              Every shipment, habitat, and research decision compounds.
            </p>
            <a
              href={routes.moon}
              className="group mt-9 inline-flex items-center gap-5 border border-[#efb658] bg-[#efb658] px-5 py-4 text-[11px] font-bold uppercase tracking-[0.23em] text-[#142127] transition hover:bg-[#f8cc79] focus:outline-none focus:ring-2 focus:ring-[#f8cc79] focus:ring-offset-2 focus:ring-offset-[#0b1b22]"
            >
              Resume moon campaign
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-[10px] uppercase tracking-[0.2em] text-[#78938f]">
              <span className="flex items-center gap-2"><CircleCheck className="h-3.5 w-3.5 text-[#78c39e]" /> Save synced</span>
              <span className="flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" /> Last brief 16:42 UTC</span>
            </div>
          </div>
        </section>

        <aside className="border border-[#36545a] bg-[#0a171e] p-6 md:p-7">
          <SectionLabel>Program status</SectionLabel>
          <div className="mb-7 flex items-end justify-between border-b border-[#284047] pb-5">
            <div>
              <p className="text-3xl font-semibold tracking-[0.08em] text-[#f0f1dc]">01</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-[#789690]">Active campaign</p>
            </div>
            <span className="border border-[#477466] bg-[#19362f] px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[#91d0ad]">In progress</span>
          </div>
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex justify-between text-[10px] uppercase tracking-[0.19em]">
                <span className="text-[#d9e4cd]">Moon / Mare Tranquillitatis</span>
                <span className="text-[#efb658]">34%</span>
              </div>
              <ProgressBar value={34} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[#263f45] bg-[#0d2228] p-4">
                <p className="font-mono text-xl text-[#d6e2c7]">07</p>
                <p className="mt-2 text-[9px] uppercase tracking-[0.15em] text-[#78938f]">Sol objectives</p>
              </div>
              <div className="border border-[#263f45] bg-[#0d2228] p-4">
                <p className="font-mono text-xl text-[#d6e2c7]">03</p>
                <p className="mt-2 text-[9px] uppercase tracking-[0.15em] text-[#78938f]">Crew aboard</p>
              </div>
            </div>
          </div>
          <a href={routes.moon} className="mt-8 flex items-center justify-between border-t border-[#284047] pt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a9c49f] transition hover:text-[#efb658] focus:outline-none focus:text-[#efb658]">
            Open campaign map <LinkArrow />
          </a>
        </aside>
      </div>

      <div className="mt-10">
        <SectionLabel>Available programs</SectionLabel>
        <div className="grid gap-4 md:grid-cols-[1.35fr_1fr_1fr]">
          <a href={routes.moon} className="group relative flex min-h-[180px] flex-col justify-between overflow-hidden border border-[#6d7651] bg-[#182c2a] p-6 transition hover:-translate-y-0.5 hover:border-[#efb658] focus:outline-none focus:ring-2 focus:ring-[#efb658]">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full border border-[#a7c58e]/30" />
            <div className="relative flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center border border-[#849e76] bg-[#263c31] text-[#d7e8bd]"><Map className="h-5 w-5" /></div>
              <span className="text-[9px] uppercase tracking-[0.2em] text-[#b5d39e]">Active</span>
            </div>
            <div className="relative">
              <h3 className="text-xl font-semibold uppercase tracking-[0.12em] text-[#edf2dc]">Moon campaign</h3>
              <p className="mt-2 max-w-xs text-xs leading-5 text-[#a8bca7]">Establish the first permanent foothold beyond Earth.</p>
            </div>
          </a>
          <button onClick={() => setShowMarsBrief(true)} className="group flex min-h-[180px] flex-col justify-between border border-[#32474a] bg-[#0d1b22] p-6 text-left transition hover:border-[#66776c] focus:outline-none focus:ring-2 focus:ring-[#efb658]">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center border border-[#3c5151] bg-[#17282c] text-[#7c9390]"><LockKeyhole className="h-5 w-5" /></div>
              <span className="text-[9px] uppercase tracking-[0.2em] text-[#788c88]">Locked</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold uppercase tracking-[0.12em] text-[#b6c4bb]">Mars campaign</h3>
              <p className="mt-2 text-xs leading-5 text-[#7d9692]">Unlock after completing the Moon campaign.</p>
            </div>
          </button>
          <a href={routes.lab} className="group flex min-h-[180px] flex-col justify-between border border-[#32474a] bg-[#0d1b22] p-6 transition hover:border-[#efb658] focus:outline-none focus:ring-2 focus:ring-[#efb658]">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center border border-[#3c5151] bg-[#17282c] text-[#efb658]"><Cpu className="h-5 w-5" /></div>
              <span className="text-[9px] uppercase tracking-[0.2em] text-[#a1b4a5]">Open</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold uppercase tracking-[0.12em] text-[#dce8d5]">Technology lab</h3>
              <p className="mt-2 text-xs leading-5 text-[#8ba39d]">Shape the systems that make survival repeatable.</p>
            </div>
          </a>
        </div>
      </div>

      <div className="mt-10 grid gap-4 border-t border-[#284047] pt-7 sm:grid-cols-3">
        <a href={routes.loadout} className="flex items-center gap-4 p-2 text-[#9bb3aa] transition hover:text-[#efb658] focus:outline-none focus:text-[#efb658]"><SlidersHorizontal className="h-4 w-4" /><span className="text-[10px] font-bold uppercase tracking-[0.2em]">Mission loadout</span><ChevronRight className="ml-auto h-4 w-4" /></a>
        <a href={routes.achievements} className="flex items-center gap-4 p-2 text-[#9bb3aa] transition hover:text-[#efb658] focus:outline-none focus:text-[#efb658]"><Award className="h-4 w-4" /><span className="text-[10px] font-bold uppercase tracking-[0.2em]">Program record</span><ChevronRight className="ml-auto h-4 w-4" /></a>
        <a href={routes.settings} className="flex items-center gap-4 p-2 text-[#9bb3aa] transition hover:text-[#efb658] focus:outline-none focus:text-[#efb658]"><Settings className="h-4 w-4" /><span className="text-[10px] font-bold uppercase tracking-[0.2em]">Settings</span><ChevronRight className="ml-auto h-4 w-4" /></a>
      </div>

      {showMarsBrief && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-[#050d12]/80 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="mars-brief-title">
          <div className="w-full max-w-lg border border-[#52655b] bg-[#102229] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-9">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 text-[#efb658]"><ShieldCheck className="h-5 w-5" /><span className="text-[10px] font-bold uppercase tracking-[0.25em]">Access protocol</span></div>
              <button onClick={() => setShowMarsBrief(false)} aria-label="Close briefing" className="text-[#78938f] transition hover:text-[#f0f1dc] focus:outline-none focus:ring-2 focus:ring-[#efb658]"><X className="h-5 w-5" /></button>
            </div>
            <h2 id="mars-brief-title" className="mt-8 text-2xl font-semibold uppercase tracking-[0.1em] text-[#eff1dc]">Mars campaign is sealed</h2>
            <p className="mt-4 text-sm leading-7 text-[#a8bbb1]">The interplanetary transfer window remains classified. Prove that your program can sustain a world before committing lives and hardware to the long crossing.</p>
            <div className="mt-7 border border-[#334d50] bg-[#0b1a21] p-4">
              <div className="flex items-center gap-3 text-[#cbd9c2]"><Target className="h-4 w-4 text-[#efb658]" /><span className="text-[10px] font-bold uppercase tracking-[0.18em]">Requirement</span></div>
              <p className="mt-3 text-xs leading-5 text-[#8ea49e]">Complete all primary objectives in the Moon campaign to authorize Mars.</p>
            </div>
            <button onClick={() => setShowMarsBrief(false)} className="mt-7 w-full border border-[#6a7f69] bg-[#1a332e] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#c9debc] transition hover:border-[#efb658] hover:text-[#efb658] focus:outline-none focus:ring-2 focus:ring-[#efb658]">Acknowledge briefing</button>
          </div>
        </div>
      )}
    </GameShell>
  );
}

export default MainMenu;