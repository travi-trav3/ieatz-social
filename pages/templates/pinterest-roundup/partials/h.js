'use strict';
// Shared helpers and the style strings that repeat across partials.
// Every style string below is copied verbatim from the Claude Design export
// (PinterestRoundup.template.html / .example.html). Do not "tidy" them: the
// golden test compares them against the export element by element.

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attr(s) {
  return esc(s);
}

// Inline markup used in a handful of editorial fields (bridge body):
//   *text*   -> Instrument Serif italic emphasis
//   ==text== -> green highlight
// Everything else is escaped. No other HTML is ever accepted from content.
function inline(s) {
  let out = esc(s);
  out = out.replace(/==([^=]+)==/g, '<span style="background:rgba(31,139,76,0.16);border-radius:4px;padding:1px 5px;font-weight:600">$1</span>');
  out = out.replace(/\*([^*]+)\*/g, "<em style=\"font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:1.22em;letter-spacing:-0.01em\">$1</em>");
  return out;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function plural(n, one, many) {
  return n === 1 ? one : many;
}

const S = {
  eyebrowRow: 'display:flex;align-items:center;gap:12px',
  eyebrowBar: 'display:block;width:34px;height:3px;border-radius:2px;background:var(--accent)',
  eyebrowText: 'font-weight:600;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:var(--accent)',
  eyebrowTextMuted: 'font-weight:600;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#5C625E',
  serif: "font-family:'Instrument Serif',Georgia,serif",
  mono: "font-family:'JetBrains Mono',monospace",
  container: 'max-width:1140px;margin:0 auto',
  card: 'background:#FFFFFF;border-radius:22px;border:1px solid rgba(10,15,12,0.06);box-shadow:0 1px 2px rgba(14,74,42,.04),0 2px 6px rgba(14,74,42,.05)',
  ctaDark: 'display:inline-flex;align-items:center;gap:9px;background:#0E4A2A;color:#F5F2EA;font-weight:600;font-size:15px;letter-spacing:-0.005em;padding:12px 22px;border-radius:999px;text-decoration:none;box-shadow:0 2px 6px rgba(14,74,42,.18)',
  ctaLight: 'display:inline-flex;align-items:center;gap:9px;background:#F5F2EA;color:#0E4A2A;font-weight:600;font-size:17px;padding:16px 28px;border-radius:999px;text-decoration:none',
  ctaPlay: 'display:inline-flex;align-items:center;gap:10px;height:54px;padding:0 22px;background:#0A0F0C;color:#FFFFFF;border-radius:10px;text-decoration:none',
};

// Sections are a whitelist. Unknown tokens are rejected by the schema.
const SECTION_ORDERS = {
  // v0.3 advertorial: pain-led hero carrying the direct answer, then the app
  // module, then the recipes. The export renders this order.
  advertorial: ['hero', 'short_answer', 'bridge', 'jump_list', 'items', 'supporting', 'faq', 'related'],
  // Utility: recipes before the app module. The short answer never moves
  // away from the hero (REVISIONS v0.3.1 constraint).
  utility: ['hero', 'short_answer', 'jump_list', 'items', 'bridge', 'supporting', 'faq', 'related'],
};

module.exports = { esc, attr, inline, pad2, plural, S, SECTION_ORDERS };
