import type { GameState } from '../../game/types';
import { cn } from '../../lib/cn';
import styles from './TurnBanner.module.css';

interface TurnBannerProps {
  state: GameState;
}

function hint(state: GameState): string {
  if (state.over) return 'Партію завершено 🏆';
  if (state.rolled) return 'Готово! Передай пристрій — «Завершити хід»';
  if (state.trades > 0) return `Обмінів зроблено: ${state.trades}. Можна ще або кидати кубики`;
  return '① Обміняйся за бажанням ② Кидай кубики';
}

/** Хто ходить зараз і що робити далі. Колір — колір гравця. */
export function TurnBanner({ state }: TurnBannerProps) {
  const player = state.players[state.current];
  if (!player) return null;

  return (
    <div
      key={state.current}
      className={cn(styles.banner, 'slide')}
      style={{ background: `linear-gradient(135deg, ${player.color}, ${player.color}cc)` }}
    >
      <div className={styles.who}>
        🎯 Хід: {player.name}
        <span className={styles.round}>
          {state.current + 1}/{state.players.length} · коло {state.round}
        </span>
      </div>
      <div className={styles.what}>{hint(state)}</div>
    </div>
  );
}
