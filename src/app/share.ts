/**
 * «ПОДІЛИТИСЯ» — маленький шар між UI і системним меню.
 *
 * Правила:
 *  1. На телефоні картку віддаємо ФАЙЛОМ у рідне меню «Поділитися» (Web Share
 *     з files). Саме там люди обирають чат, і саме так картка потрапляє до
 *     друзів, які ще не грали.
 *  2. Якщо файли не підтримуються (десктопний Chrome, старі браузери) —
 *     завантажуємо PNG і кладемо текст у буфер обміну. Гра не має відмовити.
 *  3. Скасування користувачем — не помилка: повертаємо 'canceled' мовчки.
 */
import type { SharePayload } from '../ui/lib/shareCard';
import { SHARE_LINK, downloadBlob, renderShareCard, shareText } from '../ui/lib/shareCard';

export type ShareOutcome = 'shared' | 'downloaded' | 'copied' | 'canceled' | 'failed';

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-zа-яіїєґ0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'гра';

/** Чи взагалі є сенс показувати «Поділитися» (нативне меню або файл). */
export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Картка результату → системне меню (файл + текст), з фолбеком
 * «завантажити PNG і скопіювати підпис».
 */
export async function shareResultCard(payload: SharePayload): Promise<ShareOutcome> {
  const winner = payload.players[payload.winnerIndex]?.name ?? 'переможець';
  const filename = `lux-ferma-${slug(winner)}.png`;
  const text = shareText(payload);

  let file: File | null = null;
  try {
    const blob = await renderShareCard(payload);
    file = new File([blob], filename, { type: 'image/png' });

    const shareData: ShareData = {
      files: [file],
      title: `Люкс Ферма — переміг ${winner}`,
      text,
    };

    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share(shareData);
        return 'shared';
      } catch (error) {
        // AbortError = людина передумала: це не привід лякати її помилкою.
        if (error instanceof DOMException && error.name === 'AbortError') return 'canceled';
        if (error instanceof Error && error.name === 'AbortError') return 'canceled';
      }
    }

    downloadBlob(blob, filename);
    return (await copyText(text)) ? 'copied' : 'downloaded';
  } catch {
    return 'failed';
  }
}

/** Поділитися самою грою (з вітрини): посилання + короткий підпис. */
export async function shareGame(): Promise<ShareOutcome> {
  const text = `Граємо в «Люкс Ферма» — помічник для настільної гри на одному телефоні. Кубики, тварини, хижаки й обмін: ${SHARE_LINK}`;

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Люкс Ферма', text, url: SHARE_LINK });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'canceled';
      if (error instanceof Error && error.name === 'AbortError') return 'canceled';
    }
  }

  return (await copyText(text)) ? 'copied' : 'failed';
}
