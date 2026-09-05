import * as stylex from '@stylexjs/stylex';
import { lazy, Suspense, useEffect, useState } from 'react';

import { GradientCanvas, type GradientScene } from './GradientCanvas';
import { GenerativePiece } from './GenerativePiece';
import { randomSeed } from './generative/piece';
import { PALETTES } from './palettes';

const SketchPage = lazy(() => import('./SketchPage'));

const styles = stylex.create({
  shell: {
    minHeight: '100svh',
    position: 'relative',
    overflow: 'hidden',
    isolation: 'isolate',
    backgroundColor: '#f3ecf3',
    // A macOS-style arrow, drawn a little smaller than the system one.
    cursor: {
      default: 'auto',
      '@media (pointer: fine)': `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24'><path d='M5.5 3.2v17.6c0 .45.54.67.85.35l4.86-4.86h6.86c.45 0 .67-.54.35-.85L6.35 2.85c-.32-.32-.85-.1-.85.35z' fill='%232b2233' stroke='%23ffffff' stroke-width='1.6' stroke-linejoin='round'/></svg>") 5 3, auto`,
    },
  },
  shaderLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
  },
  copy: {
    position: 'absolute',
    zIndex: 1,
    left: {
      default: 'max(24px, env(safe-area-inset-left))',
      '@media (min-width: 641px)': 'max(clamp(104px, 10vw, 180px), env(safe-area-inset-left))',
    },
    right: 'max(24px, env(safe-area-inset-right))',
    top: {
      default: '28vh',
      '@media (max-width: 640px)': 'auto',
    },
    bottom: {
      default: 'auto',
      '@media (max-width: 640px)': 'max(32px, env(safe-area-inset-bottom))',
    },
    maxWidth: '36rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    transition: 'color 600ms ease',
  },
  title: {
    margin: 0,
    fontFamily: "'Geist Variable', Geist, sans-serif",
    fontSize: '24px',
    fontWeight: 500,
    letterSpacing: '-0.01em',
    lineHeight: 1.3,
  },
  lede: {
    margin: 0,
    fontFamily: "'Geist Variable', Geist, sans-serif",
    fontSize: '24px',
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: '-0.02em',
    opacity: 0.8,
    textWrap: 'pretty',
  },
  piece: {
    marginTop: '0.5rem',
    marginLeft: '-12px',
    maxWidth: '100%',
    overflow: 'hidden',
  },
});

const HOME_SCENE: GradientScene = {
  speed: 1.8,
  distortion: 0.45,
  coverage: -0.14,
  washAmount: 0.08,
  grainAmount: 0.05,
  grainSeed: 3,
  grainScale: 3,
  ditherLevels: 6,
  ditherMix: 0.42,
  ditherSize: 2,
  gradientScale: 0.25,
  maxPixelRatio: 2,
  cursorRadius: 140,
};

// Bracket keys cycle palettes; a study control, not a UI.
const usePaletteIndex = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ']') setIndex((i) => (i + 1) % PALETTES.length);
      if (event.key === '[') setIndex((i) => (i - 1 + PALETTES.length) % PALETTES.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return index;
};

const App = () => {
  const palette = PALETTES[usePaletteIndex()]!;
  const [pieceSeed, setPieceSeed] = useState(randomSeed);

  if (window.location.pathname === '/sketch') {
    return (
      <Suspense fallback={<div />}>
        <SketchPage />
      </Suspense>
    );
  }

  return (
    <main {...stylex.props(styles.shell)}>
      <div {...stylex.props(styles.shaderLayer)}>
        <GradientCanvas scene={HOME_SCENE} palette={palette} />
      </div>
      <section {...stylex.props(styles.copy)} style={{ color: palette.ink }}>
        <h1 {...stylex.props(styles.title)}>alyvas</h1>
        <p {...stylex.props(styles.lede)}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua.
        </p>
        <div {...stylex.props(styles.piece)} onClick={() => setPieceSeed(randomSeed())}>
          <GenerativePiece
            seed={pieceSeed}
            width={480}
            height={300}
            inks={['#3a2260', '#8a6fb8']}
            accents={['#d4679b', '#e88f6a']}
            accentChance={0.3}
            ground="transparent"
            label="A generated drawing, different on every visit"
          />
        </div>
      </section>
    </main>
  );
};

export default App;
