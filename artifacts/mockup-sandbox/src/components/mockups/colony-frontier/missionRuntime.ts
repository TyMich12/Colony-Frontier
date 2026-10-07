import type { Tier } from "./_shared/gameData";

export type MissionCampaign = "moon" | "mars";

export type PendingMission = {
  missionId: string;
  campaign: MissionCampaign;
  missionNumber: string;
  missionTitle: string;
  selected: Record<string, Tier>;
  spend: number;
  rewardCredits: number;
  rewardXp: number;
  rewardResearchTokens: number;
  replay: boolean;
  startedAt: number;
};

export type MissionMetrics = {
  power: number;
  battery: number;
  oxygen: number;
  water: number;
  food: number;
  temperature: number;
  radiation: number;
  habitat: number;
};

export type BuildingRuntime = {
  condition: number;
  dust: number;
  status: string;
};

export type MissionDecision = {
  eventId: string;
  choiceId: string;
  label: string;
};

export type MissionRuntimeSnapshot = {
  missionId: string;
  elapsedSeconds: number;
  metrics: MissionMetrics;
  buildings: Record<string, BuildingRuntime>;
  activeEventId: string | null;
  resolvedEventIds: string[];
  decisions: MissionDecision[];
  aiMessage: string;
  roverTask: string;
  score: number;
};

const PENDING_KEY = "colony-frontier-pending-mission";
const SNAPSHOT_KEY = "colony-frontier-mission-runtime";

export function savePendingMission(mission: PendingMission): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(mission));
}

export function loadPendingMission(): PendingMission | null {
  try {
    const saved = localStorage.getItem(PENDING_KEY);
    return saved ? (JSON.parse(saved) as PendingMission) : null;
  } catch {
    return null;
  }
}

export function clearPendingMission(): void {
  localStorage.removeItem(PENDING_KEY);
}

export function saveMissionRuntime(snapshot: MissionRuntimeSnapshot): void {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function loadMissionRuntime(missionId: string): MissionRuntimeSnapshot | null {
  try {
    const saved = localStorage.getItem(SNAPSHOT_KEY);
    if (!saved) return null;

    const snapshot = JSON.parse(saved) as MissionRuntimeSnapshot;
    return snapshot.missionId === missionId ? snapshot : null;
  } catch {
    return null;
  }
}

export function clearMissionRuntime(): void {
  localStorage.removeItem(SNAPSHOT_KEY);
}
