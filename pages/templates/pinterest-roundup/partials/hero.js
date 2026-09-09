'use strict';
const { esc, attr, S, pad2 } = require('./h');

// AXIS 1 = portrait_inset (the rendered default in the export). The other
// hero compositions in the scaffold's <template> library are not wired yet;
// the schema only accepts "portrait_inset" until they are.

function eyebrow(text) {
  return `<div style="${S.eyebrowRow}"><span style="${S.eyebrowBar}"></span><span style="${S.eyebrowText}">${esc(text)}</span></div>`;
}

// Photo-free variant: the 2:3 hero slot becomes a typographic menu card that
// lists the recipes. Same box, same shadow, no placeholder text, no dashed
// border. It has to look finished.
function menuCard(page) {
  const rows = page.recipes
    .map(
      (r, i) =>
        `<li style="display:flex;gap:12px;align-items:baseline;padding:9px 0;border-top:1px solid rgba(14,74,42,0.12)"><span style="${S.serif};font-style:italic;font-size:20px;color:var(--accent);min-width:26px">${pad2(i + 1)}</span><span style="${S.serif};font-size:21px;line-height:1.15;letter-spacing:-0.01em;color:#0E4A2A">${esc(r.name)}</span></li>`
    )
    .join('\n');
  return `<div style="width:100%;max-width:380px;aspect-ratio:2/3;border-radius:26px;overflow:hidden;box-shadow:0 8px 24px rgba(14,74,42,.08),0 32px 72px rgba(14,74,42,.14);background:linear-gradient(165deg,#F2FAF6,#E6F4EC);display:flex;flex-direction:column;justify-content:flex-end;padding:26px">
<span style="display:block;width:34px;height:3px;border-radius:2px;background:var(--accent)"></span>
<ol style="list-style:none;margin:18px 0 0;padding:0">
${rows}
</ol>
</div>`;
}

function media(page) {
  const h = page.hero;
  const parts = [];
  if (h.image && h.image.src) {
    parts.push(
      `<div style="width:100%;max-width:380px;aspect-ratio:2/3;border-radius:26px;overflow:hidden;box-shadow:0 8px 24px rgba(14,74,42,.08),0 32px 72px rgba(14,74,42,.14);background:#E6F4EC"><img src="${attr(h.image.src)}" alt="${attr(h.image.alt)}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`
    );
  } else {
    parts.push(menuCard(page));
  }
  if (h.inset_image && h.inset_image.src) {
    parts.push(
      `<div style="position:absolute;left:-14px;bottom:0;width:152px;aspect-ratio:3/4;border-radius:18px;overflow:hidden;border:5px solid #F5F2EA;box-shadow:0 4px 12px rgba(14,74,42,.10)"><img src="${attr(h.inset_image.src)}" alt="${attr(h.inset_image.alt)}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`
    );
  }
  if (h.time_stamp) {
    parts.push(
      `<span style="position:absolute;right:6px;bottom:6px;background:#F5F2EA;border-radius:999px;padding:8px 14px;${S.mono};font-size:11px;color:var(--accent-ink);box-shadow:0 2px 6px rgba(14,74,42,.10)">${esc(h.time_stamp)}</span>`
    );
  }
  return `<div style="position:relative;padding:0 0 46px 0;justify-self:center">\n${parts.join('\n')}\n</div>`;
}

function render(site, page) {
  const h = page.hero;
  const openers = h.opener
    .map((p, i) => `<p style="font-size:20px;line-height:1.55;color:#5C625E;margin:${i === 0 ? '26px' : '16px'} 0 0;max-width:50ch;text-wrap:pretty">${esc(p)}</p>`)
    .join('\n');
  return `<section style="max-width:1140px;margin:0 auto;padding:64px 28px 8px;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:56px;align-items:center">
<div style="max-width:600px">
${eyebrow(h.eyebrow)}
<h1 style="${S.serif};font-weight:400;font-size:clamp(40px,5vw,68px);line-height:1.0;letter-spacing:-0.018em;margin:20px 0 0;color:#0A0F0C;text-wrap:balance">${esc(page.h1)}</h1>
${openers}
<p style="${S.serif};font-style:italic;font-size:clamp(26px,2.6vw,34px);line-height:1.2;letter-spacing:-0.01em;color:var(--accent-ink);margin:30px 0 0;max-width:26ch">${esc(h.pain_line)}</p>
</div>
${media(page)}
</section>`;
}

// SECTION 2. Stays glued to the hero in every section order.
function shortAnswer(site, page) {
  return `<section style="max-width:1140px;margin:0 auto;padding:44px 28px 0">
<div style="${S.card};padding:28px 32px;max-width:820px">
<span style="${S.eyebrowTextMuted}">The short answer</span>
<p style="font-size:19px;line-height:1.55;color:#0A0F0C;margin:14px 0 0;text-wrap:pretty">${esc(page.hero.direct_answer)}</p>
</div>
</section>`;
}

module.exports = { render, shortAnswer, eyebrow };
