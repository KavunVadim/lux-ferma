# Пакет промптів для генерації арта «Люкс Ферма»

Тут зібрано все, що треба згенерувати, з готовими промптами. Ти генеруєш —
я підключаю (для ходи навіть не треба коду: кинув кадри в теку, запустив
`npm run atlas`).

**Спільні правила для всього арта** (однакові для карти й спрайтів):

* стиль: **об'ємний мультяшний 3D-рендер**, тепле сонячне світло, насичені
  кольори, м'які тіні — як у концепті;
* світло **зверху-зліва** (щоб тіні на всіх спрайтах падали в один бік);
* ракурс той самий, що на карті: **3/4 зверху**, не справжня ізометрія 45°;
* **жодного тексту, літер, цифр, UI, кубиків** — підписи малює гра;
* спрайти — **PNG з прозорим фоном**, без підписів і рамок.

---

## 1. Головна карта (найважливіше)

Замінює `public/assets/map.webp`. Повний бриф із вимогами — у `docs/ART-BRIEF.md`,
ось промпт для копіювання:

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

Негативний: `text, letters, numbers, watermark, UI, dice, people, animals, isometric 45 degree, top-down flat, night, dungeon, dark, clutter`

**Куди класти:** `public/assets/map.webp`. Пропорція **1.793 (1664×928)**, без прозорості.
Після цього я за 15 хвилин перекладу рамки дворів у дев-редакторі (`?editor=1`).

---

## 2. Декор (спрайти на прозорому фоні)

Формат: **PNG 1024×1024, прозорий фон, один об'єкт по центру, без тіні на фоні**
(тінь я додам кодом). Назви файлів — рівно такі, як у таблиці.

Спільний хвіст промпта для всіх: `single isolated object, centered, transparent background,
cartoon 3D render, warm sunny lighting from the upper left, no text, no shadow on background, high detail`

| Файл | Що це | Промпт (початок) |
| --- | --- | --- |
| `well.png` | колодязь | `An old wooden farm well with a small roof and a bucket on a rope` |
| `tractor.png` | трактор | `A small red cartoon farm tractor with big rear wheels, side 3/4 view` |
| `haybale.png` | рулон сіна | `A round hay bale wrapped in twine standing on grass` |
| `trough.png` | годівниця-жолоб | `A wooden feeding trough filled with hay` |
| `scarecrow.png` | опудало | `A friendly scarecrow on a wooden stick with a straw hat and patched shirt` |
| `coop.png` | курник з курми | `A small red chicken coop with a ramp, and two white hens pecking beside it` |
| `wheelbarrow.png` | тачка | `A wooden wheelbarrow with a shovel and hay inside` |
| `flowers.png` | клумба | `A small round flower bed with red and yellow flowers and a stone border` |
| `dogbowl.png` | миска | `A metal dog bowl with water, small` |

**Куди класти:** `assets-src/decor/<назва>.png` (я прогоню через `npm run assets`
і поставлю координати, як з обійстям і млином).

---

## 3. Хода тварин (2–3 види спершу)

Найпростіший шлях — **згенерувати коротке відео** з нашого спрайта, а я наріжу кадри.

1. У Runway / Kling / Luma / Pika завантаж спрайт тварини (він у нас уже є) і дай промпт:

```
Cartoon 3D render animal walking in place, side view, seamless loop, 8 frames, transparent
background, same lighting and colors as the reference image, no camera movement, no text
```

Підстав вид: `duck waddling`, `goat walking`, `pig trotting`, `horse walking`,
`cow walking slowly`, `small brown and white dog running`, `large shepherd dog running`.

2. Вивантаж відео і наріж кадри (у мене є ffmpeg — або зроби сам):

```bash
mkdir -p assets-src/walk/duck
ffmpeg -i walk.mp4 -vf "fps=8,scale=512:-1" assets-src/walk/duck/%03d.png
```

3. Поклади теки у проєкт і скажи мені — я запущу `npm run atlas`.
   Потрібно **6–10 кадрів** на вид, кадри в порядку циклу (перший ≈ останній).

**Пріоритет:** качка, коза, свиня. Решта поки лишиться з CSS-погойдуванням.

---

## 4. Хижаки (для набігу)

Щоб набіг виглядав живим, потрібні два кадри-хвилі + рух:

| Файл | Промпт |
| --- | --- |
| `fox-sneak.png` | `A cartoon fox sneaking low to the ground, side view, angry, transparent background, 3D render` |
| `fox-run.png` | `The same cartoon fox running away with a duck in its mouth, side view, transparent background` |
| `bear-run.png` | `A big cartoon brown bear running away with a pig under its arm, side view, transparent background` |

**Куди класти:** `assets-src/predators/<назва>.png` — я підключу їх до анімації
набігу (зараз там загальний спрайт звіра, що вибігає і тікає).

---

## 5. Дрібниці (за бажанням, не обов'язково)

| Що | Промпт | Навіщо |
| --- | --- | --- |
| Порожня дерев'яна табличка | `An empty wooden signboard with a wooden post, blank surface, no text, transparent background` | замінити CSS-таблички дворів на справжні |
| Дерев'яний лоток для кнопок | `A wooden tray / plank UI panel, empty, blank, front view, no text` | фон під кнопки дій |
| Камені, кущі, гриби | `A small cartoon bush` / `A small rock` / `A group of mushrooms` | оживити порожні кути карти |

---

## Що з цього дає найбільший ефект

1. **Карта** (розділ 1) — разюча зміна вигляду: замість плоскої 2D-арти буде
   об'ємна сцена як у концепті.
2. **Хода 2–3 тварин** (розділ 3) — рух замість погойдування.
3. **Хижаки** (розділ 4) — набіг із «вкраденою» твариною в зубах.

Порядок передачі будь-який: що згенеруєш — те я й підключу, зупинятися не треба.
