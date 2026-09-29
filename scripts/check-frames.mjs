/**
 * Наскільки кадри ходи відрізняються між собою.
 *
 * Якщо сусідні кадри майже однакові — це не цикл ходи, а одна поза, і тварина
 * виглядає так, ніби «тупає однією ногою». Скрипт міряє різницю сусідніх кадрів
 * у стрічці (0 = кадри ідентичні) і коливання висоти спрайта.
 *
 * Запуск: node scripts/check-frames.mjs
 */
import sharp from 'sharp';

const CELL = 176;
const SPECIES = ['duck', 'goat', 'pig', 'horse', 'cow', 'sdog', 'bdog', 'bear', 'fox'];

async function framesOf(species) {
  const file = `public/assets/walk/${species}.webp`;
  const img = sharp(file);
  const meta = await img.metadata();
  const count = Math.round(meta.width / CELL);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const { data, info } = await sharp(file)
      .extract({ left: i * CELL, top: 0, width: CELL, height: CELL })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    out.push({ data, info });
  }
  return out;
}

/** Частка пікселів, які помітно змінились між кадрами, і різниця висоти спрайта. */
function compare(a, b) {
  let changed = 0;
  let total = 0;
  for (let p = 0; p < a.data.length; p += 4) {
    const da = a.data[p + 3];
    const db = b.data[p + 3];
    const ink = da > 24 || db > 24;
    if (!ink) continue;
    total += 1;
    const diff =
      Math.abs(a.data[p] - b.data[p]) + Math.abs(a.data[p + 1] - b.data[p + 1]) + Math.abs(a.data[p + 2] - b.data[p + 2]);
    if (diff > 60 || Math.abs(da - db) > 60) changed += 1;
  }
  return total ? (changed / total) * 100 : 0;
}

function height(frame) {
  const { data, info } = frame;
  let min = info.height;
  let max = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 24) {
        if (y < min) min = y;
        if (y > max) max = y;
        break;
      }
    }
  }
  return max < min ? 0 : max - min + 1;
}

console.log('вид      кадрів  різниця сусідніх кадрів (% змінених пікселів)   коливання висоти');
for (const species of SPECIES) {
  const frames = await framesOf(species);
  const diffs = [];
  for (let i = 0; i < frames.length; i += 1) {
    diffs.push(compare(frames[i], frames[(i + 1) % frames.length]));
  }
  const heights = frames.map(height);
  const spread = Math.max(...heights) - Math.min(...heights);
  const avg = diffs.reduce((sum, value) => sum + value, 0) / diffs.length;
  const min = Math.min(...diffs);
  const verdict = avg < 3 ? '⛔ майже одна поза — не цикл' : avg < 8 ? '⚠️ слабкий цикл' : '✅ схоже на ходу';
  console.log(
    `${species.padEnd(8)} ${String(frames.length).padStart(2)}      ${diffs.map((d) => d.toFixed(1)).join(' / ').padEnd(38)} ` +
      `середня ${avg.toFixed(1)}%, мін ${min.toFixed(1)}% · розкид ${spread}px  ${verdict}`,
  );
}
