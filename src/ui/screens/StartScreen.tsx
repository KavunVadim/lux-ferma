import { useState } from 'react';
import { ANIMAL_SPRITES } from '../../assets/manifest';
import { useAssets } from '../../assets/useAssets';
import {
  GAME_TAGLINE,
  GAME_TITLE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_AVATARS,
  PLAYER_COLORS,
  SPECIES,
} from '../../game/config';
import { cn } from '../../lib/cn';
import { Button } from '../components/Button';
import { Sprite } from '../components/Sprite';
import styles from './StartScreen.module.css';

interface StartScreenProps {
  hasSave: boolean;
  onStart: (names: string[]) => void;
  onResume: () => void;
  onOpenRules: () => void;
  onOpenSettings: () => void;
}

const COUNTS = [2, 3, 4];

/**
 * Стартовий екран у стилі гри: дерев'яна вивіска з назвою, картки гравців
 * з аватарами й кольорами, велика зелена кнопка старту та дерев'яний лоток
 * для другорядних дій. Поки спрайти вантажаться — смужка прогресу на вивісці.
 */
export function StartScreen({ hasSave, onStart, onResume, onOpenRules, onOpenSettings }: StartScreenProps) {
  const [count, setCount] = useState(MIN_PLAYERS);
  const [names, setNames] = useState<string[]>(() => Array.from({ length: MAX_PLAYERS }, () => ''));
  const { progress, ready } = useAssets();

  const updateName = (index: number, value: string) => {
    setNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  return (
    <section className={styles.screen}>
      <header className={styles.sign}>
        <span className={styles.signRope} aria-hidden />
        <span className={styles.signWheat} aria-hidden>
          🌾
        </span>
        <h1 className={styles.title}>{GAME_TITLE}</h1>
        <p className={styles.tagline}>{GAME_TAGLINE}</p>
        <div className={styles.herdRow} aria-hidden>
          {SPECIES.map((species, index) => (
            <Sprite
              key={species}
              src={ANIMAL_SPRITES[species]}
              emoji="🐾"
              className={styles.herdSprite}
              style={{ animationDelay: `${index * 0.18}s` }}
            />
          ))}
        </div>
      </header>

      {!ready && (
        <div className={styles.loading} role="status">
          <span className={styles.loadingBar} style={{ width: `${Math.max(6, progress * 100)}%` }} />
          <span className={styles.loadingText}>Готуємо ферму… {Math.round(progress * 100)}%</span>
        </div>
      )}

      {hasSave && (
        <button type="button" className={styles.resume} onClick={onResume}>
          <span className={styles.resumeIcon} aria-hidden>
            ▶
          </span>
          <span className={styles.resumeText}>
            <b>Продовжити партію</b>
            <i>збережена гра чекає на тебе</i>
          </span>
        </button>
      )}

      <div className={cn('card', styles.card)}>
        <h3 className={styles.cardTitle}>Скільки гравців?</h3>

        <div className={styles.picker} role="radiogroup" aria-label="Кількість гравців">
          {COUNTS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={count === value}
              aria-label={`${value} гравці`}
              className={cn(styles.pick, count === value && styles.pickActive)}
              onClick={() => setCount(value)}
            >
              <span className={styles.pickFaces} aria-hidden>
                {Array.from({ length: value }, (_, index) => (
                  <span key={index} className={styles.pickFace}>
                    {PLAYER_AVATARS[index]}
                  </span>
                ))}
              </span>
              <b className={styles.pickCount}>{value}</b>
            </button>
          ))}
        </div>

        <div className={styles.names}>
          {Array.from({ length: count }, (_, index) => (
            <label
              key={index}
              className={styles.nameRow}
              style={{
                animationDelay: `${index * 0.06}s`,
                ['--player-color' as string]: PLAYER_COLORS[index % PLAYER_COLORS.length],
              }}
            >
              <span className={styles.nameAvatar} aria-hidden>
                {PLAYER_AVATARS[index]}
              </span>
              <input
                className={styles.input}
                type="text"
                maxLength={14}
                value={names[index] ?? ''}
                placeholder={`Гравець ${index + 1}`}
                onChange={(event) => updateName(index, event.target.value)}
              />
            </label>
          ))}
        </div>

        <Button variant="green" block pulse onClick={() => onStart(names.slice(0, count))}>
          🎲 Почати гру
        </Button>
      </div>

      <footer className={styles.tray}>
        <Button variant="wood" small onClick={onOpenRules}>
          📖 Як грати
        </Button>
        <Button variant="wood" small onClick={onOpenSettings}>
          ⚙️ Налаштування
        </Button>
      </footer>
    </section>
  );
}
