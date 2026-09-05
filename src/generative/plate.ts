/**
 * A "plate": the vine piece reworked in the spirit of enigmatriz and gencup posters. A grainy
 * colour field, ruled panels, silhouettes cut out of the image, windows where the image is
 * translated into ASCII, a dashed data line with square nodes, and small pixel-font labels.
 * Still, seeded, and deterministic like the piece itself.
 */
import { randomSeed, renderPiece, type PieceOptions } from './piece';

export type PlateOptions = {
  seed: number;
  width: number;
  height: number;
  dpr: number;
};

type Vec = [number, number];

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const FONT = "'Geist Pixel Variable', 'Geist Variable', monospace";
const ASCII_RAMP = ' .·:;+=xX#@';
const DIGITS = '0123456789';

/** Four looks, each with a paper, a pair of field colours, an ink and a hot accent. */
const LOOKS = [
  { paper: '#f3ece0', field: ['#7aa6d8', '#e9d9a3'], ink: '#3a3f6a', hot: '#f07a3c' },
  { paper: '#f6efe8', field: ['#d98bb0', '#f4d7a1'], ink: '#4a2a55', hot: '#e94f6a' },
  { paper: '#eef0ea', field: ['#3f6fd6', '#48c9a2'], ink: '#1f2b52', hot: '#f2c14e' },
  { paper: '#f4eee6', field: ['#8f7fc0', '#f2a97e'], ink: '#46286c', hot: '#e8735a' },
];

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
};
const withAlpha = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${r} ${g} ${b} / ${a})`;
};

const hash2 = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const renderPlate = (canvas: HTMLCanvasElement, options: PlateOptions) => {
  const { seed, width, height, dpr } = options;
  const W = Math.round(width);
  const H = Math.round(height);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rnd = mulberry32(seed);
  const range = (lo: number, hi: number) => lo + (hi - lo) * rnd();
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const chance = (p: number) => rnd() < p;
  const pick = <T>(items: readonly T[]) => items[Math.floor(rnd() * items.length)]!;
  const look = pick(LOOKS);
  const u = Math.min(W, H);
  const px = (n: number) => n * dpr;

  // 1. Ground: paper, then two broad colour fields that cross the frame diagonally.
  ctx.fillStyle = look.paper;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2; i++) {
    const cx = W * (i === 0 ? range(0.1, 0.4) : range(0.6, 0.9));
    const cy = H * range(0.2, 0.8);
    const r = u * range(0.6, 1.1);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, withAlpha(look.field[i]!, 0.75));
    g.addColorStop(0.6, withAlpha(look.field[i]!, 0.3));
    g.addColorStop(1, withAlpha(look.field[i]!, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // 2. Rules: vertical panels, sometimes a fine grid inside a band.
  const panels = int(5, 9);
  ctx.strokeStyle = withAlpha('#ffffff', 0.55);
  ctx.lineWidth = px(1);
  for (let i = 1; i < panels; i++) {
    const x = Math.round((W * i) / panels) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  if (chance(0.7)) {
    const cell = px(range(8, 14));
    const top = H * range(0, 0.5);
    const bottom = top + H * range(0.25, 0.5);
    ctx.strokeStyle = withAlpha('#ffffff', 0.22);
    ctx.lineWidth = px(0.6);
    ctx.beginPath();
    for (let x = 0; x < W; x += cell) {
      ctx.moveTo(x + 0.5, top);
      ctx.lineTo(x + 0.5, bottom);
    }
    for (let y = top; y < bottom; y += cell) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();
  }

  // 3. The vine, rendered once to its own canvas so we can sample it.
  const piece = document.createElement('canvas');
  const pieceOptions: PieceOptions = {
    seed: (seed ^ 0x9e3779b9) >>> 0,
    width: W * 0.92,
    height: H * 0.92,
    dpr,
    inks: [look.ink, look.field[0]!],
    accents: [look.hot, look.field[1]!],
    accentChance: 0.4,
    elegance: 0.6,
    geometric: chance(0.5) ? 0.5 : 0.15,
    stacks: chance(0.5) ? 5 : 1,
    density: 0.2,
    ground: 'transparent',
  };
  renderPiece(piece, pieceOptions);
  const pieceX = (W - piece.width) / 2;
  const pieceY = (H - piece.height) / 2;
  const pctx = piece.getContext('2d')!;
  const pdata = pctx.getImageData(0, 0, piece.width, piece.height).data;
  const alphaAt = (x: number, y: number) => {
    const sx = Math.round(x - pieceX);
    const sy = Math.round(y - pieceY);
    if (sx < 0 || sy < 0 || sx >= piece.width || sy >= piece.height) return 0;
    return pdata[(sy * piece.width + sx) * 4 + 3]! / 255;
  };

  // 4. Silhouettes: flat cutouts of the vine in paper or hot colour, offset like a misregistered print.
  const silhouettes = int(1, 3);
  for (let i = 0; i < silhouettes; i++) {
    const colour = chance(0.6) ? look.paper : look.hot;
    const dx = px(range(-14, 14));
    const dy = px(range(-10, 10));
    const sil = document.createElement('canvas');
    sil.width = piece.width;
    sil.height = piece.height;
    const sctx = sil.getContext('2d')!;
    const out = sctx.createImageData(piece.width, piece.height);
    const [r, g, b] = hexToRgb(colour);
    // Only a band of the piece is cut, so the silhouette reads as a fragment.
    const bandTop = piece.height * range(0, 0.6);
    const bandBottom = bandTop + piece.height * range(0.25, 0.5);
    for (let y = 0; y < piece.height; y++) {
      if (y < bandTop || y > bandBottom) continue;
      for (let x = 0; x < piece.width; x++) {
        const j = (y * piece.width + x) * 4;
        if (pdata[j + 3]! > 70) {
          out.data[j] = r;
          out.data[j + 1] = g;
          out.data[j + 2] = b;
          out.data[j + 3] = 255;
        }
      }
    }
    sctx.putImageData(out, 0, 0);
    ctx.globalAlpha = colour === look.paper ? 0.85 : 0.6;
    ctx.drawImage(sil, pieceX + dx, pieceY + dy);
    ctx.globalAlpha = 1;
  }

  // 5. The painted vine itself.
  ctx.drawImage(piece, pieceX, pieceY);

  // Coverage: mean alpha in a small neighbourhood, so masks follow the vine's shape softly.
  const coverage = (x: number, y: number, r: number) => {
    let a = alphaAt(x, y);
    a += alphaAt(x + r, y) + alphaAt(x - r, y) + alphaAt(x, y + r) + alphaAt(x, y - r);
    a += alphaAt(x + r * 0.7, y + r * 0.7) + alphaAt(x - r * 0.7, y - r * 0.7);
    return a / 7;
  };

  // Sections: bands of whole panels, so treatments align with the ruled structure.
  const panelX = (i: number) => Math.round((W * i) / panels);
  const section = () => {
    const from = int(0, panels - 2);
    const to = Math.min(panels, from + int(1, 3));
    const top = H * range(0, 0.6);
    return { x: panelX(from), w: panelX(to) - panelX(from), y: top, h: H * range(0.2, 0.4) };
  };

  // 6. ASCII: characters wherever the vine has coverage inside a region, on a paper backing
  //    that follows the same stepped outline, shifted a few cells like a misprinted plate.
  const asciiRegions = int(1, 2);
  for (let i = 0; i < asciiRegions; i++) {
    const cell = px(pick([7, 8, 10, 12]));
    const rx = W * range(0, 0.5);
    const ry = H * range(0, 0.55);
    const rw = W * range(0.28, 0.5);
    const rh = H * range(0.22, 0.42);
    const shift = int(-3, 3) * cell;
    const cols = Math.ceil(rw / cell);
    const rows = Math.ceil(rh / cell);
    const mask: number[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        mask.push(coverage(rx + c * cell + shift + cell / 2, ry + r * cell + cell / 2, cell * 1.3));
      }
    }
    const inside = (r: number, c: number) =>
      r >= 0 && c >= 0 && r < rows && c < cols && mask[r * cols + c]! > 0.05;
    // Backing first, then stepped edges, then the characters.
    ctx.fillStyle = withAlpha(look.paper, 0.72);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (inside(r, c)) ctx.fillRect(rx + c * cell, ry + r * cell, cell, cell);
    ctx.strokeStyle = withAlpha(look.ink, 0.55);
    ctx.lineWidth = px(1);
    ctx.beginPath();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!inside(r, c)) continue;
        const x0 = rx + c * cell;
        const y0 = ry + r * cell;
        if (!inside(r - 1, c)) {
          ctx.moveTo(x0, y0 + 0.5);
          ctx.lineTo(x0 + cell, y0 + 0.5);
        }
        if (!inside(r + 1, c)) {
          ctx.moveTo(x0, y0 + cell - 0.5);
          ctx.lineTo(x0 + cell, y0 + cell - 0.5);
        }
        if (!inside(r, c - 1)) {
          ctx.moveTo(x0 + 0.5, y0);
          ctx.lineTo(x0 + 0.5, y0 + cell);
        }
        if (!inside(r, c + 1)) {
          ctx.moveTo(x0 + cell - 0.5, y0);
          ctx.lineTo(x0 + cell - 0.5, y0 + cell);
        }
      }
    }
    ctx.stroke();
    ctx.fillStyle = chance(0.7) ? look.ink : look.hot;
    ctx.font = `${cell * 1.05}px ${FONT}`;
    ctx.textBaseline = 'top';
    const useDigits = chance(0.4);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = mask[r * cols + c]!;
        if (a < 0.06) continue;
        const ch = useDigits
          ? DIGITS[Math.floor(hash2(c, r + i * 97) * 10)]!
          : ASCII_RAMP[Math.min(ASCII_RAMP.length - 1, Math.floor(a * 1.6 * ASCII_RAMP.length))]!;
        ctx.fillText(ch, rx + c * cell, ry + r * cell);
      }
    }
  }

  // 7. Burn: inside one section the image becomes coarse blocks in the hot colour, each row
  //    bleeding sideways in runs, like a print that has soaked into the paper.
  if (chance(0.7)) {
    const sec = section();
    const block = px(pick([5, 6, 8, 10]));
    const cols = Math.ceil(sec.w / block);
    const rows = Math.ceil(sec.h / block);
    const grid: boolean[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cov = coverage(sec.x + c * block + block / 2, sec.y + r * block + block / 2, block);
        grid.push(cov > 0.05 && hash2(c, r) < 0.85);
      }
    }
    // Bleed: runs extend left or right by a few blocks with decreasing probability.
    const bled = grid.slice();
    for (let r = 0; r < rows; r++) {
      const dir = hash2(r, 3) < 0.5 ? 1 : -1;
      for (let c = 0; c < cols; c++) {
        if (!grid[r * cols + c]) continue;
        let run = Math.floor(hash2(c, r + 11) * 6);
        for (let k = 1; k <= run; k++) {
          const cc = c + k * dir;
          if (cc < 0 || cc >= cols) break;
          if (hash2(cc, r + 29) < 0.7) bled[r * cols + cc] = true;
        }
      }
    }
    ctx.globalCompositeOperation = 'multiply';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!bled[r * cols + c]) continue;
        const core = grid[r * cols + c];
        ctx.fillStyle = withAlpha(look.hot, core ? 0.85 : 0.45);
        ctx.fillRect(sec.x + c * block, sec.y + r * block, block, block);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    // A faint contour of the burn's outer edge in the second field colour.
    ctx.strokeStyle = withAlpha(look.field[1]!, 0.7);
    ctx.lineWidth = px(1);
    ctx.beginPath();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!bled[r * cols + c]) continue;
        const x0 = sec.x + c * block;
        const y0 = sec.y + r * block;
        if (r === 0 || !bled[(r - 1) * cols + c]) {
          ctx.moveTo(x0, y0 + 0.5);
          ctx.lineTo(x0 + block, y0 + 0.5);
        }
        if (c === 0 || !bled[r * cols + c - 1]) {
          ctx.moveTo(x0 + 0.5, y0);
          ctx.lineTo(x0 + 0.5, y0 + block);
        }
      }
    }
    ctx.stroke();
  }

  // 8. Data lines: one or two, in a random dialect: dotted, dashed, or a soft curve, with
  //    square, round or no nodes.
  const lines = int(1, 2);
  for (let l = 0; l < lines; l++) {
    const nodes: Vec[] = [];
    const count = int(4, 9);
    for (let i = 0; i < count; i++) {
      nodes.push([(W * (i + range(0.2, 0.8))) / count, H * range(0.12, 0.88)]);
    }
    const colour = chance(0.6) ? '#ffffff' : look.ink;
    const dialect = pick(['dotted', 'dashed', 'curve', 'solid'] as const);
    const node = pick(['square', 'circle', 'none', 'square'] as const);
    ctx.strokeStyle = withAlpha(colour, 0.9);
    ctx.lineWidth = px(dialect === 'solid' ? 0.8 : 1.2);
    ctx.lineCap = 'round';
    if (dialect === 'dotted') ctx.setLineDash([px(0.5), px(5)]);
    else if (dialect === 'dashed') ctx.setLineDash([px(6), px(5)]);
    ctx.beginPath();
    if (dialect === 'curve') {
      ctx.moveTo(nodes[0]![0], nodes[0]![1]);
      for (let i = 1; i < nodes.length; i++) {
        const [x0, y0] = nodes[i - 1]!;
        const [x1, y1] = nodes[i]!;
        const mx = (x0 + x1) / 2;
        ctx.bezierCurveTo(mx, y0, mx, y1, x1, y1);
      }
    } else {
      nodes.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (node !== 'none') {
      ctx.fillStyle = colour === '#ffffff' ? '#ffffff' : look.paper;
      ctx.strokeStyle = withAlpha(look.ink, 0.6);
      ctx.lineWidth = px(1);
      for (const [x, y] of nodes) {
        const sz = px(range(3.5, 5.5));
        if (node === 'square') {
          ctx.fillRect(x - sz, y - sz, sz * 2, sz * 2);
          ctx.strokeRect(x - sz + 0.5, y - sz + 0.5, sz * 2, sz * 2);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, sz, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    }
  }

  // 9. Figures: numbers, fractions, circled figures and arrows scattered thinly, plus number
  //    grids that live inside one or two panel-aligned sections, one carrying a large figure.
  const labelColour = chance(0.5) ? '#ffffff' : look.ink;
  ctx.fillStyle = labelColour;
  ctx.strokeStyle = labelColour;
  ctx.lineWidth = px(1);
  const labels = int(5, 12);
  for (let i = 0; i < labels; i++) {
    const x = W * range(0.03, 0.95);
    const y = H * range(0.03, 0.95);
    const size = px(pick([9, 10, 12, 14]));
    ctx.font = `${size}px ${FONT}`;
    const kind = rnd();
    if (kind < 0.5) ctx.fillText(String(int(1, 99)), x, y);
    else if (kind < 0.65) ctx.fillText(`${int(1, 9)}/${int(2, 9)}`, x, y);
    else if (kind < 0.8) {
      ctx.fillText(String(int(1, 99)), x, y);
      ctx.beginPath();
      ctx.arc(x + size * 0.6, y + size * 0.55, size * 0.95, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const ang = range(0, Math.PI * 2);
      const len = px(range(18, 40));
      const ex = x + Math.cos(ang) * len;
      const ey = y + Math.sin(ang) * len;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang - 0.5) * px(6), ey - Math.sin(ang - 0.5) * px(6));
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang + 0.5) * px(6), ey - Math.sin(ang + 0.5) * px(6));
      ctx.stroke();
    }
  }
  const grids = int(1, 2);
  for (let g = 0; g < grids; g++) {
    const sec = section();
    const step = px(pick([14, 18, 22]));
    const cols = Math.max(1, Math.floor(sec.w / step));
    const rows = Math.max(1, Math.floor(sec.h / step));
    ctx.font = `${px(6)}px ${FONT}`;
    ctx.fillStyle = withAlpha(look.ink, 0.4);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (hash2(c + g * 7, r) < 0.25) continue;
        ctx.fillText(
          String(int(0, 999)).padStart(3, '0'),
          sec.x + c * step + px(3),
          sec.y + r * step + px(4)
        );
      }
    }
    if (chance(0.7)) {
      // One large figure sits inside the grid, the way a score sits in a table.
      ctx.font = `${px(pick([28, 36, 44]))}px ${FONT}`;
      ctx.fillStyle = withAlpha(chance(0.5) ? look.ink : look.hot, 0.85);
      ctx.fillText(
        String(int(1, 99)),
        sec.x + sec.w * range(0.2, 0.6),
        sec.y + sec.h * range(0.3, 0.6)
      );
    }
  }
  // Corner mark: an edition number and a date stamp.
  ctx.font = `${px(8)}px ${FONT}`;
  ctx.fillStyle = look.ink;
  const mark = `#${int(1, 99)}   ${int(1, 28)} ${pick(['JAN', 'MAR', 'JUN', 'SEP', 'NOV'])} 2026`;
  ctx.fillText(mark, W - px(120), H - px(18));

  // 10. Grain over everything, so the print reads as one surface.
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const p = i / 4;
    const n = (hash2(p % W, Math.floor(p / W)) - 0.5) * 26;
    d[i] = Math.max(0, Math.min(255, d[i]! + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1]! + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2]! + n));
  }
  ctx.putImageData(img, 0, 0);
};

export { randomSeed };
