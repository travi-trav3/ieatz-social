'use strict';
const { esc, attr, inline, S, pad2 } = require('./h');
const { iosAttrs, androidAttrs } = require('./links');

// SECTION 3: value prop + in-app UI. The three beats are universal copy and
// default from the site facts file; a page may override them but the
// validator checks the axis either way.

function beats(list) {
  return list
    .map(
      (b, i) => `<div style="background:#FFFFFF;border-radius:22px;padding:30px;box-shadow:0 2px 6px rgba(14,74,42,.05),0 8px 24px rgba(14,74,42,.07)">
<span style="${S.serif};font-style:italic;font-size:34px;line-height:1;color:var(--accent)">${pad2(i + 1)}</span>
<h3 style="${S.serif};font-weight:400;font-size:28px;line-height:1.12;letter-spacing:-0.012em;margin:14px 0 0;color:#0A0F0C">${esc(b.title)}</h3>
<p style="font-size:16px;line-height:1.55;color:#5C625E;margin:12px 0 0;text-wrap:pretty">${esc(b.detail)}</p>
</div>`
    )
    .join('\n');
}

function screens(resolvedScreens) {
  if (!resolvedScreens.length) return '';
  const frames = resolvedScreens
    .map(
      (s) =>
        `<div data-slot="app-screen" style="width:200px;aspect-ratio:1290/2796;border-radius:26px;overflow:hidden;background:#FFFFFF;box-shadow:0 2px 6px rgba(14,74,42,.05),0 8px 24px rgba(14,74,42,.07)"><img src="${attr(s.src)}" alt="${attr(s.alt)}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`
    )
    .join('\n');
  return `<div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:flex-start">\n${frames}\n</div>`;
}

function lifestyle(img) {
  if (!img || !img.src) return '';
  return `<div style="display:grid;gap:20px">
<div style="border-radius:22px;overflow:hidden;box-shadow:0 2px 6px rgba(14,74,42,.05),0 8px 24px rgba(14,74,42,.07);max-width:340px"><img src="${attr(img.src)}" alt="${attr(img.alt)}" style="width:100%;display:block;aspect-ratio:4/3;object-fit:cover"></div>
</div>`;
}

function proofRow(proof) {
  const cols = [];
  if (proof.rating) {
    cols.push(`<div>
<div style="display:flex;align-items:baseline;gap:9px"><span style="${S.serif};font-style:italic;font-size:52px;line-height:0.9;color:var(--accent)">${esc(proof.rating.value)}</span><span style="font-size:15px;color:#0E4A2A">&#9733;&#9733;&#9733;&#9733;&#9733;</span></div>
<p style="font-size:14px;color:#0E4A2A;opacity:0.75;margin:10px 0 0">${esc(proof.rating.label)}</p>
</div>`);
  }
  if (proof.review) {
    cols.push(`<div data-slot="proof-review">
<p style="${S.serif};font-size:23px;line-height:1.3;color:#0E4A2A;margin:0;text-wrap:pretty">"${esc(proof.review.quote)}"</p>
<p style="font-size:14px;color:#0E4A2A;opacity:0.75;margin:10px 0 0">&mdash; ${esc(proof.review.author)}</p>
</div>`);
  }
  if (proof.stat) {
    cols.push(`<div data-slot="proof-stat">
<div style="${S.serif};font-style:italic;font-size:52px;line-height:0.9;color:var(--accent)">${esc(proof.stat.value)}</div>
<p style="font-size:14px;color:#0E4A2A;opacity:0.75;margin:10px 0 0">${esc(proof.stat.label)}</p>
</div>`);
  }
  if (!cols.length) return '';
  return `<div style="margin-top:52px;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:24px;padding-top:36px;border-top:1px solid rgba(14,74,42,0.18)">
${cols.join('\n')}
</div>`;
}

function badges(site, position) {
  const parts = [
    `<a ${iosAttrs(site, position)} style="display:inline-block;text-decoration:none;line-height:0"><img src="${attr(site.app_store_badge)}" alt="Download on the App Store" style="height:54px;display:block"></a>`,
  ];
  if (site.show_play_store) {
    parts.push(
      `<a ${androidAttrs(site, position)} class="cta-play" style="${S.ctaPlay}"><span style="font-size:20px;line-height:1">&#9654;</span><span style="display:flex;flex-direction:column;line-height:1.1"><span style="font-size:9px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85">Get it on</span><span style="font-size:18px;font-weight:600;letter-spacing:-0.01em">Google Play</span></span></a>`
    );
  }
  return parts.join('\n');
}

function render(site, page, resolved) {
  const b = page.bridge;
  const mediaCols = [screens(resolved.app_screens), lifestyle(b.lifestyle_image)].filter(Boolean);
  const mediaGrid = mediaCols.length
    ? `<div style="margin-top:52px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:32px;align-items:center">\n${mediaCols.join('\n')}\n</div>`
    : '';
  return `<section style="background:#E3EDD9;margin-top:64px;padding:76px 28px">
<div style="max-width:1140px;margin:0 auto">
<div style="${S.eyebrowRow}"><span style="${S.eyebrowBar}"></span><span style="${S.eyebrowText}">First, the honest part</span></div>
<h2 style="${S.serif};font-weight:400;font-size:clamp(34px,4.4vw,58px);line-height:1.02;letter-spacing:-0.016em;margin:20px 0 0;color:#0E4A2A;max-width:22ch;text-wrap:balance">${esc(b.headline)}</h2>
<p style="font-size:21px;line-height:1.6;color:#0E4A2A;margin:24px 0 0;max-width:56ch;text-wrap:pretty">${inline(b.body)}</p>
<p style="${S.serif};font-size:clamp(30px,3.4vw,44px);line-height:1.1;letter-spacing:-0.015em;color:#0E4A2A;margin:26px 0 0"><strong style="font-weight:400">Name three things.</strong> <em style="font-style:italic;color:var(--accent)">It writes the rest.</em></p>

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:20px;margin-top:44px">
${beats(resolved.beats)}
</div>
${mediaGrid}
${proofRow(resolved.proof)}
<div style="margin-top:40px;display:flex;flex-wrap:wrap;align-items:center;gap:16px">
${badges(site, 'bridge')}
</div>
</div>
</section>`;
}

module.exports = { render, badges };
