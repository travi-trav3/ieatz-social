'use strict';
const { esc, attr, S, pad2 } = require('./h');

// SECTION 4. The visible mirror of the ItemList schema.
function render(site, page) {
  const rows = page.recipes
    .map(
      (r, i) => `<li style="display:flex;align-items:baseline;gap:16px;padding:11px 0;border-top:1px solid rgba(10,15,12,0.06)">
<span style="${S.serif};font-style:italic;font-size:21px;color:var(--accent);min-width:26px">${pad2(i + 1)}</span>
<a href="#${attr(r.anchor)}" class="jump-link" data-anchor-name="${attr(r.name)}" style="font-size:19px;font-weight:500;letter-spacing:-0.01em;color:#0A0F0C;text-decoration:none">${esc(r.name)}</a>
<span style="font-size:13px;color:#9CA29F;margin-left:auto;white-space:nowrap">${r.time_minutes} min &middot; ${r.protein_g}g</span>
</li>`
    )
    .join('\n');
  return `<section style="max-width:1140px;margin:0 auto;padding:76px 28px 0">
<div style="${S.eyebrowRow}"><span style="${S.eyebrowBar}"></span><span style="${S.eyebrowText}">Now, what the pin promised</span></div>
<h2 style="${S.serif};font-weight:400;font-size:clamp(32px,3.8vw,50px);line-height:1.03;letter-spacing:-0.016em;margin:18px 0 0;color:#0A0F0C;max-width:24ch">${esc(page.list_headline)}</h2>
<ol style="list-style:none;margin:32px 0 0;padding:26px 30px;display:grid;gap:2px;${S.card}">
${rows}
</ol>
</section>`;
}

module.exports = { render };
