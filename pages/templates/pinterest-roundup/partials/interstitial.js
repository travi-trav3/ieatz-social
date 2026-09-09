'use strict';
const { esc, attr, S } = require('./h');
const { iosAttrs } = require('./links');

// AXIS 3. Two per page at ~40% and ~80% through the items, never the same
// style twice on one page. Positions are computed, so the pacing holds at
// any item count.
function positions(n) {
  const a = Math.max(1, Math.round(n * 0.4));
  let b = Math.max(1, Math.round(n * 0.8));
  if (b <= a) b = Math.min(n - 1, a + 1);
  if (n <= 2) return [1];
  return [a, b].filter((p) => p >= 1 && p < n);
}

const UNIVERSAL_BAND_LINE = 'Three things you already have. That is the whole input.';

function ctaLight(site, position) {
  return `<a ${iosAttrs(site, position)} class="cta-light" style="${S.ctaLight}">Get the free app<span>&rarr;</span></a>`;
}

function photoBand(site, block) {
  const img = block.image && block.image.src;
  const bg = img
    ? `<img src="${attr(block.image.src)}" alt="${attr(block.image.alt || '')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">\n<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,49,27,0.9),rgba(8,49,27,0.5))"></div>`
    : '';
  const sectionStyle = img
    ? 'position:relative;min-height:340px;display:flex;align-items:center;overflow:hidden'
    : 'position:relative;min-height:340px;display:flex;align-items:center;overflow:hidden;background:#08311B';
  const caption = site.show_play_store ? 'iOS and Android. Free to try.' : 'Free to try.';
  return `<section style="${sectionStyle}">
${bg}
<div style="position:relative;max-width:1140px;margin:0 auto;padding:60px 28px;width:100%">
<p style="${S.serif};font-size:clamp(28px,3.4vw,44px);line-height:1.08;letter-spacing:-0.014em;color:#F5F2EA;margin:0;max-width:22ch;text-wrap:balance">${esc(block.line || UNIVERSAL_BAND_LINE)}</p>
<div style="display:flex;flex-wrap:wrap;align-items:center;gap:16px;margin-top:28px">
${ctaLight(site, 'photo_break')}
<span style="font-size:15px;color:#E6F4EC;opacity:0.85">${caption}</span>
</div>
</div>
</section>`;
}

function darkStrip(site, block) {
  return `<section style="background:#0E4A2A;padding:40px 28px">
<div style="max-width:1140px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px">
<p style="${S.serif};font-size:clamp(24px,2.6vw,32px);line-height:1.15;color:#F5F2EA;margin:0;max-width:26ch">${esc(block.line)}</p>
<a ${iosAttrs(site, 'mid_strip')} class="cta-light" style="${S.ctaLight};flex:none">Get the free app<span>&rarr;</span></a>
</div>
</section>`;
}

function pullQuote(site, block, resolved) {
  const q = resolved.quote;
  return `<section style="background:#E3EDD9;padding:64px 28px">
<div style="max-width:820px;margin:0 auto;text-align:center">
<p style="${S.serif};font-style:italic;font-size:clamp(28px,3.4vw,44px);line-height:1.14;letter-spacing:-0.014em;color:#0E4A2A;margin:0;text-wrap:balance">${esc(q.quote)}</p>
<p style="font-size:14px;letter-spacing:0.02em;color:#0E4A2A;opacity:0.7;margin:22px 0 0">${esc(q.author)}</p>
<a ${iosAttrs(site, 'mid_strip')} class="cta-dark" style="display:inline-flex;align-items:center;gap:9px;margin-top:28px;background:#0E4A2A;color:#F5F2EA;font-weight:600;font-size:17px;padding:16px 28px;border-radius:999px;text-decoration:none">Get the free app<span>&rarr;</span></a>
</div>
</section>`;
}

function stat(site, block, resolved) {
  const s = resolved.stat;
  return `<section style="background:#0E4A2A;padding:64px 28px">
<div style="max-width:1140px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:32px;align-items:center">
<div>
<span style="${S.serif};font-style:italic;font-size:clamp(72px,10vw,150px);line-height:0.86;letter-spacing:-0.03em;color:#61CA8C;display:block">${esc(s.value)}</span>
<span style="display:block;font-weight:600;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#BBE3C8;margin-top:18px">${esc(s.label)}</span>
</div>
<div>
<p style="${S.serif};font-size:clamp(24px,2.6vw,34px);line-height:1.16;color:#F5F2EA;margin:0;max-width:26ch;text-wrap:balance">${esc(block.line)}</p>
${ctaLight(site, 'mid_strip')}
</div>
</div>
</section>`;
}

function render(site, block, resolved) {
  switch (block.style) {
    case 'photo_band':
      return photoBand(site, block);
    case 'dark_strip':
      return darkStrip(site, block);
    case 'pull_quote':
      return pullQuote(site, block, resolved);
    case 'stat':
      return stat(site, block, resolved);
    default:
      throw new Error(`Unknown interstitial style: ${block.style}`);
  }
}

module.exports = { render, positions, UNIVERSAL_BAND_LINE };
