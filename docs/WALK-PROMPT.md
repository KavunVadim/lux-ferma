# Промт для генерації ходи ведмедя й лисиці

Грі потрібні дві стрічки кадрів: `public/assets/walk/bear.webp` і `fox.webp`
(6 кадрів по 176×176, обидва «обличчям управо» — у грі їх дзеркалить CSS,
коли хижак тікає вліво).

Нижче — готові промти для ChatGPT / Gemini / будь-якої моделі з картинками.
Найкращий результат дає **один аркуш на тварину**: ряд кадрів + підпис ліворуч.

---

## 1. Основний промт — аркуш кадрів (ведмідь)

> Скопіювати все, вставити в чат, **прикріпити** `public/assets/animals/bear.webp`
> і `public/assets/walk/bear.webp` як референс стилю.

```
Create a 2D animation sprite sheet for a game: one horizontal row of SIX
sequential walk-cycle frames of the SAME character, plus a narrow label column
on the far left.

CHARACTER (must stay identical in all six frames):
A big brown bear walking on all fours, side view, facing RIGHT. Heavy,
lumbering gait: shoulders roll, head held low, big paws. Warm brown fur,
lighter muzzle, soft stylized 3D-rendered cartoon look (Pixar-like), clean
rounded shapes, soft shading, no outlines. Match the attached reference
images exactly in style, fur color and proportions.

LAYOUT:
- 1536×1024 px, pure white background (#FFFFFF).
- Far-left narrow column (~12% of the width): the word "BEAR" in plain black
  sans-serif, vertically centered.
- Then SIX equal square cells in one row, evenly spaced, with at least 40 px
  of pure white between them (the frames are cut out automatically, gaps are
  required).
- No grid lines, no borders, no frame numbers, no watermark, no other text.

ANIMATION — one seamless loop, six phases:
1. contact — front-left paw forward, rear-right paw back
2. down — body at its lowest, weight on the front legs
3. passing — rear legs pass under the body, body rises slightly
4. contact — opposite paws (mirror of frame 1)
5. down — body at its lowest again
6. passing — legs return to the frame-1 position, so frame 6 flows into frame 1

RULES:
- Locked camera: identical distance, identical scale, identical ground line in
  every frame. All paws stay on the same invisible ground line.
- Between frames only the legs, a body bob of at most 4% of the height and a
  slight head bob may change. Head shape, ears, tail, body proportions and
  colors stay identical.
- No motion blur, no dust, no grass, no ground shadow, no background elements.
- Crisp edges, silhouette readable at 64 px.

If you cannot keep the character identical across the sheet, say so instead of
producing a distorted sheet.
```

## 2. Те саме для лисиці

Замінити блок CHARACTER і підпис:

```
CHARACTER (must stay identical in all six frames):
A red fox trotting on all fours, side view, facing RIGHT. Light, quick gait,
slim body, big bushy tail with a white tip, white chest and muzzle, black
lower legs, alert triangular ears. Soft stylized 3D-rendered cartoon look
(Pixar-like), clean rounded shapes, soft shading, no outlines. Match the
attached reference images exactly in style, fur color and proportions.
```

Підпис у лівій колонці: `FOX`.

Решта промту (LAYOUT, ANIMATION, RULES) — без змін: у лисиці той самий цикл,
лише крок швидший, тож у кадрах 2 і 5 тіло опускається менше.

---

## 3. Якщо аркуш виходить кривий — 6 окремих кадрів

Моделі погано тримають персонажа в межах однієї картинки. Тоді:

```
Generate SIX separate images in one message, one image per walk-cycle phase of
the SAME red fox / brown bear.

Every image must have:
- identical framing: 1024×1024, pure white background, the animal centered,
  occupying the same area, same camera distance, side view facing RIGHT,
  paws on the same invisible ground line;
- the same character: identical proportions, fur colors, size;
- only the legs and a slight body/head bob changing between phases;
- no text, no shadows, no background, no motion blur.

Number the images 1 to 6 in your reply (the numbers themselves must NOT be
painted on the image).
```

Далі зберегти шість файлів як `001.png … 006.png` у `assets-src/walk/bear/`
(або `fox/`) — і перейти до обробки.

## 4. Відео-цикл (найплавніша хода)

Якщо є доступ до відеомоделі (Sora, Veo, Kling), краще генерувати рух, а не
кадри:

```
A 4-second seamless looping video: a big brown bear walking on all fours to the
RIGHT, locked side-view camera, no camera movement, plain white studio
background, soft even lighting, no ground shadow, no text, no props.
Stylized 3D-rendered cartoon character with warm brown fur, soft shading.
The gait is heavy and lumbering, shoulders roll, head low. The last second must
flow seamlessly into the first.
```

Кадри з відео:

```bash
ffmpeg -i bear.mp4 -vf "fps=6" -start_number 1 /tmp/bear/%03d.png
# вибрати 6 кадрів, де цикл замикається (перший і останній — та сама фаза)
```

---

## 5. Обробка (2 команди)

```bash
# аркуш → assets-src/walk/<вид>/001.png …
node scripts/split-sheet.mjs ~/Downloads/bear-sheet.png bear
node scripts/split-sheet.mjs ~/Downloads/fox-sheet.png fox

# кадри → public/assets/walk/<вид>.webp + маніфест src/assets/walk.ts
npm run atlas -- --clean
```

`--clean` збирає лише те, що лежить в `assets-src` (тобто тільки ведмедя й
лисицю), без демо-кадрів для решти видів. Після цього старі стрічки видів, які
вже не використовуються (тварини у дворах тепер статичні), можна прибрати з
`public/assets/walk/`.

Перевірка: `npm run dev` → **Налаштування → 🎬 Перевірити анімації** →
«Показати набіг ведмедя» та «…лисиці». Маршрут має пройти повністю: поява
зліва, дві зупинки, розворот, відхід уліво.

## 6. Чекліст приймання

- [ ] 6 кадрів, однаковий розмір полотна, білий фон без плям.
- [ ] Між кадрами ≥40 px білого — інакше `split-sheet` зліпить їх.
- [ ] Тварина дивиться **вправо** (гра дзеркалить її сама).
- [ ] Лапи на одній лінії землі; голова й пропорції не «пливуть».
- [ ] Кадр 6 переходить у кадр 1 без стрибка.
- [ ] Немає тіні під ногами, трави, пилу й тексту на картинці.
- [ ] Силует читається на 176×176 (у грі кадр саме такого розміру).
