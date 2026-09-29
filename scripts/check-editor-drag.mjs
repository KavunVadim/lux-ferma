/**
 * Перевірка редактора карти: справжній перетяг мишею через CDP.
 *
 * Запуск: node scripts/check-editor-drag.mjs [url]
 * Умова: запущений дев-сервер (npm run dev) — редактор є лише в DEV.
 *
 * Перевіряє дві речі:
 *   1) рамку загону можна посувати (і вона не повертається назад);
 *   2) рамку можна розтягнути за правий нижній квадратик.
 */
import { spawn } from 'node:child_process';

const URL_ = process.argv[2] ?? 'http://localhost:5173/?editor=1';
const PORT = 9336;
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
    '--user-data-dir=/tmp/lux-chrome-editor',
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

  async mouse(type, x, y, extra = {}) {
    await this.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: 'left',
      buttons: type === 'mouseReleased' ? 0 : 1,
      clickCount: 1,
      pointerType: 'mouse',
      ...extra,
    });
  }

  /** Плавний перетяг: натиснути → N кроків → відпустити. */
  async drag(from, to, steps = 8) {
    await this.mouse('mousePressed', from.x, from.y);
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      await this.mouse('mouseMoved', from.x + (to.x - from.x) * ratio, from.y + (to.y - from.y) * ratio);
      await sleep(24);
    }
    await this.mouse('mouseReleased', to.x, to.y);
    await sleep(160);
  }

  /** Читає геометрію N-ї рамки загону (у % від області редактора). */
  readZone(index) {
    return this.eval(`
      (() => {
        const root = document.querySelector('[class*="_root_"]');
        const box = document.querySelectorAll('[class*="_box_"][class*="_zone_"]')[${index}];
        if (!root || !box) return null;
        const rootRect = root.getBoundingClientRect();
        const boxRect = box.getBoundingClientRect();
        return {
          x: +(((boxRect.left - rootRect.left) / rootRect.width) * 100).toFixed(2),
          y: +(((boxRect.top - rootRect.top) / rootRect.height) * 100).toFixed(2),
          w: +((boxRect.width / rootRect.width) * 100).toFixed(2),
          h: +((boxRect.height / rootRect.height) * 100).toFixed(2),
          rect: { left: boxRect.left, top: boxRect.top, right: boxRect.right, bottom: boxRect.bottom, width: boxRect.width, height: boxRect.height },
          tag: box.querySelector('[class*="_tag_"]').textContent,
        };
      })()
    `);
  }
}

/** Точка всередині рамки, вільна від вкладених рамок (верхня смуга). */
const grabPoint = (rect) => ({ x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.03 });

async function main() {
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
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }],
  });

  console.log(`Відкриваю ${URL_}`);
  await session.send('Page.navigate', { url: URL_ });

  // Дев-серверу треба час на першу трансформацію — чекаємо на кнопку старту.
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(500);
    ready = await session.eval(
      `!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Почати гру'))`,
    );
    if (ready) break;
  }
  if (!ready) throw new Error('Стартовий екран не зʼявився — чи запущений дев-сервер?');

  await session.eval(
    `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Почати гру')).click()`,
  );
  // Оверлей «Передай пристрій» перехоплює кліки — дочікуємось, поки він сам зникне.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(300);
    const blocked = await session.eval(`!!document.querySelector('.overlay')`);
    if (!blocked) break;
  }
  await sleep(300);

  const hasEditor = await session.eval(`!!document.querySelector('[class*="_root_"]')`);
  if (!hasEditor) throw new Error('Редактор не зʼявився (потрібне вікно ≥1000px і ?editor=1)');

  let failures = 0;
  const check = (name, ok, detail) => {
    console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures += 1;
  };

  /* ── 1. Перетяг загону ── */
  await session.eval(`
    window.__hits = [];
    document.addEventListener('pointerdown', (e) => {
      window.__hits.push(e.target.className + ' @ ' + Math.round(e.clientX) + ',' + Math.round(e.clientY));
    }, true);
  `);

  const boxes = await session.eval(`
    (() => {
      const root = document.querySelector('[class*="_root_"]');
      const rootRect = root.getBoundingClientRect();
      return {
        root: [Math.round(rootRect.width), Math.round(rootRect.height), Math.round(rootRect.left), Math.round(rootRect.top)],
        zones: [...document.querySelectorAll('[class*="_box_"][class*="_zone_"]')].map((box) => {
          const r = box.getBoundingClientRect();
          return {
            tag: box.querySelector('[class*="_tag_"]').textContent,
            left: +(((r.left - rootRect.left) / rootRect.width) * 100).toFixed(2),
            top: +(((r.top - rootRect.top) / rootRect.height) * 100).toFixed(2),
            w: +((r.width / rootRect.width) * 100).toFixed(2),
            h: +((r.height / rootRect.height) * 100).toFixed(2),
          };
        }),
      };
    })()
  `);
  for (const zone of boxes.zones) {
    console.log(`  ${zone.tag.padEnd(34)} → left ${zone.left}% top ${zone.top}% size ${zone.w}×${zone.h}%`);
  }

  const before = await session.readZone(0);
  const target = { x: before.rect.left + before.rect.width * 0.5 + 90, y: before.rect.top + before.rect.height * 0.03 + 60 };
  await session.drag(grabPoint(before.rect), target);
  const after = await session.readZone(0);

  const dx = +(after.x - before.x).toFixed(2);
  const dy = +(after.y - before.y).toFixed(2);
  console.log(`\nПеретяг загону «${before.tag.split(' · ')[0]}»: x ${before.x} → ${after.x}, y ${before.y} → ${after.y}`);
  check('рамка зсунулась від початкового місця', Math.abs(dx) > 3 || Math.abs(dy) > 3, `Δ ${dx}% / ${dy}%`);
  check('зсув додатний (за мишею, не назад)', dx > 3 && dy > 3);

  await sleep(400);
  const settled = await session.readZone(0);
  check(
    'після відпускання лишилась на місці (не вертається)',
    Math.abs(settled.x - after.x) < 0.6 && Math.abs(settled.y - after.y) < 0.6,
  );

  /* ── 2. Розтягування за кут ── */
  const zoneBefore = await session.readZone(2);
  const geometry = await session.eval(`
    (() => {
      const zone = document.querySelectorAll('[class*="_box_"][class*="_zone_"]')[2];
      const corner = { x: zone.getBoundingClientRect().right - 1, y: zone.getBoundingClientRect().bottom - 1 };
      return {
        corner,
        atCorner: document.elementFromPoint(corner.x, corner.y)?.className ?? 'нічого',
        children: [...zone.children].map((child) => {
          const r = child.getBoundingClientRect();
          return { cls: child.className, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
        }),
      };
    })()
  `);
  console.log('\nГеометрія загону «Свиня»:');
  console.log(`  кут для розтягу: ${Math.round(geometry.corner.x)},${Math.round(geometry.corner.y)} → елемент: ${geometry.atCorner}`);
  for (const child of geometry.children) {
    console.log(`  ${child.cls.padEnd(46)} x${child.x} y${child.y} ${child.w}×${child.h}`);
  }

  await session.drag(
    { x: zoneBefore.rect.right - 1, y: zoneBefore.rect.bottom - 1 },
    { x: zoneBefore.rect.right - 1 + 80, y: zoneBefore.rect.bottom - 1 + 50 },
  );
  const zoneAfter = await session.readZone(2);
  console.log(`\nРозтяг загону «${zoneBefore.tag.split(' · ')[0]}»: ${zoneBefore.w}×${zoneBefore.h} → ${zoneAfter.w}×${zoneAfter.h}`);
  check('ширина збільшилась', zoneAfter.w - zoneBefore.w > 3, `Δ ${(zoneAfter.w - zoneBefore.w).toFixed(2)}%`);
  check('висота збільшилась', zoneAfter.h - zoneBefore.h > 2, `Δ ${(zoneAfter.h - zoneBefore.h).toFixed(2)}%`);

  /* ── 3. Панель віддає нові числа ── */
  const hits = await session.eval(`window.__hits`);
  console.log('\nХто ловив натискання:', hits.length ? hits.join(' | ') : '(жодного pointerdown!)');

  const snippet = await session.eval(`document.querySelector('[class*="_code_"]')?.textContent ?? ''`);
  const match = snippet.match(/duck: \{ x: ([\d.]+), y: ([\d.]+)/);
  check(
    'JSON у панелі показує нові координати',
    !!match && Number(match[1]) === after.x && Number(match[2]) === after.y,
    match ? `duck: x ${match[1]}, y ${match[2]}` : 'фрагмент не знайдено',
  );

  console.log(failures === 0 ? '\nРЕЗУЛЬТАТ: усе гаразд ✅' : `\nРЕЗУЛЬТАТ: ${failures} перевірок провалено ❌`);
  socket.close();
  chrome.kill();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  chrome.kill();
  process.exit(1);
});
