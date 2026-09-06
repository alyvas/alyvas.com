# The generative piece

`src/generative/piece.ts` renders a still image assembled from fragments of three algorithms.
No fragment is ever drawn as a complete, recognisable shape: not a full Maurer rose, not a full
Penrose tile set, not a full Lissajous curve. Each algorithm contributes cut, faded pieces that
are seamed and layered against each other.

- **Maurer rose** — chords between points on the polar curve r = sin(nθ), sampled at θ = k·d
  degrees for a fixed step d. Ordinarily this produces a single closed rose; only fragments of
  the chord sequence are kept.
- **Penrose P3 rhombus tiling** — generated with de Bruijn's pentagrid construction: five
  families of parallel lines set at 72° increments. Every point where lines from two different
  families intersect yields one rhombus. Only some of the rhombi are drawn, and never as a
  complete tiled field.
- **Lissajous curves** — x = sin(a·t + δ), y = sin(b·t), traced in short broken arcs rather
  than the full periodic curve.

What matters is not any one algorithm's geometry but how the fragments are cut, faded at their
ends, seamed so they appear to overlap, layered, and finally dithered into one or two colours of
ink on a white or transparent ground.

## Determinism

A 32-bit integer seed drives a mulberry32 pseudo-random number generator. Every piece of
geometry — centres, radii, rotations, counts, cut points — is expressed as a fraction of the
canvas's short side, so the same seed produces the same image at any output size. Nothing is
hard-coded in pixels.

The homepage draws a fresh seed on every page load. `/sketch` in piece mode draws a new seed
when the canvas is clicked or R is pressed.

## Pipeline

The image is built as a vine, so every seed shares one skeleton while the parts differ.

1. **Stem.** A spine grows from near one edge across the long axis. Its heading drifts with
   seeded sum-of-sines noise and bends back toward its target direction, so the path curves
   instead of walking randomly. It is drawn as a brush ribbon: filled quads between left and
   right offsets whose width swells and thins along the path and tapers at both ends.
2. **Nodes.** Four to eight nodes along the stem sprout parts, alternating sides, shrinking
   toward the tip:
   - a _leaf_ is a rooted fan of six to twenty-two Maurer chords drawn as a thick-and-thin
     ribbon, with the fan washed in by a radial gradient from the node;
   - a _blossom_ is a patch of Penrose rhombi masked by a soft disc and cut by a straight seam,
     with tiles filling in a gradient from the centre and a few tiles inked solid;
   - a _tendril_ is a rooted Lissajous arc as a thin-to-thick ribbon;
   - a _flourish_ is a log spiral drawn as a thin-thick-thin stroke, simplified, with a trail of
     shrinking dots continuing its direction;
   - _dots_ alone are a short trail of shrinking dots leaving the node.

   Up to two side branches grow from nodes and carry a smaller leaf or blossom at the tip. Roses
   sometimes draw only part of their outline, and the loose end runs a thin line to another
   node, which keeps shapes from looking too regular.

   A `geometric` option (0 to 1, default 0.15) makes the stem angular. Each piece picks a snap
   of either 90° or 36°, and angular nodes often grow L-system twigs: F[+F][-F]F at the snap
   angle, thinner each generation, with a small bloom or dots at the ends. It also turns pools
   into polygons, rose petals into low-count polygons, bloom petals into rhombi, and tendrils
   into sparse zigzags. At the default it appears in a few drawings; at 1 about half of any
   piece is angular, because the effective value is capped at 0.5 so no drawing comes out
   entirely angular. On `/sketch`, `?geometric` or the G key sets it to 1.

   An `elegance` option (0 to 1, default 0.5) shifts the mix: higher means thinner stems, fewer
   rosettes and splotches, more roses, flourishes and dots. On `/sketch`, `?elegant` or the E
   key sets it to 1.

3. **Seams.** Before each part is drawn, a soft band along its path is erased with
   destination-out, so the part sits on top of what it crosses. The stem is drawn last.
4. **Washes.** Soft radial glows sit behind the stem in the second ink, and a few loose seeds
   drift off the tip.
5. **Watercolour and screens.** Shapes are filled the way p5.brush and Tyler Hobbs do it:
   several translucent copies of the shape, each with subdivided, randomly pushed edges, each
   layer drifted and scaled slightly so the stacked edges stay visible. Splotches around
   elements come and go with elegance, and sometimes have a geometric core (triangle, rhombus,
   pentagon, hexagon). Petals are never screened. Dot screens survive only on some Penrose
   tiles, where they have a shape to sit in; screens over pools, and hatch and checker screens,
   were all tried and dropped. Every brushstroke lays a fainter bleed of itself into the wash
   layer beneath the ink core, and the core is drawn with one of three brushes chosen at random:
   a clean ribbon, a charcoal brush (several narrower passes with lateral jitter, so the edge
   goes grainy), or a stipple brush (a thin ribbon with dots scattered along and across it).
   Some fills also get a hatch overlay: thin parallel ink lines clipped to the shape.
6. **Pigment and colour pops.** Washes are drawn in colour with multiply blending, so
   overlapping pigments deepen each other. Each element picks a pigment: usually the main
   purple, sometimes an accent such as pink or peach (`accents` and `accentChance`), and its
   wash carries that colour into the surroundings.
7. **Paper and wet edges.** In the composite, coarse granulation noise and a fine tooth modulate
   the wash so pigment settles darker into the grain, and wherever wash density changes quickly
   a darker rim is added, the way pigment gathers at the edge of a drying pool. Ink is laid over
   the wash with straight alpha.
8. **Fit.** The piece is composed on a canvas 1.6× larger than the output, its drawn extent is
   measured, and the drawing is scaled and centred into the output with a 6% margin. No seed is
   ever clipped, at any aspect ratio.

The canvas can be any aspect ratio; element sizes scale from the short side and the stem spans
the long one. Pigments are plum ink and lilac wash with accents of coral, peach, sky blue,
magenta and ochre. The homepage uses 480×300 on a transparent ground;
`/sketch` piece mode uses a 1.6:1 landscape on white.

## Stacked vines

A `stacks` option above 1 turns the piece into a field: that many vines, each with its own
palette from the `PALETTES` set in `piece.ts`, its own scale and direction, clustered around a
few centres with two large vines running across the whole canvas. On `/sketch` in piece mode, the
Big button or the B key renders this at 70% of the viewport width in a 2:1 frame. A `density`
option (0 to 1) scales it: 0 is the base count of vines, 1 multiplies the vine count by four,
spreads them over the whole canvas, and floods the ground with broad washes in many palettes
first.

## Review method

Because each seed produces a different composition, the piece is reviewed by rendering contact
sheets: many seeds laid out in a grid at once, so distinctness and balance can be judged across
a whole edition rather than by picking a single good-looking seed. `?sheet` on `/sketch` renders
twelve seeds derived from the current one. This follows the determinism-check and contact-sheet
approach in the camilleroux/genart-skill project.

## Where it lives

- `src/generative/piece.ts` — the algorithm and renderer, built directly on the Canvas 2D API.
- `src/GenerativePiece.tsx` — a React wrapper that draws the piece once into a canvas element.

See [plate.md](plate.md) for the plate and photo treatments built on top of the piece.
