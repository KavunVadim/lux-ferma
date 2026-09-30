import type { GameState } from '../../game/types';
import { cn } from '../../lib/cn';
import { Button } from './Button';
import styles from './ActionBar.module.css';

interface ActionBarProps {
  state: GameState;
  /** Триває анімація кидка — кнопки заблоковані. */
  busy: boolean;
  /** Чи можна зробити ще один обмін (ліміт із config.ts). */
  canTrade: boolean;
  /** Скільки обмінів уже зроблено цього ходу. */
  tradesDone: number;
  /** Чи є що скасовувати (кидок, обмін або завершення ходу). */
  canUndo: boolean;
  onTrade: () => void;
  onRoll: () => void;
  onEndTurn: () => void;
  onUndo: () => void;
  className?: string;
}

/** Нижня панель дій: скасування, обмін і головна кнопка ходу. */
export function ActionBar({
  state,
  busy,
  canTrade,
  tradesDone,
  canUndo,
  onTrade,
  onRoll,
  onEndTurn,
  onUndo,
  className,
}: ActionBarProps) {
  const finished = state.over;
  const tradeDisabled = busy || finished || !canTrade;
  // Скасування під час кидка недоступне: спершу «Ок, далі», потім відкат —
  // інакше анімація на полі розійдеться зі станом.
  const undoDisabled = busy || finished || !canUndo;

  return (
    <div className={cn(styles.bar, className)}>
      <Button
        variant="ghost"
        onClick={onUndo}
        disabled={undoDisabled}
        className={styles.undo}
        aria-label="Скасувати останню дію"
        title="Скасувати останню дію (кидок, обмін, завершення ходу)"
      >
        ↩️
      </Button>

      <Button variant="wood" onClick={onTrade} disabled={tradeDisabled} className={styles.trade}>
        🔁 Обмін{tradesDone > 0 ? ` · ${tradesDone}` : ''}
      </Button>

      {state.rolled ? (
        <Button variant="green" pulse disabled={busy || finished} onClick={onEndTurn} className={styles.main}>
          ✅ Завершити хід
        </Button>
      ) : (
        <Button variant="barn" pulse disabled={busy || finished} onClick={onRoll} className={styles.main}>
          🎲 Кинути кубики
        </Button>
      )}
    </div>
  );
}
