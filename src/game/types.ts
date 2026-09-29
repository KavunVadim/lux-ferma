/** Доменні типи гри «Люкс Ферма». Ніяких залежностей від DOM чи React. */
import type { GameRules } from './settings';

/** Види, які приносять перемогу. */
export type Species = 'duck' | 'goat' | 'pig' | 'horse' | 'cow';

/** Собаки: малий захищає від лисиці, великий — від ведмедя. */
export type DogKind = 'sdog' | 'bdog';

/** Усе, що може стояти у дворі: п'ять видів + два собаки. */
export type HerdKey = Species | DogKind;

/** Грань кубика: тварина або хижак. */
export type DiceFace = Species | 'fox' | 'bear';

/** Двір одного гравця. */
export type Farm = Record<HerdKey, number>;

/** Спільне стадо — резерв, з якого всі беруть тварин. */
export type Herd = Record<HerdKey, number>;

export interface Player {
  id: string;
  name: string;
  /** Колір гравця (бейджі, рамки, HUD-картки). */
  color: string;
  avatar: string;
  farm: Farm;
}

export type EventKind =
  /** тварина народилась */
  | 'gain'
  /** хижак забрав тварин */
  | 'loss'
  /** пес відігнав хижака */
  | 'save'
  /** хижак приходив, але нічого не стався */
  | 'raid'
  /** інформаційна репліка (пари ще немає, нічого не змінилось) */
  | 'note';

export interface GameEvent {
  kind: EventKind;
  /** Емодзі для фолбеку й для логу. */
  emoji: string;
  /** Зона, до якої належить подія — її підсвічуємо на карті. */
  subject?: HerdKey;
  /** Хижак, який приходив — щоб показати його на карті. */
  raider?: 'fox' | 'bear';
  text: string;
  detail?: string;
  /** Зміна кількості у дворі (може бути 0 або відʼємна). */
  delta?: number;
  /** Скільки тварин цього виду стало у дворі після події. */
  farmAfter?: number;
  /** Скільки цього виду лишилось у спільному стаді. */
  herdAfter?: number;
  /** Скільки було у дворі та скільки випало на кубиках (для розрахунку пар). */
  counted?: { have: number; fromDice: number; pairs: number };
}

export interface LogEntry {
  id: number;
  /** Індекс гравця або -1 для системних записів. */
  playerIndex: number;
  emoji: string;
  text: string;
}

export interface GameState {
  schema: number;
  /** Правила, за якими грається саме ця партія (копія з налаштувань). */
  rules: GameRules;
  players: Player[];
  herd: Herd;
  /** Стартовий запас стада — щоб було видно, скільки витрачено. */
  herdStart: Herd;
  current: number;
  rolled: boolean;
  /** Скільки обмінів зроблено цього ходу. */
  trades: number;
  dice: [DiceFace, DiceFace] | null;
  log: LogEntry[];
  /** Останнє повідомлення для стрічки подій. */
  message: string;
  round: number;
  over: boolean;
  winnerIndex: number | null;
  logSeq: number;
}

export interface DiceRoll {
  faces: [DiceFace, DiceFace];
}

export interface RollOutcome {
  state: GameState;
  /** Події ходу — з них будується модалка результату. */
  events: GameEvent[];
  /** Зміни по кожній комірці двору (для анімації +N / −N). */
  deltas: Partial<Record<HerdKey, number>>;
  tone: 'good' | 'bad' | 'neutral';
  won: boolean;
}

export interface TradeOption {
  /** Стабільний id, щоб React мав ключі без індексів. */
  id: string;
  from: HerdKey;
  fromQty: number;
  to: HerdKey;
  toQty: number;
}
