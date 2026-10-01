// Рисует значок приложения (синий квадрат с тремя растущими столбиками)
// во всех нужных размерах: для сайта и установки на телефон/iPad (public/icons)
// и для Android-приложения (android/app/src/main/res), если папка android уже есть.
// Запуск: node scripts/make-icons.mjs. Внешние программы не нужны.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOP = [0x63, 0x66, 0xf1]; // цвет фона вверху слева
const BOTTOM = [0x43, 0x38, 0xca]; // внизу справа
const WHITE = [255, 255, 255];

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // бит на канал
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// Рисование: фигуры в координатах 0…1, сглаживание через 4×4 подвыборки
// ---------------------------------------------------------------------------
function inRoundRect(x, y, [rx, ry, rw, rh, r]) {
  if (x < rx || y < ry || x > rx + rw || y > ry + rh) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + rw - r);
  const cy = Math.min(Math.max(y, ry + r), ry + rh - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/**
 * shape: 'rounded' — скруглённый квадрат, 'square' — весь холст, 'circle' — круг, 'none' — без фона
 * scale: размер группы столбиков относительно холста
 */
function render(size, { shape, scale, background = true }) {
  const out = Buffer.alloc(size * size * 4);
  const bg = shape === 'rounded' ? [0, 0, 1, 1, 0.225] : shape === 'square' ? [0, 0, 1, 1, 0] : null;
  // Столбики из значка 32×32: x = 7, 14, 21; ширина 4; верх 17, 12, 7; низ 25
  const unit = scale / 18;
  const ox = 0.5 - 9 * unit;
  const oy = 0.5 - 9 * unit;
  const bars = [
    [0, 10, 8],
    [7, 5, 13],
    [14, 0, 18],
  ].map(([x, y, h]) => [ox + x * unit, oy + y * unit, 4 * unit, h * unit, 1.1 * unit]);
  const S = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let a = 0;
      let white = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = (px + (sx + 0.5) / S) / size;
          const y = (py + (sy + 0.5) / S) / size;
          const inBg = !background ? false : shape === 'circle' ? (x - 0.5) ** 2 + (y - 0.5) ** 2 <= 0.25 : bg ? inRoundRect(x, y, bg) : false;
          const inBar = bars.some((b) => inRoundRect(x, y, b));
          if (inBar) white++;
          if (inBg || inBar) a++;
        }
      }
      const i = (py * size + px) * 4;
      const t = (px + py) / (2 * size);
      const base = TOP.map((c, k) => Math.round(c + (BOTTOM[k] - c) * t));
      const w = a ? white / a : 0;
      const col = background ? base.map((c, k) => Math.round(c + (WHITE[k] - c) * w)) : WHITE;
      out[i] = col[0];
      out[i + 1] = col[1];
      out[i + 2] = col[2];
      out[i + 3] = Math.round((a / (S * S)) * 255);
    }
  }
  return png(size, out);
}

function save(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log(`✓ ${path.slice(ROOT.length + 1)}`);
}

// Сайт и установка на устройства
const icons = join(ROOT, 'public', 'icons');
save(join(icons, 'icon-192.png'), render(192, { shape: 'rounded', scale: 0.5625 }));
save(join(icons, 'icon-512.png'), render(512, { shape: 'rounded', scale: 0.5625 }));
save(join(icons, 'maskable-512.png'), render(512, { shape: 'square', scale: 0.46 }));
save(join(icons, 'apple-touch-icon.png'), render(180, { shape: 'square', scale: 0.52 }));

// ---------------------------------------------------------------------------
// Android-приложение: векторный адаптивный значок (чёткий на любом экране),
// PNG для старых версий Android и заставка при запуске
// ---------------------------------------------------------------------------
const hex = (c) => '#FF' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const n = (v) => +v.toFixed(3);
function roundRectPath(x, y, w, h, r) {
  return `M${n(x + r)},${n(y)}h${n(w - 2 * r)}a${n(r)},${n(r)} 0 0 1 ${n(r)},${n(r)}v${n(h - 2 * r)}a${n(r)},${n(r)} 0 0 1 ${n(-r)},${n(r)}h${n(-(w - 2 * r))}a${n(r)},${n(r)} 0 0 1 ${n(-r)},${n(-r)}v${n(-(h - 2 * r))}a${n(r)},${n(r)} 0 0 1 ${n(r)},${n(-r)}z`;
}
/** Столбики в квадрате 108×108 (стандарт адаптивных значков Android) */
function barsPath(scale) {
  const unit = (scale * 108) / 18;
  const o = 54 - 9 * unit;
  return [
    [0, 10, 8],
    [7, 5, 13],
    [14, 0, 18],
  ]
    .map(([x, y, h]) => roundRectPath(o + x * unit, o + y * unit, 4 * unit, h * unit, 1.1 * unit))
    .join('');
}
const gradient = `<aapt:attr name="android:fillColor">
                <gradient android:type="linear" android:startX="0" android:startY="0" android:endX="108" android:endY="108"
                    android:startColor="${hex(TOP)}" android:endColor="${hex(BOTTOM)}" />
            </aapt:attr>`;
const vector = (size, body) => `<?xml version="1.0" encoding="utf-8"?>
<!-- Создано scripts/make-icons.mjs — не редактируй вручную -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="${size}dp" android:height="${size}dp"
    android:viewportWidth="108" android:viewportHeight="108">
${body}
</vector>
`;

const res = join(ROOT, 'android', 'app', 'src', 'main', 'res');
if (existsSync(res)) {
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(densities)) {
    const dir = join(res, `mipmap-${d}`);
    save(join(dir, 'ic_launcher.png'), render(Math.round(48 * k), { shape: 'rounded', scale: 0.5 }));
    save(join(dir, 'ic_launcher_round.png'), render(Math.round(48 * k), { shape: 'circle', scale: 0.48 }));
  }
  const drawable = join(res, 'drawable');
  save(join(drawable, 'ic_launcher_bg.xml'), vector(108, `    <path android:pathData="M0,0h108v108h-108z">
            ${gradient}
    </path>`));
  save(join(drawable, 'ic_launcher_fg.xml'), vector(108, `    <path android:fillColor="#FFFFFFFF" android:pathData="${barsPath(0.4)}" />`));
  save(join(drawable, 'splash_logo.xml'), vector(96, `    <path android:pathData="${roundRectPath(0, 0, 108, 108, 24.3)}">
            ${gradient}
    </path>
    <path android:fillColor="#FFFFFFFF" android:pathData="${barsPath(0.5625)}" />`));
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<!-- Создано scripts/make-icons.mjs — не редактируй вручную -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_bg" />
    <foreground android:drawable="@drawable/ic_launcher_fg" />
    <monochrome android:drawable="@drawable/ic_launcher_fg" />
</adaptive-icon>
`;
  save(join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive);
  save(join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);
}
