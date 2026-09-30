import { progress } from '../../game/engine';
import { PLAYER_COLORS_TEXT } from '../../game/config';
import type { Player } from '../../game/types';
import { cn } from '../../lib/cn';
import styles from './Scoreboard.module.css';

interface ScoreboardProps {
  players: Player[];
  current: number;
}

/**
 * Смужка всіх гравців: аватар, ім'я і скільки з п'яти видів уже вдома.
 *
 * Раніше замість аватара стояла просто кольорова крапка — гравець не міг
 * упізнати себе здалеку, хоч аватар (🧑‍🌾) у моделі є і використовується на
 * екрані передачі пристрою.
 */
export function Scoreboard({ players, current }: ScoreboardProps) {
  return (
    <div className={styles.board}>
      {players.map((player, index) => (
        <div
          key={player.id}
          className={cn(styles.pill, index === current && styles.active)}
          style={
            {
              ['--player-color' as string]: player.color,
              /*
               * Цифри рахунку стоять на пілюлі, а не на картці, тож їм потрібен
               * варіант кольору під конкретне тло: освітлений у темній темі,
               * затемнений у світлій. Базові кольори гравців давали 4.06–4.19
               * при нормі WCAG 4.5.
               */
              ['--player-color-dark' as string]: PLAYER_COLORS_TEXT[player.color]?.[0] ?? player.color,
              ['--player-color-light' as string]: PLAYER_COLORS_TEXT[player.color]?.[1] ?? player.color,
            } as React.CSSProperties
          }
        >
          <span
            className={styles.avatar}
            style={{ background: `radial-gradient(circle at 35% 25%, #fff8e6, color-mix(in srgb, ${player.color} 34%, #fff3d6))` }}
            aria-hidden
          >
            {player.avatar}
          </span>
          <span className={styles.name}>{player.name}</span>
          <b className={styles.score}>{progress(player.farm)}/5</b>
        </div>
      ))}
    </div>
  );
}
