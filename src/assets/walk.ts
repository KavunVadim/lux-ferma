/**
 * ЗГЕНЕРОВАНО скриптом scripts/build-atlas.mjs — не редагувати руками.
 *
 * Спрайт-листи ходи: горизонтальна стрічка квадратних кадрів 176×176.
 * У грі один кадр = ширина контейнера, тому `steps(frames)` показує
 * рівно кадр за кадром (див. .walker у BoardScene.module.css).
 */
import type { HerdKey } from '../game/types';

export interface WalkSheet {
  /** Шлях від BASE_URL. */
  url: string;
  /** Кількість кадрів у стрічці. */
  frames: number;
}

/** Вид тварини або хижак — усе, для чого може бути стрічка кадрів. */
export type WalkKey = HerdKey | 'fox' | 'bear';

export const WALK_SHEETS: Partial<Record<WalkKey, WalkSheet>> = {
  duck: { url: 'assets/walk/duck.webp', frames: 6 },
  goat: { url: 'assets/walk/goat.webp', frames: 6 },
  pig: { url: 'assets/walk/pig.webp', frames: 6 },
  horse: { url: 'assets/walk/horse.webp', frames: 6 },
  cow: { url: 'assets/walk/cow.webp', frames: 6 },
  sdog: { url: 'assets/walk/sdog.webp', frames: 6 },
  bdog: { url: 'assets/walk/bdog.webp', frames: 6 },
  bear: { url: 'assets/walk/bear.webp', frames: 6 },
  fox: { url: 'assets/walk/fox.webp', frames: 6 },
};
