/* Simplified brand marks, drawn as original vector approximations so the shape
   can be re-tinted live while the player moves the sliders.

   Each entry is { vb, svg }. Inside svg, the literal token CURRENT is replaced
   with the player's colour; any other fill is static (neutral grey for parts of
   a mark that are NOT the colour being guessed, white for cut-outs).

   Lookup order: "Brand|element" (for marks where only one part is in play,
   e.g. Mastercard's left circle) then "Brand". */

(function (root) {
  const W = '#ffffff';
  const GREY = '#c7cad2';

  // Wordmark helper — for brands whose logo IS the lettering.
  const L = (txt, o) => {
    o = o || {};
    return {
      vb: '0 0 220 100',
      svg:
        `<text x="110" y="52" text-anchor="middle" dominant-baseline="central" ` +
        `font-family="${o.f || 'Inter, Helvetica Neue, Helvetica, Arial, sans-serif'}" ` +
        `font-size="${o.sz || 52}" font-weight="${o.w || 800}" ` +
        `letter-spacing="${o.ls == null ? -1.5 : o.ls}" ` +
        `${o.i ? 'font-style="italic" ' : ''}fill="CURRENT">${txt}</text>`,
    };
  };

  // Letter inside a tinted rounded square (app-icon style).
  const TILE = (txt, o) => {
    o = o || {};
    return {
      vb: '0 0 100 100',
      svg:
        `<rect x="8" y="8" width="84" height="84" rx="${o.r == null ? 20 : o.r}" fill="CURRENT"/>` +
        `<text x="50" y="${o.dy || 54}" text-anchor="middle" dominant-baseline="central" ` +
        `font-family="${o.f || 'Inter, Helvetica Neue, Helvetica, Arial, sans-serif'}" ` +
        `font-size="${o.sz || 54}" font-weight="${o.w || 800}" fill="${W}">${txt}</text>`,
    };
  };

  // Tinted circle with a white glyph.
  const DISC = (inner, o) => {
    o = o || {};
    return {
      vb: '0 0 100 100',
      svg: `<circle cx="50" cy="50" r="${o.r || 42}" fill="CURRENT"/>` + inner,
    };
  };

  const LOGOS = {
    /* ---------- hand-drawn marks ---------- */

    "McDonald's": {
      vb: '0 0 200 100',
      svg:
        '<path fill="CURRENT" d="M42 94V44c0-24 22-31 35-11l23 39 23-39c13-20 35-13 35 11v50h-20V46c0-10-8-12-13-3l-25 44-25-44c-5-9-13-7-13 3v48Z"/>',
    },
    Nike: {
      vb: '0 0 200 100',
      svg:
        '<path fill="CURRENT" d="M22 74c18 16 40 12 70-6l94-48c5-3 7 1 2 6L84 92c-16 9-38 7-50-4Z"/>',
    },
    Apple: {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M50 30c18-8 38-2 44 16 6 18-4 38-18 44-8 3-14-2-26-2s-18 5-26 2C10 84 0 64 6 46c6-18 26-24 44-16Z" transform="translate(25 3) scale(0.86)"/>' +
        '<path fill="CURRENT" d="M50 32c0-12 8-20 20-20 0 12-8 20-20 20Z" transform="translate(25 3) scale(0.86)"/>' +
        '<circle cx="92" cy="40" r="13" fill="' + W + '"/>',
    },
    'Coca-Cola': {
      vb: '0 0 220 100',
      svg:
        '<path fill="CURRENT" d="M14 62c26-26 52 14 78-10 26-24 52 14 78-12l6 12c-30 28-56-10-80 12-24 22-50-14-76 10Z"/>' +
        '<text x="110" y="26" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="30" font-weight="700" fill="CURRENT">Coca-Cola</text>',
    },
    Starbucks: {
      vb: '0 0 100 100',
      svg:
        '<circle cx="50" cy="50" r="42" fill="CURRENT"/>' +
        '<circle cx="50" cy="50" r="34" fill="' + W + '"/>' +
        '<circle cx="50" cy="50" r="30" fill="CURRENT"/>' +
        '<circle cx="50" cy="44" r="12" fill="' + W + '"/>' +
        '<path fill="' + W + '" d="M26 60c8-6 16-4 24 2 8-6 16-8 24-2-6 14-16 22-24 22S32 74 26 60Z"/>' +
        '<path fill="CURRENT" d="M44 42h12l-6 8Z"/>',
    },
    Spotify: DISC(
      '<path stroke="' + W + '" stroke-width="7" stroke-linecap="round" fill="none" d="M30 40c14-6 30-5 42 2"/>' +
        '<path stroke="' + W + '" stroke-width="6" stroke-linecap="round" fill="none" d="M32 54c12-5 25-4 35 2"/>' +
        '<path stroke="' + W + '" stroke-width="5" stroke-linecap="round" fill="none" d="M34 67c10-4 20-3 28 2"/>'
    ),
    Netflix: {
      vb: '0 0 120 100',
      svg: '<path fill="CURRENT" d="M30 8h18l24 60V8h18v84H72L48 32v60H30Z"/>',
    },
    Facebook: TILE('f', { sz: 62, dy: 58, f: 'Georgia, serif' }),
    YouTube: {
      vb: '0 0 140 100',
      svg:
        '<rect x="8" y="18" width="124" height="64" rx="18" fill="CURRENT"/>' +
        '<path fill="' + W + '" d="M58 36l32 14-32 14Z"/>',
    },
    WhatsApp: DISC(
      '<path fill="' + W + '" d="M36 34c4-4 8-3 10 1l4 8-5 6c4 8 8 12 16 16l6-5 8 4c4 2 5 6 1 10-6 6-16 4-27-5S30 40 36 34Z"/>'
    ),
    Snapchat: {
      vb: '0 0 100 100',
      svg:
        '<rect x="8" y="8" width="84" height="84" rx="22" fill="CURRENT"/>' +
        '<path fill="' + W + '" d="M50 24c11 0 18 8 18 19 0 6 2 7 6 9 4 2 3 6-2 7-3 1-4 2-3 5 1 4-2 5-6 4-4-1-8 4-13 4s-9-5-13-4c-4 1-7 0-6-4 1-3 0-4-3-5-5-1-6-5-2-7 4-2 6-3 6-9 0-11 7-19 18-19Z"/>',
    },
    LEGO: {
      vb: '0 0 100 100',
      svg:
        '<rect x="10" y="26" width="80" height="60" rx="12" fill="CURRENT"/>' +
        '<rect x="24" y="14" width="16" height="16" rx="5" fill="CURRENT"/>' +
        '<rect x="60" y="14" width="16" height="16" rx="5" fill="CURRENT"/>' +
        '<text x="50" y="58" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="900" fill="' + W + '">LEGO</text>',
    },
    // "Rosso Corsa" is the racing paint, so the mark is the car itself.
    Ferrari: {
      vb: '0 0 180 100',
      svg:
        '<path fill="CURRENT" d="M12 68c0-9 8-13 20-13h14l14-18h38l10 18h22c11 0 16 6 16 13v6H12Z"/>' +
        '<path fill="' + W + '" fill-opacity="0.9" d="M66 42h30l7 13H58Z"/>' +
        '<circle cx="48" cy="74" r="13" fill="#2b2b31"/><circle cx="132" cy="74" r="13" fill="#2b2b31"/>' +
        '<circle cx="48" cy="74" r="5" fill="' + GREY + '"/><circle cx="132" cy="74" r="5" fill="' + GREY + '"/>',
    },
    Barbie: L('Barbie', { f: 'Georgia, serif', i: true, sz: 54 }),
    'Tiffany & Co.': {
      vb: '0 0 100 100',
      svg:
        '<rect x="14" y="34" width="72" height="52" rx="4" fill="CURRENT"/>' +
        '<rect x="44" y="34" width="12" height="52" fill="' + W + '"/>' +
        '<rect x="14" y="52" width="72" height="10" fill="' + W + '"/>' +
        '<path fill="CURRENT" d="M50 34c-6-14-24-18-28-8-3 8 8 12 28 8Zm0 0c6-14 24-18 28-8 3 8-8 12-28 8Z"/>',
    },
    Amazon: {
      vb: '0 0 200 100',
      svg:
        '<text x="100" y="40" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="800" fill="' + GREY + '">amazon</text>' +
        '<path fill="CURRENT" d="M40 66c34 24 88 24 122 2 5-3 9 2 4 6-32 26-98 24-128-2-3-3 0-8 2-6Z"/>' +
        '<path fill="CURRENT" d="M168 62c8-3 16-2 17 1 1 4-3 12-8 16-2 2-3 1-2-2 2-5 3-9 2-10-2-2-6-1-9-1-2 0-2-3 0-4Z"/>',
    },
    IKEA: {
      vb: '0 0 200 100',
      svg:
        '<ellipse cx="100" cy="50" rx="86" ry="36" fill="CURRENT"/>' +
        '<text x="100" y="52" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="900" fill="' + W + '">IKEA</text>',
    },
    'The Home Depot': {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M22 22h56v56H22Z" transform="rotate(45 50 50)"/>' +
        '<text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="900" fill="' + W + '">THD</text>',
    },
    Target: {
      vb: '0 0 100 100',
      svg:
        '<circle cx="50" cy="50" r="42" fill="CURRENT"/>' +
        '<circle cx="50" cy="50" r="27" fill="' + W + '"/>' +
        '<circle cx="50" cy="50" r="13" fill="CURRENT"/>',
    },
    'T-Mobile': {
      vb: '0 0 140 100',
      svg:
        '<rect x="14" y="22" width="56" height="18" fill="CURRENT"/>' +
        '<rect x="33" y="22" width="18" height="56" fill="CURRENT"/>' +
        '<circle cx="92" cy="31" r="9" fill="CURRENT"/><circle cx="118" cy="31" r="9" fill="CURRENT"/>' +
        '<circle cx="92" cy="69" r="9" fill="CURRENT"/><circle cx="118" cy="69" r="9" fill="CURRENT"/>',
    },
    Pokémon: L('Pokémon', { sz: 46, w: 900, ls: -0.5 }),
    'John Deere': {
      vb: '0 0 110 100',
      svg:
        '<g fill="CURRENT">' +
        '<ellipse cx="50" cy="48" rx="27" ry="15" transform="rotate(-14 50 48)"/>' +
        '<ellipse cx="80" cy="30" rx="13" ry="8" transform="rotate(-40 80 30)"/>' +
        '<path d="M85 20l3-14 5 8 5-11 2 14-8 6Z"/>' +
        '<path d="M32 56L16 76l7 5 16-19Zm12 6l-6 24 8 2 5-23Zm20-4l10 24 8-3-11-23Zm8-8l18 14 5-6-18-14Z"/>' +
        '</g>',
    },
    Cadbury: L('Cadbury', { f: 'Georgia, serif', i: true, sz: 50 }),
    Fanta: L('Fanta', { sz: 56, w: 900 }),
    Nintendo: {
      vb: '0 0 200 100',
      svg:
        '<rect x="12" y="30" width="176" height="40" rx="20" fill="CURRENT"/>' +
        '<text x="100" y="51" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800" fill="' + W + '">Nintendo</text>',
    },
    Xbox: DISC(
      '<path fill="' + W + '" d="M32 28c10 8 14 12 18 18 4-6 8-10 18-18-10-6-26-6-36 0Zm-6 6c-6 10-6 24 0 34 6-10 10-16 14-22-4-6-8-10-14-12Zm48 0c-6 2-10 6-14 12 4 6 8 12 14 22 6-10 6-24 0-34ZM32 74c10 6 26 6 36 0-10-8-14-12-18-18-4 6-8 10-18 18Z"/>'
    ),
    Discord: {
      vb: '0 0 140 100',
      svg:
        '<path fill="CURRENT" d="M46 22c-14 2-26 8-30 14-8 14-10 34-6 46 8 8 20 12 28 12l6-9c-5-1-9-3-13-6 12 6 26 8 39 4 5-1 9-3 13-4-4 3-8 5-13 6l6 9c8 0 20-4 28-12 4-12 2-32-6-46-4-6-16-12-30-14l-3 6h-16Z"/>' +
        '<ellipse cx="54" cy="58" rx="8" ry="9" fill="' + W + '"/><ellipse cx="86" cy="58" rx="8" ry="9" fill="' + W + '"/>',
    },
    Twitch: {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M20 14h64v46L66 78H52L40 90V78H20Z"/>' +
        '<rect x="46" y="30" width="8" height="24" fill="' + W + '"/>' +
        '<rect x="64" y="30" width="8" height="24" fill="' + W + '"/>',
    },
    Reddit: DISC(
      '<circle cx="50" cy="52" r="26" fill="' + W + '"/>' +
        '<circle cx="40" cy="50" r="5" fill="CURRENT"/><circle cx="60" cy="50" r="5" fill="CURRENT"/>' +
        '<path stroke="CURRENT" stroke-width="4" fill="none" stroke-linecap="round" d="M38 62c8 6 16 6 24 0"/>' +
        '<circle cx="50" cy="20" r="6" fill="' + W + '"/>'
    ),
    Pinterest: DISC(
      '<text x="50" y="54" text-anchor="middle" dominant-baseline="central" font-family="Georgia, serif" font-size="52" font-weight="800" fill="' + W + '">P</text>'
    ),
    Shell: {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M50 12c16 0 28 12 30 30l6 34c0 8-16 14-36 14s-36-6-36-14l6-34c2-18 14-30 30-30Z"/>' +
        '<path stroke="' + W + '" stroke-width="3" fill="none" d="M50 20v66M36 24l-8 58M64 24l8 58"/>',
    },
    Duolingo: DISC(
      '<circle cx="38" cy="44" r="11" fill="' + W + '"/><circle cx="62" cy="44" r="11" fill="' + W + '"/>' +
        '<circle cx="38" cy="45" r="5" fill="#333"/><circle cx="62" cy="45" r="5" fill="#333"/>' +
        '<path fill="#f7a11a" d="M50 60l10 8-10 8-10-8Z"/>'
    ),

    Pepsi: {
      vb: '0 0 100 100',
      svg:
        '<circle cx="50" cy="50" r="40" fill="CURRENT"/>' +
        '<path fill="' + W + '" d="M10 50c14-10 26-10 40-4s26 6 40-4c0 6-2 10-4 14-14 8-26 6-38 0s-24-8-36 2c-1-4-2-6-2-8Z"/>',
    },
    'Burger King': {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M16 30c0-10 16-16 34-16s34 6 34 16Z"/>' +
        '<path fill="CURRENT" d="M16 70c0 10 16 16 34 16s34-6 34-16Z"/>' +
        '<text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="19" font-weight="900" fill="CURRENT">BK</text>',
    },
    KFC: {
      vb: '0 0 120 100',
      svg:
        '<path fill="CURRENT" d="M22 84L34 30h52l12 54Z"/>' +
        '<rect x="18" y="20" width="84" height="14" rx="6" fill="CURRENT"/>' +
        '<text x="60" y="60" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="900" fill="' + W + '">KFC</text>',
    },
    Subway: L('SUBWAY', { sz: 44, w: 900, ls: 0 }),
    "Domino's": {
      vb: '0 0 120 100',
      svg:
        '<rect x="14" y="26" width="44" height="48" rx="8" fill="CURRENT"/>' +
        '<rect x="62" y="26" width="44" height="48" rx="8" fill="CURRENT"/>' +
        '<circle cx="30" cy="42" r="5" fill="' + W + '"/><circle cx="42" cy="58" r="5" fill="' + W + '"/>' +
        '<circle cx="78" cy="42" r="5" fill="' + W + '"/><circle cx="90" cy="58" r="5" fill="' + W + '"/>',
    },
    'Taco Bell': {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M50 14c14 0 24 14 24 32 0 22-12 40-24 40S26 68 26 46c0-18 10-32 24-32Z"/>' +
        '<circle cx="50" cy="16" r="7" fill="CURRENT"/>',
    },
    "Dunkin'": L("Dunkin'", { sz: 48, w: 900 }),
    Walmart: {
      vb: '0 0 100 100',
      svg:
        '<g fill="CURRENT" transform="translate(50 50)">' +
        '<rect x="-5" y="-40" width="10" height="24" rx="5"/><rect x="-5" y="16" width="10" height="24" rx="5"/>' +
        '<rect x="-40" y="-5" width="24" height="10" rx="5"/><rect x="16" y="-5" width="24" height="10" rx="5"/>' +
        '<rect x="-5" y="-40" width="10" height="24" rx="5" transform="rotate(45)"/>' +
        '<rect x="-5" y="16" width="10" height="24" rx="5" transform="rotate(45)"/>' +
        '<rect x="-40" y="-5" width="24" height="10" rx="5" transform="rotate(45)"/>' +
        '<rect x="16" y="-5" width="24" height="10" rx="5" transform="rotate(45)"/></g>',
    },
    FedEx: L('FedEx', { sz: 52, w: 800 }),
    DHL: L('DHL', { sz: 56, w: 900, ls: 0 }),
    Visa: L('VISA', { sz: 52, w: 900, i: true, ls: 1 }),
    'Mastercard|the left circle red': {
      vb: '0 0 140 100',
      svg:
        '<circle cx="88" cy="50" r="32" fill="' + GREY + '"/>' +
        '<circle cx="52" cy="50" r="32" fill="CURRENT" fill-opacity="0.95"/>',
    },
    Mastercard: {
      vb: '0 0 140 100',
      svg:
        '<circle cx="52" cy="50" r="32" fill="CURRENT"/>' +
        '<circle cx="88" cy="50" r="32" fill="' + GREY + '"/>',
    },
    PayPal: {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M30 16h30c16 0 24 8 22 22-2 14-13 22-28 22H40l-4 24H22Z"/>' +
        '<path fill="CURRENT" fill-opacity="0.55" d="M44 34h26c14 0 21 8 19 21-2 13-12 21-26 21H52l-4 8H36Z"/>',
    },
    LinkedIn: TILE('in', { sz: 38, r: 14 }),
    Airbnb: {
      vb: '0 0 100 100',
      svg:
        '<path fill="none" stroke="CURRENT" stroke-width="9" stroke-linejoin="round" d="M50 18c8 14 24 40 24 52 0 10-8 16-16 16-4 0-8-4-8-10 0 6-4 10-8 10-8 0-16-6-16-16 0-12 16-38 24-52Z"/>',
    },
    Dropbox: {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M28 18L6 34l22 16L50 34ZM72 18L50 34l22 16 22-16ZM6 66l22 16 22-16-22-16ZM72 50L50 66l22 16 22-16ZM32 86l18 12 18-12-18-12Z"/>',
    },
    Firefox: DISC(
      '<path fill="' + W + '" d="M50 24c14 0 24 10 26 22 2 14-8 28-24 30-16 2-28-8-30-22 6 8 14 12 22 10-10-4-14-12-12-20 4 8 10 12 18 12-8-6-10-14-6-22 4 6 10 8 16 8-6-4-10-10-10-18Z"/>'
    ),
    NVIDIA: {
      vb: '0 0 140 100',
      svg:
        '<path fill="CURRENT" d="M18 50c18-20 46-26 70-18-10 2-18 7-23 15-13-3-27-1-37 7 10 8 24 10 37 7-5 8-13 13-23 15-24-2-42-14-24-26Z"/>' +
        '<path fill="CURRENT" d="M84 30c14-4 28-2 38 6-8 10-22 16-38 16 6-6 8-14 0-22Z"/>',
    },
    Android: {
      vb: '0 0 140 100',
      svg:
        '<path fill="CURRENT" d="M26 58c0-18 20-30 44-30s44 12 44 30Z"/>' +
        '<circle cx="52" cy="44" r="5" fill="' + W + '"/><circle cx="88" cy="44" r="5" fill="' + W + '"/>' +
        '<path stroke="CURRENT" stroke-width="5" stroke-linecap="round" d="M34 22l10 12M106 22L96 34"/>' +
        '<rect x="26" y="64" width="88" height="10" rx="5" fill="CURRENT"/>',
    },
    BMW: {
      vb: '0 0 100 100',
      svg:
        '<circle cx="50" cy="50" r="40" fill="CURRENT"/>' +
        '<path fill="' + W + '" d="M50 14a36 36 0 0 1 0 72Z" transform="rotate(0 50 50)"/>' +
        '<path fill="' + W + '" d="M50 50h36a36 36 0 0 0-36-36Z"/>' +
        '<path fill="CURRENT" d="M50 50H14a36 36 0 0 0 36 36Z"/>' +
        '<circle cx="50" cy="50" r="40" fill="none" stroke="CURRENT" stroke-width="10"/>',
    },
    Toyota: {
      vb: '0 0 140 100',
      svg:
        '<g fill="none" stroke="CURRENT" stroke-width="8">' +
        '<ellipse cx="70" cy="50" rx="58" ry="34"/><ellipse cx="70" cy="36" rx="20" ry="14"/>' +
        '<ellipse cx="70" cy="56" rx="14" ry="28"/></g>',
    },
    Tesla: {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M50 26c-14 0-26 4-32 8l6 10c8-4 16-6 26-6s18 2 26 6l6-10c-6-4-18-8-32-8Z"/>' +
        '<path fill="CURRENT" d="M50 40l-8 6 4 40h8l4-40Z"/>',
    },
    Volkswagen: {
      vb: '0 0 100 100',
      svg:
        '<circle cx="50" cy="50" r="40" fill="none" stroke="CURRENT" stroke-width="7"/>' +
        '<path fill="CURRENT" d="M24 30h11l7 22 6-22h6l6 22 7-22h11L66 74h-8l-8-22-8 22h-8Z"/>',
    },
    'Red Bull': {
      vb: '0 0 140 100',
      svg:
        '<circle cx="70" cy="50" r="26" fill="#f5c518"/>' +
        '<path fill="CURRENT" d="M18 34c10-8 22-6 30 2 6-6 12-8 18-6l-6 12c-6-2-10 0-12 4l-8 14-8-14c-4-8-10-12-18-8Z"/>' +
        '<path fill="CURRENT" d="M122 34c-10-8-22-6-30 2-6-6-12-8-18-6l6 12c6-2 10 0 12 4l8 14 8-14c4-8 10-12 18-8Z"/>',
    },
    Heineken: {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M38 10h24v18l10 16v46H28V44l10-16Z"/>' +
        '<rect x="28" y="52" width="44" height="24" fill="' + W + '"/>' +
        '<text x="50" y="65" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="900" fill="CURRENT">H</text>',
    },
    'Monster Energy': {
      vb: '0 0 120 100',
      svg:
        '<path fill="CURRENT" d="M28 12l10 40-14-8 12 44 10-28 4 30 10-32 10 32 4-30 10 28 12-44-14 8 10-40-18 30-14-24-14 24Z"/>',
    },
    Gatorade: {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M50 12c10 12 22 26 22 40 0 16-10 26-22 26S28 68 28 52c0-14 12-28 22-40Z"/>' +
        '<path fill="' + W + '" d="M50 34c4 6 10 14 10 20 0 8-4 14-10 14Z"/>',
    },
    PlayStation: {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M40 12l26 10c8 3 12 8 12 16 0 10-8 14-18 10l-10-4v40l-10-4Z"/>' +
        '<path fill="CURRENT" d="M14 72c14-8 40-12 56-8v10c-12-2-30 0-40 4-6 2-6 4 0 5v8c-16-2-24-10-16-19Z"/>',
    },
    Rolex: {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M50 30c4 0 8 4 8 10h10c2-8 8-12 12-10 4 2 4 10-2 14l-8 6H30l-8-6c-6-4-6-12-2-14 4-2 10 2 12 10h10c0-6 4-10 8-10Z"/>' +
        '<rect x="26" y="62" width="48" height="10" rx="4" fill="CURRENT"/>',
    },
    Hermès: L('HERMÈS', { sz: 40, w: 800, ls: 2 }),
    HSBC: {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M50 12l34 19v38L50 88 16 69V31Z"/>' +
        '<path fill="' + W + '" d="M50 12v76M16 31l68 38M84 31L16 69Z"/>' +
        '<path fill="CURRENT" d="M50 32l20 11v14L50 68 30 57V43Z"/>',
    },
    Vodafone: DISC(
      '<path fill="' + W + '" d="M50 22c8 0 14 4 14 12 0 14-14 18-14 32 0 6 4 10 10 10-6 4-16 2-20-6-6-12 4-24 4-34 0-8-4-12-10-12 4-2 10-2 16-2Z"/>'
    ),
    'National Geographic': {
      vb: '0 0 160 100',
      svg: '<rect x="20" y="14" width="120" height="72" fill="none" stroke="CURRENT" stroke-width="14"/>',
    },
    Caterpillar: {
      vb: '0 0 160 100',
      svg:
        '<text x="80" y="46" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="46" font-weight="900" fill="CURRENT">CAT</text>' +
        '<path fill="CURRENT" d="M40 70h80l-14 16H54Z"/>',
    },
    'Best Buy': {
      vb: '0 0 140 100',
      svg:
        '<path fill="CURRENT" d="M14 26h96l16 24-16 24H14Z"/>' +
        '<text x="60" y="50" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="900" fill="#111">BEST BUY</text>',
    },
    Costco: L('COSTCO', { sz: 42, w: 900, ls: 0 }),
    Chase: {
      vb: '0 0 100 100',
      svg:
        '<g fill="CURRENT"><path d="M42 14h16c3 0 5 2 5 5v18H37V19c0-3 2-5 5-5Z"/>' +
        '<path d="M86 42v16c0 3-2 5-5 5H63V37h18c3 0 5 2 5 5Z"/>' +
        '<path d="M58 86H42c-3 0-5-2-5-5V63h26v18c0 3-2 5-5 5Z"/>' +
        '<path d="M14 58V42c0-3 2-5 5-5h18v26H19c-3 0-5-2-5-5Z"/></g>',
    },
    'American Express': {
      vb: '0 0 120 100',
      svg:
        '<rect x="10" y="14" width="100" height="72" rx="6" fill="CURRENT"/>' +
        '<text x="60" y="50" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="19" font-weight="900" fill="' + W + '">AMEX</text>',
    },
    'Formula 1': {
      vb: '0 0 180 100',
      svg:
        '<text x="60" y="50" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-style="italic" font-size="50" font-weight="900" fill="#111">F1</text>' +
        '<path fill="CURRENT" d="M96 30h72l-10 12H86Zm-6 16h72l-10 12H80Zm-6 16h72l-10 12H74Z"/>',
    },
    NBA: {
      vb: '0 0 100 100',
      svg:
        '<rect x="18" y="10" width="64" height="80" rx="30" fill="CURRENT"/>' +
        '<path fill="' + W + '" d="M44 26c8-4 14 2 12 10-2 6-8 10-8 18l-4 20c-6-4-8-12-6-20 2-10 2-22 6-28Z"/>',
    },
    Milka: L('Milka', { f: 'Georgia, serif', sz: 52, i: true }),
    Oreo: {
      vb: '0 0 100 100',
      svg:
        '<circle cx="50" cy="50" r="40" fill="CURRENT"/>' +
        '<circle cx="50" cy="50" r="26" fill="' + W + '"/>' +
        '<text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="900" fill="CURRENT">OREO</text>',
    },
    Doritos: {
      vb: '0 0 100 100',
      svg: '<path fill="CURRENT" d="M50 14l38 66H12Z"/>',
    },
    Hulu: L('hulu', { sz: 54, w: 900 }),
    'Prime Video': {
      vb: '0 0 140 100',
      svg:
        '<rect x="10" y="20" width="120" height="60" rx="10" fill="CURRENT"/>' +
        '<path fill="' + W + '" d="M58 38l26 12-26 12Z"/>',
    },
    'Disney+': {
      vb: '0 0 160 100',
      svg:
        '<text x="70" y="50" text-anchor="middle" dominant-baseline="central" font-family="Georgia, serif" font-style="italic" font-size="44" font-weight="800" fill="CURRENT">Disney</text>' +
        '<path fill="CURRENT" d="M126 40h10v10h10v10h-10v10h-10V60h-10V50h10Z"/>',
    },
    Zoom: {
      vb: '0 0 140 100',
      svg:
        '<rect x="14" y="28" width="76" height="44" rx="12" fill="CURRENT"/>' +
        '<path fill="CURRENT" d="M96 44l30-14v40l-30-14Z"/>',
    },
    Telegram: DISC(
      '<path fill="' + W + '" d="M28 50l44-16-16 38-10-12-8 10-2-14Zm14 6l22-12-16 18Z"/>'
    ),
    Adobe: {
      vb: '0 0 100 100',
      svg: '<path fill="CURRENT" d="M14 16h30L14 84Zm72 0H56l30 68ZM50 40l20 44H56l-6-16h-12Z"/>',
    },
    IBM: {
      vb: '0 0 160 100',
      svg:
        '<g fill="CURRENT"><rect x="16" y="26" width="128" height="7"/><rect x="16" y="40" width="128" height="7"/>' +
        '<rect x="16" y="54" width="128" height="7"/><rect x="16" y="68" width="128" height="7"/></g>' +
        '<text x="80" y="52" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="900" fill="' + W + '" stroke="' + W + '" stroke-width="6" paint-order="stroke">IBM</text>' +
        '<text x="80" y="52" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="900" fill="CURRENT">IBM</text>',
    },
    Intel: {
      vb: '0 0 160 100',
      svg:
        '<ellipse cx="80" cy="50" rx="70" ry="34" fill="none" stroke="CURRENT" stroke-width="7"/>' +
        '<text x="80" y="52" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" fill="CURRENT">intel</text>',
    },
    Samsung: {
      vb: '0 0 200 100',
      svg:
        '<ellipse cx="100" cy="50" rx="88" ry="30" fill="CURRENT"/>' +
        '<text x="100" y="52" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="800" fill="' + W + '">SAMSUNG</text>',
    },
    Microsoft: {
      vb: '0 0 100 100',
      svg:
        '<rect x="14" y="14" width="33" height="33" fill="CURRENT"/>' +
        '<rect x="53" y="14" width="33" height="33" fill="CURRENT" fill-opacity="0.75"/>' +
        '<rect x="14" y="53" width="33" height="33" fill="CURRENT" fill-opacity="0.75"/>' +
        '<rect x="53" y="53" width="33" height="33" fill="CURRENT" fill-opacity="0.55"/>',
    },
    TikTok: {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M58 12h14c2 12 9 19 20 20v14c-8 0-15-2-20-6v26c0 16-12 26-26 26S20 82 20 66s12-26 26-24v15c-6-2-12 3-12 9s5 11 12 11 12-5 12-12Z"/>',
    },
    'Google|the logo blue': {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M50 10a40 40 0 1 0 28 68l-11-11A25 25 0 1 1 50 25Z"/>' +
        '<path fill="' + GREY + '" d="M50 25a25 25 0 0 1 17 7l11-11A40 40 0 0 0 50 10Zm28 53a40 40 0 0 0 11-33H50v15h23a25 25 0 0 1-6 11Z"/>',
    },
    'Google|the logo yellow': {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M10 50a40 40 0 0 1 12-28l11 11a25 25 0 0 0 0 34l-11 11A40 40 0 0 1 10 50Z"/>' +
        '<path fill="' + GREY + '" d="M50 10a40 40 0 0 1 28 11l-11 11A25 25 0 0 0 33 33L22 22A40 40 0 0 1 50 10Zm0 80a40 40 0 0 1-28-12l11-11a25 25 0 0 0 40-12h16A40 40 0 0 1 50 90Z"/>',
    },
    'Google|the logo green': {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M50 90a40 40 0 0 1-28-12l11-11a25 25 0 0 0 34 0l11 11A40 40 0 0 1 50 90Z"/>' +
        '<path fill="' + GREY + '" d="M50 10a40 40 0 0 1 28 11l-11 11A25 25 0 0 0 33 33L22 22A40 40 0 0 1 50 10Zm39 30a40 40 0 0 1-11 38l-11-11A25 25 0 0 0 73 55H50V40Z"/>',
    },
    Emirates: L('Emirates', { f: 'Georgia, serif', sz: 42 }),
    Lufthansa: DISC(
      '<path fill="' + W + '" d="M46 22c7-4 15 1 15 9 0 4-2 7-5 9l6 38h-8l-6-28-9 16-7-5 12-19c-4-3-6-6-6-10 0-4 3-8 8-10Z"/>'
    ),
    Stripe: {
      vb: '0 0 100 100',
      svg:
        '<rect x="10" y="10" width="80" height="80" rx="18" fill="CURRENT"/>' +
        '<text x="50" y="54" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="46" font-weight="800" fill="' + W + '">S</text>',
    },
    WeChat: DISC(
      '<ellipse cx="40" cy="42" rx="22" ry="17" fill="' + W + '"/>' +
        '<ellipse cx="64" cy="60" rx="20" ry="16" fill="' + W + '"/>' +
        '<circle cx="33" cy="38" r="3" fill="CURRENT"/><circle cx="47" cy="38" r="3" fill="CURRENT"/>' +
        '<circle cx="58" cy="56" r="3" fill="CURRENT"/><circle cx="70" cy="56" r="3" fill="CURRENT"/>'
    ),
    Deliveroo: {
      vb: '0 0 100 100',
      svg: '<path fill="CURRENT" d="M58 12h18l-8 76H50l2-18-16 18H20l24-30-10-34h18l6 24Z"/>',
    },
    Ford: {
      vb: '0 0 180 100',
      svg:
        '<ellipse cx="90" cy="50" rx="78" ry="38" fill="CURRENT"/>' +
        '<ellipse cx="90" cy="50" rx="72" ry="32" fill="none" stroke="' + W + '" stroke-width="3"/>' +
        '<text x="90" y="52" text-anchor="middle" dominant-baseline="central" font-family="Georgia, serif" font-style="italic" font-size="38" font-weight="700" fill="' + W + '">Ford</text>',
    },
    LG: {
      vb: '0 0 100 100',
      svg:
        '<circle cx="50" cy="50" r="40" fill="CURRENT"/>' +
        '<text x="50" y="54" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="800" fill="' + W + '">LG</text>',
    },
    Dell: {
      vb: '0 0 100 100',
      svg:
        '<circle cx="50" cy="50" r="40" fill="none" stroke="CURRENT" stroke-width="6"/>' +
        '<text x="50" y="54" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="800" fill="CURRENT">DELL</text>',
    },
    Oracle: L('ORACLE', { sz: 40, w: 800, ls: 1 }),

    'Mercedes-Benz': {
      vb: '0 0 100 100',
      svg:
        '<circle cx="50" cy="50" r="40" fill="none" stroke="CURRENT" stroke-width="7"/>' +
        '<path stroke="CURRENT" stroke-width="7" stroke-linecap="round" d="M50 50V12M50 50 18 70M50 50l32 20"/>',
    },
    'Louis Vuitton': {
      vb: '0 0 100 100',
      svg:
        '<text x="50" y="54" text-anchor="middle" dominant-baseline="central" font-family="Georgia, serif" font-size="52" font-weight="700" fill="CURRENT">LV</text>' +
        '<circle cx="50" cy="50" r="44" fill="none" stroke="CURRENT" stroke-width="3"/>',
    },
    "Hershey's": {
      vb: '0 0 120 100',
      svg:
        '<path fill="CURRENT" d="M20 30h80v46H20Z"/>' +
        '<path stroke="' + W + '" stroke-width="3" d="M40 30v46M60 30v46M80 30v46M20 53h80"/>' +
        '<path fill="CURRENT" d="M20 30l10-10h80l-10 10Z"/>',
    },
    UPS: {
      vb: '0 0 100 100',
      svg:
        '<path fill="CURRENT" d="M50 10c18 4 30 8 30 8v34c0 20-16 32-30 38-14-6-30-18-30-38V18s12-4 30-8Z"/>' +
        '<text x="50" y="46" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="900" fill="#f5c518">UPS</text>' +
        '<path fill="#f5c518" d="M34 60c8 8 24 8 32 0-4 12-28 12-32 0Z"/>',
    },
    Olympics: {
      vb: '0 0 180 100',
      svg:
        '<g fill="none" stroke-width="7">' +
        '<circle cx="52" cy="40" r="24" stroke="CURRENT"/>' +
        '<circle cx="90" cy="40" r="24" stroke="' + GREY + '"/>' +
        '<circle cx="128" cy="40" r="24" stroke="' + GREY + '"/>' +
        '<circle cx="71" cy="62" r="24" stroke="' + GREY + '"/>' +
        '<circle cx="109" cy="62" r="24" stroke="' + GREY + '"/></g>',
    },
  };

  /* ---------- fallbacks ---------- */

  function initials(brand) {
    const clean = brand.replace(/[^A-Za-z0-9 &+-]/g, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return clean.slice(0, 2).toUpperCase();
    return parts
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  function lookup(brand, element) {
    const keyed = LOGOS[brand + '|' + element];
    if (keyed) return keyed;
    if (LOGOS[brand]) return LOGOS[brand];
    return TILE(initials(brand), { sz: 34 });
  }

  /** Returns an <svg> string for the given prompt, tinted with `color`. */
  function logoSvg(brand, element, color, cls) {
    const s = lookup(brand, element);
    return (
      `<svg class="${cls || 'logo'}" viewBox="${s.vb}" xmlns="http://www.w3.org/2000/svg" ` +
      `preserveAspectRatio="xMidYMid meet" role="img" aria-label="${brand} mark">` +
      s.svg.split('CURRENT').join(color) +
      '</svg>'
    );
  }

  root.ToonLogos = { logoSvg: logoSvg, has: (b, e) => !!(LOGOS[b + '|' + e] || LOGOS[b]) };
})(typeof window !== 'undefined' ? window : globalThis);
