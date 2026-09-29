import { useEffect } from 'react';
import type { HandoffView } from '../../app/useGame';
import { Overlay } from './Overlay';
import styles from './Overlays.module.css';

interface HandoffOverlayProps {
  handoff: HandoffView;
  onClose: () => void;
}

const AUTO_HIDE_MS = 2400;

/** Екран передачі пристрою: показує, чий хід, і сам зникає. */
export function HandoffOverlay({ handoff, onClose }: HandoffOverlayProps) {
  useEffect(() => {
    const id = window.setTimeout(onClose, AUTO_HIDE_MS);
    return () => window.clearTimeout(id);
  }, [handoff, onClose]);

  return (
    <Overlay label="Передача ходу">
      <div
        className={styles.handoff}
        style={{ background: `linear-gradient(135deg, ${handoff.color}, ${handoff.color}dd)` }}
        onClick={onClose}
      >
        <div className={styles.handoffIcon}>📱</div>
        <div className={styles.handoffLabel}>{handoff.label}</div>
        <div className={styles.handoffName}>{handoff.name}</div>
        <div className={styles.handoffHint}>торкнись, щоб продовжити</div>
      </div>
    </Overlay>
  );
}
