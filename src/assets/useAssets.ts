/**
 * Попереднє завантаження спрайтів із підпискою для React.
 *
 * UI не блокується: поки спрайт не готовий, компоненти показують емодзі-фолбек.
 * Підписка зроблена через useSyncExternalStore — це рекомендований спосіб
 * синхронізувати React із зовнішнім станом без зайвих ре-рендерів.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { ALL_SPRITE_URLS } from './manifest';

export interface AssetsState {
  /** url → чи завантажився спрайт. */
  available: Record<string, boolean>;
  /** 0..1 */
  progress: number;
  ready: boolean;
}

let state: AssetsState = { available: {}, progress: 0, ready: false };
let started = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): AssetsState => state;

export function preloadAssets(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const urls = ALL_SPRITE_URLS;
  console.log(`[assets] попереднє завантаження: ${urls.length} файлів`);
  if (urls.length === 0) {
    state = { available: {}, progress: 1, ready: true };
    listeners.forEach((listener) => listener());
    return;
  }

  let done = 0;
  const available: Record<string, boolean> = {};

  const settle = (url: string, ok: boolean) => {
    available[url] = ok;
    done += 1;
    state = { available, progress: done / urls.length, ready: done === urls.length };
    listeners.forEach((listener) => listener());
  };

  urls.forEach((url) => {
    const image = new Image();
    image.onload = () => settle(url, true);
    image.onerror = () => settle(url, false);
    image.src = url;
  });
}

export function useAssets(): AssetsState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    preloadAssets();
  }, []);

  return snapshot;
}
