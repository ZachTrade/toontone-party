/* Turn a real-world SVG logo into a mark the game can re-tint.
 *
 * Logos in the wild are full-colour, many-shaped and full of things that can't
 * take a colour — gradients, embedded bitmaps, text that needs a font. A mark
 * has to be the opposite: flat geometry that takes one colour, so the shape can
 * repaint live as the sliders move.
 *
 * So this keeps the geometry and the transforms, throws away every paint, and
 * writes CURRENT wherever a colour belongs. Anything it can't honestly convert
 * is reported rather than silently dropped — a logo missing half its shapes
 * would still render, just wrongly, and that's worse than a failed build.
 */
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

// Shapes that carry the outline. `g` is kept for its transform.
const GEOMETRY = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'g']);

// Structure and metadata: no visible geometry, safe to drop in silence.
const IGNORABLE = new Set([
  'defs', 'style', 'metadata', 'title', 'desc', 'sodipodi:namedview', 'namedview',
  'clippath', 'clipPath', 'mask', 'filter', 'lineargradient', 'linearGradient',
  'radialgradient', 'radialGradient', 'pattern', 'symbol', 'switch', 'foreignobject',
]);

// Visible content we can't turn into a flat tintable shape.
const LOSSY = {
  image: 'an embedded bitmap',
  text: 'live text (needs a font to render)',
  tspan: 'live text (needs a font to render)',
  use: 'a <use> reference into <defs>',
};

// Per-shape attributes worth keeping. Everything else is paint or styling.
const GEOMETRY_ATTRS = new Set([
  'd', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r',
  'x1', 'y1', 'x2', 'y2', 'points', 'transform',
  'fill-rule', 'clip-rule', // holes disappear without these
]);

const STROKE_ATTRS = new Set([
  'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray',
]);

/** Inline `style="fill:#fff"` wins over the fill attribute, so read both. */
function paintOf(el) {
  const style = {};
  for (const decl of (el.getAttribute('style') || '').split(';')) {
    const [k, v] = decl.split(':');
    if (k && v) style[k.trim().toLowerCase()] = v.trim();
  }
  const read = (name) => style[name] || el.getAttribute(name) || null;
  return { fill: read('fill'), stroke: read('stroke'), strokeWidth: read('stroke-width') };
}

const isNone = (v) => !v || v.trim().toLowerCase() === 'none';

function convert(svgText, { name = 'logo' } = {}) {
  const doc = new DOMParser({ onError: () => {} }).parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg') throw new Error(`${name}: not an SVG`);

  const warnings = [];
  const serializer = new XMLSerializer();

  // Prefer the viewBox; fall back to width/height so the mark keeps its aspect.
  let viewBox = root.getAttribute('viewBox');
  if (!viewBox) {
    const w = parseFloat(root.getAttribute('width'));
    const h = parseFloat(root.getAttribute('height'));
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      throw new Error(`${name}: no viewBox and no usable width/height`);
    }
    viewBox = `0 0 ${w} ${h}`;
  }
  viewBox = viewBox.trim().split(/[\s,]+/).join(' ');

  let shapes = 0;

  function walk(node, out) {
    for (let i = 0; i < node.childNodes.length; i++) {
      const el = node.childNodes[i];
      if (el.nodeType !== 1) continue; // elements only
      const tag = el.nodeName.toLowerCase().replace(/^.*:/, '');

      if (LOSSY[tag]) {
        warnings.push(`dropped ${LOSSY[tag]}`);
        continue;
      }
      if (IGNORABLE.has(tag) || IGNORABLE.has(el.nodeName)) continue;
      if (!GEOMETRY.has(tag)) {
        warnings.push(`dropped unsupported <${tag}>`);
        continue;
      }

      if (tag === 'g') {
        // Keep the group only for its transform; drop its paint.
        const transform = el.getAttribute('transform');
        const inner = [];
        walk(el, inner);
        if (!inner.length) continue;
        out.push(transform ? `<g transform="${transform}">${inner.join('')}</g>` : inner.join(''));
        continue;
      }

      const paint = paintOf(el);
      // A shape drawn as an outline has no fill and must keep taking the colour
      // through its stroke, or it vanishes.
      const strokeOnly = isNone(paint.fill) && !isNone(paint.stroke);

      const attrs = [];
      for (let a = 0; a < el.attributes.length; a++) {
        const { name: an, value } = el.attributes[a];
        if (GEOMETRY_ATTRS.has(an)) attrs.push(`${an}="${value}"`);
        else if (strokeOnly && STROKE_ATTRS.has(an)) attrs.push(`${an}="${value}"`);
      }
      // stroke-width can hide in the style attribute too.
      if (strokeOnly && !attrs.some((a) => a.startsWith('stroke-width=')) && paint.strokeWidth) {
        attrs.push(`stroke-width="${paint.strokeWidth}"`);
      }
      attrs.push(strokeOnly ? 'fill="none" stroke="CURRENT"' : 'fill="CURRENT"');

      out.push(`<${tag} ${attrs.join(' ')}/>`);
      shapes++;
    }
  }

  const out = [];
  walk(root, out);
  if (!shapes) throw new Error(`${name}: no usable geometry found`);

  return {
    viewBox,
    inner: out.join(''),
    shapes,
    // One line per distinct problem, however many times it occurred.
    warnings: [...new Set(warnings)],
    serializer,
  };
}

module.exports = { convert };
