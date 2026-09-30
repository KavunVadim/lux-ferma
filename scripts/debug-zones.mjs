/**
 * Діагностика координат: де насправді загін качок і де хижак.
 *
 * Друкує в одному масштабі (координати КАРТИ, не екрана) центри загонів і
 * позицію хижака в різні моменти. Без цього неможливо зрозуміти, чому
 * відсотки з ZONES не збігаються з місцем на екрані.
 *
 * Запуск: node scripts/debug-zones.mjs [url]
 */
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9376;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-zones', '--window-size=1440,900', 'about:blank'],
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

const geom = await s.eval(`(() => {
  const canvas = document.querySelector('[class*="_canvas_"]');
  const field = document.querySelector('[class*="_field_"]');
  const cr = canvas?.getBoundingClientRect();
  const fr = field?.getBoundingClientRect();
  const zones = [...document.querySelectorAll('button[aria-label]')].map((b) => {
    const r = b.getBoundingClientRect();
    return {
      label: b.getAttribute('aria-label'),
      // у пікселях екрана
      ecx: Math.round(r.left + r.width / 2),
      ecy: Math.round(r.top + r.height / 2),
      // у відсотках від КАРТИ (те, що має бути в конфізі)
      canvasXPct: cr ? +(((r.left + r.width / 2 - cr.left) / cr.width) * 100).toFixed(2) : null,
      canvasYPct: cr ? +(((r.top + r.height / 2 - cr.top) / cr.height) * 100).toFixed(2) : null,
      wPct: cr ? +((r.width / cr.width) * 100).toFixed(2) : null,
    };
  });
  return {
    canvas: cr ? { left: Math.round(cr.left), top: Math.round(cr.top), w: Math.round(cr.width), h: Math.round(cr.height) } : null,
    field: fr ? { left: Math.round(fr.left), top: Math.round(fr.top), w: Math.round(fr.width), h: Math.round(fr.height) } : null,
    viewport: { w: innerWidth, h: innerHeight },
    zones,
  };
})()`);
console.log(JSON.stringify(geom, null, 1));

socket.close();
chrome.kill();
process.exit(0);
