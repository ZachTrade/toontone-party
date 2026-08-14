# Drop real logo SVGs here

The game only shows real brand artwork. Most of it comes from
[simple-icons](https://github.com/simple-icons/simple-icons), baked straight into
`logos.js`. This folder is for the brands simple-icons doesn't carry — the 23 dropped
when the game moved to real-artwork-only, and the Malaysian names it has never had.
`tools/wanted.js` is the full list.

## Adding one

1. Save the logo as `<Brand Name>.svg` — the filename is the brand name, exactly as it
   appears in `tools/wanted.js`. `Red Bull.svg`, `Touch 'n Go.svg`.
2. Run the converter:

   ```bash
   npm i -D @xmldom/xmldom      # once
   npm run logos                # or: node tools/add-logos.js --check
   ```

3. It merges the mark into `logos.js` and prints the row to paste into
   `api/_brands.js`. The brand can't come up in a round until that row exists.
4. `npm test`.

The converter keeps the geometry and the transforms and throws away every paint,
writing `CURRENT` where the player's colour goes. It reports anything it couldn't
convert instead of dropping it quietly — read those warnings, because a logo missing
half its shapes still renders, just wrongly.

## What makes a good source file

- **Real vector outlines.** A traced-bitmap SVG or one wrapping a PNG is no good — the
  converter will say so.
- **No live text.** Text needs a font to render and won't survive. Prefer a version
  with the lettering converted to paths; wordmark logos are usually distributed that
  way already.
- **Flat shapes over gradients.** Gradients get flattened to the player's colour, which
  is normally what you want, but a logo whose whole identity is a gradient will look
  off.
- **Simple is better.** These re-render on every slider move. Anything over ~30 KB of
  path data is worth simplifying first.

## Colours

`hex` in `api/_brands.js` is what the round is scored against, so it has to be right —
a wrong value silently punishes correct answers. Take it from the brand's own guidelines
or press kit, not from eyedroppering the SVG, which is often an approximation. The
Malaysian entries in `tools/wanted.js` are deliberately left `null` for this reason.

## Licensing

Wikimedia Commons is the usual source. Check each file's licence box before using it:

- Most brand logos there are **PD-textlogo** / **PD-shape** — below the threshold of
  originality, no attribution needed.
- Some are **CC BY-SA**, which does require attribution. Record the author and licence
  in `tools/wanted.js` next to the brand if you use one.
- Commons doesn't host fair-use files, but **English Wikipedia does**. A logo that only
  exists on `en.wikipedia.org` rather than Commons is probably non-free — leave it.
- The Olympic rings are protected under the Nairobi Treaty independently of copyright.

Trademarks stay with their owners in every case. The game names each brand out loud and
uses its mark to ask you about that brand, which is what keeps this nominative use.

## Nothing is checked in here

The repo ships no files in this folder — the logos belong to their owners, and which
ones are appropriate to redistribute depends on the licence of the file you picked.
