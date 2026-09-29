import { useEffect, useRef } from 'react';

/**
 * Ставить змінні ходи для кожної ділянки тварин:
 *   `--dx`      — дистанція «туди-сюди» в пікселях (ширина ділянки мінус тварина);
 *   `--lane-px` — висота однієї доріжки, щоб тварини одного двору йшли різними
 *                 смугами й не накладались одна на одну.
 *
 * Чому не CSS: потрібно «ширина ділянки мінус розмір тварини», тобто `100%`
 * з однієї осі мінус `em`. У `translate3d` браузер такий `calc` не розв'язує
 * (відсотки беруться з ширини елемента, а em — зі шрифту, і змішувати їх між
 * осями не можна) — у змінну потрапляє сирий calc, і рух стає нульовим.
 * Тому міряємо обидві величини в браузері й пишемо готові числа.
 *
 * Доріжки рахуються у ПІКСЕЛЯХ: у відсотках від розміру тварини (35 px) крок
 * у третину двору давав стрибок на тисячі пікселів — тварина вилітала за межі.
 * Розмір беремо НАЙБІЛЬШОЇ тварини двору, бо маленькі можуть ще не мати
 * виміряної ширини (0) у першому кадрі.
 */
export function useWalkDistance() {
  const refs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const update = (tokens: HTMLSpanElement) => {
      const slots = [...tokens.querySelectorAll<HTMLElement>('[class*="slot"]')];
      const box = tokens.getBoundingClientRect();
      if (!box.width || slots.length === 0) return;

      const sizes = slots.map((slot) => slot.getBoundingClientRect().width).filter((value) => value > 0);
      const biggest = sizes.length ? Math.max(...sizes) : 0;
      const distance = Math.max(box.width * 0.12, box.width - biggest);
      // Три доріжки на двір: тварина №0 — верхня, №1 — середня, №2 — нижня.
      const lane = Math.max(4, (box.height - biggest) / 3);

      tokens.style.setProperty('--dx', `${distance.toFixed(1)}px`);
      tokens.style.setProperty('--lane-px', `${lane.toFixed(1)}px`);
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) update(entry.target as HTMLSpanElement);
    });
    for (const element of refs.current) {
      if (!element) continue;
      update(element);
      observer.observe(element);
    }
    const refresh = () => refs.current.forEach((element) => element && update(element));
    void document.fonts?.ready.then(refresh).catch(() => undefined);

    return () => observer.disconnect();
  }, []);

  /**
   * Повертає функцію-реф для загону за індексом. Стабільна між рендерами,
   * тому React не перемонтовує вузли, але завжди вказує на актуальний елемент.
   */
  return (position: number) => (element: HTMLSpanElement | null) => {
    refs.current[position] = element;
  };
}
