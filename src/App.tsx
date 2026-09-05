import * as stylex from '@stylexjs/stylex';
import { lazy, Suspense, useEffect, useState } from 'react';

import { GradientCanvas, type GradientScene } from './GradientCanvas';
import { GenerativePiece } from './GenerativePiece';
import { randomSeed } from './generative/piece';
import { PALETTES } from './palettes';

const SketchPage = lazy(() => import('./SketchPage'));
const Sketch2Page = lazy(() => import('./Sketch2Page'));

const HOME_DEFAULT_INKS: [string, string] = ['#46286c', '#9d82c8'];
const HOME_DEFAULT_ACCENTS = ['#e8735a', '#f2a97e', '#6e93d6', '#c94f8c'];
const MONTIEL_PIECE_PALETTES = PALETTES.map((palette) => ({
  inks: [palette.ink, palette.colors[0] ?? palette.ink] as [string, string],
  accents: palette.colors.slice(1),
}));

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
    position: 'relative',
    marginTop: '0.5rem',
    marginLeft: '-12px',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  playButton: {
    position: 'absolute',
    left: '8px',
    bottom: '8px',
    width: '28px',
    height: '28px',
    display: 'grid',
    placeItems: 'center',
    padding: 0,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgb(255 255 255 / 0.32)',
    borderRadius: '999px',
    backgroundColor: 'rgb(255 255 255 / 0.16)',
    color: 'currentColor',
    cursor: 'pointer',
    opacity: 0,
    pointerEvents: 'none',
    transform: 'translateY(2px)',
    transition:
      'opacity 180ms cubic-bezier(0.23, 1, 0.32, 1), transform 180ms cubic-bezier(0.23, 1, 0.32, 1), background-color 180ms ease',
    ':focus-visible': {
      opacity: 1,
      pointerEvents: 'auto',
      outline: '2px solid currentColor',
      outlineOffset: '3px',
    },
    ':hover': {
      backgroundColor: 'rgb(255 255 255 / 0.28)',
    },
    ':active': {
      transform: 'translateY(0) scale(0.96)',
    },
  },
  playButtonVisible: {
    opacity: 1,
    pointerEvents: 'auto',
    transform: 'translateY(0)',
  },
  paletteButton: {
    left: '42px',
  },
  paletteButtonOn: {
    borderColor: 'rgb(255 255 255 / 0.5)',
    backgroundColor: 'rgb(255 255 255 / 0.3)',
  },
  playIcon: {
    width: '11px',
    height: '11px',
    display: 'block',
    fill: 'currentColor',
  },
  paletteIcon: {
    width: '12px',
    height: '12px',
    display: 'block',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.25,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
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
  const [isPieceHovered, setIsPieceHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [useMontielPalette, setUseMontielPalette] = useState(false);

  const piecePalette = MONTIEL_PIECE_PALETTES[pieceSeed % MONTIEL_PIECE_PALETTES.length]!;
  const pieceInks = useMontielPalette ? piecePalette.inks : HOME_DEFAULT_INKS;
  const pieceAccents = useMontielPalette ? piecePalette.accents : HOME_DEFAULT_ACCENTS;

  useEffect(() => {
    if (!isPlaying) return;

    const intervalId = window.setInterval(() => setPieceSeed(randomSeed()), 740);
    return () => window.clearInterval(intervalId);
  }, [isPlaying]);

  const togglePiecePlayback = () => {
    if (!isPlaying) setPieceSeed(randomSeed());
    setIsPlaying((playing) => !playing);
  };

  if (window.location.pathname === '/sketch') {
    return (
      <Suspense fallback={<div />}>
        <SketchPage />
      </Suspense>
    );
  }
  if (window.location.pathname === '/sketch2') {
    return (
      <Suspense fallback={<div />}>
        <Sketch2Page />
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
        <div
          {...stylex.props(styles.piece)}
          onClick={() => setPieceSeed(randomSeed())}
          onPointerEnter={() => setIsPieceHovered(true)}
          onPointerLeave={() => setIsPieceHovered(false)}
        >
          <GenerativePiece
            seed={pieceSeed}
            width={480}
            height={300}
            inks={pieceInks}
            accents={pieceAccents}
            accentChance={useMontielPalette ? 0.72 : 0.3}
            colorFlow={useMontielPalette}
            elegance={0.6}
            ground="transparent"
            label="A generated drawing, different on every visit"
          />
          <button
            type="button"
            aria-label={isPlaying ? 'Pause automatic generations' : 'Play automatic generations'}
            aria-pressed={isPlaying}
            title={isPlaying ? 'Pause generations' : 'Play generations'}
            {...stylex.props(styles.playButton, isPieceHovered && styles.playButtonVisible)}
            onClick={(event) => {
              event.stopPropagation();
              togglePiecePlayback();
            }}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true" {...stylex.props(styles.playIcon)}>
              {isPlaying ? (
                <path d="M3 2.25h2v7.5H3zM7 2.25h2v7.5H7z" />
              ) : (
                <path d="M3 2.1v7.8L9.5 6 3 2.1z" />
              )}
            </svg>
          </button>
          <button
            type="button"
            aria-label="Use Montiel color palette"
            aria-pressed={useMontielPalette}
            title={useMontielPalette ? 'Turn off Montiel colors' : 'Use Montiel colors'}
            {...stylex.props(
              styles.playButton,
              styles.paletteButton,
              isPieceHovered && styles.playButtonVisible,
              useMontielPalette && styles.paletteButtonOn
            )}
            onClick={(event) => {
              event.stopPropagation();
              setUseMontielPalette((enabled) => !enabled);
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" {...stylex.props(styles.paletteIcon)}>
              <path d="M8 1.75a5.25 5.25 0 0 0 0 10.5h.7a1.1 1.1 0 0 0 .45-2.1.9.9 0 0 1 .4-1.72H11A2.75 2.75 0 0 0 13.25 6C13.25 3.65 10.9 1.75 8 1.75Z" />
              <circle cx="5.15" cy="5.35" r=".55" />
              <circle cx="7.7" cy="4.2" r=".55" />
              <circle cx="10.1" cy="5.35" r=".55" />
            </svg>
          </button>
        </div>
      </section>
    </main>
  );
};

export default App;
