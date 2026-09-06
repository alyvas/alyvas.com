import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';

import { randomSeed, renderPlate } from './generative/plate';

const styles = stylex.create({
  page: {
    minHeight: '100svh',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    backgroundColor: '#1a1a1c',
    color: '#d9d4cc',
    fontFamily: "'Geist Pixel Variable', 'Geist Variable', monospace",
    fontSize: '14px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  canvas: {
    display: 'block',
    boxShadow: '0 30px 80px rgb(0 0 0 / 0.5)',
  },
  meta: {
    margin: 0,
    opacity: 0.6,
    fontVariantNumeric: 'tabular-nums',
  },
});

const readSeedParam = () => {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed >>> 0 : randomSeed();
};

const ASPECT = 4 / 5;

/** /sketch2: a plate in the enigmatriz and gencup manner. Click or press R for a new seed. */
const Sketch2Page = () => {
  const [seed, setSeed] = useState(readSeedParam);
  const [size, setSize] = useState(() => [window.innerWidth, window.innerHeight]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const onResize = () => setSize([window.innerWidth, window.innerHeight]);
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') setSeed(randomSeed());
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', String(seed));
    window.history.replaceState(null, '', url);
  }, [seed]);

  const height = Math.floor(Math.min(size[1]! * 0.86, (size[0]! * 0.9) / ASPECT));
  const width = Math.floor(height * ASPECT);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cancelled = false;
    // The pixel font must be loaded before the canvas can draw with it.
    document.fonts.load(`12px 'Geist Pixel Variable'`).then(() => {
      if (cancelled) return;
      const raw = new URLSearchParams(window.location.search).get('structure');
      const structure = (['rules', 'sparse', 'rows', 'boxes', 'masonry', 'minigrid'] as const).find(
        (s) => s === raw
      );
      renderPlate(canvas, { seed, width: width * dpr, height: height * dpr, dpr, structure });
    });
    return () => {
      cancelled = true;
    };
  }, [seed, width, height]);

  return (
    <main {...stylex.props(styles.page)} onClick={() => setSeed(randomSeed())}>
      <div {...stylex.props(styles.stack)}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="A generated plate: painted vine, ASCII windows, cutouts and labels"
          {...stylex.props(styles.canvas)}
          style={{ width, height }}
        />
        <p {...stylex.props(styles.meta)}>{seed}</p>
      </div>
    </main>
  );
};

export default Sketch2Page;
