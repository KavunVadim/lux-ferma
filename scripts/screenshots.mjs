/**
 * Знімки екранів гри в реальному Chrome (для візуальної перевірки верстки).
 *
 * Запуск: node scripts/screenshots.mjs [базовий-url] [тека-виводу]
 * Приклад: node scripts/screenshots.mjs http://localhost:5199 /tmp/lux-shots
 *
 * Скрипт піднімає headless Chrome, ганяє сценарій гри (старт → кидок → модалка)
 * у мобільному й десктопному в'юпортах і зберігає PNG.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE_URL = process.argv[2] ?? 'http://localhost:5199';
const OUT_DIR = path.resolve(process.argv[3] ?? '/tmp/lux-shots');
const PORT = 9333;
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* Chrome ще не піднявся */
    }
    await sleep(200);
  }
  throw new Error('Chrome DevTools не відповідає');
}

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = (this.id += 1);
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value;
  }

  async shot(name) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(OUT_DIR, `${name}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(`  ✓ ${name}.png`);
  }

  async viewport(width, height, mobile) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile,
    });
  }

  /** Примусово світла/темна тема — щоб перевірити обидві палітри. */
  async theme(colorScheme) {
    await this.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: colorScheme }],
    });
  }

  /** Чи не вилазить контент за межі екрана (важливо для мобільного). */
  async overflow() {
    return this.eval(`({
      viewport: window.innerHeight,
      content: document.documentElement.scrollHeight,
      overflowY: document.documentElement.scrollHeight - window.innerHeight,
    })`);
  }

  async goto(url) {
    await this.send('Page.navigate', { url });
    await sleep(1800);
  }

  async click(text) {
    const clicked = await this.eval(`
      (() => {
        const target = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(text)}));
        if (!target) return false;
        target.click();
        return true;
      })()
    `);
    if (!clicked) throw new Error(`Кнопку «${text}» не знайдено`);
    return clicked;
  }
}

async function main() {
  const chrome = spawn(
    CHROME,
    [
      `--remote-debugging-port=${PORT}`,
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      '--user-data-dir=/tmp/lux-chrome-profile',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  try {
    const wsUrl = await connect();
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    const session = new Session(ws);
    await session.send('Page.enable');
    await session.send('Runtime.enable');
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });

    console.log('Мобільний вʼюпорт 390×844 (світла тема)');
    await session.viewport(390, 844, true);
    await session.theme('light');
    await session.goto(BASE_URL);
    await session.shot('01-start-mobile');

    await session.click('Почати гру');
    await sleep(600);
    await session.shot('02-handoff-mobile');
    await sleep(2200);

    await session.click('Кинути кубики');
    await sleep(2400);
    await session.shot('03-result-mobile');
    await session.click('Ок, далі');
    await sleep(500);
    await session.shot('04-game-mobile');
    const metrics = await session.overflow();
    console.log(
      `  ↳ екран ${metrics.viewport}px, контент ${metrics.content}px, зайве ${metrics.overflowY}px`,
    );

    await session.click('Обмін');
    await sleep(700);
    await session.shot('05-trade-mobile');
    await session.eval(`document.querySelector('.overlay .icon-btn')?.click()`);
    await sleep(400);

    console.log('Мобільний вʼюпорт (темна тема)');
    await session.theme('dark');
    await session.goto(BASE_URL);
    await session.shot('09-start-mobile-dark');

    console.log('Десктопний вʼюпорт 1440×900');
    await session.theme('light');
    await session.viewport(1440, 900, false);
    await session.goto(BASE_URL);
    await session.shot('06-start-desktop');
    await session.click('Почати гру');
    await sleep(2700);
    await session.click('Кинути кубики');
    await sleep(2200);
    await session.shot('10-result-desktop');
    await session.click('Ок, далі');
    await sleep(600);
    await session.shot('07-game-desktop');
    await session.eval(`document.querySelectorAll('button[aria-label*="Качник"]')[0]?.click()`);
    await sleep(300);
    await session.shot('08-game-desktop-inspect');
    const desktopMetrics = await session.overflow();
    console.log(
      `  ↳ екран ${desktopMetrics.viewport}px, контент ${desktopMetrics.content}px, зайве ${desktopMetrics.overflowY}px`,
    );

    console.log(`\nГотово: ${OUT_DIR}`);
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
