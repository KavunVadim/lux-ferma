/**
 * Перевірка мобільної версії: вібрація, дубль кубиків, стани екрана.
 *
 * Що міряє:
 *  1) чи доступний navigator.vibrate і чи викликається він (обгортаємо й рахуємо);
 *  2) скільки НАБОРІВ кубиків одночасно видно на екрані (дубль = 2+);
 *  3) чи не вилазить горизонтальний скрол;
 *  4) розміри тап-цілей головних кнопок.
 *
 * Запуск: node scripts/check-mobile.mjs [url]
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9357;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-mobile', 'about:blank'],
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

const checks = [];
const check = (name, ok, detail) => {
  checks.push({ name, ok: !!ok });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail !== undefined ? ` — ${detail}` : ''}`);
};

async function run() {
  const socket = new WebSocket(await debuggerUrl());
  await new Promise((res, rej) => { socket.addEventListener('open', res); socket.addEventListener('error', () => rej(new Error('WS'))); });
  const s = new Session(socket);
  await s.send('Page.enable');
  await s.send('Runtime.enable');

  // iPhone 12 Pro, 390x844, DPR 3, touch
  await s.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await s.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await s.send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  // Рахуємо виклики vibrate ДО завантаження сторінки
  await s.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__vibrateCalls = [];
      // iPhone Safari не має navigator.vibrate — фіксуємо як є
      window.__hasVibrateApi = typeof navigator.vibrate === 'function';
      if (window.__hasVibrateApi) {
        const original = navigator.vibrate.bind(navigator);
        navigator.vibrate = (pattern) => { window.__vibrateCalls.push(pattern); return original(pattern); };
      }
    `,
  });

  await s.send('Page.navigate', { url: URL_ });
  await sleep(2800);

  const clickText = (t) => s.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(t)})); if(!b) return false; b.click(); return true; })()`);
  const waitFor = async (expr, tries = 40, delay = 250) => { for (let i=0;i<tries;i+=1){ if (await s.eval(expr)) return true; await sleep(delay);} return false; };

  console.log(`\n▸ ${URL_} @ iPhone 390x844\n`);

  // 0. середовище
  const env = await s.eval(`({
    hasVibrateApi: window.__hasVibrateApi,
    ua: navigator.userAgent.includes('iPhone') ? 'iPhone' : 'other',
    touch: 'ontouchstart' in window,
    innerWidth: window.innerWidth,
  })`);
  console.log('середовище:', JSON.stringify(env));
  check('touch-події увімкнені', env.touch);

  // 1. стартовий екран
  await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Почати гру'))`);
  await s.shoot('/tmp/mobile-start.png');

  const startLayout = await s.eval(`({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  })`);
  check('старт: немає горизонтального скролу', !startLayout.horizontalScroll, `${startLayout.scrollW}/${startLayout.clientW}`);

  // перемикач вібрації в налаштуваннях
  await clickText('Налаштування');
  await waitFor(`!!document.querySelector('[class*="_sheet_"], .sheet')`);
  await sleep(400);
  const vibrationToggle = await s.eval(`(() => {
    const rows = [...document.querySelectorAll('*')].filter((el) => /Вібрація|вібрац/i.test(el.textContent ?? '') && el.children.length <= 3);
    const input = document.querySelector('input[type="checkbox"]');
    const all = [...document.querySelectorAll('input[type="checkbox"]')].map((i) => ({ checked: i.checked, name: i.name ?? i.id ?? null }));
    return { found: rows.length > 0, checkboxes: all.length, value: all };
  })()`);
  console.log('вібрація в налаштуваннях:', JSON.stringify(vibrationToggle));
  check('перемикач вібрації існує в UI', vibrationToggle.found);
  await s.shoot('/tmp/mobile-settings.png');
  await clickText('Готово');
  await sleep(500);

  // 2. гра: старт і перший екран
  await clickText('Почати гру');
  await sleep(900);
  await clickText('Я готовий');
  await sleep(900);
  await s.shoot('/tmp/mobile-game.png');

  // 3. скільки кубиків видно ДО кидка
  const diceBefore = await s.eval(`(() => {
    const dice = [...document.querySelectorAll('[class*="_die_"]')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    });
    return { count: dice.length };
  })()`);
  console.log('кубики до кидка:', JSON.stringify(diceBefore));
  check('до кидка кубики не показані (0)', diceBefore.count === 0, `${diceBefore.count}`);

  // 4. кидок
  await s.eval('Math.random = () => 0.05;');
  await clickText('Кинути кубики');
  await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Ок'))`, 40, 300);
  await sleep(500);
  await s.shoot('/tmp/mobile-roll.png');

  const diceAfter = await s.eval(`(() => {
    const visible = [...document.querySelectorAll('[class*="_die_"]')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    });
    // Лоток у HUD під модалкою має visibility: hidden — рахуємо лише видимі,
    // інакше виходить «2 набори» там, де реально видно один.
    const sets = [...document.querySelectorAll('[class*="_tray_"]')].filter((el) => {
      const r = el.getBoundingClientRect();
      let node = el;
      while (node && node !== document.body) {
        if (getComputedStyle(node).visibility === 'hidden') return false;
        node = node.parentElement;
      }
      return r.width > 0 && r.height > 0;
    }).length;
    return {
      count: visible.length,
      trays: sets,
      faces: visible.map((d) => { const img = d.querySelector('img'); return img ? img.alt : d.textContent.trim(); }),
    };
  })()`);
  console.log('кубики під час модалки:', JSON.stringify(diceAfter));
  check('під час кидка рівно один набір (2 грані)', diceAfter.count === 2 && diceAfter.trays === 1, `${diceAfter.count} граней, ${diceAfter.trays} лотків`);

  const vibrate = await s.eval(`({ calls: window.__vibrateCalls, api: window.__hasVibrateApi })`);
  console.log('вібрація (виклики):', JSON.stringify(vibrate));
  check(
    vibrate.api ? vibrate.calls.length > 0 : true,
    vibrate.api ? `vibrate() викликано ${vibrate.calls.length} разів` : 'API відсутній (очікувано для iPhone)',
  );

  // 5. закриваємо модалку і дивимось на поле
  await clickText('Ок, далі');
  await sleep(900);
  await s.shoot('/tmp/mobile-after-roll.png');

  const afterClose = await s.eval(`(() => {
    const trays = [...document.querySelectorAll('[class*="_tray_"]')];
    const visible = trays.filter((t) => { const r = t.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(t).visibility !== 'hidden'; });
    return { trays: trays.length, visibleTrays: visible.length };
  })()`);
  console.log('після закриття модалки:', JSON.stringify(afterClose));

  // 6. тап-цілі
  const targets = await s.eval(`(() => {
    const rows = [];
    for (const b of document.querySelectorAll('button')) {
      const r = b.getBoundingClientRect();
      if (r.width === 0) continue;
      rows.push({ text: b.textContent.trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return rows.filter((x) => x.h < 44 || x.w < 44);
  })()`);
  console.log('тап-цілі < 44px:', targets.length ? JSON.stringify(targets) : 'усі достатні ✅');

  const failed = checks.filter((c) => !c.ok);
  console.log(`\nРЕЗУЛЬТАТ: ${failed.length === 0 ? 'усе гаразд ✅' : `${failed.length} провал(ів) ❌`}`);
  console.log('Знімки: /tmp/mobile-start.png, mobile-settings.png, mobile-game.png, mobile-roll.png, mobile-after-roll.png');
  return failed.length;
}

run().then((f) => { chrome.kill(); process.exit(f === 0 ? 0 : 1); })
  .catch((e) => { console.error('ПОМИЛКА:', e.message); chrome.kill(); process.exit(1); });
