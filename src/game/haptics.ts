/**
 * Тактильний відгук.
 *
 * Три шляхи, у порядку надійності:
 *  1) Нативний застосунок (Capacitor) — справжній Haptics, найкраща якість.
 *  2) iOS Safari/PWA — navigator.vibrate там НЕ існує (обмеження WebKit),
 *     тому використовуємо трюк зі AudioContext: короткий «клік» на низькій
 *     частоті змушує iOS дати тактильний відгук через системний вібромотор.
 *     Працює лише коли в системних налаштуваннях увімкнено «Вібрувати при
 *     дзвінках», і потребує попереднього user gesture (тому ctx створюємо
 *     на першому дотику й тримаємо розімкненим).
 *  3) Android/Chrome — navigator.vibrate.
 *
 * Якщо жоден шлях недоступний — повертаємо false, щоб UI міг чесно сказати
 * гравцеві, що вібрації на цьому пристрої немає.
 */
import { Capacitor } from '@capacitor/core';

export type HapticStrength = 'light' | 'medium' | 'heavy';

/** Глобальний перемикач тактильного відгуку (керується з налаштувань). */
export const haptics = { enabled: true };

/** Чи пристрій узагалі здатен дати вібрацію (для чесного підпису в UI). */
export function hapticsSupported(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') return true;
  if (typeof navigator === 'undefined') return false;
  // iOS: єдиний доступний шлях — AudioContext-трюк. Перевіряємо, що він існує.
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document);
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return isIos && typeof Ctor === 'function';
}

/* ── 2. iOS: тактильний відгук через AudioContext ───────────────────────── */

let audioCtx: AudioContext | null = null;

/**
 * Створює AudioContext на першому дотику. Без цього iOS блокує будь-який
 * звук/вібро-трюк: контекст мусить народитися в межах user gesture.
 */
export function primeHapticsAudio(): void {
  if (audioCtx) return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    audioCtx = new Ctor();
    // Дуже короткий «порожній» пульс, щоб iOS вважав контекст розпочатим.
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

/** Сила відгуку → тривалість і частота (мс, Гц). */
const IOS_TAP: Record<HapticStrength, { ms: number; hz: number; gain: number }> = {
  light: { ms: 8, hz: 180, gain: 0.9 },
  medium: { ms: 14, hz: 150, gain: 1 },
  heavy: { ms: 26, hz: 120, gain: 1 },
};

/** Тактильний відгук на iOS: низькочастотний імпульс, який «стукає» мотором. */
function iosHaptic(strength: HapticStrength): boolean {
  primeHapticsAudio();
  if (!audioCtx) return false;
  const { ms, hz, gain } = IOS_TAP[strength];
  try {
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz;
    amp.gain.value = gain;
    osc.connect(amp);
    amp.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    osc.start(now);
    osc.stop(now + ms / 1000);
    // Половина пристроїв реагує лише на різку огинаючу — тримаємо «клац».
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + ms / 1000);
    return true;
  } catch {
    return false;
  }
}

/* ── Публічний API ──────────────────────────────────────────────────────── */

export function haptic(strength: HapticStrength = 'light'): void {
  if (!haptics.enabled) return;

  if (Capacitor.isNativePlatform()) {
    void import('@capacitor/haptics')
      .then(({ Haptics, ImpactStyle }) => {
        const style =
          strength === 'heavy'
            ? ImpactStyle.Heavy
            : strength === 'medium'
              ? ImpactStyle.Medium
              : ImpactStyle.Light;
        return Haptics.impact({ style });
      })
      .catch(() => undefined);
    return;
  }

  // Android і все, що підтримує стандартний API.
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      const ok = navigator.vibrate(strength === 'heavy' ? 45 : strength === 'medium' ? 25 : 12);
      if (ok) return;
    } catch {
      /* ігноруємо й пробуємо iOS-шлях */
    }
  }

  // iOS — через AudioContext.
  iosHaptic(strength);
}

/** Короткий відгук на дотик + клік — типове підтвердження дії. */
export function tapFeedback(strength: HapticStrength = 'light'): void {
  haptic(strength);
}

/**
 * Пробний відгук для екрана налаштувань: гравець тисне «перевірити» і
 * відчуває, чи працює вібрація саме на його пристрої.
 */
export function testHaptic(): boolean {
  const before = haptics.enabled;
  haptics.enabled = true;
  haptic('heavy');
  haptics.enabled = before;
  return hapticsSupported();
}
