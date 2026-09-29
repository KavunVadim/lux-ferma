/**
 * Шар стану гри для React.
 *
 * Уся логіка правил живе в game/engine.ts (чисті функції). Тут — лише:
 *  - збереження стану в React + localStorage,
 *  - тайминги анімацій (кидок, модалка результату, тости),
 *  - звук і тактильний відгук.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { haptic } from '../game/haptics';
import {
  applyTrade,
  availableTrades,
  canTrade,
  createGame,
  endTurn as endTurnPure,
  resolveRoll,
  rollDice,
  tradesLeft,
} from '../game/engine';
import { sound } from '../game/sound';
import { PREDATORS } from '../game/config';
import { clearSave, hasSavedGame, loadGame, saveGame } from '../game/storage';
import { DEFAULT_SETTINGS, applyRuntime, loadSettings, rulesOf, sanitizeSettings, saveSettings } from '../game/settings';
import type { AppSettings } from '../game/settings';
import type { DiceFace, GameEvent, GameState, HerdKey, RollOutcome, TradeOption } from '../game/types';

/** Скільки кадрів «крутиться» кубик перед результатом (напруга). */
const ROLL_TICKS = 16;
const ROLL_TICK_MS = 80;
export const ROLL_DURATION = ROLL_TICKS * ROLL_TICK_MS;
/**
 * Пауза перед картою результату — щоб кубики встигли «докрутитись».
 * Далі чекаємо на «Ок, далі»: анімація на полі (прибуття, набіг) запускається
 * саме цим натисканням, а не одразу після кидка.
 */
const RESULT_DELAY = 520;
/** Скільки живуть бейджі +N/−N. */
const DELTA_LIFETIME = 1800;
const TOAST_LIFETIME = 1900;

export type Screen = 'start' | 'game';

export interface ResultView {
  title: string;
  tone: 'good' | 'bad' | 'neutral';
  dice: [DiceFace, DiceFace] | null;
  events: GameEvent[];
}

export interface HandoffView {
  name: string;
  color: string;
  label: string;
}

export interface GameApi {
  screen: Screen;
  state: GameState | null;
  rolling: boolean;
  rollTarget: [DiceFace, DiceFace] | null;
  result: ResultView | null;
  handoff: HandoffView | null;
  /** Події останнього ходу — для підсвітки зон на карті. */
  events: GameEvent[];
  deltas: Partial<Record<HerdKey, number>>;
  deltaKey: number;
  toast: string | null;
  trades: TradeOption[];
  /** Скільки обмінів уже зроблено цього ходу. */
  tradesDone: number;
  /** Скільки ще можна зробити (null — без обмежень). */
  tradesLeft: number | null;
  /** Чи доступна кнопка обміну зараз. */
  canTrade: boolean;
  /** Налаштування застосунку (правила + звук + анімація). */
  settings: AppSettings;
  hasSave: boolean;
  muted: boolean;
  start: (names: string[]) => void;
  resume: () => void;
  toStart: () => void;
  roll: () => void;
  endTurn: () => void;
  trade: (option: TradeOption) => void;
  dismissResult: () => void;
  /** Показати набіг хижака на замовлення (перевірка анімації, стан не змінюється). */
  previewRaid: (kind: 'fox' | 'bear') => void;
  closeHandoff: () => void;
  toggleSound: () => void;
  /** Змінює налаштування; правила одразу застосовуються й до поточної партії. */
  updateSettings: (patch: Partial<AppSettings>) => void;
  /** Повертає типові налаштування. */
  resetSettings: () => void;
  reset: () => void;
}

function titleFor(outcome: RollOutcome): string {
  if (outcome.won) return '🏆 Перемога!';
  if (outcome.tone === 'bad') return '😱 Напад хижака!';
  if (outcome.tone === 'good') return '🎉 Розмноження!';
  return '🎲 Кубики кинуто';
}

export function useGame(): GameApi {
  const [state, setState] = useState<GameState | null>(null);
  const [screen, setScreen] = useState<Screen>('start');
  const [rolling, setRolling] = useState(false);
  const [rollTarget, setRollTarget] = useState<[DiceFace, DiceFace] | null>(null);
  const [result, setResult] = useState<ResultView | null>(null);
  const [handoff, setHandoff] = useState<HandoffView | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [deltas, setDeltas] = useState<Partial<Record<HerdKey, number>>>({});
  const [deltaKey, setDeltaKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  const stateRef = useRef<GameState | null>(null);
  const rollingRef = useRef(false);
  const timers = useRef<number[]>([]);
  /** Результат кидка, який ще не застосовано до стану (чекає на «Ок, далі»). */
  const pendingRef = useRef<RollOutcome | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /**
   * Відкладена дія. Ідентифікатор прибирається зі списку, щойно таймер
   * спрацював — інакше масив pending-таймерів росте всю партію (витік).
   */
  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current = timers.current.filter((entry) => entry !== id);
      fn();
    }, ms);
    timers.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    const pending = timers.current;
    // Синхронізація із зовнішнім станом (localStorage) при монтуванні.
    setHasSave(hasSavedGame());
    return () => {
      pending.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // Налаштування — єдине джерело правди для звуку, вібрації й теми.
  useEffect(() => {
    applyRuntime(settings);
  }, [settings]);

  // Автозбереження (localStorage — зовнішня система, тому саме ефект).
  // Порожній стан (стартовий екран) НЕ чіпає збереження: інакше воно стирається
  // при кожному запуску, і «Продовжити партію» завжди веде в нікуди.
  useEffect(() => {
    if (state) saveGame(state);
  }, [state]);

  const flashDeltas = useCallback(
    (nextDeltas: Partial<Record<HerdKey, number>>) => {
      setDeltas(nextDeltas);
      setDeltaKey((value) => value + 1);
      later(DELTA_LIFETIME, () => setDeltas({}));
    },
    [later],
  );

  const start = useCallback(
    (names: string[]) => {
      // Звук у першому дотику: після нього браузер уже дозволяє грати звуки.
      sound.click();
      haptic('light');
      const created = createGame(names, rulesOf(settings));
      setState(created);
      setScreen('game');
      setResult(null);
      setEvents([]);
      setDeltas({});
      saveGame(created);
      setHasSave(true);
      const player = created.players[0];
      if (player) setHandoff({ name: player.name, color: player.color, label: 'Починає гру' });
    },
    [settings],
  );

  /** Зміна налаштувань: правила одразу діють і на поточну партію. */
  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      const next = sanitizeSettings({ ...settings, ...patch });
      saveSettings(next);
      setSettings(next);
      setState((previous) => (previous ? { ...previous, rules: rulesOf(next) } : previous));
    },
    [settings],
  );

  const resume = useCallback(() => {
    sound.click();
    haptic('light');
    const saved = loadGame();
    if (!saved) {
      setHasSave(false);
      return;
    }
    setState(saved);
    setScreen('game');
    setResult(null);
    setEvents([]);
    setDeltas({});
  }, []);

  const toStart = useCallback(() => {
    setState(null);
    setScreen('start');
    setResult(null);
    setHandoff(null);
    setEvents([]);
    setDeltas({});
    setHasSave(hasSavedGame());
  }, []);

  const reset = useCallback(() => {
    clearSave();
    toStart();
    setHasSave(false);
  }, [toStart]);

  const roll = useCallback(() => {
    const current = stateRef.current;
    if (!current || rollingRef.current || current.rolled || current.over || pendingRef.current) return;

    rollingRef.current = true;
    setRolling(true);
    const faces = rollDice(Math.random, current.rules.dicePreset);
    setRollTarget(faces);
    setResult(null);
    sound.roll();
    // Дріб іде під час усього кидка — його акцент падає саме на результат.
    sound.drum();
    haptic('light');

    // Результат рахуємо ОДРАЗУ (рушій чистий), але стан не чіпаємо: спершу
    // гравець бачить кубики по центру, потім карту — і лише на «Ок, далі»
    // тварини рушають на полі.
    const outcome = resolveRoll(current, faces);
    pendingRef.current = outcome;

    later(ROLL_DURATION, () => {
      setRolling(false);
      rollingRef.current = false;
      if (outcome.tone === 'bad') {
        sound.raid();
        haptic('heavy');
      } else if (outcome.tone === 'good') {
        sound.born();
      }

      later(RESULT_DELAY, () => {
        setResult({ title: titleFor(outcome), tone: outcome.tone, dice: faces, events: outcome.events });
      });
    });
  }, [later]);

  /**
   * «Ок, далі» — саме тут результат потрапляє у гру: застосовуємо стан, події
   * й дельти, тому анімації на полі (прибуття тварин, набіг хижака, «+N/−N»)
   * починаються після натискання, а не під час кидка.
   */
  const dismissResult = useCallback(() => {
    const outcome = pendingRef.current;
    pendingRef.current = null;
    if (outcome) {
      setState(outcome.state);
      setEvents(outcome.events);
      flashDeltas(outcome.deltas);
      if (outcome.won) setHasSave(false);
    }
    setResult(null);
  }, [flashDeltas]);

  const endTurn = useCallback(() => {
    const current = stateRef.current;
    if (!current || !current.rolled || current.over || pendingRef.current) return;

    sound.click();
    haptic('light');
    const next = endTurnPure(current);
    setState(next);
    setEvents([]);
    setDeltas({});

    const player = next.players[next.current];
    if (player) setHandoff({ name: player.name, color: player.color, label: 'Передай пристрій гравцю' });
  }, []);

  const trade = useCallback(
    (option: TradeOption) => {
      const current = stateRef.current;
      if (!current) return;

      const outcome = applyTrade(current, option);
      setState(outcome.state);
      setEvents(outcome.events);
      flashDeltas(outcome.deltas);
      sound.coin();
      haptic('medium');
      setToast('🔁 Обмін виконано!');
      later(TOAST_LIFETIME, () => setToast(null));

      if (outcome.won) {
        setHasSave(false);
        later(700, () => {
          setResult({ title: '🏆 Перемога!', tone: 'good', dice: null, events: outcome.events });
        });
      }
    },
    [flashDeltas, later],
  );

  const trades = useMemo(() => (state ? availableTrades(state) : []), [state]);

  /**
   * Показати набіг хижака на замовлення — для перевірки анімації.
   *
   * У справжній партії лисиця випадає приблизно раз на шість ходів і лише
   * якщо є кого красти, тому побачити її можна не завжди. Ця дія малює той
   * самий набір подій на полі, але НЕ чіпає стан партії: жодна тварина не
   * зникає, лічильники не змінюються.
   */
  const previewRaid = useCallback(
    (kind: 'fox' | 'bear') => {
      const meta = PREDATORS[kind];
      const subject = meta.steals[0];
      if (!subject) return;
      setDeltas({ [subject]: -1 });
      setEvents([
        {
          kind: 'loss',
          emoji: meta.emoji,
          subject,
          raider: kind,
          delta: -1,
          farmAfter: stateRef.current?.players[stateRef.current.current].farm[subject] ?? 0,
          herdAfter: stateRef.current?.herd[subject] ?? 0,
          text: `Перевірка анімації: ${meta.label.toLowerCase()} ${meta.raidVerb}`,
          detail: 'Це показ — у партії нічого не змінилось.',
        },
      ]);
      setDeltaKey((value) => value + 1);
      sound.play('raid');
      haptic('heavy');
      later(DELTA_LIFETIME, () => {
        setEvents([]);
        setDeltas({});
      });
    },
    [later],
  );

  return {
    screen,
    state,
    rolling,
    rollTarget,
    result,
    handoff,
    events,
    deltas,
    deltaKey,
    toast,
    trades,
    tradesDone: state?.trades ?? 0,
    tradesLeft: state ? tradesLeft(state) : null,
    canTrade: state ? canTrade(state) : false,
    settings,
    hasSave,
    muted: !settings.sound,
    start,
    resume,
    toStart,
    roll,
    endTurn,
    trade,
    dismissResult,
    previewRaid,
    closeHandoff: () => setHandoff(null),
    toggleSound: () => updateSettings({ sound: !settings.sound }),
    updateSettings,
    resetSettings: () => updateSettings(DEFAULT_SETTINGS),
    reset,
  };
}
