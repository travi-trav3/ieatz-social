'use strict';
// Renders the 2:3 Pinterest pin creative for a landing page when the
// existing render harness (not in git, see DISCOVERY.md) is not available.
// Design tokens from the site: paper #F5F2EA, ink #0A0F0C, green #1F8B4C /
// #0E4A2A, Instrument Serif display, Inter Tight body. Self-hosted fonts from
// golden/fonts so the render is deterministic. Output 1000x1500 PNG.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launch, openRendered } = require('../browser');
const { esc } = require('../../templates/pinterest-roundup/partials/h');

const FONTS = path.resolve(__dirname, '../../templates/pinterest-roundup/golden/fonts');

function html({ headline, subline, chip, photoSrc, photoAlt, logoSvg }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
html,body{margin:0;width:1000px;height:1500px;overflow:hidden;background:#F5F2EA;font-family:'Inter Tight',system-ui,sans-serif;color:#0A0F0C;-webkit-font-smoothing:antialiased}
.photo{position:absolute;left:0;top:0;width:1000px;height:930px;object-fit:cover;display:block}
.wash{position:absolute;left:0;top:0;width:1000px;height:930px;background:linear-gradient(180deg,rgba(10,15,12,0) 55%,#F5F2EA 100%)}
.card{position:absolute;left:0;top:820px;width:1000px;height:680px;padding:0 72px;box-sizing:border-box}
.eyebrow{display:flex;align-items:center;gap:14px;font-weight:600;font-size:22px;letter-spacing:0.18em;text-transform:uppercase;color:#1F8B4C}
.eyebrow span.bar{display:block;width:44px;height:4px;border-radius:2px;background:#1F8B4C}
h1{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:104px;line-height:0.98;letter-spacing:-0.02em;margin:26px 0 0;color:#0A0F0C;text-wrap:balance}
p{font-size:32px;line-height:1.35;color:#5C625E;margin:28px 0 0;max-width:760px;text-wrap:pretty}
.chip{position:absolute;left:72px;bottom:64px;display:inline-flex;align-items:center;gap:12px;background:#0E4A2A;color:#F5F2EA;font-weight:600;font-size:26px;padding:20px 34px;border-radius:999px}
.brand{position:absolute;right:72px;bottom:70px;display:inline-flex;align-items:center;gap:12px;background:#FFFFFF;border:2px solid rgba(10,15,12,0.14);border-radius:999px;padding:14px 26px 14px 18px;font-weight:600;font-size:26px;color:#0A0F0C}
.brand .mark{width:34px;height:34px;color:#1F8B4C}
</style></head><body>
<img class="photo" src="${esc(photoSrc)}" alt="${esc(photoAlt)}"><div class="wash"></div>
<div class="card">
<div class="eyebrow"><span class="bar"></span><span>Breakfast &middot; 10 minutes &middot; 20g+ protein</span></div>
<h1>${esc(headline)}</h1>
<p>${esc(subline)}</p>
</div>
<div class="chip">${esc(chip)} &rarr;</div>
<div class="brand"><span class="mark">${logoSvg}</span>iEatz Healthy</div>
</body></html>`;
}

async function renderPin({ site, headline, subline, chip, photoSrc, photoAlt, outFile }) {
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 1500 }, deviceScaleFactor: 2 });
    const page = await openRendered(ctx, {
      html: html({ headline, subline, chip, photoSrc, photoAlt, logoSvg: site.logo_mark_svg }),
      pageUrl: `${site.origin}/__pin/`,
      assetRoot: site.website_repo,
      fontsDir: FONTS,
    });
    const ok = await page.evaluate(() => document.fonts.check("400 100px 'Instrument Serif'") && document.fonts.check("600 22px 'Inter Tight'"));
    if (!ok) throw new Error('brand fonts did not load; refusing a fallback-font render');
    const buf = await page.screenshot({ type: 'png' });
    await browser.close();
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    await sharp(buf).resize(1000, 1500, { fit: 'fill', kernel: 'lanczos3' }).png().toFile(outFile);
    return outFile;
  } catch (e) { await browser.close(); throw e; }
}

module.exports = { renderPin };
