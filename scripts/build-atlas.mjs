/**
 * Збірка спрайт-листів ходи (walk cycles).
 *
 * Джерело кадрів: `assets-src/walk/<вид>/001.png … NNN.png` — це можуть бути
 * кадри, нарізані з AI-відео (Runway/Kling/Luma: PNG тварини → «walking loop» →
 * ffmpeg -i walk.mp4 frames/%03d.png), або кадри від художника.
 *
 * Що робить скрипт:
 *   1) кожен кадр вписує у КВАДРАТНУ комірку 256×256 (contain, по центру) —
 *      квадрат потрібен, щоб у грі один кадр дорівнював ширині контейнера
 *      і `steps(N)` показував рівно кадр за кадром;
 *   2) зшиває кадри в горизонтальну стрічку `public/assets/walk/<вид>.webp`;
 *   3) пише маніфест `src/assets/walk.ts` (URL + кількість кадрів).
 *
 * Демо-режим: якщо кадрів немає, `--demo` робить їх із наявного спрайта
 * (нахил + стискання + підстрибування) — щоб конвеєр можна було перевірити
 * до появи справжніх кадрів. Справжні кадри просто заміняють демо.
 *
 * Запуск: npm run atlas        (демо для видів без кадрів)
 *         npm run atlas -- --clean   (лише те, що є в assets-src)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC_DIR = 'assets-src/walk';
const OUT_DIR = 'public/assets/walk';
const MANIFEST = 'src/assets/walk.ts';
/** Розмір однієї комірки в стрічці (квадрат — див. шапку). */
const CELL = 176;
/** Скільки кадрів у демо-циклі. */
const DEMO_FRAMES = 8;

const SPECIES = ['duck', 'goat', 'pig', 'horse', 'cow', 'sdog', 'bdog'];
/** Хижаки: своєї стрічки в демо не мають, але кадри може дати аркуш (напр. bear). */
const PREDATORS = ['bear', 'fox'];

/** Список кадрів виду: спершу тека в assets-src, інакше — нічого. */
function framesFromSource(species) {
  const dir = path.join(SRC_DIR, species);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => /\.(png|webp|jpg|jpeg)$/i.test(file))
    .sort()
    .map((file) => path.join(dir, file));
}

/** Демо-кадри: з наявного спрайта робимо «перевальцем» — нахил, стискання, крок. */
async function framesFromDemo(species) {
  const sprite = `public/assets/animals/${species}.webp`;
  if (!existsSync(sprite)) return [];
  const meta = await sharp(sprite).metadata();
  const base = await sharp(sprite).trim({ threshold: 6 }).toBuffer();
  const trimmed = await sharp(base).metadata();
  const width = trimmed.width ?? meta.width ?? CELL;
  const height = trimmed.height ?? meta.height ?? CELL;

  const dir = path.join('/tmp', 'lux-walk-demo', species);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const files = [];
  for (let i = 0; i < DEMO_FRAMES; i += 1) {
    const phase = (i / DEMO_FRAMES) * Math.PI * 2;
    const wave = Math.sin(phase);
    const scaleX = 1 - 0.05 * wave;
    const scaleY = 1 + 0.06 * wave;
    const tilt = 2.4 * wave;
    const frame = await sharp(base)
      .resize({ width: Math.max(8, Math.round(width * scaleX)), height: Math.max(8, Math.round(height * scaleY)) })
      .rotate(tilt, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    const file = path.join(dir, `${String(i + 1).padStart(3, '0')}.png`);
    writeFileSync(file, frame);
    files.push(file);
  }
  return files;
}

/** Вписує кадр у квадратну комірку по центру (contain). */
async function toCell(file) {
  return sharp(file)
    .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function buildSpecies(species, useDemo) {
  let frames = framesFromSource(species);
  let source = 'кадри з assets-src';
  if (frames.length === 0 && useDemo) {
    frames = await framesFromDemo(species);
    source = 'демо-кадри зі спрайта';
  }
  if (frames.length < 2) return null;

  const cells = [];
  for (const file of frames) cells.push({ input: await toCell(file), left: cells.length * CELL, top: 0 });

  const out = path.join(OUT_DIR, `${species}.webp`);
  mkdirSync(OUT_DIR, { recursive: true });
  await sharp({
    create: { width: cells.length * CELL, height: CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(cells)
    .webp({ quality: 82, effort: 5 })
    .toFile(out);

  const kb = (statSync(out).size / 1024).toFixed(0);
  console.log(`  ${species.padEnd(6)} ${String(frames.length).padStart(2)} кадрів, ${source.padEnd(22)} → ${out} (${kb} КБ)`);
  return { frames: frames.length, url: `assets/walk/${species}.webp` };
}

async function main() {
  const useDemo = !process.argv.includes('--clean');
  console.log(`спрайт-листи ходи (комірка ${CELL}×${CELL})${useDemo ? ', демо для видів без кадрів' : ''}`);

  const manifest = {};
  for (const species of SPECIES) {
    const built = await buildSpecies(species, useDemo);
    if (built) manifest[species] = built;
  }

  // Хижаки: демо-кадрів для них немає, будуємо тільки якщо є свої кадри.
  for (const predator of PREDATORS) {
    const built = await buildSpecies(predator, false);
    if (built) manifest[predator] = built;
  }

  const entries = Object.entries(manifest)
    .map(([key, value]) => `  ${key}: { url: '${value.url}', frames: ${value.frames} },`)
    .join('\n');

  writeFileSync(
    MANIFEST,
    `/**
 * ЗГЕНЕРОВАНО скриптом scripts/build-atlas.mjs — не редагувати руками.
 *
 * Спрайт-листи ходи: горизонтальна стрічка квадратних кадрів ${CELL}×${CELL}.
 * У грі один кадр = ширина контейнера, тому \`steps(frames)\` показує
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
${entries}
};
`,
  );

  console.log(`\nманіфест: ${MANIFEST}`);
  const list = readFileSync(MANIFEST, 'utf8').split('\n').length;
  console.log(`готово: ${Object.keys(manifest).length} видів, маніфест ${list} рядків`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
