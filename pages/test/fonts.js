'use strict';
// Self-hosted fonts for deterministic golden screenshots.
// Fetches the latin woff2 files from the Google Fonts CSS2 endpoint with a
// desktop User-Agent, rewrites the CSS to local @font-face rules with
// font-display:block, and stores both under golden/fonts/. Run once with
// `node test/fonts.js`; the files are committed so renders work offline.

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT = path.resolve(__dirname, '../templates/pinterest-roundup/golden/fonts');
const CSS_URL =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function get(url, binary) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': UA } }, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`${res.statusCode} ${url}`));
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(binary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const css = await get(CSS_URL, false);
  // Keep latin blocks only (each @font-face is preceded by a /* latin */ comment).
  const blocks = css.split(/(?=\/\* [a-z-]+ \*\/)/).filter((b) => b.startsWith('/* latin */'));
  let localCss = '';
  let n = 0;
  for (const block of blocks) {
    const fam = /font-family: '([^']+)'/.exec(block)[1];
    const style = /font-style: (\w+)/.exec(block)[1];
    const weight = /font-weight: (\d+)/.exec(block)[1];
    const url = /url\((https:[^)]+\.woff2)\)/.exec(block)[1];
    const file = `${fam.replace(/\s+/g, '-')}-${weight}-${style}.woff2`;
    const buf = await get(url, true);
    fs.writeFileSync(path.join(OUT, file), buf);
    localCss += `@font-face{font-family:'${fam}';font-style:${style};font-weight:${weight};font-display:block;src:url(./${file}) format('woff2')}\n`;
    n++;
  }
  fs.writeFileSync(path.join(OUT, 'fonts.css'), localCss);
  console.log(`wrote ${n} faces to ${OUT}`);
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { OUT, CSS_URL };
