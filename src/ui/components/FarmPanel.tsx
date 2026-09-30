import { ANIMAL_SPRITES } from '../../assets/manifest';
import { ANIMALS, DOGS, PEN_TOKEN_CAP, SPECIES } from '../../game/config';
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

/**
 * Драбина цінності: чим старша тварина, тим більша її плитка.
 *
 *   качки, кози → 1 (найкомпактніші: наймолодші, їх найбільше)
 *   свині, коні  → 2 (середня ланка)
 *   корова       → 3 (найбільша: замикає драбину й перемогу)
 *   собаки       → 0 (захист, не вид — стоять найщільніше)
 *
 * Розмір тут не декор: телефон лежить на столі між гравцями, і око має
 * одразу чіплятись за найважливіше — корову.
 */
const PEN_TIER: Record<HerdKey, number> = {
  duck: 1,
  goat: 1,
  pig: 2,
  horse: 2,
  cow: 3,
  sdog: 0,
  bdog: 0,
};

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

interface PenProps {
  species: HerdKey;
  farm: Farm;
  herd: Herd;
  deltas: Partial<Record<HerdKey, number>>;
  deltaKey: number;
}

/** Одна плитка двору. */
function Pen({ species, farm, herd, deltas, deltaKey }: PenProps) {
  const meta = ANIMALS[species];
  const count = farm[species];
  const delta = deltas[species] ?? 0;
  const shown = Math.min(count, PEN_TOKEN_CAP);
  const isDog = species === 'sdog' || species === 'bdog';
  const empty = count === 0;

  return (
    <article
      key={`${species}-${deltaKey}`}
      /* data-tier задає розмір плитки в CSS — крок драбини цінності. */
      data-tier={PEN_TIER[species]}
      className={cn(styles.pen, !empty && styles.filled, delta > 0 && styles.gain, delta < 0 && styles.loss)}
    >
      <span className={cn(styles.signIconWrap, empty && styles.signIconIdle)}>
        <Sprite src={ANIMAL_SPRITES[species]} emoji={meta.emoji} className={styles.signIcon} />
      </span>

      <span className={styles.info}>
        <b className={styles.house}>{meta.house}</b>
        <span className={styles.role}>
          {empty ? 'порожньо' : `${count} у дворі`}
          <span className={styles.roleLong}> · {PEN_ROLE[species]}</span>
        </span>
        <span className={styles.meta}>
          <b className={cn(styles.count, !empty && !isDog && styles.countDone)}>×{count}</b>
          <span className={styles.herd}>🧺{herd[species]}</span>
        </span>
      </span>

      {/* Спрайт-«розсип» у дворі — лише на ПК, де під це є місце. */}
      <span className={styles.yard} aria-hidden>
        {!empty &&
          Array.from({ length: shown }, (_, index) => (
            <Sprite key={index} src={ANIMAL_SPRITES[species]} emoji={meta.emoji} className={styles.token} />
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
}

/**
 * «Моя ферма» — одна сітка дворів, що заповнює всю панель.
 *
 * Порядок = драбина цінності, згори вниз:
 *   качки, кози (найкомпактніші) → свині, коні (більші) →
 *   корова (найбільша, окремим рядком по центру) → собаки (найщільніші).
 *
 * Одна сітка на всі рядки, а не три окремі блоки: раніше корова й собаки
 * були власними блоками з нерівними відступами, і саме між ними лишалась
 * порожня площа. Тут сітка тягне всю висоту панелі й ділить її між рядками,
 * тож пустот не лишається.
 *
 * Плитка: іконка ліворуч; праворуч назва, під нею «×N 🧺M». Назва має flex: 1
 * і за потреби переноситься — інакше довге «Вовкодав» обрізалось.
 */
export function FarmPanel({ farm, herd, deltas, deltaKey, className, bodyClassName }: FarmPanelProps) {
  const done = speciesDone(farm);
  // Корова замикає драбину (остання у SPECIES) — беремо її з того самого
  // списку, а не константою, щоб зміна балансу не ламала розмітку.
  const cow = SPECIES[SPECIES.length - 1]!;
  const young = SPECIES.filter((species) => species !== cow);

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
        {/* 1. Молодші види парами: спершу качки/кози, далі свині/коні. */}
        {young.map((species) => (
          <Pen
            key={species}
            species={species}
            farm={farm}
            herd={herd}
            deltas={deltas}
            deltaKey={deltaKey}
          />
        ))}

        {/* 2. Корова — сама в рядку по центру: найбільша й найцінніша. */}
        <Pen species={cow} farm={farm} herd={herd} deltas={deltas} deltaKey={deltaKey} />

        {/* 3. Охорона — теж у сітці, але найщільніша: це не вид перемоги. */}
        {DOGS.map((dog) => (
          <Pen
            key={dog}
            species={dog}
            farm={farm}
            herd={herd}
            deltas={deltas}
            deltaKey={deltaKey}
          />
        ))}
      </div>
    </section>
  );
}
