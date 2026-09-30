/**
 * Перевірка екрана передачі пристрою.
 *
 * Поведінка (замість таймера, що сам закривав екран за 2.4 с):
 *  1) після старту/завершення ходу екран передачі показано;
 *  2) він НЕ зникає сам — гравець мусить свідомо підтвердити;
 *  3) кнопка спершу заблокована (палець того, хто віддає, не почне хід);
 *  4) показано ім'я й аватар того, чий хід;
 *  5) після натискання екран зникає і гра доступна.
 *
 * Запуск: node scripts/check-handoff.mjs [url]
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9359;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-handoff', 'about:blank'],
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
  await s.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await s.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await s.send('Page.navigate', { url: URL_ });
  await sleep(2800);

  const clickText = (t) => s.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(t)})); if(!b) return false; b.click(); return true; })()`);
  const waitFor = async (expr, tries = 40, delay = 250) => { for (let i=0;i<tries;i+=1){ if (await s.eval(expr)) return true; await sleep(delay);} return false; };

  const passVisible = () => s.eval(`!!document.querySelector('[class*="passName"]')`);
  // Кнопка в заблокованому стані має текст «…», тому шукаємо її за класом,
  // а не за підписом — інакше перевірка «заблокована спершу» нічого не бачить.
  const btnState = () => s.eval(`(() => {
    const b = document.querySelector('button[class*="passButton"]');
    return b ? { disabled: b.disabled, text: b.textContent.trim() } : null;
  })()`);

  console.log(`\n▸ ${URL_} @ iPhone 390x844\n`);

  await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Почати гру'))`);
  await clickText('Почати гру');
  await sleep(150);

  check('після старту екран передачі показано', await passVisible());
  await s.shoot('/tmp/handoff-shown.png');

  const early = await btnState();
  check('кнопка спершу заблокована', early?.disabled === true, JSON.stringify(early));

  await sleep(650);
  const ready = await btnState();
  check('кнопка активувалась після паузи', ready?.disabled === false, JSON.stringify(ready));

  // Головна зміна: екран більше не зникає сам
  let stillThere = true;
  for (let i = 0; i < 10; i += 1) {
    await sleep(400);
    if (!(await passVisible())) { stillThere = false; break; }
  }
  check('екран НЕ зникає сам за 4 с', stillThere);

  const who = await s.eval(`(() => ({
    name: document.querySelector('[class*="passName"]')?.textContent ?? '',
    label: document.querySelector('[class*="passLabel"]')?.textContent ?? '',
    avatar: document.querySelector('[class*="passAvatar"]')?.textContent ?? '',
  }))()`);
  console.log('екран передачі:', JSON.stringify(who));
  check('показано ім\'я гравця', who.name.length > 0, who.name);
  check('показано аватар', who.avatar.length > 0, who.avatar);

  await clickText('Я готовий');
  let closed = false;
  for (let i = 0; i < 12; i += 1) {
    await sleep(250);
    if (!(await passVisible())) { closed = true; break; }
  }
  check('натискання «Я готовий» закриває екран', closed);
  await s.shoot('/tmp/handoff-gone.png');
  check('гра доступна після підтвердження',
    await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Кинути кубики'))`, 8, 250));

  const failed = checks.filter((c) => !c.ok);
  console.log(`\nРЕЗУЛЬТАТ: ${failed.length === 0 ? 'усе гаразд ✅' : `${failed.length} провал(ів) ❌`}`);
  console.log('Знімки: /tmp/handoff-shown.png, /tmp/handoff-gone.png');
  return failed.length;
}

run().then((f) => { chrome.kill(); process.exit(f === 0 ? 0 : 1); })
  .catch((e) => { console.error('ПОМИЛКА:', e.message); chrome.kill(); process.exit(1); });
