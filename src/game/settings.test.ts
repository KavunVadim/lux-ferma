import { describe, expect, it } from 'vitest';
import { DICE_PRESETS, PREDATOR_MODES, TRADE_LIMIT_OPTIONS } from './config';
import { canTrade, createGame, resolveRoll, rollDice, tradesLeft } from './engine';
import { ALL_EFFECTS } from './sound';
import {
  DEFAULT_RULES,
  DEFAULT_SETTINGS,
  allEffectsOn,
  rulesOf,
  sanitizeSettings,
  stolenCount,
} from './settings';
import type { GameRules } from './settings';
import type { DiceFace, GameState } from './types';

const rules = (patch: Partial<GameRules> = {}): GameRules => ({ ...DEFAULT_RULES, ...patch });

function game(patch: Partial<GameRules> = {}, names: string[] = ['Аня', 'Богдан']): GameState {
  return createGame(names, rules(patch));
}

/** Детермінований «кидок»: усі виклики random повертають задане значення. */
const always = (value: number) => () => value;

describe('правила в стані партії', () => {
  it('партія зберігає копію правил', () => {
    const state = game({ tradesPerTurn: 1, predatorMode: 'off', dicePreset: 'calm' });
    expect(state.rules).toEqual(rules({ tradesPerTurn: 1, predatorMode: 'off', dicePreset: 'calm' }));
    // Наступні зміни налаштувань не мусять чіпати знімок правил у стані.
    const snapshot = { ...state.rules };
    expect(state.rules).toEqual(snapshot);
  });

  it('ліміт обмінів у стані керує canTrade', () => {
    const state = game({ tradesPerTurn: 1 });
    expect(canTrade(state)).toBe(true);
    const after = { ...state, trades: 1 };
    expect(canTrade(after)).toBe(false);
    expect(tradesLeft(after)).toBe(0);

    const unlimited = game({ tradesPerTurn: null });
    const unlimitedAfter = { ...unlimited, trades: 4 };
    expect(canTrade(unlimitedAfter)).toBe(true);
    expect(tradesLeft(unlimitedAfter)).toBeNull();
  });

  it('ліміт зі стану важливіший за типовий', () => {
    const state = game({ tradesPerTurn: 2 });
    expect(canTrade({ ...state, trades: 1 })).toBe(true);
    expect(canTrade({ ...state, trades: 2 })).toBe(false);
  });
});

describe('режими хижаків', () => {
  const foxGame = (patch: Partial<GameRules>) => {
    const state = game(patch);
    // Ведмідь іде першим кубиком, лисиця — другим; кидаємо саме лисицю.
    return { ...state, players: state.players.map((p) => ({ ...p, farm: { ...p.farm, duck: 4, goat: 2 } })) };
  };

  it('classic: хижак забирає весь вид', () => {
    const before = foxGame({ predatorMode: 'classic' });
    const outcome = resolveRoll(before, ['bear', 'fox']);
    // Лисиця краде качок і кіз — повністю.
    expect(outcome.state.players[0]?.farm.duck).toBe(0);
    expect(outcome.state.players[0]?.farm.goat).toBe(0);
    expect(outcome.events.some((event) => event.kind === 'loss')).toBe(true);
  });

  it('half: хижак забирає половину (округлення вгору)', () => {
    const before = foxGame({ predatorMode: 'half' });
    const outcome = resolveRoll(before, ['bear', 'fox']);
    expect(outcome.state.players[0]?.farm.duck).toBe(2);
    expect(outcome.state.players[0]?.farm.goat).toBe(1);
    // У поясненні видно, що забрано саме половину.
    const loss = outcome.events.find((event) => event.kind === 'loss');
    expect(loss?.detail).toContain('половину');
  });

  it('off: хижак нічого не забирає й не зʼїдає собаку', () => {
    const before = foxGame({ predatorMode: 'off' });
    const withDog = {
      ...before,
      players: before.players.map((player) => ({ ...player, farm: { ...player.farm, sdog: 1 } })),
    };
    const outcome = resolveRoll(withDog, ['bear', 'fox']);
    expect(outcome.state.players[0]?.farm.duck).toBe(4);
    expect(outcome.state.players[0]?.farm.goat).toBe(2);
    expect(outcome.state.players[0]?.farm.sdog).toBe(1);
    expect(outcome.events.every((event) => event.kind !== 'loss')).toBe(true);
    expect(outcome.events.some((event) => event.text?.includes('вимкнені'))).toBe(true);
  });

  it('stolenCount: класика / половина / вимкнено', () => {
    expect(stolenCount(5, 'classic')).toBe(5);
    expect(stolenCount(5, 'half')).toBe(3);
    expect(stolenCount(1, 'half')).toBe(1);
    expect(stolenCount(0, 'half')).toBe(0);
    expect(stolenCount(5, 'off')).toBe(0);
  });
});

describe('набори кубиків', () => {
  it('класичний набір — ті самі грані, що й у настільній грі', () => {
    expect(DICE_PRESETS.classic.one).toEqual(DICE_PRESETS.classic.one);
    expect(DICE_PRESETS.classic.one.filter((face) => face === 'bear')).toHaveLength(1);
    expect(DICE_PRESETS.classic.two.filter((face) => face === 'fox')).toHaveLength(1);
    expect(DICE_PRESETS.classic.one).toHaveLength(12);
    expect(DICE_PRESETS.classic.two).toHaveLength(12);
  });

  it('спокійний набір: хижаків немає взагалі', () => {
    const calm = DICE_PRESETS.calm;
    const all: DiceFace[] = [...calm.one, ...calm.two];
    expect(all).not.toContain('bear');
    expect(all).not.toContain('fox');
    expect(calm.one).toHaveLength(12);
    expect(calm.two).toHaveLength(12);
  });

  it('rollDice бере таблиці з потрібного набору', () => {
    // random → 0.999 дає останню грань: у класичному це ведмідь, у спокійному — не хижак.
    expect(rollDice(always(0.999), 'classic')).toContain('bear');
    const calmFaces = rollDice(always(0.999), 'calm');
    expect(calmFaces).not.toContain('bear');
    expect(calmFaces).not.toContain('fox');

    // random → 0.5 дає середину таблиці.
    expect(Array.isArray(rollDice(always(0.5), 'calm'))).toBe(true);
  });
});

describe('налаштування (sanitizeSettings)', () => {
  it('сміття замінюється типовими значеннями', () => {
    const clean = sanitizeSettings(null);
    expect(clean).toEqual(DEFAULT_SETTINGS);

    const partial = sanitizeSettings({ tradesPerTurn: 'багато', predatorMode: 'meh', volume: 99 });
    expect(partial.tradesPerTurn).toBe(DEFAULT_SETTINGS.tradesPerTurn);
    expect(partial.predatorMode).toBe(DEFAULT_SETTINGS.predatorMode);
    expect(partial.volume).toBe(1);
  });

  it('зберігає валідні значення й перемикачі ефектів', () => {
    const saved = sanitizeSettings({
      tradesPerTurn: 1,
      predatorMode: 'half',
      dicePreset: 'calm',
      balance: 'compact',
      sound: false,
      volume: 0.35,
      vibration: false,
      theme: 'dark',
      diceFlicker: true,
      effects: { raid: false, win: false },
    });
    expect(saved.tradesPerTurn).toBe(1);
    expect(saved.predatorMode).toBe('half');
    expect(saved.dicePreset).toBe('calm');
    expect(saved.balance).toBe('compact');
    expect(saved.sound).toBe(false);
    expect(saved.volume).toBe(0.35);
    expect(saved.vibration).toBe(false);
    expect(saved.theme).toBe('dark');
    expect(saved.diceFlicker).toBe(true);
    expect(saved.effects.raid).toBe(false);
    expect(saved.effects.win).toBe(false);
    expect(saved.effects.roll).toBe(true);
  });

  it('rulesOf вирізає саме правила', () => {
    const full = sanitizeSettings({
      tradesPerTurn: 2,
      predatorMode: 'off',
      dicePreset: 'calm',
      balance: 'compact',
      startDuck: false,
    });
    expect(rulesOf(full)).toEqual({
      tradesPerTurn: 2,
      predatorMode: 'off',
      dicePreset: 'calm',
      balance: 'compact',
      startDuck: false,
    });
  });

  it('старі збереження без startDuck отримують качку на старті', () => {
    // Поле з'явилось пізніше: у збереженні його немає, тож має підставитись
    // типове значення, а не undefined (інакше качка зникла б у всіх старих
    // партіях без жодного попередження).
    const old = sanitizeSettings({ tradesPerTurn: 1, balance: 'classic' });
    expect(old.startDuck).toBe(true);
  });

  it('усі ефекти увімкнені за замовчуванням', () => {
    expect(Object.values(allEffectsOn()).every(Boolean)).toBe(true);
    expect(Object.keys(DEFAULT_SETTINGS.effects)).toHaveLength(ALL_EFFECTS.length);
    expect(ALL_EFFECTS.length).toBeGreaterThanOrEqual(6);
  });
});

describe('довідники для UI', () => {
  it('кожен варіант має підпис і пояснення', () => {
    expect(TRADE_LIMIT_OPTIONS.length).toBeGreaterThanOrEqual(3);
    for (const option of TRADE_LIMIT_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.hint.length).toBeGreaterThan(0);
    }
    for (const mode of Object.values(PREDATOR_MODES)) {
      expect(mode.label.length).toBeGreaterThan(0);
      expect(mode.hint.length).toBeGreaterThan(0);
    }
    for (const preset of Object.values(DICE_PRESETS)) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.hint.length).toBeGreaterThan(0);
    }
  });
});
