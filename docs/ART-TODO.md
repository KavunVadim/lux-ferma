# Що згенерувати (наряд на роботу)

Список **тільки відсутнього**, у порядку віддачі. Повний пакет промптів із
поясненнями — у `docs/ART-PACK.md`; технічні вимоги до карти — `docs/ART-BRIEF.md`.

**Куди класти результати** (ці теки не комітяться, я забираю з них скриптами):

| Що | Тека | Потім у грі |
| --- | --- | --- |
| кадри ходи тварин | `assets-src/walk/<вид>/001.png … 008.png` | `npm run atlas` |
| хижаки (рух) | `assets-src/predators/*.png` | підключу |
| декор | `assets-src/decor/*.png` | підключу |
| UI (кнопки, аватари, банер) | `assets-src/ui/*.png` | підключу |
| нова карта поля | `assets-src/map.png` | підключу (перекладу рамки загонів) |

Перевірити, що вже є, а що ні: **`npm run art:status`**.

---

## Пріоритет 1 — хода тварин (7 видів)

Зараз на полі крутяться **демо-кадри** (я згенерував їх зі статичних спрайтів,
щоб механіка була видима). Справжня хода — це те, що найбільше змінює вигляд.

**Вимоги до кадрів:** PNG з прозорим фоном · квадратні (512×512) · та сама
камера й масштаб у всіх кадрах · тварина в профіль · 8 кадрів на цикл ·
файли `001.png … 008.png` (порядок = порядок руху).

**Як робити (найшвидший шлях):**
1. уточнений промпт на статичний спрайт (нижче) → отримати PNG тварини в профіль;
2. `image → video` (Kling / Runway / Luma) з промптом руху: `a {animal} walking
   in place, side view profile, looped walk cycle, feet on the ground, camera
   locked, white background, no shadow`;
3. нарізати відео на кадри: `ffmpeg -i walk.mp4 frames/%03d.png` → лишити 8 рівних.

**Промпт на статичний кадр (підставляй вид):**

| Вид | Промпт |
| --- | --- |
| качка `duck` | `Cute cartoon duck standing in profile, side view, facing right, glossy 3D storybook style, warm sunlight, transparent background, full body, no shadow` |
| коза `goat` | `Cute cartoon goat with small horns and beard in profile, side view, facing right, glossy 3D storybook style, transparent background, full body` |
| свиня `pig` | `Cute round cartoon pig in profile, side view, facing right, glossy 3D storybook style, transparent background, full body` |
| кінь `horse` | `Cute cartoon horse with flowing mane in profile, side view, facing right, glossy 3D storybook style, transparent background, full body` |
| корова `cow` | `Cute cartoon dairy cow with black-and-white spots in profile, side view, facing right, glossy 3D storybook style, transparent background, full body` |
| малий пес `sdog` | `Cute small cartoon puppy in profile, side view, facing right, glossy 3D storybook style, transparent background, full body` |
| великий пес `bdog` | `Cute big cartoon farm dog (shepherd) in profile, side view, facing right, glossy 3D storybook style, transparent background, full body` |

**Спільний негатив:** `text, watermark, blurry, extra legs, deformed, human,
multiple animals, cropped limbs, helmet, hat, cartoon outline, white halo`.

Робити по одному виду — я підключу кожен одразу (`npm run atlas`), не чекаючи решти.

## Пріоритет 2 — хижаки (рух)

Потрібно для анімації набігу: зараз лисиця й ведмідь — статичні спрайти.
Класти в `assets-src/predators/`.

| Файл | Промпт |
| --- | --- |
| `fox-sneak.png` | `Cute cartoon fox sneaking low to the ground, side view profile, facing right, glossy 3D storybook style, transparent background` |
| `fox-run.png` | `Cute cartoon fox running away carrying a duck in its mouth, side view profile, facing right, glossy 3D storybook style, transparent background` |
| `bear-run.png` | `Cute cartoon bear running away carrying a pig in its mouth, side view profile, facing right, glossy 3D storybook style, transparent background` |

## Пріоритет 3 — UI для телефона (за концептом)

Нова тека `assets-src/ui/`. Усе PNG з прозорим фоном; панелі/кнопки — **9-slice**
(рівні краї ~12%, однакова середина). Детальні промпти — `docs/ART-PACK.md`, розділ 6.

Найбільше дають: `avatar-1…4.png` (круглі портрети фермерів),
`icon-dice.png` (кубик), `btn-green.png` (+`-pressed`), `banner-event.png` (рамка події).

## Пріоритет 4 — декор і карта (коли захочеться)

* `assets-src/decor/` — колодязь, трактор, опудало, копиця, годівниця, курник,
  тачка, квіти, миска пса (промпти — `ART-PACK.md`, розділ 2);
* `assets-src/map.png` — нова карта: **1664×928 (пропорція 1.793)**, ракурс 3/4,
  7 порожніх загонів, вільні смуги ~7% зверху й ~15% знизу, без тексту, тварин
  і UI (`ART-BRIEF.md`). Після заміни карти я перекладу рамки загонів у редакторі —
  це окремий прохід, координати старі не підійдуть.

---

## Що вже є в грі (генерувати не треба)

Карта `map.webp` (1664×928) · 7 видів тварин · 6 будівель · декор
(тин, хата, млин, ставок, соняшники, дерево) · лисиця й ведмідь (статичні) ·
демо-стрічки ходи для всіх 7 видів.
