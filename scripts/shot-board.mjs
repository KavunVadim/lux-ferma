/** Знімок ПК-екрана гри з наповненою картою (для порівняння з концептом). */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const OUT_DIR = process.argv[3] ?? '/tmp/board';
const W = Number(process.argv[4] ?? 1440);
const H = Number(process.argv[5] ?? 900);
const PORT = 9339;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT_DIR, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--no-first-run',
    '--hide-scrollbars',
    '--user-data-dir=/tmp/lux-chrome-board',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function target() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('DevTools не відповідає');
}

const socket = new WebSocket(await target());
await new Promise((res, rej) => {
  socket.addEventListener('open', res, { once: true });
  socket.addEventListener('error', rej, { once: true });
});

let id = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
  else entry.resolve(message.result);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    id += 1;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const out = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (out.exceptionDetails) throw new Error(out.exceptionDetails.text);
  return out.result?.value;
};
const clickText = (text) =>
  evaluate(`(() => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(text)}));
    if (!el) return false; el.click(); return true;
  })()`);
const waitFor = async (expr, tries = 40, delay = 300) => {
  for (let i = 0; i < tries; i += 1) {
    await sleep(delay);
    if (await evaluate(expr)) return true;
  }
  return false;
};
const shoot = async (path) => {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path, Buffer.from(shot.data, 'base64'));
  console.log(`знімок: ${path}`);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await send('Page.navigate', { url: URL_ });
await sleep(2500);
await evaluate(`try { localStorage.clear(); } catch {}`);
await send('Page.reload', { ignoreCache: true });

if (!(await waitFor(`!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Почати гру'))`))) {
  throw new Error('стартовий екран не зʼявився');
}
await clickText('Почати гру');
await waitFor(`!document.querySelector('.overlay')`);

// Наповнюємо двір, щоб на карті було видно спрайти всіх видів.
await evaluate(`
  (() => {
    const raw = JSON.parse(localStorage.getItem('lux-ferma:save'));
    raw.players[0].farm = { duck: 3, goat: 2, pig: 2, horse: 1, cow: 0, sdog: 1, bdog: 1 };
    raw.players[0].total = 8;
    raw.players[1].farm = { duck: 1, goat: 1, pig: 1, horse: 0, cow: 0, sdog: 0, bdog: 0 };
    raw.herd = { duck: 20, goat: 12, pig: 8, horse: 4, cow: 2, sdog: 3, bdog: 2 };
    localStorage.setItem('lux-ferma:save', JSON.stringify(raw));
    return raw.players[0].farm;
  })()
`);
await send('Page.reload', { ignoreCache: true });
await waitFor(`!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Продовжити'))`);
await clickText('Продовжити');
await waitFor(`!document.querySelector('.overlay')`);
await sleep(1200);

const layout = await evaluate(`
  (() => {
    const out = [];
    const walk = (el, depth) => {
      const r = el.getBoundingClientRect();
      if (r.width > 120 && r.height > 60) {
        out.push({
          depth,
          cls: el.className?.toString?.().slice(0, 60) ?? '',
          x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
        });
      }
      if (depth < 3) [...el.children].forEach((child) => walk(child, depth + 1));
    };
    walk(document.body, 0);
    return { viewport: [innerWidth, innerHeight], boxes: out.slice(0, 24) };
  })()
`);
console.log(JSON.stringify(layout, null, 1));

await shoot(`${OUT_DIR}/board-${W}x${H}.png`);

// Порядок такий, як очікує гравець: кубики по центру → карта результату →
// і ЛИШЕ після «Ок, далі» анімація на полі (набіг / прибуття + «±N»).
await evaluate(`window.__origRandom = Math.random; Math.random = () => 0.999;`);
await clickText('Кинути кубики');
await sleep(650);
await shoot(`${OUT_DIR}/board-roll-${W}x${H}.png`);
await sleep(1100);
await shoot(`${OUT_DIR}/board-card-${W}x${H}.png`);

// Поки карта на екрані — на полі ще нічого не сталося (перевірка нижче).
const beforeOk = await evaluate(`document.querySelectorAll('[class*="_raider_"]').length`);

await clickText('Ок, далі');
await sleep(500);
await shoot(`${OUT_DIR}/board-raid-${W}x${H}.png`);
const afterOk = await evaluate(`document.querySelectorAll('[class*="_raider_"]').length`);
console.log(`хижаків на полі до «Ок, далі»: ${beforeOk}, після: ${afterOk}`);

await sleep(1500);
await shoot(`${OUT_DIR}/board-result-${W}x${H}.png`);
await sleep(2600);

// Найкращий результат (качка + качка): прибуття тварин і сердечка.
await clickText('Завершити хід');
await sleep(3400);
await evaluate(`Math.random = () => 0.0;`);
await clickText('Кинути кубики');
await sleep(1900);
await clickText('Ок, далі');
await sleep(900);
await shoot(`${OUT_DIR}/board-born-${W}x${H}.png`);
await evaluate(`Math.random = window.__origRandom;`);
await sleep(2400);

// Обмін: перевіряємо двоколонкову панель (вгору зліва / вниз справа).
// Спершу завершуємо хід — інакше обмін заблокований (він лише перед кидком).
await clickText('Завершити хід');
await sleep(3400);
await clickText('Обмін');
await sleep(700);
await shoot(`${OUT_DIR}/board-trade-${W}x${H}.png`);
await clickText('Готово');
await sleep(500);

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await sleep(900);
await shoot(`${OUT_DIR}/board-mobile.png`);
socket.close();
chrome.kill();
