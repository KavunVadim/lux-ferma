import { describe, expect, it } from 'vitest';
import { DIE_ONE, DIE_TWO, SPECIES, TRADE_LADDER } from './config';
import {
  applyTrade,
  availableTrades,
  canTrade,
  completeFarm,
  createGame,
  emptyFarm,
  endTurn,
  pickFace,
  progress,
  resolveRoll,
  rollDice,
  tradesLeft,
} from './engine';
import type { DiceFace, GameState, HerdKey } from './types';

const game = (names: string[] = ['Аня', 'Богдан']): GameState => createGame(names);

/** Зручний хелпер: підмінює двір поточного гравця. */
const withFarm = (state: GameState, farm: Partial<Record<HerdKey, number>>): GameState => {
  const next = structuredClone(state);
  const player = next.players[next.current];
  if (player) player.farm = { ...emptyFarm(), ...farm };
  return next;
};

const withHerd = (state: GameState, herd: Partial<Record<HerdKey, number>>): GameState => {
  const next = structuredClone(state);
  next.herd = { ...next.herd, ...herd };
  return next;
};

const roll = (faces: [DiceFace, DiceFace]) => faces;

describe('кубики', () => {
  it('містить по 12 граней, як у настільній грі', () => {
    expect(DIE_ONE).toHaveLength(12);
    expect(DIE_TWO).toHaveLength(12);
  });

  it('має правильний розподіл граней', () => {
    const count = (faces: readonly DiceFace[], face: DiceFace) =>
      faces.filter((item) => item === face).length;

    expect(count(DIE_ONE, 'duck')).toBe(6);
    expect(count(DIE_ONE, 'goat')).toBe(3);
    expect(count(DIE_ONE, 'pig')).toBe(1);
    expect(count(DIE_ONE, 'cow')).toBe(1);
    expect(count(DIE_ONE, 'bear')).toBe(1);
    expect(count(DIE_ONE, 'horse')).toBe(0);
    expect(count(DIE_ONE, 'fox')).toBe(0);

    expect(count(DIE_TWO, 'duck')).toBe(6);
    expect(count(DIE_TWO, 'goat')).toBe(2);
    expect(count(DIE_TWO, 'pig')).toBe(2);
    expect(count(DIE_TWO, 'horse')).toBe(1);
    expect(count(DIE_TWO, 'fox')).toBe(1);
    expect(count(DIE_TWO, 'cow')).toBe(0);
    expect(count(DIE_TWO, 'bear')).toBe(0);
  });

  it('pickFace бере першу грань за random()=0 і останню за random()→1', () => {
    expect(pickFace(DIE_ONE, () => 0)).toBe(DIE_ONE[0]);
    expect(pickFace(DIE_ONE, () => 0.999999)).toBe(DIE_ONE[DIE_ONE.length - 1]);
  });

  it('rollDice повертає по одній грані з кожного кубика', () => {
    const [first, second] = rollDice(() => 0.5);
    expect(DIE_ONE).toContain(first);
    expect(DIE_TWO).toContain(second);
  });
});

describe('створення партії', () => {
  it('дає кожному гравцю по качці зі стада', () => {
    const state = game(['Аня', 'Богдан', 'Влад']);
    expect(state.players.map((player) => player.farm.duck)).toEqual([1, 1, 1]);
    expect(state.herd.duck).toBe(state.herdStart.duck - 3);
  });

  it('підставляє імена за замовчуванням і не дублює кольори', () => {
    const state = game(['', '  ', 'Соломія']);
    expect(state.players[0]?.name).toBe('Гравець 1');
    expect(state.players[1]?.name).toBe('Гравець 2');
    expect(state.players[2]?.name).toBe('Соломія');
    expect(new Set(state.players.map((player) => player.color)).size).toBe(3);
  });

  it('стартує без переможця й з першим ходом', () => {
    const state = game();
    expect(state.current).toBe(0);
    expect(state.over).toBe(false);
    expect(state.winnerIndex).toBeNull();
    expect(state.rolled).toBe(false);
  });
});

describe('розмноження', () => {
  it('бере зі стада стільки тварин, скільки повних пар', () => {
    const base = withFarm(game(), { duck: 3 });
    const { state, events } = resolveRoll(base, roll(['duck', 'duck']));
    // 3 на фермі + 2 з кубиків = 5 → 2 пари → +2
    expect(state.players[0]?.farm.duck).toBe(5);
    expect(state.herd.duck).toBe(base.herd.duck - 2);
    expect(events.some((event) => event.kind === 'gain' && event.subject === 'duck')).toBe(true);
  });

  it('не чіпає види, яких не було на кубиках', () => {
    const base = withFarm(game(), { duck: 4, goat: 4 });
    const { state } = resolveRoll(base, roll(['duck', 'duck']));
    expect(state.players[0]?.farm.goat).toBe(4);
    // 4 на фермі + 2 з кубиків = 6 → 3 пари → +3
    expect(state.players[0]?.farm.duck).toBe(7);
  });

  it('обмежує народження залишком у спільному стаді', () => {
    const base = withHerd(withFarm(game(), { cow: 5 }), { cow: 1 });
    const { state, events } = resolveRoll(base, roll(['cow', 'duck']));
    expect(state.players[0]?.farm.cow).toBe(6);
    expect(state.herd.cow).toBe(0);
    expect(events.find((event) => event.subject === 'cow')?.text).toContain('у стаді було менше');
  });

  it('повідомляє, коли пари ще немає', () => {
    const base = withFarm(game(), { pig: 0 });
    const { events } = resolveRoll(base, roll(['pig', 'duck']));
    expect(events.find((event) => event.subject === 'pig')?.kind).toBe('note');
  });
});

describe('хижаки та собаки', () => {
  it('лисиця забирає всіх качок і кіз, якщо немає малого пса', () => {
    const base = withFarm(game(), { duck: 5, goat: 3, cow: 1 });
    const { state, events } = resolveRoll(base, roll(['duck', 'fox']));
    const player = state.players[0];
    expect(player?.farm.duck).toBe(0);
    expect(player?.farm.goat).toBe(0);
    expect(player?.farm.cow).toBe(1);
    expect(state.herd.duck).toBe(base.herd.duck + 5);
    expect(events.some((event) => event.kind === 'loss')).toBe(true);
  });

  it('ведмідь забирає свиней і коней', () => {
    const base = withFarm(game(), { pig: 4, horse: 2, goat: 1 });
    const { state } = resolveRoll(base, roll(['bear', 'duck']));
    const player = state.players[0];
    expect(player?.farm.pig).toBe(0);
    expect(player?.farm.horse).toBe(0);
    expect(player?.farm.goat).toBe(1);
  });

  it('малий пес відганяє лисицю і повертається у стадо', () => {
    const base = withFarm(game(), { duck: 5, goat: 2, sdog: 1 });
    const { state, events } = resolveRoll(base, roll(['duck', 'fox']));
    const player = state.players[0];
    expect(player?.farm.sdog).toBe(0);
    expect(player?.farm.duck).toBeGreaterThanOrEqual(5);
    expect(state.herd.sdog).toBe(base.herd.sdog + 1);
    expect(events.some((event) => event.kind === 'save')).toBe(true);
  });

  it('великий пес відганяє ведмедя', () => {
    const base = withFarm(game(), { pig: 3, horse: 1, bdog: 1 });
    const { state, events } = resolveRoll(base, roll(['bear', 'goat']));
    expect(state.players[0]?.farm.pig).toBe(3);
    expect(state.players[0]?.farm.horse).toBe(1);
    expect(events.some((event) => event.kind === 'save')).toBe(true);
  });

  it('хижак без здобичі не шкодить', () => {
    const base = withFarm(game(), { cow: 2 });
    const { state, events } = resolveRoll(base, roll(['bear', 'fox']));
    expect(state.players[0]?.farm.cow).toBe(2);
    expect(events.filter((event) => event.kind === 'raid')).toHaveLength(2);
  });
});

describe('перемога', () => {
  it('фіксує повну ферму', () => {
    const base = withFarm(game(), { duck: 0, goat: 1, pig: 1, horse: 1, cow: 1 });
    const { state, won } = resolveRoll(base, roll(['duck', 'duck']));
    expect(won).toBe(true);
    expect(state.over).toBe(true);
    expect(state.winnerIndex).toBe(0);
    expect(completeFarm(state.players[0]!.farm)).toBe(true);
    expect(progress(state.players[0]!.farm)).toBe(SPECIES.length);
  });

  it('першу корову дає лише обмін (одна грань корови не створює пари)', () => {
    const base = withFarm(game(), { duck: 1, goat: 1, pig: 1, horse: 1, cow: 0 });
    const { state, won } = resolveRoll(base, roll(['cow', 'duck']));
    expect(state.players[0]?.farm.cow).toBe(0);
    expect(won).toBe(false);
  });

  it('без корови партія продовжується', () => {
    const base = withFarm(game(), { duck: 1, goat: 1, pig: 1, horse: 1 });
    const { state, won } = resolveRoll(base, roll(['duck', 'goat']));
    expect(won).toBe(false);
    expect(state.over).toBe(false);
  });
});

describe('обмін', () => {
  it('пропонує лише те, на що вистачає тварин і стада', () => {
    const base = withFarm(game(), { duck: 6, goat: 0 });
    const options = availableTrades(base);
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ from: 'duck', fromQty: 6, to: 'goat', toQty: 1 });
  });

  it('працює в обидва боки', () => {
    const base = withFarm(game(), { goat: 1, duck: 0 });
    const options = availableTrades(base);
    const toDucks = options.find((option) => option.to === 'duck');
    expect(toDucks).toMatchObject({ from: 'goat', fromQty: 1, to: 'duck', toQty: 6 });
    // коза також міняється на малого пса — це друга доступна опція
    expect(options.map((option) => option.to).sort()).toEqual(['duck', 'sdog']);
  });

  it('не пропонує обмін, якщо у стаді порожньо', () => {
    const base = withHerd(withFarm(game(), { duck: 12 }), { goat: 0 });
    expect(availableTrades(base)).toHaveLength(0);
  });

  it('виконує обмін, оновлює стадо й позначає хід', () => {
    const base = withFarm(game(), { duck: 6 });
    const option = availableTrades(base)[0]!;
    const { state, won } = applyTrade(base, option);
    expect(state.players[0]?.farm.duck).toBe(0);
    expect(state.players[0]?.farm.goat).toBe(1);
    expect(state.herd.goat).toBe(base.herd.goat - 1);
    expect(state.trades).toBe(1);
    expect(won).toBe(false);
  });

  it('дозволяє кілька обмінів за хід, якщо ліміт не заданий', () => {
    const base = withFarm(game(), { duck: 18 });
    const first = applyTrade(base, { id: 'duck6->goat1', from: 'duck', fromQty: 6, to: 'goat', toQty: 1 });
    const second = applyTrade(first.state, {
      id: 'duck6->goat1',
      from: 'duck',
      fromQty: 6,
      to: 'goat',
      toQty: 1,
    });
    expect(second.state.trades).toBe(2);
    expect(second.state.players[0]?.farm).toMatchObject({ duck: 6, goat: 2 });
    expect(canTrade(second.state, null)).toBe(true);
    expect(tradesLeft(second.state, null)).toBeNull();
  });

  it('поважає ліміт обмінів за хід, якщо він заданий', () => {
    const base = withFarm(game(), { duck: 12 });
    const after = applyTrade(base, { id: 'duck6->goat1', from: 'duck', fromQty: 6, to: 'goat', toQty: 1 }).state;
    expect(canTrade(base, 1)).toBe(true);
    expect(canTrade(after, 1)).toBe(false);
    expect(tradesLeft(after, 1)).toBe(0);
    expect(tradesLeft(after, 3)).toBe(2);
  });

  it('після кидка обмін недоступний', () => {
    const rolled = resolveRoll(withFarm(game(), { duck: 12 }), roll(['duck', 'duck'])).state;
    expect(canTrade(rolled, null)).toBe(false);
  });

  it('обмін може одразу принести перемогу', () => {
    const base = withFarm(game(), { duck: 6, goat: 1, pig: 1, horse: 1, cow: 0 });
    expect(availableTrades(base).find((item) => item.to === 'cow')).toBeUndefined();

    // 2 коні → 1 корова; третій кінь лишається, і ферма стає повною
    const ladder = withFarm(game(), { horse: 3, cow: 0, duck: 1, goat: 1, pig: 1 });
    const horseTrade = availableTrades(ladder).find((item) => item.to === 'cow')!;
    const outcome = applyTrade(ladder, horseTrade);
    expect(outcome.won).toBe(true);
    expect(outcome.state.players[0]?.farm).toMatchObject({ horse: 1, cow: 1 });
  });

  it('драбина обміну описана коректно', () => {
    expect(TRADE_LADDER).toHaveLength(6);
    expect(TRADE_LADDER[0]).toEqual({ a: ['duck', 6], b: ['goat', 1] });
  });
});

describe('передача ходу', () => {
  it('переходить до наступного гравця і скидає стан ходу', () => {
    const rolled = resolveRoll(game(['Аня', 'Богдан', 'Влад']), roll(['duck', 'duck'])).state;
    const next = endTurn(rolled);
    expect(next.current).toBe(1);
    expect(next.rolled).toBe(false);
    expect(next.trades).toBe(0);
    expect(next.dice).toBeNull();
    expect(next.round).toBe(1);
  });

  it('збільшує номер кола після останнього гравця', () => {
    let state = game(['Аня', 'Богдан']);
    state = endTurn(state);
    state = endTurn(state);
    expect(state.current).toBe(0);
    expect(state.round).toBe(2);
  });

  it('не змінює хід у завершеній партії', () => {
    const finished = { ...game(), over: true };
    expect(endTurn(finished)).toEqual(finished);
  });
});

describe('представлення подій', () => {
  it('тексти подій не містять емодзі — його малює UI окремою іконкою', () => {
    const base = withFarm(game(), { duck: 1, goat: 1, pig: 1, horse: 1, cow: 1, sdog: 0, bdog: 1 });
    const { events, state } = resolveRoll(base, roll(['bear', 'fox']));
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.text.startsWith(event.emoji)).toBe(false);
    }
    // А в стрічці (ticker) емодзі вже є — там він доречний.
    expect(state.message).toContain(events[0]!.emoji);
  });

  it('лог зберігає емодзі окремим полем', () => {
    const base = withFarm(game(), { duck: 4 });
    const { state } = resolveRoll(base, roll(['duck', 'duck']));
    for (const entry of state.log) {
      expect(entry.text.startsWith(entry.emoji)).toBe(false);
    }
  });
});

describe('чистота стану', () => {
  it('resolveRoll не мутує вхідний стан', () => {
    const base = withFarm(game(), { duck: 4, goat: 4, sdog: 1 });
    const snapshot = structuredClone(base);
    resolveRoll(base, roll(['duck', 'fox']));
    expect(base).toEqual(snapshot);
  });

  it('applyTrade не мутує вхідний стан', () => {
    const base = withFarm(game(), { duck: 6 });
    const snapshot = structuredClone(base);
    applyTrade(base, availableTrades(base)[0]!);
    expect(base).toEqual(snapshot);
  });
});
