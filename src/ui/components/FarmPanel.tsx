import { ANIMAL_SPRITES } from '../../assets/manifest';
import { ANIMALS, HERD_KEYS, PEN_TOKEN_CAP } from '../../game/config';
import type { Farm, Herd, HerdKey } from '../../game/types';
import { cn } from '../../lib/cn';
import { Sprite } from './Sprite';
import styles from './FarmPanel.module.css';

interface FarmPanelProps {
  farm: Farm;
  herd: Herd;
  /** Зміни по комірках за останній хід — показуємо як +N/−N. */
  deltas: Partial<Record<HerdKey, number>>;
  /** Змінюється раз на хід, щоб анімації перегравалися. */
  deltaKey: number;
  className?: string;
  /** Клас для сітки дворів — на мобільному вона скролиться, а шапка лишається. */
  bodyClassName?: string;
}

/** «Моя ферма»: сім дворів зі спрайтами та залишком спільного стада. */
export function FarmPanel({ farm, herd, deltas, deltaKey, className, bodyClassName }: FarmPanelProps) {
  return (
    <section className={cn('card', styles.panel, className)} aria-label="Моя ферма">
      <header className={styles.head}>
        <h3 className={styles.title}>🌾 Моя ферма</h3>
        <span className={styles.hint}>🧺 число внизу — лишилось у спільному стаді</span>
      </header>

      <div className={cn(styles.pens, bodyClassName)}>
        {HERD_KEYS.map((key) => {
          const meta = ANIMALS[key];
          const count = farm[key];
          const delta = deltas[key] ?? 0;
          const shown = Math.min(count, PEN_TOKEN_CAP);

          return (
            <article
              key={`${key}-${deltaKey}`}
              className={cn(
                styles.pen,
                farm[key] > 0 && key !== 'sdog' && key !== 'bdog' && styles.filled,
                delta > 0 && styles.gain,
                delta < 0 && styles.loss,
              )}
            >
              <header className={styles.sign}>
                <Sprite src={ANIMAL_SPRITES[key]} emoji={meta.emoji} className={styles.signIcon} />
                <span className={styles.house}>{meta.house}</span>
                <span className={styles.count}>×{count}</span>
              </header>

              <div className={styles.yard}>
                {count === 0 ? (
                  <span className={styles.empty}>порожньо…</span>
                ) : (
                  <>
                    {Array.from({ length: shown }, (_, index) => (
                      <Sprite
                        key={index}
                        src={ANIMAL_SPRITES[key]}
                        emoji={meta.emoji}
                        className={styles.token}
                      />
                    ))}
                    {count > shown && <span className={styles.more}>+{count - shown}</span>}
                  </>
                )}
                {delta !== 0 && (
                  <span className={cn(styles.delta, delta > 0 ? styles.plus : styles.minus)}>
                    {delta > 0 ? '+' : ''}
                    {delta}
                  </span>
                )}
              </div>

              <footer className={styles.herd}>🧺 {herd[key]}</footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
