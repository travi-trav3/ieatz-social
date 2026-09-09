'use strict';
const { esc, S } = require('./h');
const { logoMark } = require('./sticky-header');

// SECTION 7. On-page answers must match the FAQPage schema word for word;
// both read from the same field, so they cannot drift.
function render(site, page) {
  const items = page.faq
    .map(
      (f) => `<div style="padding:26px 0;border-top:1px solid rgba(10,15,12,0.08)">
<h3 style="font-size:20px;font-weight:600;letter-spacing:-0.01em;margin:0;color:#0A0F0C">${esc(f.q)}</h3>
<p style="font-size:17px;line-height:1.55;color:#5C625E;margin:10px 0 0;text-wrap:pretty">${esc(f.a)}</p>
</div>`
    )
    .join('\n');
  return `<section style="max-width:900px;margin:0 auto;padding:76px 28px 0">
<div style="${S.eyebrowRow}">${logoMark(site, 20, 'opacity:0.85')}<span style="${S.eyebrowText}">Questions</span></div>
<h2 style="${S.serif};font-weight:400;font-size:clamp(30px,3.4vw,44px);line-height:1.04;letter-spacing:-0.014em;margin:18px 0 26px;color:#0A0F0C">Asked and answered</h2>
${items}
</section>`;
}

module.exports = { render };
