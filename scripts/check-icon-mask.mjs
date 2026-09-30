/**
 * Перевірка безпечної зони іконки для круглої маски Android.
 *
 * Малює поверх іконки затемнення за межами кола (80% діаметра — саме стільки
 * лишає Android у maskable-режимі). Усе, що потрапило в затемнену зону, на
 * справжньому пристрої буде обрізане.
 *
 * Запуск: node scripts/check-icon-mask.mjs [шлях-до-png]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { inflateSync, deflateSync } from 'node:zlib';

const SRC = process.argv[2] ?? 'public/icons/icon-maskable-512.png';
const OUT = process.argv[3] ?? '/tmp/mask-check.png';
/** Скільки діаметра лишає Android у maskable-режимі (решта — під обрізання). */
const SAFE_RATIO = 0.8;

/** Мінімальний PNG-декодер: 8-біт RGB (colorType 2) або RGBA (6). */
function decode(buf) {
  let pos = 8;
  let width = 0; let height = 0; let colorType = 6;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let rp = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rp]; rp += 1;
    const line = raw.subarray(rp, rp + stride); rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, bpp, stride, data: out };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const img = decode(await readFile(SRC));
const { width, height, bpp, stride, data } = img;
const out = Buffer.from(data);

// Затемнюємо все за межами безпечного кола.
const cx = width / 2;
const cy = height / 2;
const r = (SAFE_RATIO / 2) * Math.min(width, height);
let outside = 0;
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) {
      const i = y * stride + x * bpp;
      out[i] = Math.round(out[i] * 0.3);
      out[i + 1] = Math.round(out[i + 1] * 0.3);
      out[i + 2] = Math.round(out[i + 2] * 0.3);
      outside += 1;
    }
  }
}

// Перепаковуємо PNG.
const raw = Buffer.alloc(height * (stride + 1));
for (let y = 0; y < height; y += 1) {
  raw[y * (stride + 1)] = 0;
  out.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = bpp === 4 ? 6 : 2;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
await writeFile(OUT, png);

const pct = Math.round((outside / (width * height)) * 100);
console.log(`${SRC}: ${width}×${height}`);
console.log(`за межами безпечного кола (${Math.round(SAFE_RATIO * 100)}% діаметра): ${pct}% площі`);
console.log(`затемнене — обріжеться на Android. Знімок: ${OUT}`);
console.log('Подивись на знімок: якщо в затемненій зоні є щось важливе — збільш відступ.');
