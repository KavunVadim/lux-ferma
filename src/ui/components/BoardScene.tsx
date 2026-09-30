import { ANIMAL_SPRITES, assetUrl, BUILDING_SPRITES, MAP_URL } from '../../assets/manifest';
import { ANIMALS, DECOR, HERD_KEYS, SPRITE_SCALE, ZONES } from '../../game/config';
import type { DecorPlacement, ZoneLayout } from '../../game/config';
import type { GameEvent, GameState, HerdKey } from '../../game/types';
import { cn } from '../../lib/cn';
import { motionFor } from '../lib/motion';
import { RaidRun, raidVictims } from './RaidRun';
import { Sprite } from './Sprite';
import { WalkToken } from './WalkToken';
import styles from './BoardScene.module.css';

interface BoardSceneProps {
  state: GameState;
  /** Події останнього ходу: підсвітка дворів, набіг хижака, прибуття/втеча тварин. */
  events: GameEvent[];
  /** Зміни по дворах — для «+N / −N» на карті. */
  deltas: Partial<Record<HerdKey, number>>;
  /** Ключ змінюється щохідного кидка, щоб анімації запускались наново. */
  deltaKey: number;
  inspected: HerdKey | null;
  onInspect: (key: HerdKey | null) => void;
  className?: string;
  /** Перевизначення розкладки — потрібне редактору карти в режимі розробки. */
  zones?: Record<HerdKey, ZoneLayout>;
  decor?: readonly DecorPlacement[];
}

/**
 * Ігрове поле ПК-версії: **одна** карта ферми на весь екран, спільна для всіх
 * гравців — вона просто показує те, що зараз має гравець у своєму дворі.
 *
 * Полотно тримає пропорції арта й завжди накриває екран (як `cover`), тому
 * координати дворів у відсотках збігаються з намальованими загонами. Панелі
 * інтерфейсу лежать поверх і не зсувають карту.
 */
export function BoardScene({
  state,
  events,
  deltas,
  deltaKey,
  inspected,
  onInspect,
  className,
  zones,
  decor,
}: BoardSceneProps) {
  const farm = state.players[state.current]?.farm;
  const zoneMap = zones ?? ZONES;
  const decorList = decor ?? DECOR;

  /*
   * Набіг показуємо з ОКРЕМОГО шару сцени, а не всередині загону.
   *
   * Беремо першу подію з хижаком (лисиця або ведмідь за хід буває лише одна)
   * і показуємо маршрут лише тоді, коли є що красти: інакше хижак бігав би
   * по порожніх дворах, що виглядає як помилка.
   */
  const raidEvent = events.find(
    (item) =>
      item.raider &&
      (item.kind === 'loss' || item.kind === 'raid') &&
      raidVictims(item.raider).some((key) => (farm?.[key] ?? 0) > 0 || (item.delta ?? 0) !== 0),
  );

  return (
    <div className={cn(styles.field, className)} data-swap>
      <div className={styles.canvas} style={{ backgroundImage: `url(${MAP_URL})` }}>
        {decorList.map((item, index) => (
          <span
            key={`${item.sprite}-${index}`}
            className={styles.decor}
            style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%` }}
          >
            <Sprite src={assetUrl(item.sprite)} emoji={item.emoji} className={styles.decorSprite} />
          </span>
        ))}

        {HERD_KEYS.map((key) => {
          const zone = zoneMap[key];
          const meta = ANIMALS[key];
          const count = farm ? farm[key] : 0;
          const shown = Math.min(count, zone.cap);
          const event = events.find((item) => item.subject === key);
          const delta = deltas[key];

          return (
            <button
              type="button"
              key={key}
              className={cn(
                styles.zone,
                inspected === key && styles.selected,
                event?.kind === 'gain' && styles.gain,
                (event?.kind === 'loss' || event?.kind === 'save') && styles.lost,
              )}
              style={{
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                width: `${zone.w}%`,
                height: `${zone.h}%`,
              }}
              onClick={() => onInspect(inspected === key ? null : key)}
              aria-label={`${meta.house}: ${count} тварин`}
            >
              <Sprite
                src={BUILDING_SPRITES[key]}
                emoji={meta.emoji}
                className={styles.building}
                style={{
                  left: `${zone.building[0]}%`,
                  top: `${zone.building[1]}%`,
                  width: `${zone.building[2]}%`,
                  height: `${zone.building[3]}%`,
                }}
              />

              {/*
               * Хижак більше НЕ малюється всередині загону: він ходить
               * маршрутом по всій сцені (див. RaidRun нижче). У зоні
               * лишається тільки підсвітка «тут щось сталось» — клас .lost
               * вище.
               */}

              {/* Захист: пес вибігає з будки назустріч хижакові. */}
              {event?.kind === 'save' && event.subject && (
                <span key={`guard-${deltaKey}`} className={styles.guard}>
                  <Sprite
                    src={ANIMAL_SPRITES[event.subject]}
                    emoji={ANIMALS[event.subject].emoji}
                    alt=""
                    className={styles.guardSprite}
                  />
                </span>
              )}

              <span
                className={cn(
                  styles.tokens,
                  SPRITE_SCALE[key] > 1 && styles.tokensCentered,
                  // Дрібні види стоять щільніше: качки — купкою, кози й свині
                  // — щільним гуртом із невеликим просвітом (спрайт більший).
                  SPRITE_SCALE[key] < 1.3 && styles.tokensTight,
                  (key === 'goat' || key === 'pig') && styles.tokensSnug,
                )}
                style={{
                  top: `${zone.tokens[0]}%`,
                  right: `${zone.tokens[1]}%`,
                  bottom: `${zone.tokens[2]}%`,
                  left: `${zone.tokens[3]}%`,
                  // Спрайт пса на арті дрібніший — масштаб задаємо за видом.
                  ['--scale' as string]: SPRITE_SCALE[key],
                }}
              >
                {Array.from({ length: shown }, (_, index) => {
                  const motion = motionFor(key, index);
                  const fresh = delta ? index >= shown - delta : false;
                  const leaving = !!delta && delta < 0;
                  return (
                    <span
                      key={`${key}-${index}`}
                      className={cn(styles.slot, fresh && styles.arrive, leaving && styles.leave)}
                      style={motion.vars}
                    >
                      <WalkToken
                        species={key}
                        emoji={meta.emoji}
                        vars={motion.vars}
                        className={styles.token}
                        // Малий пес має стояти вихідним спрайтом: кадри з аркуша
                        // намальовані в іншому стилі й вибивались із карти.
                        staticSprite={key === 'sdog'}
                      />
                    </span>
                  );
                })}
                {count > shown && <span className={styles.more}>+{count - shown}</span>}
              </span>

              {event?.kind === 'gain' && (
                <span key={`hearts-${deltaKey}`} className={styles.hearts} aria-hidden>
                  <span>💚</span>
                  <span>💛</span>
                  <span>💚</span>
                </span>
              )}

              <span className={styles.sign}>
                <b>{meta.plural}</b>
                <i>×{count}</i>
                <em>🧺{state.herd[key]}</em>
              </span>

              {delta ? (
                <span
                  key={`delta-${deltaKey}`}
                  className={cn(styles.delta, delta > 0 ? styles.deltaUp : styles.deltaDown)}
                >
                  {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                </span>
              ) : null}
            </button>
          );
        })}

        {/*
         * НАБІГ ХИЖАКА — всередині КАРТИ, а не поля.
         *
         * Це критично: ZONES задані у відсотках від карти, а карта ширша за
         * екран (вона масштабується «як cover»). Якби хижак жив у `.field`,
         * ті самі відсотки вказували б на інше місце, і лисиця зупинялась би
         * за 300px від загону.
         *
         * Лежить у кінці, щоб проходити НАД дворами, а не під ними.
         */}
        {raidEvent && <RaidRun event={raidEvent} deltaKey={deltaKey} />}
      </div>
    </div>
  );
}
