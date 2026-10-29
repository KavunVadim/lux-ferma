import { useCallback, useEffect, useState } from 'react';
import styles from './InstallBanner.module.css';

/**
 * «ВСТАНОВИТИ ГРУ» — підказка на екран Домівки.
 *
 * Гру відкривають з чату, грають вечір і… закривають. Якщо вона стоїть
 * іконкою на телефоні, наступного разу її відкривають без посилання й
 * без інтернету — тобто нею користуються частіше. Тому підказка з'являється
 * на СТАРТОВОМУ екрані (не поверх партії) і лише один раз: набридлива
 * реклама власного застосунку — це теж поганий досвід.
 *
 * Android/десктоп: скористаємось `beforeinstallprompt` (справжня системна
 * кнопка). iOS такого API не має — там показуємо коротку інструкцію Safari.
 */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const KEY = 'lux-ferma:install-hint';

const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return true;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios || window.matchMedia('(display-mode: standalone)').matches;
};

const isIos = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

const wasDismissed = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

interface InstallBannerProps {
  /** Повідомляє екран, що підказка видима — щоб той лишив місце під неї. */
  onVisible?: (visible: boolean) => void;
}

export function InstallBanner({ onVisible }: InstallBannerProps) {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;

    const onPrompt = (raw: Event) => {
      raw.preventDefault();
      setEvent(raw as InstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // iOS не кидає beforeinstallprompt — показуємо підказку самі.
    const timer = isIos() ? window.setTimeout(() => setIosHint(true), 900) : 0;

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setIosHint(false);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* приватний режим — просто ховаємо на цю сесію */
    }
  }, []);

  useEffect(() => {
    onVisible?.(visible || iosHint);
  }, [visible, iosHint, onVisible]);

  const install = useCallback(async () => {
    if (!event) return;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') dismiss();
    } catch {
      dismiss();
    }
  }, [event, dismiss]);

  if (!visible && !iosHint) return null;

  return (
    <div className={styles.wrap} role="complementary" aria-label="Встановлення застосунку">
      <div className={styles.card}>
        <span className={styles.icon} aria-hidden>
          📲
        </span>
        <span className={styles.text}>
          <b>Встановити гру на телефон</b>
          <i>
            {iosHint
              ? 'Safari → «Поділитися» → «На екран «Домівки»»'
              : 'Іконка на Домівці — і гра без інтернету'}
          </i>
        </span>
        {!iosHint && (
          <button type="button" className={styles.action} onClick={() => void install()}>
            Додати
          </button>
        )}
        <button type="button" className={styles.close} onClick={dismiss} aria-label="Не зараз">
          ✕
        </button>
      </div>
    </div>
  );
}
