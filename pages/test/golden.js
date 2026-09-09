'use strict';
// Golden test for templates/pinterest-roundup. Runs on every commit that
// touches templates/. Two guards:
//
//  1. Fidelity: render golden/example.content.json with the golden site
//     config (export domain, export asset paths, PROVIDER_TOKEN literal) and
//     compare its DOM signature and head against PinterestRoundup.example.html.
//     Slots the design itself left unfinished (dashed placeholder boxes,
//     VERIFY spans, the ASSET SLOT note) are masked on both sides; the
//     rendered page fills them and marks each fill with data-slot.
//
//  2. Regression: screenshot the same object through the production site
//     config at 390 and 1280 wide (real assets from the website repo,
//     self-hosted fonts, third-party tags aborted) and pixel-diff against
//     golden/example.mobile.png and example.desktop.png. Tolerance is set
//     once in TOLERANCE and never loosened to make a failing test pass.
//     Regenerate deliberately with --update when the design changes.
//
//  Also screenshots the photo-free variant (every image null) so a human
//  can confirm it looks finished.

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');

const sc = require('../lib/site-config');
const tpl = require('../templates/pinterest-roundup/template');
const { launch, openRendered } = require('../lib/browser');

const TPL_DIR = path.resolve(__dirname, '../templates/pinterest-roundup');
const GOLDEN = path.join(TPL_DIR, 'golden');
const TOLERANCE = 0.005; // 0.5 percent of pixels. Do not loosen.
const UPDATE = process.argv.includes('--update');

const facts = sc.loadJson('verified-facts.json');
const config = sc.loadJson('config.json');
const example = sc.loadJson('templates/pinterest-roundup/golden/example.content.json');

// --- 1. Fidelity -----------------------------------------------------------

const SIGNATURE_SCRIPT = `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const normStyle = (s) => norm(s).replace(/var\\(--accent-ink\\)/g, '#0E4A2A').replace(/var\\(--accent\\)/g, '#1F8B4C').replace(/;\\s*$/, '');
  const out = [];
  const isExportSlot = (el) => {
    const st = el.getAttribute('style') || '';
    if (/border:\\s*1px dashed/.test(st)) return true;
    if (el.tagName === 'DIV' && el.parentElement && /display:grid/.test(el.parentElement.getAttribute('style') || '') && /VERIFY/.test(el.textContent)) return true;
    return false;
  };
  const isDrop = (el) => el.tagName === 'P' && /^\\s*ASSET SLOT/.test(el.textContent);
  const walk = (el) => {
    for (const child of el.children) {
      const tag = child.tagName.toLowerCase();
      if (['script', 'style', 'template', 'noscript', 'svg'].includes(tag)) continue;
      if (isDrop(child)) continue;
      if (child.hasAttribute('data-slot') || isExportSlot(child)) { out.push({ tag: 'SLOT' }); continue; }
      const rec = { tag };
      const st = child.getAttribute('style');
      if (st) rec.style = normStyle(st);
      if (child.className) rec.class = child.className;
      let own = '';
      for (const n of child.childNodes) if (n.nodeType === 3) own += n.textContent;
      own = norm(own);
      if (own) rec.text = own;
      if (tag === 'img') { rec.src = child.getAttribute('src'); rec.alt = norm(child.getAttribute('alt')); }
      if (tag === 'a') rec.href = child.getAttribute('href');
      if (child.id) rec.id = child.id;
      out.push(rec);
      walk(child);
    }
  };
  walk(document.body);
  const head = {
    title: norm(document.title),
    metas: [...document.head.querySelectorAll('meta[name],meta[property]')].map((m) => [m.getAttribute('name') || m.getAttribute('property'), m.getAttribute('content')]).filter((m) => m[0] !== 'viewport'),
    canonical: (document.head.querySelector('link[rel=canonical]') || {}).href || null,
    jsonld: [...document.head.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)),
  };
  return { body: out, head };
})()`;

function diffSignatures(a, b) {
  const problems = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = JSON.stringify(a[i] || null);
    const y = JSON.stringify(b[i] || null);
    if (x !== y) {
      problems.push({ index: i, export: a[i] || null, render: b[i] || null });
      if (problems.length >= 12) break;
    }
  }
  return problems;
}

async function fidelity(browser) {
  const exportHtml = fs.readFileSync(path.join(TPL_DIR, 'PinterestRoundup.example.html'), 'utf8');
  const renderHtml = tpl.render(example.page, sc.goldenSite(facts), facts);
  const ctx = await browser.newContext();
  const base = 'https://ieatshealthy.com/recipes/10-minute-breakfasts-busy-mornings';
  const sigs = [];
  for (const html of [exportHtml, renderHtml]) {
    const page = await openRendered(ctx, { html, pageUrl: base });
    sigs.push(await page.evaluate(SIGNATURE_SCRIPT));
    await page.close();
  }
  await ctx.close();
  const [ex, re] = sigs;
  const bodyProblems = diffSignatures(ex.body, re.body);
  const headProblems = [];
  if (ex.head.title !== re.head.title) headProblems.push(['title', ex.head.title, re.head.title]);
  if (ex.head.canonical !== re.head.canonical) headProblems.push(['canonical', ex.head.canonical, re.head.canonical]);
  if (JSON.stringify(ex.head.metas) !== JSON.stringify(re.head.metas)) headProblems.push(['metas', ex.head.metas, re.head.metas]);
  if (JSON.stringify(ex.head.jsonld) !== JSON.stringify(re.head.jsonld)) {
    ex.head.jsonld.forEach((blk, i) => {
      const x = JSON.stringify(blk), y = JSON.stringify(re.head.jsonld[i] || null);
      if (x !== y) headProblems.push([`jsonld[${i}]`, x.slice(0, 400), y.slice(0, 400)]);
    });
  }
  return { ok: !bodyProblems.length && !headProblems.length, bodyProblems, headProblems, counts: [ex.body.length, re.body.length] };
}

// --- 2. Regression screenshots ---------------------------------------------

// The export's relative photo paths do not exist in the website repo. For the
// pixel goldens they map onto real files so the screenshot has real pixels.
const ASSET_MAP = {
  '../assets/photos/food/food-07.jpg': '/assets/photos/pesto-pasta-bowl.jpg',
  '../assets/photos/fridge/fridge-real-mess.jpg': '/assets/photos/fridge-real-mess.jpg',
  '../assets/photos/lifestyle/cook-snap-1.png': '/assets/photos/couple-cooking.jpg',
  '../assets/photos/lifestyle/pan-steam.jpg': '/assets/photos/cooking-window.jpg',
  '../assets/photos/food/nuts-almonds.png': '/assets/photos/spices-spoons.jpg',
  '../assets/photos/food/berries-negative-space.jpg': '/assets/photos/cutting-board-veg.jpg',
  '../assets/photos/fridge/fridge-warm-open.jpg': '/assets/photos/fridge-organized.jpg',
};

function mapAssets(page) {
  const p = JSON.parse(JSON.stringify(page));
  const fix = (img) => { if (img && img.src && ASSET_MAP[img.src]) img.src = ASSET_MAP[img.src]; };
  fix(p.hero.image); fix(p.hero.inset_image); fix(p.bridge.lifestyle_image);
  (p.interstitials || []).forEach((b) => fix(b.image));
  (p.supporting_sections || []).forEach((s) => (s.images || []).forEach(fix));
  fix(p.final_cta.image);
  p.og_image = null;
  return p;
}

function photoFree(page) {
  const p = JSON.parse(JSON.stringify(page));
  p.hero.image = null; p.hero.inset_image = null; p.bridge.lifestyle_image = null;
  p.recipes.forEach((r) => (r.image = null));
  (p.interstitials || []).forEach((b) => (b.image = null));
  (p.supporting_sections || []).forEach((s) => (s.images = []));
  p.final_cta.image = null;
  p.internal_links = [];
  p.supporting_sections = p.supporting_sections.slice(0, 1);
  return p;
}

async function screenshot(browser, html, width, file, site) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const page = await openRendered(ctx, {
    html,
    pageUrl: `${site.origin}/recipes/golden/`,
    assetRoot: site.website_repo,
    fontsDir: path.join(GOLDEN, 'fonts'),
  });
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
  await ctx.close();
}

function comparePng(goldenFile, candidateFile) {
  const a = PNG.sync.read(fs.readFileSync(goldenFile));
  const b = PNG.sync.read(fs.readFileSync(candidateFile));
  if (a.width !== b.width || a.height !== b.height) {
    return { ratio: 1, reason: `size ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  fs.writeFileSync(candidateFile.replace(/\.png$/, '.diff.png'), PNG.sync.write(diff));
  return { ratio: n / (a.width * a.height), reason: `${n} pixels differ` };
}

async function regression(browser) {
  const site = sc.productionSite(config, facts, { show_play_store: true, store: { apple_id: facts.app.apple_id, provider_token: 'GOLDEN', play_package: 'com.ieatz.healthy', ppid: null } });
  const mapped = mapAssets(example.page);
  const html = tpl.render(mapped, site, facts);
  const pfHtml = tpl.render(photoFree(example.page), site, facts);
  const results = [];
  const tmp = path.join(GOLDEN, '.candidates');
  fs.mkdirSync(tmp, { recursive: true });
  for (const [name, width] of [['mobile', 390], ['desktop', 1280]]) {
    const goldenFile = path.join(GOLDEN, `example.${name}.png`);
    const candidate = path.join(tmp, `example.${name}.png`);
    await screenshot(browser, html, width, UPDATE ? goldenFile : candidate, site);
    await screenshot(browser, pfHtml, width, path.join(GOLDEN, `example.photo-free.${name}.png`), site);
    if (UPDATE) { results.push({ name, ok: true, note: 'updated' }); continue; }
    if (!fs.existsSync(goldenFile)) { results.push({ name, ok: false, note: 'no golden PNG; run with --update once, deliberately' }); continue; }
    const { ratio, reason } = comparePng(goldenFile, candidate);
    results.push({ name, ok: ratio <= TOLERANCE, note: `${(ratio * 100).toFixed(3)}% (${reason})` });
  }
  return results;
}

async function main() {
  const browser = await launch();
  let failed = false;
  try {
    const f = await fidelity(browser);
    console.log(`fidelity: ${f.ok ? 'PASS' : 'FAIL'} (elements export=${f.counts[0]} render=${f.counts[1]})`);
    if (!f.ok) {
      failed = true;
      for (const p of f.headProblems) console.log('  head', JSON.stringify(p));
      for (const p of f.bodyProblems) console.log('  body', JSON.stringify(p));
    }
    const r = await regression(browser);
    for (const x of r) {
      console.log(`pixels ${x.name}: ${x.ok ? 'PASS' : 'FAIL'} ${x.note}`);
      if (!x.ok) failed = true;
    }
  } finally {
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { fidelity, regression, TOLERANCE, photoFree };
