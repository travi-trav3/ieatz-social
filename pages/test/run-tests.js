'use strict';
// Gate 5: the example object passes the validator; deliberately broken
// copies each fail with a readable reason. Gate 6 (fixture): eligibility
// runs against the stand-in ledger. Gate 9 (dry): the router produces a
// destination, token and CTA copy for every Pinterest post, including a
// forced page failure that falls back. Then the golden test.

const path = require('path');
const { execFileSync } = require('child_process');
const U = require('../lib/util');
const sc = require('../lib/site-config');
const { validateObject, validateHtml } = require('../lib/validate-page');
const eligibility = require('../lib/eligibility');
const router = require('../lib/cta-router');
const manifest = require('../lib/wire-manifest');
const renderPage = require('../lib/render-page');
const linkGraph = require('../lib/link-graph');
const { photoFree } = require('./golden');

const config = U.loadConfig();
const facts = U.loadFacts();
const corpus = U.loadCorpus();
const site = sc.productionSite(config, facts);
const ctx = { config, facts, corpus, mode: 'production' };
let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures++;
}
const clone = (o) => JSON.parse(JSON.stringify(o));

// --- validator ----------------------------------------------------------------
const pageOne = U.readJson(path.join(U.PAGES_DIR, 'content/10min-breakfasts-busy-mornings.json'));
const good = validateObject(pageOne, ctx);
check('page one content object passes', good.ok, good.ok ? `${good.words} prose words` : good.errors.join(' | '));

const broken = {
  'duplicate recipe': (o) => { o.page.recipes[1].ingredients = o.page.recipes[0].ingredients.slice(); },
  'em dash': (o) => { o.page.hero.opener[0] = o.page.hero.opener[0].replace('twice,', 'twice —'); },
  'invented stat': (o) => { o.page.bridge.body = o.page.bridge.body.replace('All five are good.', '90% of people say all five are good.'); },
  'missing direct answer recipe': (o) => { o.page.hero.direct_answer = 'In ten minutes you can make whipped cottage cheese toast or savory oats with a jammy egg, and that is honestly all you need. Both are written out in full further down with times and servings.'; },
  'unknown proof key': (o) => { o.page.bridge.proof.stat_key = 'users_million'; },
  'play store while null': (o) => { o.page.showPlayStore = true; },
  'diet claim while unsupported': (o) => { o.page.h1 = 'What keto breakfast can I make in 10 minutes?'; },
  'title case headline': (o) => { o.page.list_headline = 'Five Fast Breakfasts For Busy Mornings In Full'; },
  'unshipped feature': (o) => { o.page.faq[0].a += ' The weekly planner sorts it all.'; },
  'over the promise': (o) => { o.page.recipes[2].time_minutes = 25; },
  'utility check false': (o) => { o.page_status.utility_check.passed = false; },
  'wrong internal links at bootstrap': (o) => { o.page.internal_links = [{ title: 'x', url: 'https://ieatzhealthy.com/recipes/nope/' }]; },
  'schema: too few recipes': (o) => { o.page.recipes = o.page.recipes.slice(0, 2); },
};
for (const [name, mutate] of Object.entries(broken)) {
  const o = clone(pageOne);
  mutate(o);
  const v = validateObject(o, ctx);
  check(`broken copy fails: ${name}`, !v.ok, v.errors[0]);
}

// --- html validator -----------------------------------------------------------
const html = renderPage.render(pageOne, site, facts);
const vh = validateHtml(html, { obj: pageOne, config, facts, site, willExist: new Set(['/recipes/', '/recipes/10-minute-breakfasts-busy-mornings/']) });
check('page one html passes', vh.ok, vh.ok ? `${vh.bytes} bytes; ${vh.warnings.join('; ')}` : vh.errors.join(' | '));
const bad = html.replace('</head>', '<script src="https://cdn.example.com/x.js"></script></head>');
check('html with a foreign script host fails', !validateHtml(bad, { obj: pageOne, config, facts, site }).ok);
const pf = clone(pageOne); pf.page = photoFree(pf.page); pf.page.internal_links = pageOne.page.internal_links;
const pfHtml = renderPage.render(pf, site, facts);
check('photo-free variant renders and validates', validateHtml(pfHtml, { obj: pf, config, facts, site, willExist: new Set(['/recipes/']) }).ok);

// --- eligibility on the stand-in ledger ------------------------------------------
const ledger = U.readJson(path.join(U.PAGES_DIR, 'fixtures/ledger-w25-w27.json'));
const L = { path: null, data: ledger, posts: ledger.posts };
// Eligibility and routing are tested against an empty corpus so the result
// does not drift as real pages get published (the weekly cap counts them).
const emptyCtx = { config, facts, corpus: { pages: [], recipes: [], bridge_sentences: [], supporting_types_by_page: [] } };
const scored = eligibility.runEligibility(L, emptyCtx);
const eligibleIds = scored.filter((s) => s.eligible).map((s) => s.id);
check('eligibility scores every Pinterest post', scored.length === 11, `${scored.length} scored, eligible: ${eligibleIds.join(', ')}`);
check('quote and stat pins are hard-excluded', scored.filter((s) => /quote|stat|hero|life-back|transformation|waste/.test(s.id)).every((s) => s.hard_exclude));
check('enumerable ingredient-idea pin is eligible', eligibleIds.includes('w26-pin-leftover-rice'));
check('instagram post is not scored', !scored.some((s) => s.id === 'w27-ig-chickpea-ideas'));

// --- router and manifest -------------------------------------------------------
router.assignArms(L, config);
const arms = L.posts.filter((p) => p.page_status && p.page_status.eligibility.eligible).map((p) => p.cta.arm);
check('arms alternate lp/direct', arms.every((a, i) => i === 0 || a !== arms[i - 1]), arms.join(','));
// Force one lp page live and one lp page failed.
const lp = L.posts.filter((p) => p.cta && p.cta.arm === 'lp');
if (lp[0]) { lp[0].page = { slug: 'leftover-rice-five-dinners' }; lp[0].page_status.state = 'live'; lp[0].page_status.url = 'https://ieatzhealthy.com/recipes/leftover-rice-five-dinners/'; }
if (lp[1]) { lp[1].page_status.state = 'failed'; lp[1].page_status.failure = 'forced failure for the test'; }
const routes = router.routeAll(L, { config, facts });
const pinPosts = L.posts.filter((p) => p.channel === 'pinterest');
check('every Pinterest post has a destination, url and CTA copy', pinPosts.every((p) => p.cta.destination && p.cta.url && p.cta.pin_cta_copy), routes.map((r) => `${r.id}:${r.cta.destination}`).join(' '));
check('live lp page routes to the page with UTMs', lp[0] && lp[0].cta.destination === 'page' && /utm_source=pinterest/.test(lp[0].cta.url));
check('failed lp page falls back to the store with pin-direct', lp[1] && lp[1].cta.destination === 'app_store' && lp[1].cta.fallback === true && lp[1].cta.campaign_token === 'pin-direct');
const copies = pinPosts.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((p) => p.cta.pin_cta_copy);
check('no CTA copy repeats on consecutive posts', copies.every((c, i) => i === 0 || c !== copies[i - 1]), copies.join(' / '));
let wireRefused = false;
try { const fake = clone(lp[1]); fake.cta.destination = 'page'; manifest.wire(fake, config); } catch (e) { wireRefused = true; }
check('wire-manifest refuses a page URL that is not live', wireRefused);
manifest.wire(lp[0], config);
check('wire-manifest writes the live page URL to pinterest.url', lp[0].pinterest && lp[0].pinterest.url === lp[0].cta.url);

// --- link graph -----------------------------------------------------------------
const sm = linkGraph.updateSitemap('', ['https://ieatzhealthy.com/recipes/a/'], config);
const sm2 = linkGraph.updateSitemap(sm, ['https://ieatzhealthy.com/recipes/a/', 'https://ieatzhealthy.com/recipes/b/'], config);
check('sitemap appends without duplicating', (sm2.match(/<loc>/g) || []).length === 6);
const hub = linkGraph.renderHubIndex(linkGraph.addToCorpus(clone(corpus), pageOne, config, { state: 'live' }), site, config);
check('hub index renders with the page listed', hub.includes('10-minute-breakfasts-busy-mornings') && !/—/.test(hub));

// --- golden -------------------------------------------------------------------
try {
  const out = execFileSync(process.execPath, [path.join(__dirname, 'golden.js')], { encoding: 'utf8' });
  process.stdout.write(out.split('\n').map((l) => (l ? '  ' + l : l)).join('\n'));
  check('golden test', true);
} catch (e) {
  process.stdout.write(String(e.stdout || ''));
  check('golden test', false, String(e.stderr || e.message).split('\n')[0]);
}

console.log(`\n${failures ? `${failures} FAILED` : 'all passed'}`);
process.exit(failures ? 1 : 0);
