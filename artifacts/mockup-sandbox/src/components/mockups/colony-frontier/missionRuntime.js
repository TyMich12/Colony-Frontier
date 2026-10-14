const PENDING_KEY = "colony-frontier-pending-mission";
const SNAPSHOT_KEY = "colony-frontier-mission-runtime";
export function savePendingMission(mission) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(mission));
}
export function loadPendingMission() {
    try {
        const saved = localStorage.getItem(PENDING_KEY);
        return saved ? JSON.parse(saved) : null;
    }
    catch {
        return null;
    }
}
export function clearPendingMission() {
    localStorage.removeItem(PENDING_KEY);
}
export function saveMissionRuntime(snapshot) {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}
export function loadMissionRuntime(missionId) {
    try {
        const saved = localStorage.getItem(SNAPSHOT_KEY);
        if (!saved)
            return null;
        const snapshot = JSON.parse(saved);
        return snapshot.missionId === missionId ? snapshot : null;
    }
    catch {
        return null;
    }
}
export function clearMissionRuntime() {
    localStorage.removeItem(SNAPSHOT_KEY);
}
