import { useEffect, useState } from 'react';
import { FACE_SPRITES } from '../../assets/manifest';
import { DIE_ONE, DIE_TWO, FACE_EMOJI } from '../../game/config';
import { pickFace } from '../../game/engine';
import type { DiceFace } from '../../game/types';
import { cn } from '../../lib/cn';
import { Sprite } from './Sprite';
import styles from './Dice.module.css';

type DiceSize = 'normal' | 'mini' | 'hud';

/**
 * Грані для «блимання» під час кидка — без хижаків.
 *
 * Хижаки випадають у 16% кидків (1 з 6), але якщо крутити їх у кожному кадрі
 * анімації, здається, що вони випадають постійно (за один кидок лисиця чи
 * ведмідь блимають ~2 рази навіть коли результат — качка). Результат кидка
 * рахує рушій, тож на анімацію це не впливає — лише на сприйняття.
 * Хочете повернути «повне» блимання — приберіть фільтри нижче.
 */
const FLICKER_ONE: readonly DiceFace[] = DIE_ONE.filter((face) => face !== 'bear');
const FLICKER_TWO: readonly DiceFace[] = DIE_TWO.filter((face) => face !== 'fox');

/** Грань, відмінна від попередньої — щоб кубик не «залипав» на одному символі. */
function pickDifferent(table: readonly DiceFace[], previous: DiceFace | undefined): DiceFace {
  let face = pickFace(table);
  for (let attempt = 0; attempt < 3 && face === previous; attempt += 1) {
    face = pickFace(table);
  }
  return face;
}

interface DiceProps {
  /** Грані поточного кидка (null — ще не кидали). */
  faces: [DiceFace, DiceFace] | null;
  /** Триває анімація — показуємо випадкові грані. */
  rolling?: boolean;
  size?: DiceSize;
  labels?: boolean;
  /** Показувати хижаків і під час обертання (налаштування «Анімація кидка»). */
  flickerPredators?: boolean;
}

const PREDATORS = new Set<DiceFace>(['fox', 'bear']);

/**
 * Пара кубиків. Під час кидка перебирає випадкові грані, після — показує результат.
 * Грані малюються спрайтами тварин із фолбеком на емодзі.
 */
export function Dice({
  faces,
  rolling = false,
  size = 'normal',
  labels = false,
  flickerPredators = false,
}: DiceProps) {
  const [flicker, setFlicker] = useState<[DiceFace, DiceFace] | null>(null);

  useEffect(() => {
    if (!rolling) return;
    const tableOne = flickerPredators ? DIE_ONE : FLICKER_ONE;
    const tableTwo = flickerPredators ? DIE_TWO : FLICKER_TWO;

    // Напруга як у слот-машини: спершу кадри летять швидко, під кінець
    // сповільнюються — тому грань, що випала, вгадується в останній миті.
    let cancelled = false;
    let timer = 0;
    let tick = 0;
    const step = () => {
      const delay = 55 + tick * tick * 1.9;
      timer = window.setTimeout(() => {
        if (cancelled) return;
        setFlicker((previous) => [
          pickDifferent(tableOne, previous?.[0]),
          pickDifferent(tableTwo, previous?.[1]),
        ]);
        tick += 1;
        step();
      }, delay);
    };
    step();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [rolling, flickerPredators]);

  const shown: [DiceFace, DiceFace] | null = rolling ? flicker : faces;

  const dieClass = cn(
    styles.die,
    size === 'mini' && styles.mini,
    size === 'hud' && styles.hud,
    // Обертання — на самому кубику: 3D-перекид читається як кидок, а лоток
    // лишається нерухомим, тому картка не «дихає» і не зсуває сусідів.
    rolling && styles.tumbling,
  );

  const renderDie = (face: DiceFace | null, tone: 'blue' | 'orange') => (
    <div className={cn(dieClass, tone === 'blue' ? styles.blue : styles.orange)}>
      <div className={cn(styles.face, face && PREDATORS.has(face) && styles.predator)}>
        {face ? (
          <Sprite src={FACE_SPRITES[face] ?? ''} emoji={FACE_EMOJI[face]} alt={FACE_EMOJI[face]} className={styles.sprite} />
        ) : (
          <span className={styles.unknown}>❔</span>
        )}
      </div>
    </div>
  );

  return (
    <div className={cn(styles.tray, size === 'mini' && styles.trayMini)}>
      <div className={styles.wrap}>
        {renderDie(shown ? shown[0] : null, 'blue')}
        {labels && <span className={styles.label}>1-й кубик</span>}
      </div>
      <div className={styles.wrap}>
        {renderDie(shown ? shown[1] : null, 'orange')}
        {labels && <span className={styles.label}>2-й кубик</span>}
      </div>
    </div>
  );
}
