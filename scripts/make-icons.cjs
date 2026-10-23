/**
 * Gera os ícones PNG (16/32/48/128) da extensão e o ícone do app,
 * sem dependências externas (encoder PNG mínimo com zlib).
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function canvas(size) {
  return { size, px: Buffer.alloc(size * size * 4) };
}

function blend(c, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= c.size || y >= c.size || a <= 0) return;
  const i = (y * c.size + x) * 4;
  const src = a;
  const dst = c.px[i + 3] / 255;
  const outA = src + dst * (1 - src);
  if (outA <= 0) return;
  c.px[i] = Math.round((r * src + c.px[i] * dst * (1 - src)) / outA);
  c.px[i + 1] = Math.round((g * src + c.px[i + 1] * dst * (1 - src)) / outA);
  c.px[i + 2] = Math.round((b * src + c.px[i + 2] * dst * (1 - src)) / outA);
  c.px[i + 3] = Math.round(outA * 255);
}

/** retângulo com cantos arredondados, coordenadas em 0..1 */
function roundRect(c, x0, y0, x1, y1, radius, color) {
  const s = c.size;
  const [r, g, b, a] = color;
  const px0 = x0 * s;
  const py0 = y0 * s;
  const px1 = x1 * s;
  const py1 = y1 * s;
  const rad = radius * s;
  for (let y = Math.floor(py0); y < Math.ceil(py1); y++) {
    for (let x = Math.floor(px0); x < Math.ceil(px1); x++) {
      const cx = Math.min(Math.max(x + 0.5, px0 + rad), px1 - rad);
      const cy = Math.min(Math.max(y + 0.5, py0 + rad), py1 - rad);
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      const cov = Math.min(1, Math.max(0, rad - d + 0.5));
      if (d <= rad) blend(c, x, y, r, g, b, a * cov);
    }
  }
}

function ring(c, cx, cy, radius, thickness, color) {
  const s = c.size;
  const [r, g, b, a] = color;
  const R = radius * s;
  const T = thickness * s;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x + 0.5 - cx * s, y + 0.5 - cy * s);
      const cov = Math.min(1, Math.max(0, T / 2 - Math.abs(d - R) + 0.5));
      if (cov > 0) blend(c, x, y, r, g, b, a * cov);
    }
  }
}

function buildIcon(size) {
  const c = canvas(size);
  // fundo espresso arredondado com borda caramel
  roundRect(c, 0, 0, 1, 1, 0.24, [36, 22, 16, 1]);
  roundRect(c, 0.03, 0.03, 0.97, 0.97, 0.22, [52, 32, 23, 1]);

  // pires
  roundRect(c, 0.14, 0.72, 0.86, 0.82, 0.05, [231, 214, 195, 0.95]);
  // xícara
  roundRect(c, 0.2, 0.4, 0.72, 0.75, 0.07, [251, 246, 239, 1]);
  // café dentro
  roundRect(c, 0.25, 0.44, 0.67, 0.53, 0.045, [180, 105, 58, 1]);
  // alça
  ring(c, 0.74, 0.55, 0.12, 0.055, [251, 246, 239, 1]);
  // vapor
  roundRect(c, 0.34, 0.16, 0.4, 0.31, 0.03, [231, 214, 195, 0.85]);
  roundRect(c, 0.5, 0.12, 0.56, 0.3, 0.03, [231, 214, 195, 0.85]);

  // limpa o que sobrou fora do fundo arredondado
  const s = size;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const px = (x + 0.5) / s;
      const py = (y + 0.5) / s;
      const rad = 0.24;
      const cx = Math.min(Math.max(px, rad), 1 - rad);
      const cy = Math.min(Math.max(py, rad), 1 - rad);
      const d = Math.hypot(px - cx, py - cy);
      if (d > rad) {
        const i = (y * s + x) * 4;
        c.px[i + 3] = 0;
      }
    }
  }

  return encodePng(s, s, c.px);
}

const targets = [
  { dir: "extension/chrome/icons", sizes: [16, 32, 48, 128] },
  { dir: "extension/firefox/icons", sizes: [16, 32, 48, 128] },
];

for (const target of targets) {
  fs.mkdirSync(target.dir, { recursive: true });
  for (const size of target.sizes) {
    fs.writeFileSync(
      path.join(target.dir, `icon-${size}.png`),
      buildIcon(size),
    );
  }
}

fs.mkdirSync("app", { recursive: true });
fs.writeFileSync("app/icon.png", buildIcon(192));
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/icon-192.png", buildIcon(192));
console.log("ícones gerados");
