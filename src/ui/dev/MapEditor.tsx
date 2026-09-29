/**
 * Редактор розкладки карти — ТІЛЬКИ в режимі розробки.
 *
 * Навіщо: координати загонів, будівель, тварин і декору в config.ts задані
 * у відсотках. Підбирати їх наосліп боляче, тому цей оверлей дає мишею
 * посувати/розтягувати прямокутники й одразу копіювати готові числа.
 *
 * Як відкрити:  npm run dev  →  http://localhost:5173/?editor=1  (вікно ≥1000px)
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { ANIMALS, DECOR, HERD_KEYS, ZONES } from '../../game/config';
import type { DecorPlacement, ZoneLayout } from '../../game/config';
import type { HerdKey } from '../../game/types';
import { cn } from '../../lib/cn';
import styles from './MapEditor.module.css';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapLayout {
  zones: Record<HerdKey, ZoneLayout>;
  decor: DecorPlacement[];
}

interface MapEditorProps {
  layout: MapLayout;
  /** Оновлення через функцію — щоб злиття завжди застосовувалось до свіжого стану. */
  onChange: (updater: (prev: MapLayout) => MapLayout) => void;
  onClose: () => void;
}

const round = (value: number): number => Math.round(value * 2) / 2;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Де стояла панель редактора (її запам'ятовуємо між запусками). */
const PANEL_KEY = 'lux-ferma:editor-panel';

type FrameGetter = () => DOMRect | undefined;

/**
 * Тягне елемент: віддає СУМАРНИЙ зсув у відсотках від опорного прямокутника
 * (не приріст за кадр — інакше накопичення губиться при ре-рендері React).
 * Слухачі вішаємо на window: елемент може перемалюватися, а потік подій — ні.
 */
function beginDrag(
  event: ReactPointerEvent<HTMLElement>,
  frame: DOMRect | undefined,
  move: (totalDx: number, totalDy: number) => void,
): void {
  if (!frame) return;
  event.preventDefault();
  event.stopPropagation();

  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  const previousUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = 'none';

  const onMove = (native: PointerEvent) => {
    if (native.pointerId !== pointerId) return;
    move(((native.clientX - startX) / frame.width) * 100, ((native.clientY - startY) / frame.height) * 100);
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    document.body.style.userSelect = previousUserSelect;
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

interface BoxProps {
  rect: Rect;
  label: string;
  tone: 'zone' | 'building' | 'tokens' | 'decor';
  /** Опорна система координат: корінь карти або прямокутник загону. */
  getFrame: FrameGetter;
  onChange: (rect: Rect) => void;
  children?: ReactNode;
}

/** Прямокутник із рамкою: тягнеться за тіло, масштабується за правий нижній кут. */
function DragBox({ rect, label, tone, getFrame, onChange, children }: BoxProps) {
  const move = (event: ReactPointerEvent<HTMLElement>) =>
    beginDrag(event, getFrame(), (dx, dy) => {
      onChange({
        ...rect,
        x: round(clamp(rect.x + dx, 0, 100 - rect.w)),
        y: round(clamp(rect.y + dy, 0, 100 - rect.h)),
      });
    });

  const resize = (event: ReactPointerEvent<HTMLElement>) =>
    beginDrag(event, getFrame(), (dx, dy) =>
      onChange({
        ...rect,
        w: round(clamp(rect.w + dx, 4, 100 - rect.x)),
        h: round(clamp(rect.h + dy, 4, 100 - rect.y)),
      }),
    );

  return (
    <div
      className={cn(styles.box, styles[tone])}
      style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
      onPointerDown={move}
    >
      <span className={styles.tag}>
        {label} · {rect.x},{rect.y} · {rect.w}×{rect.h}
      </span>
      {children}
      <span className={styles.handle} onPointerDown={resize} />
    </div>
  );
}

/** Готовий фрагмент config.ts — його лишається вставити у файл. */
function exportSnippet(layout: MapLayout): string {
  const zones = HERD_KEYS.map((key) => {
    const zone = layout.zones[key];
    return `  ${key}: { x: ${zone.x}, y: ${zone.y}, w: ${zone.w}, h: ${zone.h}, building: [${zone.building.join(', ')}], tokens: [${zone.tokens.join(', ')}], cap: ${zone.cap} },`;
  }).join('\n');

  const decor = layout.decor
    .map(
      (item) =>
        `  decor('${item.sprite.replace('assets/decor/', '').replace('.webp', '')}', '${item.emoji}', ${item.x}, ${item.y}, ${item.w}),`,
    )
    .join('\n');

  return `export const ZONES: Record<HerdKey, ZoneLayout> = {\n${zones}\n};\n\nexport const DECOR: readonly DecorPlacement[] = [\n${decor}\n];`;
}

export function MapEditor({ layout, onChange, onClose }: MapEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState(true);
  const [copied, setCopied] = useState(false);
  const snippet = useMemo(() => exportSnippet(layout), [layout]);

  /*
   * Панель можна перетягнути за заголовок і згорнути. Це не примха: панель
   * закривала нижні загони (зокрема будку малого пса), тому її положення
   * зберігаємо — щоб при наступному відкритті вона не лізла на карту знову.
   */
  const [panel, setPanel] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = window.localStorage.getItem(PANEL_KEY);
      return raw ? (JSON.parse(raw) as { x: number; y: number }) : null;
    } catch {
      return null;
    }
  });
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(PANEL_KEY)?.includes('"collapsed":true') ?? false;
    } catch {
      return false;
    }
  });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const persist = useCallback((next: { x: number; y: number } | null, isCollapsed: boolean) => {
    try {
      window.localStorage.setItem(PANEL_KEY, JSON.stringify({ collapsed: isCollapsed, ...(next ?? {}) }));
    } catch {
      /* приватний режим — не критично */
    }
  }, []);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!box) return;
    dragRef.current = { dx: event.clientX - box.left, dy: event.clientY - box.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const width = event.currentTarget.parentElement?.offsetWidth ?? 320;
    const height = event.currentTarget.parentElement?.offsetHeight ?? 120;
    const x = Math.min(Math.max(4, event.clientX - drag.dx), Math.max(4, window.innerWidth - width - 4));
    const y = Math.min(Math.max(4, event.clientY - drag.dy), Math.max(4, window.innerHeight - height - 4));
    setPanel({ x, y });
  };

  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setPanel((current) => {
      persist(current, collapsed);
      return current;
    });
  };

  const rootFrame: FrameGetter = useCallback(() => rootRef.current?.getBoundingClientRect(), []);

  /**
   * Рамка загону, порахована з відсотків (без читання DOM у рендері):
   * внутрішні рамки (будівля, тварини) задані у відсотках загону.
   */
  const zoneFrame =
    (zone: ZoneLayout): FrameGetter =>
    () => {
      const root = rootFrame();
      if (!root) return undefined;
      const x = root.left + (zone.x / 100) * root.width;
      const y = root.top + (zone.y / 100) * root.height;
      return new DOMRect(x, y, (zone.w / 100) * root.width, (zone.h / 100) * root.height);
    };

  const setZone = useCallback(
    (key: HerdKey, patch: Partial<ZoneLayout>) => {
      onChange((prev) => ({ ...prev, zones: { ...prev.zones, [key]: { ...prev.zones[key], ...patch } } }));
    },
    [onChange],
  );

  const setDecor = useCallback(
    (index: number, patch: Partial<DecorPlacement>) => {
      onChange((prev) => ({
        ...prev,
        decor: prev.decor.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      }));
    },
    [onChange],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div ref={rootRef} className={cn(styles.root, grid && styles.grid)}>
      {HERD_KEYS.map((key) => {
        const zone = layout.zones[key];
        const frame = zoneFrame(zone);
        return (
          <DragBox
            key={key}
            rect={zone}
            label={ANIMALS[key].label}
            tone="zone"
            getFrame={rootFrame}
            onChange={(rect) => setZone(key, rect)}
          >
            <DragBox
              rect={{ x: zone.building[0], y: zone.building[1], w: zone.building[2], h: zone.building[3] }}
              label="будівля"
              tone="building"
              getFrame={frame}
              onChange={(rect) => setZone(key, { building: [rect.x, rect.y, rect.w, rect.h] })}
            />
            <DragBox
              rect={{
                x: zone.tokens[3],
                y: zone.tokens[0],
                w: 100 - zone.tokens[3] - zone.tokens[1],
                h: 100 - zone.tokens[0] - zone.tokens[2],
              }}
              label="тварини"
              tone="tokens"
              getFrame={frame}
              onChange={(rect) =>
                setZone(key, {
                  tokens: [rect.y, 100 - rect.x - rect.w, 100 - rect.y - rect.h, rect.x],
                })
              }
            />
          </DragBox>
        );
      })}

      {layout.decor.map((item, index) => (
        <DragBox
          key={`${item.sprite}-${index}`}
          rect={{ x: item.x, y: item.y, w: item.w, h: 18 }}
          label={item.sprite.replace('assets/decor/', '').replace('.webp', '')}
          tone="decor"
          getFrame={rootFrame}
          onChange={(rect) => setDecor(index, { x: rect.x, y: rect.y, w: rect.w })}
        />
      ))}

      <div
        className={`${styles.panel}${collapsed ? ` ${styles.panelCollapsed}` : ''}`}
        style={panel ? { left: panel.x, top: panel.y, bottom: 'auto', right: 'auto' } : undefined}
      >
        <div
          className={styles.panelHead}
          onPointerDown={startDrag}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          title="Перетягни, щоб перенести панель"
        >
          <b>Редактор карти</b>
          <span className={styles.headBtns}>
            <button
              type="button"
              className={styles.panelBtn}
              onClick={() => {
                const next = !collapsed;
                setCollapsed(next);
                persist(panel, next);
              }}
            >
              {collapsed ? '▴ розгорнути' : '▾ згорнути'}
            </button>
            <button type="button" className={styles.panelBtn} onClick={onClose}>
              ✕
            </button>
          </span>
        </div>
        {!collapsed && (
          <>
            <p className={styles.hint}>
              Тягнеш рамку — рухаєш, тягнеш білий квадратик у куті — розмір. Крок 0.5%. Рамки сусідніх загонів
              перетинаються: якщо за тіло не хапається, тягни за вільну частину (кути доступні завжди). Панель
              перетягується за заголовок і ховається кнопкою «згорнути».
            </p>
            <pre className={styles.code}>{snippet}</pre>
            <div className={styles.panelActions}>
          <button type="button" className={styles.panelBtn} onClick={copy}>
            {copied ? '✓ Скопійовано' : 'Копіювати JSON'}
          </button>
          <button type="button" className={styles.panelBtn} onClick={() => setGrid((value) => !value)}>
            {grid ? 'Сітка: увімк' : 'Сітка: вимк'}
          </button>
          <button
            type="button"
            className={styles.panelBtn}
            onClick={() => onChange(() => ({ zones: structuredClone(ZONES), decor: structuredClone([...DECOR]) }))}
          >
            Скинути
          </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
