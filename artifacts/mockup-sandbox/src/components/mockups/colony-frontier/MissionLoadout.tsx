import { useMemo, useState } from "react";
import {
  Battery,
  Car,
  Check,
  ChevronRight,
  CircleDot,
  Cloud,
  Compass,
  Droplets,
  Factory,
  FlaskConical,
  Home,
  LockKeyhole,
  Pickaxe,
  Plus,
  Radio,
  Shield,
  Sprout,
  Sun,
  Thermometer,
  Wind,
  Wrench,
  Zap,
} from "lucide-react";
import {
  GameShell,
  ProgressBar,
  SectionLabel,
} from "./_shared/GameShell";
import {
  formatCredits,
  payloadProgression,
  technologyTracks,
  type TechnologyTrack,
} from "./_shared/gameData";

const categoryIcons = {
  Solar: Sun,
  Battery,
  Oxygen: Wind,
  Water: Droplets,
  "CO₂": Cloud,
  Thermal: Thermometer,
  Comms: Radio,
  Habitat: Home,
  Radiation: Shield,
  "Power Grid": Zap,
  Science: FlaskConical,
  Navigation: Compass,
  Rover: Car,
  Extraction: Pickaxe,
  ISRU: Factory,
  Agriculture: Sprout,
  Maintenance: Wrench,
} as const;

const starterCategories = new Set([
  "solar",
  "battery",
  "oxygen",
  "water",
  "habitat",
  "comms",
  "navigation",
  "radiation",
]);

const missionCapacity = payloadProgression[0].capacity;
const missionBudget = 25;

function CatalogCard({
  track,
  selected,
  affordable,
  onToggle,
}: {
  track: TechnologyTrack;
  selected: boolean;
  affordable: boolean;
  onToggle: () => void;
}) {
  const equipment = track.tiers.Foundation;
  const Icon =
    categoryIcons[track.category as keyof typeof categoryIcons] ?? Zap;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!selected && !affordable}
      className={`group relative overflow-visible border p-4 text-left transition ${
        selected
          ? "border-[#afc78f] bg-[#172c2d] shadow-[inset_3px_0_0_#efb658]"
          : affordable
            ? "border-[#2d4648] bg-[#0c1a22] shadow-[0_0_12px_rgba(110,200,130,0.18)] hover:border-[#718f80] hover:bg-[#10252a] hover:shadow-[0_0_18px_rgba(110,200,130,0.28)]"
            : "border-[#3a2a2a] bg-[#0c1a22] opacity-65 shadow-[0_0_12px_rgba(200,80,80,0.15)] cursor-not-allowed"
      }`}
      aria-pressed={selected}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center border border-[#3d5552] bg-[#0a171e] text-[#9fce82]">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.19em] text-[#9fce82]">
              {track.category}
            </p>
            <h3 className="mt-1 truncate text-sm font-semibold uppercase tracking-[0.08em] text-[#eef4e9]">
              {equipment.name}
            </h3>
            <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[#779390]">
              Foundation level
            </p>
          </div>
        </div>
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center border ${
            selected
              ? "border-[#efb658] bg-[#efb658] text-[#162127]"
              : affordable
                ? "border-[#49615d] text-[#67817e]"
                : "border-[#5a3030] text-[#805050]"
          }`}
        >
          {selected ? (
            <Check className="h-3.5 w-3.5" />
          ) : affordable ? (
            <Plus className="h-3.5 w-3.5" />
          ) : (
            <LockKeyhole className="h-3 w-3" />
          )}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3 border-t border-[#2c4445] pt-3 text-[9px] uppercase tracking-[0.14em] text-[#89a39e]">
        <span>{equipment.mass.toLocaleString()} kg</span>
        <span>{formatCredits(equipment.cost)}</span>
        <span
          className={`ml-auto ${
            selected || affordable ? "text-[#617b78]" : "text-[#805050]"
          }`}
        >
          {selected ? "Loaded" : affordable ? "Optional" : "Over budget"}
        </span>
      </div>
      <div className="pointer-events-none absolute left-4 right-4 top-[calc(100%-1px)] z-30 hidden border border-[#6f8058] bg-[#162d30] p-4 shadow-[0_18px_38px_rgba(0,0,0,0.42)] group-hover:block">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#efb658]">
          Foundation field brief
        </p>
        <p className="mt-2 text-xs leading-5 text-[#c1d1bd]">
          {equipment.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[9px] uppercase tracking-[0.12em] text-[#8da8a0]">
          <span>{equipment.efficiency}</span>
          <span>{equipment.mass.toLocaleString()} kg</span>
          <span>{formatCredits(equipment.cost)}</span>
        </div>
      </div>
    </button>
  );
}

export function MissionLoadout() {
  const [selected, setSelected] = useState<string[]>([
    ...starterCategories,
  ]);
  const [notice, setNotice] = useState(
    "Mission 01 begins with reliable Foundation systems. Optional systems can be added while capacity holds.",
  );
  const [confirmed, setConfirmed] = useState(false);

  const selectedTracks = useMemo(
    () => technologyTracks.filter((track) => selected.includes(track.id)),
    [selected],
  );
  const mass = selectedTracks.reduce(
    (total, track) => total + track.tiers.Foundation.mass,
    0,
  );
  const spend = selectedTracks.reduce(
    (total, track) => total + track.tiers.Foundation.cost,
    0,
  );
  const remainingMass = missionCapacity - mass;
  const remainingCredits = missionBudget - spend;

  function toggleTrack(track: TechnologyTrack) {
    const isCurrentlySelected = selected.includes(track.id);
    if (!isCurrentlySelected) {
      const newSpend = spend + track.tiers.Foundation.cost;
      if (newSpend > missionBudget) {
        setNotice(`${track.category} exceeds the remaining budget of ${formatCredits(missionBudget - spend)}.`);
        return;
      }
    }
    setSelected((current) =>
      current.includes(track.id)
        ? current.filter((id) => id !== track.id)
        : [...current, track.id],
    );
    setConfirmed(false);
    setNotice(
      isCurrentlySelected
        ? `${track.category} removed from the Mission 01 manifest.`
        : `${track.tiers.Foundation.name} staged in the ${track.category} slot.`,
    );
  }

  function confirmManifest() {
    if (mass > missionCapacity || spend > missionBudget || selected.length === 0) {
      setNotice("Manifest exceeds the current Early Moon capacity or mission budget.");
      return;
    }
    setConfirmed(true);
    setNotice("Mission 01 manifest sealed. Flight Director review required.");
  }

  return (
    <GameShell
      active="loadout"
      eyebrow="Moon Mission 01 / Survival"
      title="Mission Loadout"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-[#344a47] bg-[#102128] px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center border border-[#8f6a42] bg-[#34271e] text-[#efb658]">
                <Sun className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#efb658]">
                  Early Moon / 8,000 kg payload
                </p>
                <p className="mt-1 text-xs text-[#9cb2aa]">
                  Mission 01 · Survival · all Foundation systems available
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 border-l border-[#38504c] pl-4 text-[10px] uppercase tracking-[0.18em] text-[#d1dfbf]">
              <CircleDot className="h-3.5 w-3.5 text-[#70d0a5]" /> One per category
            </div>
          </div>

          <div className="mb-3 flex items-end justify-between">
            <div>
              <SectionLabel>Foundation equipment catalog</SectionLabel>
              <p className="text-sm text-[#8fa7a2]">
                Select at most one system from each category. Hover any card for
                efficiency and procurement details.
              </p>
            </div>
            <span className="text-right text-[10px] uppercase tracking-[0.18em] text-[#6e8986]">
              {selected.length} / {technologyTracks.length} slots loaded
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {technologyTracks.map((track) => {
              const isSelected = selected.includes(track.id);
              const cost = track.tiers.Foundation.cost;
              const affordable = isSelected || spend + cost <= missionBudget;
              return (
                <CatalogCard
                  key={track.id}
                  track={track}
                  selected={isSelected}
                  affordable={affordable}
                  onToggle={() => toggleTrack(track)}
                />
              );
            })}
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="border border-[#a47a42] bg-[#15262b] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
            <div className="flex items-start justify-between border-b border-[#76583c] bg-[#392b20] px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#efb658]">
                  Mission 01 manifest
                </p>
                <h2 className="mt-1 text-lg font-semibold uppercase tracking-[0.12em] text-[#fff0ca]">
                  Survival
                </h2>
              </div>
              <LockKeyhole className="h-4 w-4 text-[#efb658]" />
            </div>
            <div className="space-y-6 p-5">
              <div>
                <div className="mb-2 flex items-end justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#9ab1a8]">
                    Payload capacity
                  </span>
                  <span className="font-mono text-sm text-[#f4e7c5]">
                    {mass.toLocaleString()}{" "}
                    <span className="text-[#839993]">
                      / {missionCapacity.toLocaleString()} kg
                    </span>
                  </span>
                </div>
                <ProgressBar
                  value={Math.min(100, Math.round((mass / missionCapacity) * 100))}
                  color="#efb658"
                />
                <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.15em] text-[#758e89]">
                  <span>{remainingMass.toLocaleString()} kg remaining</span>
                  <span>{Math.round((mass / missionCapacity) * 100)}% loaded</span>
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-end justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#9ab1a8]">
                    Mission budget
                  </span>
                  <span className="font-mono text-sm text-[#f4e7c5]">
                    {formatCredits(Math.max(0, remainingCredits))}{" "}
                    <span className="text-[#839993]">remaining</span>
                  </span>
                </div>
                <ProgressBar
                  value={Math.min(100, Math.round((spend / missionBudget) * 100))}
                  color="#d792e9"
                />
                <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.15em] text-[#758e89]">
                  <span>{formatCredits(spend)} committed</span>
                  <span>of {formatCredits(missionBudget)}</span>
                </div>
              </div>
              <div className="border-t border-[#304949] pt-5">
                <SectionLabel>Loaded Foundation systems</SectionLabel>
                <div className="max-h-52 space-y-3 overflow-y-auto pr-1">
                  {selectedTracks.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-2 text-[#c3d3c1]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#9fce82]" />
                        {track.category}
                      </span>
                      <span className="font-mono text-[#859f99]">
                        {track.tiers.Foundation.mass.toLocaleString()} kg
                      </span>
                    </div>
                  ))}
                  {!selectedTracks.length && (
                    <p className="text-xs text-[#78918e]">
                      No systems loaded. Mission cannot launch.
                    </p>
                  )}
                </div>
              </div>
              {notice && (
                <p className="border border-[#4a5c52] bg-[#102022] p-3 text-[11px] leading-5 text-[#98ada2]">
                  {notice}
                </p>
              )}
              <button
                type="button"
                onClick={confirmManifest}
                className={`flex w-full items-center justify-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.24em] transition ${
                  confirmed
                    ? "bg-[#65bd94] text-[#0a1b1c]"
                    : "bg-[#efb658] text-[#172126] hover:bg-[#f6ca76]"
                }`}
              >
                {confirmed ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {confirmed ? "Manifest sealed" : "Review & confirm"}
              </button>
              {confirmed && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmed(false);
                    setNotice("Manifest reopened for engineering changes.");
                  }}
                  className="flex w-full items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#8fa9a2] hover:text-[#e7f0df]"
                >
                  Reopen manifest
                </button>
              )}
            </div>
          </div>

          <section className="border border-[#29434a] bg-[#0d2028] p-5">
            <SectionLabel>Payload progression</SectionLabel>
            <div className="space-y-3">
              {payloadProgression.map((step, index) => (
                <div
                  key={step.phase}
                  className={`flex items-center justify-between border-b border-[#29434a] pb-3 last:border-0 last:pb-0 ${
                    index === 0 ? "text-[#dfeacb]" : "text-[#718b8c]"
                  }`}
                >
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em]">
                      {step.phase}
                    </p>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.1em]">
                      {step.unlock}
                    </p>
                  </div>
                  <span className="font-mono text-xs">
                    {step.capacity.toLocaleString()} kg
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </GameShell>
  );
}

export default MissionLoadout;