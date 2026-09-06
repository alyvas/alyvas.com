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
    userSelect: 'none',
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
  stack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    cursor: 'pointer',
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
  input: {
    display: 'none',
  },
});

const readSeedParam = () => {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed >>> 0 : randomSeed();
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

/**
 * /sketch3: drop an image and it is treated like a plate: sectioned, cut out, sorted, split,
 * dithered, annotated and grained, at reduced intensity. Click or press R for a new seed,
 * drop another image any time.
 */
const Sketch3Page = () => {
  const [seed, setSeed] = useState(readSeedParam);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState(() => [window.innerWidth, window.innerHeight]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onResize = () => setSize([window.innerWidth, window.innerHeight]);
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') setSeed(randomSeed());
    };
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      setDragging(true);
    };
    const onDragLeave = () => setDragging(false);
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer?.files[0];
      if (file && file.type.startsWith('image/')) loadImage(file).then(setImage);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', String(seed));
    window.history.replaceState(null, '', url);
  }, [seed]);

  const aspect = image ? image.naturalWidth / image.naturalHeight : 4 / 5;
  const height = Math.floor(Math.min(size[1]! * 0.86, (size[0]! * 0.9) / aspect));
  const width = Math.floor(height * aspect);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cancelled = false;
    document.fonts.load(`12px 'Geist Pixel Variable'`).then(() => {
      if (cancelled) return;
      renderPlate(canvas, { seed, width: width * dpr, height: height * dpr, dpr, source: image });
    });
    return () => {
      cancelled = true;
    };
  }, [seed, width, height, image]);

  const pickFile = () => inputRef.current?.click();
  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) loadImage(file).then(setImage);
    event.target.value = '';
  };

  return (
    <main {...stylex.props(styles.page)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label="Choose an image"
        onChange={onFile}
        {...stylex.props(styles.input)}
      />
      {image ? (
        <div {...stylex.props(styles.stack)} onClick={() => setSeed(randomSeed())}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Your image, treated as a plate"
            {...stylex.props(styles.canvas)}
            style={{ width, height }}
          />
          <p {...stylex.props(styles.meta)}>
            {seed} · click for another take · drop a new image any time
          </p>
        </div>
      ) : (
        <div {...stylex.props(styles.drop, dragging && styles.dropActive)} onClick={pickFile}>
          <p>
            Drop an image here, or click to choose one.
            <br />
            It will be sectioned, cut out, sorted, dithered and annotated.
          </p>
        </div>
      )}
    </main>
  );
};

export default Sketch3Page;
