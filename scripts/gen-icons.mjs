import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

class Canvas {
  constructor(size) {
    this.size = size;
    this.data = Buffer.alloc(size * size * 4);
  }
  px(x, y, r, g, b, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    const i = (y * this.size + x) * 4;
    const na = a / 255;
    const dr = this.data[i];
    const dg = this.data[i + 1];
    const db = this.data[i + 2];
    const da = this.data[i + 3] / 255;
    const oa = na + da * (1 - na);
    if (oa <= 0) return;
    this.data[i] = Math.round((r * na + dr * da * (1 - na)) / oa);
    this.data[i + 1] = Math.round((g * na + dg * da * (1 - na)) / oa);
    this.data[i + 2] = Math.round((b * na + db * da * (1 - na)) / oa);
    this.data[i + 3] = Math.round(oa * 255);
  }
  bgGradient(c1, c2) {
    const s = this.size;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const t = (x / s) * 0.45 + (y / s) * 0.55;
        this.px(
          x,
          y,
          Math.round(c1[0] + (c2[0] - c1[0]) * t),
          Math.round(c1[1] + (c2[1] - c1[1]) * t),
          Math.round(c1[2] + (c2[2] - c1[2]) * t),
          255
        );
      }
    }
  }
  roundRect(x0, y0, w, h, r, color, alpha = 255) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const dx = Math.max(x0 + r - x, x - (x0 + w - 1 - r), 0);
        const dy = Math.max(y0 + r - y, y - (y0 + h - 1 - r), 0);
        if (dx * dx + dy * dy <= r * r) this.px(x, y, color[0], color[1], color[2], alpha);
      }
    }
  }
  line(x0, y0, x1, y1, color, w = 1, alpha = 255) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const hw = w / 2;
      for (let dy = -Math.ceil(hw); dy <= Math.ceil(hw); dy++) {
        for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
          if (dx * dx + dy * dy <= hw * hw + 0.3) {
            this.px(Math.round(x + dx), Math.round(y + dy), color[0], color[1], color[2], alpha);
          }
        }
      }
    }
  }
  candle(cx, top, bottom, wickTop, wickBottom, color, w = 4) {
    const half = Math.max(1, Math.round(w / 2));
    for (let y = wickTop; y <= wickBottom; y++) {
      this.px(cx, y, color[0], color[1], color[2], 255);
    }
    const from = Math.min(top, bottom);
    const to = Math.max(top, bottom);
    for (let y = from; y <= to; y++) {
      for (let x = cx - half; x <= cx + half; x++) this.px(x, y, color[0], color[1], color[2], 255);
    }
  }
}

const GREEN = [22, 208, 154];
const RED = [255, 77, 106];
const BLUE = [77, 141, 255];
const PURPLE = [168, 107, 255];

function drawIcon(size, { maskable = false } = {}) {
  const c = new Canvas(size);
  c.bgGradient([8, 11, 19], [16, 23, 38]);

  const scale = maskable ? 0.58 : 0.82;
  const inner = size * scale;
  const ox = (size - inner) / 2;
  const oy = (size - inner) / 2;

  if (!maskable) {
    c.roundRect(ox * 0.5, oy * 0.5, size - ox, size - oy, size * 0.24, [11, 16, 27], 255);
    c.roundRect(ox * 0.5 + 3, oy * 0.5 + 3, size - ox - 6, size - oy - 6, size * 0.22, BLUE, 90);
  }

  // baseline grid
  for (let i = 1; i < 4; i++) {
    const y = oy + (inner * i) / 4;
    c.line(ox + inner * 0.08, y, ox + inner * 0.92, y, [44, 58, 82], 1, 200);
  }

  // trend line (behind candles)
  c.line(
    ox + inner * 0.12,
    oy + inner * 0.82,
    ox + inner * 0.9,
    oy + inner * 0.2,
    PURPLE,
    Math.max(2, size * 0.016),
    210
  );

  const cw = inner * 0.085;
  const gap = inner * 0.132;
  const startX = ox + inner * 0.1;
  const series = [
    { o: 0.74, c: 0.6, h: 0.54, l: 0.8, col: GREEN },
    { o: 0.6, c: 0.44, h: 0.38, l: 0.66, col: GREEN },
    { o: 0.44, c: 0.56, h: 0.36, l: 0.62, col: RED },
    { o: 0.56, c: 0.32, h: 0.26, l: 0.62, col: GREEN },
    { o: 0.32, c: 0.18, h: 0.13, l: 0.38, col: GREEN },
    { o: 0.18, c: 0.27, h: 0.1, l: 0.3, col: RED }
  ];

  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const cx = Math.round(startX + gap * i + gap / 2);
    const y = (v) => oy + inner * v;
    c.candle(cx, y(s.o), y(s.c), y(s.h), y(s.l), s.col, cw);
  }

  return encodePng(size, size, c.data);
}

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon-180.png', 180, {}]
];

for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT, name), drawIcon(size, opts));
  console.log('wrote', name, size + 'px');
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0b1018"/>
  <g stroke-linecap="round">
    <line x1="16" y1="20" x2="16" y2="42" stroke="#16d09a" stroke-width="3"/>
    <rect x="13" y="24" width="6" height="12" fill="#16d09a"/>
    <line x1="27" y1="16" x2="27" y2="36" stroke="#16d09a" stroke-width="3"/>
    <rect x="24" y="19" width="6" height="11" fill="#16d09a"/>
    <line x1="38" y1="22" x2="38" y2="44" stroke="#ff4d6a" stroke-width="3"/>
    <rect x="35" y="26" width="6" height="12" fill="#ff4d6a"/>
    <line x1="49" y1="12" x2="49" y2="34" stroke="#16d09a" stroke-width="3"/>
    <rect x="46" y="15" width="6" height="13" fill="#16d09a"/>
  </g>
  <path d="M12 50 L52 16" stroke="#a86bff" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>
`;
writeFileSync(join(__dirname, '..', 'public', 'favicon.svg'), svg);
console.log('wrote favicon.svg');
