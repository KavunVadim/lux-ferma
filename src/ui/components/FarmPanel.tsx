import { ANIMAL_SPRITES } from '../../assets/manifest';
import { ANIMALS, HERD_KEYS, PEN_TOKEN_CAP, SPECIES } from '../../game/config';
import type { Farm, Herd, HerdKey } from '../../game/types';
import { cn } from '../../lib/cn';
import { Sprite } from './Sprite';
import styles from './FarmPanel.module.css';

interface FarmPanelProps {
  farm: Farm;
  herd: Herd;
  /** Зміни по комірках за останній хід — показуємо як +N/−N. */
  deltas: Partial<Record<HerdKey, number>>;
  /** Змінюється раз на хід, щоб анімації перегралися. */
  deltaKey: number;
  className?: string;
  /** Клас для сітки дворів — на мобільному вона скролиться, а шапка лишається. */
  bodyClassName?: string;
}

/** Скільки видів зібрано (0..5) — це і є прогрес до перемоги. */
function speciesDone(farm: Farm): number {
  return SPECIES.filter((key) => farm[key] >= 1).length;
}

/** Коротка суть двору для рядка під назвою — щоб гравець розумів роль. */
const PEN_ROLE: Record<HerdKey, string> = {
  duck: 'найшвидше розмножуються',
  goat: 'тримають пару стабільно',
  pig: 'дорогі, але швидкі',
  horse: 'потрібні для перемоги',
  cow: 'найцінніші у стаді',
  sdog: 'захищає від лисиці',
  bdog: 'захищає від ведмедя',
};

/**
 * «Моя ферма»: сім дворів.
 *
 * Мобільний (базові стилі) — вертикальний список «свитками»: назва, лічильник
 * і роль двору в одному рядку. Шість-сім карток у сітці 3×2 давали дрібний
 * текст і шість разів «порожньо…», тоді як список дає місце під пояснення і
 * читається зверху вниз без блукання очима.
 *
 * ПК — сітка карток зі спрайтами тварин (там місця вистачає).
 */
export function FarmPanel({ farm, herd, deltas, deltaKey, className, bodyClassName }: FarmPanelProps) {
  const done = speciesDone(farm);

  return (
    <section className={cn('card', styles.panel, className)} aria-label="Моя ферма">
      <header className={styles.head}>
        <h3 className={styles.title}>🌾 Моя ферма</h3>
        <span className={styles.progressLabel}>
          <b>{done}</b> з {SPECIES.length} видів
        </span>
      </header>

      {/* Смужка прогресу: головна мета гри — зібрати п'ять видів. Раніше це
          доводилось рахувати очима по шести картках. */}
      <div
        className={styles.progress}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={SPECIES.length}
        aria-valuenow={done}
        aria-label="Зібрано видів тварин"
      >
        <i className={styles.progressFill} style={{ width: `${(done / SPECIES.length) * 100}%` }} />
      </div>

      <div className={cn(styles.pens, bodyClassName)}>
        {HERD_KEYS.map((key) => {
          const meta = ANIMALS[key];
          const count = farm[key];
          const delta = deltas[key] ?? 0;
          const shown = Math.min(count, PEN_TOKEN_CAP);
          const isDog = key === 'sdog' || key === 'bdog';

          return (
            <article
              key={`${key}-${deltaKey}`}
              className={cn(
                styles.pen,
                count > 0 && styles.filled,
                delta > 0 && styles.gain,
                delta < 0 && styles.loss,
              )}
            >
              <span className={cn(styles.signIconWrap, count === 0 && styles.signIconIdle)}>
                <Sprite src={ANIMAL_SPRITES[key]} emoji={meta.emoji} className={styles.signIcon} />
              </span>

              <span className={styles.info}>
                <b className={styles.house}>{meta.house}</b>
                <span className={styles.role}>
                  {count === 0 ? PEN_ROLE[key] : `${count} у дворі · ${PEN_ROLE[key]}`}
                </span>
              </span>

              {/* Спрайт-«розсип» у дворі лишаємо лише там, де є місце (ПК),
                  на мобільному лічильник замінює його. */}
              <span className={styles.yard} aria-hidden>
                {count > 0 &&
                  Array.from({ length: shown }, (_, index) => (
                    <Sprite
                      key={index}
                      src={ANIMAL_SPRITES[key]}
                      emoji={meta.emoji}
                      className={styles.token}
                    />
                  ))}
                {count > shown && <span className={styles.more}>+{count - shown}</span>}
              </span>

              <span className={styles.countGroup}>
                <b className={cn(styles.count, count > 0 && !isDog && styles.countDone)}>×{count}</b>
                <span className={styles.herd}>🧺 {herd[key]}</span>
              </span>

              {delta !== 0 && (
                <span className={cn(styles.delta, delta > 0 ? styles.plus : styles.minus)}>
                  {delta > 0 ? '+' : ''}
                  {delta}
                </span>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
