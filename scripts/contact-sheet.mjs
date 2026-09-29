/**
 * Контрольний аркуш: по одному кадру кожного виду зі зібраних стрічок.
 * Потрібно, щоб очима перевірити нарізку (спрайт цілий, фон прозорий).
 *
 * Запуск: node scripts/contact-sheet.mjs [файл-виходу]
 */
import sharp from 'sharp';

const OUT = process.argv[2] ?? '/tmp/frames-all.png';
const CELL = 176;
const SPECIES = ['cow', 'horse', 'pig', 'goat', 'duck', 'sdog', 'bdog', 'bear', 'fox'];

const parts = [];
for (let i = 0; i < SPECIES.length; i += 1) {
  const species = SPECIES[i];
  const file = `public/assets/walk/${species}.webp`;
  try {
    const frame = await sharp(file).extract({ left: CELL, top: 0, width: CELL, height: CELL }).png().toBuffer();
    parts.push({ input: frame, left: i * CELL, top: 0 });
  } catch (error) {
    console.warn(`${species}: ${error.message}`);
  }
}

await sharp({
  create: { width: CELL * parts.length, height: CELL, channels: 4, background: { r: 245, g: 240, b: 225, alpha: 1 } },
})
  .composite(parts)
  .png()
  .toFile(OUT);

console.log(`контрольний аркуш (${parts.length} видів): ${OUT}`);
