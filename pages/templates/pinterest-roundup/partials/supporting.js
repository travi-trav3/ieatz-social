'use strict';
const { esc, attr, S } = require('./h');

// SECTION 6. Rotates by type across pages. A section with rows renders the
// table; a prose section renders body paragraphs only.

function rows(list) {
  if (!list || !list.length) return '';
  const inner = list
    .map(
      (row) => `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px 20px;padding:18px 22px;border-top:1px solid rgba(10,15,12,0.06);align-items:center">
<span style="font-size:16px;font-weight:500;color:#0A0F0C">${esc(row.label)}</span>
<span style="${S.serif};font-style:italic;font-size:28px;line-height:1;color:var(--accent)">${esc(row.value)}</span>
<span style="font-size:15px;color:#5C625E">${esc(row.note)}</span>
</div>`
    )
    .join('\n');
  return `<div style="margin-top:28px;background:#FFFFFF;border-radius:22px;border:1px solid rgba(10,15,12,0.06);overflow:hidden;box-shadow:0 1px 2px rgba(14,74,42,.04),0 2px 6px rgba(14,74,42,.05)">\n${inner}\n</div>`;
}

function images(list) {
  if (!list || !list.length) return '';
  const ratios = ['1/1', '4/5'];
  const inner = list
    .slice(0, 2)
    .map(
      (img, i) =>
        `<div style="width:100%;max-width:280px;border-radius:22px;overflow:hidden;box-shadow:0 2px 6px rgba(14,74,42,.05),0 8px 24px rgba(14,74,42,.07)"><img src="${attr(img.src)}" alt="${attr(img.alt)}" style="width:100%;display:block;aspect-ratio:${ratios[i]};object-fit:cover" loading="lazy"></div>`
    )
    .join('\n');
  return `<div style="display:grid;gap:16px;justify-items:center;align-content:start">\n${inner}\n</div>`;
}

function bodyParagraphs(body) {
  const paras = Array.isArray(body) ? body : [body];
  return paras
    .map((p) => `<p style="font-size:18px;line-height:1.55;color:#5C625E;margin:18px 0 0;max-width:56ch;text-wrap:pretty">${esc(p)}</p>`)
    .join('\n');
}

function render(site, page, sec) {
  const imgs = images(sec.images);
  const footnote = sec.footnote ? `\n<p style="font-size:14px;line-height:1.55;color:#9CA29F;margin:14px 0 0">${esc(sec.footnote)}</p>` : '';
  const text = `<div>
<div style="${S.eyebrowRow}"><span style="${S.eyebrowBar}"></span><span style="${S.eyebrowText}">${esc(sec.eyebrow)}</span></div>
<h2 style="${S.serif};font-weight:400;font-size:clamp(30px,3.4vw,44px);line-height:1.04;letter-spacing:-0.014em;margin:18px 0 0;color:#0A0F0C;text-wrap:balance">${esc(sec.heading)}</h2>
${bodyParagraphs(sec.body)}
${rows(sec.rows)}${footnote}
</div>`;
  return `<section style="max-width:1140px;margin:0 auto;padding:76px 28px 0">
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:44px;align-items:start">
${text}
${imgs}
</div>
</section>`;
}

module.exports = { render };
