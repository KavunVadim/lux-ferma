import { ANIMALS } from '../../game/config';
import type { GameState, HerdKey } from '../../game/types';
import { cn } from '../../lib/cn';
import styles from './EventFeed.module.css';

interface EventFeedProps {
  state: GameState;
  inspected: HerdKey | null;
  className?: string;
}

/** Стрічка подій + довідка по вибраному дворі (десктопна колонка). */
export function EventFeed({ state, inspected, className }: EventFeedProps) {
  const farm = state.players[state.current]?.farm;

  return (
    <section className={cn('card', styles.feed, className)} aria-label="Стрічка подій">
      <p className={styles.message}>{state.message}</p>

      <ol className={styles.log}>
        {state.log.slice(0, 8).map((entry) => (
          <li key={entry.id} className={styles.item}>
            <span
              className={styles.dot}
              style={{
                background:
                  entry.playerIndex < 0
                    ? 'var(--ink-soft)'
                    : (state.players[entry.playerIndex]?.color ?? 'var(--ink-soft)'),
              }}
            />
            <span>
              {entry.emoji} {entry.text}
            </span>
          </li>
        ))}
      </ol>

      <p className={styles.inspect}>
        {inspected && farm ? (
          <>
            {ANIMALS[inspected].emoji} <b>{ANIMALS[inspected].house}</b>: на фермі {farm[inspected]} · у стаді 🧺
            {state.herd[inspected]} · повних пар зараз: {Math.floor(farm[inspected] / 2)}
          </>
        ) : (
          'Натисни на двір на карті, щоб оглянути стадо 🐾'
        )}
      </p>
    </section>
  );
}
