import { WALK_STYLE } from '../../game/config';
import type { HerdKey } from '../../game/types';

/**
 * Детермінована «випадковість» для анімацій спрайтів.
 *
 * Тварини мають рухатися по-різному (пастися, ходити, підстрибувати) і не
 * синхронно. Справжній `Math.random` тут не годиться: кожен рендер давав би
 * нові значення, і спрайт смикався б на місці. Тому параметри рахуються
 * хешем від стабільного ключа (вид тварини + її номер у загоні).
 */
export type MotionKind = 'wander' | 'graze' | 'hop' | 'rest';
export interface Motion {
  kind: MotionKind;
  /** CSS-змінні для кадрів анімації. */
  vars: Record<string, string>;
}

/** Цілочисельний хеш (xorshift) → 0..1. Стабільний для одного входу. */
export function noise(seed: number): number {
  let x = (seed * 2654435761) % 2147483647;
  if (x <= 0) x += 2147483646;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return ((x < 0 ? -x : x) % 100000) / 100000;
}

const KINDS: readonly MotionKind[] = ['wander', 'graze', 'hop', 'rest'];

/** Параметри руху для спрайта: вид анімації, тривалість, зсув, амплітуда. */
export function motionFor(key: string, index: number): Motion {
  let seed = 7;
  for (let i = 0; i < key.length; i += 1) seed = seed * 31 + key.charCodeAt(i);
  seed += index * 977;

  const kind = KINDS[Math.floor(noise(seed) * KINDS.length)] ?? 'wander';
  const second = noise(seed + 1);
  const third = noise(seed + 2);
  const fourth = noise(seed + 3);
  const style = WALK_STYLE[key as HerdKey];

  return {
    kind,
    vars: {
      '--dur': `${(2.6 + second * 2.6).toFixed(2)}s`,
      /**
       * Темп кроку для спрайт-листа ходи. Множиться на видовий коефіцієнт:
       * качка дріботить швидко, корова переступає повільно.
       */
      '--walk-dur': `${((0.85 + second * 0.7) * (style?.speed ?? 1)).toFixed(2)}s`,
      // Погойдування тіла й перевальцем — те, чого не малюють кадри.
      '--bob': `${style?.bob ?? 3}%`,
      '--waddle': `${style?.waddle ?? 2}deg`,
      // Негативна затримка — спрайт стартує посеред циклу, тому рухи не синхронні.
      '--delay': `-${(third * 4).toFixed(2)}s`,
      '--dx': `${(2 + fourth * 6).toFixed(1)}%`,
      '--dy': `${(1.5 + second * 4).toFixed(1)}%`,
      '--tilt': `${(second * 6 - 3).toFixed(1)}deg`,
      '--flip': fourth > 0.5 ? '-1' : '1',
    },
  };
}
