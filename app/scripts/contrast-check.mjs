// scripts/contrast-check.mjs
// WCAG 2.1 Contrast Formula Verification for Graphite Blueprint Design Tokens

function parseHex(hex) {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance([r8, g8, b8]) {
  const rs = r8 / 255;
  const gs = g8 / 255;
  const bs = b8 / 255;

  const r = rs <= 0.04045 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
  const g = gs <= 0.04045 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
  const b = bs <= 0.04045 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(parseHex(hex1));
  const l2 = relativeLuminance(parseHex(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const tokens = {
  bgCanvas: '#131211',
  bgSurface: '#1B1A18',
  bgRaised: '#242220',
  text: '#ECE8E1',
  textMuted: '#A39E94',
  textDim: '#8A857B',
  accent: '#FFB02E',
  accentText: '#131211',
  info: '#5CC8E8',
  danger: '#FF6B5E',
  ok: '#6FD08C',
  pbrAo: '#F08A8A',
  pbrRough: '#6FD08C',
  pbrMetal: '#5CB6F0',
  pbrHeight: '#F5C84C',
  pbrNormal: '#4CC9C0',
  pbrPacked: '#B79CF5',
};

const checks = [
  { fg: tokens.text, bg: tokens.bgSurface, name: '--text on --bg-surface', min: 4.5 },
  { fg: tokens.text, bg: tokens.bgRaised, name: '--text on --bg-raised', min: 4.5 },
  { fg: tokens.textMuted, bg: tokens.bgSurface, name: '--text-muted on --bg-surface', min: 4.5 },
  { fg: tokens.textMuted, bg: tokens.bgRaised, name: '--text-muted on --bg-raised', min: 4.5 },
  { fg: tokens.accentText, bg: tokens.accent, name: 'black text on --accent (amber button)', min: 4.5 },
  { fg: tokens.accent, bg: tokens.bgSurface, name: '--accent on --bg-surface (UI element)', min: 3.0 },
  { fg: tokens.info, bg: tokens.bgSurface, name: '--info on --bg-surface', min: 4.5 },
  { fg: tokens.danger, bg: tokens.bgSurface, name: '--danger on --bg-surface', min: 4.5 },
  { fg: tokens.ok, bg: tokens.bgSurface, name: '--ok on --bg-surface', min: 4.5 },
  // PBR Sockets on surface
  { fg: tokens.pbrAo, bg: tokens.bgSurface, name: 'PBR AO on --bg-surface', min: 4.5 },
  { fg: tokens.pbrRough, bg: tokens.bgSurface, name: 'PBR Rough on --bg-surface', min: 4.5 },
  { fg: tokens.pbrMetal, bg: tokens.bgSurface, name: 'PBR Metal on --bg-surface', min: 4.5 },
  { fg: tokens.pbrHeight, bg: tokens.bgSurface, name: 'PBR Height on --bg-surface', min: 4.5 },
  { fg: tokens.pbrNormal, bg: tokens.bgSurface, name: 'PBR Normal on --bg-surface', min: 4.5 },
  { fg: tokens.pbrPacked, bg: tokens.bgSurface, name: 'PBR Packed on --bg-surface', min: 4.5 },
];

let failed = 0;
console.log('=== WCAG 2.1 Contrast Check (Graphite Blueprint) ===\n');

for (const check of checks) {
  const ratio = contrastRatio(check.fg, check.bg);
  const ratioFormatted = ratio.toFixed(2) + ':1';
  const passed = ratio >= check.min;

  if (passed) {
    console.log(`[PASS] ${check.name.padEnd(42)} ${ratioFormatted} (min: ${check.min}:1)`);
  } else {
    console.error(`[FAIL] ${check.name.padEnd(42)} ${ratioFormatted} (min: ${check.min}:1)`);
    failed++;
  }
}

console.log(`\nResults: ${checks.length - failed}/${checks.length} passed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All declared color tokens meet or exceed WCAG AA requirements.\n');
  process.exit(0);
}
