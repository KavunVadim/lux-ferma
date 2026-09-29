/**
 * Чи видно на полі КОЖНУ тварину.
 *
 * Перевіряє не «на око», а через DOM: у кожному загоні рахує спрайти, читає
 * `naturalWidth` кожного зображення (0 = файл не завантажився) і збирає, які
 * саме файли підставлені. Потім примусово викликає набіг хижаків (Math.random
 * → 0.999) і перевіряє, чи з'явився лисиця/ведмідь і чи їхні кадри завантажились.
 *
 * Запуск: node scripts/check-animals.mjs [url]
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9346;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--no-first-run',
    '--hide-scrollbars',
    `--user-data-dir=/tmp/lux-chrome-animals-${Date.now()}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function target() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('no devtools');
}

const socket = new WebSocket(await target());
await new Promise((res, rej) => {
  socket.addEventListener('open', res, { once: true });
  socket.addEventListener('error', rej, { once: true });
});
let id = 0;
const pending = new Map();
socket.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  const entry = pending.get(m.id);
  if (!entry) return;
  pending.delete(m.id);
  if (m.error) entry.reject(new Error(JSON.stringify(m.error)));
  else entry.resolve(m.result);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    id += 1;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const out = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (out.exceptionDetails) {
    throw new Error(out.exceptionDetails.exception?.description ?? out.exceptionDetails.text);
  }
  return out.result?.value;
};
const clickText = (text) =>
  evaluate(`(() => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(text)}));
    if (!el) return false; el.click(); return true;
  })()`);
const shoot = async (path) => {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path, Buffer.from(shot.data, 'base64'));
  console.log(`знімок: ${path}`);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await send('Page.navigate', { url: URL_ });
await sleep(3200);
await evaluate(`try { localStorage.clear(); } catch {}`);
await send('Page.reload', { ignoreCache: true });
await sleep(3200);
await clickText('Почати гру');
await sleep(3600);
await clickText('Ок, далі');
await sleep(600);

// По 3 тварини кожного виду — щоб перевіряти було що.
await evaluate(`
  (() => {
    const s = JSON.parse(localStorage.getItem('lux-ferma:save'));
    const farm = { duck: 3, goat: 3, pig: 3, horse: 3, cow: 3, sdog: 3, bdog: 3 };
    s.players[0].farm = { ...farm };
    s.players[0].total = 21;
    s.players[1].farm = { duck: 1, goat: 1, pig: 1, horse: 1, cow: 1, sdog: 1, bdog: 1 };
    s.herd = { duck: 30, goat: 30, pig: 20, horse: 12, cow: 10, sdog: 6, bdog: 6 };
    localStorage.setItem('lux-ferma:save', JSON.stringify(s));
    return true;
  })()
`);
await send('Page.reload', { ignoreCache: true });
await sleep(3000);
await clickText('Продовжити');
await sleep(3600);
await clickText('Ок, далі');
await sleep(900);

const inventory = await evaluate(`
  (() => {
    const rows = [];
    for (const box of document.querySelectorAll('[class*="tokens"]')) {
      const zone = box.parentElement;
      const label = zone?.querySelector('[class*="sign"] b')?.textContent ?? '?';
      const slots = [...box.querySelectorAll('[class*="slot"]')];
      const images = slots.map((slot) => {
        const img = slot.querySelector('img');
        if (!img) return { emoji: slot.textContent.trim(), src: null, loaded: null };
        return { emoji: null, src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0 };
      });
      rows.push({
        загін: label,
        спрайтів: slots.length,
        зображень: images.filter((i) => i.src).length,
        завантажено: images.filter((i) => i.loaded === true).length,
        битих: images.filter((i) => i.loaded === false).length,
        емодзі: images.filter((i) => i.emoji).map((i) => i.emoji),
        файли: [...new Set(images.map((i) => (i.src ?? '').split('/').slice(-2).join('/')))].filter(Boolean),
      });
    }
    return rows;
  })()
`);

console.log('\nщо зараз на полі (по 3 тварини кожного виду):');
for (const row of inventory) {
  console.log(
    `  ${row.загін.padEnd(8)} спрайтів ${row.спрайтів} · зображень ${row.зображень} · завантажено ${row.завантажено} · битих ${row.битих}` +
      `${row.емодзі.length ? ` · ЕМОДЗІ ${row.емодзі.join(',')}` : ''} · ${row.файли.join(', ')}`,
  );
}
const broken = inventory.reduce((sum, row) => sum + row.битих, 0);
const emoji = inventory.reduce((sum, row) => sum + row.емодзі.length, 0);

// Статичні спрайти хижаків узагалі доступні?
const assets = await evaluate(`
  (async () => {
    const urls = ['assets/animals/fox.webp', 'assets/animals/bear.webp', 'assets/walk/fox.webp', 'assets/walk/bear.webp'];
    const out = {};
    for (const url of urls) {
      const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
      out[url] = res ? res.status : 'помилка мережі';
    }
    return out;
  })()
`);
console.log('\nфайли хижаків:', JSON.stringify(assets));

/* ── Набіг хижаків: чи справді ВИДНО на екрані ── */
// Лишаємо лише качок/кіз: тоді лисиці є що красти, і партія не завершується перемогою.
await evaluate(`
  (() => {
    const s = JSON.parse(localStorage.getItem('lux-ferma:save'));
    s.players[0].farm = { duck: 2, goat: 2, pig: 0, horse: 0, cow: 0, sdog: 2, bdog: 2 };
    s.players[0].total = 8;
    localStorage.setItem('lux-ferma:save', JSON.stringify(s));
    return true;
  })()
`);
await send('Page.reload', { ignoreCache: true });
await sleep(3000);
await clickText('Продовжити');
await sleep(3400);
await clickText('Ок, далі');
await sleep(800);

await evaluate(`window.__origRandom = Math.random; Math.random = () => 0.999;`);
await clickText('Кинути кубики');
await sleep(2600);
await clickText('Ок, далі');

const raidProbe = `(() => {
  const el = document.querySelector('[class*="raider"]');
  if (!el) return null;
  const cs = getComputedStyle(el);
  const box = el.getBoundingClientRect();
  const img = el.querySelector('img');
  const sprite = el.querySelector('[class*="raiderSprite"]');
  const spriteTransform = sprite ? getComputedStyle(sprite).transform : 'немає';
  const flipped = /matrix\\(-/.test(spriteTransform);
  const insideViewport = box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight;
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    w: Math.round(box.width),
    op: Number(cs.opacity).toFixed(2),
    видно: insideViewport && Number(cs.opacity) > 0.4,
    дивиться: flipped ? 'ВЛІВО (у ліс)' : 'вправо',
    файл: (img?.getAttribute('src') ?? 'емодзі').split('/').slice(-2).join('/'),
  };
})()`;

const timeline = [];
for (let step = 0; step < 16; step += 1) {
  timeline.push({ t: `${(step * 0.2).toFixed(1)}с`, ...(await evaluate(raidProbe)) });
  if (step === 9) await shoot('/tmp/raid-flee.png');
  await sleep(200);
}
console.log('\nнабіг по кадрах (видно = у межах екрана і не прозорий):');
for (const row of timeline) {
  if (!row || row.x === undefined) {
    console.log(`  ${row?.t ?? '?'} — хижака немає на полі`);
    continue;
  }
  console.log(
    `  ${row.t}  x=${String(row.x).padStart(5)} y=${String(row.y).padStart(4)} розмір ${row.w}px  прозорість ${row.op}  ` +
      `${row.видно ? 'ВИДНО ✓' : '—'}  дивиться ${row.дивиться}  ${row.файл}`,
  );
}
const visibleFrames = timeline.filter((row) => row?.видно).length;
console.log(`\nвидимий ${visibleFrames} із ${timeline.length} замірів (≈${(visibleFrames * 0.2).toFixed(1)} с)`);
await shoot('/tmp/animals-raid.png');
await evaluate(`Math.random = window.__origRandom;`);

/* ── Кнопка «Показати набіг лисиці» в налаштуваннях ── */
await sleep(1200);
await clickText('⚙️');
await sleep(800);
const openedSettings = await evaluate(`!!document.querySelector('.sheet')`);
const clickedPreview = await clickText('Показати набіг лисиці');
await sleep(700);
const preview = await evaluate(raidProbe);
console.log(
  `\nкнопка перевірки анімацій: налаштування ${openedSettings ? 'відкрились ✓' : 'не відкрились ✗'}, ` +
    `натиснулась ${clickedPreview ? '✓' : '✗'} → ${preview ? `x=${preview.x} прозорість ${preview.op} ${preview.видно ? 'ВИДНО ✓' : '—'}` : 'набігу немає ✗'}`,
);
await shoot('/tmp/preview-raid.png');

console.log(
  `\nВИСНОВОК: битих зображень ${broken}, емодзі-фолбеків ${emoji}` +
    `${broken === 0 && emoji === 0 ? ' — усі тварини видно ✅' : ' — є проблема ❌'}`,
);
socket.close();
chrome.kill();
