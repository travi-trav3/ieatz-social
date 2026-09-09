'use strict';
// Sitemap append, hub index regeneration, related-links backfill on the two
// most related older pages, and the corpus index update.

const fs = require('fs');
const path = require('path');
const U = require('./util');
const { esc, attr, S } = require('../templates/pinterest-roundup/partials/h');
const stickyHeader = require('../templates/pinterest-roundup/partials/sticky-header');
const footer = require('../templates/pinterest-roundup/partials/footer');

function pageUrlOf(config, slug) {
  return `${config.site.origin}${config.site.recipes_path}${slug}/`;
}

// --- sitemap ---------------------------------------------------------------
function updateSitemap(existingXml, urls, config) {
  const today = new Date().toISOString().slice(0, 10);
  let xml = existingXml;
  if (!xml || !xml.includes('<urlset')) {
    const base = [`${config.site.origin}/`, `${config.site.origin}/privacy.html`, `${config.site.origin}/terms.html`, `${config.site.origin}${config.site.recipes_path}`];
    xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${base.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  }
  for (const u of urls) {
    if (xml.includes(`<loc>${u}</loc>`)) {
      xml = xml.replace(new RegExp(`(<url><loc>${u.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}</loc><lastmod>)[^<]*(</lastmod>)`), `$1${today}$2`);
    } else {
      xml = xml.replace('</urlset>', `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>\n</urlset>`);
    }
  }
  return xml;
}

// --- hub index -------------------------------------------------------------
function renderHubIndex(corpus, site, config) {
  const pages = (corpus.pages || []).filter((p) => p.state === 'live' || p.state === 'deployed').sort((a, b) => (b.deployed_at || '').localeCompare(a.deployed_at || ''));
  const cards = pages.map((p) => `<a href="${attr(config.site.recipes_path + p.slug + '/')}" class="link-card" style="display:block;background:#FFFFFF;border:1px solid rgba(10,15,12,0.06);border-radius:20px;padding:24px;text-decoration:none;box-shadow:0 1px 2px rgba(14,74,42,.04)">
<span style="display:block;width:26px;height:2px;border-radius:2px;background:var(--accent)"></span>
<span style="display:block;${S.serif};font-size:24px;line-height:1.14;letter-spacing:-0.012em;color:#0A0F0C;margin-top:16px">${esc(p.title)}</span>
<span style="display:block;font-size:13px;color:#9CA29F;margin-top:10px">${p.recipe_count} recipes</span>
</a>`).join('\n');
  const url = `${site.origin}${site.recipes_path}`;
  const ld = { '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${url}#page`, name: 'Recipes from what is already in your kitchen', url, mainEntity: { '@type': 'ItemList', numberOfItems: pages.length, itemListElement: pages.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: pageUrlOf(config, p.slug), name: p.title })) } };
  const fakePage = { final_cta: { headline: 'Tonight is already in your fridge.', image: null }, provenance_line: 'Every page here is written for people cooking from what they already have.', recipes: [] };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Recipes from what is already in your kitchen | ${esc(site.name)}</title>
<meta name="description" content="Recipe roundups written for real kitchens: fast, complete and free, from ${esc(site.name)}.">
<link rel="canonical" href="${attr(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${attr(site.name)}">
<meta property="og:title" content="Recipes from what is already in your kitchen">
<meta property="og:description" content="Recipe roundups written for real kitchens: fast, complete and free.">
<meta property="og:image" content="${attr(site.origin + (site.default_og_image || ''))}">
<meta property="og:url" content="${attr(url)}">
<link rel="icon" href="${attr(site.favicon)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&amp;family=Inter+Tight:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(ld).replace(/<\//g, '<\\/')}</script>
<style>html{scroll-behavior:smooth}body{margin:0;background:#F5F2EA;-webkit-font-smoothing:antialiased}*{box-sizing:border-box}img{max-width:100%}a{color:#0E4A2A}
.hdr-logo:hover{border-color:#1F8B4C}.cta-dark:hover{background:#0B3A21}.link-card:hover{box-shadow:0 2px 6px rgba(14,74,42,.05),0 8px 24px rgba(14,74,42,.07)}.foot-link:hover{color:#1F8B4C}
:root{--accent:#1F8B4C;--accent-ink:#0E4A2A}</style>
${site.head_tags || ''}
</head>
<body>
<div style="background:#F5F2EA;font-family:'Inter Tight',system-ui,sans-serif;color:#0A0F0C">
${stickyHeader.render(site)}
<main>
<section style="max-width:1140px;margin:0 auto;padding:64px 28px 0">
<div style="${S.eyebrowRow}"><span style="${S.eyebrowBar}"></span><span style="${S.eyebrowText}">Recipes</span></div>
<h1 style="${S.serif};font-weight:400;font-size:clamp(40px,5vw,68px);line-height:1.0;letter-spacing:-0.018em;margin:20px 0 0;color:#0A0F0C;max-width:16ch;text-wrap:balance">Recipes from what is already in your kitchen</h1>
<p style="font-size:20px;line-height:1.55;color:#5C625E;margin:26px 0 0;max-width:50ch;text-wrap:pretty">Every page here is complete and free: full ingredient lists, steps, times and servings. Each one is also a guess about your kitchen. The app is not.</p>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-top:40px">
${cards || `<p style="font-size:17px;color:#5C625E">The first pages are on their way.</p>`}
</div>
</section>
</main>
${footer.finalCta(site, fakePage)}
${footer.footer(site, fakePage)}
</div>
</body>
</html>
`;
}

// --- corpus and backfill ---------------------------------------------------
function corpusEntry(obj, config, extra = {}) {
  const p = obj.page;
  return Object.assign({
    id: obj.id,
    slug: p.slug,
    url: pageUrlOf(config, p.slug),
    title: p.og_title || p.h1,
    h1: p.h1,
    query: obj.query_target,
    tags: obj.tags || [],
    recipe_count: p.recipes.length,
    state: 'deployed',
    deployed_at: U.nowIso(),
  }, extra);
}

function addToCorpus(corpus, obj, config, extra) {
  const p = obj.page;
  corpus.pages = (corpus.pages || []).filter((x) => x.slug !== p.slug);
  corpus.pages.push(corpusEntry(obj, config, extra));
  corpus.recipes = (corpus.recipes || []).filter((r) => r.page !== p.slug);
  for (const r of p.recipes) corpus.recipes.push({ page: p.slug, anchor: r.anchor, name: r.name, ingredients: r.ingredients, primary_protein: r.primary_protein || null, method: r.method || null });
  corpus.bridge_sentences = (corpus.bridge_sentences || []).filter((x) => x.page !== p.slug);
  for (const s of U.sentences(p.bridge.body.replace(/[*=]/g, ''))) corpus.bridge_sentences.push({ page: p.slug, sentence: s });
  corpus.supporting_types_by_page = (corpus.supporting_types_by_page || []).filter((x) => x.page !== p.slug);
  corpus.supporting_types_by_page.push({ page: p.slug, types: p.supporting_sections.map((s) => s.type) });
  return corpus;
}

// Picks the most related older live pages by tag overlap and adds a link to
// the new page in their internal_links (bounded). Returns the objects that
// changed so the caller re-renders and commits them.
function backfillRelated(corpus, newObj, config, loadContent) {
  const limit = config.pages.relatedBackfillLimit;
  const tags = new Set(newObj.tags || []);
  const older = (corpus.pages || []).filter((p) => p.slug !== newObj.page.slug && p.state === 'live');
  const scored = older.map((p) => ({ p, overlap: p.tags.filter((t) => tags.has(t)).length })).filter((x) => x.overlap > 0).sort((a, b) => b.overlap - a.overlap).slice(0, limit);
  const changed = [];
  const newLink = { title: newObj.page.og_title || newObj.page.h1, url: pageUrlOf(config, newObj.page.slug), meta: `${newObj.page.recipes.length} recipes` };
  for (const { p } of scored) {
    const obj = loadContent(p.id);
    if (!obj) continue;
    const links = obj.page.internal_links || [];
    if (links.some((l) => l.url === newLink.url)) continue;
    // Replace the bootstrap links (hub + home) first, then append up to max.
    const real = links.filter((l) => l.url !== `${config.site.origin}${config.site.recipes_path}` && l.url !== `${config.site.origin}/`);
    real.push(newLink);
    obj.page.internal_links = real.slice(-config.pages.internalLinks.max);
    if (obj.page.internal_links.length < config.pages.internalLinks.min) obj.page.internal_links.unshift({ title: 'All recipes', url: `${config.site.origin}${config.site.recipes_path}`, meta: 'The hub' });
    changed.push(obj);
  }
  return changed;
}

module.exports = { updateSitemap, renderHubIndex, addToCorpus, backfillRelated, corpusEntry, pageUrlOf };
