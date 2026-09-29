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
  onTrade: () => void;
  onRoll: () => void;
  onEndTurn: () => void;
  className?: string;
}

/** Нижня панель дій: обмін і головна кнопка ходу. */
export function ActionBar({ state, busy, canTrade, tradesDone, onTrade, onRoll, onEndTurn, className }: ActionBarProps) {
  const finished = state.over;
  const tradeDisabled = busy || finished || !canTrade;

  return (
    <div className={cn(styles.bar, className)}>
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
