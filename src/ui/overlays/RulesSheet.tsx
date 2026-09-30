import { ANIMAL_SPRITES } from '../../assets/manifest';
import { ANIMALS, DICE_PRESETS, PREDATORS, SPECIES, TRADE_LADDER } from '../../game/config';
import type { DiceFace } from '../../game/types';
import { Button } from '../components/Button';
import { Sprite } from '../components/Sprite';
import { Overlay } from './Overlay';
import styles from './Overlays.module.css';

interface RulesSheetProps {
  onClose: () => void;
  /** Поточні правила партії — щоб текст обміну та кубиків був актуальним. */
  tradesPerTurn?: number | null;
  dicePreset?: keyof typeof DICE_PRESETS;
}

interface CountedFace {
  face: DiceFace;
  count: number;
  percent: number;
}

function countFaces(table: readonly DiceFace[]): CountedFace[] {
  const seen = new Map<DiceFace, number>();
  for (const face of table) seen.set(face, (seen.get(face) ?? 0) + 1);
  return [...seen.entries()]
    .map(([face, count]) => ({ face, count, percent: (count / table.length) * 100 }))
    .sort((a, b) => b.count - a.count);
}

const faceEmoji = (face: DiceFace): string =>
  face === 'fox' ? PREDATORS.fox.emoji : face === 'bear' ? PREDATORS.bear.emoji : ANIMALS[face].emoji;

const faceLabel = (face: DiceFace): string =>
  face === 'fox' ? PREDATORS.fox.label : face === 'bear' ? PREDATORS.bear.label : ANIMALS[face].label;

/** Спрайт/емодзі тварини — спільне для всіх блоків інструкції. */
function Face({ face, className }: { face: DiceFace; className?: string }) {
  const isBeast = face === 'fox' || face === 'bear';
  return (
    <Sprite
      src={isBeast ? PREDATORS[face].sprite : ANIMAL_SPRITES[face]}
      emoji={faceEmoji(face)}
      alt={faceLabel(face)}
      className={className}
    />
  );
}

/** Один крок ходу: номер у кружечку + текст. */
function Step({ n, icon, children }: { n: number; icon: string; children: React.ReactNode }) {
  return (
    <li className={styles.step}>
      <span className={styles.stepNum}>{n}</span>
      <span className={styles.stepIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.stepText}>{children}</span>
    </li>
  );
}

/** Рядок таблиці шансів: тварина, скільки граней, смужка ймовірності. */
function ChanceRow({ item, max }: { item: CountedFace; max: number }) {
  return (
    <li className={styles.chanceRow}>
      <Face face={item.face} className={styles.chanceFace} />
      <span className={styles.chanceName}>{faceLabel(item.face)}</span>
      <span className={styles.chanceBar}>
        <i style={{ width: `${(item.count / max) * 100}%` }} />
      </span>
      <b className={styles.chancePercent}>{item.percent.toFixed(0)}%</b>
    </li>
  );
}

/**
 * Правила гри — візуальна інструкція.
 *
 * Раніше це був суцільний текст у згорнутих блоках: щоб дізнатись мету,
 * треба було читати абзац. Тепер кожна тема має свою подачу:
 *   · мета — п'ять іконок тварин, яких треба зібрати;
 *   · хід — три пронумеровані кроки з іконками;
 *   · шанси кубиків — таблиця зі смужками ймовірності;
 *   · обмін — драбина зі стрілками в обидва боки;
 *   · хижаки — пари «хижак → кого краде → хто захищає».
 *
 * Числа беруться з конфіга, тож за зміни балансу текст не розійдеться з грою.
 */
export function RulesSheet({ onClose, tradesPerTurn = null, dicePreset = 'classic' }: RulesSheetProps) {
  const preset = DICE_PRESETS[dicePreset];
  const one = countFaces(preset.one);
  const two = countFaces(preset.two);
  const maxOne = one[0]?.count ?? 1;
  const maxTwo = two[0]?.count ?? 1;

  return (
    <Overlay variant="sheet" onClose={onClose} label="Правила гри">
      <div className="sheet">
        <div className="sheet__head">
          <h2>📖 Як грати</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>

        {/* ── Мета: п'ять іконок тварин, яких треба зібрати ── */}
        <section className={styles.ruleCard}>
          <h3 className={styles.ruleTitle}>🎯 Мета</h3>
          <p className={styles.ruleLead}>
            Збери на фермі хоча б по одній тварині кожного виду — і переможеш.
          </p>
          <ul className={styles.goalRow}>
            {SPECIES.map((species) => (
              <li key={species} className={styles.goalItem}>
                <Sprite
                  src={ANIMAL_SPRITES[species]}
                  emoji={ANIMALS[species].emoji}
                  alt={ANIMALS[species].label}
                  className={styles.goalFace}
                />
                <span>{ANIMALS[species].label}</span>
              </li>
            ))}
          </ul>
          <p className={styles.ruleNote}>
            На старті кожен уже має одну качку — решту добуваєш обміном і розмноженням.
          </p>
        </section>

        {/* ── Хід: три кроки ── */}
        <section className={styles.ruleCard}>
          <h3 className={styles.ruleTitle}>🔄 Хід гравця</h3>
          <ol className={styles.steps}>
            <Step n={1} icon="🔁">
              За бажанням обміняйся —{' '}
              {tradesPerTurn === null ? 'скільки завгодно разів' : `до ${tradesPerTurn} разів`}. Обмін
              доступний <b>лише до кидка</b>.
            </Step>
            <Step n={2} icon="🎲">
              Кинь кубики. Гра сама порахує, хто розмножився і чи прийшов хижак.
            </Step>
            <Step n={3} icon="✅">
              Натисни «Завершити хід» — і передай телефон наступному.
            </Step>
          </ol>
        </section>

        {/* ── Кубики: шанси смужками ── */}
        <section className={styles.ruleCard}>
          <h3 className={styles.ruleTitle}>🎲 Кубики</h3>
          <p className={styles.ruleLead}>
            {preset.label}: {preset.hint}.
          </p>

          <h4 className={styles.chanceHead}>1-й кубик</h4>
          <ul className={styles.chanceList}>
            {one.map((item) => (
              <ChanceRow key={item.face} item={item} max={maxOne} />
            ))}
          </ul>

          <h4 className={styles.chanceHead}>2-й кубик</h4>
          <ul className={styles.chanceList}>
            {two.map((item) => (
              <ChanceRow key={item.face} item={item} max={maxTwo} />
            ))}
          </ul>

          <p className={styles.ruleNote}>
            Кубики різні: корова й ведмідь — лише на першому, кінь і лисиця — лише на другому.
          </p>
        </section>

        {/* ── Розмноження з наочним прикладом ── */}
        <section className={styles.ruleCard}>
          <h3 className={styles.ruleTitle}>🐣 Розмноження</h3>
          <p className={styles.ruleLead}>
            Кожен вид, що випав хоч на одному кубику, дає приплід: скільки повних пар вийде з
            (тварини у дворі + кількість граней).
          </p>
          <div className={styles.birthExample}>
            <span className={styles.birthCol}>
              <b>3</b>
              <small>у дворі</small>
            </span>
            <span className={styles.birthOp}>+</span>
            <span className={styles.birthCol}>
              <b>1</b>
              <small>з кубика</small>
            </span>
            <span className={styles.birthOp}>=</span>
            <span className={styles.birthCol}>
              <b>4</b>
              <small>разом</small>
            </span>
            <span className={styles.birthOp}>→</span>
            <span className={styles.birthCol}>
              <b>+2</b>
              <small>2 пари</small>
            </span>
          </div>
          <p className={styles.ruleNote}>
            Види, яких на кубиках не було, не розмножуються. Собак розводять лише через обмін.
          </p>
        </section>

        {/* ── Хижаки: пари «хто краде — хто захищає» ── */}
        <section className={styles.ruleCard}>
          <h3 className={styles.ruleTitle}>🦊 Хижаки та захист</h3>
          <ul className={styles.beastList}>
            {(['fox', 'bear'] as const).map((face) => {
              const beast = PREDATORS[face];
              const guard = ANIMALS[beast.guard];
              return (
                <li key={face} className={styles.beastRow}>
                  <span className={styles.beastSide}>
                    <Face face={face} className={styles.beastFace} />
                    <b>{beast.label}</b>
                  </span>
                  <span className={styles.beastArrow} aria-hidden>
                    забирає
                  </span>
                  <span className={styles.beastSide}>
                    {beast.steals.map((key) => (
                      <Sprite
                        key={key}
                        src={ANIMAL_SPRITES[key]}
                        emoji={ANIMALS[key].emoji}
                        alt={ANIMALS[key].label}
                        className={styles.beastPrey}
                      />
                    ))}
                  </span>
                  <span className={styles.beastGuard}>
                    <Sprite
                      src={ANIMAL_SPRITES[beast.guard]}
                      emoji={guard.emoji}
                      alt={guard.label}
                      className={styles.beastFace}
                    />
                    <small>{guard.label} відганяє</small>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={styles.ruleNote}>
            Хижак забирає <b>усіх</b> тварин цих видів, а не одну. Корову не чіпають. Коли пес у
            дворі й є кого захищати — тварини лишаються, а пес повертається в стадо. Якщо у дворі
            самий пес і більше нічого — він лишається: захищати нікого.
          </p>
        </section>

        {/* ── Драбина обміну ── */}
        <section className={styles.ruleCard}>
          <h3 className={styles.ruleTitle}>🔁 Обмін</h3>
          <ul className={styles.ladderRow}>
            {TRADE_LADDER.map((row, index) => (
              <li
                key={`${row.a[0]}-${row.b[0]}`}
                /* Останні два рядки — обмін на собак: він орієнтовний, тож
                   позначаємо це прямо в рядку, а не лише приміткою внизу. */
                data-soft={index >= TRADE_LADDER.length - 2 ? 'true' : undefined}
                className={styles.ladderStep}
              >
                <span className={styles.ladderSide}>
                  <Sprite
                    src={ANIMAL_SPRITES[row.a[0]]}
                    emoji={ANIMALS[row.a[0]].emoji}
                    alt={ANIMALS[row.a[0]].label}
                    className={styles.ladderFace}
                  />
                  <b>×{row.a[1]}</b>
                </span>
                <span className={styles.ladderEq} aria-hidden>
                  ⇄
                </span>
                <span className={styles.ladderSide}>
                  <Sprite
                    src={ANIMAL_SPRITES[row.b[0]]}
                    emoji={ANIMALS[row.b[0]].emoji}
                    alt={ANIMALS[row.b[0]].label}
                    className={styles.ladderFace}
                  />
                  <b>×{row.b[1]}</b>
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.ruleNote}>
            Обмін працює в обидва боки. Два останні рядки (собаки) — орієнтовні, з іншим гравцем
            можна домовитись усно на будь-яких умовах.
          </p>
        </section>

        <Button variant="gold" block onClick={onClose}>
          Зрозуміло, граємо!
        </Button>
      </div>
    </Overlay>
  );
}
