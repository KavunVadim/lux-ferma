/**
 * Звук гри — синтезовані сигнали через Web Audio (жодних mp3 у бандлі).
 * Працює і на вебі, і в Capacitor WebView.
 *
 * Кожен сигнал має ідентифікатор (`SoundEffect`), тож у налаштуваннях можна
 * вимкнути окремі звуки — а не лише весь звук цілком.
 */
type BeepType = 'sine' | 'square' | 'triangle' | 'sawtooth';

/** Ідентифікатори сигналів, які можна вмикати/вимикати окремо. */
export type SoundEffect = 'click' | 'roll' | 'born' | 'raid' | 'coin' | 'win' | 'drum';

export const ALL_EFFECTS: readonly SoundEffect[] = [
  'click',
  'roll',
  'drum',
  'born',
  'raid',
  'coin',
  'win',
];

export interface SoundConfig {
  muted: boolean;
  /** 0..1 */
  volume: number;
  effects: Record<SoundEffect, boolean>;
}

const MUTE_KEY = 'lux-ferma:muted';

const defaultEffects = (): Record<SoundEffect, boolean> => ({
  click: true,
  roll: true,
  drum: true,
  born: true,
  raid: true,
  coin: true,
  win: true,
});

class SoundEngine {
  private ctx: AudioContext | null = null;
  private mutedFlag = false;
  private volumeFlag = 1;
  private effectsFlag = defaultEffects();
  private listeners = new Set<(muted: boolean) => void>();
  /** Заплановані удари дробу — щоб можна було обірвати, якщо хід скасували. */
  private scheduled: number[] = [];

  constructor() {
    try {
      this.mutedFlag = window.localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.mutedFlag = false;
    }
  }

  get muted(): boolean {
    return this.mutedFlag;
  }

  get volume(): number {
    return this.volumeFlag;
  }

  get effects(): Record<SoundEffect, boolean> {
    return { ...this.effectsFlag };
  }

  subscribe(listener: (muted: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Застосовує налаштування звуку одним викликом. */
  configure(config: Partial<SoundConfig>): void {
    if (typeof config.muted === 'boolean') this.setMuted(config.muted);
    if (typeof config.volume === 'number') this.setVolume(config.volume);
    if (config.effects) this.effectsFlag = { ...this.effectsFlag, ...config.effects };
  }

  setMuted(value: boolean): void {
    this.mutedFlag = value;
    try {
      window.localStorage.setItem(MUTE_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
    this.listeners.forEach((listener) => listener(value));
  }

  /** Гучність 0..1 (множиться на гучність кожного сигналу). */
  setVolume(value: number): void {
    this.volumeFlag = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
  }

  /** Вмикає/вимикає окремий сигнал (і одразу дає почути, як він звучить). */
  setEffect(effect: SoundEffect, enabled: boolean): void {
    this.effectsFlag = { ...this.effectsFlag, [effect]: enabled };
    if (enabled) this.play(effect);
  }

  toggle(): boolean {
    this.setMuted(!this.mutedFlag);
    if (!this.mutedFlag) this.play('click');
    return this.mutedFlag;
  }

  private context(): AudioContext | null {
    if (this.mutedFlag) return null;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private beep(freq: number, duration: number, type: BeepType = 'sine', volume = 0.15, slide = 0): void {
    const ctx = this.context();
    if (!ctx) return;
    const level = volume * this.volumeFlag;
    if (level <= 0.002) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slide) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(level, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      /* не критично */
    }
  }

  /*────────────────────────── самі сигнали ──────────────────────────*/

  click(): void {
    this.play('click');
  }

  roll(): void {
    this.play('roll');
  }

  born(): void {
    this.play('born');
  }

  raid(): void {
    this.play('raid');
  }

  /** Барабанний дріб перед результатом — «усі затамували подих». */
  drum(): void {
    this.play('drum');
  }

  coin(): void {
    this.play('coin');
  }

  win(): void {
    this.play('win');
  }

  /** Програє сигнал, якщо він увімкнений у налаштуваннях. */
  play(effect: SoundEffect): void {
    if (this.mutedFlag || !this.effectsFlag[effect]) return;
    switch (effect) {
      case 'click':
        this.beep(660, 0.07, 'triangle', 0.12);
        break;
      case 'roll':
        for (let i = 0; i < 6; i += 1) {
          window.setTimeout(() => this.beep(170 + Math.random() * 150, 0.05, 'square', 0.07), i * 70);
        }
        break;
      case 'born':
        this.beep(520, 0.13, 'sine', 0.18, 420);
        break;
      case 'raid':
        this.beep(230, 0.4, 'sawtooth', 0.15, -150);
        window.setTimeout(() => this.beep(165, 0.5, 'sawtooth', 0.13, -95), 130);
        break;
      case 'coin':
        this.beep(880, 0.08, 'square', 0.09);
        window.setTimeout(() => this.beep(1320, 0.1, 'square', 0.09), 90);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((freq, index) => {
          window.setTimeout(() => this.beep(freq, 0.28, 'triangle', 0.16), index * 160);
        });
        break;
      /* Барабанний дріб: удари прискорюються, у кінці — акцент. */
      case 'drum': {
        const hits = 14;
        let at = 0;
        for (let i = 0; i < hits; i += 1) {
          const ratio = i / hits;
          const gap = 150 - ratio * 105; // 150 мс → 45 мс: прискорення
          const id = window.setTimeout(
            () => this.beep(120 + ratio * 70, 0.05, 'square', 0.05 + ratio * 0.03),
            at,
          );
          this.scheduled.push(id);
          at += gap;
        }
        this.scheduled.push(
          window.setTimeout(() => {
            this.beep(880, 0.16, 'triangle', 0.14);
            window.setTimeout(() => this.beep(1320, 0.3, 'triangle', 0.13), 110);
          }, at + 30),
        );
        break;
      }
    }
  }
}

export const sound = new SoundEngine();
