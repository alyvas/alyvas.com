# The sketch page

`/sketch` (`src/SketchPage.tsx`) is the only sketch page. A toolbar pinned to the top right is
always visible and carries the mode, the seed, that mode's settings, and a PNG export at 1x, 2x
or 3x.

## Modes

| Mode  | What it draws                                                                              |
| ----- | ------------------------------------------------------------------------------------------ |
| Piece | One still vine from `renderPiece` — see [generative.md](generative.md)                     |
| Plate | `renderPlate` on the vine, with the seven structures selectable — see [plate.md](plate.md) |
| Photo | The same plate run on an image the visitor drops or picks, with an intensity slider        |

## Piece settings

Elegant, Geometric, Big and Sheet are one-of-four by default: clicking one selects it and clears
the others, and clicking the one that is already on its own turns it off. Shift-click adds to or
removes from the set, so any combination is still reachable. The keys behave the same way, with
shift held for the additive form.

Big adds a density slider. Sheet renders twelve seeds at once as a contact sheet.

## Keys

| Key           | What it does                                  |
| ------------- | --------------------------------------------- |
| `R`           | New seed (clicking the artwork does the same) |
| `E`           | Elegant                                       |
| `G`           | Geometric                                     |
| `B`           | Big                                           |
| `S`           | Sheet                                         |
| Shift + above | Add to, or remove from, the current settings  |
| `1`/`2`/`3`   | Piece, plate, photo                           |

## Export

Export re-renders the current view into an offscreen canvas at the chosen scale and saves a PNG.
In sheet mode it composites all twelve into one grid. Plate and photo exports wait on
`document.fonts.load` first, or the ASCII windows come out in the fallback face.

## URL state

The URL carries the mode, the seed and every setting, so a link reproduces exactly what is on
screen. `/sketch2` and `/sketch3` rewrite themselves to the plate and photo modes.

## Layout

`TOOLBAR_CLEARANCE` keeps the artwork out from under the panel on screens 900px and wider. Below
that the artwork uses the full width and the toolbar floats over it.
