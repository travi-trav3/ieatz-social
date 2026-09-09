'use strict';
// Fail-closed validation of a content object and of the rendered HTML.
// Every rule in BRIEF.md sections 10, 13 and 15 that code can check lives
// here, each with a readable reason. Prose rules that are not checked are
// not rules.

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const U = require('./util');

const schema = U.readJson(path.join(U.PAGES_DIR, 'schema/page.schema.json'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

const DIET_WORDS = ['keto', 'vegan', 'paleo', 'gluten-free', 'gluten free', 'dairy-free', 'dairy free', 'low-carb', 'low carb', 'whole30', 'vegetarian', 'plant-based', 'plant based', 'pescatarian', 'diabetic', 'fodmap'];
const PROPER = new Set(['iEatz', 'Greek', 'App', 'Store', 'USDA', 'Instacart', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Parmesan', 'Dijon', 'Cajun', 'Thai', 'Italian', 'Mexican', 'Japanese', 'Korean', 'Chinese', 'Indian', 'French', 'Mediterranean', 'Sriracha', 'Tabasco', 'Costco', 'Trader', "Joe's", 'Buffalo', 'I', 'Fridge', 'Table']);

function titleCaseViolation(s) {
  const words = String(s).split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  if (words.length < 4) return false;
  const caps = words.slice(1).filter((w) => /^[A-Z]/.test(w) && !PROPER.has(w.replace(/[^A-Za-z']/g, '')));
  return caps.length / (words.length - 1) > 0.5;
}

function numbersIn(s) {
  return (String(s).match(/\$?\d[\d,]*(?:\.\d+)?\+?/g) || []).map((n) => n.replace(/,/g, ''));
}

function prose(page, opts = {}) {
  // Useful content outside the recipes. opts.forNumbers drops the rows of a
  // supporting table: those figures are per-ingredient recipe math, not claims.
  const parts = [page.h1, ...(page.hero.opener || []), page.hero.pain_line, page.hero.direct_answer, page.bridge.headline, page.bridge.body, page.list_headline];
  for (const s of page.supporting_sections || []) {
    parts.push(s.heading);
    parts.push(...(Array.isArray(s.body) ? s.body : [s.body]));
    if (!opts.forNumbers) for (const r of s.rows || []) parts.push(r.note);
    if (s.footnote) parts.push(s.footnote);
  }
  for (const f of page.faq || []) parts.push(f.q, f.a);
  for (const b of page.interstitials || []) if (b.line) parts.push(b.line);
  parts.push(page.final_cta.headline);
  return parts.filter(Boolean).join(' ');
}

function allowedNumbers(page, facts) {
  const allow = new Set(facts.numbers_allowed_outside_recipes.map(String));
  for (const k of Object.keys(facts.proof)) if (facts.proof[k].value) allow.add(String(facts.proof[k].value));
  allow.add(String(page.recipes.length));
  for (const r of page.recipes) {
    allow.add(String(r.time_minutes));
    allow.add(String(r.protein_g));
    allow.add(String(r.servings));
    for (const line of [...r.ingredients, ...r.steps, r.why_it_works, r.description]) numbersIn(line).forEach((n) => allow.add(n));
  }
  if (page.hero.time_stamp) numbersIn(page.hero.time_stamp.replace(':', ' ')).forEach((n) => allow.add(n));
  for (const s of page.supporting_sections || []) for (const row of s.rows || []) numbersIn(row.value).forEach((n) => allow.add(n));
  return allow;
}

// ---------------------------------------------------------------------------

function validateObject(obj, ctx) {
  const { config, facts, corpus } = ctx;
  const mode = ctx.mode || 'production';
  const errors = [];
  const warnings = [];
  const err = (rule, msg) => errors.push(`[${rule}] ${msg}`);
  const warn = (rule, msg) => warnings.push(`[${rule}] ${msg}`);

  if (!validateSchema(obj)) {
    for (const e of validateSchema.errors.slice(0, 20)) err('schema', `${e.instancePath || '/'} ${e.message}`);
    return { ok: false, errors, warnings };
  }
  const page = obj.page;

  // Lint: em dashes, emoji, placeholders, never_say.
  U.walkStrings(page, (s, where) => {
    if (U.EM_DASH.test(s)) err('em-dash', `em dash in page.${where}: "${s.slice(0, 60)}"`);
    if (U.EMOJI.test(s)) err('emoji', `emoji in page.${where}`);
    if (/\[\[|SET_ME|PROVIDER_TOKEN|TODO|lorem ipsum|placeholder/i.test(s) && !/^_/.test(where)) err('placeholder', `placeholder text in page.${where}: "${s.slice(0, 60)}"`);
    for (const t of facts.never_say || []) if (s.toLowerCase().includes(t.toLowerCase())) err('never-say', `"${t}" in page.${where}`);
    for (const t of facts.features_never_claim || []) if (s.toLowerCase().includes(t.toLowerCase())) err('feature-claim', `unshipped feature "${t}" in page.${where}`);
  });
  U.walkStrings(obj.cta || {}, (s, where) => { if (U.EM_DASH.test(s)) err('em-dash', `em dash in cta.${where}`); });

  // Headlines in sentence case.
  const heads = [['h1', page.h1], ['list_headline', page.list_headline], ['bridge.headline', page.bridge.headline], ['final_cta.headline', page.final_cta.headline]];
  (page.supporting_sections || []).forEach((s, i) => heads.push([`supporting_sections.${i}.heading`, s.heading]));
  page.recipes.forEach((r, i) => heads.push([`recipes.${i}.name`, r.name]));
  for (const [where, s] of heads) if (titleCaseViolation(s)) err('sentence-case', `Title Case headline at page.${where}: "${s}"`);

  // H1 is question-shaped or list-shaped and matches the pin promise.
  const h1 = page.h1.trim();
  const listShaped = /^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty)\b/i.test(h1) || /\b(ways|ideas|recipes|meals|dinners|breakfasts|lunches|snacks|swaps|lists)\b/i.test(h1);
  if (!h1.endsWith('?') && !listShaped) err('h1-shape', `h1 is neither question-shaped nor list-shaped: "${h1}"`);
  const promise = U.significant(obj.query_target);
  const overlap = promise.filter((w) => h1.toLowerCase().includes(w)).length;
  if (promise.length && overlap / promise.length < 0.5) err('h1-promise', `h1 shares under half its significant words with query_target ("${obj.query_target}")`);

  // Direct answer: present, short, names every recipe, glued to the hero.
  const da = page.hero.direct_answer;
  if (U.sentences(da).length > 3) err('direct-answer', 'direct_answer runs past three sentences');
  for (const r of page.recipes) {
    const words = U.significant(r.name);
    const hits = words.filter((w) => da.toLowerCase().includes(w)).length;
    if (hits < Math.min(2, words.length)) err('direct-answer', `direct_answer does not name "${r.name}"`);
  }
  if (!/\b(below|further down|down the page|in full)\b/i.test(da)) warn('direct-answer', 'direct_answer does not say the recipes are below in full');

  // Recipes: count, quantities, steps, unique anchors, dedupe.
  const rc = config.pages.recipesPerRoundup;
  if (page.recipes.length < rc.min || page.recipes.length > rc.max) err('recipe-count', `${page.recipes.length} recipes; roundup needs ${rc.min} to ${rc.max}`);
  const anchors = new Set();
  page.recipes.forEach((r, i) => {
    if (anchors.has(r.anchor)) err('anchor', `duplicate anchor ${r.anchor}`);
    anchors.add(r.anchor);
    const quantified = r.ingredients.filter((l) => /^\s*(\d|½|¼|¾|⅓|a |one |two |half |pinch|handful|splash|drizzle|to taste|optional|flaky|salt|pepper|scallion|salsa)/i.test(l)).length;
    if (quantified / r.ingredients.length < 0.6) err('quantities', `recipes.${i} "${r.name}": fewer than 60% of ingredient lines carry a quantity`);
    if (r.time_minutes && obj.niche && /\b(\d+)\s*min/i.test(obj.niche.constraint || '')) {
      const cap = parseInt(/(\d+)\s*min/i.exec(obj.niche.constraint)[1], 10);
      if (r.time_minutes > cap) err('promise', `recipes.${i} takes ${r.time_minutes} min but the promise is ${cap} min`);
    }
    for (let j = 0; j < i; j++) {
      const a = page.recipes[j];
      const jac = U.jaccard(U.tokenize(a.ingredients.join(' ')), U.tokenize(r.ingredients.join(' ')));
      if (jac > config.eligibility.recipeJaccard) err('recipe-dupe', `recipes.${i} duplicates recipes.${j} on ingredients (jaccard ${jac.toFixed(2)})`);
    }
    for (const c of corpus.recipes || []) {
      if (c.page === page.slug) continue;
      const jac = U.jaccard(U.tokenize(c.ingredients.join(' ')), U.tokenize(r.ingredients.join(' ')));
      const sameShape = (!c.primary_protein || !r.primary_protein || c.primary_protein === r.primary_protein) && (!c.method || !r.method || c.method === r.method);
      if (jac > config.eligibility.recipeJaccard && sameShape) err('recipe-dupe', `recipes.${i} "${r.name}" duplicates published recipe "${c.name}" on /recipes/${c.page}/ (jaccard ${jac.toFixed(2)})`);
      if (c.name.toLowerCase() === r.name.toLowerCase()) err('recipe-dupe', `recipes.${i} reuses the published name "${c.name}"`);
    }
  });

  // Estimates are labeled.
  const disclaimers = [page.provenance_line, ...(page.supporting_sections || []).map((s) => s.footnote || '')].join(' ');
  if (!/\b(estimate|estimates|rounded|averages|approximate)\b/i.test(disclaimers)) err('estimate-label', 'no line labels the protein figures as estimates (provenance line or a supporting footnote must)');

  // Bridge: one axis, no shared sentence with the corpus.
  const body = page.bridge.body;
  if (!/(guess|assum|already|actually|in there|what is in|what you have|whatever is)/i.test(body)) err('bridge-axis', 'bridge body does not express the axis (the page is a guess about the kitchen, the app is not)');
  if (/download for more|more recipes/i.test(body)) err('bridge-axis', 'bridge body pitches "more recipes"');
  for (const s of U.sentences(body.replace(/[*=]/g, ''))) {
    if ((corpus.bridge_sentences || []).some((x) => x.page !== page.slug && x.sentence.toLowerCase() === s.toLowerCase())) err('bridge-unique', `bridge sentence already published: "${s.slice(0, 60)}"`);
  }

  // Supporting sections: count and rotation.
  const want = config.pages.supportingSections;
  if (mode === 'production' && (page.supporting_sections || []).length < want) err('supporting-count', `${page.supporting_sections.length} supporting sections; need ${want}`);
  const prev = (corpus.supporting_types_by_page || []).filter((x) => x.page !== page.slug).slice(-1)[0];
  if (prev) for (const s of page.supporting_sections) if (prev.types.includes(s.type)) err('supporting-rotate', `supporting type "${s.type}" repeats the previous page (${prev.page})`);

  // FAQ phrased as search.
  for (const f of page.faq) if (!f.q.trim().endsWith('?')) err('faq-shape', `FAQ question is not a question: "${f.q}"`);

  // Internal links.
  const links = page.internal_links || [];
  const corpusUrls = new Set((corpus.pages || []).filter((p) => p.state === 'live' && p.slug !== page.slug).map((p) => p.url));
  const hub = `${config.site.origin}${config.site.recipes_path}`;
  const home = `${config.site.origin}/`;
  const livePages = corpusUrls.size;
  if (mode === 'production') {
    if (livePages < config.pages.internalLinks.bootstrapUntilCorpusSize) {
      const set = new Set(links.map((l) => l.url));
      const okSet = set.size === 2 && (set.has(hub) || set.has(config.site.recipes_path)) && (set.has(home) || set.has('/'));
      if (!okSet) err('links-bootstrap', `with ${livePages} live pages, internal_links must be exactly the hub index and the homepage`);
    } else {
      if (links.length < config.pages.internalLinks.min || links.length > config.pages.internalLinks.max) err('links-count', `${links.length} internal links; need ${config.pages.internalLinks.min} to ${config.pages.internalLinks.max}`);
      for (const l of links) if (!corpusUrls.has(l.url) && l.url !== hub && l.url !== home) err('links-live', `internal link to a page that is not live: ${l.url}`);
    }
  }

  // Word budget outside the recipes.
  const words = U.wordCount(prose(page));
  const pw = config.pages.proseWords;
  if (mode === 'production' && (words < pw.min || words > pw.max)) err('prose-words', `${words} words of content outside the recipes; need ${pw.min} to ${pw.max}`);

  // Numbers: nothing outside the recipes that is not verified or recipe-derived.
  const allow = allowedNumbers(page, facts);
  for (const n of numbersIn(prose(page, { forNumbers: true }))) {
    const bare = n.replace(/^\$/, '').replace(/\+$/, '');
    if (!allow.has(n) && !allow.has(bare)) err('unverified-number', `"${n}" appears outside the recipes and is not in verified-facts.json or derived from a recipe`);
  }

  // Facts freshness and proof keys.
  for (const key of [page.bridge.proof.rating_key, page.bridge.proof.review_key, page.bridge.proof.stat_key].filter(Boolean)) {
    const f = facts.proof[key];
    if (!f) { err('proof-key', `unknown proof key ${key}`); continue; }
    const age = U.daysSince(f.verified);
    if (age > config.validate.factsFailDays) err('facts-stale', `${key} verified ${f.verified || 'never'} (over ${config.validate.factsFailDays} days)`);
    else if (age > config.validate.factsWarnDays) warn('facts-stale', `${key} verified ${f.verified} (over ${config.validate.factsWarnDays} days)`);
  }
  for (const b of page.interstitials || []) {
    if (b.style === 'pull_quote' && !facts.proof[b.quote_key]) err('proof-key', `unknown quote key ${b.quote_key}`);
    if (b.style === 'stat' && !facts.proof[b.stat_key]) err('proof-key', `unknown stat key ${b.stat_key}`);
  }
  const styles = (page.interstitials || []).map((b) => b.style);
  if (new Set(styles).size !== styles.length) err('interstitial-rotate', 'the same interstitial style twice on one page');

  // App screens, Play Store, diets.
  for (const s of page.bridge.app_screens || []) if (!(facts.app_screens_allowlist || []).some((u) => u === s || u.endsWith('/' + s))) err('app-screen', `app screen not in allowlist: ${s}`);
  if (page.showPlayStore && !facts.store_urls.play_store) err('play-store', 'showPlayStore is true while play_store is null');
  if (!(facts.diets_supported || []).length) {
    const fields = [obj.query_target, page.h1, page.title_tag, page.hero.eyebrow, page.meta_description, ...page.recipes.map((r) => r.name + ' ' + r.description)].join(' ').toLowerCase();
    for (const d of DIET_WORDS) if (fields.includes(d)) err('diet', `"${d}" claim while diets_supported is empty`);
  }

  // Provenance line matches the review gate.
  if (!config.pages.requireReview && /edited by a person/i.test(page.provenance_line)) err('provenance', 'provenance line claims human editing while pages.requireReview is false');

  // Utility self-check recorded by the generator.
  if (mode === 'production') {
    const u = obj.page_status && obj.page_status.utility_check;
    if (!u || u.passed !== true) err('utility-check', 'page_status.utility_check.passed is not true (would this page help someone even if the app did not exist?)');
  }

  return { ok: errors.length === 0, errors, warnings, words };
}

// ---------------------------------------------------------------------------

function hostsIn(html) {
  const hosts = new Set();
  for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) hosts.add(new URL(m[1]).hostname);
  for (const m of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    if (/application\/ld\+json/.test(m[0])) continue;
    for (const u of m[1].matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) hosts.add(u[1].toLowerCase());
  }
  return [...hosts];
}

function validateHtml(html, ctx) {
  const { obj, config, facts, site, willExist = new Set() } = ctx;
  const errors = [];
  const warnings = [];
  const err = (rule, msg) => errors.push(`[${rule}] ${msg}`);
  const warn = (rule, msg) => warnings.push(`[${rule}] ${msg}`);
  const page = obj.page;
  const repo = site.website_repo;

  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > config.pages.htmlMaxBytes) err('size', `${bytes} bytes; limit ${config.pages.htmlMaxBytes}`);
  if (U.EM_DASH.test(html)) err('em-dash', 'em dash in rendered HTML');
  for (const t of ['PROVIDER_TOKEN', '[[', 'SET_ME', 'VERIFY —', 'ASSET SLOT', 'border:1px dashed', 'undefined', 'NaN', '[object Object]']) {
    if (html.includes(t)) err('placeholder', `"${t}" survives in rendered HTML`);
  }
  if (!site.store.provider_token) warn('campaign-token', 'no APPLE_PROVIDER_TOKEN in the environment; store links carry no pt/ct');

  // JSON-LD.
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => {
    try { return JSON.parse(m[1]); } catch (e) { err('jsonld', `JSON-LD does not parse: ${e.message}`); return null; }
  }).filter(Boolean);
  const types = blocks.map((b) => b['@type']);
  for (const t of ['CollectionPage', 'FAQPage', 'BreadcrumbList']) if (!types.includes(t)) err('jsonld', `missing ${t}`);
  const coll = blocks.find((b) => b['@type'] === 'CollectionPage');
  if (coll) {
    const items = (((coll.mainEntity || {}).itemListElement) || []);
    if (coll.mainEntity && coll.mainEntity.numberOfItems !== items.length) err('jsonld', 'ItemList numberOfItems does not match');
    const ids = new Set([...html.matchAll(/<article id="([^"]+)"/g)].map((m) => m[1]));
    for (const it of items) {
      const item = it.item || {};
      if (item['@type'] !== 'Recipe') err('jsonld', `ItemList item ${it.position} is ${item['@type']}, not Recipe`);
      const frag = String(item['@id'] || '').split('#')[1];
      if (!frag || !ids.has(frag)) err('jsonld', `Recipe @id fragment "${frag}" has no matching on-page anchor`);
      if (!item.image) warn('jsonld', `Recipe "${item.name}" has no image; Google will not show a rich result for it`);
    }
  }

  // OG and canonical.
  for (const p of ['og:title', 'og:description', 'og:image', 'og:url']) if (!new RegExp(`<meta property="${p}" content="[^"]+"`).test(html)) err('og', `missing ${p}`);
  if (!/<link rel="canonical" href="https?:\/\/[^"]+">/.test(html)) err('canonical', 'missing canonical');

  // Script hosts.
  const allowed = new Set(config.validate.allowedScriptHosts);
  for (const h of hostsIn(html)) if (!allowed.has(h)) err('script-host', `script host not allowed: ${h}`);

  // Links and images resolve in the website repo.
  const local = (u) => {
    if (u.startsWith(site.origin)) u = u.slice(site.origin.length);
    if (!u.startsWith('/')) return null;
    return u.split('#')[0].split('?')[0];
  };
  const exists = (p) => {
    if (willExist.has(p)) return true;
    if (!repo) return true;
    const abs = path.join(repo, p);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return true;
    if (fs.existsSync(path.join(abs, 'index.html'))) return true;
    if (p.endsWith('/') && fs.existsSync(path.join(abs, 'index.html'))) return true;
    if (fs.existsSync(abs + '.html')) return true;
    return false;
  };
  for (const m of html.matchAll(/<a [^>]*href="([^"]+)"/g)) {
    const p = local(m[1]);
    if (p === null || p === '') continue;
    if (!exists(p)) err('link', `internal link does not resolve in the website repo: ${m[1]}`);
  }
  for (const m of html.matchAll(/<img [^>]*src="([^"]+)"/g)) {
    const p = local(m[1]);
    if (p === null) { if (!/^https?:\/\//.test(m[1])) err('image', `relative image path: ${m[1]}`); continue; }
    if (!exists(p)) err('image', `image missing from the website repo: ${m[1]}`);
  }
  // App screens on the page are exactly the allowlist entries.
  for (const m of html.matchAll(/<div data-slot="app-screen"[^>]*><img src="([^"]+)"/g)) {
    if (!facts.app_screens_allowlist.includes(m[1])) err('app-screen', `app screen outside allowlist: ${m[1]}`);
  }
  if (!facts.store_urls.play_store && /play\.google\.com/.test(html)) err('play-store', 'Play Store link rendered while play_store is null');
  if (!/<meta name="viewport"/.test(html)) err('viewport', 'missing viewport meta');
  void page;
  return { ok: errors.length === 0, errors, warnings, bytes };
}

module.exports = { validateObject, validateHtml, prose, numbersIn, titleCaseViolation };
