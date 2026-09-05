import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from 'react';

import { GenerativePiece } from './GenerativePiece';
import { randomSeed } from './generative/piece';

// Montiel-leaning pigments: plum ink, lilac wash, and clear accents of coral, peach, sky and magenta.
const INKS: [string, string] = ['#46286c', '#9d82c8'];
const ACCENTS = ['#e8735a', '#f2a97e', '#6e93d6', '#c94f8c', '#e6b35a'];
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
  const [elegance, setElegance] = useState(() =>
    new URLSearchParams(window.location.search).has('elegant') ? 1 : 0.5
  );
  const [big, setBig] = useState(() => new URLSearchParams(window.location.search).has('big'));
  const [geometric, setGeometric] = useState(() =>
    new URLSearchParams(window.location.search).has('geometric') ? 1 : 0.15
  );
  const sheet = new URLSearchParams(window.location.search).has('sheet');
  const fitted = useWidth(sheet ? 0.24 : 0.82, sheet ? 260 : 700);
  const [viewport, setViewport] = useState(() => window.innerWidth);
  useEffect(() => {
    const update = () => setViewport(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const width = big ? Math.round(viewport * 0.7) : Math.round(fitted * ASPECT);
  const height = big ? Math.round(width / 2) : fitted;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') setSeed(randomSeed());
      if (event.key === 'e' || event.key === 'E') setElegance((v) => (v > 0.75 ? 0.5 : 1));
      if (event.key === 'g' || event.key === 'G') setGeometric((v) => (v > 0.75 ? 0.15 : 1));
      if (event.key === 'b' || event.key === 'B') setBig((v) => !v);
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
              accents={ACCENTS}
              elegance={elegance}
              geometric={geometric}
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
        <GenerativePiece
          seed={seed}
          width={width}
          height={height}
          inks={INKS}
          accents={ACCENTS}
          elegance={elegance}
          geometric={geometric}
          stacks={big ? 22 : 1}
          ground="white"
        />
        <p {...stylex.props(styles.meta)}>{seed}</p>
      </div>
    </main>
  );
};

export default SketchPage;
