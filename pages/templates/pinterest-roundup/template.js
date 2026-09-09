'use strict';
// Working template derived from the Claude Design export
// (PinterestRoundup.template.html + PinterestRoundup.example.html).
// render(contentObject, site, facts) -> one self-contained HTML document.
// No framework, no build step. Inline CSS from the export, Google-loaded
// fonts exactly as the export does it, no external JS beyond the site tags.

const { SECTION_ORDERS } = require('./partials/h');
const head = require('./partials/head');
const stickyHeader = require('./partials/sticky-header');
const hero = require('./partials/hero');
const bridge = require('./partials/bridge');
const jumpList = require('./partials/jump-list');
const recipeCard = require('./partials/recipe-card');
const interstitial = require('./partials/interstitial');
const supporting = require('./partials/supporting');
const faq = require('./partials/faq');
const related = require('./partials/related');
const footer = require('./partials/footer');
const measurement = require('./partials/measurement');

// Every claim on the page resolves through verified-facts.json. The content
// object carries keys, never literals, so the generator cannot invent a
// rating, a quote or a number.
function resolve(page, site, facts) {
  const b = page.bridge || {};
  const proofKeys = b.proof || {};
  const proof = {};
  if (proofKeys.rating_key) {
    const r = facts.proof[proofKeys.rating_key];
    if (!r) throw new Error(`Unknown proof key: ${proofKeys.rating_key}`);
    proof.rating = { value: r.value, label: r.label || `App Store rating, ${site.name}` };
  }
  if (proofKeys.review_key) {
    const r = facts.proof[proofKeys.review_key];
    if (!r) throw new Error(`Unknown proof key: ${proofKeys.review_key}`);
    proof.review = { quote: r.quote, author: r.author };
  }
  if (proofKeys.stat_key) {
    const s = facts.proof[proofKeys.stat_key];
    if (!s) throw new Error(`Unknown proof key: ${proofKeys.stat_key}`);
    proof.stat = { value: s.value, label: s.label };
  }
  const allow = facts.app_screens_allowlist || [];
  const app_screens = (b.app_screens || []).map((name) => {
    const hit = allow.find((u) => u === name || u.endsWith('/' + name));
    if (!hit) throw new Error(`App screen not in allowlist: ${name}`);
    const alt = (facts.app_screen_alt && facts.app_screen_alt[hit.split('/').pop()]) || 'Screen from the iEatz app';
    return { src: hit, alt };
  });
  const beats = b.beats && b.beats.length ? b.beats : facts.universal.bridge_beats;
  const inter = (page.interstitials || []).map((blk) => {
    const out = Object.assign({}, blk);
    if (blk.style === 'pull_quote') {
      const q = facts.proof[blk.quote_key];
      if (!q) throw new Error(`Unknown quote key: ${blk.quote_key}`);
      out.resolved = { quote: { quote: q.quote, author: q.author } };
    }
    if (blk.style === 'stat') {
      const s = facts.proof[blk.stat_key];
      if (!s) throw new Error(`Unknown stat key: ${blk.stat_key}`);
      out.resolved = { stat: { value: s.value, label: s.label } };
    }
    return out;
  });
  return { proof, app_screens, beats, interstitials: inter };
}

function itemsWithInterstitials(site, page, resolved) {
  const n = page.recipes.length;
  const slots = interstitial.positions(n);
  const blocks = resolved.interstitials;
  const out = [];
  page.recipes.forEach((r, i) => {
    out.push(recipeCard.render(site, page, r, i));
    const k = slots.indexOf(i + 1);
    if (k !== -1 && blocks[k]) out.push(interstitial.render(site, blocks[k], blocks[k].resolved || {}));
  });
  return out.join('\n\n');
}

function render(page, site, facts) {
  const resolved = resolve(page, site, facts);
  const order = SECTION_ORDERS[page.sectionOrder || 'advertorial'];
  if (!order) throw new Error(`Unknown sectionOrder: ${page.sectionOrder}`);
  const sections = {
    hero: () => hero.render(site, page),
    short_answer: () => hero.shortAnswer(site, page),
    bridge: () => bridge.render(site, page, resolved),
    jump_list: () => (page.jump_list === false ? '' : jumpList.render(site, page)),
    items: () => itemsWithInterstitials(site, page, resolved),
    supporting: () => (page.supporting_sections || []).map((s) => supporting.render(site, page, s)).join('\n\n'),
    faq: () => (page.faq && page.faq.length ? faq.render(site, page) : ''),
    related: () => related.render(site, page),
  };
  const main = order.map((k) => sections[k]()).filter(Boolean).join('\n\n');
  const accent = page.accent && page.accent !== 'green' ? ` data-accent="${page.accent}"` : '';
  return `<!DOCTYPE html>
<html lang="en"${accent}>
<head>
${head.render(site, page)}
</head>
<body>
<div style="background:#F5F2EA;font-family:'Inter Tight',system-ui,sans-serif;color:#0A0F0C">

${stickyHeader.render(site)}

<main>

${main}

</main>

${footer.finalCta(site, page)}

${footer.footer(site, page)}

${footer.stickyBar(site)}

</div>
${measurement.render(page)}
</body>
</html>
`;
}

module.exports = { render, resolve, SECTION_ORDERS };
