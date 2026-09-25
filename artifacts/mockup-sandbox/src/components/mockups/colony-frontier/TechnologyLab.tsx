import { useState } from "react";
import {
  Battery,
  Car,
  Check,
  Cloud,
  Compass,
  Droplets,
  Factory,
  FlaskConical,
  Home,
  LockKeyhole,
  Microscope,
  Pickaxe,
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
  technologyTracks,
  tierMeta,
  tierUnlockRequirements,
  type Equipment,
  type TechnologyTrack,
  type Tier,
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
  Science: Microscope,
  Navigation: Compass,
  Rover: Car,
  Extraction: Pickaxe,
  ISRU: Factory,
  Agriculture: Sprout,
  Maintenance: Wrench,
} as const;

const tierOrder: Tier[] = ["Foundation", "Frontier", "Apex", "Research"];
const currentXp = 0;
const currentTokens = 0;

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-[#76908e]">
        {label}
      </p>
      <p className="font-mono text-xs text-[#d8e3cf]">{value}</p>
    </div>
  );
}

function UnlockCopy({ tier }: { tier: Tier }) {
  const requirement = tierUnlockRequirements[tier];
  if (tier === "Foundation") return <span>Starting technology</span>;
  if (tier === "Research") {
    return (
      <span>
        {requirement.xp.toLocaleString()} XP + research tokens
      </span>
    );
  }
  return <span>{requirement.xp.toLocaleString()} XP</span>;
}

function EquipmentRow({
  tier,
  equipment,
  isUnlocked,
  isSelected,
  onSelect,
}: {
  tier: Tier;
  equipment: Equipment;
  isUnlocked: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const meta = tierMeta[tier];
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!isUnlocked}
      className={`group relative w-full border p-4 text-left transition ${
        isSelected
          ? "border-[#d3e49f] bg-[#182f2f] shadow-[inset_3px_0_0_#efb658]"
          : isUnlocked
            ? "border-[#29434a] bg-[#0d2028] hover:border-[#90b4a2] hover:bg-[#122a2e]"
            : "border-[#29434a] bg-[#0d2028] opacity-60"
      } ${!isUnlocked ? "cursor-not-allowed" : ""}`}
      aria-label={`${equipment.name}, ${tier} tier`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 grid h-8 w-8 place-items-center border text-[10px] font-bold"
            style={{ borderColor: meta.color, color: meta.color }}
          >
            {meta.short}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.22em]"
                style={{ color: meta.color }}
              >
                {tier}
              </span>
              {isUnlocked ? (
                <span className="flex items-center gap-1 text-[8px] uppercase tracking-[0.16em] text-[#9cd0a8]">
                  <Check className="h-3 w-3" /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[8px] uppercase tracking-[0.16em] text-[#a6a796]">
                  <LockKeyhole className="h-3 w-3" /> Locked
                </span>
              )}
            </div>
            <h3 className="mt-1 text-base font-semibold uppercase tracking-[0.1em] text-[#eef3e7]">
              {equipment.name}
            </h3>
            <p className="mt-1 text-[10px] leading-5 text-[#789491]">
              Unlock: <UnlockCopy tier={tier} />
            </p>
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#9bb5ac]">
          {isSelected ? "Selected" : isUnlocked ? "Select" : "Locked"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#29434a] pt-3 sm:grid-cols-4">
        <Metric label="Mass" value={`${equipment.mass.toLocaleString()} kg`} />
        <Metric label="Equipment cost" value={formatCredits(equipment.cost)} />
        <Metric label="Efficiency" value={equipment.efficiency} />
        <Metric label="Slot" value={isSelected ? "Selected" : "Available"} />
      </div>

      <p className="mt-3 border-l-2 border-[#526c5a] bg-[#10252a] px-3 py-2 text-xs leading-5 text-[#a9c0b5]">
        {equipment.description}
      </p>
    </button>
  );
}

export function TechnologyLab() {
  const [selectedId, setSelectedId] = useState("solar");
  const [selectedTier, setSelectedTier] = useState<Tier>("Foundation");
  const selectedTrack =
    technologyTracks.find((track) => track.id === selectedId) ??
    technologyTracks[0];
  const SelectedIcon =
    categoryIcons[selectedTrack.category as keyof typeof categoryIcons] ?? Zap;

  function selectTrack(track: TechnologyTrack) {
    setSelectedId(track.id);
    setSelectedTier("Foundation");
  }

  return (
    <GameShell
      active="lab"
      eyebrow="Research terminal / capability ladder"
      title="Technology Lab"
    >
      <div className="grid gap-7 xl:grid-cols-[245px_minmax(0,1fr)_290px]">
        <aside className="border border-[#29434a] bg-[#0b1a21] p-4">
          <SectionLabel>Technology tracks</SectionLabel>
          <p className="mb-4 text-xs leading-5 text-[#829d99]">
            At Mission 01, every system begins at Foundation level.
          </p>
          <div className="space-y-1.5">
            {technologyTracks.map((track) => {
              const Icon =
                categoryIcons[track.category as keyof typeof categoryIcons] ??
                Zap;
              const active = track.id === selectedTrack.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => selectTrack(track)}
                  className={`flex w-full items-center gap-3 border px-3 py-2.5 text-left transition ${
                    active
                      ? "border-[#738b64] bg-[#18302f] text-[#e5efdb]"
                      : "border-transparent text-[#76918e] hover:border-[#36545a] hover:bg-[#10242a] hover:text-[#d5e5ce]"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? "text-[#efb658]" : "text-[#75918f]"
                    }`}
                  />
                  <span className="min-w-0 flex-1 text-[9px] font-bold uppercase tracking-[0.16em]">
                    {track.category}
                  </span>
                  <Check className="h-3 w-3 text-[#84c89e]" />
                </button>
              );
            })}
          </div>
          <div className="mt-5 border-t border-[#29434a] pt-4">
            <p className="text-[9px] uppercase tracking-[0.18em] text-[#76908e]">
              Starting state
            </p>
            <p className="mt-2 font-mono text-lg text-[#d9e7cf]">17 / 17</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.15em] text-[#86a69a]">
              Foundation systems online
            </p>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#29434a] pb-5">
            <div>
              <SectionLabel>
                {selectedTrack.category} progression · {selectedTrack.shortName}
              </SectionLabel>
              <div className="flex items-center gap-3">
                <SelectedIcon className="h-6 w-6 text-[#efb658]" />
                <h2 className="text-xl font-semibold uppercase tracking-[0.14em] text-[#f0f4e8]">
                  {selectedTrack.description}
                </h2>
              </div>
            </div>
            <div className="border border-[#3d5b50] bg-[#10232a] px-4 py-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-[#76908e]">
                Colony research
              </p>
              <p className="font-mono text-sm text-[#e8efdd]">
                {currentXp.toLocaleString()} XP{" "}
                <span className="text-[#76908e]">· {currentTokens} tokens</span>
              </p>
            </div>
          </div>

          <div className="relative space-y-3">
            <div className="absolute bottom-8 left-5 top-7 w-px bg-gradient-to-b from-[#9fce82] via-[#72b9d4] via-60% to-[#e9a15d]" />
            {tierOrder.map((tier) => {
              const equipment = selectedTrack.tiers[tier];
              const requirement = tierUnlockRequirements[tier];
              const isUnlocked =
                currentXp >= requirement.xp &&
                currentTokens >= requirement.tokens;
              return (
                <EquipmentRow
                  key={tier}
                  tier={tier}
                  equipment={equipment}
                  isUnlocked={isUnlocked}
                  isSelected={selectedTier === tier}
                  onSelect={() => setSelectedTier(tier)}
                />
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="border border-[#67543b] bg-[#171f23] p-5">
            <SectionLabel>Research gate</SectionLabel>
            <h2 className="text-lg font-semibold uppercase tracking-[0.12em] text-[#f1ebd1]">
              Nothing auto-unlocks.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#b6b19d]">
              Mission rewards build XP and Research Tokens. You choose when to
              invest them into a higher tier.
            </p>
            <div className="mt-5 space-y-4 border-t border-[#514635] pt-4">
              <div className="flex justify-between text-[10px] uppercase tracking-[0.16em]">
                <span className="text-[#8e978a]">Experience earned</span>
                <span className="font-mono text-[#f1d47c]">
                  {currentXp.toLocaleString()} XP
                </span>
              </div>
              <div className="flex justify-between text-[10px] uppercase tracking-[0.16em]">
                <span className="text-[#8e978a]">Research tokens earned</span>
                <span className="font-mono text-[#f1d47c]">
                  {currentTokens}
                </span>
              </div>
            </div>
          </section>
          <section className="border border-[#29434a] bg-[#0d2028] p-5">
            <SectionLabel>Tier requirements</SectionLabel>
            <div className="space-y-3">
              {tierOrder.map((tier) => (
                <div
                  key={tier}
                  className="flex items-center justify-between border-b border-[#29434a] pb-3 last:border-0 last:pb-0"
                >
                  <span
                    className="text-[9px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: tierMeta[tier].color }}
                  >
                    {tier}
                  </span>
                  <span className="text-right text-[9px] uppercase tracking-[0.12em] text-[#829b96]">
                    <UnlockCopy tier={tier} />
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
      <div className="mt-7 flex items-center justify-between border-t border-[#29434a] pt-4 text-[9px] uppercase tracking-[0.22em] text-[#657e7e]">
        <span>All details shown inline · no hover popup in the lab</span>
        <span>{selectedTier} selected</span>
      </div>
    </GameShell>
  );
}

export default TechnologyLab;