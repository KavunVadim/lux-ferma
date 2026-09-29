/**
 * Діагностика звуку: чи справді гра створює звуки на клік.
 *
 * Інструментує AudioContext у сторінці ДО завантаження застосунку й рахує
 * виклики createOscillator (кожен сигнал — це один або кілька осциляторів).
 * Також читає налаштування звуку з localStorage і стан контексту.
 *
 * Запуск: node scripts/check-sound.mjs [url]
 */
import { spawn } from 'node:child_process';

const URL_ = process.argv[2] ?? 'https://lux-ferma.vercel.app/';
const PORT = 9343;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--no-first-run',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=/tmp/lux-chrome-sound`,
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
const clickText = (text) =>
  evaluate(`(() => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(text)}));
    if (!el) return false; el.click(); return true;
  })()`);

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

// Лічильник звуків: ставимо ДО завантаження сторінки.
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__sound = { oscillators: 0, contexts: 0, states: [], errors: [] };
    const OrigCtx = window.AudioContext || window.webkitAudioContext;
    if (OrigCtx) {
      window.AudioContext = class extends OrigCtx {
        constructor(...args) {
          super(...args);
          window.__sound.contexts += 1;
          window.__sound.states.push(this.state);
          const osc = this.createOscillator.bind(this);
          this.createOscillator = (...a) => { window.__sound.oscillators += 1; return osc(...a); };
        }
      };
    }
  `,
});

await send('Page.navigate', { url: URL_ });
await sleep(3500);
await evaluate(`try { localStorage.clear(); } catch {}`);
await send('Page.reload', { ignoreCache: true });
await sleep(3500);

const settings = await evaluate(`(() => { try { return JSON.parse(localStorage.getItem('lux-ferma:settings') ?? 'null'); } catch { return null; } })()`);
const muted = await evaluate(`localStorage.getItem('lux-ferma:muted')`);
console.log('налаштування:', JSON.stringify(settings));
console.log('окремий прапорець mute:', muted);

const beforeStart = await evaluate(`window.__sound.oscillators`);
await clickText('Почати гру');
await sleep(4000);
await clickText('Ок, далі');
await sleep(500);
const afterStart = await evaluate(`window.__sound.oscillators`);

await clickText('Кинути кубики');
await sleep(2600);
const afterRoll = await evaluate(`window.__sound.oscillators`);

const state = await evaluate(`(() => {
  const s = window.__sound;
  return {
    contexts: s.contexts,
    states: s.states,
    oscillators: s.oscillators,
    audioKit: typeof AudioContext,
    mutedByIcon: document.querySelector('[aria-label*="Увімкнути звук"]') ? 'гра вважає звук ВИМКНЕНИМ' : 'гра вважає звук увімкненим',
    icon: [...document.querySelectorAll('button[aria-label]')].map((b) => b.getAttribute('aria-label')).filter((l) => /звук/i.test(l ?? '')).join(', '),
  };
})()`);

console.log(`осциляторів: до старту ${beforeStart}, після старту ${afterStart}, після кидка ${afterRoll}`);
console.log('стан:', JSON.stringify(state));
console.log(
  state.oscillators > 0
    ? `ВИСНОВОК: звук генерується (${state.oscillators} сигналів), проблема не в коді або в самому браузері`
    : 'ВИСНОВОК: жодного сигналу не створено — застосунок не грає звук',
);
socket.close();
chrome.kill();
