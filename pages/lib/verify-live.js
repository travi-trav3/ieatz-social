'use strict';
// Polls the final URL until it returns 200 with the right body. A 200 that
// serves the site's 404 page is a failure, which is why the body check
// exists: the response must contain the page's og:title and its JSON-LD
// must parse. On success: state = live, live_verified_at. On timeout:
// state = failed with the reason, and the batch continues on the fallback.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOnce(url) {
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'ieatz-pages verify-live', 'cache-control': 'no-cache' } });
  const body = await res.text();
  return { status: res.status, body, finalUrl: res.url };
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
  while (Date.now() < deadline) {
    attempts++;
    try {
      const r = await fetchOnce(url);
      if (r.status === 200) {
        const reasons = checkBody(r.body, ogTitle);
        if (!reasons.length) return { ok: true, verified_at: new Date().toISOString(), attempts, finalUrl: r.finalUrl };
        last = `200 but ${reasons.join('; ')}`;
      } else last = `HTTP ${r.status}`;
    } catch (e) {
      last = `fetch error: ${e.message}`;
    }
    log(`verify-live ${url}: attempt ${attempts}: ${last}`);
    await sleep(interval);
  }
  return { ok: false, reason: `timeout after ${attempts} attempts; last: ${last}`, attempts };
}

module.exports = { verifyLive, checkBody, fetchOnce };
