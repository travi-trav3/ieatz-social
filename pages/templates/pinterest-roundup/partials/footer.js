'use strict';
const { esc, attr, S } = require('./h');
const { iosAttrs, appStoreHref, playStoreHref } = require('./links');
const { badges } = require('./bridge');
const { logoMark } = require('./sticky-header');

// SECTION 9. Universal copy, page-specific photo and headline.
function finalCta(site, page) {
  const f = page.final_cta;
  const img = f.image && f.image.src;
  const bg = img
    ? `<img src="${attr(f.image.src)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">\n<div style="position:absolute;inset:0;background:linear-gradient(100deg,rgba(14,74,42,0.96),rgba(8,49,27,0.8))"></div>`
    : '';
  const sectionStyle = img ? 'position:relative;margin-top:76px;overflow:hidden' : 'position:relative;margin-top:76px;overflow:hidden;background:#0E4A2A';
  return `<section style="${sectionStyle}">
${bg}
<div style="position:relative;max-width:1140px;margin:0 auto;padding:80px 28px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:36px;align-items:center">
<div>
<h2 style="${S.serif};font-weight:400;font-size:clamp(32px,3.8vw,50px);line-height:1.04;letter-spacing:-0.016em;margin:0;color:#F5F2EA;max-width:24ch;text-wrap:balance">${esc(f.headline)}</h2>
<p style="font-size:18px;line-height:1.5;color:#E6F4EC;opacity:0.85;margin:18px 0 0;max-width:44ch">Name three things. Get a recipe you can start now. Free to download, no account needed to try.</p>
</div>
<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">
${badges(site, 'footer')}
</div>
</div>
</section>`;
}

// SECTION 10. The provenance line is a disclosure, not copy.
function footer(site, page) {
  const links = [
    `<a href="${attr(site.origin + site.recipes_path)}" class="foot-link" style="color:#5C625E;text-decoration:none">All recipes</a>`,
    `<a href="${attr(site.origin)}/" class="foot-link" style="color:#5C625E;text-decoration:none">${esc(site.name)}</a>`,
    `<a href="${attr(appStoreHref(site))}" data-store="ios" data-cta="footer_link" class="foot-link" style="color:#5C625E;text-decoration:none">App Store</a>`,
  ];
  if (site.show_play_store) {
    links.push(`<a href="${attr(playStoreHref(site))}" data-store="android" class="foot-link" style="color:#5C625E;text-decoration:none">Google Play</a>`);
  }
  return `<footer style="max-width:1140px;margin:0 auto;padding:44px 28px 96px;display:grid;gap:18px">
<div style="display:flex;align-items:center;gap:10px">${logoMark(site, 22)}<span style="font-weight:600;font-size:15px;color:#0A0F0C">${esc(site.name)}</span></div>
<p style="font-size:14px;line-height:1.6;color:#9CA29F;margin:0;max-width:70ch">${esc(page.provenance_line)}</p>
<div style="display:flex;flex-wrap:wrap;gap:18px;font-size:14px">${links.join('')}</div>
</footer>`;
}

// SECTION 11. Appears past item 1, never on load.
function stickyBar(site) {
  return `<div id="sticky-cta" style="display:none;position:fixed;left:0;right:0;bottom:0;z-index:45;background:rgba(245,242,234,0.97);border-top:1px solid rgba(10,15,12,0.08);box-shadow:0 -8px 24px rgba(14,74,42,.10);padding:12px 20px;align-items:center;justify-content:space-between;gap:16px">
<span style="font-size:15px;font-weight:500;letter-spacing:-0.005em;color:#0A0F0C;line-height:1.3">Cook from what you already have</span>
<a ${iosAttrs(site, 'sticky')} class="cta-dark" style="flex:none;background:#0E4A2A;color:#F5F2EA;font-weight:600;font-size:15px;padding:13px 24px;border-radius:999px;text-decoration:none">Get the free app</a>
</div>`;
}

module.exports = { finalCta, footer, stickyBar };
