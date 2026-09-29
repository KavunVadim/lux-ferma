import { ANIMAL_SPRITES, assetUrl } from '../../assets/manifest';
import { useAssets } from '../../assets/useAssets';
import { WALK_SHEETS } from '../../assets/walk';
import type { HerdKey } from '../../game/types';
import { cn } from '../../lib/cn';
import { Sprite } from './Sprite';
import styles from './BoardScene.module.css';

interface WalkTokenProps {
  species: HerdKey;
  emoji: string;
  /** CSS-змінні руху (темп, фаза, напрямок) з motionFor(). */
  vars: Record<string, string>;
  className?: string;
  /**
   * Не використовувати стрічку кадрів навіть якщо вона є — показувати вихідний
   * статичний спрайт виду. Потрібно там, де арт зі стрічки не пасує до карти
   * (наприклад малий пес: його намалювали в іншому стилі).
   */
  staticSprite?: boolean;
}

/**
 * Тваринка на карті: якщо для виду є спрайт-лист ходи — показуємо цикл кадрів
 * (`steps(frames)` по горизонтальній стрічці), інакше — статичний спрайт із
 * CSS-погойдуванням (як було).
 *
 * Кадри малює `scripts/build-atlas.mjs`; поки листа немає, гра виглядає як
 * раніше, тому конвеєр можна наповнювати по одному виду.
 */
export function WalkToken({ species, emoji, vars, className, staticSprite }: WalkTokenProps) {
  const sheet = staticSprite ? undefined : WALK_SHEETS[species];
  const { available } = useAssets();
  const url = sheet ? assetUrl(sheet.url) : null;
  const ready = !!sheet && !!url && available[url] === true;

  if (!sheet || !ready) {
    return <Sprite src={ANIMAL_SPRITES[species]} emoji={emoji} alt="" className={className} style={vars} />;
  }

  return (
    <span
      className={cn(styles.walker, className)}
      style={{ ...vars, ['--frames' as string]: String(sheet.frames) }}
    >
      <img className={styles.walkStrip} src={url} alt="" draggable={false} />
    </span>
  );
}
