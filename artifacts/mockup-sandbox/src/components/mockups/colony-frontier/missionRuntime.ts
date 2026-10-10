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
  /** Workbook retrofit progress (0/2 to 2/2); does not repair damage or alter condition. */
  upgradeLevel?: number;
  /** Absolute readings or diagnosed fault states produced by the selected workbook repair. */
  repairMetrics?: Record<string, number>;
};

export type MissionDecision = {
  eventId: string;
  choiceId: string;
  label: string;
};

export type SampleStage = "UNSURVEYED" | "SURVEYED" | "COLLECTED" | "DELIVERED" | "ANALYSED";

export type MissionOperationKind = "SURVEY" | "COLLECT" | "TRANSFER" | "ANALYZE" | "UPGRADE" | "REPAIR" | "SYSTEM_ACTION";

export type MissionOperation = {
  id: string;
  kind: MissionOperationKind;
  targetId: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  targetLevel?: number;
  /** ID of a normal system action that should apply its effects when the timer completes. */
  actionId?: string;
  /** Key identifying the system occupied by this job; targetId may identify a field site instead. */
  operationKey?: string;
  /** True when this work order currently requires the physical rover; prevents conflicting dispatches. */
  roverAssigned?: boolean;
  /** Optional deployed systems integrated into this operation. */
  supportSystems?: string[];
  /** Sample integrity score captured when a sealed sample is collected. */
  sampleQuality?: number;
};

export type ActiveFault = {
  eventId: string;
  targetTrackId: string;
  title: string;
  remainingSeconds: number;
  severity: number;
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
  /** Field-work progression. Optional to keep older saved missions compatible. */
  surveyedNodes?: string[];
  sampleStages?: Record<string, SampleStage>;
  resourceYield?: number;
  /** Legacy single-operation slot; read only to recover saves made before parallel jobs existed. */
  activeOperation?: MissionOperation | null;
  /** Multiple jobs can run at once, with at most one operation per occupied system. */
  activeOperations?: Record<string, MissionOperation>;
  operationResult?: string | null;
  activeFaults?: Record<string, ActiveFault>;
  /** Quality is frozen at collection so later lab analysis uses the actual specimen. */
  sampleQuality?: Record<string, number>;
  /** Temporary load-shedding state, persisted across refreshes. */
  emergencyPowerMode?: boolean;
  /** Schedule pointer keeps incident cadence correct after a refresh. */
  eventsTriggered?: number;
  /** Most recently received Earth Mission Control report, persisted between reloads. */
  earthReport?: string | null;
  earthReportAtSeconds?: number;
  /** Simulated mission time when each low-tech emergency fallback can be used again. */
  fallbackReadyAt?: Record<string, number>;
  /** Available on-site repair / retrofit material; consumed on installation, never added to launch mass. */
  partsInventoryKg?: number;
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
