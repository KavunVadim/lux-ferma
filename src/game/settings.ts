/**
 * Налаштування застосунку й правила партії.
 *
 * Два рівні:
 *  - `GameRules` — те, що впливає на гру (обміни, хижаки, кубики, стадо).
 *    Копія правил кладеться в `GameState.rules`, тож збережена партія
 *    завжди грається за своїми правилами.
 *  - `AppSettings` — правила + звук/анімація, які живуть у localStorage.
 */
import { BALANCE } from './config';
import type { BalancePreset, DicePreset, PredatorMode } from './config';
import { haptics } from './haptics';
import { ALL_EFFECTS, sound } from './sound';
import type { SoundEffect } from './sound';

/** Тема оформлення: як у системі, завжди світла, завжди темна. */
export type ThemeMode = 'system' | 'light' | 'dark';

export interface GameRules {
  /** Скільки обмінів за хід; `null` — без обмежень. */
  tradesPerTurn: number | null;
  /** Що роблять хижаки: забирають усіх / половину / нічого. */
  predatorMode: PredatorMode;
  /** Який набір кубиків кидаємо. */
  dicePreset: DicePreset;
  /** Стартовий запас спільного стада. */
  balance: BalancePreset;
  /**
   * Чи давати кожному гравцеві качку на старті.
   *
   * У настільній грі стартова качка є — вона дає перший хід без глухого
   * кута: без неї гравець може кілька ходів нічого не отримувати, поки не
   * випаде качка на кубику. Але комусь цікавіше грати «з нуля», тож це
   * перемикач, а не жорстко зашите правило.
   */
  startDuck: boolean;
}

export interface AppSettings extends GameRules {
  /** Звук увімкнено. */
  sound: boolean;
  /** Гучність 0..1. */
  volume: number;
  /** Які саме сигнали грати (окремі перемикачі). */
  effects: Record<SoundEffect, boolean>;
  /** Тактильний відгук (вібрація) на телефоні. */
  vibration: boolean;
  /** Тема оформлення. */
  theme: ThemeMode;
  /** Показувати хижаків під час обертання кубика (інакше — лише результат). */
  diceFlicker: boolean;
}

/** Усі ефекти увімкнено — типовий стан. */
export const allEffectsOn = (): Record<SoundEffect, boolean> =>
  ALL_EFFECTS.reduce<Record<SoundEffect, boolean>>(
    (acc, effect) => {
      acc[effect] = true;
      return acc;
    },
    {} as Record<SoundEffect, boolean>,
  );

export const DEFAULT_SETTINGS: AppSettings = {
  tradesPerTurn: null,
  predatorMode: 'classic',
  dicePreset: 'classic',
  balance: 'classic',
  startDuck: true,
  sound: true,
  volume: 0.8,
  effects: allEffectsOn(),
  vibration: true,
  theme: 'system',
  diceFlicker: false,
};

export const DEFAULT_RULES: GameRules = {
  tradesPerTurn: DEFAULT_SETTINGS.tradesPerTurn,
  predatorMode: DEFAULT_SETTINGS.predatorMode,
  dicePreset: DEFAULT_SETTINGS.dicePreset,
  balance: DEFAULT_SETTINGS.balance,
  startDuck: DEFAULT_SETTINGS.startDuck,
};

/** Вирізає з налаштувань саме правила гри. */
export function rulesOf(settings: AppSettings): GameRules {
  return {
    tradesPerTurn: settings.tradesPerTurn,
    predatorMode: settings.predatorMode,
    dicePreset: settings.dicePreset,
    balance: settings.balance,
    startDuck: settings.startDuck,
  };
}

const STORAGE_KEY = 'lux-ferma:settings';
const TRADE_LIMITS = [null, 1, 2, 3] as const;

function store(): Storage | null {
  try {
    const probe = '__lux_settings_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Приводить будь-який вхідний обʼєкт до валідних налаштувань. */
export function sanitizeSettings(raw: unknown): AppSettings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS };
  const input = raw as Partial<Record<keyof AppSettings, unknown>>;

  const trades = TRADE_LIMITS.includes(input.tradesPerTurn as (typeof TRADE_LIMITS)[number])
    ? (input.tradesPerTurn as AppSettings['tradesPerTurn'])
    : DEFAULT_SETTINGS.tradesPerTurn;

  const predatorMode: PredatorMode =
    input.predatorMode === 'half' || input.predatorMode === 'off' || input.predatorMode === 'classic'
      ? input.predatorMode
      : DEFAULT_SETTINGS.predatorMode;

  const dicePreset: DicePreset =
    input.dicePreset === 'calm' || input.dicePreset === 'classic' ? input.dicePreset : DEFAULT_SETTINGS.dicePreset;

  const balance: BalancePreset =
    input.balance === 'compact' || input.balance === 'classic' ? input.balance : DEFAULT_SETTINGS.balance;

  const volume = typeof input.volume === 'number' && Number.isFinite(input.volume)
    ? Math.min(1, Math.max(0, input.volume))
    : DEFAULT_SETTINGS.volume;

  const theme: ThemeMode =
    input.theme === 'light' || input.theme === 'dark' || input.theme === 'system'
      ? input.theme
      : DEFAULT_SETTINGS.theme;

  const effects = { ...DEFAULT_SETTINGS.effects };
  if (typeof input.effects === 'object' && input.effects !== null) {
    const raw = input.effects as Partial<Record<SoundEffect, unknown>>;
    for (const effect of ALL_EFFECTS) {
      if (typeof raw[effect] === 'boolean') effects[effect] = raw[effect] as boolean;
    }
  }

  return {
    tradesPerTurn: trades,
    predatorMode,
    dicePreset,
    balance,
    // Старі збереження не мають цього поля — беремо типове (з качкою).
    startDuck: typeof input.startDuck === 'boolean' ? input.startDuck : DEFAULT_SETTINGS.startDuck,
    sound: typeof input.sound === 'boolean' ? input.sound : DEFAULT_SETTINGS.sound,
    volume,
    effects,
    vibration: typeof input.vibration === 'boolean' ? input.vibration : DEFAULT_SETTINGS.vibration,
    theme,
    diceFlicker: typeof input.diceFlicker === 'boolean' ? input.diceFlicker : DEFAULT_SETTINGS.diceFlicker,
  };
}

export function loadSettings(): AppSettings {
  const storage = store();
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  const storage = store();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* приватний режим — граємо без збереження налаштувань */
  }
}

/** Скільки тварин забирає хижак залежно від режиму. */
export function stolenCount(total: number, mode: PredatorMode): number {
  if (mode === 'off') return 0;
  if (mode === 'half') return Math.ceil(total / 2);
  return total;
}

/** Проштовхує налаштування у звук, тактильність і тему. */
export function applyRuntime(settings: AppSettings): void {
  sound.configure({ muted: !settings.sound, volume: settings.volume, effects: settings.effects });
  haptics.enabled = settings.vibration;

  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
}

/** Підписи перемикачів звуку для UI. */
export const EFFECT_LABELS: Record<SoundEffect, string> = {
  click: 'Клік по кнопках',
  roll: 'Кидок кубиків',
  drum: 'Дріб перед результатом',
  born: 'Прибуття тварин',
  raid: 'Напад хижака',
  coin: 'Обмін',
  win: 'Перемога',
};

/** Скільки обмінів дозволено за хід (для підписів у UI). */
export function tradesLimitLabel(limit: number | null): string {
  return limit === null ? 'без обмежень' : `${limit} за хід`;
}

/** Перелік пресетів стада для UI. */
export const BALANCE_PRESETS: readonly { value: BalancePreset; label: string; hint: string }[] = [
  {
    value: 'classic',
    label: 'Класичне',
    hint: `стадо ${BALANCE.classic.duck}🦆 · ${BALANCE.classic.goat}🐐 · ${BALANCE.classic.pig}🐖 · ${BALANCE.classic.horse}🐎 · ${BALANCE.classic.cow}🐄`,
  },
  {
    value: 'compact',
    label: 'Менше',
    hint: `стадо ${BALANCE.compact.duck}🦆 · ${BALANCE.compact.goat}🐐 · ${BALANCE.compact.pig}🐖 · ${BALANCE.compact.horse}🐎 · ${BALANCE.compact.cow}🐄`,
  },
];
