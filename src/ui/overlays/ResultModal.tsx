import { useEffect, useRef, useState } from 'react';
import { ANIMAL_SPRITES } from '../../assets/manifest';
import type { ResultView } from '../../app/useGame';
import { ANIMALS } from '../../game/config';
import type { GameEvent, DiceFace } from '../../game/types';
import { cn } from '../../lib/cn';
import { Button } from '../components/Button';
import { Dice } from '../components/Dice';
import { Sprite } from '../components/Sprite';
import { Overlay } from './Overlay';
import styles from './Overlays.module.css';

interface ResultModalProps {
  /** Результат ходу; під час кидка його ще немає. */
  result?: ResultView | null;
  /** Триває анімація кубиків — показуємо вікно з летючими кубиками. */
  rolling?: boolean;
  /** Грані поточного кидка (для анімації). */
  dice?: [DiceFace, DiceFace] | null;
  onClose: () => void;
}

/** Анімація числа: 0 → target, щоб «+3» було видно, а не лише прочитано. */
function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    if (target === 0) return;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      setValue(Math.round(target * progress));
      if (progress < 1) frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return value;
}

const KIND_CLASS: Record<GameEvent['kind'], string> = {
  gain: styles['card--gain'] ?? '',
  loss: styles['card--loss'] ?? '',
  save: styles['card--save'] ?? '',
  raid: styles['card--raid'] ?? '',
  note: styles['card--note'] ?? '',
};

interface EventCardProps {
  event: GameEvent;
  index: number;
}

/**
 * Рядок «звідки взялось число»: `У дворі 2 + 1 з кубика = 3 → 1 пара`.
 *
 * Раніше це ховалось за кнопкою «розрахунок ↓», і гравець бачив лише +1 без
 * пояснення. У концепті розрахунок стоїть просто в картці — так зрозуміло, що
 * саме сталось, без жодного тапу. Показуємо для будь-якої події з `counted`.
 */
function PairMath({ counted, kind }: { counted: NonNullable<GameEvent['counted']>; kind: GameEvent['kind'] }) {
  const { have, fromDice, pairs } = counted;
  const basis = have + fromDice;
  const toPair = basis % 2 === 0 ? 2 : 1;
  const done = kind === 'gain' && pairs > 0;

  return (
    <span className={styles.math}>
      <span className={styles.mathLine}>
        <span className={styles.mathPart}>
          у дворі <b>{have}</b>
        </span>
        <span className={styles.mathOp}>+</span>
        <span className={styles.mathPart}>
          з кубика <b>{fromDice}</b>
        </span>
        <span className={styles.mathOp}>=</span>
        <span className={styles.mathTotal}>{basis}</span>
      </span>

      {done ? (
        <span className={cn(styles.progress, styles.progressDone)}>
          <span className={styles.progressBar} style={{ width: '100%' }} />
          <span className={styles.progressLabel}>
            пара склалась · {pairs > 1 ? `+${pairs} тварини` : '+1 тварина'}
          </span>
        </span>
      ) : (
        <span className={styles.progress}>
          <span className={styles.progressBar} style={{ width: `${Math.min(100, (basis / 2) * 100)}%` }} />
          <span className={styles.progressLabel}>
            до пари {basis}/2 — ще {toPair}
          </span>
        </span>
      )}
    </span>
  );
}

/** Картка однієї події: спрайт виду, зміна числом і розрахунок у рядку. */
function EventCard({ event, index }: EventCardProps) {
  const delta = event.delta ?? 0;
  const shown = useCountUp(Math.abs(delta));
  const subject = event.subject ? ANIMALS[event.subject] : null;
  const counted = event.counted;
  // Розрахунок показуємо одразу (як у концепті) — деталі лишаються за кліком.
  const hasMath = !!counted;

  return (
    <li className={cn(styles.card, KIND_CLASS[event.kind])} style={{ animationDelay: `${0.1 + index * 0.09}s` }}>
      <div className={styles.cardHead}>
        <span className={styles.cardIcon}>
          <Sprite
            src={event.subject ? ANIMAL_SPRITES[event.subject] : ''}
            emoji={event.emoji}
            alt={subject?.label ?? ''}
            className={styles.cardSprite}
          />
        </span>

        <span className={styles.cardText}>
          <b>{event.text}</b>
        </span>

        <span className={styles.cardDelta}>
          {delta !== 0 ? (
            <b className={delta > 0 ? styles.deltaPlus : styles.deltaMinus}>
              {delta > 0 ? '+' : '−'}
              {shown}
            </b>
          ) : (
            <b className={styles.deltaZero}>0</b>
          )}
        </span>
      </div>

      {hasMath && counted && <PairMath counted={counted} kind={event.kind} />}

      {(event.kind !== 'note' && event.farmAfter !== undefined) || event.herdAfter !== undefined || event.detail ? (
        <div className={styles.cardMeta}>
          {event.kind !== 'note' && event.farmAfter !== undefined && (
            <span className={styles.metaChip}>
              у дворі <b>{event.farmAfter}</b>
            </span>
          )}
          {event.herdAfter !== undefined && (
            <span className={styles.metaChip}>
              🧺 стадо <b>{event.herdAfter}</b>
            </span>
          )}
          {event.detail && <span className={styles.cardDetailInline}>{event.detail}</span>}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Вікно кидка: спершу по центру летять кубики, потім у тому ж вікні
 * з'являється карта — що випало і що з цього вийшло (розмноження, набіг,
 * обміни в стаді). Анімації на полі (прибуття тварин, вихід хижака) гра
 * запускає лише після «Ок, далі», тому поле не «відпрацьовує» наперед.
 * Головне — одразу видно, скільки тварин додалось або зникло.
 */
export function ResultModal({ result, rolling = false, dice, onClose }: ResultModalProps) {
  const events = result?.events ?? [];
  const changed = events.filter((event) => (event.delta ?? 0) !== 0);
  const gained = events.reduce((sum, event) => sum + Math.max(0, event.delta ?? 0), 0);
  // «Забрано» — це лише справжні втрати. Пес, який повернувся у спільне стадо
  // після захисту, теж має дельту −1, але це не втрата — інакше підсумок бреше.
  const lost = events
    .filter((event) => event.kind === 'loss')
    .reduce((sum, event) => sum + Math.abs(event.delta ?? 0), 0);
  const saved = events.filter((event) => event.kind === 'save').length;

  /**
   * Головна подія ходу — те, що гравець має зрозуміти за секунду.
   * Пріоритет: напад (найдраматичніше) → захист псом → прибуття → нічого.
   * Числа тут навмисно найбільші на екрані.
   */
  const headline = (() => {
    if (lost > 0) {
      const victim = events.find((event) => event.kind === 'loss' && event.subject);
      return {
        emoji: victim?.raider === 'bear' ? '🐻' : victim?.raider === 'fox' ? '🦊' : '😱',
        text: `${victim?.raider ? (victim.raider === 'bear' ? 'Ведмідь забрав' : 'Лисиця вкрала') : 'Забрано'} ${lost}`,
      };
    }
    if (saved > 0) {
      const guard = events.find((event) => event.kind === 'save');
      return { emoji: '🛡', text: `${guard?.subject === 'bdog' ? 'Великий пес' : 'Малий пес'} відбив напад` };
    }
    if (gained > 0) return { emoji: '🐣', text: `Прибуло ${gained}` };
    return null;
  })();

  return (
    <Overlay variant="center" label={rolling ? 'Кубики летять' : (result?.title ?? 'Результат ходу')}>
      <div className={styles.modal}>
        <div
          className={cn(
            styles.head,
            result?.tone === 'good' && styles['head--good'],
            result?.tone === 'bad' && styles['head--bad'],
          )}
        >
          <div className={styles.title}>{rolling ? '🎲 Кидаємо…' : (result?.title ?? '')}</div>
        </div>

        <div className={styles.body}>
          <span className={cn(rolling && styles.diceStage)}>
            <Dice
              faces={rolling ? (dice ?? null) : (result?.dice ?? dice ?? null)}
              rolling={rolling}
              labels
            />
          </span>

          {rolling ? (
            <p className={styles.tapHint}>Кидаємо — зараз побачимо, що випало</p>
          ) : (
            <>
              {/*
               * ГОЛОВНА ПОДІЯ — великим шрифтом (24px за спекою).
               * Гравець має зрозуміти результат за одну секунду, тому тут
               * рівно одне речення про найважливіше, а не список дрібниць.
               */}
              {headline && (
                <div
                  className={cn(
                    styles.headline,
                    result?.tone === 'good' && styles.headlineGood,
                    result?.tone === 'bad' && styles.headlineBad,
                  )}
                  role="status"
                  aria-live="polite"
                >
                  <span className={styles.headlineIcon} aria-hidden>
                    {headline.emoji}
                  </span>
                  <b>{headline.text}</b>
                </div>
              )}

              {/* Другорядні підсумки — дрібними чипами під головним. */}
              {(changed.length > 0 || saved > 0) && (
                <div className={styles.summary}>
                  {changed.length > 0 && (
                    <span className={styles.summaryChip}>
                      змін: <b>{changed.length}</b>
                    </span>
                  )}
                  {saved > 0 && (
                    <span className={cn(styles.summaryChip, styles.summarySave)}>
                      🛡 відбито: <b>{saved}</b>
                    </span>
                  )}
                </div>
              )}

              <ul className={styles.cards}>
                {events.map((event, index) => (
                  <EventCard key={`${event.kind}-${event.subject ?? event.text}-${index}`} event={event} index={index} />
                ))}
              </ul>
            </>
          )}
        </div>

        {!rolling && (
          <div className={styles.actions}>
            <Button variant={result?.tone === 'bad' ? 'barn' : 'green'} onClick={onClose} autoFocus>
              Ок, далі
            </Button>
          </div>
        )}
      </div>
    </Overlay>
  );
}
