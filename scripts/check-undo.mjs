/**
 * Перевірка кнопки «Скасувати»: кидок → «Ок, далі» → скасування має повернути
 * стан ДО кидка (rolled=false, ті самі тварини у дворі). Друга перевірка —
 * скасування завершення ходу повертає хід тому самому гравцю.
 *
 * Запуск: node scripts/check-undo.mjs [url]
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9347;
const OUT_DIR = '/tmp';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--no-first-run',
    '--disable-gpu',
    '--hide-scrollbars',
    '--user-data-dir=/tmp/lux-chrome-undo',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function debuggerUrl() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* чекаємо */
    }
    await sleep(200);
  }
  throw new Error('DevTools не відповідає');
}

class Session {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
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

// (спрощено: підключення виконуємо прямо в run)
async function connect() {
  const socket = new WebSocket(await debuggerUrl());
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', () => reject(new Error('WebSocket не відкрився')));
  });
  return new Session(socket);
}

async function run() {
  const session = await connect();
  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('Page.navigate', { url: URL_ });
  await sleep(2500);

  const clickText = (text) =>
    session.eval(`(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(text)}));
      if (!btn) return false;
      btn.click();
      return true;
    })()`);

  const waitFor = async (expression, tries = 30, delay = 250) => {
    for (let i = 0; i < tries; i += 1) {
      if (await session.eval(expression)) return true;
      await sleep(delay);
    }
    return false;
  };

  const save = () =>
    session.eval(`(() => { try { return JSON.parse(localStorage.getItem('lux-ferma:save')); } catch { return null; } })()`);

  const undoBtn = `[...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '') === 'Скасувати останню дію')`;

  console.log(`\n▸ ${URL_}`);

  await waitFor(`!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Почати гру'))`, 40, 500);
  await clickText('Почати гру');
  await sleep(700);
  await clickText('Я готовий');
  await sleep(700);

  const inGame = await waitFor(`!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Кинути кубики'))`);
  check('партія почалась', inGame);

  const undoDisabledInitially = await session.eval(`(() => { const b = ${undoBtn}; return b ? b.disabled : null; })()`);
  check('на старті скасування недоступне', undoDisabledInitially === true, `disabled=${undoDisabledInitially}`);

  const farmBefore = (await save())?.players?.[0]?.farm;

  await session.eval('window.__origRandom = Math.random; Math.random = () => 0.05;');
  await clickText('Кинути кубики');
  const modal = await waitFor(`!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Ок'))`, 40, 300);
  check('модалка результату відкрилась', modal);
  await clickText('Ок, далі');
  await sleep(800);

  const afterRoll = await save();
  check('після кидка хід вважається зробленим', afterRoll?.rolled === true, `rolled=${afterRoll?.rolled}`);

  const undoEnabled = await session.eval(`(() => { const b = ${undoBtn}; return b ? !b.disabled : false; })()`);
  check('скасування стало доступним після кидка', undoEnabled);
  await session.shoot(`${OUT_DIR}/undo-before.png`);

  await clickText('↩️');
  await sleep(900);

  const afterUndo = await save();
  check('скасування повернуло хід (rolled=false)', afterUndo?.rolled === false, `rolled=${afterUndo?.rolled}`);
  check(
    'тварини у дворі відкотились',
    JSON.stringify(afterUndo?.players?.[0]?.farm) === JSON.stringify(farmBefore),
    `${JSON.stringify(afterUndo?.players?.[0]?.farm)} vs ${JSON.stringify(farmBefore)}`,
  );
  check('кубики скинуто', afterUndo?.dice === null, `dice=${JSON.stringify(afterUndo?.dice)}`);
  check(
    'знову доступна кнопка «Кинути кубики»',
    await waitFor(`!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Кинути кубики'))`, 5, 200),
  );
  await session.shoot(`${OUT_DIR}/undo-after.png`);

  // Скасування завершення ходу
  await clickText('Кинути кубики');
  await waitFor(`!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Ок'))`, 40, 300);
  await clickText('Ок, далі');
  await sleep(700);
  await clickText('Завершити хід');
  await sleep(900);
  const turnAfter = (await save())?.current;
  await clickText('↩️');
  await sleep(900);
  const turnUndone = (await save())?.current;
  check('скасування завершення ходу повернуло гравця', turnUndone !== turnAfter, `${turnAfter} → ${turnUndone}`);

  const failed = checks.filter((c) => !c.ok);
  console.log(`\nРЕЗУЛЬТАТ: ${failed.length === 0 ? 'усе гаразд ✅' : `${failed.length} провал(ів) ❌`}`);
  console.log(`Знімки: ${OUT_DIR}/undo-before.png, ${OUT_DIR}/undo-after.png`);
  return failed.length;
}

run()
  .then((failed) => {
    chrome.kill();
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error('ПОМИЛКА:', error.message);
    chrome.kill();
    process.exit(1);
  });
