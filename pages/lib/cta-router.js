'use strict';
// Destination, campaign token, UTMs and CTA copy for every Pinterest post,
// whether or not it got a page. Arm assignment alternates lp / direct in
// eligibility order within the batch and carries across batches through the
// ledger's pages_meta.lastArm.

const L = require('./ledger');

function assignArms(ledger, config) {
  const meta = L.meta(ledger);
  let last = meta.lastArm;
  for (const post of ledger.posts) {
    const ps = post.page_status;
    if (!ps || !ps.eligibility || !ps.eligibility.eligible) continue;
    post.cta = post.cta || {};
    if (post.cta.arm) { last = post.cta.arm; continue; } // idempotent on rerun
    if (!config.splitTest.enabled) { post.cta.arm = 'lp'; last = 'lp'; continue; }
    const next = last === 'lp' ? 'direct' : 'lp';
    post.cta.arm = next;
    last = next;
  }
  meta.lastArm = last;
}

function cppFor(facts, post, config) {
  // The existing router maps a query to a cluster; the pages layer only
  // honours a cluster the post already carries, and only when the CPP is set.
  const cluster = post.cluster || (post.cta && post.cta.cluster);
  if (cluster && facts.store_urls[`cpp_${cluster}`]) return { destination: `cpp_${cluster}`, url: facts.store_urls[`cpp_${cluster}`] };
  return null;
}

function storeUrl(facts, token, base) {
  const pt = process.env[facts.app.provider_token_env];
  const u = new URL(base || facts.store_urls.app_store);
  if (pt) { u.searchParams.set('pt', pt); u.searchParams.set('ct', token); }
  u.searchParams.set('mt', '8');
  return u.toString();
}

function rotate(list, previous) {
  const idx = list.indexOf(previous);
  return list[(idx + 1) % list.length];
}

function pageUrl(config, post) {
  const slug = post.page && post.page.slug;
  const base = `${config.site.origin}${config.site.recipes_path}${slug}/`;
  const utm = {
    utm_source: 'pinterest',
    utm_medium: 'organic',
    utm_campaign: String(L.field(config, post, 'pillar') || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    utm_content: String(L.field(config, post, 'id')),
  };
  const qs = Object.entries(utm).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return { url: `${base}?${qs}`, utm };
}

// prevCta = the CTA copy on the previous Pinterest post in publish order.
function route(post, ctx) {
  const { config, facts, prevCta } = ctx;
  const ps = post.page_status || {};
  const eligible = ps.eligibility && ps.eligibility.eligible;
  const arm = post.cta && post.cta.arm;
  const live = ps.state === 'live' && ps.url;
  const cta = Object.assign({}, post.cta || {});

  if (eligible && arm === 'lp' && live) {
    const { url, utm } = pageUrl(config, post);
    cta.destination = 'page';
    cta.url = url;
    cta.campaign_token = facts.campaign_tokens.lp;
    cta.utm = utm;
    cta.pin_cta_copy = rotate(config.cta.pageCtaCopy, prevCta);
    cta.fallback = false;
    return cta;
  }
  if (eligible && arm === 'lp' && !live) {
    cta.fallback = true;
    cta.fallback_reason = ps.failure || `page state is ${ps.state || 'planned'}`;
  }
  const cpp = cppFor(facts, post, config);
  cta.destination = cpp ? cpp.destination : 'app_store';
  cta.campaign_token = facts.campaign_tokens.direct;
  cta.url = storeUrl(facts, cta.campaign_token, cpp ? cpp.url : null);
  cta.utm = null;
  cta.pin_cta_copy = rotate(config.cta.storeCtaCopy, prevCta);
  if (!eligible && !cpp && post.cta && post.cta.existing_destination === 'homepage') {
    cta.destination = 'homepage';
    cta.url = `${config.site.origin}/`;
  }
  return cta;
}

function routeAll(ledger, ctx) {
  const { config } = ctx;
  let prev = null;
  const out = [];
  const posts = ledger.posts.filter((p) => L.isPinterest(config, p)).sort((a, b) => String(L.field(config, a, 'dueAt') || '').localeCompare(String(L.field(config, b, 'dueAt') || '')));
  for (const post of posts) {
    const cta = route(post, Object.assign({}, ctx, { prevCta: prev }));
    post.cta = cta;
    prev = cta.pin_cta_copy;
    out.push({ id: L.field(config, post, 'id'), cta });
  }
  return out;
}

module.exports = { assignArms, route, routeAll, storeUrl, pageUrl };
