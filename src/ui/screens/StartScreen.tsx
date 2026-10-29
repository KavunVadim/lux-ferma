import { useEffect, useState } from 'react';
import { shareGame } from '../../app/share';
import { ANIMAL_SPRITES, MAP_URL } from '../../assets/manifest';
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
import { InstallBanner } from '../components/InstallBanner';
import { Sprite } from '../components/Sprite';
import { useMediaQuery } from '../lib/useMediaQuery';
import styles from './StartScreen.module.css';

interface StartScreenProps {
  hasSave: boolean;
  onStart: (names: string[]) => void;
  onResume: () => void;
  onOpenRules: () => void;
  onOpenSettings: () => void;
}

const COUNTS = [2, 3, 4];

const FACTS = [
  { emoji: '👥', label: '2–4 гравці' },
  { emoji: '📱', label: '1 телефон' },
  { emoji: '📴', label: 'офлайн' },
];

/**
 * СТАРТОВИЙ ЕКРАН — «вітрина» гри.
 *
 * Це єдиний екран, який бачить людина, що відкрила посилання вперше, тому він
 * має продавати гру, а не лише збирати імена. Три речі, які тут важливі:
 *   1. одразу видно, ЩО це (вивіска + арт ферми на великому екрані);
 *   2. одразу видно, що це просто (три факти: 2–4 гравці, один телефон, офлайн);
 *   3. одну дію зроблено очевидною — велика зелена «Почати гру».
 *
 * «Покликати друзів» — маленька ланка росту: посилання з готовим підписом
 * іде в чат компанії, з якою і грають у настільну «Люкс Ферму».
 */
export function StartScreen({ hasSave, onStart, onResume, onOpenRules, onOpenSettings }: StartScreenProps) {
  const [count, setCount] = useState(MIN_PLAYERS);
  const [names, setNames] = useState<string[]>(() => Array.from({ length: MAX_PLAYERS }, () => ''));
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const { progress, ready } = useAssets();
  const wide = useMediaQuery('(min-width: 1000px)');

  const updateName = (index: number, value: string) => {
    setNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  useEffect(() => {
    if (!shareNote) return;
    const timer = window.setTimeout(() => setShareNote(null), 3200);
    return () => window.clearTimeout(timer);
  }, [shareNote]);

  const invite = async () => {
    const outcome = await shareGame();
    if (outcome === 'copied') setShareNote('Посилання скопійовано — вставляй у чат');
    else if (outcome === 'failed') setShareNote('Не вдалося поділитися цим браузером');
  };

  return (
    <section className={cn(styles.screen, bannerVisible && styles.withBanner)}>
      {!ready && (
        <div className={styles.boot} role="status" aria-live="polite">
          <div className={styles.bootCard}>
            <span className={styles.bootIcon} aria-hidden>
              🚜
            </span>
            <b className={styles.bootTitle}>Готуємо ферму</b>
            <p className={styles.bootText}>
              Завантажуємо спрайти тварин і карту. Це займає кілька секунд на першому запуску —
              далі гра відкривається миттєво, навіть офлайн.
            </p>
            <div className={styles.bootBar}>
              <span className={styles.bootFill} style={{ width: `${Math.max(4, progress * 100)}%` }} />
            </div>
            <span className={styles.bootPercent}>{Math.round(progress * 100)}%</span>
          </div>
        </div>
      )}

      <div className={styles.hero}>
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

        <ul className={styles.facts} aria-label="Що це за гра">
          {FACTS.map((fact) => (
            <li key={fact.label} className={styles.fact}>
              <span aria-hidden>{fact.emoji}</span>
              {fact.label}
            </li>
          ))}
        </ul>

        {wide && (
          <figure className={styles.heroArt}>
            <img src={MAP_URL} alt="" draggable={false} />
            <figcaption>Ґанок, двір, хижаки й охорона — усе на одному екрані</figcaption>
          </figure>
        )}
      </div>

      <div className={styles.setup}>
        {!ready && (
          <div className={styles.loading} role="status">
            <span className={styles.loadingBar} style={{ width: `${Math.max(6, progress * 100)}%` }} />
            <span className={styles.loadingText}>Готуємо ферму… {Math.round(progress * 100)}%</span>
          </div>
        )}

        {hasSave && (
          <button type="button" className={styles.resume} onClick={onResume} disabled={!ready}>
            <span className={styles.resumeIcon} aria-hidden>
              ▶
            </span>
            <span className={styles.resumeText}>
              <b>Продовжити партію</b>
              <i>{ready ? 'збережена гра чекає на тебе' : 'чекаємо на завантаження…'}</i>
            </span>
          </button>
        )}

        <div className={cn('card', styles.card)}>
          <div className={styles.cardTop}>
            <h2 className={styles.cardTitle}>Скільки гравців?</h2>

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

          <Button variant="green" block pulse disabled={!ready} onClick={() => onStart(names.slice(0, count))}>
            {ready ? '🎲 Почати гру' : '⏳ Готуємо ферму…'}
          </Button>
        </div>

        <footer className={styles.tray}>
          {/*
           * Без варіанта `small`: він задає min-height 40px — нижче норми
           * WCAG 2.5.8 (44px), і саме на стартовому екрані був провал, тоді як
           * у решті гри тап-цілі 44+. Висоту задає CSS-модуль лотка.
           */}
          <Button variant="wood" onClick={onOpenRules}>
            📖 Як грати
          </Button>
          <Button variant="wood" onClick={onOpenSettings}>
            ⚙️ Налаштування
          </Button>
        </footer>

        <div className={styles.inviteRow}>
          <button type="button" className={styles.invite} onClick={() => void invite()}>
            📤 Покликати друзів у гру
          </button>
          <span className={styles.inviteNote} aria-live="polite">
            {shareNote ?? 'Посилання з підписом — у чат компанії'}
          </span>
        </div>
      </div>

      <InstallBanner onVisible={setBannerVisible} />
    </section>
  );
}
