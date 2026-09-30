import { PREDATOR_SPRITES } from '../../assets/manifest';
import { PREDATORS, ZONES } from '../../game/config';
import type { GameEvent, HerdKey } from '../../game/types';
import { cn } from '../../lib/cn';
import { Sprite } from './Sprite';
import styles from './BoardScene.module.css';

interface RaidRunProps {
  /** Подія нападу — звідси беремо хижака й кого він краде. */
  event: GameEvent;
  /** Змінюється раз на хід: скидає анімацію, щоб вона переграла. */
  deltaKey: number;
}

/**
 * МАРШРУТ НАБІГУ — хижак обходить СВОЇ жертви по черзі.
 *
 * Лисиця краде качок і кіз, ведмідь — свиней і коней. Тому вона має пройти
 * саме цими дворами: спершу перший, потім другий, і лише тоді тікати.
 *
 * Координати беруться з ZONES (та сама розкладка, що для загонів), тож
 * маршрут автоматично збігається з картою — за переносу загону в редакторі
 * нічого правити не треба.
 */
function raidPath(raider: 'fox' | 'bear'): { x: number; y: number }[] {
  const stops = PREDATORS[raider].steals.map((key) => {
    const zone = ZONES[key];
    // Точка зупинки — центр загону: там хижак «стоїть над» тваринами.
    return { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };
  });
  // Втеча: за правий край карти, за межі поля (там ліс).
  return [...stops, { x: -12, y: stops[0]?.y ?? 20 }];
}

/**
 * Хижак на полі: вбігає, обходить свої жертви по черзі, тікає вліво.
 *
 * Раніше хижак малювався ВСЕРЕДИНІ загону й там смикався — гравець бачив
 * лише, як щось блимнуло над одним двором, і не розумів, кого саме
 * вкрали. Тепер це окремий шар сцени: видно весь маршрут.
 *
 * Показуємо ЛИШЕ коли є що красти (`steals` перетинається з наявними
 * тваринами) — інакше лисиця бігала б по порожніх дворах.
 */
export function RaidRun({ event, deltaKey }: RaidRunProps) {
  const raider = event.raider;
  if (!raider) return null;

  const path = raidPath(raider);
  const meta = PREDATORS[raider];
  // CSS-змінні з координатами: keyframes читають їх, тож маршрут живе в
  // одному місці — у ZONES, а не дублюється в стилях.
  const start = path[0]!;
  const vars: Record<string, string> = {
    '--stop-a-x': `${start.x}%`,
    '--stop-a-y': `${start.y}%`,
  };
  path.forEach((point, index) => {
    vars[`--stop-${index}-x`] = `${point.x}%`;
    vars[`--stop-${index}-y`] = `${point.y}%`;
  });

  return (
    <span
      key={`${raider}-${deltaKey}`}
      className={cn(styles.raidRun, styles[`raidRun--${raider}`])}
      style={vars as React.CSSProperties}
      aria-hidden
    >
      <Sprite
        src={PREDATOR_SPRITES[raider]}
        emoji={meta.emoji}
        alt={meta.label}
        className={styles.raidRunSprite}
      />
    </span>
  );
}

/** Які види краде цей хижак — щоб вирішити, чи показувати набіг узагалі. */
export function raidVictims(raider: 'fox' | 'bear'): readonly HerdKey[] {
  return PREDATORS[raider].steals;
}

