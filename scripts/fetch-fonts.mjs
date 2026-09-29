/**
 * Завантаження шрифтів Google Fonts локально (офлайн + нативна збірка без CDN).
 *
 * Запуск: npm run fonts
 *
 * Скрипт тягне css2 з Chrome user-agent (щоб отримати woff2), відбирає лише
 * потрібні subsets (latin, cyrillic, cyrillic-ext), складає файли у
 * src/styles/fonts/ і генерує src/styles/fonts.css із локальними url().
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
// Файли лежать поруч зі згенерованим CSS, щоб Vite бачив url() і хешував їх сам
// (це працює за будь-якого base — і на вебі в підкаталозі, і всередині Capacitor).
const OUT_DIR = path.join(ROOT, 'src', 'styles', 'fonts');
const CSS_OUT = path.join(ROOT, 'src', 'styles', 'fonts.css');

const FAMILIES = [
  // Baloo 2 (заголовки у вихідному файлі) не має кирилиці — узято M PLUS Rounded 1c:
  // такий самий м'який «округлений» дизайн, але з повною підтримкою української.
  { name: 'M PLUS Rounded 1c', weights: [700, 800] },
  { name: 'Nunito', weights: [400, 600, 700, 800] },
];

const KEEP_SUBSETS = new Set(['latin', 'cyrillic', 'cyrillic-ext']);

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function fetchCss(family, weights) {
  const spec = `${family.replace(/ /g, '+')}:wght@${weights.join(';')}`;
  const url = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${family}: HTTP ${res.status}`);
  return res.text();
}

/** Розбиває css2 на блоки @font-face з коментарем-subset над кожним. */
function parseBlocks(css) {
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g)];
  return blocks
    .map(([, subset, block]) => ({ subset, block }))
    .filter((b) => KEEP_SUBSETS.has(b.subset));
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  const chunks = [
    '/* Згенеровано scripts/fetch-fonts.mjs — не редагуйте вручну. */',
    '',
  ];
  let files = 0;
  let bytes = 0;

  for (const { name, weights } of FAMILIES) {
    const css = await fetchCss(name, weights);
    const blocks = parseBlocks(css);
    if (!blocks.length) throw new Error(`${name}: не знайдено жодного @font-face`);

    for (const { subset, block } of blocks) {
      const srcMatch = block.match(/url\((https:\/\/[^)]+\.woff2)\)/);
      if (!srcMatch) continue;
      const weightMatch = block.match(/font-weight:\s*(\d+)/);
      const weight = weightMatch ? weightMatch[1] : '400';
      const fileName = `${name.replace(/ /g, '-').toLowerCase()}-${weight}-${subset}.woff2`;

      const res = await fetch(srcMatch[1], { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`${fileName}: HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(path.join(OUT_DIR, fileName), buf);
      files += 1;
      bytes += buf.byteLength;

      chunks.push(block.replace(srcMatch[1], `./fonts/${fileName}`).trim(), '');
    }
    console.log(`  ✓ ${name}: ${blocks.length} файлів`);
  }

  await writeFile(CSS_OUT, `${chunks.join('\n')}\n`);
  console.log(`\nРазом ${files} файлів, ${(bytes / 1024).toFixed(0)} kB → public/fonts/`);
  console.log(`CSS: ${path.relative(ROOT, CSS_OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
