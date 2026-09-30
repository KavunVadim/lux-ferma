/**
 * Знімок модалки результату з новим блоком розрахунку.
 * Прокручує сценарій: кидок з парою (щоб побачити «пара склалась») і без пари.
 *
 * Запуск: node scripts/shot-result.mjs [url]
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9363;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-result', '--window-size=420,900', 'about:blank'],
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

async function scenario(s, label, { seed, random, screenshot }) {
  await s.eval('try { localStorage.clear(); } catch {}');
  await s.send('Page.navigate', { url: URL_ });
  await sleep(2600);

  const clickText = (t) => s.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(t)})); if(!b) return false; b.click(); return true; })()`);
  const waitFor = async (expr, tries = 40, delay = 250) => { for (let i=0;i<tries;i+=1){ if (await s.eval(expr)) return true; await sleep(delay);} return false; };

  await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Почати гру'))`);
  await clickText('Почати гру');
  await sleep(800);

  // Кладемо у двір рівно одну качку, щоб було видно «до пари 1/2»
  await s.eval(`
    (() => {
      const raw = JSON.parse(localStorage.getItem('lux-ferma:save'));
      raw.players[0].farm = { duck: ${seed}, goat: ${seed > 1 ? seed : 0}, pig: 0, horse: 0, cow: 0, sdog: 0, bdog: 0 };
      raw.herd.duck = 58;
      localStorage.setItem('lux-ferma:save', JSON.stringify(raw));
      return true;
    })()
  `);
  await s.send('Page.reload', { ignoreCache: true });
  await sleep(2600);
  await clickText('Продовжити');
  await sleep(900);
  for (let i = 0; i < 20; i += 1) {
    if (!(await s.eval(`!!document.querySelector('[class*="handoff"]')`))) break;
    await sleep(300);
  }

  await s.eval(`Math.random = () => ${random};`);
  await clickText('Кинути кубики');
  await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Ок'))`, 40, 300);
  await sleep(600);
  await s.shoot(screenshot);
  const text = await s.eval(`document.querySelector('.overlay')?.innerText.replace(/\\s+/g,' ').slice(0,300) ?? ''`);
  console.log(`${label}: ${text}`);
  console.log(`  знімок: ${screenshot}`);
}

async function run() {
  const socket = new WebSocket(await debuggerUrl());
  await new Promise((res, rej) => { socket.addEventListener('open', res); socket.addEventListener('error', () => rej(new Error('WS'))); });
  const s = new Session(socket);
  await s.send('Page.enable');
  await s.send('Runtime.enable');
  await s.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 880, deviceScaleFactor: 2, mobile: true });

  // 1) Пара НЕ склалась: у дворі 1 качка, кубики дають +1 → 2 → пара
  await scenario(s, 'Пара склалась (1 качка + 1 з кубика)', { seed: 1, random: 0.02, screenshot: '/tmp/result-pair.png' });

  // 2) Пари нема: у дворі 3 качки, кубики дають +1 → 4 → 2 пари
  await scenario(s, 'Дві пари (3 качки + 1 з кубика)', { seed: 3, random: 0.02, screenshot: '/tmp/result-pairs.png' });
}

run().then(() => { chrome.kill(); process.exit(0); })
  .catch((e) => { console.error('ПОМИЛКА:', e.message); chrome.kill(); process.exit(1); });
