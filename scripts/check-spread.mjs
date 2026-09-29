/**
 * Чи не збиваються тварини одного двору в одну точку.
 *
 * Для кожного загону кілька разів знімає екранні позиції всіх тварин і рахує
 * найменшу відстань між ними. Якщо вони «вкопані» одна в одну — найменша
 * відстань буде близька до нуля на кожному замірі.
 *
 * Запуск: node scripts/check-spread.mjs [url]
 */
import { spawn } from 'node:child_process';

const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9348;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--no-first-run',
    '--hide-scrollbars',
    `--user-data-dir=/tmp/lux-spread-${Date.now()}`,
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

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL_ });
await sleep(3200);
await evaluate(`try { localStorage.clear(); } catch {}`);
await send('Page.reload', { ignoreCache: true });
await sleep(3200);
await clickText('Почати гру');
await sleep(3600);
await clickText('Ок, далі');
await sleep(600);
await evaluate(`
  (() => {
    const s = JSON.parse(localStorage.getItem('lux-ferma:save'));
    s.players[0].farm = { duck: 4, goat: 4, pig: 4, horse: 3, cow: 3, sdog: 2, bdog: 2 };
    s.players[0].total = 22;
    s.players[1].farm = { duck: 1, goat: 1, pig: 1, horse: 1, cow: 1, sdog: 1, bdog: 1 };
    s.herd = { duck: 40, goat: 30, pig: 20, horse: 12, cow: 10, sdog: 6, bdog: 6 };
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

const probe = `(() => {
  const rows = [];
  for (const box of document.querySelectorAll('[class*="tokens"]')) {
    const label = box.parentElement?.querySelector('[class*="sign"] b')?.textContent ?? '?';
    const slots = [...box.querySelectorAll('[class*="slot"]')];
    const points = slots.map((slot) => {
      const r = slot.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
    });
    let minDistance = Infinity;
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const distance = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
        if (distance < minDistance) minDistance = distance;
      }
    }
    const size = points[0]?.w ?? 0;
    rows.push({
      загін: label,
      тварин: points.length,
      найближчі: points.length > 1 ? +minDistance.toFixed(1) : null,
      розмір: +size.toFixed(1),
      накладаються: points.length > 1 && minDistance < size * 0.6,
    });
  }
  return rows;
})()`;

const samples = [];
for (let step = 0; step < 10; step += 1) {
  samples.push(await evaluate(probe));
  await sleep(320);
}

console.log('розподіл тварин у дворах (найменша відстань між сусідами, px):');
const summary = [];
for (let row = 0; row < samples[0].length; row += 1) {
  const series = samples.map((sample) => sample[row]).filter(Boolean);
  const distances = series.map((s) => s.найближчі).filter((d) => d !== null);
  const overlapping = series.filter((s) => s.накладаються).length;
  const min = distances.length ? Math.min(...distances) : null;
  const max = distances.length ? Math.max(...distances) : null;
  const size = series[0]?.розмір ?? 0;
  summary.push({ загін: series[0]?.загін, тварин: series[0]?.тварин, min, max, size, overlapping });
  console.log(
    `  ${String(series[0]?.загін).padEnd(8)} тварин ${series[0]?.тварин} · відстань ${min !== null ? `${min}–${max}px` : '—'} ` +
      `(розмір ${size}px) · кадрів із накладанням ${overlapping}/${series.length}`,
  );
}

const bad = summary.filter((s) => s.overlapping > 0);
console.log(
  bad.length === 0
    ? '\n✓ накладань немає: у кожному замірі сусіди стоять на відстані понад 60% розміру тварини'
    : `\n✗ накладаються: ${bad.map((s) => s.загін).join(', ')}`,
);
socket.close();
chrome.kill();
