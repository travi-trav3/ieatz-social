'use strict';
// Polls the final URL until it returns 200 with the right body. A 200 that
// serves the site's 404 page is a failure, which is why the body check
// exists: the response must contain the page's og:title and its JSON-LD
// must parse. On success: state = live, live_verified_at. On timeout:
// state = failed with the reason, and the batch continues on the fallback.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOnce(url, ms = 15000) {
  // A blocked or black-holed network must fail fast, not hang the run: abort
  // the request and also race a hard timer in case the DNS stage ignores it.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`no response within ${ms} ms`)), ms + 1000));
  try {
    const res = await Promise.race([fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'ieatz-pages verify-live', 'cache-control': 'no-cache' } }), timeout]);
    const body = await Promise.race([res.text(), timeout]);
    // An egress proxy answers a blocked CONNECT with its own 403. The real
    // site always answers through Cloudflare; anything else is not the site.
    const server = (res.headers.get('server') || '').toLowerCase();
    if (res.status === 403 && !server.includes('cloudflare')) {
      const err = new Error(`egress blocked: proxy answered 403 without a Cloudflare server header`);
      err.egress = true;
      throw err;
    }
    return { status: res.status, body, finalUrl: res.url };
  } finally { clearTimeout(timer); }
}

function checkBody(body, ogTitle) {
  const reasons = [];
  const ogRe = /<meta property="og:title" content="([^"]*)"/;
  const m = ogRe.exec(body);
  if (!m) reasons.push('no og:title in body');
  else if (m[1] !== ogTitle.replace(/&/g, '&amp;').replace(/"/g, '&quot;')) reasons.push(`og:title is "${m[1]}", expected "${ogTitle}"`);
  const blocks = [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) reasons.push('no JSON-LD in body');
  for (const b of blocks) { try { JSON.parse(b[1]); } catch (e) { reasons.push(`JSON-LD does not parse: ${e.message}`); } }
  return reasons;
}

async function verifyLive(url, ogTitle, config, log = () => {}) {
  const interval = (config.verifyLive.intervalSeconds || 30) * 1000;
  const deadline = Date.now() + (config.verifyLive.timeoutMinutes || 20) * 60000;
  let last = 'not attempted';
  let attempts = 0;
  let networkErrors = 0;
  const giveUp = config.verifyLive.giveUpAfterNetworkErrors || 2;
  while (Date.now() < deadline) {
    attempts++;
    if (networkErrors >= giveUp) {
      // Not a page failure: this machine cannot reach the domain. The caller
      // leaves the page deployed and lets the website repo's Action verify.
      return { ok: false, unreachable: true, reason: `network unreachable from this environment after ${networkErrors} attempts; last: ${last}`, attempts };
    }
    try {
      const r = await fetchOnce(url);
      if (r.status === 200) {
        const reasons = checkBody(r.body, ogTitle);
        if (!reasons.length) return { ok: true, verified_at: new Date().toISOString(), attempts, finalUrl: r.finalUrl };
        last = `200 but ${reasons.join('; ')}`;
      } else last = `HTTP ${r.status}`;
    } catch (e) {
      last = `fetch error: ${e.message}${e.cause ? ' (' + (e.cause.code || e.cause.message) + ')' : ''}`;
      networkErrors++;
    }
    log(`verify-live ${url}: attempt ${attempts}: ${last}`);
    await sleep(networkErrors && networkErrors === attempts ? 1000 : interval);
  }
  return { ok: false, reason: `timeout after ${attempts} attempts; last: ${last}`, attempts };
}

module.exports = { verifyLive, checkBody, fetchOnce };
