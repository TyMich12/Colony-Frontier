import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleDot,
  Cpu,
  Droplets,
  FlaskConical,
  Gauge,
  LockKeyhole,
  Minus,
  Orbit,
  Plus,
  Radio,
  ShieldAlert,
  Sparkles,
  Sun,
  Wind,
  Zap,
} from "lucide-react";
import { GameShell, ProgressBar, SectionLabel } from "./_shared/GameShell";

type Category = "Power" | "Energy" | "Oxygen" | "Water" | "Habitat" | "Comms" | "Science";

type System = {
  category: Category;
  name: string;
  detail: string;
  weight: number;
  cost: number;
  icon: typeof Sun;
  accent: string;
  selected?: boolean;
  locked?: boolean;
};

const systems: System[] = [
  {
    category: "Power",
    name: "Helios-X Array",
    detail: "Fold-out photovoltaic truss / 18.6 kW nominal",
    weight: 1250,
    cost: 6.5,
    icon: Sun,
    accent: "#f3bb5d",
    selected: true,
  },
  {
    category: "Energy",
    name: "Atlas-L Battery Pack",
    detail: "Radiation-hardened reserve / 42 kWh capacity",
    weight: 1050,
    cost: 5,
    icon: Zap,
    accent: "#e2a2ff",
    selected: true,
  },
  {
    category: "Oxygen",
    name: "AeroLife-1",
    detail: "Closed-loop scrubber / 90 day rated",
    weight: 420,
    cost: 2,
    icon: Wind,
    accent: "#73d9cf",
    selected: true,
  },
  {
    category: "Water",
    name: "AquaLoop-1",
    detail: "Condensate reclamation / 96% recovery",
    weight: 380,
    cost: 1.8,
    icon: Droplets,
    accent: "#70b9ed",
    selected: true,
  },
  {
    category: "Habitat",
    name: "Haven Shell",
    detail: "Inflatable shelter / 4 crew rated",
    weight: 2150,
    cost: 4.2,
    icon: Orbit,
    accent: "#d5dfae",
  },
  {
    category: "Comms",
    name: "Longreach-7",
    detail: "Deep-space relay / 2.4 AU line of sight",
    weight: 680,
    cost: 1.4,
    icon: Radio,
    accent: "#f08a87",
  },
  {
    category: "Science",
    name: "RadSpec Array",
    detail: "Radiation mapping / event telemetry",
    weight: 510,
    cost: 1.2,
    icon: FlaskConical,
    accent: "#b4a5ff",
  },
];

const formatMoney = (value: number) => `$${value.toFixed(value % 1 ? 1 : 0)}M`;
const VEHICLE_BASE_WEIGHT = 7900;
const MISSION_CREDIT_ALLOCATION = 34.7;

export function MissionLoadout() {
  const [selected, setSelected] = useState<string[]>(
    systems.filter((system) => system.selected).map((system) => system.category),
  );
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const selectedSystems = useMemo(
    () => systems.filter((system) => selected.includes(system.category)),
    [selected],
  );
  const weight = VEHICLE_BASE_WEIGHT + selectedSystems.reduce((total, system) => total + system.weight, 0);
  const spend = selectedSystems.reduce((total, system) => total + system.cost, 0);
  const weightPercent = Math.round((weight / 16000) * 100);
  const spendPercent = Math.round((spend / MISSION_CREDIT_ALLOCATION) * 100);
  const remainingWeight = 16000 - weight;
  const remainingCredits = MISSION_CREDIT_ALLOCATION - spend;

  function toggleSystem(system: System) {
    if (system.locked) return;
    if (selected.includes(system.category)) {
      setSelected((current) => current.filter((category) => category !== system.category));
      setNotice(`${system.category} system removed from manifest.`);
      setConfirmed(false);
      return;
    }
    setSelected((current) => [...current, system.category]);
    setNotice(`${system.name} staged. One ${system.category} system now occupies the slot.`);
    setConfirmed(false);
  }

  function confirmManifest() {
    setConfirmed(true);
    setNotice("Manifest sealed. Flight Director review required before launch.");
  }

  return (
    <GameShell active="loadout" eyebrow="Mission 06 / Radiation Event" title="Mission Loadout">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-[#344a47] bg-[#102128] px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center border border-[#8f6a42] bg-[#34271e] text-[#efb658]">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#efb658]">Launch window T−18:42:09</p>
                <p className="mt-1 text-xs text-[#9cb2aa]">Radiation event corridor · crewed insertion authorized</p>
              </div>
            </div>
            <div className="flex items-center gap-2 border-l border-[#38504c] pl-4 text-[10px] uppercase tracking-[0.18em] text-[#d1dfbf]">
              <CircleDot className="h-3.5 w-3.5 text-[#70d0a5]" /> One per category
            </div>
          </div>

          <div className="mb-3 flex items-end justify-between">
            <div>
              <SectionLabel>Core mission systems</SectionLabel>
              <p className="text-sm text-[#8fa7a2]">Select at most one system from each engineering category.</p>
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#6e8986]">{selected.length} / 7 slots committed</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {systems.map((system) => {
              const Icon = system.icon;
              const isSelected = selected.includes(system.category);
              return (
                <button
                  type="button"
                  key={system.category}
                  onClick={() => toggleSystem(system)}
                  className={`group relative overflow-hidden border p-4 text-left transition ${
                    isSelected
                      ? "border-[#afc78f] bg-[#172c2d] shadow-[inset_3px_0_0_#efb658]"
                      : "border-[#2d4648] bg-[#0c1a22] hover:border-[#718f80] hover:bg-[#10252a]"
                  }`}
                >
                  <div className="absolute right-0 top-0 h-16 w-16 translate-x-5 -translate-y-5 rounded-full opacity-10 blur-2xl" style={{ backgroundColor: system.accent }} />
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center border border-[#3d5552] bg-[#0a171e]" style={{ color: system.accent }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: system.accent }}>{system.category}</p>
                        <h3 className="mt-1 text-sm font-semibold uppercase tracking-[0.09em] text-[#eef4e9]">{system.name}</h3>
                        <p className="mt-1 max-w-[230px] text-[11px] leading-5 text-[#7f9a98]">{system.detail}</p>
                      </div>
                    </div>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center border ${isSelected ? "border-[#efb658] bg-[#efb658] text-[#162127]" : "border-[#49615d] text-[#67817e]"}`}>
                      {isSelected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </span>
                  </div>
                  <div className="relative mt-4 flex items-center gap-4 border-t border-[#2c4445] pt-3 text-[10px] uppercase tracking-[0.16em] text-[#89a39e]">
                    <span className="flex items-center gap-1.5"><Gauge className="h-3 w-3" /> {system.weight.toLocaleString()} KG</span>
                    <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> {formatMoney(system.cost)}</span>
                    <span className="ml-auto text-[#617b78]">{isSelected ? "Committed" : "Available"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="border border-[#a47a42] bg-[#15262b] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
            <div className="flex items-start justify-between border-b border-[#76583c] bg-[#392b20] px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#efb658]">Manifest ledger</p>
                <h2 className="mt-1 text-lg font-semibold uppercase tracking-[0.12em] text-[#fff0ca]">06 / Radiation Event</h2>
              </div>
              <LockKeyhole className="h-4 w-4 text-[#efb658]" />
            </div>
            <div className="space-y-6 p-5">
              <div>
                <div className="mb-2 flex items-end justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#9ab1a8]">Launch capacity</span>
                  <span className="font-mono text-sm text-[#f4e7c5]">{weight.toLocaleString()} <span className="text-[#839993]">/ 16,000 kg</span></span>
                </div>
                <ProgressBar value={weightPercent} color="#efb658" />
                <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.15em] text-[#758e89]">
                  <span>{remainingWeight.toLocaleString()} kg remaining</span><span>{weightPercent}% loaded</span>
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-end justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#9ab1a8]">Mission credits</span>
                  <span className="font-mono text-sm text-[#f4e7c5]">{formatMoney(remainingCredits)} <span className="text-[#839993]">remaining</span></span>
                </div>
                <ProgressBar value={spendPercent} color="#d792e9" />
                <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.15em] text-[#758e89]">
                  <span>{formatMoney(spend)} committed</span><span>of $34.7M allocation</span>
                </div>
              </div>
              <div className="border-t border-[#304949] pt-5">
                <SectionLabel>Committed systems</SectionLabel>
                <div className="space-y-3">
                  {selectedSystems.map((system) => (
                    <div key={system.category} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-[#c3d3c1]"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: system.accent }} />{system.category}</span>
                      <span className="font-mono text-[#859f99]">{system.weight.toLocaleString()} kg</span>
                    </div>
                  ))}
                  {!selectedSystems.length && <p className="text-xs text-[#78918e]">No systems committed. Mission cannot launch.</p>}
                </div>
              </div>
              <div className="border border-[#4a5c52] bg-[#102022] p-3 text-[11px] leading-5 text-[#98ada2]">
                <div className="mb-1 flex items-center gap-2 text-[#efb658]"><AlertTriangle className="h-3.5 w-3.5" /> Radiation note</div>
                Shielding reserve is not optional. Habitat and comms remain selectable while capacity holds.
              </div>
              {notice && <div className="flex items-start gap-2 text-[11px] leading-5 text-[#d6e1c0]"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#efb658]" />{notice}</div>}
              <button
                type="button"
                onClick={confirmManifest}
                disabled={selected.length === 0}
                className={`flex w-full items-center justify-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.24em] transition ${confirmed ? "bg-[#65bd94] text-[#0a1b1c]" : "bg-[#efb658] text-[#172126] hover:bg-[#f6ca76]"} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {confirmed ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {confirmed ? "Manifest sealed" : "Review & confirm"}
              </button>
              {confirmed && <button type="button" onClick={() => { setConfirmed(false); setNotice("Manifest reopened for engineering changes."); }} className="flex w-full items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#8fa9a2] hover:text-[#e7f0df]"><Minus className="h-3 w-3" /> Reopen manifest</button>}
            </div>
          </div>
        </aside>
      </div>
    </GameShell>
  );
}

export default MissionLoadout;