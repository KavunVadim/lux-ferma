/**
 * Знімок мобільного екрана в грі без оверлеїв — для очного контролю верстки.
 * Прокручує список дворів і знімає обидві частини.
 *
 * Запуск: node scripts/shot-mobile.mjs [url]
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9361;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-shot-mobile', 'about:blank'],
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
  await s.shoot('/tmp/mobile-start.png');
  await clickText('Почати гру');
  await sleep(700);
  // Чекаємо, поки оверлей передачі сам зникне
  for (let i = 0; i < 20; i += 1) {
    if (!(await s.eval(`!!document.querySelector('[class*="handoff"]')`))) break;
    await sleep(300);
  }

  // Даємо тварин, щоб було видно заповнені двори
  await s.eval(`
    (() => {
      const raw = JSON.parse(localStorage.getItem('lux-ferma:save'));
      raw.players[0].farm = { duck: 4, goat: 2, pig: 2, horse: 1, cow: 0, sdog: 1, bdog: 0 };
      raw.players[0].herd = raw.players[0].herd;
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

  await s.shoot('/tmp/mobile-farm-top.png');

  // Прокручуємо список дворів донизу
  await s.eval(`(() => {
    const list = document.querySelector('[class*="_pens_"]');
    if (list) list.scrollTop = list.scrollHeight;
    return list ? list.scrollTop : null;
  })()`);
  await sleep(500);
  await s.shoot('/tmp/mobile-farm-bottom.png');

  // Скільки дворів реально видно без прокрутки
  const fits = await s.eval(`(() => {
    const list = document.querySelector('[class*="_pens_"]');
    if (!list) return null;
    const pens = [...list.querySelectorAll('[class*="_pen_"]')];
    const listBox = list.getBoundingClientRect();
    const visible = pens.filter((p) => {
      const r = p.getBoundingClientRect();
      return r.top >= listBox.top - 1 && r.bottom <= listBox.bottom + 1;
    }).length;
    return { total: pens.length, visibleWithoutScroll: visible, scrollable: list.scrollHeight > list.clientHeight + 4 };
  })()`);
  console.log('двори:', JSON.stringify(fits));
  console.log('Знімки: /tmp/mobile-start.png, mobile-farm-top.png, mobile-farm-bottom.png');
}

run().then(() => { chrome.kill(); process.exit(0); })
  .catch((e) => { console.error('ПОМИЛКА:', e.message); chrome.kill(); process.exit(1); });
