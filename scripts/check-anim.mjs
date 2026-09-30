/**
 * Перевірка анімацій подій: розмноження, крадіжка, відганяння.
 *
 * Кожна подія має власний клас на плитці двору, і саме це перевіряємо:
 * `gain` (розмноження), `loss` (крадіжка), `saved` (пес відігнав хижака).
 * Якщо класи переплутані — гравець побачить не ту анімацію.
 *
 * Запуск: node scripts/check-anim.mjs [url]
 */
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9371;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-anim', 'about:blank'],
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
}

/** Один сценарій: задаємо ферму, кидаємо із заданим random, читаємо анімації. */
async function scenario(s, label, farm, random) {
  await s.eval(`try { localStorage.clear(); } catch {}`);
  await s.send('Page.navigate', { url: URL_ });
  await sleep(2400);

  const clickText = (t) => s.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(t)})); if(!b) return false; b.click(); return true; })()`);
  const waitFor = async (expr, tries = 40, delay = 250) => { for (let i=0;i<tries;i+=1){ if (await s.eval(expr)) return true; await sleep(delay);} return false; };

  const origin = await s.eval('location.origin');
  if (!origin.startsWith('http')) throw new Error(`сторінка не завантажилась: ${origin}`);

  await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Почати гру'))`);
  await clickText('Почати гру');
  await sleep(900);

  await s.eval(`(() => {
    const raw = JSON.parse(localStorage.getItem('lux-ferma:save'));
    raw.players[0].farm = ${JSON.stringify(farm)};
    localStorage.setItem('lux-ferma:save', JSON.stringify(raw));
    return true;
  })()`);
  await s.send('Page.reload', { ignoreCache: true });
  await sleep(2400);
  const resumed = await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Продовжити'))`, 20, 300);
  if (resumed) await clickText('Продовжити');
  await sleep(900);
  for (let i = 0; i < 20; i += 1) {
    if (!(await s.eval(`!!document.querySelector('[class*="handoff"]')`))) break;
    await sleep(300);
  }

  await s.eval(`Math.random = () => ${random};`);
  await clickText('Кинути кубики');
  // Чекаємо САМЕ на кнопку «Ок» — інакше клік припадає на момент, коли модалки
  // ще немає, і результат не застосовується (тому анімацій не було видно).
  const okReady = await waitFor(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim() === 'Ок, далі')`, 60, 250);
  if (!okReady) throw new Error('модалка результату не зʼявилась');
  await clickText('Ок, далі');
  await sleep(300);

  const info = await s.eval(`(() => {
    const out = [];
    for (const pen of document.querySelectorAll('[class*="_pen_"]')) {
      const cls = typeof pen.className === 'string' ? pen.className : '';
      const name = pen.querySelector('[class*="_house_"]')?.textContent?.trim() ?? '?';
      const states = ['gain', 'loss', 'saved'].filter((st) => new RegExp('_' + st + '_').test(cls));
      const anim = getComputedStyle(pen).animationName;
      if (states.length || (anim && anim !== 'none')) out.push({ name, states, anim });
    }
    return out;
  })()`);
  console.log(`\n${label}:`);
  for (const r of info) console.log(`  «${r.name}»: стани [${r.states.join(', ') || '—'}] · анімація ${r.anim}`);
  if (info.length === 0) console.log('  (жодна плитка не анімується)');
  return info;
}

async function run() {
  const socket = new WebSocket(await debuggerUrl());
  await new Promise((res, rej) => { socket.addEventListener('open', res); socket.addEventListener('error', () => rej(new Error('WS'))); });
  const s = new Session(socket);
  await s.send('Page.enable');
  await s.send('Runtime.enable');
  await s.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  /*
   * random вибирає ГРАНЬ, а не подію: pickFace робить floor(random * 12).
   * Лисиця лежить на індексі 11 у DIE_TWO → потрібен random у [0.917, 1).
   * Саме на цьому я спіткнувся: 0.55 дає козу, і замість крадіжки скрипт
   * бачив розмноження.
   */
  const FOX = 0.96;
  const DUCK = 0.02;

  // Розмноження: 3 качки + качка з кубика = 4 → 2 пари.
  await scenario(s, 'РОЗМНОЖЕННЯ (3 качки + 1)', { duck: 3, goat: 0, pig: 0, horse: 0, cow: 0, sdog: 0, bdog: 0 }, DUCK);
  // Крадіжка: лисиця краде качок, пса немає.
  await scenario(s, 'КРАДІЖКА (лисиця, пса немає)', { duck: 5, goat: 2, pig: 0, horse: 0, cow: 0, sdog: 0, bdog: 0 }, FOX);
  // Відганяння: лисиця приходить, але малий пес у дворі.
  await scenario(s, 'ВІДГАНЯННЯ (лисиця + малий пес)', { duck: 5, goat: 2, pig: 0, horse: 0, cow: 0, sdog: 1, bdog: 0 }, FOX);

  socket.close();
}

run().then(() => { chrome.kill(); process.exit(0); })
  .catch((e) => { console.error('ПОМИЛКА:', e.message); chrome.kill(); process.exit(1); });
