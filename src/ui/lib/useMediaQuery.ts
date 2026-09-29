import { useSyncExternalStore } from 'react';

/**
 * Медіазапит як React-стан.
 *
 * Потрібен, щоб ПК-версія (ігрове поле з ділянками) і мобільна (список дворів)
 * були різними деревами, а не однією версткою з CSS-хованням: на телефоні
 * спрайти тварин і дзеркальні ділянки не потрібні зовсім.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (listener: () => void): (() => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const list = window.matchMedia(query);
    list.addEventListener('change', listener);
    return () => list.removeEventListener('change', listener);
  };

  const getSnapshot = (): boolean =>
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches;

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
