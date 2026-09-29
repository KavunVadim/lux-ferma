import type { CSSProperties } from 'react';
import { useAssets } from '../../assets/useAssets';
import { cn } from '../../lib/cn';
import styles from './Sprite.module.css';

interface SpriteProps {
  /** Повний URL спрайта (з manifest.ts). */
  src: string;
  /** Фолбек, поки спрайт не завантажився. */
  emoji: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Спрайт з graceful-фолбеком: якщо картинка ще не готова або не завантажилась,
 * показуємо емодзі — гра лишається читабельною на будь-якому з'єднанні.
 */
export function Sprite({ src, emoji, alt = '', className, style }: SpriteProps) {
  const { available } = useAssets();

  if (!available[src]) {
    return (
      <span className={cn(styles.fallback, className)} style={style} role="img" aria-label={alt || emoji}>
        {emoji}
      </span>
    );
  }

  return <img className={cn(styles.image, className)} style={style} src={src} alt={alt} draggable={false} />;
}
