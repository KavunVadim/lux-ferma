/**
 * Тайминги анімацій в одному місці.
 *
 * Об'єкт навмисно змінний: дев-панель (`/?params=1`) править його живцем,
 * а `DEFAULT_TIMINGS` лишається еталоном для «Скинути».
 */
export interface Timings {
  /** Скільки кадрів «мерехтять» кубики. */
  rollFrames: number;
  /** Тривалість одного кадру мерехтіння, мс. */
  rollFrameMs: number;
  /** Пауза між кидком і модалкою результату, мс. */
  resultDelayMs: number;
  /** Скільки живуть бейджі +N/−N, мс. */
  deltaLifeMs: number;
  /** Скільки живе тост, мс. */
  toastMs: number;
  /** Через скільки екран передачі ходу закривається сам, мс. */
  handoffMs: number;
}

export const DEFAULT_TIMINGS: Timings = {
  rollFrames: 11,
  rollFrameMs: 80,
  resultDelayMs: 520,
  deltaLifeMs: 1800,
  toastMs: 1900,
  handoffMs: 2400,
};

export const TIMINGS: Timings = { ...DEFAULT_TIMINGS };

/** Тривалість анімації кидка в мс (порахується щоразу з поточних значень). */
export const rollDuration = (): number => TIMINGS.rollFrames * TIMINGS.rollFrameMs;

export const resetTimings = (): void => {
  Object.assign(TIMINGS, DEFAULT_TIMINGS);
};
