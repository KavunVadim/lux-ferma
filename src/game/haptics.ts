/**
 * Тактильний відгук. На телефоні (Capacitor) — нативний Haptics,
 * у браузері — navigator.vibrate, якщо підтримується.
 *
 * Модуль @capacitor/haptics підвантажується динамічно, щоб не тягнути
 * нативний код у веб-бандл.
 */
import { Capacitor } from '@capacitor/core';

export type HapticStrength = 'light' | 'medium' | 'heavy';

/** Глобальний перемикач тактильного відгуку (керується з налаштувань). */
export const haptics = { enabled: true };

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

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(strength === 'heavy' ? 45 : strength === 'medium' ? 25 : 12);
  }
}

/** Короткий відгук на дотик + клік — типове підтвердження дії. */
export function tapFeedback(strength: HapticStrength = 'light'): void {
  haptic(strength);
}
