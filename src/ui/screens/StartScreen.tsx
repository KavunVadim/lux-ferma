import { useState } from 'react';
import { ANIMAL_SPRITES } from '../../assets/manifest';
import { useAssets } from '../../assets/useAssets';
import { GAME_TAGLINE, GAME_TITLE, MAX_PLAYERS, MIN_PLAYERS, SPECIES } from '../../game/config';
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

/** Стартовий екран: кількість гравців, імена, продовження партії. */
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
      <div className={styles.hero}>
        <div className={styles.heroRow}>
          {SPECIES.map((species, index) => (
            <Sprite
              key={species}
              src={ANIMAL_SPRITES[species]}
              emoji="🐾"
              className={styles.heroSprite}
              style={{ animationDelay: `${index * 0.18}s` }}
            />
          ))}
        </div>
        <h1 className={styles.title}>{GAME_TITLE}</h1>
        <p className={styles.tagline}>{GAME_TAGLINE}</p>
      </div>

      <div className={cn('card', styles.card)}>
        <h3 className={styles.cardTitle}>Скільки гравців?</h3>

        <div className={styles.picker} role="radiogroup" aria-label="Кількість гравців">
          {COUNTS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={count === value}
              className={cn(styles.pick, count === value && styles.pickActive)}
              onClick={() => setCount(value)}
            >
              {value}
            </button>
          ))}
        </div>

        <div className={styles.names}>
          {Array.from({ length: count }, (_, index) => (
            <div key={index} className={styles.nameRow} style={{ animationDelay: `${index * 0.06}s` }}>
              <span className={styles.nameDot} data-index={index} />
              <input
                className={styles.input}
                type="text"
                maxLength={14}
                value={names[index] ?? ''}
                placeholder={`Гравець ${index + 1}`}
                onChange={(event) => updateName(index, event.target.value)}
              />
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          {hasSave && (
            <Button variant="wood" onClick={onResume}>
              ▶ Продовжити партію
            </Button>
          )}
          <Button variant="barn" onClick={() => onStart(names.slice(0, count))}>
            🚜 Почати гру
          </Button>
          <Button variant="ghost" onClick={onOpenRules}>
            📖 Як грати
          </Button>
          <Button variant="ghost" onClick={onOpenSettings}>
            ⚙️ Налаштування гри
          </Button>
        </div>

        {!ready && (
          <p className={styles.loading}>Малюємо ферму… {Math.round(progress * 100)}%</p>
        )}
      </div>
    </section>
  );
}
