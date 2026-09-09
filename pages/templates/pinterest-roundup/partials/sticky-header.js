'use strict';
const { esc, attr, S } = require('./h');
const { iosAttrs } = require('./links');

function logoMark(site, size, extraStyle) {
  const style = `width:${size}px;height:${size}px;display:block${extraStyle ? ';' + extraStyle : ''}`;
  if (site.logo_mark_svg) {
    return `<span style="${style};color:#1F8B4C" aria-hidden="true">${site.logo_mark_svg}</span>`;
  }
  return `<img src="${attr(site.logo_mark_src)}" alt="" style="${style}">`;
}

function render(site) {
  return `<header style="position:sticky;top:0;z-index:40;background:rgba(245,242,234,0.94);border-bottom:1px solid rgba(10,15,12,0.08)">
<div style="max-width:1140px;margin:0 auto;padding:12px 28px;display:flex;align-items:center;justify-content:space-between;gap:16px">
<a href="${attr(site.origin)}/" class="hdr-logo" style="display:inline-flex;align-items:center;gap:9px;text-decoration:none;flex:none;background:#FFFFFF;border:1px solid rgba(10,15,12,0.14);border-radius:999px;padding:8px 18px 8px 12px;white-space:nowrap">${logoMark(site, 24)}<span style="font-weight:600;font-size:16px;letter-spacing:-0.01em;color:#0A0F0C">${esc(site.name)}</span></a>
<a ${iosAttrs(site, 'header')} class="cta-dark" style="${S.ctaDark}">Get the free app<span style="font-size:15px">&rarr;</span></a>
</div>
</header>`;
}

module.exports = { render, logoMark };
