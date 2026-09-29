/** Знімки нового стартового екрана: телефон, ПК, і варіант на 4 гравці. */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const OUT = process.argv[3] ?? '/tmp/start';
const PORT = 9342;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--no-first-run',
    '--hide-scrollbars',
    `--user-data-dir=/tmp/lux-chrome-start`,
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
const shoot = async (path) => {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path, Buffer.from(shot.data, 'base64'));
  console.log(`знімок: ${path}`);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

// Телефон
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: URL_ });
await sleep(3000);
await evaluate(`try { localStorage.clear(); } catch {}`);
await send('Page.reload', { ignoreCache: true });
await sleep(3500);
await shoot(`${OUT}/start-mobile.png`);

// Телефон на 4 гравці
await evaluate(`(() => {
  const buttons = [...document.querySelectorAll('[role="radio"]')];
  const four = buttons.find((b) => b.getAttribute('aria-label') === '4 гравці');
  if (four) four.click();
  return buttons.length;
})()`);
await sleep(700);
await shoot(`${OUT}/start-mobile-4.png`);

// ПК
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(900);
await shoot(`${OUT}/start-desktop.png`);

const info = await evaluate(`
  (() => {
    const scroller = document.scrollingElement;
    return {
      overflowY: Math.max(0, scroller.scrollHeight - innerHeight),
      inputs: document.querySelectorAll('input').length,
      avatars: [...document.querySelectorAll('label span')].map((s) => s.textContent).filter(Boolean).slice(0, 6),
      title: document.querySelector('h1')?.textContent ?? null,
    };
  })()
`);
console.log('стан:', JSON.stringify(info));
socket.close();
chrome.kill();
