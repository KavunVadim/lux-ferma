import { useMemo, useState } from 'react';
import type { ShareOutcome } from '../../app/share';
import { shareResultCard } from '../../app/share';
import { ANIMAL_SPRITES } from '../../assets/manifest';
import { ANIMALS, SPECIES } from '../../game/config';
import { progress } from '../../game/engine';
import type { HerdKey, Player } from '../../game/types';
import { cn } from '../../lib/cn';
import { rankPlayers, plural, type SharePayload } from '../lib/shareCard';
import { Button } from '../components/Button';
import { Sprite } from '../components/Sprite';
import { Overlay } from './Overlay';
import styles from './WinModal.module.css';

interface WinModalProps {
  players: Player[];
  winnerIndex: number;
  /** Кількість кіл на момент перемоги. */
  rounds: number;
  onNewGame: () => void;
  onClose: () => void;
}

const NOTE: Record<ShareOutcome, string | null> = {
  shared: 'Готово — картка пішла у чат 🎉',
  copied: 'Картку збережено, підпис уже в буфері обміну',
  downloaded: 'Картку збережено у «Завантаження»',
  canceled: null,
  failed: 'Не вдалося зібрати картку — спробуй ще раз',
};

const ALL_KEYS: readonly HerdKey[] = [...SPECIES, 'sdog', 'bdog'];

const totalAnimals = (player: Player): number =>
  ALL_KEYS.reduce((sum, key) => sum + (player.farm[key] ?? 0), 0);

/** Нагорода: тільки якщо є одноосібний лідер — інакше це не нагорода, а шум. */
function leader(
  players: Player[],
  score: (player: Player) => number,
): { name: string; value: number } | null {
  const sorted = [...players].sort((a, b) => score(b) - score(a));
  const best = sorted[0];
  if (!best) return null;
  const value = score(best);
  if (value <= 0) return null;
  if (sorted[1] && score(sorted[1]!) === value) return null;
  return { name: best.name, value };
}

/**
 * ФІНАЛ ПАРТІЇ — і найсильніший рекламний момент у грі.
 *
 * Раніше це було маленьке вікно з кубком і одним рядком тексту. Тепер це
 * справжнє нагородження: пʼєдестал усіх гравців із їхніми дворами, «нагороди
 * вечора» й кнопка «Поділитися результатом», яка малює картку 1080×1350 і
 * віддає її в системне меню. Саме цією карткою гравці самі запрошують друзів.
 */
export function WinModal({ players, winnerIndex, rounds, onNewGame, onClose }: WinModalProps) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const winner = players[winnerIndex] ?? players[0]!;
  const payload: SharePayload = useMemo(
    () => ({
      players: players.map((player) => ({
        name: player.name,
        avatar: player.avatar,
        color: player.color,
        farm: player.farm,
      })),
      winnerIndex,
      rounds,
    }),
    [players, winnerIndex, rounds],
  );
  const ranked = useMemo(() => rankPlayers(payload), [payload]);

  const awards = useMemo(() => {
    const list: { id: string; emoji: string; label: string; name: string; value: string }[] = [];

    const horses = leader(players, (player) => player.farm.horse ?? 0);
    if (horses) {
      list.push({
        id: 'horse',
        emoji: '🐎',
        label: 'Найбільше коней',
        name: horses.name,
        value: `${horses.value}`,
      });
    }

    const yard = leader(players, totalAnimals);
    if (yard) {
      list.push({ id: 'yard', emoji: '🚜', label: 'Найбільший двір', name: yard.name, value: `${yard.value}` });
    }

    const guards = leader(players, (player) => (player.farm.sdog ?? 0) + (player.farm.bdog ?? 0));
    if (guards) {
      list.push({ id: 'guards', emoji: '🐕', label: 'Охорона двору', name: guards.name, value: `${guards.value}` });
    }

    return list.slice(0, 3);
  }, [players]);

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const outcome = await shareResultCard(payload);
    setNote(NOTE[outcome]);
    setBusy(false);
  };

  return (
    <Overlay label="Перемога" onClose={onClose}>
      <div className={styles.card}>
        <div className={styles.rays} aria-hidden />
        <div className={styles.crown}>
          <span className={styles.trophy} aria-hidden>
            🏆
          </span>
        </div>

        <p className={styles.eyebrow}>
          повна ферма за {rounds} {plural(rounds, ['коло', 'кола', 'кіл'])}
        </p>
        <h2 className={styles.title}>{winner.name}</h2>
        <p className={styles.sub}>Качка, коза, свиня, кінь і корова — все на місці!</p>

        <ol className={styles.board}>
          {ranked.map((player) => (
            <li
              key={`${player.index}-${player.name}`}
              className={cn(styles.row, player.rank === 1 && styles.rowWin)}
            >
              <span className={styles.rank} data-rank={player.rank}>
                {player.rank}
              </span>
              <span className={styles.avatar} style={{ ['--player-color' as string]: player.color }} aria-hidden>
                {player.avatar}
              </span>
              <span className={styles.person}>
                <b className={styles.name}>{player.name}</b>
                <span className={styles.slots} aria-hidden>
                  {SPECIES.map((species) => {
                    const owned = (player.farm[species] ?? 0) > 0;
                    return (
                      <Sprite
                        key={species}
                        src={ANIMAL_SPRITES[species]}
                        emoji={ANIMALS[species].emoji}
                        className={cn(styles.slot, owned ? styles.slotOn : styles.slotOff)}
                      />
                    );
                  })}
                </span>
              </span>
              <span className={styles.score}>
                {progress(player.farm)}
                <i>/5</i>
              </span>
            </li>
          ))}
        </ol>

        {awards.length > 0 && (
          <ul className={styles.awards}>
            {awards.map((award) => (
              <li key={award.id} className={styles.award} title={`${award.label}: ${award.name} — ${award.value}`}>
                <span className={styles.awardEmoji} aria-hidden>
                  {award.emoji}
                </span>
                <b className={styles.awardName}>{award.name}</b>
                <span className={styles.awardValue}>{award.value}</span>
                <span className={styles.srOnly}>{award.label}</span>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.actions}>
          <Button variant="gold" block disabled={busy} onClick={() => void handleShare()}>
            {busy ? '🖼 Готуємо картку…' : '📸 Поділитися результатом'}
          </Button>
          <div className={styles.secondary}>
            <Button variant="green" onClick={onNewGame}>
              🌾 Ще партія
            </Button>
            <Button variant="ghost" onClick={onClose}>
              🏠 На старт
            </Button>
          </div>
        </div>

        <p className={styles.hint} aria-live="polite">
          {note ?? 'Картка з результатом — гарний привід покликати друзів у гру'}
        </p>
      </div>
    </Overlay>
  );
}
