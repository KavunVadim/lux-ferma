# Промпт для генерації іконки застосунку «Люкс Ферма»

> Скопіюй текст нижче в генератор зображень (Gemini / DALL·E / Midjourney).
> Іконка замінює `public/icons/icon-512.png` (і похідні 192 / maskable).
> Поточна іконка — біла качка на блакитно-зеленому градієнті, без тексту.

---

## Основний промпт (для Gemini / DALL·E — природною мовою)

```
App icon for a cozy farm board-game companion app called "Люкс Ферма".

Subject: a friendly white duck with a bright orange beak and orange feet,
sitting calmly and looking slightly up, cartoon storybook style. The duck is
the game's mascot and the very first animal every player receives.

Composition: the duck centered and large, taking about 60% of the canvas
height, positioned slightly below center. Plenty of breathing room around it.

Background: a soft radial gradient from warm cream (#FFF8EA) in the upper
left to fresh meadow green (#7CB342) in the lower right, with a subtle sky
blue (#8FC7E8) glow in the top-right corner. Gentle, warm, inviting.

Style: glossy 3D storybook illustration, rounded soft shapes, thick clean
outlines, warm sunlight coming from the upper left, subtle drop shadow under
the duck, gentle highlights on the beak and feathers. Cheerful and premium —
like a high-quality mobile game, not a flat vector icon.

Technical: square 1024x1024, the duck fully inside a safe circle with 20%
margin on all sides (so the icon survives Android's circular mask), no text,
no letters, no watermark, no border, no frame.
```

---

## Варіант із групою тварин (якщо качка здасться надто простою)

```
App icon for a cozy farm board-game companion app.

Subject: five cute cartoon farm animals arranged in a gentle arc, all facing
the viewer — a white duck (front, slightly larger), a goat, a pink pig, a
brown horse, and a black-and-white cow (back). All with friendly expressions,
glossy 3D storybook style, thick clean outlines, warm sunlight from the
upper left.

Background: warm cream radial glow behind the animals fading into fresh
meadow green at the edges, soft sky blue in the top-right corner.

Technique: square 1024x1024, all animals inside a safe circle with 20% margin
(Android circular mask), soft drop shadows, no text, no letters, no frame,
no border. Cheerful, premium mobile-game feel.
```

---

## Короткий промпт (для Midjourney / коротких полів)

```
cute white duck mascot app icon, glossy 3D storybook style, thick outlines,
warm cream to meadow green radial gradient background, sky blue glow top right,
soft sunlight upper left, centered, square 1024, no text --ar 1:1
```

---

## Негативний промпт (що НЕ має з'явитись)

```
text, letters, words, watermark, signature, border, frame, flat vector,
photo, realistic photograph, harsh shadows, dark background, scary, teeth,
extra legs, extra wings, blurry, low contrast, cropped animal
```

---

## Технічні вимоги

| Параметр | Значення |
|---|---|
| Формат | PNG з квадратним полотном |
| Розмір джерела | 1024×1024 (потім зменшується до 512 і 192) |
| Безпечна зона | ≥ 20% відступу — інакше Android обріже кругом |
| Текст | **не має бути** (на іконці 192px він читатись не буде) |
| Прозорість | не потрібна: фон — частина іконки |

## Куди покласти

```
~/Desktop/lux-ferma/public/icons/
  icon-512.png            ← згенероване зображення
  icon-192.png            ← той самий кадр, 192×192
  icon-maskable-512.png   ← той самий кадр із більшим відступом (safe zone 25%)
  apple-touch-icon.png    ← 180×180, для iOS
```

Зменшити можна так (macOS, без залежностей):

```bash
cd ~/Desktop/lux-ferma/public/icons
sips -z 512 512 icon-1024.png --out icon-512.png
sips -z 192 192 icon-1024.png --out icon-192.png
sips -z 180 180 icon-1024.png --out apple-touch-icon.png
sips -z 512 512 icon-1024.png --out icon-maskable-512.png
```

## Палітра — тримай її, щоб іконка збігалась із грою

| Роль | HEX |
|---|---|
| Тепла основа (світла тема) | `#FFF8EA` |
| Лука / зелень | `#7CB342` |
| Небо | `#8FC7E8` |
| Дзьоб і лапи качки | `#F0A030` |
| Дерево (рами плиток) | `#996436` |
| Цегла (головна кнопка) | `#C94A38` |
| Золото (лічильники) | `#E8A94A` |

## Важливі обмеження

- **П'ять видів тварин, без овець.** У грі є качка, коза, свиня, кінь,
  корова + два собаки (охорона). Овець немає — не додавай їх на іконку.
- **Один ресурс — спільне стадо (🧺).** Ніяких сирів, вовни, мʼяса чи молока.
- Якщо генератор додав текст або рамку — перегенеруй, а не обрізай: обрізана
  рамка читається як брак.

## Як перевірити результат

```bash
cd ~/Desktop/lux-ferma
node scripts/check-mobile.mjs   # базова перевірка інтерфейсу
npm run build                   # іконки потрапляють у PWA-манифест
```

Подивитись, як іконка виглядає в круглій масці (Android):

```bash
sips -z 192 192 public/icons/icon-maskable-512.png --out /tmp/mask-preview.png
```

Якщо важливі частини качки обрізались — збільш відступ і перегенеруй
maskable-варіант: у нього безпечна зона 25%, а не 20%.
