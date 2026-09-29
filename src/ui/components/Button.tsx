import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type ButtonVariant = 'barn' | 'green' | 'gold' | 'wood' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
  small?: boolean;
  pulse?: boolean;
  children: ReactNode;
}

/**
 * Кнопка гри: «товста» з 3D-тіньовою, як у настільних іграх.
 * Базові стилі — глобальні (.btn), варіанти — теж (btn--green тощо).
 */
export function Button({
  variant = 'barn',
  block = false,
  small = false,
  pulse = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn('btn', `btn--${variant}`, block && 'btn--block', small && 'btn--sm', pulse && 'btn--pulse', className)}
      {...rest}
    >
      {children}
    </button>
  );
}
