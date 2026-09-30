/**
 * Аудит контрасту в ОБОХ темах.
 *
 * Перевіряє реальні обчислені кольори (не CSS), тож ловить випадки, коли
 * колір заданий правильно, але зливається з фоном. Ключове: багато кольорів
 * підібрані під одне тло й ламаються на іншому — як кольори гравців, які
 * давали 4.06 у темній і 4.18 у світлій при нормі 4.5.
 *
 * Запуск: node scripts/check-dark.mjs [url]
 */
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9365;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-checkdark', 'about:blank'],
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
    if (r.exceptionDetails) {
      // CDP віддає лише "Uncaught" — справжня причина в exception.description.
      const d = r.exceptionDetails;
      const detail = d.exception?.description ?? d.exception?.value ?? d.text ?? 'невідомо';
      throw new Error(`${detail}\n--- вираз ---\n${expr.slice(0, 200)}`);
    }
    return r.result.value;
  }
}

/** Визначає контраст елемента за WCAG з урахуванням напівпрозорості. */
const CONTRAST_FN = `(() => {
  const parse = (c) => {
    const m = String(c).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[,\\s\\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
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
    return parse(getComputedStyle(document.documentElement).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
  };
  window.__contrast = (el) => {
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg) return null;
    const bg = findBg(el);
    const eff = fg.a < 1 ? over(fg, bg) : fg;
    const l1 = lum(eff); const l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    return {
      ratio: Math.round(ratio * 100) / 100, size: Math.round(size), large,
      need: large ? 3 : 4.5, ok: ratio >= (large ? 3 : 4.5),
      color: cs.color, bg: \`rgba(\${bg.r}, \${bg.g}, \${bg.b}, \${bg.a})\`,
      text: (el.textContent ?? '').trim().slice(0, 24),
    };
  };
  return true;
})()`;

/** Усі текстові вузли з ненульовим вмістом — щоб нічого не пропустити. */
const AUDIT_FN = `(() => {
  const out = [];
  const walk = document.querySelectorAll('b, span, strong, em, p, li, h1, h2, h3, button, small');
  for (const el of walk) {
    if (!el.textContent || !el.textContent.trim()) continue;
    // Тільки «листові» елементи з власним текстом (без вкладених дублів).
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = window.__contrast(el);
    if (!r) continue;
    const cls = typeof el.className === 'string' ? el.className : '';
    out.push({ ...r, cls: cls.slice(0, 60) });
  }
  return out;
})()`;

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

  // Сторінка мусить бути на нашому origin — інакше localStorage недоступний
  // («Access is denied for this document» на about:blank).
  const origin = await s.eval('location.origin');
  if (!origin.startsWith('http')) throw new Error(`сторінка не завантажилась: ${origin}`);

  const started = await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Почати гру'))`, 60, 300);
  if (!started) throw new Error('не знайдено кнопку «Почати гру»');
  await clickText('Почати гру');
  await sleep(900);
  for (let i = 0; i < 20; i += 1) {
    if (!(await s.eval(`!!document.querySelector('[class*="handoff"]')`))) break;
    await sleep(300);
  }

  await s.eval(`(() => {
    const raw = JSON.parse(localStorage.getItem('lux-ferma:save'));
    raw.players[0].farm = { duck: 4, goat: 2, pig: 2, horse: 1, cow: 0, sdog: 1, bdog: 0 };
    localStorage.setItem('lux-ferma:save', JSON.stringify(raw));
    return true;
  })()`);
  await s.send('Page.reload', { ignoreCache: true });
  await sleep(2800);
  // Локальний сейв міг не зберегтись — тоді гра стартує зі стартового екрана.
  const resumed = await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Продовжити'))`, 20, 300);
  if (resumed) await clickText('Продовжити');
  await sleep(900);
  for (let i = 0; i < 20; i += 1) {
    if (!(await s.eval(`!!document.querySelector('[class*="handoff"]')`))) break;
    await sleep(300);
  }

  await s.eval(CONTRAST_FN);
  const theme = await s.eval(`(() => ({
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
    card: getComputedStyle(document.documentElement).getPropertyValue('--card').trim(),
    bodyBg: getComputedStyle(document.body).backgroundColor,
  }))()`);
  console.log('тема:', JSON.stringify(theme));

  const bad = (await s.eval(AUDIT_FN)).filter((r) => !r.ok);
  console.log(`\nнепрохідних текстів: ${bad.length}`);
  for (const r of bad) {
    console.log(`  ✗ ${r.ratio} (треба ${r.need}) ${r.size}px «${r.text}»\n     ${r.color} на ${r.bg} · ${r.cls}`);
  }

  console.log('\nРЕЗУЛЬТАТ:', bad.length === 0 ? 'усе гаразд ✅' : `знайдено ${bad.length} проблем ✗`);
  s.badDark = bad;
  await socket.close();
  return bad.length;
}

run()
  .then((n) => { chrome.kill(); process.exit(n === 0 ? 0 : 1); })
  .catch((e) => { console.error('ПОМИЛКА:', e.message); chrome.kill(); process.exit(2); });
