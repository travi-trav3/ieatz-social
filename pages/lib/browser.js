'use strict';
// Headless Chromium for the golden test and page screenshots. Uses the
// pre-installed browser in cloud sandboxes (PW_CHROMIUM or the /opt glob);
// never runs `playwright install`.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

function chromiumPath() {
  if (process.env.PW_CHROMIUM && fs.existsSync(process.env.PW_CHROMIUM)) return process.env.PW_CHROMIUM;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', path.join(process.env.HOME || '', '.cache/ms-playwright')].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const d of fs.readdirSync(root)) {
      if (!/^chromium-\d+$/.test(d)) continue;
      for (const rel of ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe']) {
        const p = path.join(root, d, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return undefined;
}

async function launch() {
  return chromium.launch({ executablePath: chromiumPath(), headless: true });
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.css': 'text/css', '.html': 'text/html' };

// Serve one rendered page at `pageUrl` with assets from `assetRoot` and
// fonts from the committed golden font set. Every other network request is
// aborted so screenshots are deterministic and third-party tags never fire.
async function openRendered(context, { html, pageUrl, assetRoot, fontsDir, extraRoutes = {} }) {
  const page = await context.newPage();
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.url() === pageUrl || req.url() === pageUrl.replace(/\/$/, '')) {
      return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    }
    if (url.hostname === 'fonts.googleapis.com' && fontsDir && fs.existsSync(path.join(fontsDir, 'fonts.css'))) {
      const css = fs.readFileSync(path.join(fontsDir, 'fonts.css'), 'utf8').replace(/url\(\.\//g, `url(${pageUrl.replace(/[^/]*$/, '')}__fonts/`);
      return route.fulfill({ status: 200, contentType: 'text/css', body: css });
    }
    if (url.pathname.includes('/__fonts/') && fontsDir) {
      const f = path.join(fontsDir, path.basename(url.pathname));
      if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f) });
    }
    for (const prefix of Object.keys(extraRoutes)) {
      if (url.pathname.startsWith(prefix)) {
        const f = path.join(extraRoutes[prefix], url.pathname.slice(prefix.length));
        if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      }
    }
    if (assetRoot && url.origin === new URL(pageUrl).origin) {
      const f = path.join(assetRoot, decodeURIComponent(url.pathname));
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    }
    return route.abort();
  });
  await page.goto(pageUrl, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

module.exports = { launch, chromiumPath, openRendered };
