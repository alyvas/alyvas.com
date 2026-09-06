import * as stylex from '@stylexjs/stylex';
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { type PieceOptions, randomSeed, renderPiece } from './generative/piece';
import { type PlateStructure, renderPlate } from './generative/plate';
import { savePng } from './savePng';

// Deep ink and lighter wash.
const INKS: [string, string] = ['#46286c', '#9d82c8'];
const ACCENTS = ['#e8735a', '#f2a97e', '#6e93d6', '#c94f8c', '#e6b35a'];

const PIECE_ASPECT = 1.6;
const PLATE_ASPECT = 4 / 5;
const BASE_STACKS = 22;
const SHEET_COUNT = 12;
const SHEET_COLUMNS = 3;
const SHEET_GAP = 12;
/** Width reserved for the toolbar so the artwork is never drawn under it. */
const TOOLBAR_CLEARANCE = 300;
const TOOLBAR_CLEARANCE_MIN_WIDTH = 900;

const MODES = [
  { id: 'piece', label: 'Piece', hint: 'One still vine' },
  {
    id: 'plate',
    label: 'Plate',
    hint: 'The vine, reworked as a printed plate',
  },
  { id: 'photo', label: 'Photo', hint: 'Your own image, treated as a plate' },
] as const;
type Mode = (typeof MODES)[number]['id'];

const STRUCTURES = ['auto', 'rules', 'sparse', 'rows', 'boxes', 'masonry', 'minigrid'] as const;
type StructureChoice = (typeof STRUCTURES)[number];

const EXPORT_SCALES = [1, 2, 3];

const PIECE_FLAGS = ['elegant', 'geometric', 'big', 'sheet'] as const;
type PieceFlag = (typeof PIECE_FLAGS)[number];

const PIECE_FLAG_KEYS: Record<string, PieceFlag> = {
  e: 'elegant',
  g: 'geometric',
  b: 'big',
  s: 'sheet',
};

// Old sketch paths map onto the modes that replaced them.
const LEGACY_PATH_MODES: Record<string, Mode> = {
  '/sketch2': 'plate',
  '/sketch3': 'photo',
};

const styles = stylex.create({
  page: {
    minHeight: '100svh',
    display: 'grid',
    placeItems: 'center',
    padding:
      'max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))',
    fontFamily: "'Geist Variable', Geist, sans-serif",
    fontSize: '14px',
    userSelect: 'none',
    transition: 'background-color 300ms ease, color 300ms ease',
  },
  pageLight: {
    backgroundColor: '#ffffff',
    color: '#2a2233',
  },
  pageDark: {
    backgroundColor: '#1a1a1c',
    color: '#d9d4cc',
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    cursor: 'pointer',
  },
  canvas: {
    display: 'block',
    maxWidth: '100%',
  },
  canvasDark: {
    boxShadow: '0 30px 80px rgb(0 0 0 / 0.5)',
  },
  sheet: {
    display: 'grid',
    gridTemplateColumns: `repeat(${SHEET_COLUMNS}, 1fr)`,
    gap: `${SHEET_GAP}px`,
    cursor: 'pointer',
  },
  meta: {
    margin: 0,
    opacity: 0.55,
    fontVariantNumeric: 'tabular-nums',
  },
  drop: {
    width: 'min(70vw, 560px)',
    aspectRatio: '4 / 5',
    display: 'grid',
    placeItems: 'center',
    textAlign: 'center',
    padding: '32px',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'rgb(217 212 204 / 0.35)',
    borderRadius: '12px',
    cursor: 'pointer',
    lineHeight: 1.6,
    transition: 'border-color 150ms ease, background-color 150ms ease',
  },
  dropActive: {
    borderColor: '#d9d4cc',
    backgroundColor: 'rgb(217 212 204 / 0.06)',
  },
  hiddenInput: {
    display: 'none',
  },

  toolbar: {
    position: 'fixed',
    top: 'max(16px, env(safe-area-inset-top))',
    right: 'max(16px, env(safe-area-inset-right))',
    zIndex: 10,
    width: '236px',
    maxHeight: 'calc(100svh - 32px)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '14px',
    borderRadius: '14px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgb(42 34 51 / 0.1)',
    backgroundColor: 'rgb(255 255 255 / 0.92)',
    backdropFilter: 'blur(14px) saturate(1.3)',
    boxShadow: '0 12px 40px rgb(20 14 28 / 0.22)',
    color: '#2a2233',
    cursor: 'default',
    fontSize: '13px',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  groupLabel: {
    margin: 0,
    fontSize: '11px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    opacity: 0.45,
  },
  row: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  button: {
    appearance: 'none',
    flex: '1 1 auto',
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
    fontSize: '13px',
    padding: '5px 10px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background-color 140ms ease, border-color 140ms ease, color 140ms ease',
  },
  buttonOn: {
    backgroundColor: '#2a2233',
    borderColor: '#2a2233',
    color: '#ffffff',
  },
  buttonWide: {
    flex: '1 1 100%',
  },
  buttonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  slider: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontVariantNumeric: 'tabular-nums',
  },
  range: {
    flex: 1,
    minWidth: 0,
    accentColor: '#2a2233',
  },
  seedRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '8px',
    fontVariantNumeric: 'tabular-nums',
  },
  seedValue: {
    opacity: 0.55,
    fontSize: '12px',
  },
  note: {
    margin: 0,
    fontSize: '11px',
    lineHeight: 1.45,
    opacity: 0.5,
  },
});

const params = () => new URLSearchParams(window.location.search);

const readSeedParam = () => {
  const raw = params().get('seed');
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed >>> 0 : randomSeed();
};

const readModeParam = (): Mode => {
  const legacy = LEGACY_PATH_MODES[window.location.pathname];
  if (legacy) return legacy;
  const raw = params().get('mode');
  return MODES.find((m) => m.id === raw)?.id ?? 'piece';
};

const readPieceFlags = () => {
  const search = params();
  return new Set(PIECE_FLAGS.filter((flag) => search.has(flag)));
};

const readStructureParam = (): StructureChoice => {
  const raw = params().get('structure');
  return STRUCTURES.find((s) => s === raw) ?? 'auto';
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const readNumberParam = (name: string, fallback: number) => {
  const raw = Number.parseFloat(params().get(name) ?? '');
  return Number.isFinite(raw) ? clamp01(raw) : fallback;
};

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });

/** The pixel font has to be resident before a plate can draw with it. */
const readyFonts = () => document.fonts.load(`12px 'Geist Pixel Variable'`);

const useViewport = () => {
  const [size, setSize] = useState(() => [window.innerWidth, window.innerHeight]);
  useEffect(() => {
    const update = () => setSize([window.innerWidth, window.innerHeight]);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return size as [number, number];
};

/**
 * Every study on one page, with a toolbar for the mode, the seed, that mode's settings and a
 * PNG export. Click the artwork or press R for a new seed; E, G, B and S pick the piece
 * settings (hold shift to combine them); 1, 2 and 3 switch modes.
 */
const SketchPage = () => {
  const [mode, setMode] = useState<Mode>(readModeParam);
  const [seed, setSeed] = useState(readSeedParam);
  const [exportScale, setExportScale] = useState(2);
  const [isExporting, setIsExporting] = useState(false);

  const [pieceFlags, setPieceFlags] = useState<Set<PieceFlag>>(readPieceFlags);
  const [density, setDensity] = useState(() => readNumberParam('density', 0));

  const [structure, setStructure] = useState<StructureChoice>(readStructureParam);
  const [intensity, setIntensity] = useState(() => readNumberParam('intensity', 0.6));
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [viewportWidth, viewportHeight] = useViewport();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isElegant = pieceFlags.has('elegant');
  const isGeometric = pieceFlags.has('geometric');
  const isBig = pieceFlags.has('big');
  const isSheet = pieceFlags.has('sheet');

  /** Plain click keeps one setting on its own; shift-click adds to or removes from the set. */
  const togglePieceFlag = useCallback((flag: PieceFlag, additive: boolean) => {
    setPieceFlags((current) => {
      if (additive) {
        const next = new Set(current);
        if (!next.delete(flag)) next.add(flag);
        return next;
      }
      if (current.size === 1 && current.has(flag)) return new Set();
      return new Set([flag]);
    });
  }, []);

  const isPiece = mode === 'piece';
  const isPhoto = mode === 'photo';
  const needsImage = isPhoto && !image;
  const showsSheet = isPiece && isSheet;

  // --- geometry ------------------------------------------------------------------------

  const aspect = isPiece
    ? PIECE_ASPECT
    : isPhoto && image
      ? image.naturalWidth / image.naturalHeight
      : PLATE_ASPECT;

  const usableWidth =
    viewportWidth - (viewportWidth >= TOOLBAR_CLEARANCE_MIN_WIDTH ? TOOLBAR_CLEARANCE : 48);

  let width: number;
  let height: number;
  if (showsSheet) {
    const rows = Math.ceil(SHEET_COUNT / SHEET_COLUMNS);
    const cell = Math.max(
      80,
      Math.min(
        260,
        Math.floor((viewportHeight - 96 - (rows - 1) * SHEET_GAP) / rows),
        Math.floor((usableWidth - (SHEET_COLUMNS - 1) * SHEET_GAP) / SHEET_COLUMNS / PIECE_ASPECT)
      )
    );
    width = Math.round(cell * PIECE_ASPECT);
    height = cell;
  } else if (isPiece && isBig) {
    width = Math.round(Math.min(viewportWidth * 0.7, usableWidth));
    height = Math.round(width / 2);
  } else if (isPiece) {
    const fitted = Math.min(
      700,
      Math.floor(Math.min(usableWidth / PIECE_ASPECT, viewportHeight * 0.82))
    );
    width = Math.round(fitted * PIECE_ASPECT);
    height = fitted;
  } else {
    height = Math.floor(Math.min(viewportHeight * 0.86, usableWidth / aspect));
    width = Math.floor(height * aspect);
  }

  // --- drawing -------------------------------------------------------------------------

  const pieceOptions = useCallback(
    (): Omit<PieceOptions, 'seed' | 'width' | 'height' | 'dpr'> => ({
      inks: INKS,
      accents: ACCENTS,
      elegance: isElegant ? 1 : 0.5,
      geometric: isGeometric ? 1 : 0.15,
      stacks: isBig ? BASE_STACKS : 1,
      density: isBig ? density : 0,
      ground: 'white',
    }),
    [isElegant, isGeometric, isBig, density]
  );

  /** Draws one frame of the current mode into any canvas, at any pixel ratio. */
  const draw = useCallback(
    (canvas: HTMLCanvasElement, frameSeed: number, w: number, h: number, dpr: number) => {
      if (isPiece) {
        renderPiece(canvas, {
          seed: frameSeed,
          width: w * dpr,
          height: h * dpr,
          dpr,
          ...pieceOptions(),
        });
        return;
      }
      renderPlate(canvas, {
        seed: frameSeed,
        width: w * dpr,
        height: h * dpr,
        dpr,
        structure: structure === 'auto' ? undefined : (structure as PlateStructure),
        source: isPhoto && image ? image : undefined,
        intensity: isPhoto ? intensity : undefined,
      });
    },
    [isPiece, isPhoto, image, intensity, structure, pieceOptions]
  );

  const sheetRows = Math.ceil(SHEET_COUNT / SHEET_COLUMNS);
  const sheetPixels = {
    width: SHEET_COLUMNS * width * exportScale + (SHEET_COLUMNS - 1) * SHEET_GAP * exportScale,
    height: sheetRows * height * exportScale + (sheetRows - 1) * SHEET_GAP * exportScale,
  };

  const sheetSeeds = Array.from({ length: SHEET_COUNT }, (_, i) => (seed + i * 2654435761) >>> 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || showsSheet || needsImage) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (isPiece) {
      draw(canvas, seed, width, height, dpr);
      return;
    }
    let cancelled = false;
    readyFonts().then(() => {
      if (!cancelled) draw(canvas, seed, width, height, dpr);
    });
    return () => {
      cancelled = true;
    };
  }, [draw, seed, width, height, isPiece, showsSheet, needsImage]);

  // --- input ---------------------------------------------------------------------------

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'r') setSeed(randomSeed());
      const flag = PIECE_FLAG_KEYS[key];
      if (flag) togglePieceFlag(flag, event.shiftKey);
      const modeIndex = Number.parseInt(key, 10) - 1;
      const picked = MODES[modeIndex];
      if (picked) setMode(picked.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePieceFlag]);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(true);
    };
    const onDragLeave = () => setIsDragging(false);
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer?.files[0];
      if (file?.type.startsWith('image/')) {
        loadImage(file).then((loaded) => {
          setImage(loaded);
          setMode('photo');
        });
      }
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  // The URL carries everything, so a link reproduces exactly what is on screen.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.pathname = '/sketch';
    url.searchParams.set('mode', mode);
    url.searchParams.set('seed', String(seed));
    for (const flag of PIECE_FLAGS) {
      if (isPiece && pieceFlags.has(flag)) url.searchParams.set(flag, '');
      else url.searchParams.delete(flag);
    }
    if (isPiece && isBig && density > 0) url.searchParams.set('density', density.toFixed(2));
    else url.searchParams.delete('density');
    if (!isPiece && structure !== 'auto') url.searchParams.set('structure', structure);
    else url.searchParams.delete('structure');
    if (isPhoto) url.searchParams.set('intensity', intensity.toFixed(2));
    else url.searchParams.delete('intensity');
    window.history.replaceState(null, '', url);
  }, [mode, seed, isPiece, isPhoto, isBig, pieceFlags, density, structure, intensity]);

  // --- export --------------------------------------------------------------------------

  /** Re-renders the current view at the chosen scale into an offscreen canvas and saves it. */
  const renderAndSave = async () => {
    if (!isPiece) await readyFonts();
    const out = document.createElement('canvas');
    if (showsSheet) {
      const cellW = width * exportScale;
      const cellH = height * exportScale;
      const gap = SHEET_GAP * exportScale;
      out.width = sheetPixels.width;
      out.height = sheetPixels.height;
      const ctx = out.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out.width, out.height);
        const cell = document.createElement('canvas');
        sheetSeeds.forEach((cellSeed, i) => {
          draw(cell, cellSeed, width, height, exportScale);
          const column = i % SHEET_COLUMNS;
          const row = Math.floor(i / SHEET_COLUMNS);
          ctx.drawImage(cell, column * (cellW + gap), row * (cellH + gap));
        });
      }
    } else {
      draw(out, seed, width, height, exportScale);
    }
    await savePng(out, `alyvas-${mode}${showsSheet ? '-sheet' : ''}-${seed}@${exportScale}x.png`);
  };

  const exportPng = async () => {
    if (needsImage || isExporting) return;
    setIsExporting(true);
    await renderAndSave();
    setIsExporting(false);
  };

  const newSeed = () => setSeed(randomSeed());

  // --- toolbar -------------------------------------------------------------------------

  const button = (
    label: string,
    on: boolean,
    onPress: (event: ReactMouseEvent<HTMLButtonElement>) => void,
    extra?: { wide?: boolean; disabled?: boolean; title?: string }
  ) => (
    <button
      key={label}
      type="button"
      title={extra?.title}
      aria-pressed={on}
      disabled={extra?.disabled}
      {...stylex.props(
        styles.button,
        on && styles.buttonOn,
        extra?.wide && styles.buttonWide,
        extra?.disabled && styles.buttonDisabled
      )}
      onClick={(event) => {
        event.stopPropagation();
        onPress(event);
      }}
    >
      {label}
    </button>
  );

  const slider = (label: string, value: number, onChange: (next: number) => void, step = 0.05) => (
    <label {...stylex.props(styles.slider)}>
      {label}
      <input
        type="range"
        min={0}
        max={1}
        step={step}
        value={value}
        onChange={(event) => onChange(Number.parseFloat(event.target.value))}
        {...stylex.props(styles.range)}
      />
      {Math.round(value * 100)}%
    </label>
  );

  const toolbar = (
    <div
      {...stylex.props(styles.toolbar)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div {...stylex.props(styles.group)}>
        <p {...stylex.props(styles.groupLabel)}>Sketch</p>
        <div {...stylex.props(styles.row)}>
          {MODES.map((m) =>
            button(m.label, mode === m.id, () => setMode(m.id), {
              title: m.hint,
            })
          )}
        </div>
      </div>

      <div {...stylex.props(styles.group)}>
        <div {...stylex.props(styles.seedRow)}>
          <p {...stylex.props(styles.groupLabel)}>Seed</p>
          <span {...stylex.props(styles.seedValue)}>{seed}</span>
        </div>
        {button('New seed', false, () => setSeed(randomSeed()), { wide: true })}
      </div>

      {isPiece ? (
        <div {...stylex.props(styles.group)}>
          <p {...stylex.props(styles.groupLabel)}>Piece</p>
          <div {...stylex.props(styles.row)}>
            {button('Elegant', isElegant, (event) => togglePieceFlag('elegant', event.shiftKey))}
            {button('Geometric', isGeometric, (event) =>
              togglePieceFlag('geometric', event.shiftKey)
            )}
          </div>
          <div {...stylex.props(styles.row)}>
            {button('Big', isBig, (event) => togglePieceFlag('big', event.shiftKey))}
            {button('Sheet', isSheet, (event) => togglePieceFlag('sheet', event.shiftKey))}
          </div>
          <p {...stylex.props(styles.note)}>Shift-click to combine settings.</p>
          {isBig && !isSheet ? slider('Density', density, setDensity) : null}
        </div>
      ) : (
        <div {...stylex.props(styles.group)}>
          <p {...stylex.props(styles.groupLabel)}>Structure</p>
          <div {...stylex.props(styles.row)}>
            {STRUCTURES.map((s) => button(s, structure === s, () => setStructure(s)))}
          </div>
          {isPhoto ? slider('Intensity', intensity, setIntensity) : null}
          {/* Written out rather than built through `button`, so the ref stays inside onClick. */}
          {isPhoto ? (
            <button
              type="button"
              {...stylex.props(styles.button, styles.buttonWide)}
              onClick={(event) => {
                event.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              {image ? 'Replace image' : 'Choose image'}
            </button>
          ) : null}
        </div>
      )}

      <div {...stylex.props(styles.group)}>
        <p {...stylex.props(styles.groupLabel)}>Export</p>
        <div {...stylex.props(styles.row)}>
          {EXPORT_SCALES.map((scale) =>
            button(`${scale}x`, exportScale === scale, () => setExportScale(scale))
          )}
        </div>
        {button(isExporting ? 'Rendering…' : 'Export PNG', false, exportPng, {
          wide: true,
          disabled: isExporting || needsImage,
        })}
        <p {...stylex.props(styles.note)}>
          {needsImage
            ? 'Drop an image first.'
            : showsSheet
              ? `${sheetPixels.width} × ${sheetPixels.height} px, twelve up`
              : `${Math.round(width * exportScale)} × ${Math.round(height * exportScale)} px`}
        </p>
      </div>
    </div>
  );

  // --- page ----------------------------------------------------------------------------

  return (
    <main {...stylex.props(styles.page, isPiece ? styles.pageLight : styles.pageDark)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        aria-label="Choose an image"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) loadImage(file).then(setImage);
          event.target.value = '';
        }}
        {...stylex.props(styles.hiddenInput)}
      />

      {needsImage ? (
        <div
          {...stylex.props(styles.drop, isDragging && styles.dropActive)}
          onClick={() => fileInputRef.current?.click()}
        >
          <p>Drop an image here, or click to choose one.</p>
        </div>
      ) : showsSheet ? (
        <div {...stylex.props(styles.sheet)} onClick={newSeed}>
          {sheetSeeds.map((cellSeed) => (
            <SheetCell key={cellSeed} seed={cellSeed} width={width} height={height} draw={draw} />
          ))}
        </div>
      ) : (
        <div {...stylex.props(styles.stack)} onClick={newSeed}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={MODES.find((m) => m.id === mode)!.hint}
            {...stylex.props(styles.canvas, !isPiece && styles.canvasDark)}
            style={{ width, height }}
          />
          <p {...stylex.props(styles.meta)}>{seed} · click for another</p>
        </div>
      )}

      {toolbar}
    </main>
  );
};

type SheetCellProps = {
  seed: number;
  width: number;
  height: number;
  draw: (canvas: HTMLCanvasElement, seed: number, w: number, h: number, dpr: number) => void;
};

/** One cell of the contact sheet, drawn through the same path as the single view. */
const SheetCell = ({ seed, width, height, draw }: SheetCellProps) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    draw(canvas, seed, width, height, Math.min(window.devicePixelRatio || 1, 2));
  }, [draw, seed, width, height]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={`Seed ${seed}`}
      {...stylex.props(styles.canvas)}
      style={{ width, height }}
    />
  );
};

export default SketchPage;
