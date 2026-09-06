# The plate and photo treatments

Two studies that treat the [generative piece](generative.md) as source material rather than as
the finished image, after enigmatriz's ASCII overlays and cutouts and the gencup posters' grainy
fields and data marks. Both live in `src/generative/plate.ts` and are reached from
[`/sketch`](sketch.md).

## Plate mode

`renderPlate` draws the piece to an offscreen canvas, then builds the plate in ten seeded steps.

1. **Ground.** Paper, then two broad colour fields crossing the frame diagonally.
2. **Structure.** One layout per plate: vertical rules, sparse rules, horizontal rows, outlined
   panel boxes with a margin, a masonry of faint translucent panels stacked over one another
   (sometimes with a stepped profile), or a mini grid. Rules, rows and grids are the most
   common. Often a graph-paper band; rarely a broken frame drawn as gapped segments with one
   side missing or shifted. Whatever the layout, its panels are the unit every later section
   aligns to.
3. **The subject.** The vine, rendered to its own canvas so its alpha can be sampled.
4. **Silhouettes.** One to three flat cutouts taken from a horizontal band of the vine, printed
   in paper or the hot accent and offset like a misregistered pass.
5. **The painted vine**, over its silhouettes.
6. **ASCII.** One or two regions where the vine's coverage is sampled on a character grid, so
   the characters, their translucent paper backing and a stepped outline all follow the vine's
   shape, shifted a few cells like a misprint.
7. **Burn.** Often one panel-aligned band where the image becomes coarse blocks in the hot
   colour, rows bleeding sideways in runs, with a contour in the second field colour.
8. **Data lines.** One or two, in a random dialect — dotted, dashed, solid or a soft curve, with
   square, round or no nodes. Most nodes are sampled from points on the vine, so the line
   follows the drawing.
9. **Arrows.** Up to three, long and translucent, straight or curved, often entering from
   off-frame.
10. **Marks and grain.** Markers after okazz (circles, squares, quarter and half discs, crosses,
    lollipops) on points of the vine, and sometimes on a grid inside a section that only fills
    where the drawing has coverage; one to three figures set as captions just off the drawing;
    number grids inside one or two panel-aligned sections, often with one large figure; a corner
    mark carrying the seed in hex and the date; and film grain over the whole surface.

Four looks — paper, field pair, ink, hot accent — rotate by seed.

## Photo mode

Drop or choose an image and the plate treats it instead of the vine. The picture covers the
plate as the ground, under a thin veil and faint colour fields, and a palette is taken from it:
ink from its darks, hot from its most saturated sample, fields from lightened versions of both.
A feature map (edge strength plus darkness) replaces the vine's alpha, so ASCII regions, burn,
markers and data lines follow the picture's structure.

Objects are found without a model. `src/generative/segments.ts` quantises colours on a
downsampled copy with seeded k-means, runs connected components, ranks the blobs by saliency
(edge density plus contrast against the image mean), and traces each outline with marching
squares simplified by Ramer-Douglas-Peucker. Blobs over a third of the image are treated as
backdrop and skipped.

Before any treatment, the photo is cut into two to four layers along its largest segment
boundaries; each layer shifts a little, leaving a paper gap where it moved from, with a soft
shadow and a hairline seam, so the picture looks like a paper collage. Blend panels use only
multiply and overlay at low alpha, holes and moves are limited to small, compact segments, and
the two-tone dither lays ink only, leaving the picture visible underneath.

Each plate then picks two or three treatments, each bound to one of those segments or to a panel
section rather than stamping rectangles everywhere. Vines sprawl in from the edges over the
picture in multiply, overlay or luminosity, and on ruled layouts a few panels show the photo
back through itself in a blend mode. The photo also moves, at reduced intensity: one or two
regions relocated and left as a white box with an outline; a misregistered duplicate in
multiply; small boxes cut from the busiest points and lined up in a margin strip; a coarse block
silhouette lifted out white and pasted elsewhere as a mosaic; a pixel-sorted band; a
channel-split band; and a section reduced to paper and ink through a Bayer dither. Ruled
structures sometimes carry bracketed panel indices.

Click for another take of the same image, or drop a new one at any time. The canvas follows the
image's aspect ratio.
