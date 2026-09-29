/** Замір: чи справді чип ходу вгорі зліва, а кнопки дій — унизу справа. */
import { spawn } from 'node:child_process';

const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9341;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--no-first-run',
    '--hide-scrollbars',
    `--user-data-dir=/tmp/lux-chrome-measure`,
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
  if (out.exceptionDetails) throw new Error(out.exceptionDetails.text);
  return out.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL_ });
await sleep(3500);
await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Почати гру')); if (b) b.click(); return !!b; })()`);
await sleep(4000);

const report = await evaluate(`
  (() => {
    const vw = innerWidth, vh = innerHeight;
    const walkers = [...document.querySelectorAll('[class*="_walker_"]')];
    const strip = document.querySelector('[class*="_walkStrip_"]');
    const stripStyle = strip ? getComputedStyle(strip) : null;
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
               cx: +((r.left + r.width / 2) / vw * 100).toFixed(1), cy: +((r.top + r.height / 2) / vh * 100).toFixed(1) };
    };
    const hud = document.querySelector('header');
    const footer = document.querySelector('footer');
    return {
      viewport: [vw, vh],
      chip: rect(hud?.firstElementChild ?? null),
      tray: rect(footer?.lastElementChild ?? null),
      lowestPen: Math.max(0, ...[...document.querySelectorAll('button[aria-label]')].map((b) => {
        const r = b.getBoundingClientRect();
        return +((r.top + r.height) / vh * 100).toFixed(1);
      })),
      walkerCount: walkers.length,
      walkerBox: walkers[0] ? (() => { const r = walkers[0].getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })() : null,
      stripLeft: stripStyle?.left ?? null,
      stripWidth: strip ? Math.round(strip.getBoundingClientRect().width) : null,
      framesVar: strip ? getComputedStyle(strip.parentElement).getPropertyValue('--frames').trim() : null,
      walkDuration: strip ? getComputedStyle(strip).animationDuration : null,
      fieldAnim: (() => {
        const field = document.querySelector('[class*="_field_"]');
        if (!field) return null;
        const cs = getComputedStyle(field);
        return cs.animationName + ' / ' + cs.animationDuration;
      })(),
    };
  })()
`);
console.log('поле:', JSON.stringify(report));
await sleep(200);
const after = await evaluate(`
  (() => {
    const strip = document.querySelector('[class*="_walkStrip_"]');
    return strip ? getComputedStyle(strip).left : null;
  })()
`);
console.log(`кадр стрічки: ${report.stripLeft} → ${after} (рухається: ${report.stripLeft !== after ? 'ТАК ✓' : 'НІ ✗'})`);

console.log(JSON.stringify(report, null, 1));

const chip = report.chip;
const tray = report.tray;
const chipTopLeft = chip && chip.cx < 40 && chip.cy < 20;
const trayBottomRight = tray && tray.cx > 60 && tray.cy > 80;
console.log(`\nчип ходу: центр ${chip?.cx}%/${chip?.cy}% → вгорі зліва: ${chipTopLeft ? 'ТАК ✓' : 'НІ ✗'}`);
console.log(`кнопки дій: центр ${tray?.cx}%/${tray?.cy}% → внизу справа: ${trayBottomRight ? 'ТАК ✓' : 'НІ ✗'}`);
console.log(`найнижчий двір сягає ${report.lowestPen}% висоти → інтерфейс його не перекриває: ${report.lowestPen < 88 ? 'ТАК ✓' : 'НІ ✗'}`);
console.log(`спрайтів ходи на полі: ${report.walkerCount} (кадрів у стрічці: ${report.framesVar}, темп ${report.walkDuration})`);
console.log(`анімація перемикання карти: ${report.fieldAnim ?? 'немає ✗'}`);
console.log(chipTopLeft && trayBottomRight ? 'РЕЗУЛЬТАТ: блоки стоять по діагоналі ✅' : 'РЕЗУЛЬТАТ: треба правити ❌');

socket.close();
chrome.kill();
