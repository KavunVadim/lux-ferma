/**
 * Реєстр графічних асетів.
 *
 * Файли лежать у public/assets (стиснуті WebP, генеруються `npm run assets`),
 * тому URL будується від BASE_URL — це працює і на вебі в підкаталозі,
 * і всередині Capacitor WebView.
 */
import { ANIMALS, BUILDINGS, DECOR, FACE_SPRITE, MAP_SPRITE, PREDATORS } from '../game/config';
import { WALK_SHEETS } from './walk';
import type { HerdKey } from '../game/types';

export const assetUrl = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

export const MAP_URL = assetUrl(MAP_SPRITE);

export const ANIMAL_SPRITES: Record<HerdKey, string> = Object.fromEntries(
  (Object.keys(ANIMALS) as HerdKey[]).map((key) => [key, assetUrl(ANIMALS[key].sprite)]),
) as Record<HerdKey, string>;

export const BUILDING_SPRITES: Record<HerdKey, string> = Object.fromEntries(
  (Object.keys(BUILDINGS) as HerdKey[]).map((key) => [key, assetUrl(BUILDINGS[key])]),
) as Record<HerdKey, string>;

export const FACE_SPRITES: Record<string, string> = Object.fromEntries(
  Object.entries(FACE_SPRITE).map(([face, path]) => [face, assetUrl(path)]),
);

export const PREDATOR_SPRITES: Record<'fox' | 'bear', string> = {
  fox: assetUrl(PREDATORS.fox.sprite),
  bear: assetUrl(PREDATORS.bear.sprite),
};

export const DECOR_SPRITES: readonly { url: string; emoji: string; x: number; y: number; w: number }[] =
  DECOR.map((item) => ({
    url: assetUrl(item.sprite),
    emoji: item.emoji,
    x: item.x,
    y: item.y,
    w: item.w,
  }));

/** Усі URL, які має сенс завантажити наперед (стартовий екран показує прогрес). */
export const ALL_SPRITE_URLS: readonly string[] = Array.from(
  new Set<string>([
    MAP_URL,
    ...Object.values(ANIMAL_SPRITES),
    ...Object.values(BUILDING_SPRITES),
    ...Object.values(FACE_SPRITES),
    ...DECOR_SPRITES.map((item) => item.url),
    // Спрайт-листи ходи (якщо зібрані) — щоб перший крок не «стрибав» із фолбека.
    ...Object.values(WALK_SHEETS).map((sheet) => assetUrl(sheet.url)),
  ]),
);
