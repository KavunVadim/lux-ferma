import { cn } from '../../lib/cn';
import { Button } from '../components/Button';
import { Overlay } from './Overlay';
import styles from './Overlays.module.css';

interface ConfirmModalProps {
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Підтвердження небезпечної дії (скидання партії). */
export function ConfirmModal({ title, text, confirmLabel, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <Overlay onClose={onCancel} label={title}>
      <div className={styles.modal}>
        <div className={cn(styles.head, styles['head--bad'])}>
          <div className={styles.title}>{title}</div>
        </div>
        <div className={styles.body}>
          <p style={{ margin: 0, textAlign: 'center', fontWeight: 700 }}>{text}</p>
        </div>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onCancel}>
            Скасувати
          </Button>
          <Button variant="barn" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
