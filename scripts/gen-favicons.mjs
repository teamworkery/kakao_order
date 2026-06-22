// 의존성 없이 pojang.one 마크(소문자 p.)를 픽셀로 렌더해 PNG/ICO 생성.
// viewBox 0 0 48 48 기준 지오메트리를 슈퍼샘플링(AA)로 래스터화한다.
import zlib from "node:zlib";
import { writeFileSync } from "node:fs";

const ORANGE = [0xee, 0x7c, 0x2b];

// ---- 지오메트리 (viewBox 48) ----
function inRoundRect(x, y, rx, ry, w, h, r) {
  if (x < rx || x > rx + w || y < ry || y > ry + h) return false;
  const ix0 = rx + r, ix1 = rx + w - r, iy0 = ry + r, iy1 = ry + h - r;
  const cx = x < ix0 ? ix0 : x > ix1 ? ix1 : x;
  const cy = y < iy0 ? iy0 : y > iy1 ? iy1 : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function dist(x, y, cx, cy) { return Math.hypot(x - cx, y - cy); }

// 마크 안이면 true (stem / ring / dot)
function inMark(x, y) {
  if (inRoundRect(x, y, 11.5, 11, 5.5, 31, 2.75)) return true; // stem
  const dr = dist(x, y, 24.5, 22.5);
  if (dr >= 8.5 - 2.75 && dr <= 8.5 + 2.75) return true;        // ring (stroke 5.5)
  if (dist(x, y, 36, 30) <= 3.2) return true;                  // dot
  return false;
}

// size px 이미지를 RGBA Buffer 로. withBg=true 면 흰 라운드 배경(iOS용).
function render(size, withBg) {
  const S = 4; // supersample
  const buf = Buffer.alloc(size * size * 4, 0);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let markHits = 0, bgHits = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const vx = ((px + (sx + 0.5) / S) / size) * 48;
          const vy = ((py + (sy + 0.5) / S) / size) * 48;
          if (inMark(vx, vy)) markHits++;
          if (withBg && inRoundRect(vx, vy, 2, 2, 44, 44, 10)) bgHits++;
        }
      }
      const tot = S * S;
      const o = (py * size + px) * 4;
      const markA = markHits / tot;
      const bgA = withBg ? bgHits / tot : 0;
      if (withBg) {
        // 흰 배경 위에 주황 마크 합성
        const baseA = bgA;
        const r = 255, g = 255, b = 255;
        const fr = ORANGE[0] * markA + r * (1 - markA);
        const fg = ORANGE[1] * markA + g * (1 - markA);
        const fb = ORANGE[2] * markA + b * (1 - markA);
        const a = Math.max(baseA, markA);
        buf[o] = fr; buf[o + 1] = fg; buf[o + 2] = fb; buf[o + 3] = Math.round(a * 255);
      } else {
        buf[o] = ORANGE[0]; buf[o + 1] = ORANGE[1]; buf[o + 2] = ORANGE[2];
        buf[o + 3] = Math.round(markA * 255);
      }
    }
  }
  return buf;
}

// ---- PNG 인코딩 ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function toPNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- ICO (PNG 임베드) ----
function toICO(pngBuf, size) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size; entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0; entry[3] = 0;
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8); entry.writeUInt32LE(22, 12);
  return Buffer.concat([head, entry, pngBuf]);
}

const out = "public";
const png32 = toPNG(32, render(32, false));
const png16 = toPNG(16, render(16, false));
const apple = toPNG(180, render(180, true));
writeFileSync(`${out}/favicon-32.png`, png32);
writeFileSync(`${out}/favicon-16.png`, png16);
writeFileSync(`${out}/apple-touch-icon.png`, apple);
writeFileSync(`${out}/favicon.ico`, toICO(png32, 32));
console.log("generated: favicon.ico, favicon-32.png, favicon-16.png, apple-touch-icon.png");
