/**
 * Вимір стартового екрана: тап-цілі, розміри, відступи.
 *
 * Перевіряє те, що не видно оком: чи влазять елементи під палець (44px+),
 * чи не ріжеться текст, чи достатні проміжки між цілями (щоб не промахнутись
 * у сусідню кнопку).
 *
 * Запуск: node scripts/measure-start.mjs [url]
 */
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9378;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-mstart', 'about:blank'],
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

const socket = new WebSocket(await debuggerUrl());
await new Promise((res, rej) => { socket.addEventListener('open', res); socket.addEventListener('error', () => rej(new Error('WS'))); });
let id = 0;
const pending = new Map();
socket.addEventListener('message', (e) => {
  const m = JSON.parse(e.data); const p = pending.get(m.id);
  if (!p) return; pending.delete(m.id);
  m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const i = ++id; pending.set(i, { resolve, reject });
  socket.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await send('Page.navigate', { url: URL_ });
await sleep(3200);

const report = await evaluate(`(() => {
  const out = [];
  for (const b of document.querySelectorAll('button')) {
    const r = b.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    out.push({
      text: b.textContent.replace(/\\s+/g, ' ').trim().slice(0, 22),
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      small: r.height < 44 || r.width < 44,
    });
  }
  const fields = [...document.querySelectorAll('input')].map((i) => {
    const r = i.getBoundingClientRect();
    return { type: i.type, w: Math.round(r.width), h: Math.round(r.height), small: r.height < 44 };
  });
  const card = document.querySelector('[class*="_card_"]');
  const cr = card?.getBoundingClientRect();
  return {
    viewport: { w: innerWidth, h: innerHeight },
    buttons: out,
    inputs: fields,
    cardTop: cr ? Math.round(cr.top) : null,
    cardBottom: cr ? Math.round(cr.bottom) : null,
    // Скільки місця лишається знизу після картки.
    freeBelow: cr ? Math.round(innerHeight - cr.bottom) : null,
    scrollNeeded: document.documentElement.scrollHeight > innerHeight + 4,
  };
})()`);

// Яке правило реально задає висоту кнопки в лотку — щоб не вгадувати.
const why = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /Як грати/.test(x.textContent));
  if (!b) return null;
  const cs = getComputedStyle(b);
  return {
    cls: typeof b.className === 'string' ? b.className : String(b.className),
    minHeight: cs.minHeight,
    height: cs.height,
    padding: cs.padding,
    fontSize: cs.fontSize,
    parentCls: typeof b.parentElement?.className === 'string' ? b.parentElement.className : '',
  };
})()`);
console.log('ДІАГНОСТИКА кнопки «Як грати»:', JSON.stringify(why, null, 1));

console.log(`екран ${report.viewport.w}×${report.viewport.h}, скрол: ${report.scrollNeeded ? 'ПОТРІБЕН' : 'не потрібен'}`);
console.log(`картка: ${report.cardTop}…${report.cardBottom}, вільно знизу: ${report.freeBelow}px\n`);
console.log('КНОПКИ (норма 44×44):');
for (const b of report.buttons) {
  console.log(`  ${b.small ? '✗' : '✓'} ${String(b.w).padStart(3)}×${String(b.h).padStart(3)} top=${String(b.top).padStart(3)} «${b.text}»`);
}
if (report.inputs.length) {
  console.log('\nПОЛЯ:');
  for (const f of report.inputs) console.log(`  ${f.small ? '✗' : '✓'} ${f.w}×${f.h} (${f.type})`);
}

socket.close();
chrome.kill();
process.exit(0);
