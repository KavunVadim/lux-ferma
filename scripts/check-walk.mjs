/**
 * Перевірка ходи тварин і редактора карти.
 *
 * 1) Хода: міряємо computed transform стрічки кадрів у трьох точках часу.
 *    Різниця має дорівнювати рівно одній комірці (ширина стрічки / --frames),
 *    а видима частина стрічки — лежати всередині комірки. Якщо стрічка зсунута
 *    відсотками від СВОЄЇ ширини помилково (як було з -frames×100%), видима
 *    ширина стає нульовою — тварина «мерегкотить» і зникає.
 *
 * 2) Редактор: відкриваємо ?editor=1 і рахуємо маркери/панель.
 *
 * Запуск: node scripts/check-walk.mjs [url]
 */
import { spawn } from 'node:child_process';

const URL_ = process.argv[2] ?? 'http://localhost:4173/';
const PORT = 9345;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--no-first-run',
    '--hide-scrollbars',
    `--user-data-dir=/tmp/lux-chrome-walk-${Date.now()}`,
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
  const { writeFileSync } = await import('node:fs');
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path, Buffer.from(shot.data, 'base64'));
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
// Багато тварин, щоб було що міряти.
await evaluate(`
  (() => {
    const s = JSON.parse(localStorage.getItem('lux-ferma:save'));
    s.players[0].farm = { duck: 4, goat: 3, pig: 3, horse: 2, cow: 2, sdog: 2, bdog: 2 };
    s.players[1].farm = { duck: 2, goat: 1, pig: 1, horse: 1, cow: 1, sdog: 1, bdog: 1 };
    s.herd = { duck: 30, goat: 20, pig: 12, horse: 8, cow: 6, sdog: 4, bdog: 4 };
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

const stripProbe = `(() => {
  const strip = document.querySelector('[class*="walkStrip"]');
  const walker = strip?.parentElement;
  if (!strip || !walker) return { found: false };
  const s = strip.getBoundingClientRect();
  const w = walker.getBoundingClientRect();
  const frames = getComputedStyle(strip).getPropertyValue('--frames').trim();
  return {
    found: true,
    matrix: getComputedStyle(strip).transform,
    stripWidth: +s.width.toFixed(1),
    cellWidth: +w.width.toFixed(1),
    frames,
    // Скільки пікселів стрічки реально видно в комірці (мусить дорівнювати комірці).
    visible: +Math.max(0, Math.min(s.right, w.right) - Math.max(s.left, w.left)).toFixed(1),
    inside: s.left <= w.left + 1,
  };
})()`;

const first = await evaluate(stripProbe);
await sleep(260);
const second = await evaluate(stripProbe);

const cell = first.stripWidth / Number(first.frames || 1);
const parseX = (m) => {
  if (!m || m === 'none') return 0;
  const parts = m.match(/matrix3?d?\(([^)]+)\)/);
  if (!parts) return 0;
  const values = parts[1].split(',').map(Number);
  return m.startsWith('matrix3d') ? values[12] : values[4];
};
const shift = Math.abs(parseX(second.matrix) - parseX(first.matrix));

console.log('стрічка ходи:', JSON.stringify({ ...first, second: second.matrix }));
console.log(`комірка ${cell.toFixed(1)}px · зсув за 260 мс: ${shift.toFixed(1)}px · видимо в комірці: ${first.visible}px з ${first.cellWidth}px`);
console.log(
  first.found && first.visible >= first.cellWidth - 2
    ? '✓ тварина не зникає: стрічка весь час закриває комірку'
    : '✗ стрічка виходить за межі комірки — тварина блимала б',
);
if (first.frames && Math.abs((shift % cell) - 0) > 2 && shift > 0) {
  console.log(`✓ зсув кратний комірці (${shift.toFixed(1)} / ${cell.toFixed(1)} = ${(shift / cell).toFixed(2)})`);
}
await shoot('/tmp/walk-check.png');

/* ── Редактор карти: має відкриватися одним посиланням, без кліків ── */
await send('Page.navigate', { url: `${URL_.replace(/\/$/, '')}/?editor=1` });
await sleep(3200);
await evaluate(`try { localStorage.clear(); } catch {}`);
await send('Page.reload', { ignoreCache: true });
await sleep(4200);
const editor = await evaluate(`
  (() => {
    const all = [...document.querySelectorAll('*')];
    return {
      autoOpened: all.some((el) => /panel/i.test(String(el.className ?? ''))),
      handoffVisible: !!document.querySelector('[class*="handoff"]'),
      handles: document.querySelectorAll('[class*="handle"]').length,
      hasCopyButton: [...document.querySelectorAll('button')].some((b) => /Копіювати JSON/.test(b.textContent)),
      labels: [...document.querySelectorAll('[class*="label"]')].slice(0, 3).map((el) => el.textContent.trim()),
    };
  })()
`);
console.log('редактор:', JSON.stringify(editor));
await shoot('/tmp/editor-check.png');
socket.close();
chrome.kill();
