import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef } from 'react';

import { createProgram } from './gl/program';
import {
  GRADIENT_FRAGMENT_SHADER,
  MAX_COLORS,
  POST_FRAGMENT_SHADER,
  VERTEX_SHADER,
} from './gl/shaders';

export type Palette = {
  name: string;
  colors: string[];
  paper: string;
  ink: string;
};

export type GradientScene = {
  speed: number;
  distortion: number;
  coverage: number;
  washAmount: number;
  grainAmount: number;
  grainSeed: number;
  grainScale: number;
  ditherLevels: number;
  ditherMix: number;
  ditherSize: number;
  gradientScale: number;
  maxPixelRatio: number;
  cursorRadius: number;
};

const styles = stylex.create({
  canvas: {
    display: 'block',
    width: '100%',
    height: '100%',
  },
});

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  return [r, g, b];
};

export const GradientCanvas = ({ scene, palette }: { scene: GradientScene; palette: Palette }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paletteRef = useRef(palette);
  const applyPaletteRef = useRef<((palette: Palette) => void) | null>(null);

  useEffect(() => {
    paletteRef.current = palette;
    applyPaletteRef.current?.(palette);
  }, [palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let stop: (() => void) | null = null;

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      stop?.();
      stop = null;
    };

    const handleContextRestored = () => {
      stop = start();
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    function start(): (() => void) | null {
      const gl = canvas?.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        powerPreference: 'low-power',
      });
      if (!gl || !canvas) return null;

      const gradientProgram = createProgram(gl, VERTEX_SHADER, GRADIENT_FRAGMENT_SHADER);
      const postProgram = createProgram(gl, VERTEX_SHADER, POST_FRAGMENT_SHADER);
      if (!gradientProgram || !postProgram) return null;

      // Bound so calling it doesn't read as a React hook call to the linter.
      const activateProgram = gl.useProgram.bind(gl);

      const vao = gl.createVertexArray();
      const buffer = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      const gradientTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, gradientTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        gradientTexture,
        0
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // Static uniforms: gradient program.
      activateProgram(gradientProgram);
      gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_distortion'), scene.distortion);
      gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_coverage'), scene.coverage);
      // A fresh seed per load shifts every colour field.
      gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_seed'), Math.random() * 100);
      const gradientColorsLocation = gl.getUniformLocation(gradientProgram, 'u_colors');
      const gradientColorCountLocation = gl.getUniformLocation(gradientProgram, 'u_colorCount');
      const gradientPaperLocation = gl.getUniformLocation(gradientProgram, 'u_paper');
      const gradientResolutionLocation = gl.getUniformLocation(gradientProgram, 'u_resolution');
      const gradientTimeLocation = gl.getUniformLocation(gradientProgram, 'u_time');

      // Static uniforms: post program.
      activateProgram(postProgram);
      gl.uniform1i(gl.getUniformLocation(postProgram, 'u_gradient'), 0);
      const postWashLocation = gl.getUniformLocation(postProgram, 'u_wash');
      gl.uniform1f(gl.getUniformLocation(postProgram, 'u_washAmount'), scene.washAmount);
      gl.uniform1f(gl.getUniformLocation(postProgram, 'u_grainAmount'), scene.grainAmount);
      gl.uniform1f(gl.getUniformLocation(postProgram, 'u_ditherLevels'), scene.ditherLevels);
      gl.uniform1f(gl.getUniformLocation(postProgram, 'u_ditherMix'), scene.ditherMix);
      gl.uniform1f(gl.getUniformLocation(postProgram, 'u_grainSeed'), scene.grainSeed);
      const postDitherPixelLocation = gl.getUniformLocation(postProgram, 'u_ditherPixel');
      const postResolutionLocation = gl.getUniformLocation(postProgram, 'u_resolution');
      const postTimeLocation = gl.getUniformLocation(postProgram, 'u_time');
      const postGrainScaleLocation = gl.getUniformLocation(postProgram, 'u_grainScale');
      const postCursorLocation = gl.getUniformLocation(postProgram, 'u_cursor');
      const postCursorRadiusLocation = gl.getUniformLocation(postProgram, 'u_cursorRadius');
      const postCursorStrengthLocation = gl.getUniformLocation(postProgram, 'u_cursorStrength');

      // Palette lives in uniforms only, so switching it never rebuilds GL state.
      const applyPalette = (next: Palette) => {
        activateProgram(gradientProgram);
        const colorsArray = new Float32Array(MAX_COLORS * 3);
        next.colors.slice(0, MAX_COLORS).forEach((hex, i) => {
          const [r, g, b] = hexToRgb(hex);
          colorsArray[i * 3] = r;
          colorsArray[i * 3 + 1] = g;
          colorsArray[i * 3 + 2] = b;
        });
        gl.uniform3fv(gradientColorsLocation, colorsArray);
        gl.uniform1i(gradientColorCountLocation, Math.min(next.colors.length, MAX_COLORS));
        const [pr, pg, pb] = hexToRgb(next.paper);
        gl.uniform3f(gradientPaperLocation, pr, pg, pb);
        activateProgram(postProgram);
        gl.uniform3f(postWashLocation, pr, pg, pb);
      };
      applyPalette(paletteRef.current);
      applyPaletteRef.current = applyPalette;

      let width = 0;
      let height = 0;
      let dpr = 1;

      // Pointer state in device pixels, y up to match gl_FragCoord. Smoothed every frame.
      const cursor = { x: -1e4, y: -1e4 };
      const cursorTarget = { x: -1e4, y: -1e4 };
      let cursorStrength = 0;
      let cursorTargetStrength = 0;
      let gradientWidth = 0;
      let gradientHeight = 0;

      const resize = (): boolean => {
        if (!canvas) return false;
        dpr = Math.min(window.devicePixelRatio || 1, scene.maxPixelRatio);
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (w === width && h === height) return false;

        width = w;
        height = h;
        canvas.width = w;
        canvas.height = h;

        // Dither cells and grain are sized in CSS pixels so they read the same on 1x and 2x screens.
        activateProgram(postProgram);
        gl.uniform1f(postDitherPixelLocation, Math.max(1, Math.round(dpr * scene.ditherSize)));
        gl.uniform1f(postGrainScaleLocation, dpr * scene.grainScale);
        gl.uniform2f(postResolutionLocation, w, h);
        gl.uniform1f(postCursorRadiusLocation, scene.cursorRadius * dpr);

        gradientWidth = Math.max(1, Math.round(w * scene.gradientScale));
        gradientHeight = Math.max(1, Math.round(h * scene.gradientScale));

        gl.bindTexture(gl.TEXTURE_2D, gradientTexture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gradientWidth,
          gradientHeight,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null
        );

        return true;
      };

      const renderFrame = (time: number, dt: number) => {
        // Frame-rate independent exponential easing.
        const ease = 1 - Math.exp(-dt * 14);
        cursor.x += (cursorTarget.x - cursor.x) * ease;
        cursor.y += (cursorTarget.y - cursor.y) * ease;
        cursorStrength += (cursorTargetStrength - cursorStrength) * (1 - Math.exp(-dt * 6));

        gl.bindVertexArray(vao);

        // Pass A: gradient into the low-res framebuffer.
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, gradientWidth, gradientHeight);
        activateProgram(gradientProgram);
        gl.uniform2f(gradientResolutionLocation, gradientWidth, gradientHeight);
        gl.uniform1f(gradientTimeLocation, time);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // Pass B: fullscreen post at native resolution.
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);
        activateProgram(postProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, gradientTexture);
        gl.uniform1f(postTimeLocation, time);
        gl.uniform2f(postCursorLocation, cursor.x, cursor.y);
        gl.uniform1f(postCursorStrengthLocation, cursorStrength);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        gl.bindVertexArray(null);
      };

      // A random start time makes the drift phases differ per load.
      let time = Math.random() * 600;
      let last = performance.now();
      let rafId = 0;

      const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

      const tick = (now: number) => {
        const dt = Math.min(now - last, 100) / 1000;
        last = now;
        time += dt * scene.speed;
        renderFrame(time, dt);
        rafId = requestAnimationFrame(tick);
      };

      const startLoop = () => {
        last = performance.now();
        rafId = requestAnimationFrame(tick);
      };

      const stopLoop = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
      };

      // With reduced motion the gradient clock is frozen, but the cursor lens still needs
      // frames while the pointer moves; render single frames on demand instead of looping.
      let stillFrame = 0;
      const renderStill = () => {
        if (stillFrame) return;
        stillFrame = requestAnimationFrame(() => {
          stillFrame = 0;
          renderFrame(time, 1 / 60);
          const settled =
            Math.abs(cursor.x - cursorTarget.x) < 0.5 &&
            Math.abs(cursor.y - cursorTarget.y) < 0.5 &&
            Math.abs(cursorStrength - cursorTargetStrength) < 0.01;
          if (!settled) renderStill();
        });
      };

      const handleReducedMotionChange = () => {
        if (reducedMotionQuery.matches) {
          stopLoop();
          renderStill();
        } else {
          startLoop();
        }
      };

      const handlePointerMove = (event: PointerEvent) => {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        cursorTarget.x = (event.clientX - rect.left) * dpr;
        cursorTarget.y = (rect.height - (event.clientY - rect.top)) * dpr;
        cursorTargetStrength = event.pointerType === 'mouse' ? 1 : 0;
        if (reducedMotionQuery.matches) renderStill();
      };

      const handlePointerLeave = () => {
        cursorTargetStrength = 0;
        if (reducedMotionQuery.matches) renderStill();
      };

      const resizeObserver = new ResizeObserver(() => {
        if (resize() && reducedMotionQuery.matches) {
          renderStill();
        }
      });
      resizeObserver.observe(canvas);
      resize();

      reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', handlePointerLeave);
      window.addEventListener('blur', handlePointerLeave);

      if (reducedMotionQuery.matches) {
        renderStill();
      } else {
        startLoop();
      }

      return () => {
        applyPaletteRef.current = null;
        stopLoop();
        if (stillFrame) cancelAnimationFrame(stillFrame);
        resizeObserver.disconnect();
        reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
        window.removeEventListener('pointermove', handlePointerMove);
        document.documentElement.removeEventListener('pointerleave', handlePointerLeave);
        window.removeEventListener('blur', handlePointerLeave);
        gl.deleteProgram(gradientProgram);
        gl.deleteProgram(postProgram);
        gl.deleteVertexArray(vao);
        gl.deleteBuffer(buffer);
        gl.deleteTexture(gradientTexture);
        gl.deleteFramebuffer(framebuffer);
      };
    }

    stop = start();

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      stop?.();
      stop = null;
    };
  }, [scene]);

  return <canvas ref={canvasRef} aria-hidden="true" {...stylex.props(styles.canvas)} />;
};
