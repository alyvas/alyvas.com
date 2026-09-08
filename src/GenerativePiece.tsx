import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef } from 'react';

import { renderPiece, type PieceOptions } from './generative/piece';

const styles = stylex.create({
  canvas: {
    display: 'block',
    imageRendering: 'pixelated',
  },
});

type Props = {
  seed: number;
  /** Size in CSS pixels. */
  width: number;
  height: number;
  inks: PieceOptions['inks'];
  accents?: string[];
  accentChance?: number;
  elegance?: number;
  geometric?: number;
  stacks?: number;
  density?: number;
  colorFlow?: boolean;
  ground: PieceOptions['ground'];
  label?: string;
};

/** Draws one still iteration of the generative piece into a canvas. */
export const GenerativePiece = ({
  seed,
  width,
  height,
  inks,
  accents,
  accentChance,
  elegance,
  geometric,
  stacks,
  density,
  colorFlow,
  ground,
  label,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderPiece(canvas, {
      seed,
      width: width * dpr,
      height: height * dpr,
      dpr,
      scale: dpr,
      inks,
      accents,
      accentChance,
      elegance,
      geometric,
      stacks,
      density,
      colorFlow,
      ground,
    });
  }, [
    seed,
    width,
    height,
    inks,
    accents,
    accentChance,
    elegance,
    geometric,
    stacks,
    density,
    colorFlow,
    ground,
  ]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label ?? 'A generated line drawing'}
      {...stylex.props(styles.canvas)}
      style={{ width, height }}
    />
  );
};
