import { useLayoutEffect, useState } from 'react';
import { TOUR_TEXT, type TourStep } from './tour';
import styles from './CoachMark.module.css';

interface CoachMarkProps {
  step: TourStep;
  /** «✕» — більше не показувати. */
  onSkip: () => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Підсвітка головної кнопки + бульбашка з поясненням.
 *
 * Позицію міряємо в DOM: лоток дій на телефоні стоїть у потоці (а не фіксовано),
 * на ПК — у «доку» над картою, тож вгадувати координати не можна. Міряємо на
 * монтуванні, після шрифтів (через 350 мс) і на зміну розміру вікна.
 */
export function CoachMark({ step, onSkip }: CoachMarkProps) {
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const target = document.querySelector<HTMLElement>(`[data-coach="${step}"]`);
      if (!target) {
        setBox(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      if (rect.width < 2) {
        setBox(null);
        return;
      }
      setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };

    measure();
    const timer = window.setTimeout(measure, 350);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', measure);
    };
  }, [step]);

  if (!box) return null;

  const copy = TOUR_TEXT[step];
  const bubbleWidth = Math.min(310, window.innerWidth - 24);
  const center = box.left + box.width / 2;
  const left = Math.min(Math.max(center, bubbleWidth / 2 + 12), window.innerWidth - bubbleWidth / 2 - 12);
  const arrowLeft = Math.min(Math.max(center - left + bubbleWidth / 2, 24), bubbleWidth - 24);

  return (
    <div className={styles.layer} aria-live="polite">
      <span
        className={styles.ring}
        style={{ top: box.top - 7, left: box.left - 7, width: box.width + 14, height: box.height + 14 }}
        aria-hidden
      />

      <div
        className={styles.bubble}
        style={{
          left,
          width: bubbleWidth,
          // Бульбашка завжди НАД кнопкою: лоток дій стоїть знизу.
          bottom: window.innerHeight - box.top + 14,
          ['--arrow-left' as string]: `${arrowLeft}px`,
        }}
        role="note"
      >
        <span className={styles.step}>{copy.step}</span>
        <b className={styles.title}>{copy.title}</b>
        <p className={styles.text}>{copy.text}</p>
        <button type="button" className={styles.close} onClick={onSkip} aria-label="Вимкнути підказки">
          ✕
        </button>
        <span className={styles.arrow} aria-hidden />
      </div>
    </div>
  );
}
