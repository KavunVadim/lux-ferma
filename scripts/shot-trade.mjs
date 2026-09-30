/**
 * Знімок панелі «Обмін тварин» на iPhone 390×844.
 *
 * Перевіряє головне: чи видно напрямок (вгору/вниз) двома колонками, чи
 * панель влазить у екран без прокрутки, і чи не ріжуться підписи карток.
 *
 * Запуск: node scripts/shot-trade.mjs [url]
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9362;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-shot-trade', 'about:blank'],
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
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
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
  await s.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await s.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await s.send('Page.navigate', { url: URL_ });
  await sleep(2800);

  const clickText = (t) => s.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(t)})); if(!b) return false; b.click(); return true; })()`);
  const waitFor = async (expr, tries = 40, delay = 250) => { for (let i=0;i<tries;i+=1){ if (await s.eval(expr)) return true; await sleep(delay);} return false; };

  await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Почати гру'))`);
  await clickText('Почати гру');
  await sleep(700);
  for (let i = 0; i < 20; i += 1) {
    if (!(await s.eval(`!!document.querySelector('[class*="handoff"]')`))) break;
    await sleep(300);
  }

  // Даємо ферму з тваринами, щоб було що міняти: снизу вгору видно обидва напрямки.
  await s.eval(`
    (() => {
      const raw = JSON.parse(localStorage.getItem('lux-ferma:save'));
      raw.players[0].farm = { duck: 8, goat: 3, pig: 2, horse: 1, cow: 0, sdog: 1, bdog: 0 };
      localStorage.setItem('lux-ferma:save', JSON.stringify(raw));
      return true;
    })()
  `);
  await s.send('Page.reload', { ignoreCache: true });
  await sleep(2800);
  await clickText('Продовжити');
  await sleep(700);
  for (let i = 0; i < 20; i += 1) {
    if (!(await s.eval(`!!document.querySelector('[class*="handoff"]')`))) break;
    await sleep(300);
  }

  await clickText('Обмін');
  await waitFor(`!!document.querySelector('[class*="tradeColumns"]')`);
  await sleep(600);

  const open = await s.eval(`!!document.querySelector('[class*="tradeColumns"]')`);
  console.log(`панель обміну відкрита: ${open ? 'так' : 'НІ'}`);

  if (open) {
    const info = await s.eval(`(() => {
      const columns = document.querySelector('[class*="tradeColumns"]');
      const styles = columns ? getComputedStyle(columns) : null;
      const box = columns?.getBoundingClientRect();
      const groups = [...document.querySelectorAll('[class*="tradeGroup"]')];
      // Скільки карток обміну в кожній колонці
      const perColumn = [...document.querySelectorAll('[class*="tradeColumn"]')].map((c) => c.querySelectorAll('[class*="tradeOption"]').length);
      // Чи ріжеться текст у картках
      const clipped = [...document.querySelectorAll('[class*="tradeOption"]')].filter((el) => el.scrollWidth > el.clientWidth + 2).length;
      return {
        tracks: styles?.gridTemplateColumns ?? '—',
        columns: perColumn,
        groups: groups.length,
        width: Math.round(box?.width ?? 0),
        height: Math.round(box?.height ?? 0),
        clipped,
        viewport: { w: innerWidth, h: innerHeight },
        scrollable: document.documentElement.scrollHeight > innerHeight + 4,
      };
    })()`);
    console.log('обмін:', JSON.stringify(info));

    const heads = await s.eval(`JSON.stringify([...document.querySelectorAll('[class*="groupHead"]')].map((el) => el.textContent.trim()))`);
    console.log('напрямки:', heads);

    const arrow = await s.eval(`JSON.stringify([...document.querySelectorAll('[class*="tradeOption"]')].slice(0, 3).map((el) => el.textContent.replace(/\\s+/g, ' ').trim()))`);
    console.log('перші картки:', arrow);
  }

  await s.shoot('/tmp/trade-mobile.png');
  console.log('Знімок: /tmp/trade-mobile.png');
}

run().then(() => { chrome.kill(); process.exit(0); })
  .catch((e) => { console.error('ПОМИЛКА:', e.message); chrome.kill(); process.exit(1); });
