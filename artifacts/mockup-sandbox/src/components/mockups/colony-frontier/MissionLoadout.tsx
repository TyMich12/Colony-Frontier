import { useMemo, useState } from "react";
import {
  Battery,
  Car,
  Check,
  ChevronDown,
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
  tierMeta,
  tierUnlockRequirements,
  type TechnologyTrack,
  type Tier,
} from "./_shared/gameData";
import { loadGameState, saveGameState } from "./gameState";

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

const tierOrder: Tier[] = [
  "Foundation",
  "Frontier",
  "Apex",
  "Research",
];

function technologyKey(trackId: string, tier: Tier) {
  return `${trackId}:${tier}`;
}

function isTierUnlocked(
  track: TechnologyTrack,
  tier: Tier,
  unlockedTechnologies: string[],
) {
  if (tier === "Foundation") {
    return true;
  }

  return unlockedTechnologies.includes(technologyKey(track.id, tier));
}

function getTierStatus(
  track: TechnologyTrack,
  tier: Tier,
  gameState: ReturnType<typeof loadGameState>,
  availableCredits: number,
  availableMass: number,
) {
  if (!isTierUnlocked(track, tier, gameState.unlockedTechnologies)) {
    return "locked";
  }

  const equipment = track.tiers[tier];

  if (equipment.cost > availableCredits) {
    return "funds";
  }

  if (equipment.mass > availableMass) {
    return "mass";
  }

  return "available";
}

function CategoryHeader({
  track,
  selectedTier,
  open,
  required,
  categoryBlocked,
  onClick,
}: {
  track: TechnologyTrack;
  selectedTier?: Tier;
  open: boolean;
  required: boolean;
  categoryBlocked: boolean;
  onClick: () => void;
}) {
  const Icon =
    categoryIcons[track.category as keyof typeof categoryIcons] ?? Zap;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between border p-4 text-left transition ${
        categoryBlocked
          ? "border-[#9a4b4b] bg-[#261719] hover:border-[#c96767]"
          : required
            ? "border-[#3f83a8] bg-[#102936] hover:border-[#5ca8d1]"
            : open
              ? "border-[#afc78f] bg-[#172c2d] shadow-[inset_3px_0_0_#efb658]"
              : selectedTier
                ? "border-[#3e5b55] bg-[#102228] hover:border-[#718f80]"
                : "border-[#2d4648] bg-[#0c1a22] hover:border-[#718f80] hover:bg-[#10252a]"
      }`}
      aria-expanded={open}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center border border-[#3d5552] bg-[#0a171e] text-[#9fce82]">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#9fce82]">
            Technology category
          </p>

          <h3 className="mt-1 text-sm font-semibold uppercase tracking-[0.12em] text-[#eef4e9]">
            {track.category}
          </h3>

          <p className="mt-1 text-[9px] uppercase tracking-[0.13em] text-[#779390]">
            {selectedTier
              ? `${selectedTier} tier selected`
              : "No system loaded"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {selectedTier && (
          <span className="hidden border border-[#49615d] bg-[#0a171e] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-[#9fce82] sm:inline">
            Loaded
          </span>
        )}

        {open ? (
          <ChevronDown className="h-4 w-4 text-[#efb658]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#67817e]" />
        )}
      </div>
    </button>
  );
}

function TierOption({
  track,
  tier,
  selected,
  status,
  onSelect,
}: {
  track: TechnologyTrack;
  tier: Tier;
  selected: boolean;
  status: "locked" | "funds" | "mass" | "available";
  onSelect: () => void;
}) {
  const equipment = track.tiers[tier];
  const meta = tierMeta[tier];
  const requirement = tierUnlockRequirements[tier];

  const disabled = status === "locked" || status === "mass";

  const statusLabel =
    selected
      ? "SELECTED — CLICK TO DESELECT"
      : status === "locked"
        ? tier === "Research"
          ? `LOCKED — Requires ${requirement.xp.toLocaleString()} XP + ${requirement.tokens} RT in Technology Lab`
          : `LOCKED — Requires ${requirement.xp.toLocaleString()} XP in Technology Lab`
        : status === "funds"
          ? "INSUFFICIENT FUNDS / MISSION ALLOCATION"
          : status === "mass"
            ? "EXCEEDS MISSION PAYLOAD CAPACITY"
            : "AVAILABLE";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`group relative w-full border p-4 text-left transition ${
        selected
          ? "border-[#efb658] bg-[#26332c] shadow-[inset_3px_0_0_#efb658]"
          : status === "available"
            ? "border-[#2d4648] bg-[#0c1a22] hover:border-[#718f80] hover:bg-[#10252a]"
            : "border-[#8b4545] bg-[#241719]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center border bg-[#0a171e]"
            style={{
              borderColor: selected ? meta.color : "#3d5552",
              color: meta.color,
            }}
          >
            <span className="text-[8px] font-black tracking-[0.08em]">
              {meta.short}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#9fce82]">
                {tier}
              </p>

              {tier === "Foundation" && (
                <span className="text-[8px] uppercase tracking-[0.12em] text-[#607976]">
                  Base technology
                </span>
              )}
            </div>

            <h4 className="mt-1 truncate text-sm font-semibold uppercase tracking-[0.08em] text-[#eef4e9]">
              {equipment.name}
            </h4>

            <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[#779390]">
              {equipment.description}
            </p>
          </div>
        </div>

        <span
          className={`grid h-7 w-7 shrink-0 place-items-center border ${
            selected
              ? "border-[#efb658] bg-[#efb658] text-[#162127]"
              : status === "available"
                ? "border-[#49615d] text-[#67817e]"
                : "border-[#5a3030] text-[#805050]"
          }`}
        >
          {selected ? (
            <Check className="h-3.5 w-3.5" />
          ) : status === "available" ? (
            <CircleDot className="h-3.5 w-3.5" />
          ) : (
            <LockKeyhole className="h-3 w-3" />
          )}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-[#2c4445] pt-3 text-[9px] uppercase tracking-[0.14em]">
        <span className="text-[#89a39e]">{equipment.efficiency}</span>
        <span className="text-[#89a39e]">
          {equipment.mass.toLocaleString()} kg
        </span>
        <span className="font-mono text-[#d7e3d1]">
          {formatCredits(equipment.cost)}
        </span>
      </div>

      <div
        className={`mt-3 text-[8px] font-bold uppercase tracking-[0.13em] ${
          selected || status === "available"
            ? "text-[#78bb92]"
            : "text-[#c46c6c]"
        }`}
      >
        {statusLabel}
      </div>

      <div className="pointer-events-none absolute left-4 right-4 top-[calc(100%-1px)] z-50 hidden border border-[#6f8058] bg-[#162d30] p-4 shadow-[0_18px_38px_rgba(0,0,0,0.42)] group-hover:block">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#efb658]">
          {tier} field brief
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
  const gameState = loadGameState();

  const [selected, setSelected] = useState<Record<string, Tier>>(
    () =>
      Object.fromEntries(
        [...starterCategories].map((id) => [id, "Foundation"]),
      ) as Record<string, Tier>,
  );

  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [notice, setNotice] = useState(
    "Mission 01 begins with reliable Foundation systems. Open a category to choose its technology tier.",
  );
  const [confirmed, setConfirmed] = useState(false);

  const selectedTracks = useMemo(
    () =>
      technologyTracks.filter(
        (track) => selected[track.id] !== undefined,
      ),
    [selected],
  );

  const mass = selectedTracks.reduce((total, track) => {
    const tier = selected[track.id];
    return total + track.tiers[tier].mass;
  }, 0);

  const spend = selectedTracks.reduce((total, track) => {
    const tier = selected[track.id];
    return total + track.tiers[tier].cost;
  }, 0);

  const remainingMass = missionCapacity - mass;
  const remainingMissionBudget = missionBudget - spend;
  const remainingTreasury = gameState.credits - spend;
  const requiredCategories = starterCategories;

  function selectTier(track: TechnologyTrack, tier: Tier) {
    const previousTier = selected[track.id];

    if (previousTier === tier) {
      if (starterCategories.has(track.id)) {
        setNotice(`${track.category} is required for Mission 01 and cannot be deselected.`);
        return;
      }

      setSelected((current) => {
        const next = { ...current };
        delete next[track.id];
        return next;
      });
      setConfirmed(false);
      setNotice(
        `${track.category} cleared. Select a technology tier when you are ready.`,
      );
      return;
    }

    if (!isTierUnlocked(track, tier, gameState.unlockedTechnologies)) {
      setNotice(
        `${track.category} / ${tier} is not unlocked. Upgrade this technology in the Technology Lab first.`,
      );
      return;
    }

    const previousEquipment = previousTier
      ? track.tiers[previousTier]
      : null;
    const nextEquipment = track.tiers[tier];

    const newSpend = spend - (previousEquipment?.cost ?? 0) + nextEquipment.cost;
    const newMass =
      mass - (previousEquipment?.mass ?? 0) + nextEquipment.mass;

    if (newSpend > missionBudget) {
      setNotice(
        `${track.category} / ${tier} exceeds the remaining Mission 01 allocation of ${formatCredits(
          Math.max(0, missionBudget - (spend - (previousEquipment?.cost ?? 0))),
        )}.`,
      );
      return;
    }

    if (newSpend > gameState.credits) {
      setNotice(
        `${track.category} / ${tier} requires ${formatCredits(nextEquipment.cost)}, but your Colony Treasury only has ${formatCredits(
          Math.max(0, gameState.credits - (spend - (previousEquipment?.cost ?? 0))),
        )} available for this change.`,
      );
      return;
    }

    if (newMass > missionCapacity) {
      setNotice(
        `${track.category} / ${tier} exceeds the remaining payload capacity by ${(
          newMass - missionCapacity
        ).toLocaleString()} kg.`,
      );
      return;
    }

    setSelected((current) => ({
      ...current,
      [track.id]: tier,
    }));

    setConfirmed(false);
    setNotice(
      `${nextEquipment.name} selected for the ${track.category} slot. XP and Research Tokens are not spent in Loadout.`,
    );
  }

  function categoryIsBlocked(track: TechnologyTrack) {
    const previousTier = selected[track.id];
    const previousEquipment = previousTier ? track.tiers[previousTier] : null;
    const availableCredits =
      gameState.credits - (spend - (previousEquipment?.cost ?? 0));
    const availableMass =
      missionCapacity - (mass - (previousEquipment?.mass ?? 0));

    return tierOrder.every((tier) => {
      const status = getTierStatus(
        track,
        tier,
        gameState,
        availableCredits,
        availableMass,
      );
      return status !== "available";
    });
  }

  function openTrack(track: TechnologyTrack) {
    setOpenCategory((current) =>
      current === track.id ? null : track.id,
    );

    setNotice(
      openCategory === track.id
        ? "Technology catalog restored. Select another category when ready."
        : `${track.category} expanded. Other categories are hidden while you configure this slot.`,
    );
  }

  function confirmManifest() {
    if (selectedTracks.length === 0) {
      setNotice("No systems are loaded. Mission cannot deploy.");
      return;
    }

    if (
      [...requiredCategories].some(
        (categoryId) => selected[categoryId] === undefined,
      )
    ) {
      setNotice("All required Mission 01 systems must have a technology tier selected.");
      return;
    }

    if (mass > missionCapacity) {
      setNotice("Manifest exceeds the Early Moon payload capacity.");
      return;
    }

    if (spend > missionBudget) {
      setNotice("Manifest exceeds the Mission 01 allocation.");
      return;
    }

    if (spend > gameState.credits) {
      setNotice(
        `Manifest requires ${formatCredits(
          spend,
        )}, but the Colony Treasury contains only ${formatCredits(
          gameState.credits,
        )}.`,
      );
      return;
    }

    saveGameState({
      ...gameState,
      credits: gameState.credits - spend,
    });

    setConfirmed(true);
    setNotice(
      `Mission 01 manifest deployed. ${formatCredits(
        spend,
      )} transferred from the Colony Treasury.`,
    );
  }

  const visibleTracks = openCategory
    ? technologyTracks.filter((track) => track.id === openCategory)
    : technologyTracks;

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
                  Mission 01 · Survival · choose one technology tier per category
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 border-l border-[#38504c] pl-4 text-[10px] uppercase tracking-[0.18em] text-[#d1dfbf]">
              <CircleDot className="h-3.5 w-3.5 text-[#70d0a5]" />
              {openCategory ? "Category configuration" : "One per category"}
            </div>
          </div>

          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <SectionLabel>Technology loadout catalog</SectionLabel>
              <p className="text-sm text-[#8fa7a2]">
                {openCategory
                  ? "Configure this category. All other categories are hidden until you close it."
                  : "Select a category to configure its technology tier. Only one tier can be deployed per category."}
              </p>
            </div>

            <span className="shrink-0 text-right text-[10px] uppercase tracking-[0.18em] text-[#6e8986]">
              {selectedTracks.length} / {technologyTracks.length} slots loaded
            </span>
          </div>

          <div className="space-y-3">
            {visibleTracks.map((track) => {
              const selectedTier = selected[track.id];

              return (
                <div key={track.id} className="space-y-2">
                  <CategoryHeader
                    track={track}
                    selectedTier={selectedTier}
                    open={openCategory === track.id}
                    required={requiredCategories.has(track.id)}
                    categoryBlocked={categoryIsBlocked(track)}
                    onClick={() => openTrack(track)}
                  />

                  {openCategory === track.id && (
                    <div className="grid gap-2 border border-[#29434a] bg-[#09161d] p-2 md:grid-cols-2">
                      {tierOrder.map((tier) => {
                        const previousTier = selected[track.id];
                        const previousEquipment = previousTier
                          ? track.tiers[previousTier]
                          : null;

                        const availableTreasury =
                          gameState.credits -
                          (spend - (previousEquipment?.cost ?? 0));

                        const availableMissionBudget =
                          missionBudget -
                          (spend - (previousEquipment?.cost ?? 0));

                        const availableCredits = Math.min(
                          availableTreasury,
                          availableMissionBudget,
                        );

                        const availableMass =
                          missionCapacity -
                          (mass - (previousEquipment?.mass ?? 0));

                        const status = getTierStatus(
                          track,
                          tier,
                          gameState,
                          availableCredits,
                          availableMass,
                        );

                        return (
                          <TierOption
                            key={tier}
                            track={track}
                            tier={tier}
                            selected={selectedTier === tier}
                            status={status}
                            onSelect={() => selectTier(track, tier)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {openCategory && (
            <button
              type="button"
              onClick={() => setOpenCategory(null)}
              className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8fa9a2] hover:text-[#efb658]"
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              Return to full technology catalog
            </button>
          )}
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
              <div className="border border-[#3b5048] bg-[#0d1d22] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9ab1a8]">
                    Colony Treasury
                  </span>
                  <span className="font-mono text-lg font-bold text-[#efb658]">
                    {formatCredits(gameState.credits)}
                  </span>
                </div>
                <p className="mt-2 text-[9px] uppercase tracking-[0.12em] text-[#6f8985]">
                  Available before deployment
                </p>
              </div>

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
                  value={Math.min(
                    100,
                    Math.round((mass / missionCapacity) * 100),
                  )}
                  color="#efb658"
                />
                <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.15em] text-[#758e89]">
                  <span>
                    {Math.max(0, remainingMass).toLocaleString()} kg remaining
                  </span>
                  <span>
                    {Math.round((mass / missionCapacity) * 100)}% loaded
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-end justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#9ab1a8]">
                    Mission allocation
                  </span>
                  <span className="font-mono text-sm text-[#f4e7c5]">
                    {formatCredits(Math.max(0, remainingMissionBudget))}{" "}
                    <span className="text-[#839993]">remaining</span>
                  </span>
                </div>
                <ProgressBar
                  value={Math.min(
                    100,
                    Math.round((spend / missionBudget) * 100),
                  )}
                  color="#d792e9"
                />
                <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.15em] text-[#758e89]">
                  <span>{formatCredits(spend)} committed</span>
                  <span>of {formatCredits(missionBudget)}</span>
                </div>
              </div>

              <div className="border border-[#304949] bg-[#101f23] p-4">
                <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.2em] text-[#718f80]">
                  Deployment finances
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#8fa7a2]">Current loadout</span>
                    <span className="font-mono text-[#dfe8d9]">
                      {formatCredits(spend)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8fa7a2]">
                      Treasury after deployment
                    </span>
                    <span
                      className={`font-mono ${
                        remainingTreasury < 0
                          ? "text-[#d87979]"
                          : "text-[#9fce82]"
                      }`}
                    >
                      {formatCredits(Math.max(0, remainingTreasury))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#304949] pt-5">
                <SectionLabel>Loaded technology systems</SectionLabel>
                <div className="max-h-60 space-y-3 overflow-y-auto pr-1">
                  {selectedTracks.map((track) => {
                    const tier = selected[track.id];
                    const equipment = track.tiers[tier];

                    return (
                      <div
                        key={track.id}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="min-w-0 text-[#c3d3c1]">
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9fce82]" />
                            <span className="truncate">{track.category}</span>
                          </span>
                          <span className="ml-3.5 text-[8px] uppercase tracking-[0.12em] text-[#718f80]">
                            {tier} · {equipment.name}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[#859f99]">
                          {equipment.mass.toLocaleString()} kg
                        </span>
                      </div>
                    );
                  })}

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
                disabled={confirmed}
                className={`flex w-full items-center justify-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.24em] transition ${
                  confirmed
                    ? "cursor-default bg-[#65bd94] text-[#0a1b1c]"
                    : "bg-[#efb658] text-[#172126] hover:bg-[#f6ca76]"
                }`}
              >
                {confirmed ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {confirmed ? "Mission deployed" : "Deploy Mission"}
              </button>

              {confirmed && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmed(false);
                    setNotice(
                      "Manifest is locked after deployment. Mission execution is ready.",
                    );
                  }}
                  className="flex w-full items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#8fa9a2] hover:text-[#e7f0df]"
                >
                  Continue to mission execution
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
