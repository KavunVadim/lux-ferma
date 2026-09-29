import { progress } from '../../game/engine';
import type { Player } from '../../game/types';
import { cn } from '../../lib/cn';
import styles from './PlayerRail.module.css';

interface PlayerRailProps {
  players: Player[];
  current: number;
  className?: string;
  /** row — компактні чипси для нижньої смуги ПК; rail — вертикальні картки. */
  variant?: 'rail' | 'row';
}

/**
 * Хто за столом і скільки видів тварин уже вдома.
 * Поточний гравець — з короною й акцентною рамкою, як у концепті.
 */
export function PlayerRail({ players, current, className, variant = 'rail' }: PlayerRailProps) {
  return (
    <div className={cn(styles.rail, variant === 'row' && styles.row, className)}>
      {players.map((player, index) => {
        const done = progress(player.farm);
        return (
          <article
            key={player.id}
            className={cn(styles.card, index === current && styles.active)}
            style={{ ['--player-color' as string]: player.color }}
          >
            <span className={styles.avatar} aria-hidden>
              {player.avatar}
            </span>
            <div className={styles.info}>
              <b className={styles.name}>
                {index === current && <span className={styles.crown}>👑</span>}
                {player.name}
              </b>
              <div className={styles.track}>
                {Array.from({ length: 5 }, (_, slot) => (
                  <span key={slot} className={cn(styles.pip, slot < done && styles.pipOn)} />
                ))}
              </div>
            </div>
            <b className={styles.score}>{done}/5</b>
          </article>
        );
      })}
    </div>
  );
}
