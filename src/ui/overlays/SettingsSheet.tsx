import { DICE_PRESETS, PREDATOR_MODES, TRADE_LIMIT_OPTIONS } from '../../game/config';
import type { DicePreset, PredatorMode } from '../../game/config';
import { ALL_EFFECTS, sound } from '../../game/sound';
import { BALANCE_PRESETS, EFFECT_LABELS } from '../../game/settings';
import type { AppSettings, ThemeMode } from '../../game/settings';
import { cn } from '../../lib/cn';
import { Button } from '../components/Button';
import { Overlay } from './Overlay';
import styles from './Overlays.module.css';

interface SettingsSheetProps {
  settings: AppSettings;
  /** Партія вже триває — частина налаштувань діє лише з наступної. */
  inGame: boolean;
  onChange: (patch: Partial<AppSettings>) => void;
  onReset: () => void;
  /** Показати набіг хижака на полі (перевірка анімації). */
  onPreviewRaid: (kind: 'fox' | 'bear') => void;
  onClose: () => void;
}

interface Option<T> {
  value: T;
  label: string;
  hint: string;
}

/** Ймовірність нападу для набору кубиків — рахуємо з таблиць, не з тексту. */
function raidChance(preset: DicePreset): string {
  const table = DICE_PRESETS[preset];
  const bearShare = table.one.filter((face) => face === 'bear').length / table.one.length;
  const foxShare = table.two.filter((face) => face === 'fox').length / table.two.length;
  const chance = 1 - (1 - bearShare) * (1 - foxShare);
  return `${(chance * 100).toFixed(0)}% ходів`;
}

/** Рядок варіантів — один вибір із кількох. */
function OptionRow<T extends string | number | boolean | null>({
  title,
  hint,
  options,
  value,
  onSelect,
}: {
  title: string;
  hint?: string;
  options: readonly Option<T>[];
  value: T;
  onSelect: (value: T) => void;
}) {
  return (
    <section className={styles.settingGroup}>
      <header className={styles.settingHead}>
        <b>{title}</b>
        {hint && <span className={styles.groupHint}>{hint}</span>}
      </header>
      <div className={styles.optionGrid}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            className={cn(styles.option, option.value === value && styles.optionActive)}
            onClick={() => onSelect(option.value)}
            aria-pressed={option.value === value}
          >
            <b>{option.label}</b>
            <span>{option.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * Екран налаштувань: правила партії та звук/анімація.
 * Правила застосовуються одразу (навіть посеред партії); стартове стадо —
 * тільки для нових партій, бо воно роздається на старті.
 */
export function SettingsSheet({
  settings,
  inGame,
  onChange,
  onReset,
  onPreviewRaid,
  onClose,
}: SettingsSheetProps) {
  return (
    <Overlay variant="sheet" onClose={onClose} label="Налаштування">
      <div className="sheet">
        <div className="sheet__head">
          <h2>⚙️ Налаштування</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>

        <p className={styles.settingSummary}>
          Обміни: <b>{settings.tradesPerTurn === null ? 'без обмежень' : settings.tradesPerTurn}</b> · Хижаки:{' '}
          <b>{PREDATOR_MODES[settings.predatorMode].label.toLowerCase()}</b> · Кубики:{' '}
          <b>{DICE_PRESETS[settings.dicePreset].label.toLowerCase()}</b> · Напад:{' '}
          <b>{raidChance(settings.dicePreset)}</b>
        </p>

        <OptionRow<number | null>
          title="🔁 Обміни за хід"
          hint="скільки разів можна міняти тварин до кидка"
          options={TRADE_LIMIT_OPTIONS.map((option) => ({ ...option }))}
          value={settings.tradesPerTurn}
          onSelect={(value) => onChange({ tradesPerTurn: value })}
        />

        <OptionRow<PredatorMode>
          title="🦊🐻 Хижаки"
          hint="що роблять лисиця й ведмідь, коли випали"
          options={(Object.keys(PREDATOR_MODES) as PredatorMode[]).map((mode) => ({
            value: mode,
            label: PREDATOR_MODES[mode].label,
            hint: PREDATOR_MODES[mode].hint,
          }))}
          value={settings.predatorMode}
          onSelect={(value) => onChange({ predatorMode: value })}
        />

        <OptionRow<DicePreset>
          title="🎲 Кубики"
          hint="розподіл граней (замір: 200 000 кидків)"
          options={(Object.keys(DICE_PRESETS) as DicePreset[]).map((preset) => ({
            value: preset,
            label: DICE_PRESETS[preset].label,
            hint: `${DICE_PRESETS[preset].hint} · напад ${raidChance(preset)}`,
          }))}
          value={settings.dicePreset}
          onSelect={(value) => onChange({ dicePreset: value })}
        />

        <OptionRow<'classic' | 'compact'>
          title="🧺 Стартове стадо"
          hint={inGame ? 'діє з наступної партії' : 'скільки тварин у спільному стаді на старті'}
          options={BALANCE_PRESETS.map((preset) => ({
            value: preset.value,
            label: preset.label,
            hint: preset.hint,
          }))}
          value={settings.balance}
          onSelect={(value) => onChange({ balance: value })}
        />

        <section className={styles.settingGroup}>
          <header className={styles.settingHead}>
            <b>🔊 Звук</b>
            <span className={styles.groupHint}>{settings.sound ? 'увімкнено' : 'вимкнено'}</span>
          </header>
          <div className={styles.optionGrid}>
            <button
              type="button"
              className={cn(styles.option, settings.sound && styles.optionActive)}
              onClick={() => onChange({ sound: true })}
              aria-pressed={settings.sound}
            >
              <b>Увімкнути</b>
              <span>сигнали кидка, прибуття, нападів</span>
            </button>
            <button
              type="button"
              className={cn(styles.option, !settings.sound && styles.optionActive)}
              onClick={() => onChange({ sound: false })}
              aria-pressed={!settings.sound}
            >
              <b>Вимкнути</b>
              <span>тиха гра</span>
            </button>
          </div>

          <label className={styles.sliderRow}>
            <span>Гучність</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.volume * 100)}
              disabled={!settings.sound}
              onChange={(event) => onChange({ volume: Number(event.target.value) / 100 })}
              className={styles.slider}
            />
            <b>{Math.round(settings.volume * 100)}%</b>
          </label>

          <button
            type="button"
            className={styles.soundTest}
            disabled={!settings.sound}
            onClick={() => sound.play('win')}
          >
            🔔 Перевірити звук
            <span>
              {settings.sound
                ? 'натисни — має прозвучати коротка мелодія'
                : 'звук вимкнено — увімкни вище'}
            </span>
          </button>

          <div className={styles.effectGrid}>
            {ALL_EFFECTS.map((effect) => {
              const on = settings.effects[effect];
              return (
                <button
                  key={effect}
                  type="button"
                  className={cn(styles.effectChip, on && styles.effectOn)}
                  disabled={!settings.sound}
                  aria-pressed={on}
                  onClick={() => {
                    const next = !on;
                    onChange({ effects: { ...settings.effects, [effect]: next } });
                    // Дам почути, що вмикається (налаштування вже застосовані).
                    if (next) window.setTimeout(() => sound.play(effect), 0);
                  }}
                >
                  {on ? '🔔' : '🔕'} {EFFECT_LABELS[effect]}
                </button>
              );
            })}
          </div>
        </section>

        <OptionRow<boolean>
          title="📳 Вібрація"
          hint="тактильний відгук на телефоні"
          options={[
            { value: true, label: 'Увімкнено', hint: 'легкий відгук на дії' },
            { value: false, label: 'Вимкнено', hint: 'без вібрації' },
          ]}
          value={settings.vibration}
          onSelect={(value) => onChange({ vibration: value })}
        />

        <OptionRow<ThemeMode>
          title="🎨 Тема"
          hint="світла чи темна"
          options={[
            { value: 'system', label: 'Як у системі', hint: 'за налаштуваннями пристрою' },
            { value: 'light', label: 'Світла', hint: 'день на фермі' },
            { value: 'dark', label: 'Темна', hint: 'вечірня гра' },
          ]}
          value={settings.theme}
          onSelect={(value) => onChange({ theme: value })}
        />

        <OptionRow<boolean>
          title="🎬 Анімація кидка"
          hint="чи показувати хижаків, поки кубик крутиться"
          options={[
            { value: false, label: 'Спокійно', hint: 'хижак видно лише як результат' },
            { value: true, label: 'Як є', hint: 'крутити всі грані, включно з хижаками' },
          ]}
          value={settings.diceFlicker}
          onSelect={(value) => onChange({ diceFlicker: value })}
        />

        {inGame && (
          <section className={styles.settingGroup}>
            <header>
              <b>🎬 Перевірити анімації</b>
            </header>
            <p className={styles.settingHint}>
              У партії лисиця випадає приблизно раз на шість ходів і лише коли є кого красти, тому
              побачити її можна не завжди. Тут можна викликати набіг на замовлення — на полі, без
              впливу на партію: нічого не губиться, лічильники не змінюються.
            </p>
            <div className={styles.previewRow}>
              <button
                type="button"
                className={styles.soundTest}
                onClick={() => {
                  onPreviewRaid('fox');
                  onClose();
                }}
              >
                🦊 Показати набіг лисиці
                <span>краде качку або козу, тікає в ліс</span>
              </button>
              <button
                type="button"
                className={styles.soundTest}
                onClick={() => {
                  onPreviewRaid('bear');
                  onClose();
                }}
              >
                🐻 Показати набіг ведмедя
                <span>краде свиню або коня</span>
              </button>
            </div>
          </section>
        )}

        <div className={styles.settingsFooter}>
          <Button variant="ghost" small onClick={onReset}>
            Типові
          </Button>
          <Button variant="gold" onClick={onClose}>
            Готово
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
