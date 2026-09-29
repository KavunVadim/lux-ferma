# Бриф на ігрову карту «Люкс Ферма» (ПК-версія)

Документ для генерації арта (ChatGPT/DALL·E, Midjourney, Flux, Leonardo — байдуже).
Мета: замінити `public/assets/map.webp` так, щоб карта виглядала як концепт
(об'ємна, соковита, кінематографічна), але **не зламала розкладку загонів**.

## Технічні вимоги (обов'язково)

| Параметр | Значення | Чому |
| --- | --- | --- |
| Формат | WebP або PNG, без прозорості | фон карти |
| Співвідношення | **1664×928 (1.793)** або кратне йому (2048×1142, 3328×1856) | полотно поля тримає саме цю пропорцію; інша — з'їдеш по вертикалі |
| Ракурс | **3/4 зверху, як у концепті** (не справжня ізометрія 45°) | прямокутники загонів задані у відсотках під цей ракурс |
| Кількість загонів | **рівно 7**, усі видно одночасно, не перекриваються | 5 видів тварин + 2 будки собак |
| Текст, літери, цифри, UI, кубики, люди | **заборонено** | усі підписи малює гра (дерев'яні таблички) |
| Тварини | **не малювати** (ні качок, ні свиней) | тварини — окремі спрайти поверх карти |
| Вільні смуги | зверху ~7% висоти, знизу ~15% висоти — **без важливих деталей** | там лежить інтерфейс (чип ходу, вивіска, кнопки) |
| Стиль | об'ємний мультяшний 3D-рендер, тепле сонячне світло, насичені кольори, м'які тіні | як концепт |
| Фон поза фермою | пагорби, дерева по краях (вони й тримають рамку кадру) | закриває краї при масштабуванні |

## Що мусить бути в кадрі

1. **Ставок із качками** — великий, верхня ліва чверть; дерев'яний настил, латаття, очерет
   (качки НЕ намальовані, лише вода й настил).
2. **Козар** — верхня права чверть: суха трава, дерев'яний паркан, тінь під деревом.
3. **Свинарник** — ліва середина: багнюка, корито, червоний дах.
4. **Стайня** — права середина: зелений дах, рулони сіна, годівниця-жолоб.
5. **Коровник** — центр: великий хлів із сірим дахом і червоними дверима, стоги.
6. **Дві будки собак** — одна знизу ліворуч, друга знизу праворуч: маленька будка
   з червоним дахом і миска з водою, і більша будка-вівчарня.
7. **Обійстя фермера** — центральний будиночок із червоним черепичним дахом,
   квіти у вікнах (це «серце» композиції).

Між загонами: **ґрунтова доріжка**, що з'єднує все в одне ціле (як у концепті).
Праворуч — **річка з дерев'яним мостом**, ліворуч знизу — соняшники й клумби.

## Готовий промпт (копіювати як є)

```
Top-down 3/4 view illustration of a cozy cartoon farm layout for a board game, lush green
grass, warm sunny lighting, painterly 3D render style, rich saturated colors, soft shadows.
Layout: a duck pond with a wooden deck in the upper left; a goat paddock with dry hay and a
tree shade in the upper right; a pigsty with mud and a red roof on the middle left; a horse
stable with a green roof and hay bales on the middle right; a large cow barn with grey roof and
red doors in the center; two dog kennels (one smaller with a red roof and a water bowl in the
lower left, one larger in the lower right); a farmhouse with a red tiled roof and flower boxes
in the very center, connected to every pen by a dirt path; a river with a wooden bridge on the
right side; sunflowers and flower beds along the bottom left edge; hills and trees framing the
outer edges. All seven fenced paddocks fully visible, wooden fences, no overlapping.
IMPORTANT: absolutely no text, no letters, no numbers, no signs, no UI, no dice, no people,
and NO animals anywhere — empty pens only. Keep the top 7% and the bottom 15% of the image
free of important details (behind grass only). Wide 16:9 composition.
```

**Негативний промпт** (якщо інструмент підтримує):
```
text, letters, numbers, watermark, signature, UI, buttons, dice, people, farmers, animals,
cows, pigs, horses, goats, ducks, dogs, chickens, isometric 45 degree, top-down flat, night,
dark, clutter, overlapping pens
```

## Після генерації — що робить розробник

1. Покласти файл у `public/assets/map.webp` (пропорція 1.793, без прозорості).
2. `npm run dev` → відкрити `http://localhost:5173/?editor=1` (вікно ≥1000px) —
   дев-редактор накладається поверх карти: перетягнути 7 рамок дворів на нові загони,
   «Копіювати JSON» → вставити в `ZONES` у `src/game/config.ts`.
3. Там же підправити `DECOR` (обійстя/млин) і, за потреби, `PLOTS` — якщо поїхали смуги.
4. Перевірка: `node scripts/measure-hud.mjs` (інтерфейс не має лягти на загони) і
   `node scripts/shot-board.mjs` (знімки поля).
