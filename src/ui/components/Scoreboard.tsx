import { progress } from '../../game/engine';
import type { Player } from '../../game/types';
import { cn } from '../../lib/cn';
import styles from './Scoreboard.module.css';

interface ScoreboardProps {
  players: Player[];
  current: number;
}

/** Смужка прогресу всіх гравців: скільки з п'яти видів уже вдома. */
export function Scoreboard({ players, current }: ScoreboardProps) {
  return (
    <div className={styles.board}>
      {players.map((player, index) => (
        <div
          key={player.id}
          className={cn(styles.pill, index === current && styles.active)}
          style={{ ['--player-color' as string]: player.color }}
        >
          <span className="dot" style={{ background: player.color }} />
          <span className={styles.name}>{player.name}</span>
          <b className={styles.score}>{progress(player.farm)}/5</b>
        </div>
      ))}
    </div>
  );
}
