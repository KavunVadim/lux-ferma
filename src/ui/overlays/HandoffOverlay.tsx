import { useEffect, useState } from 'react';
import type { HandoffView } from '../../app/useGame';
import { haptic } from '../../game/haptics';
import { cn } from '../../lib/cn';
import { Overlay } from './Overlay';
import styles from './Overlays.module.css';

interface HandoffOverlayProps {
  handoff: HandoffView;
  onClose: () => void;
}

/**
 * Скільки кнопка «Я готовий» лишається неактивною.
 *
 * Телефон передають з рук у руки, і палець того, хто віддає, легко падає на
 * екран саме в момент передачі. Ця пауза гарантує, що хід почне той, кому він
 * призначений. Раніше екран узагалі зникав сам за 2.4 с — і за столом на
 * чотирьох ніхто не встигав зрозуміти, чий же хід.
 */
const UNLOCK_DELAY_MS = 450;

/**
 * Екран передачі пристрою.
 *
 * Замість таймера, що сам закриває екран, — явна дія гравця: він бачить своє
 * ім'я й колір, тисне «Я готовий» і лише тоді починається хід. Порядок дій
 * підказано цифрами, щоб ніхто не губився: спершу прочитай, чий хід → потім
 * передай пристрій → потім тисни.
 */
export function HandoffOverlay({ handoff, onClose }: HandoffOverlayProps) {
  const [unlocked, setUnlocked] = useState(false);

  // Невелика затримка перед активацією кнопки + легкий відгук, коли вона готова.
  useEffect(() => {
    setUnlocked(false);
    const id = window.setTimeout(() => setUnlocked(true), UNLOCK_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [handoff]);

  const start = () => {
    if (!unlocked) return;
    haptic('light');
    onClose();
  };

  return (
    <Overlay label="Передача ходу">
      <div className={styles.pass} role="dialog" aria-modal="true" aria-label={`Хід гравця ${handoff.name}`}>
        <div className={styles.passChip}>Передай пристрій</div>

        <div
          className={styles.passAvatar}
          style={{ background: `radial-gradient(circle at 35% 25%, #fff8e6, ${handoff.color})` }}
          aria-hidden
        >
          {handoff.avatar}
        </div>

        <p className={styles.passLabel}>{handoff.label}</p>
        <h2 className={styles.passName} style={{ color: handoff.color }}>
          {handoff.name}
        </h2>

        <div className={styles.passSteps}>
          <span>
            <b>1</b> віддай телефон
          </span>
          <span>
            <b>2</b> натисни кнопку
          </span>
        </div>

        <button
          type="button"
          className={cn(styles.passButton, unlocked && styles.passButtonReady)}
          disabled={!unlocked}
          onClick={start}
          style={unlocked ? { background: `linear-gradient(180deg, ${handoff.color}, color-mix(in srgb, ${handoff.color} 72%, #000))` } : undefined}
        >
          {unlocked ? '✅ Я готовий' : '…'}
        </button>
      </div>
    </Overlay>
  );
}
