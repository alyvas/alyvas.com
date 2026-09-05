import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from 'react';

import { GenerativePiece } from './GenerativePiece';
import { randomSeed } from './generative/piece';

// Montiel-leaning pigments: plum ink, lilac wash, and clear accents of coral, peach, sky and magenta.
const INKS: [string, string] = ['#46286c', '#9d82c8'];
const ACCENTS = ['#e8735a', '#f2a97e', '#6e93d6', '#c94f8c', '#e6b35a'];
const ASPECT = 1.6;
const BASE_STACKS = 22;

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
  // Controls live in the bottom-right corner and only show while the corner is hovered.
  corner: {
    position: 'fixed',
    right: 0,
    bottom: 0,
    width: '320px',
    height: '220px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: '24px',
    cursor: 'default',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '14px 16px',
    borderRadius: '14px',
    backgroundColor: 'rgb(255 255 255 / 0.92)',
    boxShadow: '0 8px 30px rgb(42 34 51 / 0.12)',
    fontSize: '14px',
    opacity: {
      default: 0,
      ':hover': 1,
    },
    transform: {
      default: 'translateY(6px)',
      ':hover': 'translateY(0)',
    },
    transition: 'opacity 180ms ease, transform 180ms ease',
  },
  row: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  button: {
    appearance: 'none',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgb(42 34 51 / 0.18)',
    borderRadius: '999px',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'rgb(42 34 51 / 0.06)',
    },
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: '14px',
    padding: '6px 12px',
    cursor: 'pointer',
  },
  buttonOn: {
    backgroundColor: '#2a2233',
    borderColor: '#2a2233',
    color: '#ffffff',
  },
  slider: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontVariantNumeric: 'tabular-nums',
  },
  range: {
    flex: 1,
    accentColor: '#2a2233',
  },
});

const params = () => new URLSearchParams(window.location.search);

const readSeedParam = () => {
  const raw = params().get('seed');
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed >>> 0 : randomSeed();
};

const fit = (fraction: number, max: number) =>
  Math.min(max, Math.floor(Math.min(window.innerWidth / ASPECT, window.innerHeight) * fraction));

const useViewport = () => {
  const [size, setSize] = useState(() => [window.innerWidth, window.innerHeight]);
  useEffect(() => {
    const update = () => setSize([window.innerWidth, window.innerHeight]);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return size;
};

/**
 * One still generative piece, large. Click or press R for a new seed. E, G and B toggle elegant,
 * geometric and big; hover the bottom-right corner for buttons and the density slider.
 * ?seed=N pins a seed; ?sheet shows twelve; ?elegant, ?geometric, ?big preset the toggles.
 */
const SketchPage = () => {
  const [seed, setSeed] = useState(readSeedParam);
  const [sheet, setSheet] = useState(() => params().has('sheet'));
  const [elegant, setElegant] = useState(() => params().has('elegant'));
  const [geometric, setGeometric] = useState(() => params().has('geometric'));
  const [big, setBig] = useState(() => params().has('big'));
  const [density, setDensity] = useState(() => {
    const raw = Number.parseFloat(params().get('density') ?? '');
    return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
  });
  const [viewportWidth] = useViewport();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'r') setSeed(randomSeed());
      if (key === 'e') setElegant((v) => !v);
      if (key === 'g') setGeometric((v) => !v);
      if (key === 'b') setBig((v) => !v);
      if (key === 's') setSheet((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', String(seed));
    for (const [name, on] of [
      ['sheet', sheet],
      ['elegant', elegant],
      ['geometric', geometric],
      ['big', big],
    ] as const) {
      if (on) url.searchParams.set(name, '');
      else url.searchParams.delete(name);
    }
    if (big && density > 0) url.searchParams.set('density', density.toFixed(2));
    else url.searchParams.delete('density');
    window.history.replaceState(null, '', url);
  }, [seed, sheet, elegant, geometric, big, density]);

  const fitted = fit(sheet ? 0.24 : 0.82, sheet ? 260 : 700);
  const width = big && !sheet ? Math.round(viewportWidth! * 0.7) : Math.round(fitted * ASPECT);
  const height = big && !sheet ? Math.round(width / 2) : fitted;
  const shared = {
    inks: INKS,
    accents: ACCENTS,
    elegance: elegant ? 1 : 0.5,
    geometric: geometric ? 1 : 0.15,
    ground: 'white' as const,
  };

  const toggle = (label: string, on: boolean, flip: () => void) => (
    <button
      type="button"
      {...stylex.props(styles.button, on && styles.buttonOn)}
      onClick={(event) => {
        event.stopPropagation();
        flip();
      }}
    >
      {label}
    </button>
  );

  const controls = (
    <div {...stylex.props(styles.corner)} onClick={(event) => event.stopPropagation()}>
      <div {...stylex.props(styles.panel)}>
        <div {...stylex.props(styles.row)}>
          {toggle('New', false, () => setSeed(randomSeed()))}
          {toggle('Elegant', elegant, () => setElegant((v) => !v))}
          {toggle('Geometric', geometric, () => setGeometric((v) => !v))}
          {toggle('Big', big, () => setBig((v) => !v))}
          {toggle('Sheet', sheet, () => setSheet((v) => !v))}
        </div>
        {big && !sheet ? (
          <label {...stylex.props(styles.slider)}>
            Density
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={density}
              onChange={(event) => setDensity(Number.parseFloat(event.target.value))}
              {...stylex.props(styles.range)}
            />
            {Math.round(density * 100)}%
          </label>
        ) : null}
      </div>
    </div>
  );

  if (sheet) {
    const seeds = Array.from({ length: 12 }, (_, i) => (seed + i * 2654435761) >>> 0);
    return (
      <main {...stylex.props(styles.page)} onClick={() => setSeed(randomSeed())}>
        <div {...stylex.props(styles.sheet)}>
          {seeds.map((s) => (
            <GenerativePiece key={s} seed={s} width={width} height={height} {...shared} />
          ))}
        </div>
        {controls}
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
          stacks={big ? BASE_STACKS : 1}
          density={big ? density : 0}
          {...shared}
        />
        <p {...stylex.props(styles.meta)}>{seed}</p>
      </div>
      {controls}
    </main>
  );
};

export default SketchPage;
