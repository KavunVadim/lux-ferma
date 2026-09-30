/**
 * Знімок інструкції (правил гри) на телефоні.
 *
 * Прокручує шит і знімає його частинами — щоб побачити всю інструкцію
 * очима, а не лише перший екран.
 *
 * Запуск: node scripts/shot-rules.mjs [url]
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9372;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-rules', 'about:blank'],
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
  await s.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await s.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  // Світла тема: правила читають за столом при денному світлі.
  await s.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await s.send('Page.navigate', { url: URL_ });
  await sleep(2600);

  const origin = await s.eval('location.origin');
  if (!origin.startsWith('http')) throw new Error(`сторінка не завантажилась: ${origin}`);

  const click = (t) => s.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(t)})); if(!b) return false; b.click(); return true; })()`);
  const waitFor = async (expr, tries = 40, delay = 250) => { for (let i=0;i<tries;i+=1){ if (await s.eval(expr)) return true; await sleep(delay);} return false; };

  // На стартовому екрані кнопка зветься «📖 Як грати»; у грі — «?».
  const opened = await s.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => /як грати|правила/i.test(x.textContent) || /правила/i.test(x.getAttribute('aria-label') ?? ''),
    );
    if (!b) return false;
    b.click();
    return true;
  })()`);
  if (!opened) throw new Error('кнопка «Як грати» не знайдена');
  await waitFor(`!!document.querySelector('[class*="ruleCard"]')`);
  await sleep(700);

  const info = await s.eval(`(() => {
    const cards = [...document.querySelectorAll('[class*="ruleCard"]')];
    const sheet = document.querySelector('.sheet');
    return {
      карток: cards.length,
      заголовки: cards.map((c) => c.querySelector('h3')?.textContent?.trim()),
      висотаШита: sheet?.scrollHeight ?? 0,
      ширина: innerWidth,
    };
  })()`);
  console.log('інструкція:', JSON.stringify(info, null, 1));

  await s.shoot('/tmp/rules-top.png');

  // Прокручуємо шит униз частинами.
  await s.eval(`(() => {
    const sheet = document.querySelector('.sheet');
    if (sheet) sheet.scrollTop = sheet.scrollHeight * 0.45;
    return sheet ? sheet.scrollTop : null;
  })()`);
  await sleep(500);
  await s.shoot('/tmp/rules-mid.png');

  await s.eval(`(() => {
    const sheet = document.querySelector('.sheet');
    if (sheet) sheet.scrollTop = sheet.scrollHeight;
    return true;
  })()`);
  await sleep(500);
  await s.shoot('/tmp/rules-bottom.png');

  console.log('Знімки: /tmp/rules-top.png, rules-mid.png, rules-bottom.png');
}

run().then(() => { chrome.kill(); process.exit(0); })
  .catch((e) => { console.error('ПОМИЛКА:', e.message); chrome.kill(); process.exit(1); });
