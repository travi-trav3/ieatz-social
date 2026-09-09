#!/usr/bin/env node
'use strict';
// node pages/run.js --batch batch-NN [--ledger path] [--concepts path] [--dry-run] [--only <id>] [--run-id id]
//
// Runs the pages phase for one batch, idempotently, from the ledger:
// eligibility -> arms -> (per lp concept) content -> images -> render ->
// validate -> deploy -> verify live -> corpus -> route -> wire -> report.
// Rerunning skips anything already live, retries anything failed once, and
// never creates a second page for the same concept. --dry-run does
// everything except deploy, verify and wire. --only scopes to one concept.

const fs = require('fs');
const path = require('path');
const U = require('./lib/util');
const L = require('./lib/ledger');
const sc = require('./lib/site-config');
const eligibility = require('./lib/eligibility');
const router = require('./lib/cta-router');
const manifest = require('./lib/wire-manifest');
const images = require('./lib/source-images');
const generator = require('./lib/generate-content');
const renderPage = require('./lib/render-page');
const { validateObject, validateHtml } = require('./lib/validate-page');
const linkGraph = require('./lib/link-graph');
const deployPage = require('./lib/deploy-page');
const { verifyLive } = require('./lib/verify-live');

function args() {
  const a = process.argv.slice(2);
  const get = (k) => { const i = a.indexOf(k); return i === -1 ? null : a[i + 1]; };
  return { batch: get('--batch'), ledger: get('--ledger'), concepts: get('--concepts'), dryRun: a.includes('--dry-run'), only: get('--only'), runId: get('--run-id') || U.runId(), assumeLive: get('--assume-live'), evidence: get('--evidence') };
}

function syntheticLedger(conceptsPath, config) {
  const list = U.readJson(conceptsPath);
  const posts = list.map((c) => Object.assign({ channel: 'pinterest' }, c));
  const p = path.resolve(conceptsPath);
  void config;
  return { path: p.replace(/\.json$/, '.ledger.json'), data: { posts, pages_meta: { lastArm: null } }, posts };
}

async function main() {
  const opt = args();
  const config = U.loadConfig();
  const facts = U.loadFacts();
  const corpus = U.loadCorpus();
  const library = U.loadLibrary();
  const site = sc.productionSite(config, facts);
  const ctx = { config, facts, corpus, library, site, runId: opt.runId, mode: 'production' };
  const report = { runId: opt.runId, started: U.nowIso(), dryRun: opt.dryRun, considered: [], pages: [], routes: [], needsTravis: [], notes: [] };
  const log = (s) => { console.log(s); report.notes.push(s); };

  let ledger;
  if (opt.concepts) ledger = syntheticLedger(opt.concepts, config);
  else if (opt.batch || opt.ledger) ledger = L.load(config, opt.batch, opt.ledger);
  else throw new Error('need --batch NN, --ledger path, or --concepts path');

  // 1. Eligibility and arms.
  const scored = eligibility.runEligibility(ledger, ctx);
  report.considered = scored;
  router.assignArms(ledger, config);

  // 2. Pages for lp-arm concepts.
  let deployedThisRun = 0;
  const weekUsed = eligibility.weeklyPagesUsed(corpus);
  const willExist = new Set([`${config.site.recipes_path}`, `${config.site.recipes_path}index.html`, `/${config.site.website_repo.sitemap}`]);
  for (const post of ledger.posts) {
    if (!L.isPinterest(config, post)) continue;
    const id = L.field(config, post, 'id');
    if (opt.only && id !== opt.only) continue;
    // Merge the saved content object first (keeping this run's eligibility
    // verdict), so every state check below reads the real page_status.
    if (!(post.page && post.page.recipes && post.page.recipes.length)) {
      const savedFile = generator.contentPath(id);
      if (fs.existsSync(savedFile)) {
        const saved = U.readJson(savedFile);
        const elig = post.page_status && post.page_status.eligibility;
        Object.assign(post, saved);
        post.page_status = Object.assign({}, saved.page_status || {}, elig ? { eligibility: elig } : {});
        if (!post.cta || !post.cta.arm) post.cta = Object.assign({}, saved.cta || {}, post.cta || {});
      }
    }
    const ps = post.page_status;
    if (!ps || !ps.eligibility.eligible || (post.cta && post.cta.arm !== 'lp')) continue;
    if (ps.state === 'live') { log(`${id}: already live at ${ps.url}, skipping`); continue; }
    if (ps.state === 'failed' && (ps.attempts || 0) >= 2) { log(`${id}: failed twice, not retrying`); continue; }
    ps.attempts = (ps.attempts || 0) + 1;
    const entry = { id, state: null, images: null, validation: null, deploy: null, live: null, fallback_used: false };
    report.pages.push(entry);
    try {
      // 2a. Content: the ledger record, content/<id>.json, or the generator.
      let obj = post;
      if (!(post.page && post.page.recipes && post.page.recipes.length)) {
        const file = generator.contentPath(id);
        if (fs.existsSync(file)) { /* merged above */ }
        else {
          const g = await generator.generate(post, ctx);
          if (g.status === 'awaiting_session') { entry.state = 'awaiting_session'; ps.state = 'planned'; report.needsTravis.push(`${id}: content not written yet. Prompt at ${g.promptPath}; write ${g.contentPath} and rerun.`); continue; }
          if (g.status !== 'ready') throw new Error(`generator failed: ${(g.errors || []).join('; ')}`);
          Object.assign(post, g.obj);
        }
        obj = post;
      }
      // Weekly cap, counted at the moment a page would be built.
      if (ps.state !== 'deployed' && weekUsed + deployedThisRun >= config.pages.weeklyCap) {
        throw new Error(`weekly cap of ${config.pages.weeklyCap} reached`);
      }
      // 2b. A page already deployed but not yet verified goes straight to verify.
      // --assume-live <id> --evidence "..." records a verification performed
      // elsewhere (the website repo's verify-recipes Action) when this
      // environment cannot reach the domain. The evidence lands in the ledger.
      if (ps.state === 'deployed' && ps.url && !opt.dryRun) {
        const v = opt.assumeLive === id
          ? { ok: true, verified_at: U.nowIso(), attempts: 0, via: 'external', evidence: opt.evidence || 'no evidence given' }
          : await verifyLive(ps.url, obj.page.og_title || obj.page.h1, config, log);
        if (v.via === 'external') { ps.live_verified_via = 'external'; ps.live_evidence = v.evidence; log(`${id}: marked live from external evidence: ${v.evidence}`); }
        entry.live = v;
        if (v.ok) { ps.state = 'live'; ps.live_verified_at = v.verified_at; linkGraph.addToCorpus(corpus, obj, config, { state: 'live', deployed_at: (corpus.pages.find((p) => p.slug === obj.page.slug) || {}).deployed_at || U.nowIso(), live_verified_at: v.verified_at }); U.saveCorpus(corpus); entry.state = 'live'; }
        else { ps.failure = v.reason; entry.state = 'deployed-unverified'; report.needsTravis.push(`${id}: deployed but not live (${v.reason}). If the PR is open, merge it and rerun.`); }
        continue;
      }
      // 2c. Images.
      entry.images = await images.sourceImages(obj, { config, library, websiteRepo: site.website_repo });
      // 2d. Render and validate.
      const vo = validateObject(obj, ctx);
      if (!vo.ok) throw new Error(`content validation: ${vo.errors.join(' | ')}`);
      const html = renderPage.render(obj, site, facts);
      const pageRel = `${config.site.recipes_path}${obj.page.slug}/`;
      willExist.add(pageRel); willExist.add(pageRel + 'index.html');
      const vh = validateHtml(html, { obj, config, facts, site, willExist });
      entry.validation = { object: vo, html: vh };
      if (!vh.ok) throw new Error(`html validation: ${vh.errors.join(' | ')}`);
      ps.state = 'validated';
      // 2e. Stage: page, hub index, sitemap, related backfill.
      const staged = renderPage.stage(obj, html, { config, runId: opt.runId });
      const nextCorpus = linkGraph.addToCorpus(JSON.parse(JSON.stringify(corpus)), obj, config, { state: 'deployed' });
      fs.writeFileSync(path.join(staged.staging, config.site.recipes_path.replace(/^\//, ''), 'index.html'), linkGraph.renderHubIndex(nextCorpus, site, config));
      const smPath = path.join(site.website_repo, config.site.website_repo.sitemap);
      const sm = linkGraph.updateSitemap(fs.existsSync(smPath) ? fs.readFileSync(smPath, 'utf8') : '', [linkGraph.pageUrlOf(config, obj.page.slug)], config);
      fs.writeFileSync(path.join(staged.staging, config.site.website_repo.sitemap), sm);
      const changed = linkGraph.backfillRelated(corpus, obj, config, (cid) => { const f = generator.contentPath(cid); return fs.existsSync(f) ? U.readJson(f) : null; });
      for (const other of changed) {
        const otherHtml = renderPage.render(other, site, facts);
        const ovh = validateHtml(otherHtml, { obj: other, config, facts, site, willExist });
        if (!ovh.ok) { log(`${id}: related backfill on ${other.page.slug} failed validation, skipped: ${ovh.errors.join(' | ')}`); continue; }
        renderPage.stage(other, otherHtml, { config, runId: opt.runId });
        U.writeJson(generator.contentPath(other.id), other);
      }
      U.writeJson(generator.contentPath(id), obj);
      entry.staging = staged.staging;
      if (opt.dryRun) { entry.state = 'validated (dry run)'; log(`${id}: dry run, staged at ${staged.staging}`); continue; }
      // 2f. Deploy.
      const d = await deployPage.deploy({ staging: staged.staging, repo: site.website_repo, config, conceptId: id, runId: opt.runId });
      entry.deploy = d;
      ps.state = 'deployed';
      ps.url = linkGraph.pageUrlOf(config, obj.page.slug);
      ps.deploy = d;
      deployedThisRun++;
      linkGraph.addToCorpus(corpus, obj, config, { state: 'deployed', commit: d.commit, pr: d.pr ? d.pr.url : null });
      U.saveCorpus(corpus);
      U.saveLibrary(library);
      if (config.pages.requireReview) {
        entry.state = d.pr ? 'deployed (PR open)' : 'deployed (branch pushed, PR not opened)';
        report.needsTravis.push(d.pr ? `${id}: merge ${d.pr.url} then rerun to verify live and wire the pin.` : `${id}: branch ${d.branch} pushed but the PR could not be opened (${d.pr_error}). Open it against ${config.site.website_repo.production_branch} by hand, merge, then rerun.`);
        continue;
      }
      // 2g. Verify live.
      const v = await verifyLive(ps.url, obj.page.og_title || obj.page.h1, config, log);
      entry.live = v;
      if (v.ok) { ps.state = 'live'; ps.live_verified_at = v.verified_at; linkGraph.addToCorpus(corpus, obj, config, { state: 'live', commit: d.commit, live_verified_at: v.verified_at }); U.saveCorpus(corpus); entry.state = 'live'; }
      else { ps.state = 'failed'; ps.failure = v.reason; entry.state = 'failed'; entry.fallback_used = true; }
    } catch (e) {
      ps.state = 'failed';
      ps.failure = e.message;
      ps.fallback_used = true;
      entry.state = 'failed';
      entry.error = e.message;
      entry.fallback_used = true;
      log(`${id}: page failed, pin falls back: ${e.message}`);
    }
  }

  // 3. Route every Pinterest post; wire only when not a dry run.
  report.routes = router.routeAll(ledger, { config, facts });
  if (!opt.dryRun) {
    for (const post of ledger.posts) {
      if (!L.isPinterest(config, post)) continue;
      try { manifest.wire(post, config); } catch (e) { log(`wire: ${e.message}`); }
    }
  }
  L.save(ledger);
  if (!opt.dryRun) U.saveLibrary(library);
  writeReport(report, config);
  console.log(`report: pages/runs/${opt.runId}.md`);
}

function writeReport(r, config) {
  const lines = [`# Pages run ${r.runId}`, '', `Started ${r.started}. ${r.dryRun ? 'DRY RUN: nothing deployed, nothing wired.' : ''}`, '', '## Concepts considered', '', '| id | score | eligible | exclude | reasons |', '|---|---|---|---|---|'];
  for (const c of r.considered) lines.push(`| ${c.id} | ${c.score} | ${c.eligible} | ${c.hard_exclude || ''} | ${c.reasons.join('; ')} |`);
  lines.push('', '## Pages', '');
  for (const p of r.pages) {
    lines.push(`### ${p.id}: ${p.state}`);
    if (p.error) lines.push(`- error: ${p.error}`);
    if (p.images) lines.push(`- images: ${Object.entries(p.images.slots).map(([k, v]) => `${k}=${v}`).join(', ')}; cost $${p.images.cost_usd.toFixed(2)}${p.images.needs_photography.length ? `; needs photography: ${p.images.needs_photography.join(', ')}` : ''}`);
    if (p.validation) lines.push(`- validation: object ${p.validation.object.ok ? 'ok' : 'FAIL'} (${p.validation.object.words} prose words), html ${p.validation.html.ok ? 'ok' : 'FAIL'} (${p.validation.html.bytes} bytes)${p.validation.html.warnings.length ? `; warnings: ${p.validation.html.warnings.join('; ')}` : ''}`);
    if (p.staging) lines.push(`- staged: ${p.staging}`);
    if (p.deploy) lines.push(`- deploy: ${p.deploy.branch} @ ${p.deploy.commit}${p.deploy.pr ? ` PR ${p.deploy.pr.url}` : ''}${p.deploy.pr_error ? ` (PR not opened: ${p.deploy.pr_error})` : ''}`);
    if (p.live) lines.push(`- live: ${p.live.ok ? (p.live.via === 'external' ? `verified ${p.live.verified_at} from external evidence: ${p.live.evidence}` : `verified ${p.live.verified_at} after ${p.live.attempts} attempts`) : p.live.reason}`);
    if (p.fallback_used) lines.push('- fallback: pin routed to the store');
    lines.push('');
  }
  lines.push('## Pin destinations', '', '| id | arm | destination | url | CTA copy | fallback |', '|---|---|---|---|---|---|');
  for (const x of r.routes) lines.push(`| ${x.id} | ${x.cta.arm || ''} | ${x.cta.destination} | ${x.cta.url} | ${x.cta.pin_cta_copy} | ${x.cta.fallback ? 'yes: ' + x.cta.fallback_reason : ''} |`);
  if (r.needsTravis.length) { lines.push('', '## Needs Travis', ''); for (const n of r.needsTravis) lines.push(`- ${n}`); }
  lines.push('', '## Log', '', ...r.notes.map((n) => `- ${n}`), '');
  const file = path.join(U.PAGES_DIR, 'runs', `${r.runId}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n'));
  void config;
}

if (require.main === module) main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
module.exports = { main };
