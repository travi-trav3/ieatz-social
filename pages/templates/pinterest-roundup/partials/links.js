'use strict';
// Store links and the measurement attributes every CTA carries.
// App Store links are built from apple_id + provider token + campaign token.
// Without a provider token there is no `ct` either: Apple ignores a ct with
// no pt, and a literal PROVIDER_TOKEN placeholder must never reach a live page.

const { attr } = require('./h');

function appStoreHref(site) {
  const s = site.store;
  const base = `https://apps.apple.com/us/app/id${s.apple_id}`;
  const params = [];
  if (s.ppid) params.push(`ppid=${encodeURIComponent(s.ppid)}`);
  if (s.provider_token) {
    params.push(`pt=${encodeURIComponent(s.provider_token)}`);
    params.push(`ct=${encodeURIComponent(site.campaign_token)}`);
    params.push('mt=8');
  } else if (site.mode !== 'golden') {
    params.push('mt=8');
  }
  return params.length ? `${base}?${params.join('&')}` : base;
}

function playStoreHref(site) {
  const pkg = (site.store.play_package || 'com.ieatz.healthy');
  const referrer = encodeURIComponent(`utm_source=pinterest&utm_campaign=${site.campaign_token}`);
  return `https://play.google.com/store/apps/details?id=${pkg}&referrer=${referrer}`;
}

// onclick + data-cta so both the page's own track() and the site-wide Meta /
// Pinterest click handler (which reads data-cta) label the placement.
function iosAttrs(site, position) {
  return `href="${attr(appStoreHref(site))}" data-store="ios" data-cta="${attr(position)}" onclick="track('app_store_click',{cta_position:'${position}',platform:'ios'})"`;
}

function androidAttrs(site, position) {
  return `href="${attr(playStoreHref(site))}" data-store="android" data-cta="${attr(position)}" onclick="track('app_store_click',{cta_position:'${position}',platform:'android'})"`;
}

module.exports = { appStoreHref, playStoreHref, iosAttrs, androidAttrs };
