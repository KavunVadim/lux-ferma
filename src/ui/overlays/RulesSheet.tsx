import { ANIMALS, DICE_PRESETS, PREDATORS, TRADE_LADDER } from '../../game/config';
import type { DiceFace } from '../../game/types';
import { Button } from '../components/Button';
import { Overlay } from './Overlay';
import styles from './Overlays.module.css';

interface RulesSheetProps {
  onClose: () => void;
  /** Поточні правила партії — щоб текст обміну та кубиків був актуальним. */
  tradesPerTurn?: number | null;
  dicePreset?: keyof typeof DICE_PRESETS;
}

interface CountedFace {
  face: DiceFace;
  count: number;
  percent: string;
}

function countFaces(table: readonly DiceFace[]): CountedFace[] {
  const seen = new Map<DiceFace, number>();
  for (const face of table) seen.set(face, (seen.get(face) ?? 0) + 1);
  return [...seen.entries()]
    .map(([face, count]) => ({ face, count, percent: `${((count / table.length) * 100).toFixed(1)}%` }))
    .sort((a, b) => b.count - a.count);
}

const faceEmoji = (face: DiceFace): string =>
  face === 'fox' ? PREDATORS.fox.emoji : face === 'bear' ? PREDATORS.bear.emoji : ANIMALS[face].emoji;

/** Повні правила гри — той самий текст, що на настільній коробці. */
export function RulesSheet({ onClose, tradesPerTurn = null, dicePreset = 'classic' }: RulesSheetProps) {
  const preset = DICE_PRESETS[dicePreset];
  return (
    <Overlay variant="sheet" onClose={onClose} label="Правила гри">
      <div className="sheet">
        <div className="sheet__head">
          <h2>📖 Правила гри</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>

        <details className={styles.rule} open>
          <summary className={styles.ruleSummary}>🎯 Мета гри</summary>
          <p>
            Обмінюючи тварин та розводячи їх, першим збери на фермі хоча б по одній: качці 🦆, козі 🐐, свині 🐖, коню
            🐎 і корові 🐄. Лисиця та ведмідь заважатимуть — крастимуть тварин!
          </p>
          <p>Для швидкого старту кожен гравець одразу отримує 1 качку.</p>
        </details>

        <details className={styles.rule}>
          <summary className={styles.ruleSummary}>🔄 Хід гравця</summary>
          <p>1. За бажанням зроби обміни — скільки потрібно (тільки до кидка).</p>
          <p>2. Кинь кубики — гра сама порахує розмноження та напади хижаків.</p>
          <p>3. Натисни «Завершити хід» — пристрій передається далі.</p>
        </details>

        <details className={styles.rule}>
          <summary className={styles.ruleSummary}>🎲 Кубики та шанси</summary>
          <p>🟦 Перший кубик</p>
          <div className={styles.chances}>
            {countFaces(preset.one).map((item) => (
              <span key={item.face} className={styles.chance}>
                {faceEmoji(item.face)} {item.count} · {item.percent}
              </span>
            ))}
          </div>
          <p>🟧 Другий кубик</p>
          <div className={styles.chances}>
            {countFaces(preset.two).map((item) => (
              <span key={item.face} className={styles.chance}>
                {faceEmoji(item.face)} {item.count} · {item.percent}
              </span>
            ))}
          </div>
          <p>{preset.label}: {preset.hint}.</p>
          <p>Корова випадає лише на першому кубику, кінь — лише на другому. Ведмідь — на першому, лисиця — на другому.</p>
        </details>

        <details className={styles.rule}>
          <summary className={styles.ruleSummary}>🐣 Розмноження</summary>
          <p>
            Кожен вид, що випав хоча б на одному кубику, розмножується: береш зі стада стільки тварин, скільки повних
            пар вийде з (тварини на фермі + кількість кубиків з цим видом).
          </p>
          <p className={styles.example}>
            <b>Приклад:</b> маєш 3 качки, випала 1 качка → 3+1=4 → 2 пари → береш 2 качки, стає 5. Види, яких на кубиках
            не було, не розмножуються. Двох собак розводять лише через обмін.
          </p>
        </details>

        <details className={styles.rule}>
          <summary className={styles.ruleSummary}>🦊🐻 Хижаки та собаки</summary>
          <p>
            <b>🦊 Лисиця</b> — забирає у стадо ВСІХ твоїх качок і кіз.
          </p>
          <p>
            <b>🐻 Ведмідь</b> — забирає ВСІХ твоїх свиней і коней.
          </p>
          <p>
            Корову хижаки не чіпають. Малий пес 🐕 захищає від лисиці, великий 🐕‍🦺 — від ведмедя: тоді в стадо
            повертається тільки пес, а тварини лишаються. Інший кубик рахується як звичайно.
          </p>
        </details>

        <details className={styles.rule}>
          <summary className={styles.ruleSummary}>🔁 Таблиця обміну</summary>
          <div className={styles.ladder}>
            {TRADE_LADDER.map((row) => (
              <div key={`${row.a[0]}-${row.b[0]}`} className={styles.ladderItem}>
                {ANIMALS[row.a[0]].emoji}×{row.a[1]} = {ANIMALS[row.b[0]].emoji}×{row.b[1]}
              </div>
            ))}
          </div>
          <p>
            Обмін працює в обидва боки й лише перед кидком кубиків.{' '}
            {tradesPerTurn === null
              ? 'За хід можна зробити скільки завгодно обмінів — зручно, коли накопичилось багато тварин.'
              : `За хід — не більше ${tradesPerTurn} ${tradesPerTurn === 1 ? 'обміну' : 'обмінів'}.`}{' '}
            З іншим гравцем можна домовитись на будь-яких умовах усно. Два останні рядки (собаки) — орієнтовні.
          </p>
        </details>

        <details className={styles.rule}>
          <summary className={styles.ruleSummary}>🏆 Кінець гри</summary>
          <p>Перемагає той, хто першим матиме на фермі по одній тварині кожного з 5 видів.</p>
        </details>

        <Button variant="gold" block onClick={onClose}>
          Зрозуміло, граємо!
        </Button>
      </div>
    </Overlay>
  );
}
