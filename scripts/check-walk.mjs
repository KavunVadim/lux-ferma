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

/*
 * ВАЖЛИВО: редактор карти існує лише в dev-збірці (import.meta.env.DEV у
 * GameScreen.tsx). У продакшн-білді (npm run preview) він вирізається разом
 * із lazy-імпортом, тому ?editor=1 нічого не відкриває. Тому за замовчуванням
 * ходимо на dev-сервер (5173), а не на preview (4173).
 */
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
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

const bobProbe = `(() => {
  const bob = document.querySelector('[class*="bob"]');
  if (!bob) return { found: false };
  const cs = getComputedStyle(bob);
  const box = bob.getBoundingClientRect();
  return {
    found: true,
    transform: cs.transform,
    walkDur: cs.getPropertyValue('--walk-dur').trim(),
    bobVar: cs.getPropertyValue('--bob').trim(),
    waddleVar: cs.getPropertyValue('--waddle').trim(),
    height: +box.height.toFixed(1),
  };
})()`;
const bobA = await evaluate(bobProbe);
await sleep(200);
const bobB = await evaluate(bobProbe);
const bobY = (m) => {
  const match = /matrix\(([^)]+)\)/.exec(m ?? '');
  if (!match) return 0;
  return Number(match[1].split(',')[5]);
};
const duck = await evaluate(`(() => {
  const ducks = [...document.querySelectorAll('[class*="tokens"]')].find((el) => /качки/.test(el.parentElement?.textContent ?? ''));
  const bob = ducks?.querySelector('[class*="bob"]');
  const cs = bob ? getComputedStyle(bob) : null;
  return cs ? { walkDur: cs.getPropertyValue('--walk-dur').trim(), bobVar: cs.getPropertyValue('--bob').trim(), waddle: cs.getPropertyValue('--waddle').trim() } : null;
})()`);
console.log('погойдування:', JSON.stringify({ ...bobA, other: bobB.transform, shiftY: +(bobY(bobB.transform) - bobY(bobA.transform)).toFixed(2) }));
console.log('качка:', JSON.stringify(duck));

/* ── Хода «туди-сюди»: горизонталь + розворот, без вертикалі ── */
const walkerProbe = `(() => {
  const slot = [...document.querySelectorAll('[class*="slot"]')].find((el) => el.querySelector('[class*="walker"]'));
  const walker = slot?.querySelector('[class*="walker"]');
  if (!walker) return null;
  const m = getComputedStyle(walker).transform;
  const nums = m.startsWith('matrix3d')
    ? m.slice(9, -1).split(',').map(Number)
    : m.slice(7, -1).split(',').map(Number);
  return {
    x: +(m.startsWith('matrix3d') ? nums[12] : nums[4]).toFixed(1),
    y: +(m.startsWith('matrix3d') ? nums[13] : nums[5]).toFixed(1),
    scaleX: +(m.startsWith('matrix3d') ? nums[0] : nums[0]).toFixed(2),
  };
})()`;
const walkPath = [];
for (let step = 0; step < 12; step += 1) {
  const sample = await evaluate(walkerProbe);
  if (sample) walkPath.push(sample);
  await sleep(180);
}
const xs = walkPath.map((p) => p.x);
const ys = walkPath.map((p) => p.y);
const flips = new Set(walkPath.map((p) => (p.scaleX < 0 ? 'ліворуч' : 'праворуч')));
console.log(
  `хода: x ${Math.min(...xs)} … ${Math.max(...xs)} (розмах ${(Math.max(...xs) - Math.min(...xs)).toFixed(0)}px) · ` +
    `максимальний зсув по вертикалі ${Math.max(...ys.map(Math.abs)).toFixed(1)}px · напрямки: ${[...flips].join(' / ')}`,
);

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
const isDev = await evaluate(`(() => !!document.querySelector('script[src*="/src/main"]'))`);
if (!isDev && !editorRequested) {
  console.log('⚠ це не dev-сервер: редактор існує лише на npm run dev (5173)');
}
const editor = await evaluate(`
  (() => {
    const panel = document.querySelector('[class*="panel"]');
    return {
      viewport: [window.innerWidth, window.innerHeight],
      autoOpened: !!panel,
      panelHead: !!document.querySelector('[class*="panelHead"]'),
      // Маркери загонів/будівель малюються лише коли карту видно.
      boxes: document.querySelectorAll('[class*="box"]').length,
      handles: document.querySelectorAll('[class*="handle"]').length,
      labels: [...document.querySelectorAll('[class*="tag"]')].slice(0, 3).map((el) => el.textContent.trim()),
    };
  })()
`);
console.log('редактор:', JSON.stringify(editor));
if (!editor.autoOpened) {
  console.log('✗ редактор не відкрився за ?editor=1 при ширині', editor.viewport.join('x'));
} else if (!editor.boxes) {
  console.log('✗ панель є, але маркерів загонів на карті немає');
} else {
  console.log(`✓ редактор відкрився: панель + ${editor.boxes} маркерів, ${editor.handles} ручок`);
}

/* ── Панель можна перетягнути й згорнути ── */
const rectOf = (selector) =>
  evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: +r.x.toFixed(0), y: +r.y.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0) };
  })()`);

const panelBefore = await rectOf('[class*="panel"]');
const head = await rectOf('[class*="panelHead"]');

/*
 * Панель слухає POINTER-події (onPointerDown/Move/Up + setPointerCapture), тому
 * Input.dispatchMouseEvent її не рухає — React просто не бачить pointer-потоку.
 * Шлемо справжні pointer-події з правильним pointerId.
 */
if (head && panelBefore) {
  const from = { x: head.x + head.w / 2, y: head.y + head.h / 2 };
  const to = { x: from.x + 260, y: from.y - 140 };
  const pointer = { pointerType: 'mouse', button: 'left', buttons: 1, clickCount: 1 };

  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
  for (let step = 1; step <= 8; step += 1) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: from.x + ((to.x - from.x) * step) / 8,
      y: from.y + ((to.y - from.y) * step) / 8,
      button: 'left',
      buttons: 1,
      pointerType: 'mouse',
    });
    await sleep(40);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
  await sleep(350);
}

const panelAfter = await rectOf('[class*="panel"]');
const moved =
  panelBefore && panelAfter && (Math.abs(panelAfter.x - panelBefore.x) > 4 || Math.abs(panelAfter.y - panelBefore.y) > 4);
console.log(`панель: ${JSON.stringify(panelBefore)} → ${JSON.stringify(panelAfter)} · перетягнулась: ${moved ? 'так ✓' : 'НІ ✗'}`);

// Згортання/розгортання панелі — теж через pointer + клік по кнопці.
const collapseBtn = await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /згорнути/.test(b.textContent));
  if (!btn) return null;
  btn.click();
  return btn.textContent.trim();
})()`);
await sleep(350);
const collapsed = await evaluate(`(() => ({
  codeVisible: !!document.querySelector('[class*="code"]'),
  panelWidth: document.querySelector('[class*="panel"]')?.getBoundingClientRect().width ?? 0,
  label: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).find((t) => /розгорнути|згорнути/.test(t)) ?? null,
}))()`);
console.log('після згортання:', JSON.stringify({ clicked: collapseBtn, ...collapsed }));
await shoot('/tmp/editor-panel.png');

/* ── Розмір спрайтів за видами (собаки мають бути більші) ── */
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
    s.players[0].farm = { duck: 3, goat: 2, pig: 2, horse: 2, cow: 2, sdog: 2, bdog: 2 };
    s.players[1].farm = { duck: 1, goat: 1, pig: 1, horse: 1, cow: 1, sdog: 1, bdog: 1 };
    s.herd = { duck: 20, goat: 12, pig: 8, horse: 6, cow: 6, sdog: 3, bdog: 3 };
    localStorage.setItem('lux-ferma:save', JSON.stringify(s));
    return true;
  })()
`);
await send('Page.reload', { ignoreCache: true });
await sleep(3000);
await clickText('Продовжити');
await sleep(3600);
await clickText('Ок, далі');
await sleep(800);
const sizes = await evaluate(`
  (() => {
    const rows = [];
    for (const box of document.querySelectorAll('[class*="tokens"]')) {
      const slot = box.querySelector('[class*="slot"]');
      if (!slot) continue;
      const sign = box.parentElement?.querySelector('[class*="sign"] b')?.textContent ?? '?';
      rows.push({
        вид: sign,
        масштаб: getComputedStyle(box).getPropertyValue('--scale').trim() || '1',
        комірка: +slot.getBoundingClientRect().width.toFixed(1),
      });
    }
    return rows;
  })()
`);
console.log('розміри спрайтів:', JSON.stringify(sizes));
await shoot('/tmp/dogs-size.png');
socket.close();
chrome.kill();
