import { ANIMAL_SPRITES } from '../../assets/manifest';
import { ANIMALS, DOGS, PEN_TOKEN_CAP, SPECIES } from '../../game/config';
import type { Species } from '../../game/types';
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
 * Корова замикає драбину обміну, тому йде не в сітку, а окремим рядком.
 * Беремо останній вид зі SPECIES, а не константу: порядок у SPECIES — це і є
 * порядок драбини, тож за зміни балансу цей код не доведеться чіпати.
 */
const COW: Species = SPECIES[SPECIES.length - 1]!;

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

/** Одна плитка двору. Виділена окремо, бо малюється у двох сітках. */
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
 * «Моя ферма».
 *
 * Три зони замість однієї сітки з семи плиток:
 *  1) чотири МОЛОДШІ види — сітка в дві колонки;
 *  2) КОРОВА — окремо по центру: вона старша у драбині обміну й найцінніша
 *     (остання ланка до перемоги), тож не має губитись серед решти, як
 *     звичайний рядок сітки;
 *  3) два СОБАКИ — захист, а не вид: вони не входять у набір перемоги.
 *
 * Раніше всі сім плиток лежали в одній сітці, і ні корова, ні собаки не
 * вирізнялись — собаки ще й виглядали як «шостий і сьомий вид».
 *
 * Плитка на телефоні: іконка ліворуч; праворуч назва, під нею «×N 🧺M».
 * Лічильник має стояти під назвою, а не бічним бейджем: у колонці ~165px
 * бічний бейдж забирав половину ширини, і назва різалась.
 */
export function FarmPanel({ farm, herd, deltas, deltaKey, className, bodyClassName }: FarmPanelProps) {
  const done = speciesDone(farm);
  // Корова окремо: вона замикає драбину, тож має власний рядок по центру.
  const young = SPECIES.filter((species) => species !== COW);

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

      {/* 1. Молодші види. */}
      <div className={cn(styles.pens, bodyClassName)}>
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
      </div>

      {/* 2. Корова — по центру, окремим рядком: найцінніша тварина ферми. */}
      <div className={styles.cowRow}>
        <Pen species={COW} farm={farm} herd={herd} deltas={deltas} deltaKey={deltaKey} />
      </div>

      {/* 3. Охорона — окремо: собаки не дають перемоги, вони захищають двір. */}
      <div className={styles.guard}>
        <span className={styles.guardLabel}>🛡 Охорона двору</span>
        <div className={styles.guardRow}>
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
      </div>
    </section>
  );
}
