# Generative piece

## Intent

The piece is a still image, never animated, assembled from fragments of three
different generative algorithms. No fragment is ever drawn as a complete,
recognisable shape: not a full Maurer rose, not a full Penrose tile set, not a
full Lissajous curve. Instead each algorithm contributes cut, faded pieces
that are seamed and layered against each other.

The three source algorithms are:

- **Maurer rose** — chords drawn between points on the polar curve
  r = sin(nθ), sampled at θ = k·d degrees for a fixed step d. Ordinarily this
  produces a single closed rose; here only fragments of the chord sequence
  are kept.
- **Penrose P3 rhombus tiling** — generated with de Bruijn's pentagrid
  construction: five families of parallel lines set at 72° increments to one
  another. Every point where lines from two different families intersect
  yields one rhombus of the tiling. Only some of the resulting rhombi are
  drawn, and never as a complete tiled field.
- **Lissajous curves** — x = sin(a·t + δ), y = sin(b·t), traced in short
  broken arcs rather than the full periodic curve.

The interest is not any one algorithm's geometry on its own. It's in how the
fragments are cut, faded at their ends, seamed so they appear to overlap and
occlude one another, layered, and finally dithered — rendered in one or two
colours of ink on a white or transparent ground.

## Determinism

A 32-bit integer seed drives a mulberry32 pseudo-random number generator.
Every piece of geometry — centres, radii, rotations, counts, cut points — is
expressed as a fraction of the canvas's short side, so the same seed produces
the same image at any output size; nothing is hard-coded in pixels.

The homepage draws a fresh random seed on every page load and renders one
small iteration of the piece. The `/sketch` route shows a single piece large,
and regenerates a new seed (and therefore a new image) whenever the canvas is
clicked or the R key is pressed.

## Pipeline

The image grows like a vine, so every seed shares an organic skeleton while the parts differ.

1. **Stem.** A smooth spine grows from near one edge across the long axis. Its heading drifts with seeded sum-of-sines noise and bends back toward its target direction, so it wanders like a plant rather than a random walk. It is drawn as a brush ribbon: filled quads between left and right offsets whose width swells and thins along the path and tapers at both ends.
2. **Nodes.** Four to eight nodes along the stem sprout parts, alternating sides, and sizes shrink toward the tip:
   - a _leaf_ is a rooted fan of Maurer chords (six to twenty-two chords) drawn as a thick-and-thin ribbon, with the fan itself washed in by a radial gradient from the node;
   - a _blossom_ is a patch of Penrose rhombi from the pentagrid, masked by a soft disc, cut by a straight seam, with tiles filling in a gradient from the centre and a few tiles inked solid;
   - a _tendril_ is a rooted Lissajous arc as a thin-to-thick ribbon.
     - a _flourish_ is a calligraphic curl: a log spiral drawn as a thin-thick-thin stroke, simplified, with a trail of shrinking dots continuing its direction;
   - _dots_ alone are a short trail of shrinking dots leaving the node.
     Up to two side branches grow from nodes and carry a smaller leaf or blossom at the tip. Roses sometimes draw only a stretch of their outline, and the loose end reaches with a thin line for another node, which keeps shapes from looking too perfect.
     A `geometric` option (0 to 1, default 0.15) makes the stem angular. Each piece picks a snap of either 90° (maze-like) or 36°, and angular nodes often grow L-system twigs: F[+F][-F]F at the snap angle, thinner each generation, with a small bloom or dots at the ends. It also turns pools into polygons, rose petals into low-count polygons, bloom petals into rhombi and tendrils into sparse zigzags. At the default it sneaks into a few drawings; at 1 about half of any piece is angular and the rest stays flowing, since the effective value is capped at 0.5 so no drawing ever turns into a circuit board. On `/sketch`, `?geometric` or the G key sets it to 1.
     An `elegance` option (0 to 1, default 0.5) shifts the mix: higher means thinner stems, fewer rosettes and splotches, more roses, flourishes and dots. On `/sketch`, `?elegant` or the E key sets it to 1.
3. **Seams.** Before each part is drawn, a soft band along its path is erased with destination-out, so it reads as laid on top of what it crosses. The stem is drawn last.
4. **Washes.** Soft radial glows sit behind the stem in the second ink, and a few loose seeds drift off the tip.
5. **Watercolour and screens.** Shapes are filled the way p5.brush and Tyler Hobbs do it: several translucent copies of the shape, each with subdivided, randomly pushed edges, and each layer drifting and breathing a little so the stacked edges stay visible. Splotches around elements come and go with elegance, and sometimes have a geometric heart (triangle, rhombus, pentagon, hexagon). Petals are never screened. Dot screens survive only on some Penrose tiles, where they have a shape to sit in; screens over pools, hatch and checker screens were all tried and dropped. Every brushstroke lays a fainter bleed of itself into the wash layer beneath the ink core, and the core itself is drawn with one of three brushes chosen at random in the p5.brush spirit: a clean ribbon, a charcoal brush (several narrower passes with lateral jitter so the edge goes grainy), or a stipple brush (a thin ribbon with dots scattered along and across it). Some fills also get a hatch overlay: thin parallel ink lines clipped to the shape.
6. **Pigment and colour pops.** Washes are drawn in colour with multiply blending, so overlapping pigments deepen each other. Each element picks a pigment: usually the main purple, sometimes an accent such as pink or peach (`accents` and `accentChance` options), and its wash carries that colour into the surroundings.
7. **Paper and wet edges.** In the composite, a coarse granulation noise and a fine tooth modulate the wash so pigment settles darker into the grain, and wherever wash density changes quickly a darker rim is added, the way pigment gathers at the edge of a drying pool. Ink is laid over the wash with straight alpha.
8. **Fit.** The piece is composed on a canvas 1.6× larger than the output, its drawn extent is measured, and the whole drawing is scaled and centred into the output with a 6% margin. No seed is ever clipped, at any aspect ratio.

The canvas can be any aspect ratio; element sizes scale from the short side and the stem spans the long one. Pigments lean toward Ana Montiel's FIELDS: plum ink and lilac wash with clear accents of coral, peach, sky blue, magenta and ochre. The homepage uses 480×300 on a transparent ground; `/sketch` uses a 1.6:1 landscape on white.

## Review method

Because each seed produces a different composition, the piece is reviewed by
rendering contact sheets: many seeds laid out in a grid at once, so
distinctness and balance can be judged across a whole edition rather than by
picking a single lucky-looking seed. This mirrors the determinism-check and
contact-sheet approach described by the camilleroux/genart-skill project.

## Where it lives

- `src/generative/` — the algorithm and renderer. Framework-free, built
  directly on the Canvas 2D API.
- `src/GenerativePiece.tsx` — a thin React wrapper that draws the piece once
  into a canvas element.

The homepage renders one small iteration of the piece beneath the intro
text. The `/sketch` route renders one large iteration.

A `stacks` option above 1 turns the piece into a field: that many vines, each in its own palette drawn from a set after Montiel's FIELDS, its own scale and direction, gathered around a few centres with two large anchor vines running across. On `/sketch`, `?big` or the B key renders this at 70% of the viewport width in a 2:1 frame, and a `density` option (0 to 1) scales it: 0 is the base count of vines, 1 multiplies the vine count by four, spreads them over the whole canvas and floods the ground with broad washes in many palettes first. Hovering the bottom-right corner of `/sketch` reveals buttons for every mode and the density slider. `?seed=N` pins a seed (the URL updates as you regenerate) and `?sheet` renders a grid of twelve seeds derived from it, which is the contact-sheet view for judging the edition.

## The plate (/sketch2)

A second study that treats the vine as source material rather than the finished image, after enigmatriz's ASCII overlays and cutouts and the gencup posters' grainy fields and data marks. `src/generative/plate.ts` renders the piece to an offscreen canvas, then builds the plate in ten seeded steps: paper and two broad colour fields; vertical rules and sometimes a fine grid band; the vine; one to three silhouettes cut from a horizontal band of the vine and printed flat in paper or the hot accent, offset like a misregistered pass; the painted vine over them; one or two ASCII regions where the vine's coverage is sampled on a character grid so the characters, their translucent paper backing and a stepped outline all follow the vine's own shape, shifted a few cells like a misprint; often a burn section, where the image inside one panel-aligned band becomes coarse blocks in the hot colour with rows bleeding sideways in runs and a contour in the second field colour; one or two data lines in a random dialect (dotted, dashed, solid or a soft curve, with square, round or no nodes); a thin scatter of figures, fractions, circled numbers and small arrows; number grids inside one or two panel-aligned sections, often carrying one large figure; a corner edition mark; and film grain over the whole surface. Four looks (paper, field pair, ink, hot accent) rotate by seed.
