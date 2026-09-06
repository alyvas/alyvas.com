export type Segment = {
  /** Mask at working resolution, 1 = inside. */
  mask: Uint8Array;
  mw: number;
  mh: number;
  scale: number;
  bbox: { x: number; y: number; w: number; h: number };
  area: number;
  mean: [number, number, number];
  saliency: number;
  /** Outline in full-res coordinates, simplified, closed (first point not repeated). */
  outline: Array<[number, number]>;
};

type Point = [number, number];
type Edge = { a: Point; b: Point };
type Component = { pixels: number[]; minX: number; minY: number; maxX: number; maxY: number };

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

const simplify = (points: Point[], epsilon: number): Point[] => {
  if (points.length <= 2) return points.slice();
  const [ax, ay] = points[0]!;
  const [bx, by] = points.at(-1)!;
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  let furthest = epsilon;
  let index = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]!;
    const distance =
      length === 0
        ? Math.hypot(x - ax, y - ay)
        : Math.abs(dy * x - dx * y + bx * ay - by * ax) / length;
    if (distance > furthest) {
      furthest = distance;
      index = i;
    }
  }
  if (index < 0) return [points[0]!, points.at(-1)!];
  const left = simplify(points.slice(0, index + 1), epsilon);
  const right = simplify(points.slice(index), epsilon);
  return [...left.slice(0, -1), ...right];
};

const trace = (mask: Uint8Array, mw: number, mh: number): Point[] => {
  const edges: Edge[] = [];
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < mw && y < mh && mask[y * mw + x] === 1;
  const add = (a: Point, b: Point) => edges.push({ a, b });
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) add([x, y], [x + 1, y]);
      if (!inside(x + 1, y)) add([x + 1, y], [x + 1, y + 1]);
      if (!inside(x, y + 1)) add([x + 1, y + 1], [x, y + 1]);
      if (!inside(x - 1, y)) add([x, y + 1], [x, y]);
    }
  }
  const key = ([x, y]: Point) => `${x},${y}`;
  const outgoing = new Map<string, Edge[]>();
  for (const edge of edges) {
    const list = outgoing.get(key(edge.a));
    if (list) list.push(edge);
    else outgoing.set(key(edge.a), [edge]);
  }
  const used = new Set<Edge>();
  const loops: Point[][] = [];
  for (const start of edges) {
    if (used.has(start)) continue;
    const loop: Point[] = [start.a];
    let current = start.b;
    used.add(start);
    let closed = false;
    for (let step = 0; step <= edges.length; step++) {
      if (key(current) === key(loop[0]!)) {
        closed = true;
        break;
      }
      loop.push(current);
      const next = outgoing.get(key(current))?.find((edge) => !used.has(edge));
      if (next === undefined) break;
      used.add(next);
      current = next.b;
    }
    if (closed && loop.length >= 3) loops.push(loop);
  }
  const area = (points: Point[]) =>
    Math.abs(
      points.reduce((sum, [x, y], i) => {
        const [nx, ny] = points[(i + 1) % points.length]!;
        return sum + x * ny - nx * y;
      }, 0)
    );
  const largest = loops.sort((a, b) => area(b) - area(a))[0];
  return largest ? simplify([...largest, largest[0]!], 1.5).slice(0, -1) : [];
};

const normalize = (values: number[]) => {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return hi === lo ? values.map(() => 0) : values.map((value) => (value - lo) / (hi - lo));
};

export const segmentImage = (
  source: HTMLCanvasElement,
  seed: number,
  options?: { k?: number; maxWorking?: number }
): Segment[] => {
  const { width, height } = source;
  if (width < 1 || height < 1) return [];
  const maxSide = Math.max(width, height);
  const targetSide = Math.min(maxSide, Math.max(1, Math.floor(options?.maxWorking ?? 160)));
  const scale = maxSide / targetSide;
  const mw = Math.max(1, Math.round(width / scale));
  const mh = Math.max(1, Math.round(height / scale));
  const working = document.createElement('canvas');
  working.width = mw;
  working.height = mh;
  const wctx = working.getContext('2d');
  if (!wctx) return [];
  wctx.imageSmoothingEnabled = true;
  wctx.drawImage(source, 0, 0, mw, mh);
  const pixels = wctx.getImageData(0, 0, mw, mh).data;
  const total = mw * mh;
  const luma = new Float32Array(total);
  let sumR = 0,
    sumG = 0,
    sumB = 0;
  for (let i = 0; i < total; i++) {
    const j = i * 4;
    const r = pixels[j]!;
    const g = pixels[j + 1]!;
    const b = pixels[j + 2]!;
    sumR += r;
    sumG += g;
    sumB += b;
    luma[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  }
  const imageMean: [number, number, number] = [sumR / total, sumG / total, sumB / total];
  const rnd = mulberry32(seed);
  const k = Math.max(1, Math.min(total, Math.floor(options?.k ?? 6)));
  const centers = new Float32Array(k * 3);
  for (let i = 0; i < k; i++) {
    const j = Math.floor(rnd() * total) * 4;
    centers.set([pixels[j]!, pixels[j + 1]!, pixels[j + 2]!], i * 3);
  }
  const labels = new Int16Array(total);
  for (let iteration = 0; iteration < 8; iteration++) {
    const sums = new Float64Array(k * 3);
    const counts = new Uint32Array(k);
    for (let p = 0; p < total; p++) {
      const j = p * 4;
      let label = 0;
      let best = Number.POSITIVE_INFINITY;
      for (let c = 0; c < k; c++) {
        const distance =
          (centers[c * 3]! - pixels[j]!) ** 2 +
          (centers[c * 3 + 1]! - pixels[j + 1]!) ** 2 +
          (centers[c * 3 + 2]! - pixels[j + 2]!) ** 2;
        if (distance < best) {
          best = distance;
          label = c;
        }
      }
      labels[p] = label;
      counts[label] = counts[label]! + 1;
      sums[label * 3] += pixels[j]!;
      sums[label * 3 + 1] += pixels[j + 1]!;
      sums[label * 3 + 2] += pixels[j + 2]!;
    }
    for (let c = 0; c < k; c++) {
      if (!counts[c]) continue;
      centers.set(
        [sums[c * 3]! / counts[c]!, sums[c * 3 + 1]! / counts[c]!, sums[c * 3 + 2]! / counts[c]!],
        c * 3
      );
    }
  }
  const seen = new Uint8Array(total);
  const components: Component[] = [];
  for (let start = 0; start < total; start++) {
    if (seen[start]) continue;
    const label = labels[start]!;
    const queue = [start];
    const members: number[] = [];
    seen[start] = 1;
    let minX = mw,
      minY = mh,
      maxX = 0,
      maxY = 0;
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head]!;
      const x = index % mw;
      const y = Math.floor(index / mw);
      members.push(index);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const next of [index - 1, index + 1, index - mw, index + mw]) {
        if (next < 0 || next >= total || seen[next] || labels[next] !== label) continue;
        if (Math.abs((next % mw) - x) + Math.abs(Math.floor(next / mw) - y) !== 1) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    if (members.length >= total * 0.004)
      components.push({ pixels: members, minX, minY, maxX, maxY });
  }
  components.sort((a, b) => b.pixels.length - a.pixels.length);
  const raw = components.slice(0, 12).map((component) => {
    const mask = new Uint8Array(total);
    let r = 0,
      g = 0,
      b = 0,
      gradient = 0;
    for (const index of component.pixels) {
      mask[index] = 1;
      const j = index * 4;
      r += pixels[j]!;
      g += pixels[j + 1]!;
      b += pixels[j + 2]!;
      const x = index % mw;
      const y = Math.floor(index / mw);
      const left = luma[y * mw + Math.max(0, x - 1)]!;
      const right = luma[y * mw + Math.min(mw - 1, x + 1)]!;
      const top = luma[Math.max(0, y - 1) * mw + x]!;
      const bottom = luma[Math.min(mh - 1, y + 1) * mw + x]!;
      gradient += Math.hypot(right - left, bottom - top) / 2;
    }
    const mean: [number, number, number] = [r, g, b].map(
      (value) => value / component.pixels.length
    ) as [number, number, number];
    const colourDistance = Math.hypot(
      mean[0] - imageMean[0],
      mean[1] - imageMean[1],
      mean[2] - imageMean[2]
    );
    const traced = trace(mask, mw, mh);
    const outline =
      traced.length >= 3
        ? traced
        : ([
            [component.minX, component.minY],
            [component.maxX + 1, component.minY],
            [component.maxX + 1, component.maxY + 1],
            [component.minX, component.maxY + 1],
          ] as Point[]);
    return {
      mask,
      bbox: {
        x: component.minX * scale,
        y: component.minY * scale,
        w: (component.maxX + 1 - component.minX) * scale,
        h: (component.maxY + 1 - component.minY) * scale,
      },
      area: component.pixels.length / total,
      mean,
      gradient: gradient / component.pixels.length,
      colourDistance,
      outline: outline.map(([x, y]) => [x * scale, y * scale] as Point),
    };
  });
  const gradients = normalize(raw.map((component) => component.gradient));
  const colours = normalize(raw.map((component) => component.colourDistance));
  return raw
    .map((component, i) => ({
      ...component,
      mw,
      mh,
      scale,
      saliency: 0.6 * gradients[i]! + 0.4 * colours[i]!,
    }))
    .sort((a, b) => b.saliency - a.saliency);
};

export const segmentPath = (ctx: CanvasRenderingContext2D, seg: Segment) => {
  ctx.beginPath();
  const first = seg.outline[0];
  if (first) {
    ctx.moveTo(first[0], first[1]);
    for (let i = 1; i < seg.outline.length; i++) {
      const point = seg.outline[i]!;
      ctx.lineTo(point[0], point[1]);
    }
  }
  ctx.closePath();
};
