export type GameState = {
  credits: number;
  xp: number;
  researchTokens: number;
  completedMissions: string[];
  unlockedTechnologies: string[];
  devMode: boolean;
};

export const STARTING_GAME_STATE: GameState = {
  credits: 30,
  xp: 0,
  researchTokens: 0,
  completedMissions: [],
  unlockedTechnologies: [],
  devMode: false,
};

const STORAGE_KEY = "colony-frontier-game-state";

export function loadGameState(): GameState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return STARTING_GAME_STATE;
    }

    return {
      ...STARTING_GAME_STATE,
      ...JSON.parse(saved),
    };
  } catch {
    return STARTING_GAME_STATE;
  }
}

export function saveGameState(state: GameState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetGameState(): void {
  localStorage.removeItem(STORAGE_KEY);
}