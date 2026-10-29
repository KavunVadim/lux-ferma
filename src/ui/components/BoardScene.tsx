import { ANIMAL_SPRITES, assetUrl, BUILDING_SPRITES, MAP_URL } from '../../assets/manifest';
import { ANIMALS, DECOR, HERD_KEYS, SPRITE_SCALE, ZONES } from '../../game/config';
import type { DecorPlacement, ZoneLayout } from '../../game/config';
import type { GameEvent, GameState, HerdKey } from '../../game/types';
import { cn } from '../../lib/cn';
import { RaidRun } from './RaidRun';
import { Sprite } from './Sprite';
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
  /*
   * НАБІГ ПОКАЗУЄМО ЗА ПОДІЄЮ, а не за станом двору.
   *
   * Було: умова вимагала, щоб у дворі ЗАРАЗ була жертва або щоб `delta ≠ 0`.
   * Але `farm` — це стан ПІСЛЯ ходу: качку вже вкрали, тож `farm.duck = 0`,
   * і набіг не показувався саме тоді, коли він найпотрібніший — коли крадіжка
   * сталася. Сама подія `loss` із `raider` уже доводить, що хижак напав і
   * щось забрав, тож цього достатньо.
   *
   * `kind: 'raid'` — окремий випадок «забирав, але нічого не було»: там
   * хижак теж пробігає, показуючи, що загроза була.
   */
  const raidEvent = events.find(
    (item) => item.raider && (item.kind === 'loss' || item.kind === 'raid'),
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

              {/*
               * ОДНА статична тварина на двір — та сама, що на телефоні.
               *
               * Було: до `zone.cap` крихітних спрайтів, які ще й «переступали»
               * кадрами ходи. На великій карті це читалось як метушня: замість
               * «у дворі дві свині» око бачило двох мультяшних комах, а хода
               * додавала руху там, де його ніхто не просив.
               *
               * Тепер у загоні стоїть один спокійний спрайт — рівно як у
               * плитці двору на телефоні, — а кількість показує табличка
               * `×N` (і кошик стада). Щойно тварина прибула, вона «вистрибує»
               * на своє місце (`.arrive`), тож видно саме факт появи.
               */}
              <span
                className={styles.herd}
                style={{
                  top: `${zone.tokens[0]}%`,
                  right: `${zone.tokens[1]}%`,
                  bottom: `${zone.tokens[2]}%`,
                  left: `${zone.tokens[3]}%`,
                  // Масштаб за видом — той самий, що задавав розмір спрайта
                  // в колишній сітці (див. SPRITE_SCALE у config.ts).
                  ['--scale' as string]: SPRITE_SCALE[key],
                }}
              >
                {event?.kind === 'gain' && (
                  <span key={`hearts-${deltaKey}`} className={styles.hearts} aria-hidden>
                    <span>💚</span>
                    <span>💛</span>
                    <span>💚</span>
                  </span>
                )}
                {count > 0 && (
                  <Sprite
                    src={ANIMAL_SPRITES[key]}
                    emoji={meta.emoji}
                    alt=""
                    className={cn(styles.animal, delta !== undefined && delta > 0 && styles.arrive)}
                  />
                )}
              </span>

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
