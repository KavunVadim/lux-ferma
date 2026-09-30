/**
 * Аудит контрасту пар «текст на фоні», які реально існують у грі.
 * Ловить регресію, коли хтось міняє колір тексту або градієнт і знижує
 * контраст нижче WCAG 2.2 AA (4.5 для звичайного тексту, 3.0 для великого).
 *
 * Джерело значень: src/styles/global.css, src/styles/tokens.css,
 * src/ui/screens/StartScreen.module.css, Dice.module.css, Overlays.module.css.
 * Рахуємо НАЙГІРШИЙ кінець градієнта — саме він визначає читабельність.
 *
 * Запуск: node scripts/check-contrast.mjs
 */
const NORMAL = 4.5;
const LARGE = 3.0;

/** Кнопки й поверхні: [назва, колір тексту, верх градієнта, низ градієнта, поріг] */
const SURFACES = [
  ['кнопка «Кинути кубики» (.btn--barn)', '#ffffff', '#c94a38', '#a53527', NORMAL],
  ['кнопка «Завершити хід» (.btn--green)', '#ffffff', '#3f7a30', '#2f6b2a', NORMAL],
  ['кнопка «Готово» (.btn--gold) light', '#2e2013', '#f3c268', '#c78a2e', NORMAL],
  ['кнопка «Готово» (.btn--gold) dark', '#2e2013', '#f3c268', '#d69e42', NORMAL],
  ['кнопка «Обмін» (.btn--wood)', '#ffffff', '#996436', '#76492a', NORMAL],
  ['вивіска заголовка (.title)', '#fff4dc', '#855533', '#66421f', NORMAL],
  ['смужка завантаження (.loadingText)', '#fbfff5', '#3d7d31', '#24521a', NORMAL],
  // Бейджі в панелі обміну: числа на кольорових чипах.
  ['бейдж «у дворі» (жовте коло)', '#5a4014', '#f7c948', '#f7c948', NORMAL],
  ['бейдж «у стаді» (синє коло)', '#ffffff', '#356b9e', '#356b9e', NORMAL],
  // Цифри рахунку «4/5» на пілюлі гравця. Кольори гравців у темній темі
  // освітлюються, у світлій затемнюються — обидва варіанти мусять проходити.
  ['рахунок гравця 1 dark', '#dc5a4e', '#201a12', '#201a12', NORMAL],
  ['рахунок гравця 1 light', '#b13b30', '#fffdf8', '#fffdf8', NORMAL],
  ['рахунок гравця 2 dark', '#438bc7', '#201a12', '#201a12', NORMAL],
  ['рахунок гравця 2 light', '#26689e', '#fffdf8', '#fffdf8', NORMAL],
  ['рахунок гравця 3 dark', '#52a65f', '#201a12', '#201a12', NORMAL],
  ['рахунок гравця 3 light', '#33803f', '#fffdf8', '#fffdf8', NORMAL],
  ['рахунок гравця 4 dark', '#ac6fc9', '#201a12', '#201a12', NORMAL],
  ['рахунок гравця 4 light', '#854da0', '#fffdf8', '#fffdf8', NORMAL],
];

/** Плоскі пари токенів: [назва, текст, фон, поріг] — обидві теми */
const FLAT = [
  // Плитки ферми: назва тварини, підпис стану і число стада.
  // Порожній двір має власне тло, тому перевіряємо його окремо.
  ['порожній двір: назва (світла)', '#473b2e', '#fffbf2', NORMAL],
  ['порожній двір: підпис (світла)', '#71675c', '#fffbf2', NORMAL],
  ['порожній двір: стадо (світла)', '#2e2013', '#fffbf2', NORMAL],
  ['порожній двір: назва (темна)', '#ddd4c2', '#2b2318', NORMAL],
  ['порожній двір: підпис (темна)', '#b4ac9b', '#2b2318', NORMAL],
  ['порожній двір: стадо (темна)', '#f5ecd9', '#2b2318', NORMAL],
  ['--ink на --bg (світла)', '#2e2013', '#faf3e0', NORMAL],
  ['--ink на --card (світла)', '#2e2013', '#fffdf8', NORMAL],
  ['--ink-soft на --card (світла)', '#6b5b47', '#fffdf8', NORMAL],
  ['--ink на --bg (темна)', '#f5ecd9', '#201a12', NORMAL],
  ['--ink на --card (темна)', '#f5ecd9', '#2b2318', NORMAL],
  ['--ink-soft на --card (темна)', '#c9bba0', '#2b2318', NORMAL],
  ['межа --line на --card (світла)', '#2e2013', '#fffdf8', LARGE],
  ['межа --line на --card (темна)', '#f5ecd9', '#2b2318', LARGE],
];

/**
 * Завідомо проблемні комбінації — НЕ «провали», а задокументована заборона:
 * у темній темі --barn/--leaf світлішають (вони розраховані на темні поверхні),
 * тому білий текст на них падає нижче AA. Кнопки з білим текстом мусять мати
 * власний, темніший градієнт (див. SURFACES вище та docs/CONTRAST.md).
 * Якщо хтось «виправить» ці пари, змінивши токени, — аудит про це скаже.
 */
const FORBIDDEN = [
  ['білий на --barn (темна) — використовуй власний градієнт', '#ffffff', '#e06a57', 3.3],
  ['білий на --leaf (темна) — використовуй власний градієнт', '#ffffff', '#7cb585', 2.38],
];

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function normalize(hex) {
  const h = hex.replace('#', '');
  if (h.length === 3) return h.split('').map((c) => c + c).join('');
  return h;
}

function luminance(hex) {
  const h = normalize(hex);
  return (
    0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(h.slice(4, 6), 16))
  );
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

let failures = 0;

console.log('\nГрадієнтні поверхні (найгірший кінець):');
for (const [name, fg, top, bottom, need] of SURFACES) {
  const a = contrast(fg, top);
  const b = contrast(fg, bottom);
  const worst = Math.min(a, b);
  const ok = worst >= need;
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? '✓' : '✗'} ${name.padEnd(42)} ${a.toFixed(2)}/${b.toFixed(2)} → ${worst.toFixed(2)} (треба ${need})`,
  );
}

console.log('\nПлоскі пари токенів:');
for (const [name, fg, bg, need] of FLAT) {
  const value = contrast(fg, bg);
  const ok = value >= need;
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(42)} ${value.toFixed(2)} (треба ${need})`);
}

console.log('\nЗадокументовані заборони (білий текст на світлих токенах темної теми):');
for (const [name, fg, bg, expected] of FORBIDDEN) {
  const value = contrast(fg, bg);
  const asExpected = Math.abs(value - expected) < 0.05;
  if (!asExpected) failures += 1;
  console.log(
    `  ${asExpected ? '✓' : '✗'} ${name.padEnd(56)} ${value.toFixed(2)} (очікується ~${expected})`,
  );
}

console.log(
  `\nРЕЗУЛЬТАТ: ${failures === 0 ? 'усі пари відповідають WCAG 2.2 AA ✅' : `${failures} пар(и) нижче норми ❌`}`,
);
console.log('Таблиця й правила — docs/CONTRAST.md');
process.exit(failures === 0 ? 0 : 1);
