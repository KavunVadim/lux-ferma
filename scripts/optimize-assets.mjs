/**
 * Оптимізація графічних асетів.
 *
 * Джерело — сирі PNG (за замовчуванням ~/Downloads/games/assets),
 * результат — стиснуті WebP у public/assets/ (той самий нейминг, інше розширення).
 *
 * Запуск:  npm run assets            (з дефолтним джерелом)
 *          npm run assets -- --src /шлях/до/assets
 *
 * Асети комітяться в репозиторій, тому `npm install && npm run build` працює
 * без наявності сирців на машині.
 */
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'assets');
const ICON_OUT = path.join(ROOT, 'public', 'icons');

const argSrc = process.argv.indexOf('--src');
const SRC =
  argSrc > -1
    ? path.resolve(process.argv[argSrc + 1])
    : path.join(os.homedir(), 'Downloads', 'games', 'assets');

/** Правила обробки по теках. */
const RULES = {
  animals: { fit: { height: 512 }, quality: 88 },
  buildings: { fit: { width: 900 }, quality: 86 },
  decor: { fit: { width: 640 }, quality: 86 },
};

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} kB`;

async function convertDir(dir) {
  const rule = RULES[dir] ?? { fit: { width: 1024 }, quality: 86 };
  const srcDir = path.join(SRC, dir);
  const outDir = path.join(OUT, dir);
  if (!existsSync(srcDir)) return [];
  await mkdir(outDir, { recursive: true });

  const files = (await readdir(srcDir)).filter((f) => f.endsWith('.png'));
  const rows = [];
  for (const file of files) {
    const name = path.basename(file, '.png');
    const from = path.join(srcDir, file);
    const to = path.join(outDir, `${name}.webp`);
    const before = (await stat(from)).size;
    await sharp(from)
      .resize({ ...rule.fit, withoutEnlargement: true, fit: 'inside' })
      .webp({ quality: rule.quality, alphaQuality: 100, effort: 5 })
      .toFile(to);
    const after = (await stat(to)).size;
    rows.push({ name: `${dir}/${name}`, before, after });
  }
  return rows;
}

async function convertMap() {
  const from = path.join(SRC, 'map.png');
  if (!existsSync(from)) return null;
  await mkdir(OUT, { recursive: true });
  const to = path.join(OUT, 'map.webp');
  await sharp(from)
    .resize({ width: 1920, withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 80, effort: 5 })
    .toFile(to);
  return { name: 'map', before: (await stat(from)).size, after: (await stat(to)).size };
}

/** Іконки застосунку (PWA + Capacitor) зі спрайта качки. */
async function buildIcons() {
  const duck = path.join(SRC, 'animals', 'duck.png');
  if (!existsSync(duck)) return [];
  await mkdir(ICON_OUT, { recursive: true });

  const roundRect = (size) => Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <defs>
         <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0%" stop-color="#bfe3f2"/><stop offset="100%" stop-color="#8fc47a"/>
         </linearGradient>
       </defs>
       <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#sky)"/>
     </svg>`);

  const rounded = (size) => Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#8fc47a"/>
     </svg>`);

  const targets = [
    { file: 'icon-192.png', size: 192, maskable: false },
    { file: 'icon-512.png', size: 512, maskable: false },
    { file: 'icon-maskable-512.png', size: 512, maskable: true },
    { file: 'apple-touch-icon.png', size: 180, maskable: true },
  ];

  const rows = [];
  for (const { file, size, maskable } of targets) {
    const inner = Math.round(size * (maskable ? 0.62 : 0.8));
    const sprite = await sharp(duck)
      .resize({ height: inner, withoutEnlargement: true, fit: 'inside' })
      .png()
      .toBuffer();
    const to = path.join(ICON_OUT, file);
    await sharp(maskable ? rounded(size) : roundRect(size))
      .composite([{ input: sprite, gravity: 'south', top: undefined }])
      .png({ compressionLevel: 9 })
      .toFile(to);
    rows.push({ name: file, before: 0, after: (await stat(to)).size });
  }
  return rows;
}

async function main() {
  if (!existsSync(SRC)) {
    console.error(`✗ Джерело не знайдено: ${SRC}`);
    console.error('  Вкажіть шлях: npm run assets -- --src /шлях/до/assets');
    process.exit(1);
  }
  console.log(`Джерело: ${SRC}\nРезультат: ${OUT}\n`);

  const rows = [];
  for (const dir of Object.keys(RULES)) rows.push(...(await convertDir(dir)));
  const mapRow = await convertMap();
  if (mapRow) rows.push(mapRow);
  rows.push(...(await buildIcons()));

  const before = rows.reduce((s, r) => s + r.before, 0);
  const after = rows.reduce((s, r) => s + r.after, 0);
  for (const r of rows) {
    const ratio = r.before ? ` (${Math.round((1 - r.after / r.before) * 100)}% менше)` : '';
    console.log(`  ✓ ${r.name.padEnd(24)} ${kb(r.after).padStart(8)}${ratio}`);
  }
  console.log(`\nРазом: ${kb(before)} → ${kb(after)} (${Math.round((1 - after / before) * 100)}% економії)`);

  await writeFile(
    path.join(OUT, 'README.md'),
    [
      '# Асети',
      '',
      'Згенеровано скриптом `scripts/optimize-assets.mjs`.',
      '',
      'Не редагуйте ці файли вручну — оновіть сирці PNG і запустіть `npm run assets`.',
      'Той самий скрипт використовується для іконок у `public/icons/`.',
      '',
    ].join('\n'),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
