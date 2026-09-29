/**
 * Апскейл карти ферми до 2× з підвищенням різкості.
 *
 * Навіщо: карта 1664×928 на екрані 2560px розтягується і милиться. Апскейл до
 * 3328×1856 дає браузеру запас: на великих моніторах він бере повний розмір,
 * на решті — зменшує (зменшення завжди виглядає різкіше за збільшення).
 *
 * Метод: Lanczos3 (найкращий для ілюстрацій) + легкий unsharp. Сильний unsharp
 * не годиться — на мальованій карті він витягує ореоли навколо ліній.
 *
 * Запуск: node scripts/upscale-map.mjs [--factor 2]
 */
import { existsSync, renameSync, statSync } from 'node:fs';
import sharp from 'sharp';

const args = process.argv.slice(2);
const factor = Number(args.find((a) => a.startsWith('--factor='))?.split('=')[1] ?? 2);
const srcArg = args.find((a) => a.startsWith('--src='))?.split('=')[1];
/*
 * Джерело лежить у `assets-src/` (тека в .gitignore), а не в `public/`:
 * усе з `public/` їде в бандл і в precache, а сировина карти у грі не потрібна —
 * це були зайві 197 КБ у кожного гравця.
 */
const SRC =
  srcArg ??
  ['assets-src/map/source.webp', 'assets-src/map.png', 'assets-src/map.webp'].find((p) => existsSync(p)) ??
  '';
const OUT = 'public/assets/map.webp';

if (!existsSync(SRC)) {
  console.error(`немає вихідного файлу ${SRC} — поклади карту туди або вкажи --src=шлях`);
  process.exit(1);
}

const before = await sharp(SRC).metadata();
const mb = (bytes) => `${(bytes / 1024).toFixed(0)} КБ`;

console.log(`джерело: ${SRC} · ${before.width}×${before.height} · ${mb(statSync(SRC).size)}`);
if (before.width > 3000) {
  console.log('карта вже високої роздільності — апскейл не потрібен, тільки перепакування');
}

const target = { width: Math.round(before.width * factor), height: Math.round(before.height * factor) };

/*
 * УВАГА: sharp за замовчуванням НЕ збільшує зображення (`withoutEnlargement`),
 * тому `resize(3328)` на карті 1664px мовчки повертає ті самі 1664px. Саме
 * через це перший прогін дав «стало 1664×928» і лише важчий файл. Ставимо
 * `withoutEnlargement: false` явно.
 */
await sharp(SRC)
  // Lanczos3 — стандарт для апскейлу ілюстрацій: м'якший за nearest, але без
  // драбинок, які дає bicubic на лініях.
  .resize(target.width, target.height, { kernel: 'lanczos3', fit: 'fill', withoutEnlargement: false })
  // Легке підвищення різкості після збільшення: повертає контури, які розмив
  // ресемплер. Параметри підібрані так, щоб не було ореолів навколо тинів.
  .sharpen({ sigma: 0.8, m1: 0.4, m2: 2.2, x1: 2.2, y2: 10, y3: 18 })
  .webp({ quality: 92, effort: 6 })
  .toFile(`${OUT}.tmp`);

renameSync(`${OUT}.tmp`, OUT);

const after = await sharp(OUT).metadata();
console.log(`стало: ${after.width}×${after.height} · ${mb(statSync(OUT).size)} · q92`);
console.log(`пропорція: ${(after.width / after.height).toFixed(4)} (має лишитись 1.7931)`);
