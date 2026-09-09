'use strict';
// Writes the routed destination into the Buffer post fields on the ledger.
// The page URL reaches the pin only after verify-live wrote state = live.
// Nothing gets scheduled against a URL that has not returned 200 with the
// right body; that rule is enforced here, not trusted upstream.

const L = require('./ledger');

function wire(post, config) {
  const cta = post.cta || {};
  const ps = post.page_status || {};
  if (cta.destination === 'page' && ps.state !== 'live') {
    throw new Error(`refusing to wire page URL for ${L.field(config, post, 'id')}: state is ${ps.state}, not live`);
  }
  if (!cta.url) throw new Error(`no destination URL for ${L.field(config, post, 'id')}`);
  L.setField(config, post, 'pinterestUrl', cta.url);
  // The ledger's cta field keeps the full routed object plus the summary
  // fields the scheduling step reads (copy, destination, arm, fallback).
  L.setField(config, post, 'cta', Object.assign({}, cta, {
    copy: cta.pin_cta_copy,
    fallback: Boolean(cta.fallback),
  }));
  // A pin that points at a page says so in its own text; the CTA copy is
  // appended only if the existing text does not already carry a CTA line.
  const text = String(L.field(config, post, 'text') || '');
  if (cta.destination === 'page' && cta.pin_cta_copy && !text.includes(cta.pin_cta_copy)) {
    L.setField(config, post, 'text', text.trim() ? `${text.trim()}\n\n${cta.pin_cta_copy}.` : `${cta.pin_cta_copy}.`);
  }
  return { id: L.field(config, post, 'id'), url: cta.url, destination: cta.destination, copy: cta.pin_cta_copy };
}

module.exports = { wire };
