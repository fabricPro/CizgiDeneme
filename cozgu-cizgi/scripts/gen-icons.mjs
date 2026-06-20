// Bağımsız (deps yok) PNG ikon üretici — Node'un yerleşik zlib'i ile.
// Markaya uygun: lacivert zemin üzerine altın/krem dikey "çözgü çizgi" bantları.
// Çıktı: public/icon-192.png, public/icon-512.png
// Çalıştır: node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public");

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
};

const NAVY = [13, 27, 42];     // #0D1B2A
const NAVY2 = [31, 42, 64];    // #1F2A40
const CREAM = [239, 230, 211]; // #EFE6D3
const GOLD = [232, 160, 48];   // #E8A030
// çözgü bant deseni (renk, ağırlık) — içerik genişliğine bir tekrar
const PATTERN = [
  [CREAM, 5], [NAVY2, 2], [CREAM, 2], [GOLD, 3],
  [CREAM, 6], [NAVY2, 2], [GOLD, 2], [CREAM, 4],
];
const TOTAL = PATTERN.reduce((s, p) => s + p[1], 0);

function makePng(size) {
  const W = size, H = size;
  const margin = Math.round(W * 0.12);
  const content = W - margin * 2;
  const colCache = new Array(W);
  for (let x = 0; x < W; x++) {
    if (x < margin || x >= W - margin) { colCache[x] = NAVY; continue; }
    const rel = ((x - margin) / content) * TOTAL;
    let acc = 0, col = PATTERN[PATTERN.length - 1][0];
    for (const [c, w] of PATTERN) { acc += w; if (rel < acc) { col = c; break; } }
    colCache[x] = col;
  }
  const raw = Buffer.alloc((W * 4 + 1) * H);
  let o = 0;
  for (let y = 0; y < H; y++) {
    raw[o++] = 0; // filtre: yok
    const edge = y < margin || y >= H - margin; // üst/alt lacivert pay
    for (let x = 0; x < W; x++) {
      const c = edge ? NAVY : colCache[x];
      raw[o++] = c[0]; raw[o++] = c[1]; raw[o++] = c[2]; raw[o++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

for (const size of [192, 512]) {
  const png = makePng(size);
  writeFileSync(join(OUT, `icon-${size}.png`), png);
  console.log(`wrote icon-${size}.png (${png.length} bytes)`);
}
