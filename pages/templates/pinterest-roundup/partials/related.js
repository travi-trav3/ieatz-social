'use strict';
const { esc, attr, S } = require('./h');

// SECTION 8. Two to four links. Renders nothing when the list is empty.
function render(site, page) {
  const links = page.internal_links || [];
  if (!links.length) return '';
  const cards = links
    .map(
      (l) => `<a href="${attr(l.url)}" class="link-card" style="display:block;background:#FFFFFF;border:1px solid rgba(10,15,12,0.06);border-radius:20px;padding:24px;text-decoration:none;box-shadow:0 1px 2px rgba(14,74,42,.04)">
<span style="display:block;width:26px;height:2px;border-radius:2px;background:var(--accent)"></span>
<span style="display:block;${S.serif};font-size:24px;line-height:1.14;letter-spacing:-0.012em;color:#0A0F0C;margin-top:16px">${esc(l.title)}</span>
<span style="display:block;font-size:13px;color:#9CA29F;margin-top:10px">${esc(l.meta || '')}</span>
</a>`
    )
    .join('\n');
  return `<section style="max-width:1140px;margin:0 auto;padding:76px 28px 0">
<span style="${S.eyebrowTextMuted}">Keep going</span>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-top:20px">
${cards}
</div>
</section>`;
}

module.exports = { render };
