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
  /** One or two ink colours as hex. The second, if given, is used for washes and fills. */
  inks: [string] | [string, string];
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

/** Per-segment alpha: fades in and out along the path, with a gentle random ripple. */
const fadeProfile = (rng: Rng, count: number, fadeFraction: number): number[] => {
  const ripplePhase = rng.range(0, Math.PI * 2);
  const rippleFreq = rng.range(2, 6);
  const profile: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const ends = smoothstep(0, fadeFraction, t) * smoothstep(1, 1 - fadeFraction, t);
    const ripple = 0.75 + 0.25 * Math.sin(t * rippleFreq * Math.PI * 2 + ripplePhase);
    profile.push(ends * ripple);
  }
  return profile;
};

const strokePath = (ctx: Ctx, pts: Vec[], width: number, alpha: number[], color = 'rgb(0 0 0)') => {
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

/** Erase a soft band along the path so the fragment reads as laid on top of what it crosses. */
const seam = (ctx: Ctx, pts: Vec[], width: number, alpha: number[]) => {
  ctx.globalCompositeOperation = 'destination-out';
  const passes = 3;
  for (let p = passes; p >= 1; p--) {
    const w = width * (1 + p * 1.6);
    strokePath(
      ctx,
      pts,
      w,
      alpha.map((a) => a * (0.28 / p))
    );
  }
  ctx.globalCompositeOperation = 'source-over';
};

const radialWash = (ctx: Ctx, center: Vec, radius: number, alpha: number) => {
  const g = ctx.createRadialGradient(center[0], center[1], 0, center[0], center[1], radius);
  g.addColorStop(0, `rgb(0 0 0 / ${alpha})`);
  g.addColorStop(0.55, `rgb(0 0 0 / ${alpha * 0.45})`);
  g.addColorStop(1, 'rgb(0 0 0 / 0)');
  ctx.fillStyle = g;
  ctx.fillRect(center[0] - radius, center[1] - radius, radius * 2, radius * 2);
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
    return v / total; // roughly -1..1
  };
};

/**
 * A spine: a smooth wandering path. Heading drifts with noise and bends gently back toward a
 * target direction so the stem reads as growing rather than random-walking.
 */
const growSpine = (
  rng: Rng,
  start: Vec,
  heading: number,
  length: number,
  steps: number,
  wobble: number
): Vec[] => {
  const noise = makeNoise1(rng, 3);
  const pts: Vec[] = [start];
  let h = heading;
  let [x, y] = start;
  const step = length / steps;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    h += noise(t * 6) * wobble * step * 0.02 + (heading - h) * 0.03;
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

/** A brush-like ribbon: filled quads between left and right offsets, width and alpha per point. */
const ribbon = (ctx: Ctx, pts: Vec[], widths: number[], alphas: number[]) => {
  const n = normalsOf(pts);
  ctx.fillStyle = 'rgb(0 0 0)';
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
    // Round the joint so width changes never show a notch.
    ctx.beginPath();
    ctx.arc(p1[0], p1[1], w1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

/** Thick-and-thin width along a path: noise-modulated, tapering at both ends. */
const brushWidths = (
  rng: Rng,
  count: number,
  base: number,
  variation: number,
  taperIn: number,
  taperOut: number
) => {
  const noise = makeNoise1(rng, 3);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const taper = smoothstep(0, taperIn, t) * smoothstep(1, 1 - taperOut, t);
    const swell = 1 + variation * noise(t * 5 + 1);
    out.push(Math.max(0.15, base * swell * (0.35 + 0.65 * taper)));
  }
  return out;
};

const fillPolygon = (ctx: Ctx, pts: Vec[], alpha: number) => {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgb(0 0 0)';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
};

// --- composition -------------------------------------------------------------------------

type Scene = { ink: Ctx; wash: Ctx; u: number; lineW: number; rng: Rng };

/** A leaf: a fan of Maurer chords rooted at the node, with the fan itself washed in. */
const leaf = (sc: Scene, at: Vec, dir: number, size: number) => {
  const { rng, ink, wash, u, lineW } = sc;
  const n = rng.pick([2, 3, 4, 5, 6, 7]);
  const d = rng.pick([29, 31, 37, 41, 47, 71, 97, 113, 137]);
  const raw = maurerArc(n, d, rng.int(0, 300), rng.int(6, 22));
  // Root the fragment: translate so its first point sits on the node.
  const [ox, oy] = raw[0]!;
  const rooted = raw.map(([x, y]): Vec => [x - ox, y - oy]);
  const pts = place(rooted, at, size, dir + rng.range(-0.5, 0.5));
  const alpha = fadeProfile(rng, pts.length - 1, rng.range(0.1, 0.3)).map((v) => 0.55 + 0.45 * v);
  const widths = brushWidths(rng, pts.length, lineW * rng.range(1.2, 2.6), 0.7, 0.05, 0.4);
  if (rng.chance(0.75)) {
    // Wash the fan so the leaf has body; strength falls off away from the node.
    const g = wash.createRadialGradient(at[0], at[1], 0, at[0], at[1], size * 1.1);
    g.addColorStop(0, `rgb(0 0 0 / ${rng.range(0.5, 0.85)})`);
    g.addColorStop(1, 'rgb(0 0 0 / 0)');
    wash.fillStyle = g;
    wash.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? wash.moveTo(x, y) : wash.lineTo(x, y)));
    wash.closePath();
    wash.fill();
  }
  seam(
    ink,
    pts,
    lineW * 2,
    alpha.map((v) => v * 0.6)
  );
  ribbon(ink, pts, widths, alpha);
  void u;
};

/** A blossom: a Penrose patch whose tiles fill with a gradient from the centre outward. */
const blossom = (sc: Scene, at: Vec, size: number) => {
  const { rng, ink, wash, lineW } = sc;
  const gammas = [rng.next(), rng.next(), rng.next(), rng.next()];
  gammas.push(-gammas.reduce((a, b) => a + b, 0));
  const rhombi = penroseRhombi(gammas, 4);
  const edge = size * rng.range(0.22, 0.34);
  const angle = rng.range(0, Math.PI * 2);
  const cutAngle = rng.range(0, Math.PI * 2);
  const cutDir: Vec = [Math.cos(cutAngle), Math.sin(cutAngle)];
  const cutOffset = rng.range(-0.6, 0.3) * size;
  const density = rng.range(0.35, 0.9);
  for (const rh of rhombi) {
    const placed = place(rh, at, edge, angle);
    const cx = (placed[0]![0] + placed[2]![0]) / 2;
    const cy = (placed[0]![1] + placed[2]![1]) / 2;
    const dist = Math.hypot(cx - at[0], cy - at[1]);
    const side = (cx - at[0]) * cutDir[0] + (cy - at[1]) * cutDir[1] - cutOffset;
    const a = smoothstep(size, size * 0.3, dist) * smoothstep(-edge, edge * 0.6, side);
    if (a < 0.03) continue;
    if (rng.chance(density)) fillPolygon(wash, placed, a * rng.range(0.35, 0.95));
    if (rng.chance(0.85)) {
      ink.globalAlpha = Math.min(1, a * rng.range(0.5, 1));
      ink.lineWidth = lineW * rng.range(0.7, 1.6);
      ink.strokeStyle = 'rgb(0 0 0)';
      ink.beginPath();
      placed.forEach(([x, y], i) => (i === 0 ? ink.moveTo(x, y) : ink.lineTo(x, y)));
      ink.closePath();
      ink.stroke();
    }
    if (rng.chance(0.12)) fillPolygon(ink, placed, a * rng.range(0.5, 1));
  }
  ink.globalAlpha = 1;
};

/** A tendril: a Lissajous arc curling away from the node as a thin-to-thick ribbon. */
const tendril = (sc: Scene, at: Vec, dir: number, size: number) => {
  const { rng, ink, lineW } = sc;
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
  const widths = brushWidths(rng, pts.length, lineW * rng.range(1, 2.2), 0.8, 0.02, 0.6);
  seam(
    ink,
    pts,
    lineW * 2,
    alpha.map((v) => v * 0.5)
  );
  ribbon(ink, pts, widths, alpha);
};

const compose = (rng: Rng, ink: Ctx, wash: Ctx, W: number, H: number, dpr: number) => {
  const u = Math.min(W, H);
  const long = Math.max(W, H);
  const lineW = Math.max(dpr, u * 0.0055);
  const sc: Scene = { ink, wash, u, lineW, rng };
  const landscape = W >= H;

  // Main stem: starts near one edge and grows across the long axis with a gentle wave.
  const fromLeft = rng.chance(0.5);
  const startAlong = long * rng.range(0.04, 0.16);
  const startAcross = u * rng.range(0.3, 0.7);
  const start: Vec = landscape
    ? [fromLeft ? startAlong : W - startAlong, startAcross]
    : [startAcross, fromLeft ? startAlong : H - startAlong];
  const baseHeading = landscape ? (fromLeft ? 0 : Math.PI) : fromLeft ? Math.PI / 2 : -Math.PI / 2;
  const heading = baseHeading + rng.range(-0.5, 0.5);
  const stemLength = long * rng.range(0.6, 0.9);
  const stemSteps = 160;
  const stem = growSpine(rng, start, heading, stemLength, stemSteps, rng.range(0.6, 2.2));

  // Soft glow along the stem in the second ink, so the whole thing has a body.
  const glowCount = rng.int(2, 4);
  for (let i = 0; i < glowCount; i++) {
    const p = stem[rng.int(10, stem.length - 10)]!;
    radialWash(wash, p, u * rng.range(0.12, 0.28), rng.range(0.15, 0.35));
  }

  const stemWidths = brushWidths(rng, stem.length, lineW * rng.range(2.5, 5), 0.85, 0.02, 0.35);
  const stemAlpha = stem.map((_, i) => {
    const t = i / (stem.length - 1);
    return 0.8 + 0.2 * Math.sin(t * 9) * (rng.chance(0.5) ? 1 : 0.3);
  });

  // Nodes along the stem sprout leaves, blossoms and tendrils, alternating sides.
  const normals = normalsOf(stem);
  const nodeCount = rng.int(4, 8);
  let side = rng.chance(0.5) ? 1 : -1;
  const branches: Vec[][] = [];
  for (let k = 0; k < nodeCount; k++) {
    const t = 0.1 + 0.85 * ((k + rng.range(0.1, 0.9)) / nodeCount);
    const i = Math.min(stem.length - 2, Math.floor(t * (stem.length - 1)));
    const p = stem[i]!;
    const n = normals[i]!;
    side = rng.chance(0.75) ? -side : side;
    const dir = Math.atan2(n[1] * side, n[0] * side) + rng.range(-0.4, 0.4);
    const size = u * rng.range(0.1, 0.24) * (1 - 0.35 * t);
    const roll = rng.next();
    if (roll < 0.42) leaf(sc, p, dir, size);
    else if (roll < 0.72) blossom(sc, p, size * 0.85);
    else tendril(sc, p, dir, size);

    // Occasionally a side branch grows from the node and carries its own small pieces.
    if (rng.chance(0.35) && branches.length < 2) {
      const branch = growSpine(rng, p, dir, u * rng.range(0.25, 0.5), 60, rng.range(1, 3));
      branches.push(branch);
      const bw = brushWidths(rng, branch.length, lineW * rng.range(1.5, 3), 0.8, 0.02, 0.5);
      seam(
        ink,
        branch,
        lineW * 1.5,
        branch.map(() => 0.4)
      );
      ribbon(
        ink,
        branch,
        bw,
        branch.map(() => 0.9)
      );
      const tip = branch[branch.length - 1]!;
      const tipDir = Math.atan2(
        tip[1] - branch[branch.length - 6]![1],
        tip[0] - branch[branch.length - 6]![0]
      );
      if (rng.chance(0.6)) leaf(sc, tip, tipDir, size * 0.7);
      else blossom(sc, tip, size * 0.55);
    }
  }

  // The stem is drawn last so it sits on top of everything it carries.
  seam(
    ink,
    stem,
    lineW * 3,
    stemAlpha.map((v) => v * 0.35)
  );
  ribbon(ink, stem, stemWidths, stemAlpha);

  // A few loose seeds drifting off the tip.
  const tip = stem[stem.length - 1]!;
  const seeds = rng.int(0, 6);
  for (let i = 0; i < seeds; i++) {
    const ang = heading + rng.range(-1, 1);
    const dist = u * rng.range(0.03, 0.18);
    const c: Vec = [tip[0] + Math.cos(ang) * dist, tip[1] + Math.sin(ang) * dist];
    ink.globalAlpha = rng.range(0.4, 1);
    ink.fillStyle = 'rgb(0 0 0)';
    ink.beginPath();
    ink.arc(c[0], c[1], lineW * rng.range(0.6, 2), 0, Math.PI * 2);
    ink.fill();
  }
  ink.globalAlpha = 1;
};

// --- dither and composite ----------------------------------------------------------------

const BAYER8 = (() => {
  const m = new Float32Array(64);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const q = x ^ y;
      let v = 0;
      for (let k = 0; k < 3; k++) {
        v = (v << 2) | (((q >> k) & 1) << 1) | ((y >> k) & 1);
      }
      m[y * 8 + x] = (v + 0.5) / 64;
    }
  }
  return m;
})();

const composite = (
  target: CanvasRenderingContext2D,
  ink: Ctx,
  wash: Ctx,
  W: number,
  H: number,
  dpr: number,
  inks: PieceOptions['inks'],
  ground: PieceOptions['ground']
) => {
  const inkData = ink.getImageData(0, 0, W, H).data;
  const washData = wash.getImageData(0, 0, W, H).data;
  const out = target.createImageData(W, H);
  const o = out.data;

  // Recentre: find the drawn bounding box and shift it to the middle of the canvas.
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4 + 3;
      if (inkData[i]! > 40 || washData[i]! > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const hasContent = maxX > minX && maxY > minY;
  const shiftX = hasContent ? Math.round(W / 2 - (minX + maxX) / 2) : 0;
  const shiftY = hasContent ? Math.round(H / 2 - (minY + maxY) / 2) : 0;
  const [ir, ig, ib] = hexToRgb(inks[0]);
  const [wr, wg, wb] = hexToRgb(inks[1] ?? inks[0]);
  const washCell = Math.max(1, Math.round(dpr * (Math.min(W, H) < 420 * dpr ? 1 : 2)));
  const inkCell = Math.max(1, Math.round(dpr));

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const sx = x - shiftX;
      const sy = y - shiftY;
      const inside = sx >= 0 && sy >= 0 && sx < W && sy < H;
      const si = (sy * W + sx) * 4;
      const inkA = inside ? inkData[si + 3]! / 255 : 0;
      const washA = inside ? washData[si + 3]! / 255 : 0;
      const tInk = BAYER8[((y / inkCell) & 7) * 8 + ((x / inkCell) & 7)]!;
      const tWash = BAYER8[(((y / washCell) | 0) & 7) * 8 + (((x / washCell) | 0) & 7)]!;

      if (inkA > 0.8 || inkA * 1.08 > tInk) {
        o[i] = ir;
        o[i + 1] = ig;
        o[i + 2] = ib;
        o[i + 3] = 255;
      } else if (washA * 0.9 > tWash) {
        o[i] = wr;
        o[i + 1] = wg;
        o[i + 2] = wb;
        o[i + 3] = 255;
      } else if (ground === 'white') {
        o[i] = 255;
        o[i + 1] = 255;
        o[i + 2] = 255;
        o[i + 3] = 255;
      }
    }
  }
  target.putImageData(out, 0, 0);
};

// --- entry -------------------------------------------------------------------------------

export const renderPiece = (canvas: HTMLCanvasElement, options: PieceOptions) => {
  const { seed, width, height, dpr, inks, ground } = options;
  const W = Math.max(1, Math.round(width));
  const H = Math.max(1, Math.round(height));
  canvas.width = W;
  canvas.height = H;
  const target = canvas.getContext('2d');
  if (!target) return;

  const makeLayer = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c.getContext('2d')!;
  };
  const ink = makeLayer();
  const wash = makeLayer();

  compose(makeRng(seed), ink, wash, W, H, dpr);
  composite(target, ink, wash, W, H, dpr, inks, ground);
};

export const randomSeed = () => Math.floor(Math.random() * 0xffffffff) >>> 0;
