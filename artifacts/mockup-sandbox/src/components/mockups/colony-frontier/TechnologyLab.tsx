import { useState } from "react";
import {
  Activity,
  Atom,
  Check,
  ChevronDown,
  CircleDot,
  LockKeyhole,
  Microscope,
  Orbit,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { GameShell, ProgressBar, SectionLabel } from "./_shared/GameShell";

type Tier = "Foundation" | "Frontier" | "Apex" | "Research";

type Technology = {
  name: string;
  code: string;
  tier: Tier;
  mass: string;
  cost: string;
  xp: string;
  state: "available" | "locked" | "research";
  note: string;
};

const technologies: Technology[] = [
  {
    name: "Helios-1 Array",
    code: "SOL / FDN-01",
    tier: "Foundation",
    mass: "18.4 t",
    cost: "1,240 cr",
    xp: "0 XP",
    state: "available",
    note: "Baseline orbital collection. Establishes the first dependable power margin.",
  },
  {
    name: "Helios-X Array",
    code: "SOL / FRT-02",
    tier: "Frontier",
    mass: "34.8 t",
    cost: "4,860 cr",
    xp: "1,800 XP",
    state: "locked",
    note: "Folded mirror geometry raises output, but demands a stable orbital fabrication chain.",
  },
  {
    name: "Helios-XR Array",
    code: "SOL / APX-03",
    tier: "Apex",
    mass: "61.2 t",
    cost: "12,600 cr",
    xp: "5,400 XP",
    state: "locked",
    note: "High-radiance collectors for the colony’s most power-hungry industrial cycles.",
  },
  {
    name: "Helios-Nova Array",
    code: "SOL / RES-04",
    tier: "Research",
    mass: "96.0 t",
    cost: "31,750 cr",
    xp: "10,000 XP + 5 tokens",
    state: "research",
    note: "Unverified stellar-harvest architecture. A difficult opportunity with an outsized return.",
  },
];

const tierMeta: Record<Tier, { kicker: string; color: string; marker: string }> = {
  Foundation: { kicker: "Operational baseline", color: "#b9d97c", marker: "01" },
  Frontier: { kicker: "Expansion threshold", color: "#e9ad52", marker: "02" },
  Apex: { kicker: "Industrial leverage", color: "#dc7b58", marker: "03" },
  Research: { kicker: "Uncharted capability", color: "#f2d46b", marker: "04" },
};

function DataCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-[#76908e]">{label}</p>
      <p className="font-mono text-xs text-[#d8e3cf]">{value}</p>
    </div>
  );
}

export function TechnologyLab() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <GameShell active="lab" eyebrow="Research terminal / capability ladder" title="Technology Lab">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_310px]">
        <section>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b border-[#29434a] pb-5">
            <div>
              <SectionLabel>Primary progression · Solar collection</SectionLabel>
              <h2 className="max-w-xl text-xl font-semibold uppercase tracking-[0.14em] text-[#f0f4e8]">
                Every breakthrough leaves a heavier footprint.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#8fa8a2]">
                Four distinct thresholds turn sunlight into infrastructure. The next rung is visible long before it is safe to reach.
              </p>
            </div>
            <div className="flex items-center gap-3 border border-[#3d5b50] bg-[#10232a] px-4 py-3">
              <Activity className="h-4 w-4 text-[#b9d97c]" />
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] text-[#76908e]">Colony research</p>
                <p className="font-mono text-sm text-[#e8efdd]">6,240 <span className="text-[#76908e]">/ 10,000 XP</span></p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute bottom-9 left-[22px] top-7 w-px bg-gradient-to-b from-[#b9d97c] via-[#e9ad52] to-[#6c4947]" />
            <div className="space-y-3">
              {technologies.map((tech) => {
                const meta = tierMeta[tech.tier];
                const isSelected = selected === tech.name;
                return (
                  <article key={tech.name} className={`relative pl-12 transition-opacity ${tech.state === "locked" ? "opacity-80" : ""}`}>
                    <div
                      className="absolute left-0 top-5 z-10 grid h-11 w-11 place-items-center border bg-[#0a1820]"
                      style={{ borderColor: meta.color }}
                    >
                      {tech.state === "available" ? (
                        <Check className="h-4 w-4" style={{ color: meta.color }} />
                      ) : tech.state === "research" ? (
                        <Microscope className="h-4 w-4" style={{ color: meta.color }} />
                      ) : (
                        <LockKeyhole className="h-4 w-4" style={{ color: meta.color }} />
                      )}
                    </div>
                    <div className={`border ${isSelected ? "border-[#b9d97c] bg-[#15282c]" : "border-[#29434a] bg-[#0d2028]"} p-4 md:p-5`}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <span className="pt-1 font-mono text-[10px]" style={{ color: meta.color }}>{meta.marker}</span>
                          <div>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: meta.color }}>{tech.tier}</p>
                              {tech.state === "available" && <span className="border border-[#53715c] px-2 py-0.5 text-[8px] uppercase tracking-[0.16em] text-[#a8d39b]">Installed</span>}
                              {tech.state === "research" && <span className="border border-[#75643d] px-2 py-0.5 text-[8px] uppercase tracking-[0.16em] text-[#f0cb6b]">Opportunity</span>}
                            </div>
                            <h3 className="text-lg font-semibold uppercase tracking-[0.1em] text-[#edf3e7]">{tech.name}</h3>
                            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#718d8d]">{tech.code} · {meta.kicker}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelected(isSelected ? null : tech.name)}
                          className="flex items-center gap-2 border border-[#345158] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#9bb5ac] transition hover:border-[#b9d97c] hover:text-[#e4efcf]"
                          aria-expanded={isSelected}
                        >
                          Details <ChevronDown className={`h-3 w-3 transition-transform ${isSelected ? "rotate-180" : ""}`} />
                        </button>
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#29434a] pt-4 sm:grid-cols-4">
                        <DataCell label="Mass" value={tech.mass} />
                        <DataCell label="Credit cost" value={tech.cost} />
                        <DataCell label="XP requirement" value={tech.xp} />
                        <DataCell label="Status" value={tech.state === "available" ? "Online" : tech.state === "research" ? "Unverified" : "Locked"} />
                      </div>
                      {isSelected && (
                        <div className="mt-4 border-l-2 border-[#b9d97c] bg-[#10252a] px-4 py-3 text-xs leading-5 text-[#a9c0b5]">
                          {tech.note}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="border border-[#67543b] bg-[#171f23] p-5">
            <div className="mb-4 flex items-center justify-between">
              <SectionLabel>Research gate</SectionLabel>
              <ShieldAlert className="h-4 w-4 text-[#efbd5d]" />
            </div>
            <h2 className="text-lg font-semibold uppercase tracking-[0.12em] text-[#f1ebd1]">Never automatic.</h2>
            <p className="mt-3 text-sm leading-6 text-[#b6b19d]">
              Research-tier technology stays sealed until the colony proves it can carry the risk.
            </p>
            <div className="mt-5 space-y-3 border-t border-[#514635] pt-4">
              <div className="flex justify-between text-[10px] uppercase tracking-[0.16em]"><span className="text-[#8e978a]">Experience</span><span className="font-mono text-[#f1d47c]">6,240 / 10,000 XP</span></div>
              <ProgressBar value={62.4} color="#efbd5d" />
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em]"><span className="text-[#8e978a]">Research tokens</span><span className="font-mono text-[#f1d47c]">2 / 5 secured</span></div>
              <div className="flex gap-1.5">{[0, 1, 2, 3, 4].map((token) => <span key={token} className={`h-2 flex-1 border ${token < 2 ? "border-[#efbd5d] bg-[#efbd5d]" : "border-[#655844]"}`} />)}</div>
            </div>
          </section>

          <section className="border border-[#29434a] bg-[#0d2028] p-5">
            <SectionLabel>Additional track</SectionLabel>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#7f9c96]">Atmospheric processing</p>
                <h2 className="mt-2 text-lg font-semibold uppercase tracking-[0.1em] text-[#e8efdf]">Aurelia Line</h2>
              </div>
              <Atom className="h-5 w-5 text-[#8ac7c2]" />
            </div>
            <div className="mt-5 flex items-center gap-3">
              <div className="h-1.5 flex-1 bg-[#1b353a]"><div className="h-full w-[38%] bg-[#8ac7c2]" /></div>
              <span className="font-mono text-[10px] text-[#9cc5bc]">02 / 04</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#29434a] pt-4 text-[10px] uppercase tracking-[0.15em]">
              <span className="text-[#718b8c]">Next: Aurelia-II</span>
              <span className="text-[#8ac7c2]">1,150 XP</span>
            </div>
          </section>

          <section className="border border-[#29434a] bg-[#0c1b23] p-5">
            <div className="flex gap-3">
              <Orbit className="mt-0.5 h-4 w-4 shrink-0 text-[#b9d97c]" />
              <p className="text-xs leading-5 text-[#8da8a1]">
                <span className="font-semibold text-[#cfdfc4]">Field note.</span> Difficult Research Opportunities are not side content. They are the shortest path to capabilities no standard blueprint can provide.
              </p>
            </div>
          </section>
        </aside>
      </div>
      <div className="mt-8 flex items-center justify-between border-t border-[#29434a] pt-4 text-[9px] uppercase tracking-[0.22em] text-[#657e7e]">
        <span className="flex items-center gap-2"><CircleDot className="h-3 w-3 text-[#b9d97c]" /> Live capability ledger</span>
        <span className="flex items-center gap-2"><Zap className="h-3 w-3 text-[#efbd5d]" /> Investment decisions persist</span>
      </div>
    </GameShell>
  );
}

export default TechnologyLab;