import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface OverlayProps {
  children: ReactNode;
  /**
   * center — модалка по центру, sheet — панель, що виїжджає знизу,
   * float — плаваюча картка без затемнення (кубики/результат поверх поля).
   */
  variant?: 'center' | 'sheet' | 'float';
  /** Клік по фону або Esc. */
  onClose?: () => void;
  label?: string;
}

/** База для всіх оверлеїв: фон, анімація, закриття по Esc і кліку зовні. */
export function Overlay({ children, variant = 'center', onClose, label }: OverlayProps) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={cn(
        'overlay',
        variant === 'center' && 'overlay--center',
        variant === 'float' && 'overlay--float',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      {children}
    </div>
  );
}
