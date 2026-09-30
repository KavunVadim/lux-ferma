/**
 * Знімок налаштувань на телефоні — для очного контролю.
 *
 * Запуск: node scripts/shot-settings.mjs [url]
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9373;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-set', 'about:blank'],
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

const socket = new WebSocket(await debuggerUrl());
await new Promise((res, rej) => { socket.addEventListener('open', res); socket.addEventListener('error', () => rej(new Error('WS'))); });
const s = new Session(socket);
await s.send('Page.enable');
await s.send('Runtime.enable');
await s.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await s.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await s.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await s.send('Page.navigate', { url: URL_ });
await sleep(2600);

const origin = await s.eval('location.origin');
if (!origin.startsWith('http')) throw new Error(`сторінка не завантажилась: ${origin}`);

const opened = await s.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /налаштування/i.test(x.textContent));
  if (!b) return false;
  b.click();
  return true;
})()`);
if (!opened) throw new Error('кнопка «Налаштування» не знайдена');
await sleep(900);

const info = await s.eval(`(() => {
  const groups = [...document.querySelectorAll('[class*="settingGroup"]')];
  const sheet = document.querySelector('.sheet');
  return {
    груп: groups.length,
    заголовки: groups.map((g) => g.querySelector('b')?.textContent?.trim()).filter(Boolean),
    висота: sheet?.scrollHeight ?? 0,
  };
})()`);
console.log('налаштування:', JSON.stringify(info, null, 1));

await s.shoot('/tmp/settings-top.png');
for (const [name, part] of [['mid', 0.45], ['bottom', 1]]) {
  await s.eval(`(() => {
    const sheet = document.querySelector('.sheet');
    if (sheet) sheet.scrollTop = sheet.scrollHeight * ${part};
    return true;
  })()`);
  await sleep(500);
  await s.shoot(`/tmp/settings-${name}.png`);
}
console.log('Знімки: /tmp/settings-top.png, settings-mid.png, settings-bottom.png');
socket.close();
chrome.kill();
process.exit(0);
