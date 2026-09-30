/**
 * Знімок набігу хижака на ПК-сцені — кадри через рівні проміжки часу.
 *
 * Перевіряє маршрут: лисиця вбігає зліва → качки → кози → розворот → втеча.
 * Знімаємо шість кадрів упродовж 3.5с, щоб побачити всю подорож.
 *
 * Запуск: node scripts/shot-raid.mjs [url]
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/?editor=1';
const PORT = 9374;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-raid', '--window-size=1440,900', 'about:blank'],
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
  async shoot(path) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path, Buffer.from(data, 'base64'));
    return path;
  }
}

async function run() {
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

  // Стартуємо партію (на ПК є кнопка «Почати гру»).
  if (await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Почати гру'))`, 20, 300)) {
    await click('Почати гру');
    await sleep(1200);
  }
  for (let i = 0; i < 20; i += 1) {
    if (!(await s.eval(`!!document.querySelector('[class*="handoff"]')`))) break;
    await sleep(300);
  }

  // Ферма з качками й козами: лисиці буде що красти.
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

  // Лисиця — це грань 11 із 12 на другому кубику: random ≈ 0.96.
  await s.eval('Math.random = () => 0.96;');
  await click('Кинути кубики');
  const okReady = await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim() === 'Ок, далі')`, 60, 250);
  if (!okReady) throw new Error('модалка результату не зʼявилась');
  await click('Ок, далі');

  // Знімаємо кадри подорожі: 3.5с анімації → шість кадрів.
  const shots = [];
  for (let i = 0; i < 6; i += 1) {
    await sleep(560);
    const name = `/tmp/raid-${i + 1}.png`;
    await s.shoot(name);
    const pos = await s.eval(`(() => {
      const el = document.querySelector('[class*="raidRun"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width), visible: r.width > 0 };
    })()`);
    shots.push({ name, pos });
  }

  console.log('кадри набігу:');
  for (const item of shots) console.log(`  ${item.name}: ${JSON.stringify(item.pos)}`);
  console.log('хижак знайдений:', await s.eval(`!!document.querySelector('[class*="raidRun"]')`));
}

run().then(() => { chrome.kill(); process.exit(0); })
  .catch((e) => { console.error('ПОМИЛКА:', e.message); chrome.kill(); process.exit(1); });
