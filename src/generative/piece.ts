/**
 * A still generative image built from fragments of three algorithms: Maurer rose chords,
 * Penrose P3 rhombi from de Bruijn's pentagrid, and Lissajous arcs. None appears whole.
 * Fragments are faded along their length, seamed over each other, backed by soft washes,
 * then everything is ordered-dithered into flat pixels of one or two inks.
 * See docs/generative.md.
 */

export type PieceOptions = {
  seed: number;
  /** Output size in device pixels. Any aspect ratio; element sizes scale from the short side. */
  width: number;
  height: number;
  /** Device pixel ratio; line weights and dither cells scale with it. */
  dpr: number;
  /** Deep ink and mid wash colours as hex. */
  inks: [string] | [string, string];
  /** Optional accent pigments; some elements pick one, and their wash carries it into the surroundings. */
  accents?: string[];
  /** Probability that an element takes an accent pigment (0..1). */
  accentChance?: number;
  /** 0 is wild and splotchy, 1 is spare and calligraphic; default 0.5. */
  elegance?: number;
  /** 0 is flowing, 1 is almost purely geometric: angular stem, polygon petals and pools. */
  geometric?: number;
  /** How many vines to stack; above 1 each vine takes its own FIELDS palette and direction. */
  stacks?: number;
  ground: 'white' | 'transparent';
};

type Vec = [number, number];

// --- seeded randomness -------------------------------------------------------------------

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

type Rng = {
  next: () => number;
  range: (lo: number, hi: number) => number;
  int: (lo: number, hi: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (p: number) => boolean;
};

const makeRng = (seed: number): Rng => {
  const next = mulberry32(seed);
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (items) => items[Math.floor(next() * items.length)]!,
    chance: (p) => next() < p,
  };
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
};

// --- geometry ----------------------------------------------------------------------------

const rotate = ([x, y]: Vec, angle: number): Vec => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c - y * s, x * s + y * c];
};

const place = (points: Vec[], center: Vec, scale: number, angle: number): Vec[] =>
  points.map((p) => {
    const [x, y] = rotate(p, angle);
    return [center[0] + x * scale, center[1] + y * scale];
  });

/** Chords of a Maurer rose, r = sin(n·θ) sampled at θ = k·d degrees; returns a contiguous arc. */
const maurerArc = (n: number, d: number, start: number, length: number): Vec[] => {
  const pts: Vec[] = [];
  for (let k = start; k <= start + length; k++) {
    const theta = (k * d * Math.PI) / 180;
    const r = Math.sin(n * theta);
    pts.push([r * Math.cos(theta), r * Math.sin(theta)]);
  }
  return pts;
};

/** A stretch of a Lissajous curve. */
const lissajousArc = (a: number, b: number, delta: number, t0: number, span: number): Vec[] => {
  const pts: Vec[] = [];
  const steps = Math.max(24, Math.round(span * 60));
  for (let i = 0; i <= steps; i++) {
    const t = t0 + (span * i) / steps;
    pts.push([Math.sin(a * t + delta), Math.sin(b * t)]);
  }
  return pts;
};

/**
 * Penrose P3 rhombi via de Bruijn's pentagrid. Five families of parallel lines
 * x·e_j = k + γ_j; every intersection of two families is one rhombus whose vertices are
 * Σ K_j e_j with K taken on either side of the two crossing lines.
 */
const penroseRhombi = (gammas: number[], extent: number): Vec[][] => {
  const e: Vec[] = [];
  for (let j = 0; j < 5; j++) {
    const a = (2 * Math.PI * j) / 5;
    e.push([Math.cos(a), Math.sin(a)]);
  }
  const rhombi: Vec[][] = [];
  for (let r = 0; r < 5; r++) {
    for (let s = r + 1; s < 5; s++) {
      const [ex1, ey1] = e[r]!;
      const [ex2, ey2] = e[s]!;
      const det = ex1 * ey2 - ey1 * ex2;
      for (let kr = -extent; kr <= extent; kr++) {
        for (let ks = -extent; ks <= extent; ks++) {
          const c1 = kr + gammas[r]!;
          const c2 = ks + gammas[s]!;
          // Intersection of the two grid lines.
          const x = (c1 * ey2 - c2 * ey1) / det;
          const y = (ex1 * c2 - ex2 * c1) / det;
          const K: number[] = [];
          for (let j = 0; j < 5; j++) {
            K.push(Math.ceil(x * e[j]![0] + y * e[j]![1] - gammas[j]!));
          }
          const vertex = (dr: number, ds: number): Vec => {
            let vx = 0;
            let vy = 0;
            for (let j = 0; j < 5; j++) {
              const kj = j === r ? kr + dr : j === s ? ks + ds : K[j]!;
              vx += kj * e[j]![0];
              vy += kj * e[j]![1];
            }
            return [vx, vy];
          };
          rhombi.push([vertex(0, 0), vertex(1, 0), vertex(1, 1), vertex(0, 1)]);
        }
      }
    }
  }
  return rhombi;
};

// --- drawing -----------------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;

/** The pigment in use while an element is drawn: a deep tone for ink and a lighter one for wash. */
type Pigment = { ink: string; wash: string };

const rgb = ([r, g, b]: [number, number, number]) => `rgb(${r} ${g} ${b})`;
const mixRgb = (
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Per-segment alpha: fades in and out along the path, with only a gentle swell. */
const fadeProfile = (rng: Rng, count: number, fadeFraction: number): number[] => {
  const phase = rng.range(0, Math.PI * 2);
  const freq = rng.range(1, 2.5);
  const profile: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const ends = smoothstep(0, fadeFraction, t) * smoothstep(1, 1 - fadeFraction, t);
    const swell = 0.92 + 0.08 * Math.sin(t * freq * Math.PI * 2 + phase);
    profile.push(ends * swell);
  }
  return profile;
};

const strokePath = (ctx: Ctx, pts: Vec[], width: number, alpha: number[], color: string) => {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  for (let i = 1; i < pts.length; i++) {
    const a = alpha[i - 1] ?? 0;
    if (a <= 0.003) continue;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(pts[i - 1]![0], pts[i - 1]![1]);
    ctx.lineTo(pts[i]![0], pts[i]![1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

// --- organic helpers ---------------------------------------------------------------------

/** Smooth 1D noise as a seeded sum of sines; cheap, deterministic, no grid artefacts. */
const makeNoise1 = (rng: Rng, octaves = 4) => {
  const freqs: number[] = [];
  const phases: number[] = [];
  const amps: number[] = [];
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    freqs.push(rng.range(0.6, 1.4) * 2 ** i);
    phases.push(rng.range(0, Math.PI * 2));
    amps.push(1 / 2 ** i);
    total += 1 / 2 ** i;
  }
  return (t: number) => {
    let v = 0;
    for (let i = 0; i < freqs.length; i++) v += amps[i]! * Math.sin(t * freqs[i]! + phases[i]!);
    return v / total;
  };
};

/** A spine: a smooth wandering path that bends back toward its target direction as it grows. */
const growSpine = (
  rng: Rng,
  start: Vec,
  heading: number,
  length: number,
  steps: number,
  wobble: number
): Vec[] => {
  const noise = makeNoise1(rng, 2);
  const pts: Vec[] = [start];
  let h = heading;
  let [x, y] = start;
  const step = length / steps;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    h += noise(t * 5) * wobble * step * 0.02 + (heading - h) * 0.03;
    x += Math.cos(h) * step;
    y += Math.sin(h) * step;
    pts.push([x, y]);
  }
  return pts;
};

const normalsOf = (pts: Vec[]): Vec[] =>
  pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  });

/** Outline polygon of a variable-width path: left edge forward, right edge back. */
const ribbonOutline = (pts: Vec[], widths: number[]): Vec[] => {
  const n = normalsOf(pts);
  const left: Vec[] = [];
  const right: Vec[] = [];
  for (let i = 0; i < pts.length; i++) {
    const w = widths[i]! / 2;
    left.push([pts[i]![0] + n[i]![0] * w, pts[i]![1] + n[i]![1] * w]);
    right.push([pts[i]![0] - n[i]![0] * w, pts[i]![1] - n[i]![1] * w]);
  }
  return [...left, ...right.reverse()];
};

/** A brush ribbon: filled quads between left and right offsets, width and alpha per point. */
const ribbon = (ctx: Ctx, pts: Vec[], widths: number[], alphas: number[], color: string) => {
  const n = normalsOf(pts);
  ctx.fillStyle = color;
  for (let i = 1; i < pts.length; i++) {
    const a = (alphas[i - 1]! + alphas[i]!) / 2;
    if (a < 0.004) continue;
    const [p0, p1] = [pts[i - 1]!, pts[i]!];
    const [n0, n1] = [n[i - 1]!, n[i]!];
    const [w0, w1] = [widths[i - 1]! / 2, widths[i]! / 2];
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(p0[0] + n0[0] * w0, p0[1] + n0[1] * w0);
    ctx.lineTo(p1[0] + n1[0] * w1, p1[1] + n1[1] * w1);
    ctx.lineTo(p1[0] - n1[0] * w1, p1[1] - n1[1] * w1);
    ctx.lineTo(p0[0] - n0[0] * w0, p0[1] - n0[1] * w0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p1[0], p1[1], w1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

/** Thick-and-thin width along a path: slow noise swell, tapering at both ends. */
const brushWidths = (
  rng: Rng,
  count: number,
  base: number,
  variation: number,
  taperIn: number,
  taperOut: number
) => {
  const noise = makeNoise1(rng, 2);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const taper = smoothstep(0, taperIn, t) * smoothstep(1, 1 - taperOut, t);
    const swell = 1 + variation * noise(t * 2.5 + 1);
    out.push(Math.max(0.15, base * swell * (0.4 + 0.6 * taper)));
  }
  return out;
};

const fillPolygon = (ctx: Ctx, pts: Vec[], alpha: number, color: string) => {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
};

/** Deform a polygon by subdividing every edge and pushing the midpoint sideways at random. */
const deform = (rng: Rng, pts: Vec[], amount: number, depth: number): Vec[] => {
  let cur = pts;
  for (let d = 0; d < depth; d++) {
    const next: Vec[] = [];
    const scale = amount / 2 ** d;
    for (let i = 0; i < cur.length; i++) {
      const a = cur[i]!;
      const b = cur[(i + 1) % cur.length]!;
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const len = Math.hypot(ex, ey) || 1;
      const push = (rng.next() - 0.5) * 2 * scale * len;
      next.push(a, [mx - (ey / len) * push, my + (ex / len) * push]);
    }
    cur = next;
  }
  return cur;
};

/** Thin a dense polygon so deformation works on a handful of vertices. */
const coarsen = (pts: Vec[], target = 22): Vec[] => {
  const step = Math.max(1, Math.floor(pts.length / target));
  return pts.filter((_, i) => i % step === 0);
};

/**
 * Watercolour fill: many translucent copies of the shape, each with jittered, subdivided
 * edges, so pigment pools in the middle and feathers at the rim. Drawn with multiply so
 * overlapping pigments deepen each other instead of covering.
 */
const watercolour = (
  ctx: Ctx,
  rng: Rng,
  shape: Vec[],
  alpha: number,
  color: string,
  layers = 11,
  drift = 0.05
) => {
  const base = deform(rng, coarsen(shape), 0.07, 2);
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of base) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const extent = Math.max(maxX - minX, maxY - minY) || 1;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  ctx.fillStyle = color;
  ctx.globalCompositeOperation = 'multiply';
  for (let l = 0; l < layers; l++) {
    // Each layer drifts and breathes a little, so stacked edges stay visible.
    const dx = (rng.next() - 0.5) * extent * drift;
    const dy = (rng.next() - 0.5) * extent * drift;
    // Some layers sit inside the shape, so the core reads denser than the rim.
    const inner = l % 3 === 0;
    const grow = inner ? rng.range(0.78, 0.92) : 1 + (rng.next() - 0.5) * drift * 1.5;
    const poly = deform(rng, base, inner ? 0.08 : 0.11, 3).map(([x, y]): Vec => [
      cx + (x - cx) * grow + dx,
      cy + (y - cy) * grow + dy,
    ]);
    ctx.globalAlpha = (alpha * 1.5) / layers;
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};

/** A watercolour pool: an irregular blob with organically feathered edges. */
const pool = (
  ctx: Ctx,
  rng: Rng,
  center: Vec,
  radius: number,
  alpha: number,
  color: string,
  geometric = 0.3,
  dpr = 1
) => {
  const noise = makeNoise1(rng, 3);
  const shape: Vec[] = [];
  // Sometimes the splotch has a geometric heart: a triangle, rhombus, pentagon or hexagon.
  const sides = rng.chance(geometric) ? rng.pick([3, 4, 5, 6]) : 10;
  const spin = rng.range(0, Math.PI * 2);
  const stretch = sides === 4 ? rng.range(1.3, 1.9) : 1;
  for (let i = 0; i < sides; i++) {
    const a = spin + (i / sides) * Math.PI * 2;
    const wobble = sides === 10 ? 1 + 0.18 * noise(a * 1.3) : 1;
    const r = radius * wobble * (i % 2 === 0 ? stretch : 1);
    shape.push([center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r]);
  }
  watercolour(ctx, rng, shape, alpha, color, sides === 10 ? 9 : 6, sides === 10 ? 0.06 : 0.1);
  // Now and then a large dot screen sits over the pool, like a printed tint.
  if (rng.chance(0.18)) screenFill(ctx, rng, shape, alpha * 0.8, color, dpr);
};

/** A halftone pattern tile: dots, checker, diagonal lines or cross-hatch, in a pigment. */
const makeScreen = (rng: Rng, color: string, dpr: number): CanvasPattern | null => {
  const cell = Math.round(rng.range(4, 7) * dpr);
  const kind = 'dots' as const;
  const tile = document.createElement('canvas');
  tile.width = cell * 2;
  tile.height = cell * 2;
  const t = tile.getContext('2d');
  if (!t) return null;
  t.fillStyle = color;
  t.strokeStyle = color;
  t.lineWidth = Math.max(1, cell * 0.28);
  if (kind === 'dots') {
    const r = cell * rng.range(0.22, 0.38);
    for (const [cx, cy] of [
      [cell * 0.5, cell * 0.5],
      [cell * 1.5, cell * 1.5],
    ]) {
      t.beginPath();
      t.arc(cx!, cy!, r, 0, Math.PI * 2);
      t.fill();
    }
  } else if (kind === 'checker') {
    t.fillRect(0, 0, cell, cell);
    t.fillRect(cell, cell, cell, cell);
  } else {
    t.beginPath();
    t.moveTo(0, cell * 2);
    t.lineTo(cell * 2, 0);
    t.moveTo(-cell, cell);
    t.lineTo(cell, -cell);
    t.moveTo(cell, cell * 3);
    t.lineTo(cell * 3, cell);
    if (kind === 'cross') {
      t.moveTo(0, 0);
      t.lineTo(cell * 2, cell * 2);
      t.moveTo(-cell, cell);
      t.lineTo(cell, cell * 3);
      t.moveTo(cell, -cell);
      t.lineTo(cell * 3, cell);
    }
    t.stroke();
  }
  return t.createPattern(tile, 'repeat');
};

/** Fill a shape with a halftone screen instead of paint. */
const screenFill = (
  ctx: Ctx,
  rng: Rng,
  shape: Vec[],
  alpha: number,
  color: string,
  dpr: number
) => {
  const pattern = makeScreen(rng, color, dpr);
  if (!pattern) return;
  const poly = deform(rng, coarsen(shape), 0.06, 2);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pattern;
  ctx.globalCompositeOperation = 'multiply';
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
};

/** A brushstroke: a watercolour bleed shaped like the stroke itself, then the ribbon core in ink. */
const brushstroke = (
  sc: Scene,
  pts: Vec[],
  widths: number[],
  alphas: number[],
  bleed = 1.5,
  coreAlpha = 0.9
) => {
  const { ink, wash, rng, pigment } = sc;
  const outline = ribbonOutline(
    pts,
    widths.map((w) => w * bleed)
  );
  watercolour(wash, rng, outline, 0.4, pigment.wash, 6);
  const core = alphas.map((a) => a * coreAlpha);
  // Mix brushes the way p5.brush does: a clean ribbon most of the time, sometimes charcoal or stipple.
  const kind = rng.next();
  if (kind < 0.62) ribbon(ink, pts, widths, core, pigment.ink);
  else if (kind < 0.84) charcoal(ink, rng, pts, widths, core, pigment.ink);
  else {
    ribbon(
      ink,
      pts,
      widths.map((w) => w * 0.55),
      core.map((a) => a * 0.6),
      pigment.ink
    );
    stipple(ink, rng, pts, widths, core, pigment.ink);
  }
};

/** Charcoal: several offset, narrower passes with lateral jitter, so the edge goes grainy. */
const charcoal = (
  ctx: Ctx,
  rng: Rng,
  pts: Vec[],
  widths: number[],
  alphas: number[],
  color: string
) => {
  const n = normalsOf(pts);
  for (let pass = 0; pass < 4; pass++) {
    const jitter = rng.range(0.15, 0.45);
    const shifted = pts.map(([x, y], i): Vec => {
      const off = (rng.next() - 0.5) * widths[i]! * jitter;
      return [x + n[i]![0] * off, y + n[i]![1] * off];
    });
    ribbon(
      ctx,
      shifted,
      widths.map((w) => w * rng.range(0.45, 0.75)),
      alphas.map((a) => a * 0.45),
      color
    );
  }
};

/** Stipple: dots scattered along and across the stroke, denser where the stroke is wider. */
const stipple = (
  ctx: Ctx,
  rng: Rng,
  pts: Vec[],
  widths: number[],
  alphas: number[],
  color: string
) => {
  const n = normalsOf(pts);
  ctx.fillStyle = color;
  for (let i = 1; i < pts.length; i++) {
    const w = widths[i]!;
    const count = Math.max(1, Math.round(w * 0.9));
    for (let k = 0; k < count; k++) {
      const t = rng.next();
      const x = pts[i - 1]![0] + (pts[i]![0] - pts[i - 1]![0]) * t;
      const y = pts[i - 1]![1] + (pts[i]![1] - pts[i - 1]![1]) * t;
      const off = (rng.next() - 0.5) * w * 1.3;
      ctx.globalAlpha = alphas[i]! * rng.range(0.3, 0.9);
      ctx.beginPath();
      ctx.arc(x + n[i]![0] * off, y + n[i]![1] * off, w * rng.range(0.12, 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
};

/** Hatch: thin parallel lines clipped to a shape, a texture laid over paint. */
const hatchFill = (
  ctx: Ctx,
  rng: Rng,
  shape: Vec[],
  alpha: number,
  color: string,
  lineW: number
) => {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of shape) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const r = Math.hypot(maxX - minX, maxY - minY) / 2;
  const angle = rng.range(0, Math.PI);
  const spacing = lineW * rng.range(2.2, 4);
  ctx.save();
  ctx.beginPath();
  shape.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW * 0.5;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  for (let d = -r; d <= r; d += spacing) {
    const px = cx + Math.cos(angle) * d;
    const py = cy + Math.sin(angle) * d;
    const tx = -Math.sin(angle) * r;
    const ty = Math.cos(angle) * r;
    ctx.moveTo(px - tx, py - ty);
    ctx.lineTo(px + tx, py + ty);
  }
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
};

// --- composition -------------------------------------------------------------------------

type Scene = {
  ink: Ctx;
  wash: Ctx;
  u: number;
  lineW: number;
  dpr: number;
  elegance: number;
  geometric: number;
  /** Heading snap for angular growth: a right angle for maze-like pieces, 36 degrees otherwise. */
  snap: number;
  main: Pigment;
  anchors: Vec[];
  rng: Rng;
  pigment: Pigment;
  pick: () => Pigment;
};

/** Paint or screen: shapes fill with watercolour most of the time, with a halftone otherwise. */
const fillShape = (sc: Scene, shape: Vec[], alpha: number, layers: number) => {
  const { wash, ink, rng, pigment, lineW } = sc;
  watercolour(wash, rng, shape, alpha, pigment.wash, layers, rng.chance(0.3) ? 0.09 : 0.04);
  if (rng.chance(0.14)) hatchFill(ink, rng, shape, rng.range(0.12, 0.28), pigment.ink, lineW);
};

/** A leaf: a fan of Maurer chords rooted at the node, the fan filled in watercolour. */
const leaf = (sc: Scene, at: Vec, dir: number, size: number) => {
  const { rng, ink, wash, lineW, pigment } = sc;
  const n = rng.pick([2, 3, 4, 5, 6, 7]);
  const d = rng.pick([29, 31, 37, 41, 47, 71, 97, 113, 137]);
  const raw = maurerArc(n, d, rng.int(0, 300), rng.int(8, 22));
  const [ox, oy] = raw[0]!;
  const rooted = raw.map(([x, y]): Vec => [x - ox, y - oy]);
  const pts = place(rooted, at, size, dir + rng.range(-0.5, 0.5));
  const alpha = fadeProfile(rng, pts.length - 1, rng.range(0.1, 0.3)).map((v) => 0.3 + 0.4 * v);
  const widths = brushWidths(rng, pts.length, lineW * rng.range(0.7, 1.3), 0.35, 0.05, 0.3);
  if (rng.chance(0.5 - 0.4 * sc.elegance)) {
    pool(
      wash,
      rng,
      at,
      size * rng.range(0.5, 0.8),
      rng.range(0.3, 0.5),
      pigment.wash,
      sc.geometric,
      sc.dpr
    );
  }
  fillShape(sc, pts, rng.range(0.7, 1), 8);
  ribbon(ink, pts, widths, alpha, pigment.ink);
};

/** A rose: a whole Maurer rose, petals in watercolour, chord lattice faint, outline brushed. */
const rose = (sc: Scene, at: Vec, size: number) => {
  const { rng, ink, wash, lineW, pigment } = sc;
  const n = rng.pick([2, 3, 4, 5, 6, 7]);
  const d = rng.pick([29, 31, 37, 41, 47, 71, 97, 113, 137]);
  const angle = rng.range(0, Math.PI * 2);
  const geo = rng.chance(sc.geometric);
  const fat = rng.range(0.45, 0.7);
  const petal: Vec[] = [];
  const steps = geo ? n * 2 * rng.pick([2, 3]) : 720;
  for (let k = 0; k <= steps; k++) {
    const th = (k * Math.PI * 2) / steps;
    // Fattened petals: |sin|^fat keeps the lobes round instead of spiky.
    const sn = Math.sin(n * th);
    const r = Math.sign(sn) * Math.abs(sn) ** fat;
    petal.push([r * Math.cos(th), r * Math.sin(th)]);
  }
  const petals = place(petal, at, size, angle);
  if (rng.chance(0.6 - 0.4 * sc.elegance)) {
    pool(
      wash,
      rng,
      at,
      size * rng.range(0.8, 1.2),
      rng.range(0.25, 0.45),
      pigment.wash,
      sc.geometric,
      sc.dpr
    );
  }
  fillShape(sc, petals, rng.range(0.9, 1.2), 9);
  const heart = petals.map(([x, y]): Vec => [
    at[0] + (x - at[0]) * 0.55,
    at[1] + (y - at[1]) * 0.55,
  ]);
  watercolour(wash, rng, heart, rng.range(0.7, 1), pigment.wash, 6);
  if (!geo && rng.chance(0.6)) {
    const chords = place(maurerArc(n, d, 0, 360), at, size, angle);
    const lattice = rng.range(0.04, 0.09);
    strokePath(
      ink,
      chords,
      lineW * 0.5,
      chords.map(() => lattice),
      pigment.ink
    );
  }
  const widths = brushWidths(rng, petals.length, lineW * rng.range(0.5, 1), 0.3, 0.02, 0.02);
  if (rng.chance(0.4)) {
    // Open the outline: draw only a stretch of it, then let a loose end reach for another point.
    const from = rng.int(0, petals.length - 1);
    const span = Math.floor(petals.length * rng.range(0.35, 0.75));
    const arc: Vec[] = [];
    for (let k = 0; k < span; k++) arc.push(petals[(from + k) % petals.length]!);
    const arcAlpha = fadeProfile(rng, arc.length, 0.15).map((v) => 0.25 + 0.3 * v);
    ribbon(ink, arc, widths.slice(0, arc.length), arcAlpha, pigment.ink);
    if (sc.anchors.length > 0) {
      const target = rng.pick(sc.anchors);
      const end = arc[arc.length - 1]!;
      const jitter = 8 * sc.dpr;
      const line: Vec[] = [
        end,
        [target[0] + rng.range(-jitter, jitter), target[1] + rng.range(-jitter, jitter)],
      ];
      strokePath(ink, line, lineW * 0.45, [0.35], pigment.ink);
    }
  } else {
    ribbon(
      ink,
      petals,
      widths,
      petals.map(() => 0.35),
      pigment.ink
    );
  }
};

/** A rosette: a dense Penrose patch whose tiles fill in a gradient from the centre outward. */
const blossom = (sc: Scene, at: Vec, size: number) => {
  const { rng, ink, wash, lineW, pigment } = sc;
  const gammas = [rng.next(), rng.next(), rng.next(), rng.next()];
  gammas.push(-gammas.reduce((a, b) => a + b, 0));
  const rhombi = penroseRhombi(gammas, 4);
  const edge = size * rng.range(0.16, 0.26);
  const angle = rng.range(0, Math.PI * 2);
  const cutAngle = rng.range(0, Math.PI * 2);
  const cutDir: Vec = [Math.cos(cutAngle), Math.sin(cutAngle)];
  const cutOffset = rng.range(-0.3, 0.6) * size;
  if (rng.chance(0.5 - 0.4 * sc.elegance)) {
    pool(
      wash,
      rng,
      at,
      size * rng.range(0.9, 1.3),
      rng.range(0.25, 0.45),
      pigment.wash,
      sc.geometric,
      sc.dpr
    );
  }
  const screen = rng.chance(0.15) ? makeScreen(rng, pigment.wash, sc.dpr) : null;
  wash.globalCompositeOperation = 'multiply';
  for (const rh of rhombi) {
    const placed = place(rh, at, edge, angle);
    const cx = (placed[0]![0] + placed[2]![0]) / 2;
    const cy = (placed[0]![1] + placed[2]![1]) / 2;
    const dist = Math.hypot(cx - at[0], cy - at[1]);
    const side = (cx - at[0]) * cutDir[0] + (cy - at[1]) * cutDir[1] - cutOffset;
    const a = smoothstep(size, size * 0.2, dist) * smoothstep(-edge * 2, edge, side);
    if (a < 0.03) continue;
    if (screen) {
      wash.globalAlpha = a * rng.range(0.6, 1);
      wash.fillStyle = screen;
      wash.beginPath();
      placed.forEach(([x, y], i) => (i === 0 ? wash.moveTo(x, y) : wash.lineTo(x, y)));
      wash.closePath();
      wash.fill();
      wash.globalAlpha = 1;
    } else fillPolygon(wash, placed, a * rng.range(0.4, 0.9), pigment.wash);
    if (rng.chance(0.5)) {
      ink.globalAlpha = a * rng.range(0.1, 0.3);
      ink.lineWidth = lineW * 0.6;
      ink.strokeStyle = pigment.ink;
      ink.beginPath();
      placed.forEach(([x, y], i) => (i === 0 ? ink.moveTo(x, y) : ink.lineTo(x, y)));
      ink.closePath();
      ink.stroke();
    }
    if (rng.chance(0.08)) fillPolygon(ink, placed, a * rng.range(0.3, 0.6), pigment.ink);
  }
  wash.globalCompositeOperation = 'source-over';
  ink.globalAlpha = 1;
};

/** A tendril: a Lissajous arc curling away from the node as a thin-to-thick brushstroke. */
const tendril = (sc: Scene, at: Vec, dir: number, size: number) => {
  const { rng, lineW } = sc;
  const a = rng.int(1, 3);
  let b = rng.int(1, 4);
  if (b === a) b = a + 1;
  const raw = lissajousArc(
    a,
    b,
    rng.range(0, Math.PI),
    rng.range(0, Math.PI * 2),
    rng.range(1.4, 4)
  );
  const [ox, oy] = raw[0]!;
  const rooted = raw.map(([x, y]): Vec => [x - ox, y - oy]);
  // Geometric: keep only a handful of points so the curve becomes an angular zigzag.
  const sparse = rng.chance(sc.geometric) ? coarsen(rooted, rng.int(5, 9)) : rooted;
  const pts = place(sparse, at, size, dir + rng.range(-0.8, 0.8));
  const alpha = fadeProfile(rng, pts.length - 1, rng.range(0.1, 0.25)).map((v) => 0.4 + 0.6 * v);
  const widths = brushWidths(rng, pts.length, lineW * rng.range(0.9, 1.6), 0.4, 0.02, 0.6);
  brushstroke(sc, pts, widths, alpha, 2.6, 0.85);
};

/** A bloom: a ring of rounded petals (ellipses, or rhombi when geometric), each filled on its own. */
const bloom = (sc: Scene, at: Vec, size: number) => {
  const { rng, ink, wash, lineW, pigment } = sc;
  const count = rng.int(3, 8);
  const geo = rng.chance(sc.geometric);
  const spin = rng.range(0, Math.PI * 2);
  const petalLen = size * rng.range(0.8, 1.1);
  const petalWid = petalLen * rng.range(0.3, 0.55);
  const gap = rng.range(0.05, 0.3);
  if (rng.chance(0.6 - 0.4 * sc.elegance)) {
    pool(
      wash,
      rng,
      at,
      size * rng.range(0.9, 1.3),
      rng.range(0.2, 0.4),
      pigment.wash,
      sc.geometric,
      sc.dpr
    );
  }
  for (let i = 0; i < count; i++) {
    const a = spin + (i / count) * Math.PI * 2;
    const shape: Vec[] = [];
    const steps = geo ? 4 : 24;
    for (let k = 0; k < steps; k++) {
      const t = (k / steps) * Math.PI * 2;
      // Ellipse from the centre outward; a rhombus when geometric.
      const ex = geo ? [0, 0.5, 1, 0.5][k]! : 0.5 + 0.5 * Math.cos(t);
      const ey = geo ? [0, 0.5, 0, -0.5][k]! : 0.5 * Math.sin(t);
      const px = (gap + ex) * petalLen;
      const py = ey * petalWid;
      shape.push([
        at[0] + px * Math.cos(a) - py * Math.sin(a),
        at[1] + px * Math.sin(a) + py * Math.cos(a),
      ]);
    }
    watercolour(wash, rng, shape, rng.range(0.7, 1.1), pigment.wash, 7, geo ? 0.03 : 0.06);
    if (rng.chance(0.7)) {
      const outline = [...shape, shape[0]!];
      const widths = brushWidths(rng, outline.length, lineW * rng.range(0.5, 0.9), 0.3, 0.1, 0.1);
      ribbon(
        ink,
        outline,
        widths,
        outline.map(() => rng.range(0.2, 0.45)),
        pigment.ink
      );
    }
  }
  ink.globalAlpha = 0.7;
  ink.fillStyle = pigment.ink;
  ink.beginPath();
  ink.arc(at[0], at[1], lineW * rng.range(1.2, 2.4), 0, Math.PI * 2);
  ink.fill();
  ink.globalAlpha = 1;
};

/** An angular spine: straight runs with heading snapped to multiples of 36 degrees. */
const growAngular = (
  rng: Rng,
  start: Vec,
  heading: number,
  length: number,
  steps: number,
  snap = Math.PI / 5
): Vec[] => {
  const pts: Vec[] = [start];
  let [x, y] = start;
  let h = Math.round(heading / snap) * snap;
  const runs = rng.int(4, 8);
  const perRun = Math.max(2, Math.floor(steps / runs));
  const step = length / steps;
  for (let r = 0; r < runs; r++) {
    for (let i = 0; i < perRun; i++) {
      x += Math.cos(h) * step;
      y += Math.sin(h) * step;
      pts.push([x, y]);
    }
    const turn = (snap > 1 ? rng.pick([-1, 1]) : rng.pick([-2, -1, -1, 1, 1, 2])) * snap;
    h += turn;
    const off = ((h - heading + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(off) > Math.PI / 2) h -= Math.sign(off) * snap * 2;
  }
  return pts;
};

/** A trail of dots that shrink along a direction, like the tail of a swash. */
const dots = (sc: Scene, at: Vec, dir: number, spacing: number, count: number) => {
  const { rng, ink, lineW, pigment } = sc;
  ink.fillStyle = pigment.ink;
  for (let k = 1; k <= count; k++) {
    const d = spacing * k * rng.range(0.8, 1.2);
    const x = at[0] + Math.cos(dir) * d;
    const y = at[1] + Math.sin(dir) * d;
    ink.globalAlpha = rng.range(0.5, 0.95) * (1 - k / (count + 2));
    ink.beginPath();
    ink.arc(x, y, lineW * rng.range(0.7, 1.6) * (1 - 0.2 * k), 0, Math.PI * 2);
    ink.fill();
  }
  ink.globalAlpha = 1;
};

/** A calligraphic flourish: a log-spiral curl as a thin-thick-thin stroke, simplified. */
const flourish = (sc: Scene, at: Vec, dir: number, size: number) => {
  const { rng, lineW } = sc;
  const turns = rng.range(1.2, 2.4);
  const growth = rng.range(0.16, 0.3);
  const steps = 70;
  const raw: Vec[] = [];
  const hand = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * turns * Math.PI * 2;
    const r = Math.exp(growth * th) - 1;
    raw.push([r * Math.cos(th), hand * r * Math.sin(th)]);
  }
  const rmax = Math.hypot(raw[steps]![0], raw[steps]![1]) || 1;
  const norm = raw.map(([x, y]): Vec => [x / rmax, y / rmax]);
  const pts = place(norm, at, size, dir + rng.range(-0.6, 0.6));
  const widths = brushWidths(rng, pts.length, lineW * rng.range(0.7, 1.4), 0.6, 0.35, 0.35);
  const alpha = fadeProfile(rng, pts.length - 1, 0.08).map((v) => 0.5 + 0.5 * v);
  brushstroke(sc, pts, widths, alpha, 1.3, 0.8);
  const end = pts[pts.length - 1]!;
  const prev = pts[pts.length - 4]!;
  const ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  dots(sc, end, ang, size * 0.25, rng.int(1, 3));
};

/** L-system twigs: F[+F][-F]F at right angles, thinner each generation, with a little bloom at the ends. */
const lsystem = (
  sc: Scene,
  at: Vec,
  heading: number,
  length: number,
  depth: number,
  width: number
) => {
  const { rng, ink, lineW, snap } = sc;
  if (depth <= 0 || length < lineW * 4) return;
  const end: Vec = [at[0] + Math.cos(heading) * length, at[1] + Math.sin(heading) * length];
  ribbon(ink, [at, end], [width, width * 0.8], [0.8, 0.8], sc.main.ink);
  const forks: number[] = [];
  if (rng.chance(0.8)) forks.push(heading + snap);
  if (rng.chance(0.8)) forks.push(heading - snap);
  if (rng.chance(0.5)) forks.push(heading);
  for (const h of forks)
    lsystem(sc, end, h, length * rng.range(0.5, 0.75), depth - 1, width * 0.75);
  if (forks.length === 0 || depth === 1) {
    if (rng.chance(0.35)) {
      sc.pigment = sc.pick();
      if (rng.chance(0.5)) bloom(sc, end, length * 0.5);
      else dots(sc, end, heading, length * 0.3, rng.int(1, 3));
      sc.pigment = sc.main;
    }
  }
};

/** One vine: a stem from a start point along a heading, with nodes, branches and blooms. */
const vine = (sc: Scene, start: Vec, heading: number, stemLength: number) => {
  const { rng, ink, wash, u, lineW, dpr, elegance, geometric, main, pick, snap } = sc;
  const angular = rng.chance(geometric);
  const stem = angular
    ? growAngular(rng, start, heading, stemLength, 160, snap)
    : growSpine(rng, start, heading, stemLength, 160, rng.range(0.6, 1.8));

  // A soft pool along the stem, in the stem's own pigment, so the whole thing has a body.
  if (rng.chance(0.6)) {
    const p = stem[rng.int(10, stem.length - 10)]!;
    pool(wash, rng, p, u * rng.range(0.08, 0.14), rng.range(0.14, 0.24), main.wash, geometric, dpr);
  }

  const stemWidths = brushWidths(
    rng,
    stem.length,
    lineW * rng.range(2.2, 4) * (1 - 0.35 * elegance),
    0.5,
    0.02,
    0.35
  );
  const stemAlpha = stem.map(() => 0.9);
  const above: Array<() => void> = [];
  const blushes: Array<{ index: number; pigment: Pigment }> = [];

  const normals = normalsOf(stem);
  const nodeCount = rng.int(4, 7);
  let side = rng.chance(0.5) ? 1 : -1;
  const branches: Vec[][] = [];
  for (let k = 0; k < nodeCount; k++) {
    const t = 0.1 + 0.85 * ((k + rng.range(0.1, 0.9)) / nodeCount);
    const i = Math.min(stem.length - 2, Math.floor(t * (stem.length - 1)));
    const p = stem[i]!;
    const n = normals[i]!;
    side = rng.chance(0.75) ? -side : side;
    const dir = angular
      ? Math.atan2(n[1] * side, n[0] * side)
      : Math.atan2(n[1] * side, n[0] * side) + rng.range(-0.4, 0.4);
    const size = u * rng.range(0.1, 0.22) * (1 - 0.35 * t);
    const pigment = pick();
    sc.anchors.push(p);
    for (let j = -6; j <= 6; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < stemWidths.length)
        stemWidths[idx]! *= 1 + 0.55 * Math.exp(-(j * j) / 8);
    }
    if (pigment !== main) blushes.push({ index: i, pigment });
    const roll = rng.next();
    const draw = () => {
      sc.pigment = pigment;
      const e = elegance;
      if (angular && rng.chance(0.4)) lsystem(sc, p, dir, size * 0.8, rng.int(2, 4), lineW * 1.4);
      else if (roll < 0.2 - 0.08 * e) leaf(sc, p, dir, size);
      else if (roll < 0.38) rose(sc, p, size * 0.7);
      else if (roll < 0.56) bloom(sc, p, size * 0.55);
      else if (roll < 0.7 - 0.15 * e) blossom(sc, p, size * 0.8);
      else if (roll < 0.86 - 0.08 * e) tendril(sc, p, dir, size);
      else if (roll < 0.95) flourish(sc, p, dir, size * 0.9);
      else dots(sc, p, dir, size * 0.3, rng.int(2, 4));
    };
    if (rng.chance(0.45)) above.push(draw);
    else draw();

    if (rng.chance(0.35) && branches.length < 2) {
      const branch = angular
        ? growAngular(rng, p, dir, u * rng.range(0.22, 0.45), 60, snap)
        : growSpine(rng, p, dir, u * rng.range(0.22, 0.45), 60, rng.range(0.8, 2.4));
      branches.push(branch);
      const bw = brushWidths(rng, branch.length, lineW * rng.range(1.3, 2.4), 0.4, 0.02, 0.5);
      sc.pigment = main;
      brushstroke(
        sc,
        branch,
        bw,
        branch.map(() => 0.85),
        2,
        0.85
      );
      const tip = branch[branch.length - 1]!;
      const tipDir = Math.atan2(
        tip[1] - branch[branch.length - 6]![1],
        tip[0] - branch[branch.length - 6]![0]
      );
      sc.pigment = pick();
      if (angular && rng.chance(0.5))
        lsystem(sc, tip, tipDir, size * 0.7, rng.int(2, 3), lineW * 1.2);
      else if (rng.chance(0.3)) leaf(sc, tip, tipDir, size * 0.7);
      else if (rng.chance(0.4)) rose(sc, tip, size * 0.5);
      else if (rng.chance(0.6)) bloom(sc, tip, size * 0.45);
      else blossom(sc, tip, size * 0.55);
    }
  }

  sc.pigment = main;
  brushstroke(sc, stem, stemWidths, stemAlpha, 1.6, 0.88);
  for (const { index, pigment } of blushes) {
    const alpha = stem.map((_, j) => 0.85 * Math.exp(-((j - index) * (j - index)) / 90));
    ribbon(ink, stem, stemWidths, alpha, pigment.ink);
    const halo = stem.map((_, j) => Math.exp(-((j - index) * (j - index)) / 160));
    ribbon(
      wash,
      stem,
      stemWidths.map((w) => w * 2.2),
      halo.map((v) => v * 0.5),
      pigment.wash
    );
  }
  for (const draw of above) draw();

  const tip = stem[stem.length - 1]!;
  const seeds = rng.int(0, 3 + Math.round(3 * elegance));
  for (let i = 0; i < seeds; i++) {
    const ang = heading + rng.range(-1, 1);
    const dist = u * rng.range(0.03, 0.16);
    const c: Vec = [tip[0] + Math.cos(ang) * dist, tip[1] + Math.sin(ang) * dist];
    ink.globalAlpha = rng.range(0.4, 0.9);
    ink.fillStyle = main.ink;
    ink.beginPath();
    ink.arc(c[0], c[1], lineW * rng.range(0.6, 1.8), 0, Math.PI * 2);
    ink.fill();
  }
  ink.globalAlpha = 1;
};

/** Colour sets after Ana Montiel's FIELDS, used when vines are stacked. */
const FIELDS: Array<{ inks: [string, string]; accents: string[] }> = [
  { inks: ['#46286c', '#9d82c8'], accents: ['#e8735a', '#f2a97e', '#6e93d6'] },
  { inks: ['#1e4fa8', '#7fa4e0'], accents: ['#f14e3c', '#f6b2c0', '#e93c8f'] },
  { inks: ['#a04a2a', '#e4956a'], accents: ['#f7d64a', '#f2a08a', '#e8e3d6'] },
  { inks: ['#4a3630', '#c3cbe6'], accents: ['#e07a62', '#f3c9a8', '#efc35a'] },
  { inks: ['#4a4658', '#a8a2ad'], accents: ['#2a86d8', '#f4784a', '#f7b48f'] },
  { inks: ['#7a2f5a', '#d38fb6'], accents: ['#f6b2c0', '#5d86dc', '#f4a081'] },
  { inks: ['#2f3a55', '#8fb3e6'], accents: ['#f5a58a', '#3f6fd3', '#fbd9c4'] },
];

const compose = (
  rng: Rng,
  ink: Ctx,
  wash: Ctx,
  W: number,
  H: number,
  dpr: number,
  pigments: Pigment[],
  accentChance: number,
  elegance: number,
  geometric: number,
  stacks: number
) => {
  const long = Math.max(W, H);
  const landscape = W >= H;
  const snap = rng.chance(0.55) ? Math.PI / 2 : Math.PI / 5;

  const makeScene = (pigs: Pigment[], uScale: number): Scene => {
    const u = Math.min(W, H) * uScale;
    const main = pigs[0]!;
    const accents = pigs.slice(1);
    const pick = (): Pigment =>
      accents.length > 0 && rng.chance(accentChance) ? rng.pick(accents) : main;
    return {
      ink,
      wash,
      u,
      lineW: Math.max(dpr, u * 0.0055),
      dpr,
      elegance,
      geometric,
      snap,
      main,
      anchors: [],
      rng,
      pigment: main,
      pick,
    };
  };

  if (stacks <= 1) {
    // One vine: starts near one edge and grows across the long axis.
    const u = Math.min(W, H);
    const fromLeft = rng.chance(0.5);
    const startAlong = long * rng.range(0.06, 0.18);
    const startAcross = u * rng.range(0.3, 0.7);
    const start: Vec = landscape
      ? [fromLeft ? startAlong : W - startAlong, startAcross]
      : [startAcross, fromLeft ? startAlong : H - startAlong];
    const baseHeading = landscape
      ? fromLeft
        ? 0
        : Math.PI
      : fromLeft
        ? Math.PI / 2
        : -Math.PI / 2;
    vine(
      makeScene(pigments, 1),
      start,
      baseHeading + rng.range(-0.4, 0.4),
      long * rng.range(0.5, 0.75)
    );
    return;
  }

  // Many vines, each in its own palette, scale and direction, stacked into one field.
  // They gather around a few centres so the piece reads as one mass with breathing room,
  // and a couple of large anchors run across the whole thing to tie it together.
  const centres: Vec[] = [];
  const centreCount = rng.int(2, 4);
  for (let c = 0; c < centreCount; c++) {
    centres.push([
      W * (0.2 + (0.6 * (c + rng.range(0.2, 0.8))) / centreCount),
      H * rng.range(0.3, 0.7),
    ]);
  }
  for (let k = 0; k < stacks; k++) {
    const field = rng.pick(FIELDS);
    const pigs = k === 0 ? pigments : pigmentsFromColours(field.inks, field.accents);
    const anchor = k < 2;
    const sc = makeScene(pigs, anchor ? rng.range(0.7, 0.95) : rng.range(0.3, 0.6));
    const centre = rng.pick(centres);
    const spread = anchor ? 0.35 : 0.22;
    const start: Vec = anchor
      ? [W * rng.range(0.05, 0.25), H * rng.range(0.25, 0.75)]
      : [
          centre[0] + (rng.next() + rng.next() - 1) * W * spread,
          centre[1] + (rng.next() + rng.next() - 1) * H * spread,
        ];
    const heading = anchor ? rng.range(-0.5, 0.5) : rng.range(0, Math.PI * 2);
    vine(sc, start, heading, long * (anchor ? rng.range(0.55, 0.8) : rng.range(0.18, 0.4)));
  }
};

// --- paper, wet edges and composite ------------------------------------------------------

/** 8x8 Bayer thresholds in [0,1), for a faint ordered texture. */
const BAYER8 = (() => {
  const m = new Float32Array(64);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const q = x ^ y;
      let v = 0;
      for (let k = 0; k < 3; k++) v = (v << 2) | (((q >> k) & 1) << 1) | ((y >> k) & 1);
      m[y * 8 + x] = (v + 0.5) / 64;
    }
  }
  return m;
})();

/** Deterministic 2D value noise for paper grain. */
const hash2 = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const valueNoise2 = (x: number, y: number) => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
};

/** Measure the drawn bounding box; returns null if nothing was drawn. */
const measure = (layers: Uint8ClampedArray[], W: number, H: number) => {
  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4 + 3;
      if (layers.some((l) => l[i]! > 24)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
};

const composite = (
  target: CanvasRenderingContext2D,
  ink: Ctx,
  wash: Ctx,
  W: number,
  H: number,
  dpr: number,
  ground: PieceOptions['ground']
) => {
  const inkData = ink.getImageData(0, 0, W, H).data;
  const washData = wash.getImageData(0, 0, W, H).data;
  const out = target.createImageData(W, H);
  const o = out.data;
  const isWhite = ground === 'white';
  const grainScale = 1 / (3.5 * dpr);
  const fineScale = 1 / (1.2 * dpr);
  const rimStep = Math.max(1, Math.round(2 * dpr));
  const cell = Math.max(1, Math.round(dpr));

  // Rare row shifts: a whisper of glitch in the colour fields only, never the ink.
  const rowShift = new Int8Array(H);
  let y0 = 0;
  while (y0 < H) {
    y0 += Math.floor(40 * dpr + hash2(y0, 7) * 120 * dpr);
    const run = 1 + Math.floor(hash2(y0, 11) * 4 * dpr);
    const shift = Math.round((hash2(y0, 13) - 0.5) * 6 * dpr);
    for (let k = 0; k < run && y0 + k < H; k++) rowShift[y0 + k] = shift;
  }

  const washAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    return washData[(y * W + x) * 4 + 3]! / 255;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const inkA = inkData[i + 3]! / 255;
      const gx = Math.min(W - 1, Math.max(0, x + rowShift[y]!));
      const wi = (y * W + gx) * 4;
      const bayer = BAYER8[(((y / cell) | 0) & 7) * 8 + (((x / cell) | 0) & 7)]! - 0.5;
      const washRaw = (washData[wi + 3]! / 255) * (1 + 0.16 * bayer);

      // Paper: coarse granulation plus fine tooth, and pigment settles darker into the grain.
      const grain = valueNoise2(x * grainScale, y * grainScale) - 0.5;
      const tooth = valueNoise2(x * fineScale + 31.7, y * fineScale + 17.3) - 0.5;
      const paper = 1 + 0.22 * grain + 0.08 * tooth;

      // Wet edge: where the wash density changes quickly, pigment gathers into a darker rim.
      const around =
        (washAt(x - rimStep, y) +
          washAt(x + rimStep, y) +
          washAt(x, y - rimStep) +
          washAt(x, y + rimStep)) /
        4;
      const rim = Math.abs(washRaw - around);
      const washA = Math.min(1, Math.max(0, washRaw * paper + rim * 0.7));

      let r = 255;
      let g = 255;
      let b = 255;
      let a = isWhite ? 1 : 0;

      if (washA > 0.002) {
        const wr = washData[wi]!;
        const wg = washData[wi + 1]!;
        const wb = washData[wi + 2]!;
        // Rim pigment is a deeper version of the same colour.
        const deepen = Math.min(1, rim * 1.6);
        const cr = wr * (1 - 0.35 * deepen);
        const cg = wg * (1 - 0.35 * deepen);
        const cb = wb * (1 - 0.35 * deepen);
        const outA = washA + a * (1 - washA);
        r = (cr * washA + r * a * (1 - washA)) / outA;
        g = (cg * washA + g * a * (1 - washA)) / outA;
        b = (cb * washA + b * a * (1 - washA)) / outA;
        a = outA;
      }

      if (inkA > 0.002) {
        const ia = Math.min(1, inkA * (0.9 + 0.2 * tooth + 0.1));
        const outA = ia + a * (1 - ia);
        r = (inkData[i]! * ia + r * a * (1 - ia)) / outA;
        g = (inkData[i + 1]! * ia + g * a * (1 - ia)) / outA;
        b = (inkData[i + 2]! * ia + b * a * (1 - ia)) / outA;
        a = outA;
      }

      o[i] = r;
      o[i + 1] = g;
      o[i + 2] = b;
      o[i + 3] = Math.round(a * 255);
    }
  }
  target.putImageData(out, 0, 0);
};

// --- entry -------------------------------------------------------------------------------

const makeLayer = (W: number, H: number) => {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c.getContext('2d')!;
};

/** Build ink/wash pairs from the option colours: accents get a deep and a light version. */
const pigmentsFromColours = (inks: [string] | [string, string], accents: string[]): Pigment[] => {
  const deep = hexToRgb(inks[0]);
  const midTone = hexToRgb(inks[1] ?? inks[0]);
  const white: [number, number, number] = [255, 255, 255];
  const main: Pigment = { ink: rgb(deep), wash: rgb(mixRgb(midTone, white, 0.25)) };
  const rest = accents.map((hex): Pigment => {
    const c = hexToRgb(hex);
    return { ink: rgb(mixRgb(c, deep, 0.4)), wash: rgb(mixRgb(c, white, 0.08)) };
  });
  return [main, ...rest];
};

/** Build ink/wash pairs from the option colours: accents get a deep and a light version. */
const pigmentsFrom = (options: PieceOptions): Pigment[] =>
  pigmentsFromColours(options.inks, options.accents ?? []);

export const renderPiece = (canvas: HTMLCanvasElement, options: PieceOptions) => {
  const { seed, width, height, dpr, ground } = options;
  const W = Math.max(1, Math.round(width));
  const H = Math.max(1, Math.round(height));
  canvas.width = W;
  canvas.height = H;
  const target = canvas.getContext('2d');
  if (!target) return;

  // Compose on a generous working canvas so nothing is clipped mid-drawing, then fit the
  // drawn extent into the output with a margin.
  const stacked = (options.stacks ?? 1) > 1;
  const pad = stacked ? 1.15 : 1.6;
  const WW = Math.round(W * pad);
  const HH = Math.round(H * pad);
  let ink = makeLayer(WW, HH);
  let wash = makeLayer(WW, HH);
  ink.translate((WW - W) / 2, (HH - H) / 2);
  wash.translate((WW - W) / 2, (HH - H) / 2);
  compose(
    makeRng(seed),
    ink,
    wash,
    W,
    H,
    dpr,
    pigmentsFrom(options),
    options.accentChance ?? 0.3,
    options.elegance ?? 0.5,
    options.geometric ?? 0.15,
    options.stacks ?? 1
  );

  const box = measure(
    [ink.getImageData(0, 0, WW, HH).data, wash.getImageData(0, 0, WW, HH).data],
    WW,
    HH
  );
  const fittedInk = makeLayer(W, H);
  const fittedWash = makeLayer(W, H);
  if (box) {
    const margin = stacked ? 0.02 : 0.06;
    const bw = box.maxX - box.minX + 2;
    const bh = box.maxY - box.minY + 2;
    const scale = Math.min(1.3, (W * (1 - 2 * margin)) / bw, (H * (1 - 2 * margin)) / bh);
    const dx = (W - bw * scale) / 2;
    const dy = (H - bh * scale) / 2;
    for (const [from, to] of [
      [ink, fittedInk],
      [wash, fittedWash],
    ] as const) {
      to.imageSmoothingEnabled = true;
      to.imageSmoothingQuality = 'high';
      to.drawImage(from.canvas, box.minX - 1, box.minY - 1, bw, bh, dx, dy, bw * scale, bh * scale);
    }
  }
  ink = fittedInk;
  wash = fittedWash;

  composite(target, ink, wash, W, H, dpr, ground);
};

export const randomSeed = () => Math.floor(Math.random() * 0xffffffff) >>> 0;
