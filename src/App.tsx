import * as stylex from '@stylexjs/stylex';
import {
  CodeBrackets,
  Dna,
  GraduationCap,
  Download,
  Palette as PaletteIcon,
  Settings,
  Type,
} from 'iconoir-react';
import {
  type CSSProperties,
  Fragment,
  lazy,
  Suspense,
  useEffect,
  useState,
} from 'react';

import {
  GradientCanvas,
  type GradientScene,
  type Palette,
} from './GradientCanvas';
import { GenerativePiece } from './GenerativePiece';
import { randomSeed, renderPiece } from './generative/piece';
import { type IconComponent, Stethoscope } from './icons';
import { PALETTES } from './palettes';
import { savePng } from './savePng';

const SketchPage = lazy(() => import('./SketchPage'));

/**
 * Paper grain for the card, as one tiling image rather than a pseudo-element, so the card is a
 * single painted box. `#` has to be escaped, or the data URI ends at the filter reference.
 */
const PAPER_GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='140' height='140' filter='url(%23g)' opacity='0.19'/></svg>\")";

const HOME_DEFAULT_INKS: [string, string] = ['#46286c', '#9d82c8'];
const HOME_DEFAULT_ACCENTS = ['#e8735a', '#f2a97e', '#6e93d6', '#c94f8c'];
const FIELD_PIECE_PALETTES = PALETTES.map((palette) => ({
  inks: [palette.ink, palette.colors[0] ?? palette.ink] as [string, string],
  accents: palette.colors.slice(1),
}));

/**
 * Two candidates for the display face, still undecided. The F key swaps between them at
 * runtime; once one is picked, set DEFAULT_DISPLAY_FONT to it and delete the list.
 */
const DISPLAY_FONTS = [
  {
    name: 'Outfit',
    stack: "'Outfit Variable', Outfit, 'Geist Variable', sans-serif",
    size: 'clamp(27px, 4.4vw, 32px)',
    tracking: '-0.032em',
  },
  {
    // Readex Pro is the wider face, so it is set smaller and tighter to wrap like Outfit.
    name: 'Readex Pro',
    stack: "'Readex Pro Variable', 'Readex Pro', 'Geist Variable', sans-serif",
    size: 'clamp(25px, 4.1vw, 30px)',
    tracking: '-0.042em',
  },
];
const DEFAULT_DISPLAY_FONT = 0;

type Post = {
  id: string;
  place: string;
  role: string;
  period: string;
  Icon: IconComponent;
  /** Index into the palette's colours, and how far the ink is mixed toward it. */
  accent: number;
  tint: number;
};

const CURRENT: Post = {
  id: 'cwru',
  accent: 5,
  tint: 0.24,
  place: 'Case Western Reserve',
  role: 'Medical School',
  period: '2025 —',
  Icon: Stethoscope,
};

const PREVIOUS: Post[] = [
  {
    id: 'msk',
    accent: 4,
    tint: 0.3,
    place: 'Memorial Sloan Kettering',
    role: 'Bioinformatics Software Engineer',
    period: '2022 — 2025',
    Icon: Dna,
  },
  {
    id: 'bloomberg',
    accent: 3,
    tint: 0.28,
    place: 'Bloomberg',
    role: 'Software Engineer',
    period: '2018 — 2022',
    Icon: CodeBrackets,
  },
  {
    id: 'stanford',
    accent: 2,
    tint: 0.22,
    place: 'Stanford',
    role: 'MS in Artificial Intelligence',
    period: '2018',
    Icon: GraduationCap,
  },
];

const popIn = stylex.keyframes({
  from: {
    opacity: 0,
    filter: 'blur(5px)',
    transform:
      'translateX(-50%) translateY(8px) rotateX(-34deg) rotate(var(--card-tilt-from, 2.5deg)) scale(0.9)',
  },
  '50%': { opacity: 1 },
  to: {
    opacity: 1,
    filter: 'blur(0px)',
    transform:
      'translateX(-50%) translateY(0) rotateX(0deg) rotate(var(--card-tilt, -1.2deg)) scale(1)',
  },
});

const fadeIn = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const styles = stylex.create({
  shell: {
    minHeight: '100svh',
    position: 'relative',
    overflow: 'hidden',
    isolation: 'isolate',
    backgroundColor: '#f3ecf3',
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
  stage: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    display: 'grid',
    placeItems: 'center',
    paddingTop: 'max(32px, env(safe-area-inset-top))',
    paddingRight: 'max(24px, env(safe-area-inset-right))',
    paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
    paddingLeft: 'max(24px, env(safe-area-inset-left))',
    transition: 'color 600ms ease',
  },
  masthead: {
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@media (min-width: 861px)': 'row-reverse',
    },
    alignItems: 'center',
    justifyContent: {
      default: 'space-evenly',
      '@media (min-width: 861px)': 'center',
    },
    height: {
      default: '100%',
      '@media (min-width: 861px)': 'auto',
    },
    gap: {
      default: '1.5rem',
      '@media (min-width: 861px)': 'clamp(2rem, 4vw, 3.5rem)',
    },
    width: '100%',
    maxWidth: '64rem',
  },
  intro: {
    marginBottom: {
      default: 0,
      '@media (min-width: 861px)': 8,
    },
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '1.35rem',
    textAlign: 'left',
    width: '100%',
    minWidth: 0,
    maxWidth: 'min(36rem, 100%)',
  },
  title: {
    margin: 0,
    fontWeight: 500,
    lineHeight: 1.1,
  },
  bio: {
    margin: 0,
    fontWeight: 400,
    lineHeight: 1.35,
    opacity: 0.88,
    textWrap: 'pretty',
  },
  post: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.22em',
    whiteSpace: 'nowrap',
    transition: 'color 600ms ease',
  },
  iconButton: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: 'currentColor',
    font: 'inherit',
    lineHeight: 0,
    perspective: '800px',
    cursor: 'pointer',
    opacity: {
      default: 0.95,
      ':hover': 1,
      ':focus-visible': 1,
    },
    transform: {
      default: 'translateY(0)',
      ':hover': 'translateY(-1px)',
    },
    transition:
      'opacity 200ms ease, transform 200ms cubic-bezier(0.23, 1, 0.32, 1)',
    outlineOffset: '4px',
  },
  icon: {
    width: '0.86em',
    height: '0.86em',
    display: 'block',
  },
  popup: {
    position: 'absolute',
    left: '50%',
    bottom: 'calc(100% + 0.5em)',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '1px',
    paddingTop: '6px',
    paddingRight: '11px',
    paddingBottom: '7px',
    paddingLeft: '11px',
    borderRadius: '10px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgb(64 46 86 / 0.08)',
    backgroundColor: '#fdfbf7',
    backgroundImage: PAPER_GRAIN,
    backgroundSize: '120px 120px',
    boxShadow:
      '0 1px 1px rgb(52 36 74 / 0.08), 0 6px 14px -6px rgb(52 36 74 / 0.26), 0 16px 34px -18px rgb(52 36 74 / 0.30)',
    fontFamily: "'Geist Variable', Geist, sans-serif",
    fontSize: '14px',
    fontWeight: 400,
    letterSpacing: '-0.01em',
    lineHeight: 1.35,
    textAlign: 'left',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    transformOrigin: 'bottom center',
    animationName: {
      default: popIn,
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    animationDuration: '360ms',
    animationTimingFunction: 'cubic-bezier(0.16, 1.2, 0.3, 1)',
    animationFillMode: 'both',
  },
  popupRole: {
    opacity: 0.95,
  },
  popupPeriod: {
    fontSize: '12px',
    opacity: 0.5,
    fontVariantNumeric: 'tabular-nums',
  },
  hidden: {
    opacity: 0,
  },
  enter: {
    opacity: {
      default: 0,
      '@media (prefers-reduced-motion: reduce)': 1,
    },
    animationName: {
      default: fadeIn,
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    animationDuration: '900ms',
    animationTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
    animationFillMode: 'both',
  },
  enterField: {
    opacity: {
      default: 0,
      '@media (prefers-reduced-motion: reduce)': 1,
    },
    animationName: {
      default: fadeIn,
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    animationDuration: '1400ms',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },
  delayTitle: { animationDelay: '220ms' },
  delayBody: { animationDelay: '400ms' },
  visuallyHidden: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: 0,
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
  },
  piece: {
    position: 'relative',
    flexShrink: 0,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  control: {
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
  playButton: {
    position: 'absolute',
    left: '2px',
    bottom: '2px',
  },
  controlDelayed: {
    transition:
      'opacity 180ms cubic-bezier(0.23, 1, 0.32, 1) 260ms, transform 180ms cubic-bezier(0.23, 1, 0.32, 1), background-color 180ms ease',
  },
  controlVisible: {
    opacity: 1,
    pointerEvents: 'auto',
    transform: 'translateY(0)',
  },
  paletteButton: {
    left: '36px',
  },
  exportButton: {
    left: '70px',
  },
  paletteButtonOn: {
    borderColor: 'rgb(255 255 255 / 0.5)',
    backgroundColor: 'rgb(255 255 255 / 0.3)',
  },
  corner: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingTop: '30px',
    paddingRight: '36px',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    paddingLeft: 'max(16px, env(safe-area-inset-left))',
    transition: 'color 600ms ease',
  },
  cornerIcon: {
    width: '14px',
    height: '14px',
    display: 'block',
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
  cursorRadius: 170,
};

const PIECE_EXPORT_SCALE = 3;

const PIECE_WIDTH = 420;
const PIECE_ASPECT = 300 / 420;

const measurePieceWidth = () =>
  Math.round(Math.min(PIECE_WIDTH, window.innerWidth - 48));

const useDisplayFont = () => {
  const [index, setIndex] = useState(DEFAULT_DISPLAY_FONT);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'f' || event.key === 'F') {
        setIndex((i) => (i + 1) % DISPLAY_FONTS.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const next = () => setIndex((i) => (i + 1) % DISPLAY_FONTS.length);
  return [DISPLAY_FONTS[index]!, next] as const;
};

/** Never wait longer than this for a font; a blank page is worse than a swapped one. */
const REVEAL_TIMEOUT = 1200;

/**
 * Holds the first paint until the display face is resident, which is what removes the flash of
 * fallback text. `document.fonts.ready` alone can settle before the face is ever requested, so
 * the two weights actually used are loaded by name first.
 */
const useIsRevealed = (fontStack: string) => {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const family = fontStack.split(',')[0]!.trim();
    const reveal = () => {
      if (!cancelled) setIsRevealed(true);
    };
    Promise.race([
      Promise.all([
        document.fonts.load(`500 32px ${family}`),
        document.fonts.load(`400 32px ${family}`),
      ]),
      new Promise((resolve) => window.setTimeout(resolve, REVEAL_TIMEOUT)),
    ]).then(reveal, reveal);
    return () => {
      cancelled = true;
    };
  }, [fontStack]);

  return isRevealed;
};

/** Keeps the drawing inside the viewport on narrow screens, at its own aspect ratio. */
const usePieceSize = () => {
  const [width, setWidth] = useState(measurePieceWidth);

  useEffect(() => {
    const onResize = () => setWidth(measurePieceWidth());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return { width, height: Math.round(width * PIECE_ASPECT) };
};

const usePaletteIndex = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ']') setIndex((i) => (i + 1) % PALETTES.length);
      if (event.key === '[')
        setIndex((i) => (i - 1 + PALETTES.length) % PALETTES.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const next = () => setIndex((i) => (i + 1) % PALETTES.length);
  return [index, next] as const;
};

/** Degrees either side of square the card can come to rest at. */
const CARD_TILT = 2.2;
/** How much further round it starts, so it always rotates the same way into place. */
const CARD_SWING = 3.5;

const randomTilt = () => (Math.random() * 2 - 1) * CARD_TILT;

type PostMarkProps = {
  post: Post;
  palette: Palette;
  /** Comma or full stop, kept inside the span so it never wraps onto the next line alone. */
  trailing: string;
  isOpen: boolean;
  onOpenChange: (id: string | null) => void;
};

/** A place name with its icon; the icon opens a card carrying the role and the years. */
const PostMark = ({
  post,
  palette,
  trailing,
  isOpen,
  onOpenChange,
}: PostMarkProps) => {
  const { Icon } = post;
  const [tilt, setTilt] = useState(-1.2);
  const accent = palette.colors[post.accent] ?? palette.ink;
  const mix = (amount: number) =>
    `color-mix(in oklab, ${palette.ink} ${Math.round((1 - amount) * 100)}%, ${accent})`;
  const tinted = mix(post.tint);
  const open = () => {
    setTilt(randomTilt());
    onOpenChange(post.id);
  };
  const cardStyle = {
    color: palette.ink,
    '--card-tilt': `${tilt.toFixed(2)}deg`,
    '--card-tilt-from': `${(tilt + CARD_SWING).toFixed(2)}deg`,
  } as CSSProperties;
  const iconTinted = mix(Math.min(post.tint * 2.1, 0.62));

  return (
    <span {...stylex.props(styles.post)} style={{ color: tinted }}>
      <button
        type="button"
        aria-label={`${post.role}, ${post.place}, ${post.period}`}
        {...stylex.props(styles.iconButton)}
        onPointerEnter={open}
        onPointerLeave={() => onOpenChange(null)}
        onFocus={open}
        onBlur={() => onOpenChange(null)}
      >
        <Icon
          aria-hidden="true"
          {...stylex.props(styles.icon)}
          style={{ color: iconTinted }}
        />
        {isOpen && (
          <span
            aria-hidden="true"
            {...stylex.props(styles.popup)}
            style={cardStyle}
          >
            <span {...stylex.props(styles.popupRole)}>{post.role}</span>
            <span {...stylex.props(styles.popupPeriod)}>{post.period}</span>
          </span>
        )}
      </button>
      {post.place}
      {trailing}
    </span>
  );
};

const App = () => {
  const [paletteIndex, nextPalette] = usePaletteIndex();
  const palette = PALETTES[paletteIndex]!;
  const [displayFont, nextDisplayFont] = useDisplayFont();
  const displayType = {
    fontFamily: displayFont.stack,
    fontSize: displayFont.size,
    letterSpacing: displayFont.tracking,
  };
  const [pieceSeed, setPieceSeed] = useState(randomSeed);
  const [isPieceHovered, setIsPieceHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [useFieldPalette, setUseFieldPalette] = useState(false);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [isCornerHovered, setIsCornerHovered] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const pieceSize = usePieceSize();
  const isRevealed = useIsRevealed(displayFont.stack);

  const piecePalette =
    FIELD_PIECE_PALETTES[pieceSeed % FIELD_PIECE_PALETTES.length]!;
  const pieceInks = useFieldPalette ? piecePalette.inks : HOME_DEFAULT_INKS;
  const pieceAccents = useFieldPalette
    ? piecePalette.accents
    : HOME_DEFAULT_ACCENTS;

  useEffect(() => {
    if (!isPlaying) return;

    const intervalId = window.setInterval(
      () => setPieceSeed(randomSeed()),
      740,
    );
    return () => window.clearInterval(intervalId);
  }, [isPlaying]);

  const renderAndSave = async () => {
    const out = document.createElement('canvas');
    renderPiece(out, {
      seed: pieceSeed,
      width: pieceSize.width * PIECE_EXPORT_SCALE,
      height: pieceSize.height * PIECE_EXPORT_SCALE,
      dpr: PIECE_EXPORT_SCALE,
      inks: pieceInks,
      accents: pieceAccents,
      accentChance: useFieldPalette ? 0.72 : 0.3,
      colorFlow: useFieldPalette,
      elegance: 0.6,
      ground: 'transparent',
    });
    await savePng(out, `alyvas-${pieceSeed}@${PIECE_EXPORT_SCALE}x.png`);
  };

  const exportPiece = async () => {
    if (isExporting) return;
    setIsExporting(true);
    await renderAndSave();
    setIsExporting(false);
  };

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

  return (
    <main {...stylex.props(styles.shell)}>
      <div
        {...stylex.props(
          styles.shaderLayer,
          isRevealed ? styles.enterField : styles.hidden,
        )}
      >
        <GradientCanvas scene={HOME_SCENE} palette={palette} />
      </div>
      <section {...stylex.props(styles.stage)} style={{ color: palette.ink }}>
        <div {...stylex.props(styles.masthead)}>
          <div {...stylex.props(styles.intro)}>
            <h1
              {...stylex.props(
                styles.title,
                isRevealed ? styles.enter : styles.hidden,
                styles.delayTitle,
              )}
              style={displayType}
            >
              alyvas
            </h1>
            <p
              {...stylex.props(
                styles.bio,
                isRevealed ? styles.enter : styles.hidden,
                styles.delayBody,
              )}
              style={displayType}
            >
              Currently{' '}
              <PostMark
                post={CURRENT}
                palette={palette}
                trailing="."
                isOpen={openPostId === CURRENT.id}
                onOpenChange={setOpenPostId}
              />{' '}
              Previously{' '}
              {PREVIOUS.map((post, i) => (
                <Fragment key={post.id}>
                  <PostMark
                    post={post}
                    palette={palette}
                    trailing={i < PREVIOUS.length - 1 ? ',' : '.'}
                    isOpen={openPostId === post.id}
                    onOpenChange={setOpenPostId}
                  />
                  {i < PREVIOUS.length - 1 ? ' ' : ''}
                </Fragment>
              ))}
            </p>
          </div>
          <div
            {...stylex.props(
              styles.piece,
              isRevealed ? styles.enter : styles.hidden,
              styles.delayBody,
            )}
            onClick={() => setPieceSeed(randomSeed())}
            onPointerEnter={() => setIsPieceHovered(true)}
            onPointerLeave={() => setIsPieceHovered(false)}
          >
            <GenerativePiece
              seed={pieceSeed}
              width={pieceSize.width}
              height={pieceSize.height}
              inks={pieceInks}
              accents={pieceAccents}
              accentChance={useFieldPalette ? 0.72 : 0.3}
              colorFlow={useFieldPalette}
              elegance={0.6}
              ground="transparent"
              label="A generated drawing, different on every visit"
            />
            <button
              type="button"
              aria-label={
                isPlaying
                  ? 'Pause automatic generations'
                  : 'Play automatic generations'
              }
              aria-pressed={isPlaying}
              title={isPlaying ? 'Pause generations' : 'Play generations'}
              {...stylex.props(
                styles.control,
                styles.playButton,
                isPieceHovered && styles.controlVisible,
                isPieceHovered && styles.controlDelayed,
              )}
              onClick={(event) => {
                event.stopPropagation();
                togglePiecePlayback();
              }}
            >
              <svg
                viewBox="0 0 12 12"
                aria-hidden="true"
                {...stylex.props(styles.playIcon)}
              >
                {isPlaying ? (
                  <path d="M3 2.25h2v7.5H3zM7 2.25h2v7.5H7z" />
                ) : (
                  <path d="M3 2.1v7.8L9.5 6 3 2.1z" />
                )}
              </svg>
            </button>
            <button
              type="button"
              aria-label="Use the alternate colour palette"
              aria-pressed={useFieldPalette}
              title={
                useFieldPalette
                  ? 'Turn off alternate colours'
                  : 'Use alternate colours'
              }
              {...stylex.props(
                styles.control,
                styles.playButton,
                styles.paletteButton,
                isPieceHovered && styles.controlVisible,
                isPieceHovered && styles.controlDelayed,
                useFieldPalette && styles.paletteButtonOn,
              )}
              onClick={(event) => {
                event.stopPropagation();
                setUseFieldPalette((enabled) => !enabled);
              }}
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                {...stylex.props(styles.paletteIcon)}
              >
                <path d="M8 1.75a5.25 5.25 0 0 0 0 10.5h.7a1.1 1.1 0 0 0 .45-2.1.9.9 0 0 1 .4-1.72H11A2.75 2.75 0 0 0 13.25 6C13.25 3.65 10.9 1.75 8 1.75Z" />
                <circle cx="5.15" cy="5.35" r=".55" />
                <circle cx="7.7" cy="4.2" r=".55" />
                <circle cx="10.1" cy="5.35" r=".55" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Download this drawing as a PNG"
              title="Download PNG"
              disabled={isExporting}
              {...stylex.props(
                styles.control,
                styles.playButton,
                styles.exportButton,
                isPieceHovered && styles.controlVisible,
                isPieceHovered && styles.controlDelayed,
              )}
              onClick={(event) => {
                event.stopPropagation();
                exportPiece();
              }}
            >
              <Download
                aria-hidden="true"
                {...stylex.props(styles.paletteIcon)}
              />
            </button>
          </div>
        </div>
      </section>
      <div
        role="group"
        aria-label="Page controls"
        {...stylex.props(styles.corner)}
        style={{ color: palette.ink }}
        onPointerEnter={() => setIsCornerHovered(true)}
        onPointerLeave={() => setIsCornerHovered(false)}
        onFocus={() => setIsCornerHovered(true)}
        onBlur={() => setIsCornerHovered(false)}
      >
        <button
          type="button"
          aria-label={`Next colour palette, currently ${palette.name}`}
          title="Next palette"
          {...stylex.props(
            styles.control,
            isRevealed && isCornerHovered && styles.controlVisible,
          )}
          onClick={nextPalette}
        >
          <PaletteIcon
            aria-hidden="true"
            {...stylex.props(styles.cornerIcon)}
          />
        </button>
        <button
          type="button"
          aria-label={`Next display typeface, currently ${displayFont.name}`}
          title="Next typeface"
          {...stylex.props(
            styles.control,
            isRevealed && isCornerHovered && styles.controlVisible,
          )}
          onClick={nextDisplayFont}
        >
          <Type aria-hidden="true" {...stylex.props(styles.cornerIcon)} />
        </button>
        <a
          href="/sketch"
          aria-label="Open the sketch page"
          title="Sketches"
          {...stylex.props(
            styles.control,
            isRevealed && isCornerHovered && styles.controlVisible,
          )}
        >
          <Settings aria-hidden="true" {...stylex.props(styles.cornerIcon)} />
        </a>
      </div>
    </main>
  );
};

export default App;
