/**
 * Що з арту вже є, а що ще треба згенерувати.
 *
 * Проходить по списку очікуваних файлів і друкує ✅/❌ з підказкою, куди класти.
 * Хода тварин позначена як «демо», поки кадри не з'являться в assets-src.
 *
 * Запуск: npm run art:status
 */
import { existsSync, readdirSync, statSync } from 'node:fs';

const SPECIES = ['duck', 'goat', 'pig', 'horse', 'cow', 'sdog', 'bdog'];

const ok = (p) => existsSync(p);
const size = (p) => (ok(p) ? `${(statSync(p).size / 1024).toFixed(0)} КБ` : '');

const rows = [];

/* ── Хода: справжні кадри проти демо ── */
for (const species of [...SPECIES, 'fox', 'bear']) {
  const dir = `assets-src/walk/${species}`;
  const frames = ok(dir) ? readdirSync(dir).filter((f) => /\.png$/i.test(f)).length : 0;
  rows.push({
    item: `хода: ${species}`,
    стан: frames >= 4 ? `✅ свої кадри (${frames} шт)` : '⚠️ демо-кадри (згенеровані зі статики)',
    де: `assets-src/walk/${species}/001.png … 008.png`,
  });
}

/* ── Хижаки ── */
for (const [file, hint] of [
  ['fox-sneak.png', 'лисиця підкрадається'],
  ['fox-run.png', 'лисиця тікає зі здобиччю'],
  ['bear-run.png', 'ведмідь тікає зі здобиччю'],
]) {
  rows.push({
    item: `хижак: ${file}`,
    стан: ok(`assets-src/predators/${file}`) ? '✅ є' : '❌ немає',
    де: `assets-src/predators/${file} — ${hint}`,
  });
}

/* ── UI за концептом телефона ── */
for (const file of [
  'avatar-1.png',
  'avatar-2.png',
  'avatar-3.png',
  'avatar-4.png',
  'icon-dice.png',
  'icon-swap.png',
  'icon-next.png',
  'icon-crown.png',
  'btn-green.png',
  'btn-green-pressed.png',
  'banner-event.png',
  'panel-wood.png',
  'tray-wood.png',
  'sign-title.png',
  'progress-frame.png',
]) {
  rows.push({
    item: `UI: ${file}`,
    стан: ok(`assets-src/ui/${file}`) ? '✅ є' : '❌ немає',
    де: `assets-src/ui/${file}`,
  });
}

/* ── Декор ── */
for (const name of ['well', 'tractor', 'haybale', 'trough', 'scarecrow', 'coop', 'wheelbarrow', 'flowers', 'dogbowl']) {
  rows.push({
    item: `декор: ${name}`,
    стан: ok(`assets-src/decor/${name}.png`) ? '✅ є' : '❌ немає',
    де: `assets-src/decor/${name}.png`,
  });
}

/* ── Нова карта ── */
rows.push({
  item: 'нова карта поля',
  стан: ok('assets-src/map.png') ? `✅ є (${size('assets-src/map.png')})` : `❌ немає (зараз ${size('public/assets/map.webp')})`,
  де: 'assets-src/map.png — 1664×928, пропорція 1.793',
});

const width = Math.max(...rows.map((r) => r.item.length));
for (const row of rows) {
  console.log(`${row.item.padEnd(width)}  ${row.стан}`);
}

const missing = rows.filter((r) => r.стан.includes('❌')).length;
const demo = rows.filter((r) => r.стан.includes('⚠️')).length;
console.log(`\nбракує: ${missing} · ще на демо-кадрах: ${demo}`);
console.log('промпти й шляхи — docs/ART-TODO.md (коротко) і docs/ART-PACK.md (повністю)');
