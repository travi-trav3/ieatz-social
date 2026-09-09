'use strict';
// Rules as code: which Pinterest posts earn a landing page. Runs after batch
// planning, before any page work. Writes page_status.eligibility on every
// Pinterest post with the reasons, eligible or not, so the answer to "why did
// this post get a page" is in the ledger.

const U = require('./util');
const L = require('./ledger');

const ENUMERABLE = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty)\b[^.]{0,40}\b(recipes?|ideas?|meals?|dinners?|breakfasts?|lunches?|snacks?|lists?|swaps?|ways)\b/i;
const HOWTO = /\b(how to|how do i|what (can|should|do) i (make|cook|do)|what to (make|cook|do) with)\b/i;
const QUESTION_OR_LIST = /(\?$|^(how|what|which|can|why|when)\b|^\d+\b|\b(ideas|recipes|ways|swaps|meals|dinners|breakfasts|lunches|snacks)\b)/i;
const NON_SEARCH_PILLARS = /\b(brand|proof|quote|stat|product[- ]feature|feature)\b/i;
const DIETS = ['keto', 'vegan', 'paleo', 'gluten-free', 'gluten free', 'dairy-free', 'low-carb', 'low carb', 'whole30', 'vegetarian', 'plant-based'];

function textOf(config, post) {
  return [L.field(config, post, 'title'), L.field(config, post, 'text'), L.field(config, post, 'pinterestTitle')].filter(Boolean).join(' ');
}

function weeklyPagesUsed(corpus, now = new Date()) {
  const week = U.isoWeek(now);
  return (corpus.pages || []).filter((p) => p.deployed_at && U.isoWeek(new Date(p.deployed_at)) === week).length;
}

function scorePost(post, ctx) {
  const { config, facts, corpus } = ctx;
  const reasons = [];
  const out = { score: 0, eligible: false, reasons, hard_exclude: null, existing_page: null };
  const fail = (code, why) => { out.hard_exclude = code; reasons.push(`exclude: ${why}`); return out; };

  if (!L.isPinterest(config, post)) return fail('not_pinterest', 'not a Pinterest post');
  const pillar = String(L.field(config, post, 'pillar') || '');
  const query = String(L.field(config, post, 'query_target') || '').trim();
  if (NON_SEARCH_PILLARS.test(pillar) && !query) return fail('pillar', `pillar "${pillar}" with no search query behind it`);
  if (!query) return fail('no_query', 'query_target is empty');

  for (const p of corpus.pages || []) {
    const sim = U.cosine(U.tokenize(query), U.tokenize(p.query));
    if (sim > config.eligibility.existingPageSimilarity) {
      out.existing_page = p.url;
      return fail('existing_page', `query is ${sim.toFixed(2)} similar to /recipes/${p.slug}/; reuse that URL`);
    }
  }
  const recipe = post.recipe || post.concept_recipe;
  if (recipe && recipe.ingredients) {
    for (const c of corpus.recipes || []) {
      const jac = U.jaccard(U.tokenize(c.ingredients.join(' ')), U.tokenize(recipe.ingredients.join(' ')));
      if (jac > config.eligibility.recipeJaccard && (!c.primary_protein || c.primary_protein === recipe.primary_protein) && (!c.method || c.method === recipe.method)) {
        return fail('recipe_dupe', `recipe duplicates published "${c.name}" (jaccard ${jac.toFixed(2)})`);
      }
    }
  } else {
    reasons.push('note: no recipe on the post; recipe dedupe runs at validation');
  }
  const used = weeklyPagesUsed(corpus) + (ctx.plannedThisRun || 0);
  if (used >= config.pages.weeklyCap) return fail('weekly_cap', `weekly cap of ${config.pages.weeklyCap} pages already met (${used})`);
  const hay = (query + ' ' + textOf(config, post)).toLowerCase();
  const dietHit = DIETS.find((d) => hay.includes(d));
  if (dietHit && !(facts.diets_supported || []).map((d) => d.toLowerCase()).includes(dietHit)) return fail('diet', `targets "${dietHit}" while diets_supported is ${JSON.stringify(facts.diets_supported)}`);

  const title = textOf(config, post);
  let score = 0;
  if (ENUMERABLE.test(title) || ENUMERABLE.test(query)) { score += 35; reasons.push('+35 title promises enumerable content'); }
  if (HOWTO.test(title) || HOWTO.test(query)) { score += 25; reasons.push('+25 how-to or what-to-make-with'); }
  if (/ingredient idea|persona spotlight/i.test(pillar)) { score += 20; reasons.push(`+20 pillar "${pillar}"`); }
  const niche = L.field(config, post, 'niche') || {};
  if (niche.inventory && niche.constraint && niche.outcome) { score += 10; reasons.push('+10 niche has all three axes'); }
  if (QUESTION_OR_LIST.test(query)) { score += 10; reasons.push('+10 query is question-shaped or list-shaped'); }
  out.score = Math.min(100, score);
  out.eligible = out.score >= config.eligibility.threshold;
  reasons.push(`${out.eligible ? 'eligible' : 'not eligible'}: ${out.score} vs threshold ${config.eligibility.threshold}`);
  return out;
}

// Scores every post in a ledger, in ledger order, and writes page_status.
function runEligibility(ledger, ctx) {
  const { config } = ctx;
  let planned = 0;
  const results = [];
  for (const post of ledger.posts) {
    if (!L.isPinterest(config, post)) continue;
    const r = scorePost(post, Object.assign({}, ctx, { plannedThisRun: planned }));
    post.page_status = post.page_status || {};
    post.page_status.eligibility = { score: r.score, eligible: r.eligible, reasons: r.reasons, hard_exclude: r.hard_exclude };
    if (r.existing_page) post.page_status.existing_page = r.existing_page;
    if (!post.page_status.state) post.page_status.state = r.eligible ? 'planned' : 'skipped';
    if (r.eligible) planned++;
    results.push({ id: L.field(config, post, 'id'), ...r });
  }
  return results;
}

module.exports = { scorePost, runEligibility, weeklyPagesUsed };
