/**
 * Знімок у ТЕМНІЙ темі: перевіряє контраст назв дворів, чисел і підписів.
 *
 * Запуск: node scripts/shot-dark.mjs [url]
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9364;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-dark', 'about:blank'],
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
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
  async shoot(path) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path, Buffer.from(data, 'base64'));
    return path;
  }
}

/** Контраст за WCAG: повертає відношення (потрібно >= 4.5 для тексту). */
const CONTRAST_FN = `
  (() => {
    const parse = (c) => {
      const m = c.match(/rgba?\\(([^)]+)\\)/);
      if (!m) return null;
      const p = m[1].split(',').map((v) => parseFloat(v));
      return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
    };
    // Зливаємо напівпрозорий текст із фоном під ним.
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const lum = (c) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const findBg = (el) => {
      let node = el;
      while (node && node !== document.documentElement) {
        const c = parse(getComputedStyle(node).backgroundColor);
        if (c && c.a > 0.05) return c;
        node = node.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    window.__contrast = (el) => {
      const fg = parse(getComputedStyle(el).color);
      if (!fg) return null;
      const bg = findBg(el);
      const eff = fg.a < 1 ? over(fg, bg) : fg;
      const l1 = lum(eff); const l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(getComputedStyle(el).fontSize);
      const weight = parseInt(getComputedStyle(el).fontWeight, 10) || 400;
      // Великий текст: >=24px, або >=18.66px при жирному.
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      return { ratio: Math.round(ratio * 100) / 100, size, large, need: large ? 3 : 4.5, color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor };
    };
    return true;
  })()
`;

async function run() {
  const socket = new WebSocket(await debuggerUrl());
  await new Promise((res, rej) => { socket.addEventListener('open', res); socket.addEventListener('error', () => rej(new Error('WS'))); });
  const s = new Session(socket);
  await s.send('Page.enable');
  await s.send('Runtime.enable');
  await s.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await s.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await s.send('Page.navigate', { url: URL_ });
  await sleep(2800);

  const clickText = (t) => s.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(t)})); if(!b) return false; b.click(); return true; })()`);
  const waitFor = async (expr, tries = 40, delay = 250) => { for (let i=0;i<tries;i+=1){ if (await s.eval(expr)) return true; await sleep(delay);} return false; };

  await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Почати гру'))`);
  await clickText('Почати гру');
  await sleep(800);
  for (let i = 0; i < 20; i += 1) {
    if (!(await s.eval(`!!document.querySelector('[class*="handoff"]')`))) break;
    await sleep(300);
  }

  await s.eval(`
    (() => {
      const raw = JSON.parse(localStorage.getItem('lux-ferma:save'));
      raw.players[0].farm = { duck: 4, goat: 2, pig: 2, horse: 1, cow: 0, sdog: 1, bdog: 0 };
      localStorage.setItem('lux-ferma:save', JSON.stringify(raw));
      return true;
    })()
  `);
  await s.send('Page.reload', { ignoreCache: true });
  await sleep(2800);
  await clickText('Продовжити');
  await sleep(800);
  for (let i = 0; i < 20; i += 1) {
    if (!(await s.eval(`!!document.querySelector('[class*="handoff"]')`))) break;
    await sleep(300);
  }

  await s.eval(CONTRAST_FN);

  // Тема справді темна?
  const theme = await s.eval(`(() => ({
    scheme: matchMedia('(prefers-color-scheme: dark)').matches,
    attr: document.documentElement.dataset.theme ?? null,
    ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
    card: getComputedStyle(document.documentElement).getPropertyValue('--card').trim(),
  }))()`);
  console.log('тема:', JSON.stringify(theme));

  // Контраст ключових текстів: назви дворів, числа, стадо, підписи.
  const report = await s.eval(`(() => {
    const pick = {
      'назва двору': '[class*="_house_"]',
      'число ×N': '[class*="_count_"]',
      'стадо 🧺': '[class*="_herd_"]',
      'підпис ролі': '[class*="_role_"]',
      'заголовок ферми': '[class*="_title_"]',
      'прогрес': '[class*="_progressLabel_"]',
    };
    const out = {};
    for (const [name, sel] of Object.entries(pick)) {
      const el = document.querySelector(sel);
      if (!el) { out[name] = 'немає'; continue; }
      const r = window.__contrast(el);
      out[name] = { ratio: r.ratio, need: r.need, ok: r.ratio >= r.need, size: r.size, color: r.color, bg: r.bg };
    }
    return out;
  })()`);
  console.log('контраст у темній темі:');
  for (const [name, val] of Object.entries(report)) {
    if (val === 'немає') { console.log(`  ${name}: немає`); continue; }
    console.log(`  ${val.ok ? '✓' : '✗'} ${name}: ${val.ratio} (потрібно ${val.need}) ${val.size}px ${val.color} на ${val.bg}`);
  }

  await s.shoot('/tmp/dark-farm.png');
  console.log('Знімок: /tmp/dark-farm.png');

  // І панель обміну в темній темі.
  await clickText('Кинути кубики');
  await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Ок'))`, 40, 300);
  await sleep(400);
  await clickText('Ок');
  await sleep(500);
  await clickText('Обмін');
  await waitFor(`!!document.querySelector('[class*="tradeColumns"]')`, 30, 300);
  await sleep(400);
  await s.shoot('/tmp/dark-trade.png');
  console.log('Знімок: /tmp/dark-trade.png');
}

run().then(() => { chrome.kill(); process.exit(0); })
  .catch((e) => { console.error('ПОМИЛКА:', e.message); chrome.kill(); process.exit(1); });
