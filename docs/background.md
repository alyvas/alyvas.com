# The background

`src/GradientCanvas.tsx` renders the homepage background in one WebGL2 context, in two passes.

1. **Colour field**, at quarter resolution. Each colour is a feathered, anisotropic mask cut
   from domain-warped value noise and laid over the paper colour. Masks are blended by weight
   rather than painted over one another, so overlapping colours mix and the paper keeps a share
   everywhere.
2. **Post**, at full resolution. It lifts the field toward a paper wash, stacks three
   translucent Bayer halftone layers driven by smooth density fields, lays photographic grain on
   top, and applies a cursor lens: pixels and dots slide away from the pointer with a small
   rotation. On fine pointers a smaller macOS-style arrow, drawn as an SVG CSS cursor, replaces
   the system one.

Each halftone layer fades on its own cycle, and one shared low-frequency displacement field
moves the halftone cells and the grain along with the colour field, so the print is not locked
to a fixed grid.

## Where the knobs are

- Tunables live in the `HOME_SCENE` constant in `src/App.tsx`.
- Colour sets live in `src/palettes.ts` and are switched at runtime with `[` and `]`. Switching
  writes uniforms only; it never rebuilds GL state.
- Colours are painted in array order, so accents come last. There are no near-whites in a
  palette: the paper colour supplies the light tones.

## Reduced motion

Handled inside `GradientCanvas`. When `prefers-reduced-motion: reduce` matches, the render loop
is paused and single frames are rendered on demand, so the cursor lens still responds while the
colour field stays still.
