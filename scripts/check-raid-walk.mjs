/**
 * ПЕРЕВІРКА НАБІГУ ХИЖАКА — з ГАРАНТОВАНИМИ умовами.
 *
 * Попередні спроби завжди впирались у випадковість: ведмідь випадав, коли в
 * дворі не було свиней; лисиця випадала, але качку вже вкрали. Тут умови
 * створюємо ПРИМУСОВО:
 *
 *   1. пишемо партію напряму в localStorage (`lux-ferma:save`) — у дворі
 *      поточного гравця кладемо жертв ПОТРІБНОГО хижака (свині й коні для
 *      ведмедя, качки й кози для лисиці);
 *   2. підміняємо `Math.random` так, щоб випав саме цей хижак:
 *      `rollDice` кличе pickFace ДВІЧІ — 1-й раз DIE_ONE, 2-й DIE_TWO;
 *      `DIE_ONE[11] = 'bear'`, `DIE_TWO[11] = 'fox'`, тож потрібному
 *      виклику даємо 0.95 (індекс 11), іншому — 0.01 (індекс 0);
 *   3. «Кинути кубики» → «Ок, далі». Події потрапляють у гру САМЕ на
 *      «Ок, далі» (`setEvents(outcome.events)` у useGame), і лише тоді
 *      стартує набіг — тому ловимо його ПІСЛЯ цього кліку;
 *   4. перевіряємо, що це СТРІЧКА КАДРІВ, яка РУХАЄТЬСЯ, а не статична
 *      картинка (саме так було до виправлення).
 *
 * Запуск: node scripts/check-raid-walk.mjs [url]
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const PORT = 9409;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
   '--user-data-dir=/tmp/lux-chrome-raidwalk', 'about:blank'],
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
const shot = async (path) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path, Buffer.from(data, 'base64'));
};
const clickText = async (re) =>
  evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => ${re}.test(x.textContent)); if (b) b.click(); return !!b; })()`);

await send('Page.enable');
await send('Runtime.enable');
// Телефон: саме там набіг треба перевіряти — на ПК він був і раніше.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send('Page.navigate', { url: URL_ });
await sleep(3000);

const results = [];

for (const raider of ['fox', 'bear']) {
  const name = raider === 'fox' ? '🦊 ЛИСИЦЯ' : '🐻 ВЕДМІДЬ';
  console.log(`\n${'═'.repeat(50)}\n${name}\n${'═'.repeat(50)}`);

  // 1. Починаємо партію, щоб з'явилось збереження.
  await send('Page.navigate', { url: URL_ });
  await sleep(2800);
  await clickText('/Почати гру/');
  await sleep(1300);
  await clickText('/Я готовий/');
  await sleep(900);

  // 2. Кладемо в двір ЖЕРТВ ЦЬОГО хижака.
  const filled = await evaluate(`(() => {
    const raw = localStorage.getItem('lux-ferma:save');
    if (!raw) return 'немає збереження';
    const state = JSON.parse(raw);
    const p = state.players[state.current];
    // Обнуляємо все, потім кладемо потрібне — щоб не було випадкових збігів.
    for (const k of Object.keys(p.farm)) p.farm[k] = 0;
    ${raider === 'fox' ? 'p.farm.duck = 4; p.farm.goat = 3;' : 'p.farm.pig = 4; p.farm.horse = 3;'}
    localStorage.setItem('lux-ferma:save', JSON.stringify(state));
    return Object.entries(p.farm).filter(([, v]) => v > 0).map(([k, v]) => k + ':' + v).join(' ');
  })()`);
  console.log(`  двір: ${filled}`);

  // Перезавантажуємо, щоб гра підхопила змінений двір, і продовжуємо партію.
  await send('Page.navigate', { url: URL_ });
  await sleep(3000);
  const resumed = await clickText('/Продовжити партію/');
  if (!resumed) {
    console.log('  ✗ не знайшов «Продовжити партію» — двір не застосовано');
    results.push({ raider, best: null, transforms: 0, who: 'none' });
    continue;
  }
  await sleep(1200);
  await clickText('/Я готовий/');
  await sleep(900);

  // 3. Підміна random: потрібному кубику — грань 11 (ведмідь або лисиця).
  const wantCall = raider === 'bear' ? 1 : 2;
  await evaluate(`(() => {
    window.__call = 0;
    Math.random = () => {
      window.__call += 1;
      // Потрібному кубику — грань 11, решті — грань 0 (качка).
      return window.__call === ${wantCall} ? 0.95 : 0.01;
    };
    return true;
  })()`);

  await clickText('/Кинути кубики/');
  await sleep(2500);

  const who = await evaluate(`(() => { const t = document.body.textContent; return t.includes('Лисиця') ? 'fox' : (t.includes('Ведмідь') ? 'bear' : 'none'); })()`);
  const modal = await evaluate(`(() => { const t = document.body.textContent.replace(/\\s+/g, ' '); const m = t.match(/Напад хижака![^0-9]{0,50}/); return m ? m[0] : t.slice(0, 60); })()`);
  console.log(`  кидок: випав ${who} · модалка: ${modal}`);

  // 4. «Ок, далі» — тут події потрапляють у гру й стартує набіг.
  await clickText('/Ок, далі/');

  let best = null;
  const transforms = new Set();
  for (let k = 0; k < 20; k += 1) {
    await sleep(110);
    const probe = await evaluate(`(() => {
      const run = document.querySelector('[class*="raidRun"], [class*="mobileRaid"]');
      if (!run) return null;
      const walker = run.querySelector('[class*="walker"]');
      const strip = run.querySelector('[class*="walkStrip"]');
      const layer = run.closest('[class*="raidLayer"]');
      return {
        cls: (typeof run.className === 'string' ? run.className : '').replace(/_/g, ' ').trim(),
        hasWalker: !!walker,
        hasStrip: !!strip,
        frames: walker ? getComputedStyle(walker).getPropertyValue('--frames').trim() : '',
        dur: walker ? getComputedStyle(walker).getPropertyValue('--walk-dur').trim() : '',
        transform: strip ? getComputedStyle(strip).transform : '',
        stop0x: layer ? getComputedStyle(layer).getPropertyValue('--stop-0-x').trim() : '',
        stop0y: layer ? getComputedStyle(layer).getPropertyValue('--stop-0-y').trim() : '',
        stop1x: layer ? getComputedStyle(layer).getPropertyValue('--stop-1-x').trim() : '',
        stop1y: layer ? getComputedStyle(layer).getPropertyValue('--stop-1-y').trim() : '',
      };
    })()`);
    if (probe) {
      if (!best) { best = probe; await shot(`/tmp/raid-${raider}.png`); }
      if (probe.transform) transforms.add(probe.transform);
    }
  }

  results.push({ raider, best, transforms: transforms.size, who });
}

socket.close();
chrome.kill();

let ok = true;
console.log(`\n${'═'.repeat(50)}\nПІДСУМОК\n${'═'.repeat(50)}`);
for (const { raider, best, transforms, who } of results) {
  const name = raider === 'fox' ? '🦊 ЛИСИЦЯ' : '🐻 ВЕДМІДЬ';
  console.log(`\n${name}:`);
  const check = (label, pass, extra = '') => {
    console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`);
    if (!pass) ok = false;
  };
  check('потрібний хижак випав', who === raider, `випав: ${who}`);
  if (!best) {
    check('набіг з\'явився на сцені', false);
    continue;
  }
  check('набіг на сцені', true, best.cls.split(' ').slice(0, 2).join(' '));
  check('це стрічка кадрів ходи (.walker + .walkStrip)', best.hasWalker && best.hasStrip);
  check('кадрів у стрічці = 6', best.frames === '6', best.frames || '(немає)');
  check('темп ходи задано', !!best.dur, best.dur || '(немає)');
  check('стрічка РУХАЄТЬСЯ', transforms > 1, `${transforms} різних положень`);
  /*
   * Маршрут має вести до ДВОХ плиток по черзі (качки→кози, свині→коні).
   * Саме цього бракувало на телефоні: хижак бігав абстрактно, не по іконках.
   */
  check(
    'маршрут веде до ПЕРШОЇ жертви',
    !!best.stop0x,
    best.stop0x ? `${best.stop0x}, ${best.stop0y}` : '(немає)',
  );
  check(
    'маршрут веде до ДРУГОЇ жертви',
    !!best.stop1x,
    best.stop1x ? `${best.stop1x}, ${best.stop1y}` : '(немає)',
  );
  check(
    'зупинки РІЗНІ (хижак переходить далі)',
    !!best.stop1x && best.stop0x !== best.stop1x,
    best.stop1x ? `${best.stop0x} → ${best.stop1x}` : '(лише одна)',
  );
}

console.log(`\n${'─'.repeat(50)}`);
console.log(ok ? 'РЕЗУЛЬТАТ: набіг анімований спрайтами тварин ✅' : 'РЕЗУЛЬТАТ: є проблеми ❌');
console.log('Знімки: /tmp/raid-{fox,bear}.png');
process.exit(ok ? 0 : 1);
