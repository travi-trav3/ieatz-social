'use strict';
// Authors the full `page` object for an eligible concept.
//
// Two modes (config.generator.mode):
//   session  The pipeline is driven by Claude inside a Cowork / Claude Code
//            session. This module writes content/<id>.prompt.md and the run
//            pauses; the session writes content/<id>.json, then the run is
//            re-invoked and picks it up. No API key needed.
//   api      Calls the Claude API directly with @anthropic-ai/sdk. Needs
//            ANTHROPIC_API_KEY (or an `ant auth login` profile).
//
// Either way the result goes through validate-page.js before anything
// renders, and the utility self-check is recorded on page_status.

const fs = require('fs');
const path = require('path');
const U = require('./util');
const { validateObject } = require('./validate-page');

const CONTENT_DIR = path.join(U.PAGES_DIR, 'content');

function contentPath(id) {
  return path.join(CONTENT_DIR, `${id}.json`);
}

function buildPrompt(concept, ctx) {
  const { config, facts, corpus } = ctx;
  const schema = fs.readFileSync(path.join(U.PAGES_DIR, 'schema/page.schema.json'), 'utf8');
  const example = fs.readFileSync(path.join(U.PAGES_DIR, 'templates/pinterest-roundup/golden/example.content.json'), 'utf8');
  const published = (corpus.pages || []).map((p) => `- /recipes/${p.slug}/ : "${p.query}" (${p.tags.join(', ')})`).join('\n') || '- none yet';
  const recipesPublished = (corpus.recipes || []).map((r) => `- ${r.name} [${r.ingredients.join(', ')}]`).join('\n') || '- none yet';
  const prevTypes = ((corpus.supporting_types_by_page || []).slice(-1)[0] || {}).types || [];
  const live = (corpus.pages || []).filter((p) => p.state === 'live').length;
  const linksRule = live < config.pages.internalLinks.bootstrapUntilCorpusSize
    ? `internal_links must be exactly two entries: {"title":"All recipes","url":"${config.site.origin}${config.site.recipes_path}"} and {"title":"${config.site.name}","url":"${config.site.origin}/"}.`
    : `internal_links: ${config.pages.internalLinks.min} to ${config.pages.internalLinks.max} entries chosen from the published pages by tag overlap, url in the form ${config.site.origin}/recipes/<slug>/.`;
  const provenance = config.pages.requireReview ? facts.universal.provenance_line_reviewed : facts.universal.provenance_line_unreviewed;

  return `You are writing the content object for one landing page on ${config.site.origin}/recipes/. A Pinterest pin will link to it with a "get the recipes" CTA. Output ONE JSON object and nothing else. It must validate against the JSON Schema below (draft 2020-12) and pass the rules that follow. Copy the field layout of the example exactly.

## The concept
${JSON.stringify({ id: concept.id, pillar: concept.pillar, query_target: concept.query_target, niche: concept.niche, tags: concept.tags || [], title: concept.title || null, text: concept.text || null }, null, 2)}

## Rules the validator enforces (each one fails the page)
- No em dashes anywhere. No emoji. Sentence case headlines.
- h1 is question-shaped (ends with ?) or list-shaped, and matches the pin promise: "${concept.query_target}".
- hero.opener is two paragraphs that put the reader in the moment: a specific time or place, two concrete frictions. hero.pain_line names the real cost in one short sentence. hero.time_stamp is the clock from the opener (or null).
- hero.direct_answer is two sentences: sentence one answers the h1 literally and names every recipe by name; sentence two says they are all below in full, free.
- ${config.pages.recipesPerRoundup.min} to ${config.pages.recipesPerRoundup.max} recipes. Each: a real ingredient list with quantities first, 3 to 6 steps with one action each, time_minutes within the promise, servings, protein_g as an integer estimate, a one-line why_it_works, a Pinterest-search alt and pin_description, primary_protein and method words. None may resemble a published recipe.
- Every recipe must be makeable within the constraint "${concept.niche.constraint}".
- bridge.body: the one axis only. The page is good and it is also a guess about the reader's kitchen; iEatz starts from what is actually in there; name three things and it writes the rest. Use *...* once for the serif emphasis and ==...== once for the highlight, as in the example. Never "download for more recipes". Share no sentence with a published page. bridge.headline may vary in wording from "${facts.universal.bridge_headline}" but not in meaning. bridge.beats stays []. bridge.app_screens is ["app-receipt.jpg", "app-oatmeal.jpg"]. bridge.proof is {"rating_key":"app_store_rating","review_key":"review_sixsocks","stat_key":"recipes_per_day"}.
- Exactly ${config.pages.supportingSections} supporting_sections with real utility (not a recap), types from the schema enum and NOT in ${JSON.stringify(prevTypes)}. A rows table is optional; a footnote must label any figures as estimates or rounded.
- Exactly 3 faq pairs phrased the way people search (each q ends with ?).
- interstitials: [{"style":"photo_band","line":"Three things you already have. That is the whole input.","image":null},{"style":"dark_strip","line":"<a one-sentence question that calls back to the hero moment>"}].
- ${linksRule}
- 400 to 700 words of useful content outside the recipes. Not padded.
- No number outside the recipes unless it is one of ${JSON.stringify(facts.numbers_allowed_outside_recipes)} or comes straight from a recipe's time, protein, servings or ingredient quantities. No rating, quote, or usage figure typed as text; those come from keys.
- Never claim an app feature outside ${JSON.stringify(facts.features_claimable)}. Never mention ${JSON.stringify(facts.features_never_claim)}.
- No diet targeting or diet labels (diets_supported is ${JSON.stringify(facts.diets_supported)}).
- Every image field is null. Images are sourced after writing. Write alt and pin_description on every recipe anyway.
- showPlayStore false. sectionOrder "${config.pages.defaultSectionOrder}". accent "green". type "roundup". slug: lowercase words joined by hyphens, under 60 characters, matching the h1.
- provenance_line must be exactly: "${provenance}"
- final_cta.headline: the payoff of the hero's moment, one line. final_cta.image null.
- cta: {"arm":"lp","destination":"page","url":"","campaign_token":"pin-lp","utm":{"utm_source":"pinterest","utm_medium":"organic","utm_campaign":"","utm_content":""},"pin_cta_copy":""}
- page_status: {"eligibility":{"score":0,"eligible":true,"reasons":[]},"state":"generated","url":"","live_verified_at":"","failure":null,"fallback_used":false,"utility_check":{"passed":true,"note":"<one sentence: why this page helps someone even if the app did not exist>"}}. If you cannot honestly write that note, set passed to false and explain.

## Already published (do not reuse a query, a recipe, or a bridge sentence)
Pages:
${published}
Recipes:
${recipesPublished}

## JSON Schema
${schema}

## Example content object (the golden fixture; note it deliberately contains em dashes and a Play Store badge that the validator rejects on a real page)
${example}
`;
}

async function callApi(prompt, config) {
  const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: config.generator.model,
    max_tokens: config.generator.maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort: config.generator.effort },
    system: 'You write recipe landing pages for iEatz Healthy. You output only valid JSON.',
    messages: [{ role: 'user', content: prompt }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error(`generator refused: ${(msg.stop_details && msg.stop_details.category) || 'unknown'}`);
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('generator returned no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

async function utilityCheckApi(obj, config) {
  const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: config.generator.model,
    max_tokens: 2000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    messages: [{ role: 'user', content: `Read this landing page content object. Would this page help someone even if the iEatz app did not exist? Answer with JSON only: {"passed": true|false, "note": "<one sentence>"}\n\n${JSON.stringify(obj.page)}` }],
  });
  const msg = await stream.finalMessage();
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

// Returns {status: 'ready', obj} | {status: 'awaiting_session', promptPath} | {status: 'failed', errors}
async function generate(concept, ctx) {
  const { config } = ctx;
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  const out = contentPath(concept.id);
  const promptPath = path.join(CONTENT_DIR, `${concept.id}.prompt.md`);
  const prompt = buildPrompt(concept, ctx);

  const finish = (obj, attempt) => {
    obj.id = obj.id || concept.id;
    obj.pillar = obj.pillar || concept.pillar;
    obj.query_target = obj.query_target || concept.query_target;
    obj.niche = obj.niche || concept.niche;
    obj.tags = obj.tags && obj.tags.length ? obj.tags : concept.tags || [];
    const v = validateObject(obj, ctx);
    return { obj, v, attempt };
  };

  if (config.generator.mode === 'session') {
    if (fs.existsSync(out)) {
      const obj = U.readJson(out);
      const { v } = finish(obj, 1);
      if (v.ok) return { status: 'ready', obj, warnings: v.warnings };
      fs.writeFileSync(promptPath, prompt + `\n\n## Your previous attempt failed validation. Fix every item and write the file again.\n${v.errors.map((e) => '- ' + e).join('\n')}\n`);
      return { status: 'failed', errors: v.errors, promptPath, obj };
    }
    fs.writeFileSync(promptPath, prompt);
    return { status: 'awaiting_session', promptPath, contentPath: out };
  }

  let lastErrors = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    let obj;
    try { obj = await callApi(attempt === 1 ? prompt : prompt + `\n\n## Previous attempt failed validation. Fix every item.\n${lastErrors.map((e) => '- ' + e).join('\n')}`, config); }
    catch (e) { lastErrors = [`api: ${e.message}`]; continue; }
    const check = await utilityCheckApi(obj, config);
    obj.page_status = obj.page_status || {};
    obj.page_status.utility_check = check;
    const { v } = finish(obj, attempt);
    if (v.ok && check.passed) { U.writeJson(out, obj); return { status: 'ready', obj, warnings: v.warnings, attempts: attempt }; }
    lastErrors = v.errors.concat(check.passed ? [] : [`utility-check: ${check.note}`]);
  }
  return { status: 'failed', errors: lastErrors };
}

module.exports = { generate, buildPrompt, contentPath, CONTENT_DIR };
