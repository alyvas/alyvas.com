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
const coarsen = (pts: Vec[], target = 14): Vec[] => {
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
  layers = 14
) => {
  const base = deform(rng, coarsen(shape), 0.3, 2);
  ctx.fillStyle = color;
  ctx.globalCompositeOperation = 'multiply';
  for (let l = 0; l < layers; l++) {
    const poly = deform(rng, base, 0.4, 3);
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
const pool = (ctx: Ctx, rng: Rng, center: Vec, radius: number, alpha: number, color: string) => {
  const noise = makeNoise1(rng, 3);
  const shape: Vec[] = [];
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wobble = 1 + 0.3 * noise(a * 1.3);
    shape.push([
      center[0] + Math.cos(a) * radius * wobble,
      center[1] + Math.sin(a) * radius * wobble,
    ]);
  }
  watercolour(ctx, rng, shape, alpha, color, 16);
};

/** A brushstroke: a watercolour bleed shaped like the stroke itself, then the ribbon core in ink. */
const brushstroke = (
  sc: Scene,
  pts: Vec[],
  widths: number[],
  alphas: number[],
  bleed = 2.4,
  coreAlpha = 0.9
) => {
  const { ink, wash, rng, pigment } = sc;
  const outline = ribbonOutline(
    pts,
    widths.map((w) => w * bleed)
  );
  watercolour(wash, rng, outline, 0.7, pigment.wash, 10);
  ribbon(
    ink,
    pts,
    widths,
    alphas.map((a) => a * coreAlpha),
    pigment.ink
  );
};

// --- composition -------------------------------------------------------------------------

type Scene = {
  ink: Ctx;
  wash: Ctx;
  u: number;
  lineW: number;
  rng: Rng;
  pigment: Pigment;
  pick: () => Pigment;
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
  pool(wash, rng, at, size * rng.range(0.5, 0.8), rng.range(0.3, 0.5), pigment.wash);
  watercolour(wash, rng, pts, rng.range(0.7, 1), pigment.wash, 12);
  ribbon(ink, pts, widths, alpha, pigment.ink);
};

/** A rose: a whole Maurer rose, petals in watercolour, chord lattice faint, outline brushed. */
const rose = (sc: Scene, at: Vec, size: number) => {
  const { rng, ink, wash, lineW, pigment } = sc;
  const n = rng.pick([2, 3, 4, 5, 6, 7]);
  const d = rng.pick([29, 31, 37, 41, 47, 71, 97, 113, 137]);
  const angle = rng.range(0, Math.PI * 2);
  const petal: Vec[] = [];
  for (let k = 0; k <= 720; k++) {
    const th = (k * Math.PI) / 360;
    const r = Math.sin(n * th);
    petal.push([r * Math.cos(th), r * Math.sin(th)]);
  }
  const petals = place(petal, at, size, angle);
  pool(wash, rng, at, size * rng.range(0.8, 1.2), rng.range(0.25, 0.45), pigment.wash);
  watercolour(wash, rng, petals, rng.range(0.9, 1.3), pigment.wash, 18);
  const heart = petals.map(([x, y]): Vec => [
    at[0] + (x - at[0]) * 0.55,
    at[1] + (y - at[1]) * 0.55,
  ]);
  watercolour(wash, rng, heart, rng.range(0.7, 1), pigment.wash, 10);
  const chords = place(maurerArc(n, d, 0, 360), at, size, angle);
  const lattice = rng.range(0.05, 0.12);
  strokePath(
    ink,
    chords,
    lineW * 0.5,
    chords.map(() => lattice),
    pigment.ink
  );
  const widths = brushWidths(rng, petals.length, lineW * rng.range(0.5, 1), 0.3, 0.02, 0.02);
  ribbon(
    ink,
    petals,
    widths,
    petals.map(() => 0.35),
    pigment.ink
  );
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
  pool(wash, rng, at, size * rng.range(0.9, 1.3), rng.range(0.25, 0.45), pigment.wash);
  wash.globalCompositeOperation = 'multiply';
  for (const rh of rhombi) {
    const placed = place(rh, at, edge, angle);
    const cx = (placed[0]![0] + placed[2]![0]) / 2;
    const cy = (placed[0]![1] + placed[2]![1]) / 2;
    const dist = Math.hypot(cx - at[0], cy - at[1]);
    const side = (cx - at[0]) * cutDir[0] + (cy - at[1]) * cutDir[1] - cutOffset;
    const a = smoothstep(size, size * 0.2, dist) * smoothstep(-edge * 2, edge, side);
    if (a < 0.03) continue;
    fillPolygon(wash, placed, a * rng.range(0.4, 0.9), pigment.wash);
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
  const pts = place(rooted, at, size, dir + rng.range(-0.8, 0.8));
  const alpha = fadeProfile(rng, pts.length - 1, rng.range(0.1, 0.25)).map((v) => 0.4 + 0.6 * v);
  const widths = brushWidths(rng, pts.length, lineW * rng.range(0.9, 1.6), 0.4, 0.02, 0.6);
  brushstroke(sc, pts, widths, alpha, 2.2, 0.85);
};

const compose = (
  rng: Rng,
  ink: Ctx,
  wash: Ctx,
  W: number,
  H: number,
  dpr: number,
  pigments: Pigment[],
  accentChance: number
) => {
  const u = Math.min(W, H);
  const long = Math.max(W, H);
  const lineW = Math.max(dpr, u * 0.0055);
  const main = pigments[0]!;
  const accents = pigments.slice(1);
  const pick = (): Pigment =>
    accents.length > 0 && rng.chance(accentChance) ? rng.pick(accents) : main;
  const sc: Scene = { ink, wash, u, lineW, rng, pigment: main, pick };
  const landscape = W >= H;

  // Main stem: starts near one edge and grows across the long axis with a gentle wave.
  const fromLeft = rng.chance(0.5);
  const startAlong = long * rng.range(0.06, 0.18);
  const startAcross = u * rng.range(0.3, 0.7);
  const start: Vec = landscape
    ? [fromLeft ? startAlong : W - startAlong, startAcross]
    : [startAcross, fromLeft ? startAlong : H - startAlong];
  const baseHeading = landscape ? (fromLeft ? 0 : Math.PI) : fromLeft ? Math.PI / 2 : -Math.PI / 2;
  const heading = baseHeading + rng.range(-0.4, 0.4);
  const stemLength = long * rng.range(0.5, 0.75);
  const stem = growSpine(rng, start, heading, stemLength, 160, rng.range(0.6, 1.8));

  // Soft pools along the stem, in the stem's own pigment, so the whole thing has a body.
  const glowCount = rng.int(2, 3);
  for (let i = 0; i < glowCount; i++) {
    const p = stem[rng.int(10, stem.length - 10)]!;
    pool(wash, rng, p, u * rng.range(0.1, 0.18), rng.range(0.15, 0.3), main.wash);
  }

  const stemWidths = brushWidths(rng, stem.length, lineW * rng.range(2.2, 4), 0.4, 0.02, 0.35);
  const stemAlpha = stem.map(() => 0.9);

  // Nodes along the stem sprout leaves, roses, rosettes and tendrils, alternating sides.
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
    const dir = Math.atan2(n[1] * side, n[0] * side) + rng.range(-0.4, 0.4);
    const size = u * rng.range(0.1, 0.22) * (1 - 0.35 * t);
    sc.pigment = pick();
    const roll = rng.next();
    if (roll < 0.3) leaf(sc, p, dir, size);
    else if (roll < 0.55) rose(sc, p, size * 0.7);
    else if (roll < 0.8) blossom(sc, p, size * 0.8);
    else tendril(sc, p, dir, size);

    // Occasionally a side branch grows from the node and carries its own small piece.
    if (rng.chance(0.35) && branches.length < 2) {
      const branch = growSpine(rng, p, dir, u * rng.range(0.22, 0.45), 60, rng.range(0.8, 2.4));
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
      if (rng.chance(0.4)) leaf(sc, tip, tipDir, size * 0.7);
      else if (rng.chance(0.5)) rose(sc, tip, size * 0.5);
      else blossom(sc, tip, size * 0.55);
    }
  }

  // The stem is drawn last, as one continuous stroke, over everything it carries.
  sc.pigment = main;
  brushstroke(sc, stem, stemWidths, stemAlpha, 2.4, 0.88);

  // A few loose seeds drifting off the tip.
  const tip = stem[stem.length - 1]!;
  const seeds = rng.int(0, 5);
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

// --- paper, wet edges and composite ------------------------------------------------------

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

  const washAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    return washData[(y * W + x) * 4 + 3]! / 255;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const inkA = inkData[i + 3]! / 255;
      const washRaw = washData[i + 3]! / 255;

      // Paper: coarse granulation plus fine tooth, and pigment settles darker into the grain.
      const grain = valueNoise2(x * grainScale, y * grainScale) - 0.5;
      const tooth = valueNoise2(x * fineScale + 31.7, y * fineScale + 17.3) - 0.5;
      const paper = 1 + 0.32 * grain + 0.12 * tooth;

      // Wet edge: where the wash density changes quickly, pigment gathers into a darker rim.
      const around =
        (washAt(x - rimStep, y) +
          washAt(x + rimStep, y) +
          washAt(x, y - rimStep) +
          washAt(x, y + rimStep)) /
        4;
      const rim = Math.abs(washRaw - around);
      const washA = Math.min(1, Math.max(0, washRaw * paper + rim * 1.1));

      let r = 255;
      let g = 255;
      let b = 255;
      let a = isWhite ? 1 : 0;

      if (washA > 0.002) {
        const wr = washData[i]!;
        const wg = washData[i + 1]!;
        const wb = washData[i + 2]!;
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
const pigmentsFrom = (options: PieceOptions): Pigment[] => {
  const deep = hexToRgb(options.inks[0]);
  const midTone = hexToRgb(options.inks[1] ?? options.inks[0]);
  const white: [number, number, number] = [255, 255, 255];
  const main: Pigment = { ink: rgb(deep), wash: rgb(mixRgb(midTone, white, 0.25)) };
  const accents = (options.accents ?? []).map((hex): Pigment => {
    const c = hexToRgb(hex);
    return { ink: rgb(mixRgb(c, deep, 0.4)), wash: rgb(mixRgb(c, white, 0.08)) };
  });
  return [main, ...accents];
};

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
  const pad = 1.6;
  const WW = Math.round(W * pad);
  const HH = Math.round(H * pad);
  let ink = makeLayer(WW, HH);
  let wash = makeLayer(WW, HH);
  ink.translate((WW - W) / 2, (HH - H) / 2);
  wash.translate((WW - W) / 2, (HH - H) / 2);
  compose(makeRng(seed), ink, wash, W, H, dpr, pigmentsFrom(options), options.accentChance ?? 0.3);

  const box = measure(
    [ink.getImageData(0, 0, WW, HH).data, wash.getImageData(0, 0, WW, HH).data],
    WW,
    HH
  );
  const fittedInk = makeLayer(W, H);
  const fittedWash = makeLayer(W, H);
  if (box) {
    const margin = 0.06;
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
