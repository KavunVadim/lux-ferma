/**
 * Нативні дрібниці, які мають сенс лише в Capacitor (iOS/Android):
 * статус-бар і апаратна кнопка «Назад». На вебі всі функції — no-op.
 */
import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();

export async function initStatusBar(): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // Світлий фон застосунку → темний текст у статус-барі.
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* плагін недоступний — не критично */
  }
}

/**
 * Апаратна «Назад» на Android: виходимо з партії на стартовий екран,
 * а якщо вже там — віддаємо подію системі (застосунок згортається).
 * Повертає функцію відписки.
 */
export async function bindBackButton(onBack: () => boolean): Promise<() => void> {
  if (!isNative()) return () => undefined;
  try {
    const { App } = await import('@capacitor/app');
    const handle = await App.addListener('backButton', ({ canGoBack }) => {
      const handled = onBack();
      if (!handled && !canGoBack) void App.exitApp();
    });
    return () => {
      void handle.remove();
    };
  } catch {
    return () => undefined;
  }
}
