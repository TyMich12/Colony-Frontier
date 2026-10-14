export const STARTING_GAME_STATE = {
    credits: 30,
    xp: 0,
    researchTokens: 0,
    completedMissions: [],
    unlockedTechnologies: [],
    devMode: false,
};
const STORAGE_KEY = "colony-frontier-game-state";
export function loadGameState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            return STARTING_GAME_STATE;
        }
        return {
            ...STARTING_GAME_STATE,
            ...JSON.parse(saved),
        };
    }
    catch {
        return STARTING_GAME_STATE;
    }
}
export function saveGameState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
export function resetGameState() {
    localStorage.removeItem(STORAGE_KEY);
}
