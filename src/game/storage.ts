/** Збереження партії в localStorage з перевіркою формату. */
import { SAVE_SCHEMA } from './engine';
import type { GameState } from './types';

const SAVE_KEY = 'lux-ferma:save';

function storage(): Storage | null {
  try {
    const test = '__lux_ferma_probe__';
    window.localStorage.setItem(test, '1');
    window.localStorage.removeItem(test);
    return window.localStorage;
  } catch {
    // Приватний режим або заблокований storage — гра працює без збереження.
    return null;
  }
}

export function saveGame(state: GameState | null): void {
  const store = storage();
  if (!store) return;
  try {
    if (!state || state.over) {
      store.removeItem(SAVE_KEY);
      return;
    }
    store.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* переповнення сховища — не критично */
  }
}

export function loadGame(): GameState | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isGameState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function hasSavedGame(): boolean {
  return loadGame() !== null;
}

export function clearSave(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

function isGameState(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<GameState>;
  return (
    candidate.schema === SAVE_SCHEMA &&
    Array.isArray(candidate.players) &&
    candidate.players.length >= 2 &&
    typeof candidate.herd === 'object' &&
    candidate.herd !== null &&
    typeof candidate.current === 'number' &&
    candidate.current >= 0 &&
    candidate.current < candidate.players.length &&
    typeof candidate.trades === 'number' &&
    typeof candidate.rules === 'object' &&
    candidate.rules !== null &&
    typeof candidate.over === 'boolean'
  );
}
