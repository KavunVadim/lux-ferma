/**
 * Перевірка екрана «Налаштування» у справжньому браузері (Chrome через CDP).
 *
 * Запуск: node scripts/check-settings.mjs [url] [outDir]
 * Умова: запущений дев-сервер (npm run dev).
 *
 * Перевіряє, що налаштування не просто малюються, а реально змінюють гру:
 *   1) усі групи опцій присутні;
 *   2) вибір зберігається в localStorage (`lux-ferma:settings`);
 *   3) тема перемикає `data-theme` на <html>;
 *   4) нові правила потрапляють у збереження партії (`lux-ferma:save`);
 *   5) з вимкненими хижаками кидок «ведмідь + лисиця» не забирає тварин.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const OUT_DIR = process.argv[3] ?? '/tmp';
const PORT = 9337;
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--no-first-run',
    '--disable-gpu',
    '--hide-scrollbars',
    '--user-data-dir=/tmp/lux-chrome-settings',
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

  /** Натискає кнопку за точним підписом у <b> (варіанти налаштувань). */
  clickOption(label) {
    return this.eval(`
      (() => {
        const target = ${JSON.stringify(label)};
        const button = [...document.querySelectorAll('button')].find(
          (btn) => btn.querySelector('b')?.textContent.trim() === target
        );
        if (!button) return false;
        button.click();
        return true;
      })()
    `);
  }

  clickText(text) {
    return this.eval(`
      (() => {
        const el = [...document.querySelectorAll('button')].find((btn) =>
          btn.textContent.trim().includes(${JSON.stringify(text)})
        );
        if (!el) return false;
        el.click();
        return true;
      })()
    `);
  }

  /** Натискає N-й варіант у групі налаштувань; повертає його підпис. */
  clickOptionIn(sectionTitle, index) {
    return this.eval(`
      (() => {
        const section = [...document.querySelectorAll('section')].find((s) =>
          (s.querySelector('header b')?.textContent ?? '').includes(${JSON.stringify(sectionTitle)})
        );
        if (!section) return null;
        const buttons = [...section.querySelectorAll('button')].filter((btn) => btn.querySelector('b'));
        const button = buttons[${index}];
        if (!button) return null;
        button.click();
        return button.querySelector('b').textContent.trim();
      })()
    `);
  }

  clickAria(label) {
    return this.eval(`
      (() => {
        const el = [...document.querySelectorAll('button')].find(
          (btn) => btn.getAttribute('aria-label') === ${JSON.stringify(label)}
        );
        if (!el) return false;
        el.click();
        return true;
      })()
    `);
  }

  /** Чекає, поки оверлей (лист правил/налаштувань, «Передай пристрій») зникне. */
  async waitOverlayGone(tries = 24) {
    for (let attempt = 0; attempt < tries; attempt += 1) {
      await sleep(300);
      const blocked = await this.eval(`!!document.querySelector('.overlay')`);
      if (!blocked) return;
    }
  }

  async waitFor(expression, tries = 30, delay = 300) {
    for (let attempt = 0; attempt < tries; attempt += 1) {
      await sleep(delay);
      if (await this.eval(expression)) return true;
    }
    return false;
  }

  async shoot(path) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(shot.data, 'base64'));
    return path;
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const url = await debuggerUrl();
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  const session = new Session(socket);
  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 430,
    height: 932,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }],
  });

  let failures = 0;
  const check = (name, ok, detail) => {
    console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures += 1;
  };
  const settings = () =>
    session.eval(`(() => { try { return JSON.parse(localStorage.getItem('lux-ferma:settings') ?? 'null'); } catch { return null; } })()`);
  const save = () =>
    session.eval(`(() => { try { return JSON.parse(localStorage.getItem('lux-ferma:save') ?? 'null'); } catch { return null; } })()`);

  console.log(`Відкриваю ${URL_}`);
  await session.send('Page.navigate', { url: URL_ });
  await session.eval(`try { localStorage.clear(); } catch {}`);
  await session.send('Page.reload', { ignoreCache: true });

  const started = await session.waitFor(
    `!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Почати гру'))`,
    40,
    500,
  );
  if (!started) throw new Error('Стартовий екран не зʼявився — чи запущений дев-сервер?');

  /* ── 1. Екран налаштувань відкривається ── */
  await session.clickText('Налаштування');
  const opened = await session.waitFor(
    `!![...document.querySelectorAll('.sheet h2')].find((h) => h.textContent.includes('Налаштування'))`,
    20,
    200,
  );
  check('екран налаштувань відкрився', opened);

  const groups = await session.eval(`
    [...document.querySelectorAll('section')].map((s) => s.querySelector('header b')?.textContent?.trim() ?? '').filter(Boolean)
  `);
  console.log(`  групи: ${groups.join(' | ')}`);
  check('є група «Обміни за хід»', groups.some((g) => g.includes('Обміни')));
  check('є група «Хижаки»', groups.some((g) => g.includes('Хижаки')));
  check('є група «Кубики»', groups.some((g) => g.includes('Кубики')));
  check('є група «Стартове стадо»', groups.some((g) => g.includes('Стартове стадо')));
  check('є група «Звук»', groups.some((g) => g.includes('Звук')));
  check('є група «Тема»', groups.some((g) => g.includes('Тема')));
  check('є група «Анімація кидка»', groups.some((g) => g.includes('Анімація')));

  const shots = [];
  shots.push(await session.shoot(`${OUT_DIR}/settings-sheet.png`));

  /* ── 2. Вибір зберігається ── */
  const picked = {
    trades: await session.clickOptionIn('Обміни', 1),
    predators: await session.clickOptionIn('Хижаки', 1),
    dice: await session.clickOptionIn('Кубики', 1),
    theme: await session.clickOptionIn('Тема', 2),
    sound: await session.clickOptionIn('Звук', 1),
  };
  console.log(`  обрано: ${JSON.stringify(picked)}`);
  check('усі групи прийняли вибір', Object.values(picked).every((label) => typeof label === 'string'));

  await sleep(300);
  const stored = await settings();
  console.log(`  збережено: ${JSON.stringify(stored)}`);
  check('звук вимкнено й гучність збережена', stored?.sound === false && typeof stored?.volume === 'number');
  check('режим хижаків збережено', stored?.predatorMode === 'half', stored?.predatorMode);
  check('набір кубиків збережено', stored?.dicePreset === 'calm', stored?.dicePreset);
  check('ліміт обмінів збережено', stored?.tradesPerTurn === 1, String(stored?.tradesPerTurn));
  check('тема збережена', stored?.theme === 'dark', stored?.theme);
  check('перемикачі ефектів збережені', typeof stored?.effects === 'object' && stored.effects !== null);

  const themeAttr = await session.eval(`document.documentElement.dataset.theme ?? 'system'`);
  check('тема застосована до <html>', themeAttr === stored?.theme, `data-theme=${themeAttr}`);

  shots.push(await session.shoot(`${OUT_DIR}/settings-dark.png`));

  /* ── 3. «Готово» закриває екран ── */
  await session.clickText('Готово');
  const closed = await session.waitFor(`!document.querySelector('.sheet')`, 20, 200);
  check('екран закривається кнопкою «Готово»', closed);

  /* ── 4. Правила потрапляють у партію ── */
  await session.eval(`try { localStorage.removeItem('lux-ferma:settings'); } catch {}`);
  await session.send('Page.reload', { ignoreCache: true });
  await session.waitFor(
    `!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Почати гру'))`,
    40,
    500,
  );

  // Налаштовуємо саме те, що перевіряємо далі: хижаки вимкнені, кубики класичні.
  await session.clickText('Налаштування');
  await session.waitFor(`!!document.querySelector('.sheet')`, 20, 200);
  const offLabel = await session.clickOptionIn('Хижаки', 2);
  const classicLabel = await session.clickOptionIn('Кубики', 0);
  console.log(`  обрано: хижаки «${offLabel}», кубики «${classicLabel}»`);
  check('режим «вимкнені» обрано', offLabel !== null && classicLabel !== null);
  await session.clickText('Готово');
  await session.waitFor(`!document.querySelector('.sheet')`, 20, 200);

  await session.clickText('Почати гру');
  await session.waitOverlayGone();
  const inGame = await session.waitFor(`!!document.querySelector('[class*="_diceCard_"]')`, 20, 300);
  check('партія почалась', inGame);

  const rulesInSave = await save();
  console.log(`  правила партії: ${JSON.stringify(rulesInSave?.rules)}`);
  check('правила записані в партію', !!rulesInSave?.rules);
  check('вимкнені хижаки дійшли до партії', rulesInSave?.rules?.predatorMode === 'off', rulesInSave?.rules?.predatorMode);

  /* ── 5. Кидок «ведмідь + лисиця» нічого не забирає ── */
  // Спершу кладемо у двір тварин, щоб було що красти.
  const seeded = await session.eval(`
    (() => {
      const raw = JSON.parse(localStorage.getItem('lux-ferma:save'));
      raw.players[0].farm.duck = 4;
      raw.players[0].farm.goat = 2;
      localStorage.setItem('lux-ferma:save', JSON.stringify(raw));
      return raw.players[0].farm;
    })()
  `);
  console.log(`  у дворі перед кидком: ${JSON.stringify(seeded)}`);
  await session.send('Page.reload', { ignoreCache: true });
  await session.waitFor(`!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Продовжити'))`, 40, 500);
  await session.clickText('Продовжити');
  await session.waitOverlayGone();
  await session.waitFor(`!!document.querySelector('[class*="_diceCard_"]')`, 20, 300);

  // Підмінюємо випадковість: random → 0.999 дає останню грань (ведмідь + лисиця).
  await session.eval(`window.__origRandom = Math.random; Math.random = () => 0.999;`);
  await session.clickText('Кинути кубики');
  const modalOpen = await session.waitFor(
    `!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Ок'))`,
    40,
    300,
  );
  check('модалка результату відкрилась', modalOpen);

  const modalText = await session.eval(`
    (() => {
      const overlay = document.querySelector('.overlay');
      return overlay ? overlay.innerText : '';
    })()
  `);
  console.log(`  текст модалки: ${modalText.replace(/\s+/g, ' ').slice(0, 160)}`);
  // Спрайт — це <img>, коли файл доступний (Sprite.tsx), і <span> з емодзі лише
  // у фолбеку. Тому читаємо і alt, і текст: детектор не має залежати від того,
  // завантажився спрайт чи ні.
  const faces = await session.eval(`
    (() => {
      const dice = [...document.querySelectorAll('[class*="_face_"], [class*="_die_"]')];
      return dice
        .map((el) => {
          const img = el.querySelector('img');
          if (img) return img.getAttribute('alt') || img.getAttribute('src') || '';
          return el.textContent.trim();
        })
        .filter(Boolean);
    })()
  `);
  console.log(`  грані кубиків у UI: ${JSON.stringify(faces)}`);
  check('грані кубиків показані в UI', faces.length >= 2, JSON.stringify(faces));
  shots.push(await session.shoot(`${OUT_DIR}/settings-off-roll.png`));

  const farmAfterModal = await session.eval(`
    (() => {
      const raw = JSON.parse(localStorage.getItem('lux-ferma:save'));
      return raw.players[0].farm;
    })()
  `);
  console.log(`  у дворі після кидка: ${JSON.stringify(farmAfterModal)}`);
  check('з вимкненими хижаками тварини вціліли', farmAfterModal.duck === 4 && farmAfterModal.goat === 2,
    `качки ${farmAfterModal.duck}, кози ${farmAfterModal.goat}`);
  check('модалка пояснює, що напади вимкнені', modalText.includes('вимкнені'));
  check('у модалці немає втрат', !modalText.includes('вкрала') && !modalText.includes('−'));

  console.log(`\nЗнімки: ${shots.join(', ')}`);
  console.log(failures === 0 ? 'РЕЗУЛЬТАТ: усе гаразд ✅' : `РЕЗУЛЬТАТ: ${failures} перевірок провалено ❌`);
  socket.close();
  chrome.kill();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  chrome.kill();
  process.exit(1);
});
