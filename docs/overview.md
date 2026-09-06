# Overview

A small personal site: one homepage and one sketch page, both built around the same generative
drawing code.

It is an intentionally minimal Vite + React + TypeScript app with no router, no state library
and no data layer. `src/App.tsx` checks `window.location.pathname` against a short list and
lazily renders the sketch page; everything else is the homepage.

## Routes

| Path                   | What it is                                                            |
| ---------------------- | --------------------------------------------------------------------- |
| `/`                    | The homepage — see [homepage.md](homepage.md)                         |
| `/sketch`              | The sketch page — see [sketch.md](sketch.md)                          |
| `/sketch2`, `/sketch3` | Old paths; they rewrite themselves to `/sketch` plate and photo modes |

## Files

| File                         | What it does                                               |
| ---------------------------- | ---------------------------------------------------------- |
| `src/App.tsx`                | Homepage layout, path check, homepage keyboard controls    |
| `src/SketchPage.tsx`         | The sketch page and its toolbar                            |
| `src/GradientCanvas.tsx`     | The WebGL2 background — see [background.md](background.md) |
| `src/gl/`                    | Shader sources and program compilation                     |
| `src/GenerativePiece.tsx`    | React wrapper around the piece renderer                    |
| `src/generative/piece.ts`    | The piece algorithm — see [generative.md](generative.md)   |
| `src/generative/plate.ts`    | Plate and photo treatments — see [plate.md](plate.md)      |
| `src/generative/segments.ts` | Model-free object segmentation for photo mode              |
| `src/palettes.ts`            | The colour sets used by the background and the piece       |
| `src/icons.tsx`              | Icons drawn here rather than taken from Iconoir            |

## Visual constraints

- The colour sets started from Ana Montiel's FIELDS as a reference
- The palette stays mostly white, cream and soft purple. Anything added should be quiet enough
  that the dither still reads as a texture rather than as noise.
- The shader is decorative, so all content stays in normal HTML for accessibility and mobile
  layout.
- Preserve `100svh`, safe-area padding, and the reduced-motion fallback when changing layout.
