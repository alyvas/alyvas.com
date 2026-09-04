# Project notes

## Shape of the app

- This is an intentionally minimal Vite + React + TypeScript app.
- Use `pnpm` for dependency management and scripts.
- The visual is a single full-viewport study rendered by `GradientCanvas.tsx` in one WebGL2 context, two passes: a quarter-res colour-field framebuffer (each colour is a feathered, anisotropic mask carved from domain-warped value noise and laid over the paper colour, in the spirit of Ana Montiel's FIELDS), then a full-res post pass that lifts toward a paper wash, stacks three translucent Bayer halftone layers driven by smooth density fields, lays static photographic grain on top, and applies a cursor lens (pixels and dots slide away from the pointer; a smaller macOS-style arrow drawn as an SVG CSS cursor replaces the system one on fine pointers). Each halftone layer breathes on its own slow cycle. Tunables live in the `HOME_SCENE` constant in `App.tsx`; colour sets live in `palettes.ts` and are switched at runtime with `[` and `]` (uniform updates only, no GL rebuild).
- Reduced-motion handling now lives inside `GradientCanvas`, which pauses the render loop and re-renders a single static frame when `prefers-reduced-motion: reduce` matches.
- StyleX is configured through `@stylexjs/unplugin` in `vite.config.ts`; keep the plugin before the React plugin.

## Tooling

- `pnpm dev` starts Vite.
- `pnpm build` runs TypeScript’s project build and the production Vite build.
- `pnpm lint` runs Oxlint.
- `pnpm format` writes Oxfmt changes.
- `pnpm format:check` verifies formatting without changing files.
- TanStack tooling is intentionally not part of this project.

## Generative sketch

- `/sketch` now shows a single still generative piece; see `docs/generative.md` for the full design (intent, determinism, pipeline, and review method).
- p5 is no longer used anywhere in this project.
- Keep new variations in the warm paper palette in spirit, but the piece itself renders in one or two dark inks on white.

## Visual decisions

- The palette should stay mostly white, cream, and soft purple. Keep any future additions quiet enough that the dither remains a texture instead of visual noise.
- The shader is decorative, so content stays in normal HTML for accessibility and mobile layout.
- Preserve `100svh`, safe-area padding, and the reduced-motion fallback when changing the layout.
