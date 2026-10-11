import { useMemo, useRef, useState } from "react";
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
import { clearMissionRuntime, clearPendingMission, loadPendingMission, savePendingMission } from "./missionRuntime";
import { marsMissions, moonMissions } from "./CampaignMapRefresh";

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

const minimumDeploymentReserve = technologyTracks.length
  ? Array.from(starterCategories).reduce((total, trackId) => {
      const track = technologyTracks.find((entry) => entry.id === trackId);
      return total + (track?.tiers.Foundation.cost ?? 0);
    }, 0)
  : 0;

function getMissionCapacity(campaign: "moon" | "mars", completedCount: number) {
  if (campaign === "moon") {
    if (completedCount >= 6) return payloadProgression[2].capacity;
    if (completedCount >= 3) return payloadProgression[1].capacity;
    return payloadProgression[0].capacity;
  }

  if (completedCount >= 6) return payloadProgression[5].capacity;
  if (completedCount >= 3) return payloadProgression[4].capacity;
  return payloadProgression[3].capacity;
}

function getNextMission(
  campaign: "moon" | "mars",
  gameState: ReturnType<typeof loadGameState>,
) {
  const missions = campaign === "moon" ? moonMissions : marsMissions;
  return missions.find((mission) => !gameState.completedMissions.includes(campaign + "-" + mission.number)) ?? missions[missions.length - 1];
}

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
  gameState: ReturnType<typeof loadGameState>,
) {
  if (tier === "Foundation") return true;

  const requirement = tierUnlockRequirements[tier];
  const requiredTokens = tier === "Research"
    ? Math.max(requirement.tokens, track.tiers[tier].researchTokens)
    : requirement.tokens;

  // Mission rewards organically open later hardware tiers. The Technology Lab
  // can explicitly unlock them too; a player's tier is never silently upgraded.
  return gameState.unlockedTechnologies.includes(technologyKey(track.id, tier))
    || (gameState.xp >= requirement.xp && gameState.researchTokens >= requiredTokens);
}

function deploymentCost(
  track: TechnologyTrack,
  tier: Tier,
  _unlockedTechnologies: string[],
) {
  // Technology Lab ownership never removes the mission deployment cost.
  // Credits are spent when this equipment is actually loaded onto a mission.
  return track.tiers[tier].cost;
}

function getTierStatus(
  track: TechnologyTrack,
  tier: Tier,
  gameState: ReturnType<typeof loadGameState>,
  availableCredits: number,
  availableMass: number,
) {
  if (!isTierUnlocked(track, tier, gameState)) {
    return "locked";
  }

  const equipment = track.tiers[tier];
  const cost = deploymentCost(
    track,
    tier,
    gameState.unlockedTechnologies,
  );

  if (cost > availableCredits) {
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
  essentialBlocked,
  onClick,
}: {
  track: TechnologyTrack;
  selectedTier?: Tier;
  open: boolean;
  required: boolean;
  categoryBlocked: boolean;
  essentialBlocked: boolean;
  onClick: () => void;
}) {
  const Icon =
    categoryIcons[track.category as keyof typeof categoryIcons] ?? Zap;

  const categoryColor = essentialBlocked
    ? "#ff4d4d"
    : categoryBlocked
      ? "#c46c6c"
      : required
        ? "#72b9d4"
        : "#9fce82";

  const categoryStatus = essentialBlocked
    ? "MISSION BLOCKED — ESSENTIAL SYSTEM UNAVAILABLE"
    : categoryBlocked
      ? "INSUFFICIENT FUNDS — NOTHING AVAILABLE"
      : required
        ? "REQUIRED SYSTEM"
        : "OPTIONAL SYSTEM";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full min-h-[82px] w-full items-center justify-between gap-2 border p-2.5 text-left transition ${
        essentialBlocked
          ? "border-[#ff2f2f] bg-[#3a0b0b] shadow-[0_0_22px_rgba(255,47,47,0.32)] hover:border-[#ff6666]"
          : categoryBlocked
            ? "border-[#8b4545] bg-[#241719] shadow-[0_0_18px_rgba(196,108,108,0.12)] hover:border-[#c46c6c]"
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
      <div className="flex min-w-0 items-center gap-2">
        <div
          className="grid h-8 w-8 shrink-0 place-items-center border bg-[#0a171e]"
          style={{ borderColor: categoryColor, color: categoryColor }}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p
            className="hidden text-[8px] font-bold uppercase tracking-[0.12em] sm:block"
            style={{ color: categoryColor }}
          >
            Technology category
          </p>

          <h3
            className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] sm:text-xs"
            style={{ color: categoryColor }}
          >
            {track.category}
          </h3>

          <p
            className="mt-0.5 line-clamp-2 text-[7px] font-bold uppercase tracking-[0.06em] sm:text-[8px]"
            style={{ color: categoryColor }}
          >
            {categoryStatus}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {selectedTier && (
          <span
            className="hidden border bg-[#0a171e] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.16em] sm:inline"
            style={{ borderColor: categoryColor, color: categoryColor }}
          >
            {selectedTier}
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
  hoverEnabled,
}: {
  track: TechnologyTrack;
  tier: Tier;
  selected: boolean;
  status: "locked" | "funds" | "mass" | "available";
  onSelect: () => void;
  hoverEnabled: boolean;
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
          ? `LOCKED — Requires ${requirement.xp.toLocaleString()} XP + ${equipment.researchTokens} RT in Technology Lab`
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

      <div className={`pointer-events-none absolute left-4 right-4 top-[calc(100%-1px)] z-50 hidden border border-[#6f8058] bg-[#162d30] p-4 shadow-[0_18px_38px_rgba(0,0,0,0.42)] ${
        hoverEnabled ? "group-hover:block" : ""
      }`}>
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


function getAutomaticTier(
  track: TechnologyTrack,
  gameState: ReturnType<typeof loadGameState>,
  availableCredits: number,
  availableMass: number,
) {
  for (let index = tierOrder.length - 1; index >= 0; index -= 1) {
    const tier = tierOrder[index];

    if (!isTierUnlocked(track, tier, gameState)) {
      continue;
    }

    const equipment = track.tiers[tier];

    if (
      equipment.cost <= availableCredits &&
      equipment.mass <= availableMass
    ) {
      return tier;
    }
  }

  return undefined;
}

function createInitialSelection(
  gameState: ReturnType<typeof loadGameState>,
  missionCapacity: number,
) {
  const selection: Record<string, Tier> = {};
  let availableCredits = gameState.credits;
  let availableMass = missionCapacity;

  const requiredTracks = technologyTracks.filter((track) =>
    starterCategories.has(track.id),
  );

  for (let index = 0; index < requiredTracks.length; index += 1) {
    const track = requiredTracks[index];
    const remainingTracks = requiredTracks.slice(index + 1);
    const reservedFoundationCost = remainingTracks.reduce(
      (total, remainingTrack) =>
        total + remainingTrack.tiers.Foundation.cost,
      0,
    );
    const reservedFoundationMass = remainingTracks.reduce(
      (total, remainingTrack) =>
        total + remainingTrack.tiers.Foundation.mass,
      0,
    );

    const tier = getAutomaticTier(
      track,
      gameState,
      Math.max(0, availableCredits - reservedFoundationCost),
      Math.max(0, availableMass - reservedFoundationMass),
    );

    if (tier === undefined) {
      continue;
    }

    selection[track.id] = tier;
    availableCredits -= track.tiers[tier].cost;
    availableMass -= track.tiers[tier].mass;
  }

  return selection;
}

export function MissionLoadout() {
  // An unfinished payload can be reconfigured from here, but only after an explicit second confirmation.
  const activePendingAtStart = loadPendingMission();
  const storedGameState = loadGameState();
  const gameState = activePendingAtStart
    ? { ...storedGameState, credits: storedGameState.credits + activePendingAtStart.spend }
    : storedGameState;
  const params = new URLSearchParams(window.location.search);
  const moonCompletedCount = gameState.completedMissions.filter((id) => id.startsWith("moon-")).length;
  const marsCompletedCount = gameState.completedMissions.filter((id) => id.startsWith("mars-")).length;
  const moonComplete = moonCompletedCount >= moonMissions.length;
  const requestedCampaign =
    params.get("campaign") === "mars" || (!params.get("campaign") && moonComplete)
      ? "mars"
      : "moon";
  const campaign =
    requestedCampaign === "mars" && !moonComplete ? "moon" : requestedCampaign;
  const campaignMissions = campaign === "moon" ? moonMissions : marsMissions;
  const campaignCompletedCount = campaign === "moon" ? moonCompletedCount : marsCompletedCount;
  const requestedMissionNumber = params.get("mission");
  const fallbackMission = getNextMission(campaign, gameState);
  const currentMission = campaignMissions.find((mission) => mission.number === requestedMissionNumber) ?? fallbackMission;
  const currentMissionIndex = campaignMissions.findIndex((mission) => mission.number === currentMission.number);
  const alreadyCompleted = gameState.completedMissions.includes(campaign + "-" + currentMission.number);
  const previousMissionsComplete = campaignMissions.slice(0, currentMissionIndex).every((mission) =>
    gameState.completedMissions.includes(campaign + "-" + mission.number),
  );
  const missionLocked =
    (campaign === "mars" && !moonComplete) ||
    (!alreadyCompleted && !previousMissionsComplete);
  const missionCapacity = getMissionCapacity(campaign, campaignCompletedCount);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const catalogScrollY = useRef(0);
  const deployingRef = useRef(false);

  const [selected, setSelected] = useState<Record<string, Tier>>(() =>
    createInitialSelection(gameState, missionCapacity),
  );
  const [replaceActiveMission, setReplaceActiveMission] = useState(false);

  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [hoverEnabled, setHoverEnabled] = useState(true);
  const [notice, setNotice] = useState(
    "Required systems start with the highest affordable owned technology tiers. Open a category to adjust its loadout.",
  );
  const [confirmed, setConfirmed] = useState(false);
  const [completionNotice, setCompletionNotice] = useState<string | null>(() => {
    const reward = gameState.lastMissionReward;
    if (!reward || reward.missionId !== campaign + "-" + currentMission.number) return null;
    return `MISSION COMPLETE — ${reward.title} · ${formatCredits(reward.credits)} Credits · +${reward.xp.toLocaleString()} XP · +${reward.researchTokens} Research Token${reward.researchTokens === 1 ? "" : "s"}`;
  });

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
    return total + deploymentCost(track, tier, gameState.unlockedTechnologies);
  }, 0);

  const remainingMass = missionCapacity - mass;
  const remainingTreasury = gameState.credits - spend;
  const requiredCategories = starterCategories;
  const blockedEssentialCategories = technologyTracks.filter(
    (track) =>
      requiredCategories.has(track.id) && selected[track.id] === undefined,
  );
  const missionBlocked = missionLocked || blockedEssentialCategories.length > 0;

  function selectTier(track: TechnologyTrack, tier: Tier) {
    setReplaceActiveMission(false);
    const previousTier = selected[track.id];

    if (previousTier === tier) {
      if (starterCategories.has(track.id)) {
        setNotice(`${track.category} is required for the current mission and cannot be deselected.`);
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

    if (!isTierUnlocked(track, tier, gameState)) {
      setNotice(
        `${track.category} / ${tier} is not unlocked. Upgrade this technology in the Technology Lab first.`,
      );
      return;
    }

    const previousEquipment = previousTier
      ? track.tiers[previousTier]
      : null;
    const nextEquipment = track.tiers[tier];

    const previousCost = previousTier
      ? deploymentCost(
          track,
          previousTier,
          gameState.unlockedTechnologies,
        )
      : 0;
    const nextCost = deploymentCost(
      track,
      tier,
      gameState.unlockedTechnologies,
    );
    const newSpend = spend - previousCost + nextCost;
    const newMass =
      mass - (previousEquipment?.mass ?? 0) + nextEquipment.mass;

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
    const previousCost = previousTier
      ? deploymentCost(
          track,
          previousTier,
          gameState.unlockedTechnologies,
        )
      : 0;
    const availableTreasury =
      gameState.credits - (spend - previousCost);
    const availableCredits = availableTreasury;
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
    const closing = openCategory === track.id;

    if (!closing) {
      catalogScrollY.current = window.scrollY;
      setHoverEnabled(false);
    }

    setOpenCategory(closing ? null : track.id);

    if (closing) {
      requestAnimationFrame(() => {
        window.scrollTo({
          top: catalogScrollY.current,
          behavior: "smooth",
        });
      });
    } else {
      requestAnimationFrame(() => {
        const element = categoryRefs.current[track.id];

        if (!element) return;

        const targetY =
          element.getBoundingClientRect().top + window.scrollY - 140;
        const startY = window.scrollY;
        const distance = targetY - startY;

        const duration = Math.min(
          800,
          Math.max(400, Math.abs(distance) * 0.7),
        );

        if (distance === 0) {
          setHoverEnabled(true);
          return;
        }

        const startTime = performance.now();

        const animateScroll = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);

          const eased =
            progress < 0.5
              ? 2 * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 2) / 2;

          window.scrollTo(0, startY + distance * eased);

          if (progress < 1) {
            requestAnimationFrame(animateScroll);
          } else {
            setHoverEnabled(true);
          }
        };

        requestAnimationFrame(animateScroll);
      });
    }

    setNotice(
      closing
        ? "Technology catalog restored. Select another category when ready."
        : `${track.category} expanded. Other categories are hidden while you configure this slot.`,
    );
  }

  function confirmMission() {
    if (deployingRef.current) return;

    const existingPendingMission = loadPendingMission();
    if (existingPendingMission && !replaceActiveMission) {
      setReplaceActiveMission(true);
      setConfirmed(false);
      setNotice(
        `UNFINISHED DEPLOYMENT FOUND — ${existingPendingMission.missionTitle} is still saved. Your current loadout is shown below. Press "Replace & Deploy" once more to abandon that run, recover its loadout credit allocation, and start with the systems selected here.`,
      );
      return;
    }

    if (missionLocked) {
      setNotice(
        campaign === "mars" && !moonComplete
          ? "MISSION LOCKED — complete the Moon campaign before deploying to Mars."
          : "MISSION LOCKED — complete the previous mission before launching this one.",
      );
      return;
    }

    if (blockedEssentialCategories.length > 0) {
      setNotice(
        "MISSION BLOCKED — one or more essential systems cannot be afforded at any purchased technology tier. Downgrade another system or increase the Colony Treasury.",
      );
      return;
    }

    if (selectedTracks.length === 0) {
      setNotice("No systems are loaded. Mission cannot deploy.");
      return;
    }

    if ([...requiredCategories].some((categoryId) => selected[categoryId] === undefined)) {
      setNotice("All required systems for Mission " + currentMission.number + " must have a technology tier selected.");
      return;
    }

    if (mass > missionCapacity) {
      setNotice("Mission exceeds the payload capacity.");
      return;
    }

    if (spend > gameState.credits) {
      setNotice(
        "Mission requires " +
          formatCredits(spend) +
          ", but the Colony Treasury contains only " +
          formatCredits(gameState.credits) +
          ".",
      );
      return;
    }

    const missionId = campaign + "-" + currentMission.number;
    const mission = currentMission;
    const missionCredits = Number.parseFloat(mission.credits.replace(/[$,M]/g, ""));
    const missionXp = Number.parseInt(mission.xp.replace(/[,]/g, ""), 10);
    const missionResearch = Number.parseInt(mission.research.replace(/[^0-9-]/g, ""), 10);
    const replay = alreadyCompleted;
    const rewardCredits = replay ? missionCredits * 0.2 : missionCredits;
    const rewardXp = replay ? missionXp * 0.2 : missionXp;
    const rewardResearch = replay ? 0 : missionResearch;
    const projectedCredits = gameState.credits - spend + rewardCredits;

    if (replay && projectedCredits < minimumDeploymentReserve) {
      setNotice(
        "REPLAY BLOCKED — this loadout would leave the Colony Treasury below the mandatory Foundation reserve of " +
          formatCredits(minimumDeploymentReserve) +
          ". Reduce the loadout cost before replaying.",
      );
      return;
    }

    // Do not discard the previous save until the new loadout has passed every validation.
    if (existingPendingMission && replaceActiveMission) {
      clearPendingMission();
      clearMissionRuntime();
      setReplaceActiveMission(false);
    }

    deployingRef.current = true;

    const pendingMission = {
      missionId,
      campaign,
      missionNumber: currentMission.number,
      missionTitle: mission.title,
      selected: { ...selected },
      spend,
      rewardCredits,
      rewardXp,
      rewardResearchTokens: rewardResearch,
      replay,
      startedAt: Date.now(),
    };

    savePendingMission(pendingMission);

    const nextState = {
      ...gameState,
      credits: gameState.credits - spend,
      lastMissionReward: undefined,
    };

    saveGameState(nextState);
    setConfirmed(true);
    setNotice(
      (replay ? "REPLAY DEPLOYED" : "MISSION DEPLOYED") +
        " — launch systems online. Entering mission simulation...",
    );

    window.setTimeout(() => {
      window.location.href = "/preview/MissionSimulation";
    }, 350);
  }

  const visibleTracks = openCategory
    ? technologyTracks.filter((track) => track.id === openCategory)
    : technologyTracks;

  return (
    <GameShell
      active="loadout"
      eyebrow={`${campaign === "moon" ? "Moon" : "Mars"} Mission ${currentMission.number} / Mission Loadout`}
      title="Mission Loadout"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-[#344a47] bg-[#102128] px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center border border-[#8f6a42] bg-[#34271e] text-[#efb658]">
                {campaign === "moon" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <span className="text-sm font-black text-[#d77a5a]">M</span>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#efb658]">
                  {campaign === "moon" ? "Lunar" : "Martian"} operations / {missionCapacity.toLocaleString()} kg payload
                </p>
                <p className="mt-1 text-xs text-[#9cb2aa]">
                  Mission {currentMission.number} · {currentMission.title} · choose one technology tier per category
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

          <div className={openCategory ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-3"}>
            {visibleTracks.map((track) => {
              const selectedTier = selected[track.id];

              return (
                <div
                  key={track.id}
                  ref={(element) => {
                    categoryRefs.current[track.id] = element;
                  }}
                  className={`min-w-0 space-y-2 scroll-mt-6 ${openCategory === track.id ? "col-span-full" : ""}`}
                >
                  <CategoryHeader
                    track={track}
                    selectedTier={selectedTier}
                    open={openCategory === track.id}
                    required={requiredCategories.has(track.id)}
                    categoryBlocked={categoryIsBlocked(track)}
                    essentialBlocked={
                      requiredCategories.has(track.id) && !selectedTier
                    }
                    onClick={() => {
                      if (categoryIsBlocked(track)) {
                        setNotice(
                          `${track.category} has no affordable technology right now. You can still open the category to view the available tiers.`,
                        );
                      }

                      openTrack(track);
                    }}
                  />

                  {openCategory === track.id && (
                    <div className="grid gap-2 border border-[#29434a] bg-[#09161d] p-2 sm:grid-cols-2 xl:grid-cols-2">
                      {tierOrder.map((tier) => {
                        const previousTier = selected[track.id];
                        const previousCost = previousTier
                          ? deploymentCost(
                              track,
                              previousTier,
                              gameState.unlockedTechnologies,
                            )
                          : 0;

                        const availableTreasury =
                          gameState.credits - (spend - previousCost);

                        const availableCredits = availableTreasury;

                        const previousEquipment = previousTier
                          ? track.tiers[previousTier]
                          : null;

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
                            hoverEnabled={hoverEnabled}
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
          {missionBlocked && (
            <div className="border-2 border-[#ff2f2f] bg-[#3a0808] p-5 shadow-[0_0_30px_rgba(255,47,47,0.28)]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-[#ff2f2f] shadow-[0_0_12px_#ff2f2f]" />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#ff5c5c]">
                    Mission blocked
                  </p>
                  <p className="mt-2 text-sm font-black uppercase tracking-[0.08em] text-[#fff0f0]">
                    Essential systems cannot be fully funded.
                  </p>
                  <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.14em] leading-5 text-[#ff9b9b]">
                    Every required system must have a selected tier before launch. Downgrade a system or increase the Colony Treasury.
                  </p>
                </div>
              </div>
            </div>
          )}

          {completionNotice && (
            <div className="border border-[#78bb92] bg-[#102b25] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.2)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#78bb92]">
                Rewards received
              </p>
              <p className="mt-2 text-sm font-bold uppercase tracking-[0.08em] text-[#e8f3df]">
                {completionNotice}
              </p>
              <p className="mt-2 text-[9px] uppercase tracking-[0.14em] text-[#8faea0]">
                The next mission is now unlocked.
              </p>
            </div>
          )}

          <div className="border border-[#a47a42] bg-[#15262b] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
            <div className="flex items-start justify-between border-b border-[#76583c] bg-[#392b20] px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#efb658]">
                  {campaign} mission
                </p>
                <h2 className="mt-1 text-lg font-semibold uppercase tracking-[0.12em] text-[#fff0ca]">
                  {currentMission.title}
                </h2>
              </div>
              {alreadyCompleted ? (
                <Check className="h-4 w-4 text-[#78bb92]" />
              ) : (
                <LockKeyhole className="h-4 w-4 text-[#efb658]" />
              )}
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

              <div className="border border-[#304949]/ bg-[#101f23] p-4">
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
                onClick={confirmMission}
                disabled={confirmed || missionBlocked}
                className={`flex w-full items-center justify-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.24em] transition ${
                  confirmed
                    ? "cursor-default bg-[#65bd94] text-[#0a1b1c]"
                    : missionBlocked
                      ? "cursor-not-allowed border-2 border-[#ff2f2f] bg-[#4a0b0b] text-[#ff8a8a]"
                      : "bg-[#efb658] text-[#172126] hover:bg-[#f6ca76]"
                }`}
              >
                {confirmed ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {confirmed
                  ? "Mission deployed"
                  : missionLocked
                    ? "Mission locked"
                    : blockedEssentialCategories.length > 0
                      ? "Mission blocked"
                      : replaceActiveMission
                        ? "Replace & Deploy"
                        : alreadyCompleted
                          ? "Replay Mission"
                          : "Deploy Mission"}
              </button>


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
