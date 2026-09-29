import { useMemo } from 'react';
import { ANIMAL_SPRITES } from '../../assets/manifest';
import { ANIMALS, SPECIES_TIER, isDogTrade } from '../../game/config';
import type { Farm, Herd, TradeOption } from '../../game/types';
import { cn } from '../../lib/cn';
import { Button } from '../components/Button';
import { Sprite } from '../components/Sprite';
import { Overlay } from './Overlay';
import styles from './Overlays.module.css';

interface TradeSheetProps {
  playerName: string;
  farm: Farm;
  herd: Herd;
  options: TradeOption[];
  /** Скільки обмінів уже зроблено цього ходу. */
  tradesDone: number;
  /** Скільки лишилось; null — без обмежень. */
  tradesLeft: number | null;
  onChoose: (option: TradeOption) => void;
  onClose: () => void;
}

interface TradeGroup {
  key: string;
  title: string;
  hint: string;
  options: TradeOption[];
}

/** Розкладає доступні обміни на зрозумілі групи: вгору, вниз, собаки. */
function groupOptions(options: TradeOption[]): TradeGroup[] {
  const up: TradeOption[] = [];
  const down: TradeOption[] = [];
  const dogs: TradeOption[] = [];

  for (const option of options) {
    if (isDogTrade(option)) dogs.push(option);
    else if (SPECIES_TIER[option.to] > SPECIES_TIER[option.from]) up.push(option);
    else down.push(option);
  }

  return [
    { key: 'up', title: '⬆️ Вгору', hint: 'кілька молодших → одна старша', options: up },
    { key: 'down', title: '⬇️ Вниз', hint: 'одна старша → кілька молодших', options: down },
    { key: 'dogs', title: '🐕 Собаки', hint: 'охоронці двору від хижаків', options: dogs },
  ].filter((group) => group.options.length > 0);
}

/**
 * Панель обміну: «Вгору» ліворуч, «Вниз» праворуч — щоб напрямок було видно
 * одним поглядом, а не шукати в списку. Собаки — окремим блоком знизу.
 * Панель не закривається після обміну — можна зробити кілька за хід
 * (ліміт у налаштуваннях → «Обміни за хід»).
 */
export function TradeSheet({
  playerName,
  farm,
  herd,
  options,
  tradesDone,
  tradesLeft,
  onChoose,
  onClose,
}: TradeSheetProps) {
  const groups = useMemo(() => groupOptions(options), [options]);
  const unlimited = tradesLeft === null;

  const up = groups.find((group) => group.key === 'up');
  const down = groups.find((group) => group.key === 'down');
  const dogs = groups.find((group) => group.key === 'dogs');

  /** Одна група обмінів: заголовок + картки напрямку. */
  const groupSection = (group: TradeGroup, accent?: string) => (
    <section className={styles.tradeGroup}>
      <header className={cn(styles.groupHead, accent)}>
        <b>{group.title}</b>
        <span className={styles.groupHint}>{group.hint}</span>
      </header>

      <div className={styles.tradeList}>
        {group.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={styles.tradeOption}
            onClick={() => onChoose(option)}
          >
            <span className={styles.optionRow}>
              <span className={styles.side}>
                <Sprite
                  src={ANIMAL_SPRITES[option.from]}
                  emoji={ANIMALS[option.from].emoji}
                  className={styles.tradeToken}
                />
                <b>−{option.fromQty}</b>
              </span>
              <span className={styles.tradeArrow}>➜</span>
              <span className={styles.side}>
                <Sprite
                  src={ANIMAL_SPRITES[option.to]}
                  emoji={ANIMALS[option.to].emoji}
                  className={styles.tradeToken}
                />
                <b>+{option.toQty}</b>
              </span>
            </span>
            <span className={styles.optionCounts}>
              у дворі {farm[option.from]} → <b>{farm[option.from] - option.fromQty}</b>
              <span className={styles.dotSep}>·</span>
              у стаді {herd[option.to]} → <b>{herd[option.to] - option.toQty}</b>
            </span>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <Overlay variant="sheet" onClose={onClose} label="Обмін тварин">
      <div className="sheet">
        <div className="sheet__head">
          <h2>🔁 Обмін тварин</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>

        <div className={styles.tradeStatus}>
          <span className={styles.tradePlayer}>{playerName}</span>
          <span className={styles.tradeCounter}>
            {unlimited ? (
              <>
                обмінів цього ходу: <b>{tradesDone}</b>
              </>
            ) : (
              <>
                лишилось: <b>{tradesLeft}</b> з {tradesDone + tradesLeft}
              </>
            )}
          </span>
        </div>

        {groups.length === 0 ? (
          <div className={styles.emptyState}>
            😕 Немає обміну, на який вистачає тварин. Кинь кубики — і спробуй знову!
          </div>
        ) : (
          <>
            {/* Два напрямки поруч: вгору — ліва колонка, вниз — права. */}
            <div className={styles.tradeColumns}>
              <div className={styles.tradeColumn}>{up && groupSection(up, styles.groupHeadUp)}</div>
              <div className={styles.tradeColumn}>{down && groupSection(down, styles.groupHeadDown)}</div>
            </div>

            {dogs && <div className={styles.tradeDogs}>{groupSection(dogs)}</div>}
          </>
        )}

        <div className={styles.tradeFooter}>
          <Button variant="gold" block onClick={onClose}>
            Готово
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
