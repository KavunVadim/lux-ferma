import { WALK_SHEETS } from '../../assets/walk';
import { PREDATORS } from '../../game/config';
import type { GameEvent } from '../../game/types';
import { cn } from '../../lib/cn';
import { WalkToken } from './WalkToken';
import { raidPath, raidWalkVars } from './raidLogic';
import styles from './BoardScene.module.css';

interface RaidRunProps {
  /** Подія нападу — звідси беремо хижака й кого він краде. */
  event: GameEvent;
  /** Змінюється раз на хід: скидає анімацію, щоб вона переграла. */
  deltaKey: number;
}

/**
 * ХИЖАК БІЖИТЬ ПОЛЕМ (ПК): вбігає, обходить свої жертви по черзі, тікає.
 *
 * Це шар усередині КАРТИ, тож він існує лише в гілці `wide`. На телефоні
 * карти немає — там сітка дворів, і для неї є `MobileRaid` нижче.
 *
 * Ключове: хижак БІЖИТЬ анімацією ходи, а не їде статичною картинкою.
 * Було `<Sprite>` плюс keyframes на батькові — виглядало як картинка, що
 * пересувається екраном. Тепер `WalkToken` програє стрічку кадрів
 * (`assets/walk/fox.webp` і `bear.webp`, по 6 кадрів) — ті самі спрайти, що
 * в тварин у загонах, тож набіг виглядає частиною світу.
 */
export function RaidRun({ event, deltaKey }: RaidRunProps) {
  const raider = event.raider;
  if (!raider) return null;

  const meta = PREDATORS[raider];
  /*
   * CSS-змінні з координатами зупинок: keyframes читають їх, тож маршрут
   * живе в одному місці — у `ZONES`, а не дублюється в стилях.
   * `--stop-0` — перша жертва, `--stop-1` — друга.
   */
  const vars: Record<string, string> = {};
  raidPath(raider).forEach((point, index) => {
    vars[`--stop-${index}-x`] = `${point.x}%`;
    vars[`--stop-${index}-y`] = `${point.y}%`;
  });

  // Якщо стрічки кадрів немає — `WalkToken` покаже статичний спрайт.
  const walkVars = WALK_SHEETS[raider] ? raidWalkVars() : {};

  return (
    <span
      key={`${raider}-${deltaKey}`}
      className={cn(styles.raidRun, styles[`raidRun--${raider}`])}
      style={vars as React.CSSProperties}
      aria-hidden
    >
      <WalkToken
        species={raider}
        emoji={meta.emoji}
        className={styles.raidRunSprite}
        vars={walkVars}
      />
    </span>
  );
}

/**
 * НАБІГ НА ТЕЛЕФОНІ.
 *
 * Ось де був корінь проблеми: `RaidRun` рендерився ТІЛЬКИ в гілці `wide`
 * (усередині карти). На телефоні карти немає — там сітка дворів, тож набіг
 * не з'являвся ВЗАГАЛІ. Не «не анімований» — його просто не було.
 *
 * На мобільному маршрут по відсотках карти незастосовний, тому хижак
 * пробігає по СІТЦІ: з'являється біля першої жертви, переходить до другої,
 * тікає. Координати зупинок рахує `useRaidTargets` у GameScreen — він міряє
 * РЕАЛЬНІ плитки в DOM (сітка адаптивна, вгадувати не можна).
 */
export function MobileRaid({
  event,
  deltaKey,
}: {
  event: GameEvent;
  deltaKey: number;
}) {
  const raider = event.raider;
  if (!raider) return null;

  const meta = PREDATORS[raider];
  const walkVars = WALK_SHEETS[raider] ? raidWalkVars() : {};

  return (
    <span
      key={`${raider}-${deltaKey}`}
      className={cn(styles.mobileRaid, styles[`mobileRaid--${raider}`])}
      aria-hidden
    >
      <WalkToken species={raider} emoji={meta.emoji} className={styles.mobileRaidSprite} vars={walkVars} />
    </span>
  );
}
