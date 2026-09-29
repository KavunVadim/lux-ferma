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

export const WALK_SHEETS: Partial<Record<HerdKey, WalkSheet>> = {
  duck: { url: 'assets/walk/duck.webp', frames: 8 },
  goat: { url: 'assets/walk/goat.webp', frames: 8 },
  pig: { url: 'assets/walk/pig.webp', frames: 8 },
  horse: { url: 'assets/walk/horse.webp', frames: 8 },
  cow: { url: 'assets/walk/cow.webp', frames: 8 },
  sdog: { url: 'assets/walk/sdog.webp', frames: 8 },
  bdog: { url: 'assets/walk/bdog.webp', frames: 8 },
};
