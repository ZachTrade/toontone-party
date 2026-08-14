#!/usr/bin/env node
/* Merge the SVGs in tools/logos-src/ into logos.js.
 *
 *   node tools/add-logos.js            convert and write
 *   node tools/add-logos.js --check    report only, change nothing
 *
 * A file is matched to a brand by its name: `tools/logos-src/Red Bull.svg`
 * becomes the mark for "Red Bull". Existing marks are kept unless a matching
 * SVG is supplied, so this only ever adds or replaces — it never regenerates
 * the simple-icons table and so can't wipe it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(__dirname, 'logos-src');
const LOGOS = path.join(ROOT, 'logos.js');

let convert;
try {
  ({ convert } = require('./svg-to-mark.js'));
} catch (err) {
  if (err && err.code === 'MODULE_NOT_FOUND' && /xmldom/.test(err.message)) {
    console.error('This needs the XML parser:\n\n  npm i -D @xmldom/xmldom\n');
    process.exit(1);
  }
  throw err;
}

const checkOnly = process.argv.includes('--check');

const { BRANDS } = require('../api/_brands.js');
const WANTED = require('./wanted.js');
require('../logos.js');
const existing = globalThis.ToonLogos.marks();

if (!fs.existsSync(SRC)) {
  console.error(`No such directory: ${SRC}`);
  process.exit(1);
}
const files = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.svg'));
if (!files.length) {
  console.log(`No SVGs in ${path.relative(ROOT, SRC)} — nothing to do.`);
  console.log(`${WANTED.length} brands are still waiting for artwork; see the README there.`);
  process.exit(0);
}

const wantedByBrand = new Map(WANTED.map((w) => [w.brand, w]));
const merged = { ...existing };
const added = [];
const failed = [];

for (const file of files.sort()) {
  const brand = path.basename(file, path.extname(file));
  try {
    const svg = fs.readFileSync(path.join(SRC, file), 'utf8');
    const mark = convert(svg, { name: file });
    merged[brand] = [mark.viewBox, mark.inner];
    added.push({ brand, mark, replaced: !!existing[brand] });
  } catch (err) {
    failed.push({ file, reason: err.message });
  }
}

console.log(`\nConverted ${added.length} of ${files.length} file(s):\n`);
for (const { brand, mark, replaced } of added) {
  const size = (mark.inner.length / 1024).toFixed(1);
  console.log(`  ${replaced ? 'replaced' : 'added   '} ${brand.padEnd(22)} ${String(mark.shapes).padStart(3)} shapes  ${size.padStart(6)} KB  viewBox="${mark.viewBox}"`);
  for (const w of mark.warnings) console.log(`           ⚠ ${w}`);
}
for (const { file, reason } of failed) console.log(`  FAILED   ${file}: ${reason}`);

// A converted mark is only half the job — the brand also needs a row in
// api/_brands.js before it can come up in a round.
const inGame = new Set(BRANDS.map((b) => b.brand));
const readyToList = added.filter((a) => !inGame.has(a.brand));
if (readyToList.length) {
  console.log(`\nNot in the game yet. Add these rows to api/_brands.js:\n`);
  for (const { brand } of readyToList) {
    const w = wantedByBrand.get(brand);
    if (!w) {
      console.log(`  { brand: ${JSON.stringify(brand)}, element: 'the logo …', emoji: '🎨', hex: '#…', tier: 2 },`);
      continue;
    }
    const hex = w.hex ? `'${w.hex}'` : "'#…'";
    console.log(`  { brand: ${JSON.stringify(brand)}, element: ${JSON.stringify(w.element)}, emoji: '${w.emoji}', hex: ${hex}, tier: ${w.tier} },`);
    if (!w.hex) {
      console.log(`           ⚠ no verified brand colour yet — the round is scored against it,`);
      console.log(`             so read it off ${brand}'s own brand guidelines before adding.`);
    }
  }
}

const stillWanted = WANTED.filter((w) => !merged[w.brand]);
if (stillWanted.length) {
  console.log(`\nStill waiting for artwork (${stillWanted.length}): ${stillWanted.map((w) => w.brand).join(', ')}`);
}

if (checkOnly) {
  console.log('\n--check: logos.js not written.');
  process.exit(failed.length ? 1 : 0);
}

// Rewrite only the table, so the renderer below it is never touched.
const src = fs.readFileSync(LOGOS, 'utf8');
const open = src.indexOf('  const PATHS = {');
const close = src.indexOf('\n  };', open);
if (open === -1 || close === -1) {
  console.error('Could not find the PATHS table in logos.js — aborting rather than guessing.');
  process.exit(1);
}
const body = Object.keys(merged)
  .sort()
  .map((k) => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(merged[k]) + ',')
  .join('\n');
fs.writeFileSync(LOGOS, src.slice(0, open) + '  const PATHS = {\n' + body + src.slice(close));

console.log(`\nlogos.js now holds ${Object.keys(merged).length} marks (${(fs.statSync(LOGOS).size / 1024).toFixed(1)} KB).`);
console.log('Run `npm test` to check nothing regressed.');
if (failed.length) process.exit(1);
