/**
 * Ігровий рушій: чисті функції стану без DOM, React і таймерів.
 * Усе, що стосується правил (кубики, розмноження, хижаки, обмін, перемога), живе тут.
 */
import {
  ANIMALS,
  BALANCE,
  DICE_PRESETS,
  PLAYER_AVATARS,
  PLAYER_COLORS,
  PREDATORS,
  SPECIES,
  TRADE_LADDER,
  WIN_SET,
} from './config';
import type { DicePreset, PredatorMode } from './config';
import { DEFAULT_RULES, stolenCount } from './settings';
import type { GameRules } from './settings';
import type {
  DiceFace,
  Farm,
  GameEvent,
  GameState,
  Herd,
  HerdKey,
  LogEntry,
  Player,
  RollOutcome,
  Species,
  TradeOption,
} from './types';

/** Версія формату збереження. Змінюйте разом із міграцією в storage.ts. */
export const SAVE_SCHEMA = 3;

const MAX_LOG = 40;

export function clone<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
}

export function emptyFarm(): Farm {
  return { duck: 0, goat: 0, pig: 0, horse: 0, cow: 0, sdog: 0, bdog: 0 };
}

export function emptyHerd(): Herd {
  return { duck: 0, goat: 0, pig: 0, horse: 0, cow: 0, sdog: 0, bdog: 0 };
}

/*────────────────────────────── Створення партії ──────────────────────────────*/

export function createGame(names: string[], rules: GameRules = DEFAULT_RULES): GameState {
  const herd = { ...emptyHerd(), ...BALANCE[rules.balance] };
  const herdStart = { ...herd };

  const players: Player[] = names.map((raw, index) => {
    const farm = emptyFarm();
    /*
     * Стартова качка: дає перший хід без глухого кута — без неї гравець може
     * кілька ходів нічого не отримувати, поки не випаде качка на кубику.
     * Вмикається в налаштуваннях; качка береться зі спільного стада, а не
     * з'являється «з повітря».
     */
    if (rules.startDuck && herd.duck > 0) {
      farm.duck = 1;
      herd.duck -= 1;
    }
    const name = raw.trim() || `Гравець ${index + 1}`;
    return {
      id: `player-${index + 1}`,
      name,
      color: PLAYER_COLORS[index % PLAYER_COLORS.length],
      avatar: PLAYER_AVATARS[index % PLAYER_AVATARS.length],
      farm,
    };
  });

  return {
    schema: SAVE_SCHEMA,
    rules: { ...rules },
    players,
    herd,
    herdStart,
    current: 0,
    rolled: false,
    trades: 0,
    dice: null,
    log: [
      { id: 0, playerIndex: -1, emoji: '🚜', text: `Гра почалась! Гравців: ${players.length}. Кожен отримує 1 качку 🦆` },
    ],
    logSeq: 1,
    message: 'Кинь кубики — і подивимось, чим закінчився хід 🌾',
    round: 1,
    over: false,
    winnerIndex: null,
  };
}

/*─────────────────────────────── Кубики ───────────────────────────────*/

export type RandomFn = () => number;

export function pickFace(table: readonly DiceFace[], random: RandomFn = Math.random): DiceFace {
  return table[Math.floor(random() * table.length)] ?? 'duck';
}

export function rollDice(
  random: RandomFn = Math.random,
  preset: DicePreset = 'classic',
): [DiceFace, DiceFace] {
  const table = DICE_PRESETS[preset];
  return [pickFace(table.one, random), pickFace(table.two, random)];
}

/*────────────────────────────── Розв'язок ходу ──────────────────────────────*/

function applyPredator(next: GameState, face: 'fox' | 'bear', mode: PredatorMode, events: GameEvent[]): void {
  const meta = PREDATORS[face];
  const player = next.players[next.current];
  const guard = ANIMALS[meta.guard];

  if (mode === 'off') {
    events.push({
      kind: 'raid',
      emoji: meta.emoji,
      subject: meta.steals[0],
      text: `${meta.label} ${meta.raidVerb}, але напади вимкнені в налаштуваннях`,
      detail: 'Хижаків можна повернути в «Налаштуваннях» → «Хижаки».',
      delta: 0,
      farmAfter: player.farm[meta.steals[0]],
      herdAfter: next.herd[meta.steals[0]],
    });
    return;
  }

  /*
   * ЧИ Є ЩО ЗАХИЩАТИ.
   *
   * Пес витрачається лише тоді, коли у дворі є хоч одна тварина з тих, кого
   * цей хижак краде (лисиця — качки й кози, ведмідь — свині й коні).
   *
   * Раніше пес кидався навіть на порожній двір: витрачався, повертався в
   * стадо, а гра писала «але забирати нічого». Виходило, що гравець втрачає
   * охоронця, не врятувавши нікого — це не логіка, а марна трата.
   */
  const hasPrey = meta.steals.some((key) => player.farm[key] > 0);

  if (hasPrey && player.farm[meta.guard] > 0) {
    player.farm[meta.guard] -= 1;
    next.herd[meta.guard] += 1;
    events.push({
      kind: 'save',
      emoji: meta.emoji,
      subject: meta.guard,
      raider: face,
      text: `${guard.label} відігнав ${meta.label.toLowerCase()}`,
      detail: `${meta.label} ${meta.raidVerb}, але пес кинувся навперейми. Тварини вціліли, а пес повернувся у спільне стадо.`,
      delta: -1,
      farmAfter: player.farm[meta.guard],
      herdAfter: next.herd[meta.guard],
    });
    return;
  }

  let saved = 0;
  for (const key of meta.steals) {
    const onFarm = player.farm[key];
    if (onFarm <= 0) continue;
    const qty = stolenCount(onFarm, mode);
    if (qty <= 0) continue;
    saved = 1;
    next.herd[key] += qty;
    player.farm[key] = onFarm - qty;
    const soft = mode === 'half' && qty < onFarm;
    events.push({
      kind: 'loss',
      emoji: meta.emoji,
      subject: key,
      raider: face,
      text: `${meta.label} ${meta.stealVerb} ${ANIMALS[key].plural}`,
      detail: soft
        ? `М’який режим: ${meta.raidVerb} половину — ${qty} з ${onFarm}. Потрібен був ${guard.label.toLowerCase()}.`
        : `${meta.stealVerb} всіх (${qty}). Потрібен був ${guard.label.toLowerCase()} — його у дворі не було.`,
      delta: -qty,
      farmAfter: player.farm[key],
      herdAfter: next.herd[key],
    });
  }

  if (!saved) {
    events.push({
      kind: 'raid',
      emoji: meta.emoji,
      subject: meta.steals[0],
      text: `${meta.label} ${meta.raidVerb}, але забирати нічого`,
      detail: `У тебе не було ${meta.steals.map((key) => ANIMALS[key].plural).join(' і ')}`,
      delta: 0,
      farmAfter: player.farm[meta.steals[0]],
      herdAfter: next.herd[meta.steals[0]],
    });
  }
}

/** Скільки тварин кожного виду випало на кубиках (хижаки не рахуються). */
export function diceCounts(faces: readonly DiceFace[]): Partial<Record<Species, number>> {
  const counts: Partial<Record<Species, number>> = {};
  for (const face of faces) {
    if (face === 'fox' || face === 'bear') continue;
    counts[face] = (counts[face] ?? 0) + 1;
  }
  return counts;
}

/**
 * Застосовує результат кидка: спершу хижаки, потім розмноження (як у вихідній грі).
 */
export function resolveRoll(state: GameState, faces: [DiceFace, DiceFace]): RollOutcome {
  const next = clone(state);
  const player = next.players[next.current];
  const before: Farm = { ...player.farm };
  const events: GameEvent[] = [];

  for (const face of faces) {
    if (face === 'fox' || face === 'bear') applyPredator(next, face, next.rules.predatorMode, events);
  }

  const counts = diceCounts(faces);
  for (const species of SPECIES) {
    const fromDice = counts[species] ?? 0;
    if (fromDice === 0) continue;

    const have = player.farm[species];
    const basis = have + fromDice;
    const pairs = Math.floor(basis / 2);
    const meta = ANIMALS[species];

    if (pairs <= 0) {
      events.push({
        kind: 'note',
        emoji: meta.emoji,
        subject: species,
        text: `${meta.label}: пари ще немає`,
        detail: `У дворі ${have} + ${fromDice} з кубиків = ${basis}. Для пари потрібно 2 — тобто ще ${2 - (basis % 2 || 2)}.`,
        delta: 0,
        farmAfter: have,
        herdAfter: next.herd[species],
        counted: { have, fromDice, pairs: 0 },
      });
      continue;
    }

    const taken = Math.min(pairs, next.herd[species]);
    if (taken > 0) {
      player.farm[species] += taken;
      next.herd[species] -= taken;
    }
    events.push({
      kind: 'gain',
      emoji: meta.emoji,
      subject: species,
      text: `${meta.label}: +${taken}${taken < pairs ? ' (у стаді було менше)' : ''}`,
      detail: `У дворі ${have} + ${fromDice} з кубиків = ${basis} → ${pairs} пар(и). Зі стада взято ${taken}.`,
      delta: taken,
      farmAfter: player.farm[species],
      herdAfter: next.herd[species],
      counted: { have, fromDice, pairs },
    });
  }

  if (events.length === 0) {
    events.push({ kind: 'note', emoji: '🌾', text: 'Нічого не змінилось' });
  }

  const deltas: Partial<Record<HerdKey, number>> = {};
  for (const key of Object.keys(player.farm) as HerdKey[]) {
    const diff = player.farm[key] - before[key];
    if (diff !== 0) deltas[key] = diff;
  }

  const hasLoss = events.some((event) => event.kind === 'loss');
  const hasGain = events.some((event) => event.kind === 'gain');
  const won = completeFarm(player.farm);

  next.dice = faces;
  next.rolled = true;
  // Стрічка («ticker») показує емодзі разом із текстом, тому префікс додаємо саме тут.
  next.message = events.map((event) => `${event.emoji} ${event.text}`).join(' · ');
  if (won) {
    next.over = true;
    next.winnerIndex = next.current;
  }

  logEntries(
    next,
    events.map((event) => ({
      playerIndex: next.current,
      emoji: event.emoji,
      text: event.text,
    })),
  );

  return {
    state: next,
    events,
    deltas,
    tone: hasLoss ? 'bad' : hasGain ? 'good' : 'neutral',
    won,
  };
}

/*──────────────────────────────── Обмін ────────────────────────────────*/

export function availableTrades(state: GameState): TradeOption[] {
  const player = state.players[state.current];
  if (!player) return [];

  const options: TradeOption[] = [];
  const affordable = (key: HerdKey, qty: number, fromFarm: boolean) =>
    fromFarm ? player.farm[key] >= qty : state.herd[key] >= qty;

  const push = (from: HerdKey, fromQty: number, to: HerdKey, toQty: number) => {
    options.push({ id: `${from}:${fromQty}->${to}:${toQty}`, from, fromQty, to, toQty });
  };

  for (const { a, b } of TRADE_LADDER) {
    const [aKey, aQty] = a;
    const [bKey, bQty] = b;
    if (affordable(aKey, aQty, true) && affordable(bKey, bQty, false)) push(aKey, aQty, bKey, bQty);
    if (affordable(bKey, bQty, true) && affordable(aKey, aQty, false)) push(bKey, bQty, aKey, aQty);
  }
  return options;
}

export function applyTrade(state: GameState, option: TradeOption): RollOutcome {
  const next = clone(state);
  const player = next.players[next.current];
  const before: Farm = { ...player.farm };
  const events: GameEvent[] = [];

  player.farm[option.from] -= option.fromQty;
  next.herd[option.from] += option.fromQty;
  player.farm[option.to] += option.toQty;
  next.herd[option.to] -= option.toQty;
  next.trades += 1;

  const won = completeFarm(player.farm);
  events.push({
    kind: 'gain',
    emoji: ANIMALS[option.to].emoji,
    subject: option.to,
    text: `Обмін: −${ANIMALS[option.from].emoji}×${option.fromQty} → +${ANIMALS[option.to].emoji}×${option.toQty}`,
    detail: 'Один обмін за хід — далі кидай кубики',
    delta: option.toQty,
    farmAfter: player.farm[option.to],
    herdAfter: next.herd[option.to],
  });

  const summary = events[0] ? `${events[0].emoji} ${events[0].text}` : '🔁 Обмін зроблено';
  next.message = `${summary}. Тепер кидай кубики!`;
  if (won) {
    next.over = true;
    next.winnerIndex = next.current;
  }
  logEntries(next, [{ playerIndex: next.current, emoji: '🔁', text: events[0]?.text ?? '' }]);

  const deltas: Partial<Record<HerdKey, number>> = {};
  for (const key of Object.keys(player.farm) as HerdKey[]) {
    const diff = player.farm[key] - before[key];
    if (diff !== 0) deltas[key] = diff;
  }

  return { state: next, events, deltas, tone: 'good', won };
}

/*─────────────────────────────── Хід і перемога ───────────────────────────*/

/** Чи можна зробити ще один обмін цього ходу (ліміт — із правил партії). */
export function canTrade(state: GameState, limit: number | null = state.rules.tradesPerTurn): boolean {
  if (state.over || state.rolled) return false;
  return limit === null || state.trades < limit;
}

/** Скільки обмінів ще лишилось; `null` — без обмежень. */
export function tradesLeft(
  state: GameState,
  limit: number | null = state.rules.tradesPerTurn,
): number | null {
  return limit === null ? null : Math.max(0, limit - state.trades);
}

export function endTurn(state: GameState): GameState {
  if (state.over) return state;
  const next = clone(state);
  const count = next.players.length;
  const nextIndex = (next.current + 1) % count;
  next.current = nextIndex;
  next.rolled = false;
  next.trades = 0;
  next.dice = null;
  if (nextIndex === 0) next.round += 1;
  const player = next.players[nextIndex];
  next.message = `📳 Передай пристрій — ходить ${player ? player.name : ''}!`;
  logEntries(next, [
    { playerIndex: nextIndex, emoji: '▶️', text: `Хід: ${player ? player.name : ''}` },
  ]);
  return next;
}

/** Чи зібрано повну ферму (по одній тварині кожного з п'яти видів). */
export function completeFarm(farm: Farm): boolean {
  return WIN_SET.every((species) => farm[species] >= 1);
}

/** Скільки з п'яти видів уже є у дворі. */
export function progress(farm: Farm): number {
  return WIN_SET.filter((species) => farm[species] >= 1).length;
}

export function currentPlayer(state: GameState): Player | undefined {
  return state.players[state.current];
}

/** Додає записи в лог (нові — зверху) і просуває лічильник id. */
function logEntries(state: GameState, entries: Array<Omit<LogEntry, 'id'>>): void {
  const fresh: LogEntry[] = entries.map((entry) => ({ id: state.logSeq++, ...entry }));
  state.log = [...fresh, ...state.log].slice(0, MAX_LOG);
}
