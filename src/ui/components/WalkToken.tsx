import { ANIMAL_SPRITES, PREDATOR_SPRITES, assetUrl } from '../../assets/manifest';
import { useAssets } from '../../assets/useAssets';
import { WALK_SHEETS } from '../../assets/walk';
// WalkKey = HerdKey | 'fox' | 'bear': стрічки ходи є і для хижаків, тож
// компонент має приймати їх теж (набіг показує біжучого звіра).
import type { WalkKey } from '../../assets/walk';
import { cn } from '../../lib/cn';
import { Sprite } from './Sprite';
import styles from './BoardScene.module.css';

interface WalkTokenProps {
  species: WalkKey;
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
    /*
     * Фолбек — статичний спрайт. Хижаки лежать в іншій мапі, ніж тварини
     * двору: `fox`/`bear` не є видами стада, тож шукаємо в обох.
     */
    const fallback =
      species === 'fox' || species === 'bear'
        ? PREDATOR_SPRITES[species]
        : ANIMAL_SPRITES[species];
    return <Sprite src={fallback} emoji={emoji} alt="" className={className} style={vars} />;
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
