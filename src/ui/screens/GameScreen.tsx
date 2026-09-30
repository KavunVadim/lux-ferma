import { lazy, Suspense, useEffect, useState } from 'react';
import type { GameApi } from '../../app/useGame';
import { DECOR, GAME_TITLE, PREDATORS, ZONES } from '../../game/config';
import { progress } from '../../game/engine';
import type { HerdKey } from '../../game/types';
import { cn } from '../../lib/cn';
import { useMediaQuery } from '../lib/useMediaQuery';
import { ActionBar } from '../components/ActionBar';
import { BoardScene } from '../components/BoardScene';
import { MobileRaid } from '../components/RaidRun';
import { shouldShowRaid } from '../components/raidLogic';
import { EventFeed } from '../components/EventFeed';
import { FarmPanel } from '../components/FarmPanel';
import { PlayerRail } from '../components/PlayerRail';
import { Scoreboard } from '../components/Scoreboard';
import { TopBar } from '../components/TopBar';
import { TurnBanner } from '../components/TurnBanner';
import { ConfirmModal } from '../overlays/ConfirmModal';
import { HandoffOverlay } from '../overlays/HandoffOverlay';
import { Overlay } from '../overlays/Overlay';
import { ResultModal } from '../overlays/ResultModal';
import { TradeSheet } from '../overlays/TradeSheet';
import { WinModal } from '../overlays/WinModal';
import { Confetti, Toast } from '../overlays/Toast';
import styles from './GameScreen.module.css';

/**
 * Редактор розкладки карти підключається лише в режимі розробки
 * (`?editor=1`), тому в продакшн-бандл не потрапляє.
 */
const MapEditor =
  import.meta.env.DEV
    ? lazy(() => import('../dev/MapEditor').then((module) => ({ default: module.MapEditor })))
    : null;

const editorRequested =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('editor');

interface GameScreenProps {
  game: GameApi;
  onOpenRules: () => void;
  onOpenSettings: () => void;
}

/**
 * Ігровий екран.
 *
 * Телефон (< 1000px): одна колонка — кубики зверху, сітка своїх дворів, дії знизу.
 * ПК (≥ 1000px): ігрове поле з двома-чотирма фермами по діагоналях, рейка гравців
 * ліворуч, кубики й події праворуч, лоток дій знизу.
 */
/**
 * ПОЗИЦІЇ ПЛИТОК, ДО ЯКИХ БІЖИТЬ ХИЖАК (телефон).
 *
 * Логіка набігу: хижак з'являється біля ПЕРШОЇ своєї жертви, потім
 * переходить до ДРУГОЇ — і аж тоді тікає. Лисиця обходить качок і кіз,
 * ведмідь — свиней і коней (порядок із `PREDATORS[*].steals`).
 *
 * На телефоні карти немає, тож маршрут не можна задати відсотками карти.
 * Замість цього міряємо РЕАЛЬНІ плитки в DOM: сітка адаптивна (дві колонки,
 * корова на всю ширину), і координати залежать від конкретного рендера.
 *
 * Повертає `--stop-0-x/y` і `--stop-1-x/y` — ті самі назви, що на ПК, тож
 * анімація читає їх однаково. Плитки шукаємо за `data-victim`, який ставить
 * `FarmPanel`.
 */
function useRaidTargets(
  raider: 'fox' | 'bear' | null,
  deltaKey: number,
): { vars: React.CSSProperties; ready: boolean } {
  const [vars, setVars] = useState<React.CSSProperties>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!raider) {
      setVars({});
      setReady(false);
      return;
    }
    setReady(false);
    // Види, які краде цей хижак, у порядку обходу.
    const victims = PREDATORS[raider].steals;

    /*
     * КОЛИ МІРЯТИ — і чому не одразу.
     *
     * Замір показав: одразу після ходу плитка качки стоїть на `x = -63px`
     * (за лівим краєм), і лише через ~1.3 с «доїжджає» на своє місце — сітка
     * перебудовується анімовано, бо качка переїхала з першої позиції на
     * п'яту (у неї 0 голів, у решти теж, тож порядок змінюється).
     *
     * Тому міряємо НЕ в першому кадрі, а з невеликою затримкою й повторно,
     * поки координати не стануть осмисленими (у межах сітки). Якщо плитки
     * вклались одразу — беремо перший же результат і не чекаємо даремно.
     */
    /*
     * МІРЯЄМО ОДИН РАЗ, із затримкою на перебудову сітки.
     *
     * Замір показав, як сітка «їде»: одразу після ходу плитка качки стоїть
     * за лівим краєм (`x = -63px`), і лише через ~1.3 с доїжджає на місце —
     * бо качка переїхала з першої позиції на п'яту (у неї 0 голів).
     *
     * Дві пастки, на які я наступив:
     *   1. міряти в першому кадрі — координата від'ємна;
     *   2. міряти в ЦИКЛІ з `setVars` — React перемальовує шар, і це зсуває
     *      сітку: у замірі плитка «вилітала» на 1981px. Цикл вимірювання
     *      сам себе ламав.
     *
     * Тож: одна затримка 900 мс (сітка гарантовано вклалась), один замір.
     */
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      if (!victims.length) return;
      const host = document.querySelector(`[data-victim="${victims[0]}"]`)?.parentElement;
      const hr = host?.getBoundingClientRect();
      if (!host || !hr || hr.width < 1 || hr.height < 1) return;

      victims.forEach((key, index) => {
        const pen = document.querySelector(`[data-victim="${key}"]`) as HTMLElement | null;
        if (!pen) return;
        const pr = pen.getBoundingClientRect();
        next[`--stop-${index}-x`] = `${(((pr.left + pr.width / 2) - hr.left) / hr.width * 100).toFixed(1)}%`;
        next[`--stop-${index}-y`] = `${(((pr.top + pr.height * 0.72) - hr.top) / hr.height * 100).toFixed(1)}%`;
      });
      setVars(next as React.CSSProperties);
      /*
       * `ready` вмикаємо ЛИШЕ коли координати справді є. Набіг показуємо
       * тільки тоді: якби анімація стартувала раніше, хижак біг би до
       * «нульових» координат (лівий верхній кут) і смикався б, коли
       * позиції нарешті прийдуть.
       */
      if (Object.keys(next).length) setReady(true);
    }, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [raider, deltaKey]);

  return { vars, ready };
}

export function GameScreen({ game, onOpenRules, onOpenSettings }: GameScreenProps) {
  const wide = useMediaQuery('(min-width: 1000px)');
  const [tradeOpen, setTradeOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inspected, setInspected] = useState<HerdKey | null>(null);
  const [layout, setLayout] = useState(() =>
    editorRequested && MapEditor ? { zones: structuredClone(ZONES), decor: structuredClone([...DECOR]) } : null,
  );

  const { state } = game;
  if (!state) return null;

  const player = state.players[state.current] ?? state.players[0]!;
  const winner = state.winnerIndex !== null ? state.players[state.winnerIndex] : undefined;
  const winOpen = state.over && !game.result;

  /*
   * Кубиків у HUD немає взагалі.
   *
   * Кидок показує модалка (вона крутить ті самі грані, і це видно на весь
   * екран), результат гравець читає там же, а про передачу пристрою каже
   * окремий екран. Будь-яка пара кубиків у HUD означала або дубль обертів
   * позаду модалки, або те саме число, показане вдруге.
   */

  // Набіг для телефону: та сама подія, але маршрут біжить по сітці дворів.
  const mobileRaid = shouldShowRaid(game.events);
  const { vars: raidTargets, ready: raidReady } = useRaidTargets(
    mobileRaid?.raider ?? null,
    game.deltaKey,
  );

  return (
    <section className={cn(styles.shell, wide && styles.shellField, state.over && styles.finished)}>
      {wide ? (
        <>
          {/* Одна карта на весь екран: спільна для всіх, показує двір поточного.
              key=поточний гравець — при передачі ходу карта «перемикається» (анімація). */}
          <BoardScene
            key={`turn-${state.current}`}
            className={styles.fieldLayer}
            state={state}
            events={game.events}
            deltas={game.deltas}
            deltaKey={game.deltaKey}
            inspected={inspected}
            onInspect={setInspected}
            zones={layout?.zones}
            decor={layout?.decor}
          />

          {/* Верхня вільна смуга над загонами: хід і дрібні кнопки. */}
          <header className={styles.hud}>
            <div className={styles.turnChip} style={{ ['--player-color' as string]: player.color }}>
              <span className={styles.turnAvatar} aria-hidden>
                {player.avatar}
              </span>
              <div className={styles.turnText}>
                <b>{player.name}</b>
                <span>
                  {state.rolled ? 'ходив, передай хід' : 'твій хід'} · {progress(player.farm)}/5
                </span>
              </div>
            </div>

            <div className={styles.hudIcons}>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setHistoryOpen(true)}
                aria-label="Історія ходів"
                title="Історія ходів"
              >
                📜
              </button>
              <button type="button" className="icon-btn" onClick={onOpenRules} aria-label="Правила гри">
                ❓
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={game.toggleSound}
                aria-label={game.muted ? 'Увімкнути звук' : 'Вимкнути звук'}
              >
                {game.muted ? '🔇' : '🔊'}
              </button>
              <button type="button" className="icon-btn" onClick={onOpenSettings} aria-label="Налаштування">
                ⚙️
              </button>
              <button type="button" className="icon-btn" onClick={() => setResetOpen(true)} aria-label="Почати заново">
                ↺
              </button>
            </div>
          </header>

          {/* Нижня вільна смуга під загонами: вивіска, гравці, дії. */}
          <footer className={styles.footer}>
            <div className={styles.titleSign}>🌾 {GAME_TITLE}</div>
            <PlayerRail variant="row" players={state.players} current={state.current} />
            <div className={styles.tray}>
              <ActionBar
                state={state}
                busy={game.rolling || !!game.result}
                canTrade={game.canTrade}
                tradesDone={game.tradesDone}
                canUndo={game.canUndo}
                onTrade={() => setTradeOpen(true)}
                onRoll={game.roll}
                onEndTurn={game.endTurn}
                onUndo={game.undo}
              />
            </div>
          </footer>

          {historyOpen && (
            <Overlay variant="sheet" onClose={() => setHistoryOpen(false)} label="Історія ходів">
              <div className="sheet">
                <div className="sheet__head">
                  <h2>📜 Історія ходів</h2>
                  <button type="button" className="icon-btn" onClick={() => setHistoryOpen(false)} aria-label="Закрити">
                    ✕
                  </button>
                </div>
                <EventFeed state={state} inspected={inspected} />
              </div>
            </Overlay>
          )}

          {layout && MapEditor && (
            <Suspense fallback={null}>
              <MapEditor
                layout={layout}
                onChange={(updater) => setLayout((prev) => (prev ? updater(prev) : prev))}
                onClose={() => setLayout(null)}
              />
            </Suspense>
          )}
        </>
      ) : (
        <>
          <TopBar
            className={styles.top}
            muted={game.muted}
            onToggleSound={game.toggleSound}
            onOpenRules={onOpenRules}
            onOpenSettings={onOpenSettings}
            onReset={() => setResetOpen(true)}
          />

          <div className={styles.left}>
            {/* Хто ходить зараз: рейка з дробами N/5 + червона плашка ходу. */}
            <Scoreboard players={state.players} current={state.current} />
            <TurnBanner state={state} />

            {/*
              НАБІГ ХИЖАКА НА ТЕЛЕФОНІ передається в FarmPanel пропом `raid`:
              він має лежати ВСЕРЕДИНІ сітки дворів, інакше його відсотки
              рахуються від більшого контейнера й хижак біжить поза екраном.
              Раніше набіг жив лише в гілці `wide` (усередині карти), тож на
              мобільному його не було взагалі.
            */}

            <FarmPanel
              bodyClassName={styles.farmBody}
              farm={state.players[state.current]?.farm ?? state.players[0]!.farm}
              herd={state.herd}
              deltas={game.deltas}
              deltaKey={game.deltaKey}
              savedGuard={game.savedGuard}
              raid={
                /*
                 * Показуємо набіг ЛИШЕ коли координати зупинок готові:
                 * інакше хижак стартує до «нульових» координат і смикається,
                 * коли позиції плиток нарешті приходять.
                 */
                mobileRaid && raidReady && (
                  <>
                    {/* Шар усередині сітки дворів — тоді відсотки збігаються
                        з координатами плиток (див. useRaidTargets). */}
                    <span className={styles.raidLayer} style={raidTargets}>
                      <MobileRaid event={mobileRaid} deltaKey={game.deltaKey} />
                    </span>
                  </>
                )
              }
            />

          </div>

          <ActionBar
            className={styles.bar}
            state={state}
            busy={game.rolling || !!game.result}
            canTrade={game.canTrade}
            tradesDone={game.tradesDone}
            canUndo={game.canUndo}
            onTrade={() => setTradeOpen(true)}
            onRoll={game.roll}
            onEndTurn={game.endTurn}
            onUndo={game.undo}
          />
        </>
      )}

      {tradeOpen && !state.over && (
        <TradeSheet
          playerName={state.players[state.current]?.name ?? ''}
          farm={state.players[state.current]?.farm ?? state.players[0]!.farm}
          herd={state.herd}
          options={game.trades}
          tradesDone={game.tradesDone}
          tradesLeft={game.tradesLeft}
          onClose={() => setTradeOpen(false)}
          onChoose={(option) => game.trade(option)}
        />
      )}

      {(game.result || game.rolling) && (
        <ResultModal
          result={game.result}
          rolling={game.rolling}
          dice={game.rollTarget}
          onClose={game.dismissResult}
        />
      )}

      {/* Під час розкладки карти оверлеї не потрібні — вони лише перехоплюють кліки. */}
      {game.handoff && !layout && <HandoffOverlay handoff={game.handoff} onClose={game.closeHandoff} />}

      {winOpen && winner && (
        <>
          <Confetti />
          <WinModal winner={winner.name} onNewGame={game.reset} onClose={game.toStart} />
        </>
      )}

      {resetOpen && (
        <ConfirmModal
          title="↺ Почати заново?"
          text="Поточна партія буде втрачена."
          confirmLabel="Так, скинути"
          onCancel={() => setResetOpen(false)}
          onConfirm={() => {
            setResetOpen(false);
            game.reset();
          }}
        />
      )}

      <Toast message={game.toast} />
    </section>
  );
}
