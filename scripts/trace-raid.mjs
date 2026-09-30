/**
 * Трасування маршруту хижака: друкує позицію кожні 200 мс.
 *
 * Потрібно, щоб побачити РЕАЛЬНИЙ рух (не вгадувати за кадрами) і зрозуміти,
 * чи встигає гравець простежити маршрут, чи лисиця проскакує надто швидко.
 *
 * Запуск: node scripts/trace-raid.mjs [url]
 */
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9375;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-trace', '--window-size=1440,900', 'about:blank'],
  { stdio: 'ignore' },
);

async function debuggerUrl() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('DevTools не відповідає');
}

class Session {
  constructor(socket) {
    this.socket = socket; this.id = 0; this.pending = new Map();
    socket.addEventListener('message', (e) => {
      const m = JSON.parse(e.data); const p = this.pending.get(m.id);
      if (!p) return; this.pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params })); });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }
}

const socket = new WebSocket(await debuggerUrl());
await new Promise((res, rej) => { socket.addEventListener('open', res); socket.addEventListener('error', () => rej(new Error('WS'))); });
const s = new Session(socket);
await s.send('Page.enable');
await s.send('Runtime.enable');
await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await s.send('Page.navigate', { url: URL_ });
await sleep(3000);

const origin = await s.eval('location.origin');
if (!origin.startsWith('http')) throw new Error(`сторінка не завантажилась: ${origin}`);

const click = (t) => s.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(t)})); if(!b) return false; b.click(); return true; })()`);
const waitFor = async (expr, tries = 50, delay = 250) => { for (let i=0;i<tries;i+=1){ if (await s.eval(expr)) return true; await sleep(delay);} return false; };

if (await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Почати гру'))`, 20, 300)) {
  await click('Почати гру');
  await sleep(1200);
}
for (let i = 0; i < 20; i += 1) {
  if (!(await s.eval(`!!document.querySelector('[class*="handoff"]')`))) break;
  await sleep(300);
}

await s.eval(`(() => {
  const raw = JSON.parse(localStorage.getItem('lux-ferma:save'));
  raw.players[0].farm = { duck: 6, goat: 3, pig: 2, horse: 1, cow: 1, sdog: 0, bdog: 0 };
  localStorage.setItem('lux-ferma:save', JSON.stringify(raw));
  return true;
})()`);
await s.send('Page.reload', { ignoreCache: true });
await sleep(3000);
const resumed = await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Продовжити'))`, 20, 300);
if (resumed) await click('Продовжити');
await sleep(1200);
for (let i = 0; i < 20; i += 1) {
  if (!(await s.eval(`!!document.querySelector('[class*="handoff"]')`))) break;
  await sleep(300);
}

await s.eval('Math.random = () => 0.96;');
await click('Кинути кубики');
const okReady = await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim() === 'Ок, далі')`, 60, 250);
if (!okReady) throw new Error('модалка не зʼявилась');
await click('Ок, далі');

// Трасуємо кожні 150 мс.
const t0 = Date.now();
const rows = [];
for (let i = 0; i < 26; i += 1) {
  /*
   * Порівнюємо хижака з ЦЕНТРОМ ЗАГОНУ, а не з координатами екрана.
   *
   * Карта (`.canvas`) ширша за екран, і `left` у відсотках рахується від неї,
   * тож «36% екрана» і «36% карти» — різні місця. Єдиний надійний спосіб
   * зрозуміти, чи хижак стоїть де треба, — порівняти його центр із центром
   * самого загону на екрані.
   */
  /*
   * Міряємо У ВІДСОТКАХ КАРТИ — тій самій системі, де живуть ZONES.
   *
   * Раніше я міряв пікселі екрана: карта ширша за екран (масштаб «cover»),
   * тож «36%» на екрані й «36%» на карті — різні місця, і я щоразу бачив
   * «не доходить», хоча на карті все було правильно.
   */
  const pos = await s.eval(`(() => {
    const el = document.querySelector('[class*="raidRun"]');
    const canvas = document.querySelector('[class*="_canvas_"]');
    if (!el || !canvas) return null;
    const cr = canvas.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const pctOf = (px, base, origin) => +(((px - origin) / base) * 100).toFixed(1);
    const zoneOf = (name) => {
      const z = [...document.querySelectorAll('button[aria-label]')].find((b) => b.getAttribute('aria-label')?.startsWith(name));
      if (!z) return null;
      const zr = z.getBoundingClientRect();
      return {
        x: pctOf(zr.left + zr.width / 2, cr.width, cr.left),
        y: pctOf(zr.top + zr.height / 2, cr.height, cr.top),
      };
    };
    const at = { x: pctOf(r.left + r.width / 2, cr.width, cr.left), y: pctOf(r.top + r.height / 2, cr.height, cr.top) };
    // Читаємо CSS-змінні, які реально бачить елемент: якщо вони порожні,
    // keyframes не мають куди їхати (відома особливість @keyframes).
    const cs2 = getComputedStyle(el);
    const duck = zoneOf('Качки');
    const goat = zoneOf('Кози');
    return {
      at,
      vars: {
        s0x: cs2.getPropertyValue('--stop-0-x').trim(),
        s0y: cs2.getPropertyValue('--stop-0-y').trim(),
        s1x: cs2.getPropertyValue('--stop-1-x').trim(),
        s1y: cs2.getPropertyValue('--stop-1-y').trim(),
      },
      inlineStyle: el.getAttribute('style')?.slice(0, 120) ?? '',
      duck,
      goat,
      dDuck: duck ? +Math.hypot(at.x - duck.x, at.y - duck.y).toFixed(1) : null,
      dGoat: goat ? +Math.hypot(at.x - goat.x, at.y - goat.y).toFixed(1) : null,
      opacity: +(parseFloat(cs.opacity)).toFixed(2),
    };
  })()`);
  rows.push({ t: Date.now() - t0, ...(pos ?? { gone: true }) });
  await sleep(150);
}

console.log('час | позиція (у % карти) | до качок | до кіз | прозорість');
for (const r of rows) {
  if (r.gone) { console.log(`${String(r.t).padStart(4)} | елемента немає`); continue; }
  console.log(
    `${String(r.t).padStart(4)} | ${String(r.at.x).padStart(5)}%,${String(r.at.y).padStart(5)}% | ` +
    `${String(r.dDuck ?? '—').padStart(6)}% | ${String(r.dGoat ?? '—').padStart(6)}% | ${r.opacity}`,
  );
}
console.log('\nCSS-змінні, які бачить елемент:', JSON.stringify(rows.find((r) => r.vars)?.vars));
console.log('inline style:', rows.find((r) => r.inlineStyle)?.inlineStyle);
console.log('\nцілі: качки ≈36%, кози ≈64.5%');
const ducks = rows.find((r) => r.dDuck !== null && r.dDuck < 4);
const goats = rows.find((r) => r.dGoat !== null && r.dGoat < 4);
console.log(`стояв біля качок: ${ducks ? `так, ${ducks.t} мс (відхилення ${ducks.dDuck}%)` : 'НІ'}`);
console.log(`стояв біля кіз:   ${goats ? `так, ${goats.t} мс (відхилення ${goats.dGoat}%)` : 'НІ'}`);
socket.close();
chrome.kill();
process.exit(0);
