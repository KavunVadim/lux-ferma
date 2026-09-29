import { cn } from '../../lib/cn';
import { Button } from '../components/Button';
import { Overlay } from './Overlay';
import styles from './Overlays.module.css';

interface WinModalProps {
  winner: string;
  onNewGame: () => void;
  onClose: () => void;
}

/** Фінальний екран партії. */
export function WinModal({ winner, onNewGame, onClose }: WinModalProps) {
  return (
    <Overlay label="Перемога" onClose={onClose}>
      <div className={cn(styles.modal, styles.winCard)}>
        <div className={styles.trophy}>🏆</div>
        <h2 className={styles.title}>Перемога!</h2>
        <p className={styles.winText}>{winner} збирає повну ферму першим!</p>
        <p className={styles.winSub}>Качка, коза, свиня, кінь і корова — усі на місці. Супер-Фермер!</p>
        <div className={styles.actions}>
          <Button variant="gold" onClick={onNewGame}>
            🌾 Нова гра
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
