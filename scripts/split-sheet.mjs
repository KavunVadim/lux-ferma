/**
 * Нарізка аркуша з кадрами ходи на окремі кадри по видах.
 *
 * Аркуш — сітка «підпис + N кадрів у рядку». Скрипт сам знаходить межі:
 * порожні смуги по X дають колонки (перша непорожня колонка — підписи, її
 * відкидаємо), порожні смуги по Y — рядки.
 *
 * Білий фон вирізається ЗАЛИВКОЮ ВІД КРАЇВ, а не порогом білого: інакше
 * біла качка й білі плями корови стали б дірками.
 *
 * Запуск:
 *   node scripts/split-sheet.mjs <аркуш.png> <вид1,вид2,…>
 * Приклад:
 *   node scripts/split-sheet.mjs /tmp/sheet.png sdog,bear,cow,pig,goat,duck
 *
 * Результат: assets-src/walk/<вид>/001.png … NNN.png (прозорий фон, квадратні,
 * однаковий розмір полотна у межах виду) → далі `npm run atlas`.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [sheetPath, speciesArg] = process.argv.slice(2);
if (!sheetPath || !speciesArg) {
  console.error('Використання: node scripts/split-sheet.mjs <аркуш.png> <вид1,вид2,…>');
  process.exit(1);
}
const SPECIES = speciesArg.split(',').map((s) => s.trim()).filter(Boolean);

const SRC_DIR = 'assets-src/walk';
const WHITE = 236; // усе, що світліше за це й з'єднане з краєм, вважаємо фоном

const { data, info } = await sharp(sheetPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;

/** Порожні смуги (усі пікселі світлі) — розділювачі кадрів. */
function gaps(axis, limit, otherLimit, pick) {
  const ink = new Array(limit).fill(0);
  for (let a = 0; a < limit; a += 1) {
    let count = 0;
    for (let b = 0; b < otherLimit; b += axis === 'x' ? 1 : 1) {
      const x = axis === 'x' ? a : b;
      const y = axis === 'x' ? b : a;
      const i = (y * W + x) * 4;
      if (pick(i)) count += 1;
    }
    ink[a] = count;
  }
  const out = [];
  let run = 0;
  for (let a = 0; a <= limit; a += 1) {
    const empty = a === limit || ink[a] <= 2;
    if (empty) run += 1;
    else {
      if (run > 6) out.push([a - run, a - 1]);
      run = 0;
    }
  }
  return out;
}

const isSprite = (i) => {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  return !(r > WHITE && g > WHITE && b > WHITE);
};

// Колонки: спершу весь аркуш, потім відкидаємо колонку підписів.
const colGaps = gaps('x', W, H, isSprite);
const blocks = [];
let cursor = 0;
for (const [start, end] of [...colGaps, [W, W]]) {
  if (start - cursor > 6) blocks.push([cursor, start - 1]);
  cursor = end + 1;
}
const labelBlock = blocks[0];
const frameBlocks = blocks.slice(1);
const rowGaps = gaps('y', H, W, isSprite);
const rowBlocks = [];
cursor = 0;
for (const [start, end] of [...rowGaps, [H, H]]) {
  if (start - cursor > 6) rowBlocks.push([cursor, start - 1]);
  cursor = end + 1;
}

console.log(`колонка підписів: x ${labelBlock?.[0]}…${labelBlock?.[1]}`);
console.log(`кадрів у рядку: ${frameBlocks.length} · рядків: ${rowBlocks.length}`);

if (rowBlocks.length !== SPECIES.length) {
  console.warn(`УВАГА: рядків ${rowBlocks.length}, а видів передано ${SPECIES.length}`);
}

/* ── Вирізаємо білий фон заливкою від країв ── */
const alpha = new Uint8Array(W * H).fill(255);
const stack = [];
const push = (x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const p = y * W + x;
  if (alpha[p] === 0) return;
  const i = p * 4;
  if (data[i] < WHITE || data[i + 1] < WHITE || data[i + 2] < WHITE) return;
  alpha[p] = 0;
  stack.push(p);
};
for (let x = 0; x < W; x += 1) {
  push(x, 0);
  push(x, H - 1);
}
for (let y = 0; y < H; y += 1) {
  push(0, y);
  push(W - 1, y);
}
while (stack.length) {
  const p = stack.pop();
  const x = p % W;
  const y = (p - x) / W;
  push(x + 1, y);
  push(x - 1, y);
  push(x, y + 1);
  push(x, y - 1);
}
for (let p = 0; p < W * H; p += 1) data[p * 4 + 3] = alpha[p];

/** Межі непорожнього прямокутника у межах заданої області. */
function inkBox(x0, y0, x1, y1) {
  let minX = x1;
  let maxX = x0;
  let minY = y1;
  let maxY = y0;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (data[(y * W + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < minX ? null : { minX, minY, maxX, maxY };
}

let total = 0;
for (let r = 0; r < Math.min(rowBlocks.length, SPECIES.length); r += 1) {
  const species = SPECIES[r];
  const [rowTop, rowBottom] = rowBlocks[r];
  const dir = path.join(SRC_DIR, species);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  // Спільне полотно на весь рядок: інакше кадри масштабуються по-різному й тварина смикається.
  const boxes = frameBlocks.map(([x0, x1]) => inkBox(x0, rowTop, x1, rowBottom));
  const side = Math.max(...boxes.filter(Boolean).map((b) => Math.max(b.maxX - b.minX + 1, b.maxY - b.minY + 1)));
  const canvas = Math.ceil(side * 1.14);

  for (let c = 0; c < frameBlocks.length; c += 1) {
    const box = boxes[c];
    if (!box) continue;
    const [x0, x1] = frameBlocks[c];
    const cropW = box.maxX - box.minX + 1;
    const cropH = box.maxY - box.minY + 1;
    const left = Math.round((canvas - cropW) / 2);
    const top = Math.round((canvas - cropH) / 2);
    const frame = await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 4 } })
      .extract({ left: box.minX, top: box.minY, width: cropW, height: cropH })
      .extend({ top, bottom: canvas - cropH - top, left, right: canvas - cropW - left, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const name = String(c + 1).padStart(3, '0');
    writeFileSync(path.join(dir, `${name}.png`), frame);
    total += 1;
    void x0;
    void x1;
  }
  console.log(`  ${species.padEnd(6)} ${frameBlocks.length} кадрів · полотно ${canvas}×${canvas} → ${dir}`);
}
console.log(`\nготово: ${total} кадрів. Далі — npm run atlas`);
