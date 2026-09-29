/** Швидкий замір висот блоків ігрового екрана (мобільний в'юпорт). */
import { spawn } from 'node:child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9334;
const URL_ = process.argv[2] ?? 'http://localhost:5199';
const WIDTH = Number(process.argv[3] ?? 390);
const HEIGHT = Number(process.argv[4] ?? 844);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--no-first-run',
    '--disable-gpu',
    '--hide-scrollbars',
    '--user-data-dir=/tmp/lux-chrome-measure',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function ws() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* чекаємо */
    }
    await sleep(200);
  }
  throw new Error('devtools недоступний');
}

class Session {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
      else entry.resolve(msg.result);
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = (this.id += 1);
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const out = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (out.exceptionDetails) throw new Error(out.exceptionDetails.text);
    return out.result?.value;
  }
}

const main = async () => {
  const url = await ws();
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const s = new Session(socket);
  await s.send('Page.enable');
  await s.send('Runtime.enable');
  await s.send('Network.enable');
  await s.send('Network.setCacheDisabled', { cacheDisabled: true });
  await s.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true });
  await s.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await s.send('Page.navigate', { url: URL_ });
  await sleep(1800);
  await s.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Почати гру')).click()`);
  await sleep(3000);
  await report(s, 'після старту');

  await s.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Кинути кубики')).click()`);
  await sleep(2600);
  await s.eval(`[...document.querySelectorAll('.overlay button')][0]?.click()`);
  await sleep(500);
  await report(s, 'після кидка');

  socket.close();
  chrome.kill();
};

async function report(s, label) {
  const result = await s.eval(`
    (() => {
      const rows = [];
      const push = (label, node) => {
        if (!node) return;
        const rect = node.getBoundingClientRect();
        rows.push([label, Math.round(rect.top), Math.round(rect.height)]);
      };
      const shell = document.querySelector('main, section');
      push('shell', shell);
      const all = [...document.querySelectorAll('section > *')];
      all.forEach((node, index) => push('child[' + index + '] ' + node.className.split(' ')[0], node));
      const panel = [...document.querySelectorAll('section section')].at(-1);
      push('farm panel', panel);
      const pen = document.querySelector('article');
      push('pen', pen);
      return {
        viewport: window.innerHeight,
        content: document.documentElement.scrollHeight,
        rows,
      };
    })()
  `);

  console.log(`\n[${label}] в'юпорт ${result.viewport}px, контент ${result.content}px, зайве ${result.content - result.viewport}px`);
  for (const [label, top, height] of result.rows) {
    console.log(`  ${label.padEnd(34)} top=${String(top).padStart(4)} height=${height}`);
  }
}

main().catch((error) => {
  console.error(error);
  chrome.kill();
  process.exit(1);
});
