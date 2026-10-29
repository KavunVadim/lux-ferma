/**
 * КАРТКА РЕЗУЛЬТАТУ ПАРТІЇ (canvas → PNG).
 *
 * Навіщо: гра живе в компанії, яка сидить за одним столом, — а отже, кожна
 * партія закінчується однаково: хтось дістає телефон і фотографує екран.
 * Замість кривої фотографії гра сама малює красиву картку 1080×1350 (формат
 * сторіс і чатів), якою хочеться поділитися, і віддає її в системний
 * «Поділитися» одним тапом. Це і є та сама реклама, яка не виглядає рекламою:
 * картку бачать саме ті друзі, які вже грають у настільну «Люкс Ферму».
 *
 * Малюємо ВЕКТОРОМ і спрайтами (не скріншотом DOM): картка не залежить від
 * розміру екрана, теми й того, що зараз відкрито в інтерфейсі.
 */
import { ANIMAL_SPRITES } from '../../assets/manifest';
import { ANIMALS, GAME_TITLE, SPECIES } from '../../game/config';
import { progress } from '../../game/engine';
import type { Farm } from '../../game/types';

/** Адреса, яку друкуємо на картці (без протоколу — читається як бренд). */
export const SHARE_URL = 'lux-ferma.vercel.app';
export const SHARE_LINK = `https://${SHARE_URL}`;

export interface SharePlayer {
  name: string;
  avatar: string;
  color: string;
  farm: Farm;
}

export interface SharePayload {
  players: SharePlayer[];
  winnerIndex: number;
  /** Номер кола на момент перемоги (1 = перемогли в першому колі). */
  rounds: number;
}

export interface RankedPlayer extends SharePlayer {
  index: number;
  rank: number;
  /** Скільки з пʼяти видів уже у дворі (0–5). */
  score: number;
}

/** Місця у фіналі: переможець перший, далі — за кількістю видів у дворі. */
export function rankPlayers(payload: SharePayload): RankedPlayer[] {
  const ranked = payload.players
    .map((player, index) => ({ ...player, index, rank: 0, score: progress(player.farm) }))
    .sort((a, b) => {
      if (a.index === payload.winnerIndex) return -1;
      if (b.index === payload.winnerIndex) return 1;
      return b.score - a.score;
    });
  return ranked.map((player, rank) => ({ ...player, rank: rank + 1 }));
}

/** Українське число з правильним відмінком: 1 коло, 2 кола, 5 кіл. */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const tail = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (tail === 1) return forms[0];
  if (tail >= 2 && tail <= 4) return forms[1];
  return forms[2];
}

/** Текстовий підпис до картки — для месенджерів, де картинка не потрібна. */
export function shareText(payload: SharePayload): string {
  const ranked = rankPlayers(payload);
  const winner = payload.players[payload.winnerIndex] ?? ranked[0];
  const rounds = `${payload.rounds} ${plural(payload.rounds, ['коло', 'кола', 'кіл'])}`;
  const rows = ranked.map((player) => `${player.rank}. ${player.name} — ${player.score}/5`).join('\n');

  return [
    `🏆 «${GAME_TITLE}» — фінал!`,
    `👑 ${winner?.name ?? 'Переможець'} зібрав повну ферму за ${rounds}`,
    '',
    rows,
    '',
    `Грайте разом на одному телефоні: ${SHARE_LINK}`,
  ].join('\n');
}

/*────────────────────────────── Малювання ──────────────────────────────*/

const W = 1080;
const H = 1350;

const INK = '#2e2013';
const INK_SOFT = '#6b5b47';
const WOOD = '#6b4a2b';
const BARN = '#b33f32';
const CREAM = '#fffbf2';
const LEAF = '#3f7a30';
const LEAF_DARK = '#2f6b2a';

const FONT_DISPLAY = '"M PLUS Rounded 1c", "Nunito", system-ui, sans-serif';
const FONT_BODY = 'Nunito, system-ui, sans-serif';

/** Чекаємо, поки браузер справді завантажить шрифти — інакше текст «стрибне». */
async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`800 96px ${FONT_DISPLAY}`),
      document.fonts.load(`700 40px ${FONT_DISPLAY}`),
      document.fonts.load(`800 40px ${FONT_BODY}`),
      document.fonts.load(`600 28px ${FONT_BODY}`),
    ]);
    await document.fonts.ready;
  } catch {
    /* без шрифтів картка все одно намалюється — системним */
  }
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** Скорочення: малює спрайт тварини, вписаний у квадрат, із фолбеком-емодзі. */
function drawSpecies(
  ctx: CanvasRenderingContext2D,
  key: (typeof SPECIES)[number],
  image: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (image) {
    ctx.drawImage(image, x, y, size, size);
  } else {
    ctx.font = `${size * 0.82}px ${FONT_BODY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ANIMALS[key].emoji, x + size / 2, y + size / 2 + 1);
  }
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#fdf5e3');
  base.addColorStop(0.55, '#f8ecd2');
  base.addColorStop(1, '#efe0bd');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  const sun = ctx.createRadialGradient(880, 90, 20, 880, 90, 640);
  sun.addColorStop(0, 'rgba(255, 209, 118, 0.55)');
  sun.addColorStop(0.55, 'rgba(255, 209, 118, 0.16)');
  sun.addColorStop(1, 'rgba(255, 209, 118, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);

  // Два пагорби внизу — той самий прийом, що на фоні гри.
  ctx.fillStyle = 'rgba(124, 179, 66, 0.20)';
  ctx.beginPath();
  ctx.ellipse(240, H + 40, 760, 260, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(124, 179, 66, 0.26)';
  ctx.beginPath();
  ctx.ellipse(900, H + 80, 720, 240, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCard(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.shadowColor = 'rgba(46, 32, 19, 0.18)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = CREAM;
  rounded(ctx, 56, 56, W - 112, H - 112, 56);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(122, 82, 49, 0.18)';
  ctx.lineWidth = 3;
  rounded(ctx, 56, 56, W - 112, H - 112, 56);
  ctx.stroke();
}

function drawHeader(ctx: CanvasRenderingContext2D): void {
  ctx.textAlign = 'center';

  ctx.fillStyle = BARN;
  ctx.font = `800 26px ${FONT_BODY}`;
  ctx.letterSpacing = '7px';
  ctx.fillText('ФІНАЛ ПАРТІЇ', W / 2, 168);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = WOOD;
  ctx.font = `800 92px ${FONT_DISPLAY}`;
  ctx.fillText(GAME_TITLE, W / 2, 268);

  ctx.fillStyle = INK_SOFT;
  ctx.font = `600 28px ${FONT_BODY}`;
  ctx.fillText('Помічник для настільної гри · один телефон на всіх', W / 2, 316);
}

function drawWinner(ctx: CanvasRenderingContext2D, payload: SharePayload, winner: RankedPlayer | undefined): void {
  const x = 120;
  const y = 352;
  const w = W - 240;
  const h = 232;

  const fill = ctx.createLinearGradient(x, y, x, y + h);
  fill.addColorStop(0, LEAF);
  fill.addColorStop(1, LEAF_DARK);
  ctx.save();
  ctx.shadowColor = 'rgba(47, 107, 42, 0.35)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = fill;
  rounded(ctx, x, y, w, h, 40);
  ctx.fill();
  ctx.restore();

  // Світлий блиск згори — та сама «обʼємність», що в кнопок гри.
  const gloss = ctx.createLinearGradient(x, y, x, y + h * 0.6);
  gloss.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gloss;
  rounded(ctx, x, y, w, h, 40);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `78px ${FONT_BODY}`;
  ctx.fillText('🏆', x + 118, y + h / 2 - 4);

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.font = `800 24px ${FONT_BODY}`;
  ctx.letterSpacing = '5px';
  ctx.fillText('ПЕРЕМОЖЕЦЬ', x + 208, y + 66);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 62px ${FONT_DISPLAY}`;
  ctx.fillText(winner?.name ?? 'Переможець', x + 208, y + 128, w - 250);

  const rounds = `${payload.rounds} ${plural(payload.rounds, ['коло', 'кола', 'кіл'])}`;
  ctx.fillStyle = 'rgba(240, 255, 232, 0.92)';
  ctx.font = `700 30px ${FONT_BODY}`;
  ctx.fillText(`повна ферма за ${rounds}`, x + 208, y + 182);

  ctx.textBaseline = 'alphabetic';
}

function drawStandings(
  ctx: CanvasRenderingContext2D,
  ranked: RankedPlayer[],
  sprites: Record<string, HTMLImageElement | null>,
): void {
  const rowHeight = 116;
  const top = 636;
  const count = ranked.length;
  // Список із 2–4 гравців центруємо у відведеній смузі — без «повітря» знизу.
  const startY = top + ((4 - count) * rowHeight) / 2;
  const x = 120;
  const w = W - 240;

  ranked.forEach((player, i) => {
    const y = startY + i * rowHeight;
    const isWinner = player.rank === 1;

    if (isWinner) {
      ctx.fillStyle = 'rgba(63, 122, 48, 0.08)';
      rounded(ctx, x, y + 4, w, rowHeight - 10, 26);
      ctx.fill();
      ctx.strokeStyle = 'rgba(63, 122, 48, 0.28)';
      ctx.lineWidth = 3;
      rounded(ctx, x, y + 4, w, rowHeight - 10, 26);
      ctx.stroke();
    }

    // Місце: золото/срібло/бронза — без зайвих деталей.
    const medal = ['#d9a13b', '#a8a8a8', '#b07a4a'][i] ?? null;
    if (medal) {
      ctx.fillStyle = medal;
      ctx.beginPath();
      ctx.arc(x + 44, y + 54, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 27px ${FONT_BODY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(player.rank), x + 44, y + 55);
    } else {
      ctx.fillStyle = INK_SOFT;
      ctx.font = `800 27px ${FONT_BODY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(player.rank), x + 44, y + 55);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `42px ${FONT_BODY}`;
    ctx.fillText(player.avatar, x + 92, y + 50);

    ctx.fillStyle = INK;
    ctx.font = `800 40px ${FONT_DISPLAY}`;
    ctx.fillText(player.name, x + 152, y + 56, w - 380);

    ctx.textAlign = 'right';
    ctx.fillStyle = player.score >= 5 ? LEAF_DARK : INK_SOFT;
    ctx.font = `800 34px ${FONT_BODY}`;
    ctx.fillText(`${player.score}/5`, x + w - 40, y + 54);

    // Пʼять слотів двору: заповнені — кольорові спрайти, порожні — привид emoji.
    ctx.textAlign = 'left';
    SPECIES.forEach((species, slot) => {
      const cx = x + 152 + slot * 52;
      const cy = y + 76;
      const owned = (player.farm[species] ?? 0) > 0;
      drawSpecies(ctx, species, sprites[species] ?? null, cx, cy, 40, owned ? 1 : 0.16);
    });
  });

  // Тонка лінія під списком — відділяє підпис гри від результатів.
  if (count < 4) {
    const lineY = startY + count * rowHeight + 18;
    ctx.strokeStyle = 'rgba(122, 82, 49, 0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(140, lineY);
    ctx.lineTo(W - 140, lineY);
    ctx.stroke();
  }
}

function drawFooter(ctx: CanvasRenderingContext2D): void {
  ctx.textAlign = 'center';

  ctx.fillStyle = INK_SOFT;
  ctx.font = `700 24px ${FONT_BODY}`;
  ctx.fillText('2–4 гравці · без реєстрації · працює офлайн', W / 2, 1188);

  const pillY = 1212;
  const pillW = 620;
  const pillH = 74;
  ctx.fillStyle = 'rgba(179, 63, 50, 0.10)';
  rounded(ctx, (W - pillW) / 2, pillY, pillW, pillH, 37);
  ctx.fill();

  ctx.fillStyle = BARN;
  ctx.font = `800 36px ${FONT_DISPLAY}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(SHARE_URL, W / 2, pillY + pillH / 2 + 2);
  ctx.textBaseline = 'alphabetic';
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob повернув null'));
    }, 'image/png');
  });
}

/** Малює картку результату й повертає готовий PNG. */
export async function renderShareCard(payload: SharePayload): Promise<Blob> {
  await ensureFonts();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступний');

  const ranked = rankPlayers(payload);
  const sprites = Object.fromEntries(
    await Promise.all(SPECIES.map(async (species) => [species, await loadImage(ANIMAL_SPRITES[species])] as const)),
  ) as Record<string, HTMLImageElement | null>;

  drawBackground(ctx);
  drawCard(ctx);
  drawHeader(ctx);
  drawWinner(ctx, payload, ranked[0]);
  drawStandings(ctx, ranked, sprites);
  drawFooter(ctx);

  // Ледь помітна «плівка» по краю — картка не виглядає пласкою на білому тлі.
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.78);
  vignette.addColorStop(0, 'rgba(46, 32, 19, 0)');
  vignette.addColorStop(1, 'rgba(46, 32, 19, 0.10)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  return toBlob(canvas);
}

/** Запасний шлях для «Поділитися»: віддати картку файлом у завантаження. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
