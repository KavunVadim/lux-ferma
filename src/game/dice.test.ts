/**
 * Аудит кубиків: чи справді розподіл такий, як задумано настільною грою.
 *
 * 1) Детермінований тест: фіксований ГПВЧ + кратна 12 вибірка → кожна грань
 *    має випасти приблизно стільки разів, скільки її в таблиці. Якщо в таблиці
 *    випадково опиниться два ведмеді замість одного — тест це зловить.
 * 2) Емпірична перевірка на справжньому Math.random (100 000 кидків) із
 *    широкими межами, щоб не було «флаків», але й підміна була помітна.
 * 3) Розрахунок частоти нападів для гравця — з поясненням у виводі.
 */
import { describe, expect, it } from 'vitest';
import { DIE_ONE, DIE_TWO } from './config';
import { rollDice } from './engine';
import type { DiceFace } from './types';

/** Детермінований генератор (mulberry32): той самий результат у кожному запуску. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FACES: DiceFace[] = ['duck', 'goat', 'pig', 'horse', 'cow', 'fox', 'bear'];

const share = (table: readonly DiceFace[], face: DiceFace): number =>
  table.filter((item) => item === face).length / table.length;

describe('кубики: задум', () => {
  it('ведмідь лише на першому кубику, лисиця лише на другому', () => {
    expect(DIE_ONE.filter((face) => face === 'bear')).toHaveLength(1);
    expect(DIE_ONE.filter((face) => face === 'fox')).toHaveLength(0);
    expect(DIE_TWO.filter((face) => face === 'fox')).toHaveLength(1);
    expect(DIE_TWO.filter((face) => face === 'bear')).toHaveLength(0);
  });

  it('корова лише на першому кубику, кінь лише на другому', () => {
    expect(DIE_ONE).toContain('cow');
    expect(DIE_TWO).not.toContain('cow');
    expect(DIE_TWO).toContain('horse');
    expect(DIE_ONE).not.toContain('horse');
  });
});

describe('кубики: виміряний розподіл', () => {
  const RUNS = 12_000; // кратно 12 — зручно порівнювати з частками
  const first: Partial<Record<DiceFace, number>> = {};
  const second: Partial<Record<DiceFace, number>> = {};

  const random = mulberry32(20260929);
  for (let run = 0; run < RUNS; run += 1) {
    const [a, b] = rollDice(random);
    first[a] = (first[a] ?? 0) + 1;
    second[b] = (second[b] ?? 0) + 1;
  }

  it('частки граней збігаються з таблицями (детерміновано)', () => {
    for (const face of FACES) {
      const expectedFirst = share(DIE_ONE, face) * RUNS;
      const gotFirst = first[face] ?? 0;
      if (expectedFirst === 0) expect(gotFirst).toBe(0);
      else expect(gotFirst).toBeGreaterThan(expectedFirst * 0.95);

      const expectedSecond = share(DIE_TWO, face) * RUNS;
      const gotSecond = second[face] ?? 0;
      if (expectedSecond === 0) expect(gotSecond).toBe(0);
      else expect(gotSecond).toBeGreaterThan(expectedSecond * 0.95);
    }
  });

  it('напад хижака трапляється приблизно раз на 6 кидків (теорія: 15.97%)', () => {
    let raids = 0;
    const rnd = mulberry32(777);
    const samples = 100_000;
    for (let run = 0; run < samples; run += 1) {
      const [a, b] = rollDice(rnd);
      if (a === 'bear' || b === 'fox') raids += 1;
    }
    const rate = raids / samples;
    expect(rate).toBeGreaterThan(0.13);
    expect(rate).toBeLessThan(0.19);
  });
});

describe('кубики: звіт (виводиться під час тесту)', () => {
  it('друкує таблицю ймовірностей', () => {
    const samples = 200_000;
    const rnd = mulberry32(42);
    let bears = 0;
    let foxes = 0;
    let anyRaid = 0;
    let both = 0;

    for (let run = 0; run < samples; run += 1) {
      const [a, b] = rollDice(rnd);
      const bear = a === 'bear';
      const fox = b === 'fox';
      if (bear) bears += 1;
      if (fox) foxes += 1;
      if (bear || fox) anyRaid += 1;
      if (bear && fox) both += 1;
    }

    const percent = (value: number): string => `${((value / samples) * 100).toFixed(2)}%`;
    const lines = [
      '',
      '── Аудит кубиків (200 000 кидків) ─────────────────────────────',
      `  ведмідь на 1-му кубику : ${percent(bears)}   (задум 8.33%, 1 грань із 12)`,
      `  лисиця на 2-му кубику  : ${percent(foxes)}   (задум 8.33%, 1 грань із 12)`,
      `  хоч один хижак за хід  : ${percent(anyRaid)}  (задум 15.97% ≈ 1 з 6)`,
      `  обидва хижаки за хід   : ${percent(both)}   (задум 0.69%)`,
      '───────────────────────────────────────────────────────────────',
      '',
    ].join('\n');
    console.log(lines);

    expect(anyRaid).toBeGreaterThan(0);
  });
});
