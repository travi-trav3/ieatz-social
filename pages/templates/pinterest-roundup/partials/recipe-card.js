'use strict';
const { esc, attr, S, pad2, plural } = require('./h');

// SECTION 5, AXIS 2 = mirror: odd items text-left on cream, even items
// media-left on off-white. Index is 0-based here; "odd" means index % 2 === 0.

function chips(r) {
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:20px">
<span style="font-size:13px;font-weight:500;color:#0E4A2A;background:#E6F4EC;border-radius:999px;padding:7px 14px">${r.time_minutes} ${plural(r.time_minutes, 'minute', 'minutes')}</span>
<span style="font-size:13px;font-weight:500;color:#0E4A2A;background:#E6F4EC;border-radius:999px;padding:7px 14px">${r.servings} ${plural(r.servings, 'serving', 'servings')}</span>
<span style="font-size:13px;font-weight:600;color:#FFFFFF;background:var(--accent);border-radius:999px;padding:7px 14px">${r.protein_g}g protein</span>
</div>`;
}

function textColumn(r, i) {
  const ingredients = r.ingredients
    .map((t) => `<li style="display:flex;gap:12px;font-size:17px;line-height:1.45;color:#0A0F0C"><span style="color:var(--accent);flex:none">&middot;</span><span>${esc(t)}</span></li>`)
    .join('\n');
  const steps = r.steps
    .map(
      (t, j) =>
        `<li style="display:flex;gap:15px;font-size:17px;line-height:1.55;color:#5C625E"><span style="${S.serif};font-style:italic;font-size:19px;color:#9CA29F;flex:none;line-height:1.4">${pad2(j + 1)}</span><span>${esc(t)}</span></li>`
    )
    .join('\n');
  const body = r.body
    ? `\n<p style="font-size:17px;line-height:1.55;color:#5C625E;margin:22px 0 0;max-width:52ch;text-wrap:pretty">${esc(r.body)}</p>`
    : '';
  return `<div>
<div style="display:flex;align-items:center;gap:14px">
<span style="${S.serif};font-style:italic;font-size:44px;line-height:0.9;color:var(--accent)">${pad2(i + 1)}</span>
<span style="display:block;flex:1;height:1px;background:rgba(10,15,12,0.10)"></span>
</div>
<h2 style="${S.serif};font-weight:400;font-size:clamp(30px,3.2vw,42px);line-height:1.05;letter-spacing:-0.014em;margin:16px 0 0;color:#0A0F0C;text-wrap:balance">${esc(r.name)}</h2>
${chips(r)}${body}
<div style="margin-top:30px">
<span style="${S.eyebrowTextMuted}">Ingredients</span>
<ul style="list-style:none;margin:14px 0 0;padding:0;display:grid;gap:9px">
${ingredients}
</ul>
</div>
<div style="margin-top:30px">
<span style="${S.eyebrowTextMuted}">Method</span>
<ol style="margin:14px 0 0;padding:0;list-style:none;display:grid;gap:15px">
${steps}
</ol>
</div>
<p style="margin:30px 0 0;padding:20px 22px;background:#FFFFFF;border-left:3px solid var(--accent);border-radius:0 14px 14px 0;font-size:16px;line-height:1.55;color:#5C625E;text-wrap:pretty;box-shadow:0 1px 2px rgba(14,74,42,.04)"><strong style="color:#0E4A2A;font-weight:600">Why it works. </strong>${esc(r.why_it_works)}</p>
</div>`;
}

// Photo-free variant of the 2:3 pin slot: the same gradient card the export
// draws, with the item number and name set in serif. No dashed border, no
// mono placeholder copy.
function typographicTile(r, i) {
  return `<div data-slot="recipe-photo" style="aspect-ratio:2/3;width:100%;max-width:320px;border-radius:22px;background:linear-gradient(165deg,#F2FAF6,#E6F4EC);display:flex;flex-direction:column;justify-content:flex-end;gap:12px;padding:24px;box-shadow:0 1px 2px rgba(14,74,42,.04),0 2px 6px rgba(14,74,42,.05)">
<span style="${S.serif};font-style:italic;font-size:96px;line-height:0.8;color:var(--accent);opacity:0.28">${pad2(i + 1)}</span>
<span style="${S.serif};font-size:28px;line-height:1.08;letter-spacing:-0.012em;color:#0E4A2A;text-wrap:balance">${esc(r.name)}</span>
<span style="font-size:13px;color:#5C625E">${r.time_minutes} min &middot; ${r.servings} ${plural(r.servings, 'serving', 'servings')} &middot; ${r.protein_g}g protein</span>
</div>`;
}

function mediaColumn(r, i) {
  const inner =
    r.image && r.image.src
      ? `<div data-slot="recipe-photo" style="aspect-ratio:2/3;width:100%;max-width:320px;border-radius:22px;overflow:hidden;background:#E6F4EC;box-shadow:0 2px 6px rgba(14,74,42,.05),0 8px 24px rgba(14,74,42,.07)"><img src="${attr(r.image.src)}" alt="${attr(r.image.alt || r.alt)}" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy"></div>`
      : typographicTile(r, i);
  return `<div style="display:flex;justify-content:center">\n${inner}\n</div>`;
}

function render(site, page, r, i) {
  const mediaLeft = i % 2 === 1;
  const sectionStyle = mediaLeft
    ? 'background:#FBFAF6;border-top:1px solid rgba(10,15,12,0.05);border-bottom:1px solid rgba(10,15,12,0.05)'
    : 'background:#F5F2EA';
  const cols = mediaLeft ? [mediaColumn(r, i), textColumn(r, i)] : [textColumn(r, i), mediaColumn(r, i)];
  return `<section style="${sectionStyle}">
<article id="${attr(r.anchor)}" style="max-width:1140px;margin:0 auto;padding:56px 28px;scroll-margin-top:84px">
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:44px;align-items:start">
${cols.join('\n')}
</div>
</article>
</section>`;
}

module.exports = { render };
