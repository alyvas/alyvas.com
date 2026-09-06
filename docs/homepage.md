# The homepage

`src/App.tsx`. The composition is centred in the viewport: on screens 861px and wider, the
generative drawing on the left and a left-aligned text column on the right; below that, the text
column on top and the drawing beneath it.

The text comes first in the DOM, so the reading order is name, bio, then the decorative drawing.
The wide layout uses `row-reverse` to put the drawing back on the left.

## Entrance

Nothing is painted until the display face is resident. `useIsRevealed` calls
`document.fonts.load` for the two weights actually used, then reveals — `document.fonts.ready`
on its own can settle before the face has even been requested. A `REVEAL_TIMEOUT` race caps the
wait at 1.2s, because a blank page is worse than a swapped one.

Everything fades in place — nothing moves. The colour field starts at 0ms over 1400ms, the name
at 220ms and the bio and the drawing together at 400ms, each over 900ms. Reduced motion skips
the animation and shows everything at once.

## The text column

Two blocks at the same size, one weight apart: `alyvas` at 500, then the bio at 400, both in the
display face. The bio is one sentence — "Currently ⟨icon⟩ Case Western Reserve. Previously
⟨icon⟩ Memorial Sloan Kettering, …" — built from the `CURRENT` and `PREVIOUS` constants.

### The display face is still undecided

Outfit and Readex Pro are both installed (`@fontsource-variable/outfit`,
`@fontsource-variable/readex-pro`) and listed in `DISPLAY_FONTS`. The F key swaps between them at
runtime. Each entry carries its own `size` and `tracking` because Readex Pro is the wider face:
it is set smaller and tighter so both wrap the bio to the same three lines. Change those per
face, not on `title` / `bio`, which no longer set size or tracking. Once one is chosen, set
`DEFAULT_DISPLAY_FONT`, delete the other, and the list and its hook can go.

## Post marks

Each place is a `PostMark`: an Iconoir glyph in a button, the place name, and its trailing comma
or full stop, all inside one `white-space: nowrap` span.

- The punctuation has to live inside that span. Left in the surrounding paragraph, it wraps onto
  the next line on its own.
- Hovering or focusing the icon opens a card with the role and the years (`popIn`: hinged at its
  bottom edge, overshooting slightly and settling about a degree off square, resolving from
  blurred to sharp). The card is paper rather than glass — an opaque warm white with a tiling
  `feTurbulence` grain in `PAPER_GRAIN` — and it sets its own `font-size`, because its padding
  and radius are in px against a sentence set at ~32px. The role and period are also on the
  button's `aria-label`, so nothing is available only on hover.
- Each place name is mixed off `palette.ink` toward one of the palette's colours with
  `color-mix` (the `accent` and `tint` fields on each post), and its glyph is mixed about 2.1×
  further, so the icon is where the colour actually shows. Keep the text mix around 0.2–0.3 and
  give the lightest accents the smallest one; the result should read as a hue shift, not as text
  fading out.

## Icons

Icons come from `iconoir-react` (MIT) at the library's default 1.5 stroke. Iconoir has no
stethoscope, so `src/icons.tsx` carries one drawn to match: a 24 grid, 1.5 stroke on
`currentColor`, round caps, nothing filled, and a bounding box that fills the grid the way the
library's glyphs do (roughly x 4–20, y 2.5–21.5, centred on 12,12). Match that if another icon
has to be drawn.

A heavier stroke was tried and looked wrong, and Iconoir has no bold set — only `Solid` (filled)
variants, and not for all four of these icons — so leave the weight alone.

Buttons do not inherit type, so `iconButton` sets `font: inherit`; the icon is sized in ems off
the sentence.

## The drawing

`usePieceSize` scales the drawing down with the viewport, so it never pushes the layout wider
than the screen. Two buttons appear on hover: one plays a new seed every 740ms, the other
switches the piece to an alternate palette. See [generative.md](generative.md).

## Keyboard

| Key      | What it does            |
| -------- | ----------------------- |
| `[`, `]` | Previous / next palette |
| `F`      | Swap the display face   |
