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

/** Коротка суть двору — пояснення ролі, видно лише на ПК (там є ширина). */
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
 * Компоновка плитки на телефоні: іконка ліворуч, праворуч — назва, під нею
 * одним рядком «×N 🧺M». Лічильник стоїть У ПОТОЦІ колонки під назвою.
 *
 * Чому саме так: у колонці ~165px бічний бейдж лічильника забирав близько
 * половини ширини, і «Коровник» різався в «К…» — ні зменшення шрифту, ні
 * padding це не лікували, бо ширини просто не лишалось. Під назвою ж
 * лічильник має всю ширину плитки.
 *
 * ПК — картки зі спрайтами тварин у дворі й повним поясненням ролі.
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
          const empty = count === 0;

          return (
            <article
              key={`${key}-${deltaKey}`}
              className={cn(
                styles.pen,
                !empty && styles.filled,
                delta > 0 && styles.gain,
                delta < 0 && styles.loss,
              )}
            >
              <span className={cn(styles.signIconWrap, empty && styles.signIconIdle)}>
                <Sprite src={ANIMAL_SPRITES[key]} emoji={meta.emoji} className={styles.signIcon} />
              </span>

              <span className={styles.info}>
                <b className={styles.house}>{meta.house}</b>
                <span className={styles.role}>
                  {empty ? 'порожньо' : `${count} у дворі`}
                  <span className={styles.roleLong}> · {PEN_ROLE[key]}</span>
                </span>
                <span className={styles.meta}>
                  <b className={cn(styles.count, !empty && !isDog && styles.countDone)}>×{count}</b>
                  <span className={styles.herd}>🧺{herd[key]}</span>
                </span>
              </span>

              {/* Спрайт-«розсип» у дворі — лише на ПК, де під це є місце. */}
              <span className={styles.yard} aria-hidden>
                {!empty &&
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
