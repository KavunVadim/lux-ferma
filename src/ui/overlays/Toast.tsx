import { cn } from '../../lib/cn';
import styles from './Overlays.module.css';

interface ToastProps {
  message: string | null;
}

/** Коротке підтвердження дії у верхній частині екрана. */
export function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div key={message} className={cn(styles.toast, styles.toastShow)} role="status" aria-live="polite">
      {message}
    </div>
  );
}

const PIECES = ['🎉', '🌟', '🐄', '🦆', '🐐', '🏆', '🐖', '🐎'];
/** 36 частинок із наперед визначеними траєкторіями — без random у рендері. */
const CONFETTI = Array.from({ length: 36 }, (_, index) => ({
  key: index,
  emoji: PIECES[index % PIECES.length] ?? '🎉',
  left: `${(index * 37) % 100}%`,
  duration: `${2.4 + ((index * 13) % 19) / 10}s`,
  delay: `${((index * 7) % 9) / 10}s`,
}));

/** Конфеті на екрані перемоги (суто CSS-анімація). */
export function Confetti() {
  return (
    <div className={styles.confettiWrap} aria-hidden="true">
      {CONFETTI.map((piece) => (
        <span
          key={piece.key}
          className={styles.confetti}
          style={{ left: piece.left, animationDuration: piece.duration, animationDelay: piece.delay }}
        >
          {piece.emoji}
        </span>
      ))}
    </div>
  );
}
