/**
 * A "plate": the vine piece reworked in the spirit of enigmatriz and gencup posters. A grainy
 * colour field, ruled panels, silhouettes cut out of the image, windows where the image is
 * translated into ASCII, a dashed data line with square nodes, and small pixel-font labels.
 * Still, seeded, and deterministic like the piece itself.
 */
import { randomSeed, renderPiece, type PieceOptions } from './piece';
import { segmentImage, segmentPath, type Segment } from './segments';

export type PlateStructure = 'rules' | 'sparse' | 'rows' | 'boxes' | 'masonry' | 'minigrid';

export type PlateOptions = {
  seed: number;
  width: number;
  height: number;
  dpr: number;
  /** Force a layout instead of letting the seed choose. */
  structure?: PlateStructure;
  /** A photo or drawing to treat instead of the vine. Covers the plate; palette is taken from it. */
  source?: CanvasImageSource & { width: number; height: number };
  /** 0..1, scales how much is done to a source image; default 0.6 for photos. */
  intensity?: number;
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
  const forced = options.structure;
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
  const light = options.source ? (options.intensity ?? 0.6) : 1;
  let look = pick(LOOKS);
  let piece = document.createElement('canvas');
  let pieceX = 0;
  let pieceY = 0;
  let subjects: Segment[] = [];
  let allSegments: Segment[] = [];
  if (options.source) {
    // Cover the plate with the image, then take a palette from it: ink from its darks, hot from
    // its most saturated sample, fields from lightened versions of both.
    const src = options.source;
    const scale = Math.max(W / src.width, H / src.height);
    piece.width = W;
    piece.height = H;
    const pc = piece.getContext('2d')!;
    pc.drawImage(
      src,
      (W - src.width * scale) / 2,
      (H - src.height * scale) / 2,
      src.width * scale,
      src.height * scale
    );
    const d = pc.getImageData(0, 0, W, H).data;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let n = 0;
    let best: [number, number, number] = [200, 90, 60];
    let bestScore = -1;
    for (let k = 0; k < 4000; k++) {
      const i = Math.floor(rnd() * (W * H)) * 4;
      const r = d[i]!;
      const g = d[i + 1]!;
      const b = d[i + 2]!;
      sr += r;
      sg += g;
      sb += b;
      n++;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const score = (mx - mn) * (mx / 255);
      if (score > bestScore) {
        bestScore = score;
        best = [r, g, b];
      }
    }
    const avg: [number, number, number] = [sr / n, sg / n, sb / n];
    const hex = (c: [number, number, number]) =>
      '#' +
      c
        .map((v) =>
          Math.round(Math.max(0, Math.min(255, v)))
            .toString(16)
            .padStart(2, '0')
        )
        .join('');
    const mix = (
      a: [number, number, number],
      b: [number, number, number],
      t: number
    ): [number, number, number] => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
    look = {
      paper: '#f4efe6',
      field: [hex(mix(avg, [255, 255, 255], 0.35)), hex(mix(best, [255, 255, 255], 0.45))],
      ink: hex(mix(avg, [20, 16, 28], 0.7)),
      hot: hex(best),
    };
  }
  const u = Math.min(W, H);
  const px = (n: number) => n * dpr;

  // 1. Ground: paper, then two broad colour fields that cross the frame diagonally. With a
  //    source image the image itself is the ground, under a thin veil so the fields still read.
  ctx.fillStyle = look.paper;
  ctx.fillRect(0, 0, W, H);
  if (options.source) {
    ctx.drawImage(piece, 0, 0);
    ctx.fillStyle = withAlpha(look.paper, 0.05);
    ctx.fillRect(0, 0, W, H);
  }
  const fieldAlpha = options.source ? 0.18 : 1;
  for (let i = 0; i < 2; i++) {
    const cx = W * (i === 0 ? range(0.1, 0.4) : range(0.6, 0.9));
    const cy = H * range(0.2, 0.8);
    const r = u * range(0.6, 1.1);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, withAlpha(look.field[i]!, 0.75 * fieldAlpha));
    g.addColorStop(0.6, withAlpha(look.field[i]!, 0.3 * fieldAlpha));
    g.addColorStop(1, withAlpha(look.field[i]!, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // 2. Structure: one layout per plate, drawn in white over the field. Panels stay the unit
  //    every later section aligns to, whatever the layout looks like.
  const panels = int(5, 9);
  const structure: PlateStructure =
    forced ??
    pick([
      'rules',
      'rules',
      'rules',
      'rows',
      'rows',
      'minigrid',
      'minigrid',
      'sparse',
      'boxes',
      'masonry',
    ] as const);
  const white = (a: number) => withAlpha('#ffffff', a);
  ctx.lineWidth = px(1);
  if (structure === 'rules' || structure === 'sparse') {
    ctx.strokeStyle = white(0.55);
    for (let i = 1; i < panels; i++) {
      if (structure === 'sparse' && hash2(i, seed % 97) < 0.45) continue;
      const x = Math.round((W * i) / panels) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
  } else if (structure === 'rows') {
    const rows = int(6, 14);
    ctx.strokeStyle = white(0.5);
    for (let i = 1; i < rows; i++) {
      if (hash2(i, 5) < 0.2) continue;
      const y = Math.round((H * i) / rows) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  } else if (structure === 'boxes') {
    // Outlined vertical boxes with a margin, some spanning the height, some shorter.
    const pad = px(range(6, 14));
    ctx.strokeStyle = white(0.7);
    for (let i = 0; i < panels; i++) {
      if (hash2(i, 13) < 0.25) continue;
      const x0 = Math.round((W * i) / panels) + pad;
      const x1 = Math.round((W * (i + 1)) / panels) - pad;
      const top = hash2(i, 17) < 0.5 ? pad : H * range(0.1, 0.5);
      const bottom = hash2(i, 19) < 0.5 ? H - pad : H * range(0.55, 0.95);
      ctx.strokeRect(x0 + 0.5, top + 0.5, x1 - x0, bottom - top);
      if (hash2(i, 23) < 0.35) {
        ctx.fillStyle = withAlpha(pick([look.field[0]!, look.field[1]!, look.hot]), 0.08);
        ctx.fillRect(x0, top, x1 - x0, bottom - top);
      }
    }
  } else if (structure === 'masonry') {
    // Translucent rectangles laid over one another like a masonry of panels: some tall and
    // narrow, some wide and short, starting from different edges so they overlap and stack.
    const count = int(6, 14);
    for (let i = 0; i < count; i++) {
      const tall = chance(0.6);
      const w = tall ? W * range(0.06, 0.2) : W * range(0.2, 0.5);
      const h = tall ? H * range(0.25, 0.8) : H * range(0.06, 0.2);
      const x = W * range(-0.05, 0.95);
      const anchorTop = chance(0.5);
      const y = anchorTop ? H * range(-0.05, 0.4) : H - h - H * range(-0.05, 0.4);
      ctx.fillStyle = withAlpha(
        pick([look.field[0]!, look.field[1]!, look.hot, look.paper, '#ffffff']),
        range(0.06, 0.14)
      );
      ctx.fillRect(x, y, w, h);
      if (chance(0.7)) {
        ctx.strokeStyle = white(range(0.3, 0.6));
        ctx.strokeRect(x + 0.5, y + 0.5, w, h);
      }
    }
    if (chance(0.5)) {
      // A stepped profile, after old printed charts: a stack of bars following a soft curve.
      const sx = W * range(0.05, 0.5);
      const sy = H * range(0.05, 0.35);
      const step = px(range(6, 10));
      const steps = int(10, 26);
      const maxLen = W * range(0.15, 0.35);
      ctx.fillStyle = withAlpha(pick([look.paper, look.field[1]!, look.hot]), 0.18);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const len = maxLen * (0.15 + 0.85 * Math.sin(t * Math.PI) ** 1.4);
        ctx.lineTo(sx + len, sy + i * step);
        ctx.lineTo(sx + len, sy + (i + 1) * step);
      }
      ctx.lineTo(sx, sy + (steps + 1) * step);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = withAlpha(look.ink, 0.35);
      ctx.stroke();
    }
  } else {
    // A subtle mini grid over part of the plate.
    const cell = px(range(6, 10));
    const gx = W * range(0, 0.4);
    const gy = H * range(0, 0.4);
    const gw = W * range(0.4, 0.8);
    const gh = H * range(0.3, 0.7);
    ctx.strokeStyle = white(0.28);
    ctx.lineWidth = px(0.6);
    ctx.beginPath();
    for (let x = gx; x < gx + gw; x += cell) {
      ctx.moveTo(x + 0.5, gy);
      ctx.lineTo(x + 0.5, gy + gh);
    }
    for (let y = gy; y < gy + gh; y += cell) {
      ctx.moveTo(gx, y + 0.5);
      ctx.lineTo(gx + gw, y + 0.5);
    }
    ctx.stroke();
  }
  if ((structure === 'rules' || structure === 'boxes') && chance(0.5)) {
    // Bracketed indices at the head of each panel, like a numbered schematic sheet.
    ctx.font = `${px(7)}px ${FONT}`;
    ctx.fillStyle = withAlpha(look.ink, 0.6);
    ctx.textBaseline = 'top';
    for (let i = 0; i < panels; i++) {
      ctx.fillText(
        `[${String(i + 1).padStart(2, '0')}]`,
        Math.round((W * i) / panels) + px(6),
        px(8)
      );
    }
  }
  if (chance(0.7) && structure !== 'minigrid') {
    // A fine grid band inside the structure, like graph paper showing through.
    const cell = px(range(8, 14));
    const top = H * range(0, 0.5);
    const bottom = top + H * range(0.2, 0.45);
    ctx.strokeStyle = white(0.2);
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

  if (
    options.source &&
    (structure === 'rules' || structure === 'sparse' || structure === 'boxes')
  ) {
    const panelOrder = Array.from({ length: panels }, (_, i) => i);
    for (let i = panelOrder.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [panelOrder[i], panelOrder[j]] = [panelOrder[j]!, panelOrder[i]!];
    }
    // Only modes that keep the picture legible: multiply darkens a little, overlay adds contrast.
    const blendModes = ['multiply', 'overlay'] as const;
    for (const panel of panelOrder.slice(0, int(1, 3))) {
      const x0 = Math.round((W * panel) / panels);
      const x1 = Math.round((W * (panel + 1)) / panels);
      ctx.save();
      ctx.globalCompositeOperation = pick(blendModes);
      ctx.globalAlpha = range(0.3, 0.5);
      ctx.drawImage(piece, x0, 0, x1 - x0, H, x0, 0, x1 - x0, H);
      ctx.restore();
      ctx.strokeStyle = white(0.9);
      ctx.lineWidth = px(1);
      ctx.strokeRect(x0 + 0.5, 0.5, x1 - x0 - 1, H - 1);
    }
  }

  // 3. The subject. Either the vine, rendered once to its own canvas so we can sample its alpha,
  //    or the source image, for which a feature map (edges plus darkness) plays the role of alpha
  //    so every later treatment follows the picture's structure.
  let alphaAt: (x: number, y: number) => number;
  if (options.source) {
    const pc = piece.getContext('2d')!;
    const d = pc.getImageData(0, 0, W, H).data;
    const luma = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++)
      luma[i] = (d[i * 4]! * 0.299 + d[i * 4 + 1]! * 0.587 + d[i * 4 + 2]! * 0.114) / 255;
    const feature = new Float32Array(W * H);
    const step = Math.max(1, Math.round(dpr));
    for (let y = step; y < H - step; y++) {
      for (let x = step; x < W - step; x++) {
        const i = y * W + x;
        const gx = luma[i + step]! - luma[i - step]!;
        const gy = luma[i + step * W]! - luma[i - step * W]!;
        const edge = Math.min(1, Math.hypot(gx, gy) * 4);
        feature[i] = Math.min(1, edge * 0.8 + (1 - luma[i]!) * 0.45);
      }
    }
    alphaAt = (x, y) => {
      const sx = Math.round(x);
      const sy = Math.round(y);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) return 0;
      return feature[sy * W + sx]!;
    };
    const segments = segmentImage(piece, seed);
    allSegments = segments;
    // Subjects: salient but not the backdrop. Anything over a third of the image is ground,
    // and slivers under a percent are noise; fall back to the raw ranking if nothing fits.
    const fitting = segments.filter((seg) => seg.area <= 0.34 && seg.area >= 0.01);
    subjects = (fitting.length > 0 ? fitting : segments).slice(0, 4);
  } else {
    piece = document.createElement('canvas');
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
    pieceX = (W - piece.width) / 2;
    pieceY = (H - piece.height) / 2;
    const pctx = piece.getContext('2d')!;
    const pdata = pctx.getImageData(0, 0, piece.width, piece.height).data;
    alphaAt = (x, y) => {
      const sx = Math.round(x - pieceX);
      const sy = Math.round(y - pieceY);
      if (sx < 0 || sy < 0 || sx >= piece.width || sy >= piece.height) return 0;
      return pdata[(sy * piece.width + sx) * 4 + 3]! / 255;
    };
  }
  // Mask of the subject in piece coordinates, used for silhouettes.
  const maskAt = (x: number, y: number) =>
    alphaAt(pieceX + x, pieceY + y) > (options.source ? 0.3 : 0.27);

  // Coverage: mean alpha in a small neighbourhood, so masks follow the vine's shape softly.
  const coverage = (x: number, y: number, r: number) => {
    let a = alphaAt(x, y);
    a += alphaAt(x + r, y) + alphaAt(x - r, y) + alphaAt(x, y + r) + alphaAt(x, y - r);
    a += alphaAt(x + r * 0.7, y + r * 0.7) + alphaAt(x - r * 0.7, y - r * 0.7);
    return a / 7;
  };

  // Points on the vine: rejection-sampled where the drawing has ink, so marks can sit on it.
  const vinePoints = (n: number, minAlpha = 0.18): Vec[] => {
    const pts: Vec[] = [];
    for (let tries = 0; tries < n * 60 && pts.length < n; tries++) {
      const x = pieceX + piece.width * rnd();
      const y = pieceY + piece.height * rnd();
      if (alphaAt(x, y) > minAlpha) pts.push([x, y]);
    }
    return pts;
  };

  // 4. Silhouettes: flat cutouts of the vine in paper or hot colour, offset like a misregistered print.
  // Photos get their cutouts from the segment layers instead; a feature-map silhouette of a
  // textured photo is just a flat mass.
  const silhouettes = options.source ? 0 : int(1, 3);
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
        if (maskAt(x, y)) {
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

  // 5. The subject itself over its silhouettes; source images get a small organized menu of
  //    segment and panel treatments, followed by vines that sprawl in from the plate edges.
  if (!options.source) ctx.drawImage(piece, pieceX, pieceY);
  else {
    const segmentMaskAt = (segment: Segment, x: number, y: number) => {
      const sx = Math.max(0, Math.min(segment.mw - 1, Math.floor(x / segment.scale)));
      const sy = Math.max(0, Math.min(segment.mh - 1, Math.floor(y / segment.scale)));
      return segment.mask[sy * segment.mw + sx] === 1;
    };
    const pickSubject = () => (subjects.length ? pick(subjects) : undefined);
    // Holes and moves must stay small, or the picture turns into paper.
    const pickSmallSubject = () => {
      // Compact as well as small: a sprawling blob's outline fills its holes when painted.
      const small = subjects.filter(
        (seg) => seg.area <= 0.1 && (seg.bbox.w * seg.bbox.h) / (W * H) <= 0.16
      );
      return small.length ? pick(small) : undefined;
    };
    const bounds = (segment: Segment) => {
      const x = Math.max(0, Math.floor(segment.bbox.x));
      const y = Math.max(0, Math.floor(segment.bbox.y));
      const right = Math.min(W, Math.ceil(segment.bbox.x + segment.bbox.w));
      const bottom = Math.min(H, Math.ceil(segment.bbox.y + segment.bbox.h));
      return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
    };
    const offset = (position: number, size: number, total: number) => {
      const direction = chance(0.5) ? 1 : -1;
      const distance = range(total * 0.15, total * 0.4);
      return direction > 0
        ? Math.min(distance, Math.max(0, total - position - size))
        : -Math.min(distance, Math.max(0, position));
    };

    const cutoutMove = () => {
      const segment = pickSmallSubject();
      if (!segment) return;
      const dx = offset(segment.bbox.x, segment.bbox.w, W);
      const dy = offset(segment.bbox.y, segment.bbox.h, H);
      ctx.save();
      ctx.translate(dx, dy);
      segmentPath(ctx, segment);
      ctx.clip();
      ctx.drawImage(piece, 0, 0);
      ctx.restore();
      ctx.save();
      segmentPath(ctx, segment);
      ctx.fillStyle = withAlpha('#ffffff', 0.96);
      ctx.fill();
      ctx.strokeStyle = withAlpha(look.ink, 0.5);
      ctx.lineWidth = px(1);
      ctx.stroke();
      ctx.restore();
    };

    const cutoutHole = () => {
      const segment = pickSmallSubject();
      if (!segment) return;
      ctx.save();
      segmentPath(ctx, segment);
      ctx.fillStyle = withAlpha('#ffffff', 0.96);
      ctx.fill();
      ctx.strokeStyle = withAlpha(look.ink, 0.5);
      ctx.lineWidth = px(1);
      ctx.setLineDash([px(4), px(4)]);
      ctx.stroke();
      ctx.restore();
    };

    const segmentAscii = () => {
      const segment = pickSmallSubject();
      if (!segment) return;
      const cell = px(pick([7, 8, 10, 12]));
      const rx = segment.bbox.x;
      const ry = segment.bbox.y;
      const cols = Math.max(1, Math.ceil(segment.bbox.w / cell));
      const rows = Math.max(1, Math.ceil(segment.bbox.h / cell));
      const mask: number[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = rx + c * cell + cell / 2;
          const y = ry + r * cell + cell / 2;
          mask.push(segmentMaskAt(segment, x, y) ? coverage(x, y, cell * 1.3) : 0);
        }
      }
      const inside = (r: number, c: number) => {
        if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
        const x = rx + c * cell + cell / 2;
        const y = ry + r * cell + cell / 2;
        return segmentMaskAt(segment, x, y) && mask[r * cols + c]! > 0.03;
      };
      ctx.fillStyle = withAlpha(look.paper, 0.35);
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
          const amount = mask[r * cols + c]!;
          if (amount < 0.03 || !inside(r, c)) continue;
          const char = useDigits
            ? DIGITS[Math.floor(hash2(c, r) * 10)]!
            : ASCII_RAMP[
                Math.min(ASCII_RAMP.length - 1, Math.floor(amount * 1.6 * ASCII_RAMP.length))
              ]!;
          ctx.fillText(char, rx + c * cell, ry + r * cell);
        }
      }
    };

    const segmentDither = () => {
      const segment = pickSubject();
      if (!segment) return;
      const area = bounds(segment);
      const cell = Math.max(1, Math.round(px(pick([2, 3, 4]))));
      const region = ctx.getImageData(area.x, area.y, area.w, area.h);
      const rd = region.data;
      const [ir, ig, ib] = hexToRgb(look.ink);
      const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      for (let y = 0; y < area.h; y++) {
        for (let x = 0; x < area.w; x++) {
          if (!segmentMaskAt(segment, area.x + x + 0.5, area.y + y + 0.5)) continue;
          const i = (y * area.w + x) * 4;
          const luma = (rd[i]! * 0.299 + rd[i + 1]! * 0.587 + rd[i + 2]! * 0.114) / 255;
          const threshold =
            (bayer[(((y / cell) | 0) & 3) * 4 + (((x / cell) | 0) & 3)]! + 0.5) / 16;
          // Ink only where the screen says so; the picture stays underneath everywhere else.
          if (luma >= threshold) continue;
          rd[i] = ir;
          rd[i + 1] = ig;
          rd[i + 2] = ib;
        }
      }
      ctx.save();
      segmentPath(ctx, segment);
      ctx.clip();
      ctx.putImageData(region, area.x, area.y);
      ctx.restore();
    };

    const channelSplitSegment = () => {
      const segment = pickSubject();
      if (!segment) return;
      const area = bounds(segment);
      const shift = Math.round(px(range(3, 10)));
      const region = ctx.getImageData(area.x, area.y, area.w, area.h);
      const rd = region.data;
      const copy = rd.slice();
      for (let y = 0; y < area.h; y++) {
        for (let x = 0; x < area.w; x++) {
          if (!segmentMaskAt(segment, area.x + x + 0.5, area.y + y + 0.5)) continue;
          const i = (y * area.w + x) * 4;
          const xr = Math.min(area.w - 1, Math.max(0, x - shift));
          const xb = Math.min(area.w - 1, Math.max(0, x + shift));
          rd[i] = copy[(y * area.w + xr) * 4]!;
          rd[i + 2] = copy[(y * area.w + xb) * 4 + 2]!;
        }
      }
      ctx.save();
      segmentPath(ctx, segment);
      ctx.clip();
      ctx.putImageData(region, area.x, area.y);
      ctx.restore();
    };

    const pixelSortBand = () => {
      const y0 = Math.round(H * range(0.1, 0.8));
      const bh = Math.max(1, Math.round(H * range(0.03, 0.08)));
      const x0 = Math.round(W * range(0, 0.5));
      const bw = Math.max(1, Math.round(W * range(0.3, 0.6)));
      const band = ctx.getImageData(x0, y0, bw, bh);
      const bd = band.data;
      const row: number[] = Array.from({ length: bw }, (_, c) => c);
      for (let r = 0; r < bh; r++) {
        for (let c = 0; c < bw; c++) row[c] = c;
        const base = r * bw;
        row.sort((p, q) => {
          const ip = (base + p) * 4;
          const iq = (base + q) * 4;
          return bd[ip]! + bd[ip + 1]! + bd[ip + 2]! - (bd[iq]! + bd[iq + 1]! + bd[iq + 2]!);
        });
        const copy = bd.slice(base * 4, (base + bw) * 4);
        for (let c = 0; c < bw; c++) {
          const from = row[c]! * 4;
          const to = (base + c) * 4;
          bd[to] = copy[from]!;
          bd[to + 1] = copy[from + 1]!;
          bd[to + 2] = copy[from + 2]!;
        }
      }
      ctx.putImageData(band, x0, y0);
    };

    const specimenStrip = () => {
      if (!subjects.length) return;
      const boxes = Math.min(subjects.length, int(4, 6));
      const strip = pick(['top', 'bottom'] as const);
      const bw = Math.round(W * range(0.05, 0.09));
      let cursor = W * 0.06;
      const stripY = strip === 'top' ? H * 0.03 : H * 0.97 - bw;
      for (const segment of subjects.slice(0, boxes)) {
        if (cursor + bw > W) break;
        const cx = segment.bbox.x + segment.bbox.w / 2;
        const cy = segment.bbox.y + segment.bbox.h / 2;
        const bx = Math.max(0, Math.min(W - bw, Math.round(cx - bw / 2)));
        const by = Math.max(0, Math.min(H - bw, Math.round(cy - bw / 2)));
        ctx.drawImage(piece, bx, by, bw, bw, cursor, stripY, bw, bw);
        ctx.strokeStyle = withAlpha(look.ink, 0.5);
        ctx.lineWidth = px(1);
        ctx.strokeRect(cursor + 0.5, stripY + 0.5, bw, bw);
        ctx.fillStyle = withAlpha('#ffffff', 0.97);
        ctx.fillRect(bx, by, bw, bw);
        cursor += bw + px(8);
      }
    };

    const mosaicLift = () => {
      if (!subjects.length) return;
      const cell = Math.max(1, Math.round(px(pick([8, 10, 14]))));
      const rw = Math.round(W * range(0.2, 0.4));
      const rh = Math.round(H * range(0.15, 0.35));
      const rx = Math.round(W * range(0, 1 - rw / W));
      const ry = Math.round(H * range(0, 1 - rh / H));
      const ox = Math.round(W * range(-0.3, 0.3));
      const oy = Math.round(H * range(-0.25, 0.25));
      const cols = Math.floor(rw / cell);
      const rows = Math.floor(rh / cell);
      const chosen: Array<[number, number]> = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = rx + c * cell;
          const y = ry + r * cell;
          const inSubject = subjects.some((segment) =>
            segmentMaskAt(segment, x + cell / 2, y + cell / 2)
          );
          if (inSubject) chosen.push([x, y]);
        }
      }
      for (const [x, y] of chosen) {
        const tx = x + ox;
        const ty = y + oy;
        if (tx >= 0 && ty >= 0 && tx + cell <= W && ty + cell <= H)
          ctx.drawImage(piece, x, y, cell, cell, tx, ty, cell, cell);
      }
      ctx.fillStyle = withAlpha('#ffffff', 0.96);
      for (const [x, y] of chosen) ctx.fillRect(x, y, cell, cell);
    };

    // Seams: cut the picture along its largest segment boundaries into a few layers and shift
    // each a little, with a paper gap where it moved from, a faint shadow and a hairline seam,
    // so the photo reads as a paper collage before anything else touches it.
    const layerSegs = [...allSegments]
      .filter((seg) => seg.area >= 0.025 && seg.area <= 0.6)
      .sort((a, b) => b.area - a.area)
      .slice(0, int(2, 4));
    for (const seg of layerSegs) {
      const dx = W * range(-0.02, 0.02);
      const dy = H * range(-0.015, 0.015);
      ctx.save();
      segmentPath(ctx, seg);
      ctx.clip();
      ctx.fillStyle = withAlpha(look.paper, 0.3);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      ctx.save();
      ctx.translate(dx + px(3), dy + px(3));
      segmentPath(ctx, seg);
      ctx.fillStyle = withAlpha(look.ink, 0.1);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(dx, dy);
      segmentPath(ctx, seg);
      ctx.clip();
      ctx.drawImage(piece, 0, 0);
      if (chance(0.6)) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = withAlpha(pick([look.field[0]!, look.field[1]!, look.hot]), 0.1);
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
      ctx.save();
      ctx.translate(dx, dy);
      segmentPath(ctx, seg);
      ctx.strokeStyle = chance(0.5) ? white(0.85) : withAlpha(look.ink, 0.45);
      ctx.lineWidth = px(1);
      ctx.stroke();
      ctx.restore();
    }

    const treatments: Array<() => void> = [
      cutoutMove,
      cutoutHole,
      segmentAscii,
      segmentDither,
      channelSplitSegment,
      pixelSortBand,
      specimenStrip,
      mosaicLift,
    ];
    for (let i = treatments.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [treatments[i], treatments[j]] = [treatments[j]!, treatments[i]!];
    }
    const treatmentCount = 2 + (chance(0.3) ? 1 : 0);
    for (const treatment of treatments.slice(0, treatmentCount)) treatment();

    const vineLayer = document.createElement('canvas');
    vineLayer.width = W;
    vineLayer.height = H;
    const vineLayerCtx = vineLayer.getContext('2d')!;
    const vineWidth = Math.max(1, Math.round(W * 0.55));
    const vineHeight = Math.max(1, Math.round(H * 0.45));
    for (let i = 0, count = int(2, 3); i < count; i++) {
      const vine = document.createElement('canvas');
      renderPiece(vine, {
        seed: seed ^ (0x51ed27 * (i + 1)),
        width: vineWidth,
        height: vineHeight,
        dpr,
        inks: [look.ink, look.field[0]!],
        accents: [look.hot, look.field[1]!],
        accentChance: 0.4,
        stacks: 1,
        elegance: 0.5,
        geometric: 0.15,
        ground: 'transparent',
      });
      const edge = int(0, 3);
      const along = edge < 2 ? H * range(0, 1) : W * range(0, 1);
      const x =
        edge === 0
          ? W * 0.1 - vineWidth / 2
          : edge === 1
            ? W * 0.9 - vineWidth / 2
            : along - vineWidth / 2;
      const y =
        edge === 2
          ? H * 0.1 - vineHeight / 2
          : edge === 3
            ? H * 0.9 - vineHeight / 2
            : along - vineHeight / 2;
      vineLayerCtx.drawImage(vine, x, y);
    }
    ctx.save();
    ctx.globalCompositeOperation = pick(['multiply', 'overlay'] as const);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(vineLayer, 0, 0);
    ctx.restore();
  }

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
  // Photos get their ASCII through the segment treatment only, never the loose rectangle.
  const asciiRegions = options.source ? 0 : int(1, 2);
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
    ctx.fillStyle = withAlpha(look.paper, options.source ? 0.25 : 0.72);
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
    const inkColour = chance(0.7) ? look.ink : look.hot;
    ctx.fillStyle = inkColour;
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
  if (chance(options.source ? 0.35 * light : 0.7 * light)) {
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
  const lines = options.source ? 1 : int(1, 2);
  for (let l = 0; l < lines; l++) {
    // Most nodes sit on the vine, so the line stitches the drawing together; a few wander off.
    const count = int(4, 8);
    const nodes: Vec[] = vinePoints(count).map((pt): Vec =>
      chance(0.25) ? [W * range(0.05, 0.95), H * range(0.1, 0.9)] : pt
    );
    nodes.sort((p, q) => p[0] - q[0]);
    if (nodes.length < 2) continue;
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

  // 9. Arrows: few, long and translucent, often entering from off-frame, straight or curved,
  //    with a small open head; sometimes a dot at the tail.
  const arrows = int(0, 3);
  for (let i = 0; i < arrows; i++) {
    const colour = withAlpha(chance(0.6) ? '#ffffff' : look.ink, range(0.35, 0.7));
    const fromEdge = chance(0.6);
    const ex = W * range(0.15, 0.85);
    const ey = H * range(0.15, 0.85);
    let sx: number;
    let sy: number;
    if (fromEdge) {
      const side = int(0, 3);
      sx = side === 0 ? -px(20) : side === 1 ? W + px(20) : W * range(0, 1);
      sy = side === 2 ? -px(20) : side === 3 ? H + px(20) : H * range(0, 1);
    } else {
      const ang = range(0, Math.PI * 2);
      const len = u * range(0.12, 0.35);
      sx = ex - Math.cos(ang) * len;
      sy = ey - Math.sin(ang) * len;
    }
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = px(range(0.7, 1.3));
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    let ang: number;
    if (chance(0.5)) {
      const cx = (sx + ex) / 2 + (rnd() - 0.5) * u * 0.3;
      const cy = (sy + ey) / 2 + (rnd() - 0.5) * u * 0.3;
      ctx.quadraticCurveTo(cx, cy, ex, ey);
      ang = Math.atan2(ey - cy, ex - cx);
    } else {
      ctx.lineTo(ex, ey);
      ang = Math.atan2(ey - sy, ex - sx);
    }
    ctx.stroke();
    const head = px(range(5, 9));
    ctx.beginPath();
    ctx.moveTo(ex - Math.cos(ang - 0.45) * head, ey - Math.sin(ang - 0.45) * head);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex - Math.cos(ang + 0.45) * head, ey - Math.sin(ang + 0.45) * head);
    ctx.stroke();
    if (!fromEdge && chance(0.5)) {
      ctx.beginPath();
      ctx.arc(sx, sy, px(2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Markers, after okazz: small circles, squares, quarter-discs, crosses and lollipops, in the
  // plate's colours. Either scattered thinly or set on a sparse grid inside a section.
  const marker = (x: number, y: number, size: number) => {
    const colour = pick([look.ink, look.hot, look.field[0]!, look.field[1]!, '#ffffff']);
    ctx.fillStyle = colour;
    ctx.strokeStyle = colour;
    ctx.lineWidth = px(1);
    const kind = rnd();
    ctx.beginPath();
    if (kind < 0.25) {
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      if (chance(0.5)) ctx.fill();
      else ctx.stroke();
    } else if (kind < 0.45) {
      if (chance(0.5)) ctx.fillRect(x - size / 2, y - size / 2, size, size);
      else ctx.strokeRect(x - size / 2 + 0.5, y - size / 2 + 0.5, size, size);
    } else if (kind < 0.6) {
      // Quarter disc.
      const start = pick([0, Math.PI / 2, Math.PI, Math.PI * 1.5]);
      ctx.moveTo(x, y);
      ctx.arc(x, y, size / 2, start, start + Math.PI / 2);
      ctx.closePath();
      ctx.fill();
    } else if (kind < 0.75) {
      ctx.moveTo(x - size / 2, y);
      ctx.lineTo(x + size / 2, y);
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x, y + size / 2);
      ctx.stroke();
    } else if (kind < 0.88) {
      // Lollipop: a dot on a stem.
      ctx.moveTo(x, y + size);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Half disc.
      ctx.arc(x, y, size / 2, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }
  };
  if (chance(options.source ? 0.36 : 0.6)) {
    const sec = section();
    const step = px(pick([16, 20, 26]));
    const cols = Math.max(1, Math.floor(sec.w / step));
    const rows = Math.max(1, Math.floor(sec.h / step));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = sec.x + c * step + step / 2;
        const y = sec.y + r * step + step / 2;
        // The grid only fills where the drawing is, softly, so it reads as part of it.
        const cov = coverage(x, y, step);
        if (cov < 0.04 || hash2(c + 41, r + 43) > 0.35 + cov * 2) continue;
        marker(x, y, px(range(4, 9)));
      }
    }
  }
  for (const [x, y] of vinePoints(int(3, 7), 0.3)) marker(x, y, px(range(4, 11)));

  // Figures: a few numbers and fractions set larger and cleaner, and number grids inside one or
  // two panel-aligned sections, often with one large figure.
  const labelColour = chance(0.5) ? '#ffffff' : look.ink;
  ctx.fillStyle = withAlpha(labelColour, 0.85);
  ctx.textBaseline = 'top';
  const labelPoints = vinePoints(int(1, 3), 0.12);
  for (const [x, y] of labelPoints) {
    ctx.font = `${px(pick([12, 14, 18]))}px ${FONT}`;
    const text = chance(0.7) ? String(int(10, 99)) : `${int(1, 9)}/${int(2, 9)}`;
    // Set just off the drawing, like a caption to a detail.
    ctx.fillText(text, x + px(range(10, 26)), y - px(range(6, 18)));
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
      ctx.font = `${px(pick([28, 36, 44]))}px ${FONT}`;
      ctx.fillStyle = withAlpha(chance(0.5) ? look.ink : look.hot, 0.85);
      ctx.fillText(
        String(int(1, 99)),
        sec.x + sec.w * range(0.2, 0.6),
        sec.y + sec.h * range(0.3, 0.6)
      );
    }
  }
  // Frame: sometimes a double rule with an inner margin, like a printed plate.
  // Frame: rare, and never whole. Each side is drawn as a few segments with gaps, and one side
  //    may be missing or shifted, like a plate whose border was trimmed by hand.
  if (chance(0.15)) {
    const m = px(range(10, 22));
    ctx.strokeStyle = withAlpha(look.ink, 0.55);
    ctx.lineWidth = px(1);
    const sides: Array<[Vec, Vec]> = [
      [
        [m, m],
        [W - m, m],
      ],
      [
        [W - m, m],
        [W - m, H - m],
      ],
      [
        [W - m, H - m],
        [m, H - m],
      ],
      [
        [m, H - m],
        [m, m],
      ],
    ];
    const missing = int(0, 3);
    sides.forEach(([p0, p1], i) => {
      if (i === missing && chance(0.6)) return;
      const shift = chance(0.3) ? px(range(-8, 8)) : 0;
      const segments = int(1, 4);
      let t = 0;
      ctx.beginPath();
      for (let k = 0; k < segments; k++) {
        const len = range(0.15, 0.6) * (1 - t);
        const gap = range(0.03, 0.12);
        const a = t;
        const b = Math.min(1, t + len);
        const sx = i % 2 === 0 ? 0 : shift;
        const sy = i % 2 === 0 ? shift : 0;
        ctx.moveTo(p0[0] + (p1[0] - p0[0]) * a + sx + 0.5, p0[1] + (p1[1] - p0[1]) * a + sy + 0.5);
        ctx.lineTo(p0[0] + (p1[0] - p0[0]) * b + sx + 0.5, p0[1] + (p1[1] - p0[1]) * b + sy + 0.5);
        t = b + gap;
        if (t >= 1) break;
      }
      ctx.stroke();
    });
  }
  // Corner mark: an edition number and a date stamp.
  ctx.font = `${px(8)}px ${FONT}`;
  ctx.fillStyle = look.ink;
  const now = new Date();
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  const mark = `${seed.toString(16).padStart(8, '0')}   ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  ctx.textAlign = 'right';
  ctx.fillText(mark, W - px(14), H - px(18));
  ctx.textAlign = 'left';

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
