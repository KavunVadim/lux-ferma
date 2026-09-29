import { GAME_TITLE } from '../../game/config';
import { cn } from '../../lib/cn';
import styles from './TopBar.module.css';

interface TopBarProps {
  muted: boolean;
  onToggleSound: () => void;
  onOpenRules: () => void;
  onOpenSettings: () => void;
  onReset: () => void;
  className?: string;
  /** ПК: назва гри лежить на карті, тому малюється дерев'яною вивіскою. */
  sign?: boolean;
}

/** Верхня панель: правила, назва гри, звук, налаштування, скидання. */
export function TopBar({
  muted,
  onToggleSound,
  onOpenRules,
  onOpenSettings,
  onReset,
  className,
  sign = false,
}: TopBarProps) {
  return (
    <header className={cn(styles.bar, className)}>
      <button type="button" className="icon-btn" onClick={onOpenRules} aria-label="Правила гри">
        ❓
      </button>
      <div className={cn(styles.brand, sign && styles.brandSign)}>🌾 {GAME_TITLE}</div>
      <div className={styles.actions}>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleSound}
          aria-label={muted ? 'Увімкнути звук' : 'Вимкнути звук'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button type="button" className="icon-btn" onClick={onOpenSettings} aria-label="Налаштування">
          ⚙️
        </button>
        <button type="button" className="icon-btn" onClick={onReset} aria-label="Почати заново">
          ↺
        </button>
      </div>
    </header>
  );
}
