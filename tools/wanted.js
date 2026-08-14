/* Brands the game wants but has no real artwork for.
 *
 * These are NOT in api/_brands.js — a brand only joins the game once its mark
 * exists, so nothing here can come up in a round yet. Drop a matching SVG into
 * tools/logos-src/ (see the README there), run `node tools/add-logos.js`, and
 * it prints the row to paste into api/_brands.js.
 *
 * `hex` is the colour the round is scored against, so it has to be right. The
 * values below for previously-shipped brands are the ones the game already
 * used. The Malaysian entries are marked `needsHex` — nobody has verified them
 * against the brand's own guidelines yet, and a wrong value silently punishes
 * correct answers, so add-logos.js refuses to suggest a row until one is set.
 */
module.exports = [
  // ---- dropped when the game moved to real artwork only ----
  // simple-icons has never carried these, at any version.
  { brand: 'LEGO', element: 'the logo red', emoji: '🧱', hex: '#D01012', tier: 1, search: 'LEGO logo' },
  { brand: 'Barbie', element: 'the box pink', emoji: '💖', hex: '#E0218A', tier: 1, search: 'Barbie logo' },
  { brand: 'Tiffany & Co.', element: 'the box blue', emoji: '💍', hex: '#0ABAB5', tier: 1, search: 'Tiffany and Co logo' },
  { brand: 'The Home Depot', element: 'the logo orange', emoji: '🔨', hex: '#F96302', tier: 1, search: 'The Home Depot logo' },
  { brand: 'Cadbury', element: 'the wrapper purple', emoji: '🍫', hex: '#4A2683', tier: 1, search: 'Cadbury logo' },
  { brand: 'Fanta', element: 'the logo orange', emoji: '🍊', hex: '#FF8300', tier: 1, search: 'Fanta logo' },
  { brand: 'Subway', element: 'the logo green', emoji: '🥪', hex: '#009A44', tier: 2, search: 'Subway restaurants logo' },
  { brand: "Domino's", element: 'the logo blue', emoji: '🍕', hex: '#006491', tier: 2, search: "Domino's Pizza logo" },
  { brand: "Dunkin'", element: 'the logo pink', emoji: '🍩', hex: '#DA1884', tier: 2, search: "Dunkin' logo" },
  { brand: 'Heineken', element: 'the bottle green', emoji: '🍺', hex: '#00843D', tier: 2, search: 'Heineken logo' },
  { brand: 'Monster Energy', element: 'the claw green', emoji: '🥤', hex: '#84C226', tier: 2, search: 'Monster Energy logo' },
  { brand: 'Gatorade', element: 'the classic orange', emoji: '🧃', hex: '#FF6600', tier: 2, search: 'Gatorade logo' },
  { brand: 'Rolex', element: 'the crown green', emoji: '⌚', hex: '#006039', tier: 2, search: 'Rolex logo' },
  { brand: 'National Geographic', element: 'the yellow frame', emoji: '📸', hex: '#FFCC00', tier: 2, search: 'National Geographic logo' },
  { brand: 'Best Buy', element: 'the price tag yellow', emoji: '🔌', hex: '#FFF200', tier: 2, search: 'Best Buy logo' },
  { brand: 'Costco', element: 'the logo red', emoji: '🛒', hex: '#E31837', tier: 2, search: 'Costco Wholesale logo' },
  { brand: 'Milka', element: 'the wrapper lilac', emoji: '🐄', hex: '#7D69AC', tier: 2, search: 'Milka logo' },
  { brand: 'Oreo', element: 'the pack blue', emoji: '🍪', hex: '#0057B8', tier: 2, search: 'Oreo logo' },
  { brand: 'Doritos', element: 'the Nacho Cheese red', emoji: '🌽', hex: '#C8102E', tier: 2, search: 'Doritos logo' },
  { brand: 'Disney+', element: 'the logo blue', emoji: '🏰', hex: '#0063E5', tier: 2, search: 'Disney Plus logo' },
  { brand: 'Louis Vuitton', element: 'the monogram canvas brown', emoji: '👜', hex: '#4E3524', tier: 3, search: 'Louis Vuitton logo' },
  { brand: "Hershey's", element: 'the wrapper brown', emoji: '🍫', hex: '#7B3F00', tier: 3, search: "Hershey's logo" },
  // The rings are protected in their own right (Nairobi Treaty), separately
  // from copyright — worth a look before shipping this one.
  { brand: 'Olympics', element: 'the top-left ring blue', emoji: '🥇', hex: '#0081C8', tier: 3, search: 'Olympic rings' },

  // ---- Malaysian household names, none of them in simple-icons ----
  // Watch for name collisions: simple-icons' KTM is the Austrian motorcycle
  // firm, Proton the Swiss email company, Astro the JavaScript framework and
  // Boost the US carrier. None is the Malaysian brand.
  { brand: 'Petronas', element: 'the logo teal', emoji: '⛽', hex: '#00A19C', tier: 1, search: 'Petronas logo' },
  { brand: 'Maybank', element: 'the tiger yellow', emoji: '🏦', hex: null, needsHex: true, tier: 1, search: 'Maybank logo' },
  { brand: "Touch 'n Go", element: 'the logo blue', emoji: '🚗', hex: null, needsHex: true, tier: 1, search: "Touch 'n Go logo" },
  { brand: 'Malaysia Airlines', element: 'the wau red', emoji: '✈️', hex: null, needsHex: true, tier: 2, search: 'Malaysia Airlines logo' },
  { brand: 'Maxis', element: 'the logo green', emoji: '📶', hex: null, needsHex: true, tier: 2, search: 'Maxis Communications logo' },
  { brand: 'CelcomDigi', element: 'the logo yellow', emoji: '📱', hex: null, needsHex: true, tier: 2, search: 'CelcomDigi logo' },
  { brand: 'Perodua', element: 'the logo green', emoji: '🚙', hex: null, needsHex: true, tier: 2, search: 'Perodua logo' },
  { brand: 'Proton Holdings', element: 'the logo blue', emoji: '🚗', hex: null, needsHex: true, tier: 2, search: 'Proton Holdings logo' },
  { brand: 'Tenaga Nasional', element: 'the logo blue', emoji: '⚡', hex: null, needsHex: true, tier: 2, search: 'Tenaga Nasional logo' },
  { brand: 'Milo', element: 'the tin green', emoji: '🍫', hex: null, needsHex: true, tier: 2, search: 'Milo drink logo' },
  { brand: 'Genting', element: 'the logo red', emoji: '🎰', hex: null, needsHex: true, tier: 3, search: 'Genting Group logo' },
  { brand: 'Astro Malaysia', element: 'the logo orange', emoji: '📺', hex: null, needsHex: true, tier: 3, search: 'Astro Malaysia logo' },
];
