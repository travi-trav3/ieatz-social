'use strict';
const { esc, attr } = require('./h');
const { appStoreHref, playStoreHref } = require('./links');

function pageUrl(site, page) {
  const base = `${site.origin}${site.recipes_path}${page.slug}`;
  return site.trailing_slash ? `${base}/` : base;
}

function absolute(site, src) {
  if (!src) return null;
  if (/^https?:\/\//.test(src)) return src;
  if (src.startsWith('/')) return `${site.origin}${src}`;
  // golden mode keeps the export's relative img paths but the export writes
  // absolute /img/recipes/ URLs into meta and schema.
  return `${site.origin}/${src.replace(/^(\.\.\/)+/, '')}`;
}

function ogImage(site, page) {
  if (page.og_image) return absolute(site, page.og_image);
  if (page.hero && page.hero.image && page.hero.image.src) return absolute(site, page.hero.image.src);
  const first = (page.recipes || []).find((r) => r.image && r.image.src);
  if (first) return absolute(site, first.image.src);
  return absolute(site, site.default_og_image);
}

function isoDuration(minutes) {
  return `PT${minutes}M`;
}

function collectionPage(site, page) {
  const url = pageUrl(site, page);
  const items = page.recipes.map((r, i) => {
    const item = {
      '@type': 'Recipe',
      '@id': `${url}#${r.anchor}`,
      name: r.name,
      description: r.description,
    };
    const img = r.image && r.image.src ? absolute(site, r.image.src) : (r.schema_image ? absolute(site, r.schema_image) : null);
    if (img) item.image = img;
    item.totalTime = isoDuration(r.time_minutes);
    item.recipeYield = `${r.servings} ${r.servings === 1 ? 'serving' : 'servings'}`;
    item.recipeCategory = r.category || page.category || 'Recipe';
    item.nutrition = { '@type': 'NutritionInformation', proteinContent: `${r.protein_g} g` };
    item.recipeIngredient = r.ingredients.slice();
    item.recipeInstructions = r.steps.map((t) => ({ '@type': 'HowToStep', text: t }));
    return { '@type': 'ListItem', position: i + 1, item };
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#page`,
    name: page.h1_schema || page.og_title || page.h1,
    description: page.schema_description || page.meta_description,
    mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items },
  };
}

function faqPage(page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

function breadcrumbs(site, page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: site.name, item: `${site.origin}/` },
      { '@type': 'ListItem', position: 2, name: 'Recipes', item: `${site.origin}${site.recipes_path}` },
      { '@type': 'ListItem', position: 3, name: page.breadcrumb_label || page.h1, item: pageUrl(site, page) },
    ],
  };
}

function jsonLd(obj) {
  // JSON inside <script> must not be able to close the tag.
  return JSON.stringify(obj).replace(/<\//g, '<\\/');
}

function render(site, page) {
  const url = pageUrl(site, page);
  const og = ogImage(site, page);
  const lines = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(page.title_tag)}</title>`,
    `<meta name="description" content="${attr(page.meta_description)}">`,
    `<link rel="canonical" href="${attr(url)}">`,
    '<meta property="og:type" content="article">',
    `<meta property="og:site_name" content="${attr(site.name)}">`,
    `<meta property="og:title" content="${attr(page.og_title || page.h1)}">`,
    `<meta property="og:description" content="${attr(page.og_description || page.meta_description)}">`,
  ];
  if (og) lines.push(`<meta property="og:image" content="${attr(og)}">`);
  lines.push(`<meta property="og:url" content="${attr(url)}">`);
  if (page.suppress_rich_pin) lines.push('<meta name="pinterest-rich-pin" content="false">');
  lines.push(`<link rel="icon" href="${attr(site.favicon)}">`);
  lines.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
  lines.push('<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&amp;family=Inter+Tight:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet">');
  lines.push(`<script type="application/ld+json">${jsonLd(collectionPage(site, page))}</script>`);
  lines.push(`<script type="application/ld+json">${jsonLd(faqPage(page))}</script>`);
  lines.push(`<script type="application/ld+json">${jsonLd(breadcrumbs(site, page))}</script>`);
  lines.push(
    '<style>html{scroll-behavior:smooth}body{margin:0;background:#F5F2EA;-webkit-font-smoothing:antialiased}*{box-sizing:border-box}img{max-width:100%}a{color:#0E4A2A}a:hover{color:#1F8B4C}\n' +
      '.hdr-logo:hover{border-color:#1F8B4C}\n' +
      '.cta-dark:hover{background:#0B3A21}.cta-dark:active{transform:translateY(1px)}\n' +
      '.cta-light:hover{background:#FFFFFF}\n' +
      '.cta-play:hover{background:#000000}\n' +
      '.jump-link:hover{color:#1F8B4C}\n' +
      '.link-card:hover{box-shadow:0 2px 6px rgba(14,74,42,.05),0 8px 24px rgba(14,74,42,.07)}\n' +
      '.foot-link:hover{color:#1F8B4C}\n' +
      ':root{--accent:#1F8B4C;--accent-ink:#0E4A2A}\n' +
      'html[data-accent="forest"]{--accent:#0E4A2A;--accent-ink:#08311B}\n' +
      'html[data-accent="deep"]{--accent:#08311B;--accent-ink:#08311B}</style>'
  );
  // Site-wide tags (Meta pixel, Pinterest tag, GA4) are read from the website
  // repo at render time. Never pasted in by hand.
  if (site.head_tags) lines.push(site.head_tags.trim());
  return lines.join('\n');
}

module.exports = { render, pageUrl, absolute, ogImage, collectionPage, faqPage, breadcrumbs, appStoreHref, playStoreHref };
