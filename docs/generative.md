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
     Up to two side branches grow from nodes and carry a smaller leaf or blossom at the tip.
3. **Seams.** Before each part is drawn, a soft band along its path is erased with destination-out, so it reads as laid on top of what it crosses. The stem is drawn last.
4. **Washes.** Soft radial glows sit behind the stem in the second ink, and a few loose seeds drift off the tip.
5. **Watercolour.** Washes, pools, leaf fans and rose petals are filled the way p5.brush and Tyler Hobbs do it: a dozen or more translucent copies of the shape, each with subdivided, randomly pushed edges, so pigment pools in the middle and feathers at the rim. Every brushstroke also lays a wider, fainter bleed of itself into the wash layer beneath the ink core.
6. **Pigment and colour pops.** Washes are drawn in colour with multiply blending, so overlapping pigments deepen each other. Each element picks a pigment: usually the main purple, sometimes an accent such as pink or peach (`accents` and `accentChance` options), and its wash carries that colour into the surroundings.
7. **Paper and wet edges.** In the composite, a coarse granulation noise and a fine tooth modulate the wash so pigment settles darker into the grain, and wherever wash density changes quickly a darker rim is added, the way pigment gathers at the edge of a drying pool. Ink is laid over the wash with straight alpha.
8. **Fit.** The piece is composed on a canvas 1.6× larger than the output, its drawn extent is measured, and the whole drawing is scaled and centred into the output with a 6% margin. No seed is ever clipped, at any aspect ratio.

The canvas can be any aspect ratio; element sizes scale from the short side and the stem spans the long one. The homepage uses 480×240 in deep purples on a transparent ground; `/sketch` uses a 1.6:1 landscape on white.

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

On `/sketch`, `?seed=N` pins a seed (the URL updates as you regenerate) and `?sheet` renders a grid of twelve seeds derived from it, which is the contact-sheet view for judging the edition.
