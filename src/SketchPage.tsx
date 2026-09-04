import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from 'react';

import { GenerativePiece } from './GenerativePiece';
import { randomSeed } from './generative/piece';

const INKS: [string, string] = ['#2f1b4e', '#7a5aa8'];
const ASPECT = 1.6;

const styles = stylex.create({
  page: {
    minHeight: '100svh',
    display: 'grid',
    placeItems: 'center',
    padding:
      'max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))',
    backgroundColor: '#ffffff',
    color: '#2a2233',
    fontFamily: "'Geist Variable', Geist, sans-serif",
    fontSize: '24px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
  },
  sheet: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  meta: {
    margin: 0,
    opacity: 0.55,
    fontVariantNumeric: 'tabular-nums',
  },
});

const readSeedParam = () => {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed >>> 0 : randomSeed();
};

const fit = (fraction: number, max: number) =>
  Math.min(max, Math.floor(Math.min(window.innerWidth / ASPECT, window.innerHeight) * fraction));

const useWidth = (fraction: number, max: number) => {
  const [size, setSize] = useState(() => fit(fraction, max));
  useEffect(() => {
    const update = () => setSize(fit(fraction, max));
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [fraction, max]);
  return size;
};

/** One still generative piece, large. Click or press R for a new seed; ?seed=N pins one; ?sheet shows twelve. */
const SketchPage = () => {
  const [seed, setSeed] = useState(readSeedParam);
  const sheet = new URLSearchParams(window.location.search).has('sheet');
  const height = useWidth(sheet ? 0.24 : 0.82, sheet ? 260 : 700);
  const width = Math.round(height * ASPECT);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') setSeed(randomSeed());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', String(seed));
    window.history.replaceState(null, '', url);
  }, [seed]);

  if (sheet) {
    const seeds = Array.from({ length: 12 }, (_, i) => (seed + i * 2654435761) >>> 0);
    return (
      <main {...stylex.props(styles.page)} onClick={() => setSeed(randomSeed())}>
        <div {...stylex.props(styles.sheet)}>
          {seeds.map((s) => (
            <GenerativePiece
              key={s}
              seed={s}
              width={width}
              height={height}
              inks={INKS}
              ground="white"
            />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main {...stylex.props(styles.page)} onClick={() => setSeed(randomSeed())}>
      <div {...stylex.props(styles.stack)}>
        <GenerativePiece seed={seed} width={width} height={height} inks={INKS} ground="white" />
        <p {...stylex.props(styles.meta)}>{seed}</p>
      </div>
    </main>
  );
};

export default SketchPage;
