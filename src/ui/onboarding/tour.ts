/**
 * ПІДКАЗКИ ПЕРШОГО ХОДУ.
 *
 * Новачок сідає за стіл, бачить екран передачі, кубики й лоток дій — і не знає,
 * що «Ок, далі» та «Завершити хід» це різні кроки. Тому першу партію гра
 * проводить за руку: підсвічує головну кнопку й одним рядком пояснює, що буде.
 *
 * Правила цієї підказки:
 *   · показуємо ЛИШЕ раз у житті пристрою (localStorage), далі — тиша;
 *   · вона нічого не блокує: підсвітка не перехоплює кліки, грати можна одразу;
 *   · зникає сама, щойно гравець зробив крок (кинув кубики / завершив хід);
 *   · «✕» — вимкнути назавжди.
 */
const KEY = 'lux-ferma:tour-done';

export type TourStep = 'roll' | 'end';

export function isTourDone(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    // Приватний режим: краще не показувати підказку, ніж показувати її щоразу.
    return true;
  }
}

export function finishTour(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Подія «покажи підказки ще раз» — ловить ігровий екран. */
export const TOUR_EVENT = 'lux-ferma:tour';

/** «Налаштування → Показати підказки знову»: скидає прапорець і просить екран показати тур. */
export function resetTour(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(TOUR_EVENT));
}

export const TOUR_TEXT: Record<TourStep, { step: string; title: string; text: string }> = {
  roll: {
    step: 'Крок 1 з 2',
    title: 'Кинь кубики',
    text: 'Результат покаже, що сталося у дворі: тварини народились, хижак напав або все спокійно.',
  },
  end: {
    step: 'Крок 2 з 2',
    title: 'Заверши хід',
    text: 'Далі передай телефон наступному гравцю — він почне зі свого двору.',
  },
};
