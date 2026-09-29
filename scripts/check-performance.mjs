/**
 * Аудит продуктивності: FPS, довгі кадри, витік пам'яті, кількість вузлів.
 *
 * Що робить:
 *   1) інструментує сторінку ДО завантаження — рахує кадри (rAF), довгі задачі
 *      (PerformanceObserver 'longtask'), пікові значення;
 *   2) наповнює двір тваринами (щоб на полі було багато анімованих спрайтів);
 *   3) грає ~20 ходів (кидок → ок → завершити хід) і міряє;
 *   4) примусово звільняє пам'ять (HeapProfiler.collectGarbage) і порівнює heap
 *      до/після — так видно саме витік, а не «сміття, яке ще не прибрали».
 *
 * Запуск: node scripts/check-performance.mjs [url]
 */
import { spawn } from 'node:child_process';

const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const ROUNDS = Number(process.argv[3] ?? 10);
const PORT = 9344;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--no-first-run',
    '--hide-scrollbars',
    '--js-flags=--expose-gc',
    `--user-data-dir=/tmp/lux-chrome-perf-${Date.now()}`,
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
    const reason = out.exceptionDetails.exception?.description ?? out.exceptionDetails.text ?? 'невідома помилка';
    throw new Error(reason);
  }
  return out.result?.value;
};
const clickText = (text) =>
  evaluate(`(() => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(text)}));
    if (!el) return false; el.click(); return true;
  })()`);
const gc = () => send('HeapProfiler.collectGarbage').catch(() => undefined);
const heapMb = async () => {
  await gc();
  await sleep(250);
  const out = await send('Runtime.evaluate', { expression: 'performance.memory ? performance.memory.usedJSHeapSize : 0', returnByValue: true });
  return +((out.result?.value ?? 0) / 1048576).toFixed(1);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Performance.enable');
await send('HeapProfiler.enable').catch(() => undefined);
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    (() => {
      const perf = { frames: 0, worstFrame: 0, longTasks: 0, longTaskMs: 0, started: performance.now() };
      window.__perf = perf;
      const tick = () => { perf.frames += 1; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      let last = performance.now();
      const loop = () => {
        const now = performance.now();
        const delta = now - last;
        if (delta > perf.worstFrame) perf.worstFrame = delta;
        last = now;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            perf.longTasks += 1;
            perf.longTaskMs += entry.duration;
          }
        }).observe({ entryTypes: ['longtask'] });
      } catch {}
    })();
  `,
});

const nav = await send('Page.navigate', { url: URL_ });
console.log('навігація:', JSON.stringify(nav));
await sleep(3500);
console.log('URL сторінки:', await evaluate('location.href'));
await evaluate(`try { localStorage.clear(); } catch {}`);
await send('Page.reload', { ignoreCache: true });
await sleep(4000);
console.log('URL після перезавантаження:', await evaluate('location.href'));

// Стартуємо партію й наповнюємо двір — саме тут найбільше анімованих спрайтів.
const startedClick = await clickText('Почати гру');
await sleep(3800);
await clickText('Ок, далі');
await sleep(400);

const seedStatus = await evaluate(`
  (() => {
    const raw = localStorage.getItem('lux-ferma:save');
    if (!raw) return { ok: false, reason: 'немає збереження', clicked: ${startedClick}, screen: document.body.innerText.slice(0, 60) };
    const state = JSON.parse(raw);
    state.players[0].farm = { duck: 8, goat: 6, pig: 6, horse: 5, cow: 5, sdog: 3, bdog: 3 };
    state.players[1].farm = { duck: 4, goat: 3, pig: 3, horse: 2, cow: 2, sdog: 2, bdog: 2 };
    state.herd = { duck: 40, goat: 30, pig: 20, horse: 10, cow: 8, sdog: 6, bdog: 6 };
    localStorage.setItem('lux-ferma:save', JSON.stringify(state));
    return { ok: true, players: state.players.length };
  })()
`);
console.log('наповнення двору:', JSON.stringify(seedStatus));
if (!seedStatus?.ok) {
  console.log('НЕ вдалося наповнити двір — перевірте, чи гра стартувала');
}
await send('Page.reload', { ignoreCache: true });
await sleep(3500);
await clickText('Продовжити');
await sleep(3800);
await clickText('Ок, далі');
await sleep(600);

const nodes = () => evaluate(`document.getElementsByTagName('*').length`);
const sprites = () => evaluate(`document.querySelectorAll('img').length`);
await evaluate(`window.__perf.frames = 0; window.__perf.worstFrame = 0; window.__perf.longTasks = 0; window.__perf.longTaskMs = 0;`);

console.log(`старт: вузлів ${await nodes()}, зображень ${await sprites()}, heap ${await heapMb()} МБ`);

// Граємо ходи.
for (let round = 0; round < ROUNDS; round += 1) {
  await clickText('Кинути кубики');
  await sleep(2600);
  await clickText('Ок, далі');
  await sleep(700);
  await clickText('Завершити хід');
  await sleep(3400);
  await clickText('Ок, далі');
  await sleep(200);
}

const report = await evaluate(`
  (() => {
    const p = window.__perf;
    const seconds = (performance.now() - p.started) / 1000;
    return {
      frames: p.frames,
      fps: +(p.frames / seconds).toFixed(1),
      worstFrameMs: +p.worstFrame.toFixed(1),
      longTasks: p.longTasks,
      longTaskMs: +p.longTaskMs.toFixed(0),
      nodes: document.getElementsByTagName('*').length,
      images: document.querySelectorAll('img').length,
      animated: document.getAnimations().length,
    };
  })()
`);

const after = await heapMb();
const metrics = await send('Performance.getMetrics');
const byName = Object.fromEntries(metrics.metrics.map((m) => [m.name, m.value]));

console.log(`\nходами ${ROUNDS} раундів:`);
console.log(`  FPS: ${report.fps} · найдовший кадр: ${report.worstFrameMs} мс · довгих задач: ${report.longTasks} (${report.longTaskMs} мс)`);
console.log(`  вузлів DOM: ${report.nodes} · зображень: ${report.images} · активних анімацій: ${report.animated}`);
console.log(`  heap після партії: ${after} МБ · JS heap total: ${((byName.JSHeapTotalSize ?? 0) / 1048576).toFixed(1)} МБ`);
console.log(`  Nodes (метрика CDP): ${byName.Nodes ?? '?'} · Listeners: ${byName.JSEventListeners ?? '?'} · Documents: ${byName.Documents ?? '?'}`);

socket.close();
chrome.kill();
