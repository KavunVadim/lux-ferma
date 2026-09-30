/**
 * Усі правила й баланс гри в одному місці.
 *
 * Джерела: два вихідні HTML-прототипи (стиснутий мобільний «помічник» і
 * версія з асетами). Правила в них ідентичні, розходився лише стартовий
 * запас спільного стада — обидва варіанти збережено як пресети BALANCE.
 */
import type { DiceFace, DogKind, Herd, HerdKey, Species } from './types';

export const GAME_TITLE = 'Люкс Ферма';
export const GAME_TAGLINE = 'Помічник для гри на одному пристрої';

export const SPECIES: readonly Species[] = ['duck', 'goat', 'pig', 'horse', 'cow'];
export const DOGS: readonly DogKind[] = ['sdog', 'bdog'];
export const HERD_KEYS: readonly HerdKey[] = [...SPECIES, ...DOGS];

/** Види, яких треба мати хоча б по одному для перемоги. */
export const WIN_SET: readonly Species[] = SPECIES;

export interface AnimalMeta {
  key: HerdKey;
  emoji: string;
  /** Назва в однині: «Качка». */
  label: string;
  /** Назва у множині для фраз: «качки». */
  plural: string;
  /** Підпис двору/будівлі. */
  house: string;
  /** Спрайт тварини відносно public/ (без BASE_URL). */
  sprite: string;
}

export const ANIMALS: Record<HerdKey, AnimalMeta> = {
  duck: { key: 'duck', emoji: '🦆', label: 'Качка', plural: 'качки', house: 'Качник', sprite: 'assets/animals/duck.webp' },
  goat: { key: 'goat', emoji: '🐐', label: 'Коза', plural: 'кози', house: 'Козар', sprite: 'assets/animals/goat.webp' },
  pig: { key: 'pig', emoji: '🐖', label: 'Свиня', plural: 'свині', house: 'Свинарник', sprite: 'assets/animals/pig.webp' },
  horse: { key: 'horse', emoji: '🐎', label: 'Кінь', plural: 'коні', house: 'Стайня', sprite: 'assets/animals/horse.webp' },
  cow: { key: 'cow', emoji: '🐄', label: 'Корова', plural: 'корови', house: 'Коровник', sprite: 'assets/animals/cow.webp' },
  sdog: { key: 'sdog', emoji: '🐕', label: 'Малий пес', plural: 'песи', house: 'Мала будка', sprite: 'assets/animals/sdog.webp' },
  bdog: { key: 'bdog', emoji: '🐕‍🦺', label: 'Великий пес', plural: 'песи', house: 'Велика будка', sprite: 'assets/animals/bdog.webp' },
};

/** Спрайти будівель за видами. */
export const BUILDINGS: Record<HerdKey, string> = {
  duck: 'assets/buildings/duck.webp',
  goat: 'assets/buildings/goat.webp',
  pig: 'assets/buildings/pig.webp',
  horse: 'assets/buildings/horse.webp',
  cow: 'assets/buildings/cow.webp',
  sdog: 'assets/buildings/dog.webp',
  bdog: 'assets/buildings/dog.webp',
};

export const FACE_EMOJI: Record<DiceFace, string> = {
  duck: '🦆',
  goat: '🐐',
  pig: '🐖',
  horse: '🐎',
  cow: '🐄',
  fox: '🦊',
  bear: '🐻',
};

/** Спрайт грані кубика. */
export const FACE_SPRITE: Record<DiceFace, string> = {
  duck: 'assets/animals/duck.webp',
  goat: 'assets/animals/goat.webp',
  pig: 'assets/animals/pig.webp',
  horse: 'assets/animals/horse.webp',
  cow: 'assets/animals/cow.webp',
  fox: 'assets/animals/fox.webp',
  bear: 'assets/animals/bear.webp',
};

export interface PredatorMeta {
  face: 'fox' | 'bear';
  emoji: string;
  label: string;
  sprite: string;
  /** Кого хижак забирає у стадо, якщо немає пса. */
  steals: readonly HerdKey[];
  /** Пес, який відганяє хижака. */
  guard: HerdKey;
  /** Кубик, на якому трапляється хижак (для тексту правил). */
  die: 1 | 2;
  /** Дієслово для «забрала тварин» (узгодження роду). */
  stealVerb: string;
  /** Дієслово для «приходила/завітав». */
  raidVerb: string;
}

export const PREDATORS: Record<'fox' | 'bear', PredatorMeta> = {
  fox: {
    face: 'fox',
    emoji: '🦊',
    label: 'Лисиця',
    sprite: 'assets/animals/fox.webp',
    steals: ['duck', 'goat'],
    guard: 'sdog',
    die: 2,
    stealVerb: 'вкрала',
    raidVerb: 'підкралась',
  },
  bear: {
    face: 'bear',
    emoji: '🐻',
    label: 'Ведмідь',
    sprite: 'assets/animals/bear.webp',
    steals: ['pig', 'horse'],
    guard: 'bdog',
    die: 1,
    stealVerb: 'забрав',
    raidVerb: 'завітав',
  },
};

/** 12 граней першого кубика: 6 качок, 3 кози, свиня, корова, ведмідь. */
export const DIE_ONE: readonly DiceFace[] = [
  'duck', 'duck', 'duck', 'duck', 'duck', 'duck',
  'goat', 'goat', 'goat',
  'pig', 'cow', 'bear',
];

/** 12 граней другого кубика: 6 качок, 2 кози, 2 свині, кінь, лисиця. */
export const DIE_TWO: readonly DiceFace[] = [
  'duck', 'duck', 'duck', 'duck', 'duck', 'duck',
  'goat', 'goat',
  'pig', 'pig',
  'horse', 'fox',
];

export type DicePreset = 'classic' | 'calm';

/**
 * Набори кубиків. `calm` прибирає хижаків із кубиків (грань стає твариною) —
 * для компаній, де напади «раз на 6 ходів» здаються занадто частими.
 */
export const DICE_PRESETS: Record<
  DicePreset,
  { label: string; hint: string; one: readonly DiceFace[]; two: readonly DiceFace[] }
> = {
  classic: {
    label: 'Класичні',
    hint: 'хижак на кожному кубику: 8.3% + 8.3% → напад у 16% ходів',
    one: DIE_ONE,
    two: DIE_TWO,
  },
  calm: {
    label: 'Спокійніші',
    hint: 'без хижаків на кубиках',
    one: DIE_ONE.map((face) => (face === 'bear' ? 'goat' : face)),
    two: DIE_TWO.map((face) => (face === 'fox' ? 'pig' : face)),
  },
};

export type PredatorMode = 'classic' | 'half' | 'off';

/** Що роблять хижаки, коли випали. */
export const PREDATOR_MODES: Record<PredatorMode, { label: string; hint: string }> = {
  classic: { label: 'Як у грі', hint: 'забирає всіх качок і кіз (або свиней і коней)' },
  half: { label: 'М’які', hint: 'забирає половину тварин (округлення вгору)' },
  off: { label: 'Вимкнені', hint: 'хижаки приходять, але нічого не забирають' },
};

/** Варіанти ліміту обмінів для екрана налаштувань. */
export const TRADE_LIMIT_OPTIONS: readonly { value: number | null; label: string; hint: string }[] = [
  { value: null, label: 'Без обмежень', hint: 'можна міняти, скільки потрібно' },
  { value: 1, label: '1 за хід', hint: 'як у настільній грі' },
  { value: 2, label: '2 за хід', hint: 'компроміс' },
  { value: 3, label: '3 за хід', hint: 'жвавіше' },
];

/** Драбина обміну (працює в обидва боки). */
export const TRADE_LADDER: ReadonlyArray<{ a: [HerdKey, number]; b: [HerdKey, number] }> = [
  { a: ['duck', 6], b: ['goat', 1] },
  { a: ['goat', 2], b: ['pig', 1] },
  { a: ['pig', 3], b: ['horse', 1] },
  { a: ['horse', 2], b: ['cow', 1] },
  { a: ['goat', 1], b: ['sdog', 1] },
  { a: ['horse', 1], b: ['bdog', 1] },
];

/**
 * Типовий ліміт обмінів для нових партій. Живе в `DEFAULT_SETTINGS`
 * (src/game/settings.ts) — тут лише довідка: `null` = без обмежень.
 * Конкретна партія використовує `state.rules.tradesPerTurn`.
 */
export const TRADE_LIMIT_DEFAULT: number | null = null;

/** Порядок старшинства видів — потрібен, щоб ділити обміни на «вгору» і «вниз». */
export const SPECIES_TIER: Record<HerdKey, number> = {
  duck: 0,
  goat: 1,
  pig: 2,
  horse: 3,
  cow: 4,
  sdog: 5,
  bdog: 5,
};

/** Собаки — окрема гілка обміну, не «вгору» і не «вниз». */
export const isDogTrade = (option: { from: HerdKey; to: HerdKey }): boolean =>
  option.from === 'sdog' || option.from === 'bdog' || option.to === 'sdog' || option.to === 'bdog';

export type BalancePreset = 'classic' | 'compact';

/**
 * classic — стартовий запас із «помічника» (той, який подобається).
 * compact — менший запас із версії з асетами.
 */
export const BALANCE: Record<BalancePreset, Herd> = {
  classic: { duck: 60, goat: 24, pig: 20, horse: 12, cow: 4, sdog: 4, bdog: 2 },
  compact: { duck: 34, goat: 12, pig: 8, horse: 6, cow: 5, sdog: 3, bdog: 2 },
};

export const DEFAULT_BALANCE: BalancePreset = 'classic';

export const PLAYER_COLORS = ['#d9483b', '#2f7fc1', '#3f9d4e', '#a35fc4'] as const;
export const PLAYER_AVATARS = ['🧑‍🌾', '👩‍🌾', '👨‍🌾', '👩‍🦰'] as const;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

/*────────────────────────── Карта (десктопна сцена) ──────────────────────────*/

export interface ZoneLayout {
  /** Відсотки від площі сцени. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Прямокутник будівлі: left, top, width, height у відсотках зони. */
  building: [number, number, number, number];
  /** Прямокутник для спрайтів тварин: top, right, bottom, left. */
  tokens: [number, number, number, number];
  /** Максимум спрайтів у зоні (решта — «+N»). */
  cap: number;
}

export const ZONES: Record<HerdKey, ZoneLayout> = {
  // Координати виставлені в редакторі карти (npm run dev → /?editor=1)
  // по арт-карті (public/assets/map.webp, 1664×928):
  // прямокутник накриває намальований загін, building — будівлю в загоні,
  // tokens — вільне місце, де стоять спрайти тварин.
  // ── Розкладка з редактора карти (сеанс користувача, у % від площі сцени) ──
  // `cap` — скільки спрайтів малюємо у дворі (решта йде в «+N»). Качок показуємо
  // більше й купкою, бо вони дрібні; у решти дворів — по дві, щоб карта не
  // перевантажувалась фігурками.
  duck: { x: 24.5, y: 8.5, w: 23.5, h: 25.5, building: [36, 2.5, 37.5, 54.5], tokens: [46, 23.5, 3.5, 17.5], cap: 6 },
  goat: { x: 51.5, y: 10, w: 26, h: 23, building: [36.5, 0, 51.5, 73.5], tokens: [44, 29.5, 1.5, 24.5], cap: 2 },
  pig: { x: 8, y: 32.5, w: 27, h: 28.5, building: [26.5, 0, 48.5, 68], tokens: [34.5, 21, 10, 20.5], cap: 2 },
  horse: { x: 64, y: 34.5, w: 27, h: 27, building: [47.5, 2, 52.5, 61.5], tokens: [33.5, 28, 12, 23], cap: 2 },
  cow: { x: 36, y: 49.5, w: 27, h: 27.5, building: [41, 0, 44, 65], tokens: [30, 26.5, 10, 24.5], cap: 5 },
  sdog: { x: 20, y: 67.5, w: 16, h: 20.5, building: [35, 0, 40.5, 58.5], tokens: [15, 35, 20, 22], cap: 3 },
  bdog: { x: 62.5, y: 65.5, w: 15, h: 21, building: [22, 0, 54.5, 64], tokens: [25.5, 33.5, 4.5, 10], cap: 3 },
};

/**
 * Розмір спрайта за видом. Множиться на базову комірку `1.45em` (35.5px на ПК),
 * тому 1 = «одиниця» розміру.
 *
 * Порядок розмірів у грі має відповідати живій фермі:
 *   качка (найменша) → коза, свиня (більші) → собаки → кінь → корова (найбільша).
 * Коні й корови свідомо лишені як були — вони вже читались правильно, а великі
 * значення для них стоять тому, що на арті вони намальовані найдрібніше.
 */
export const SPRITE_SCALE: Record<HerdKey, number> = {
  duck: 0.9,
  // Коза й свиня мають бути помітно більшими за качку, інакше дрібний птах
  // і худоба виглядають одного розміру. Коза трохи вища за свиню.
  goat: 1.9,
  pig: 2.2,
  horse: 3,
  cow: 3.8,
  sdog: 1.7,
  // Великий пес — сторожовий, найбільша собака на фермі: 3.4 дає ~120px,
  // тобто більше за коня (106px), але менше за корову (135px).
  bdog: 3.4,
};

export interface WalkStyle {
  /** Множник темпу кроку: менше = швидші ноги. */
  speed: number;
  /** «Перевальцем» — нахил у градусах у такт із кроком (качка хитається). */
  waddle: number;
}

/**
 * Темп «переступання» за видом: кадри малюють лише ноги, тому дрібна качка без
 * цього читалась як тупання на місці — звідси темп і легкий нахил.
 */
export const WALK_STYLE: Record<HerdKey, WalkStyle> = {
  duck: { speed: 0.7, waddle: 4 },
  goat: { speed: 1, waddle: 1.5 },
  pig: { speed: 0.95, waddle: 1 },
  horse: { speed: 0.85, waddle: 1 },
  cow: { speed: 1.15, waddle: 1 },
  sdog: { speed: 0.8, waddle: 1.5 },
  bdog: { speed: 0.9, waddle: 1.5 },
};

export interface DecorPlacement {
  sprite: string;
  emoji: string;
  x: number;
  y: number;
  w: number;
}

const decor = (name: string, emoji: string, x: number, y: number, w: number): DecorPlacement => ({
  sprite: `assets/decor/${name}.webp`,
  emoji,
  x,
  y,
  w,
});

/**
 * На карті-арті вже намальовані дерева, соняшники, ставок, паркани, млин і річка —
 * тому з декору лишаємо тільки те, чого на арті немає: обійстя фермера й млин.
 * (Спрайти decor/*.webp доступні, якщо захочеться додати ще.)
 */
export const DECOR: readonly DecorPlacement[] = [
  decor('house', '🏠', 41.5, 24, 15),
  decor('mill', '🏭', 46, 1.5, 5.5),
];

export const MAP_SPRITE = 'assets/map.webp';

/** Скільки спрайтів максимум малюємо в пені «Моя ферма» на мобільному. */
export const PEN_TOKEN_CAP = 8;
