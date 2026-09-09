'use strict';
// Builds the `site` object the template renders against.
// Production: reads the website repo checkout so the page carries exactly
// the analytics tags, favicon and logo mark the rest of the site carries.
// Golden: mirrors the Claude Design export so the template can be proven
// lossless against it (domain, relative asset paths, PROVIDER_TOKEN literal).

const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.resolve(__dirname, '..');

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(PAGES_DIR, rel), 'utf8'));
}

function websiteRepoPath(config) {
  const p = process.env.IEATZ_WEBSITE_REPO || config.site.website_repo.path;
  return path.resolve(PAGES_DIR, p);
}

// The site's tag block runs from the Meta pixel comment to </head>.
function extractHeadTags(indexHtml) {
  const start = indexHtml.indexOf('<!-- ====');
  const metaStart = indexHtml.indexOf('Meta Pixel');
  if (metaStart === -1) return '';
  const blockStart = indexHtml.lastIndexOf('<!--', metaStart);
  const end = indexHtml.indexOf('</head>', metaStart);
  if (blockStart === -1 || end === -1) return '';
  void start;
  // Comments carry em dashes and DEV notes; the tags themselves are what the page must carry.
  return indexHtml.slice(blockStart, end).replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function extractLogoMark(indexHtml) {
  const m = indexHtml.match(/<svg class="mark" viewBox="0 0 38\.25 58\.486"[^>]*>[\s\S]*?<\/svg>/);
  if (!m) return null;
  // Normalise to a currentColor mark with no inline color override.
  return m[0]
    .replace(/ style="[^"]*"/, '')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .replace('<svg class="mark"', '<svg')
    .replace('aria-hidden="true"', 'aria-hidden="true" style="width:100%;height:100%;display:block"');
}

function productionSite(config, facts, overrides = {}) {
  const repo = websiteRepoPath(config);
  const indexPath = path.join(repo, config.site.website_repo.index_html);
  const indexHtml = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
  const providerToken = process.env[facts.app.provider_token_env] || null;
  return Object.assign(
    {
      mode: 'production',
      origin: config.site.origin,
      name: config.site.name,
      recipes_path: config.site.recipes_path,
      trailing_slash: config.site.trailing_slash,
      favicon: config.site.favicon,
      logo_mark_svg: extractLogoMark(indexHtml),
      logo_mark_src: null,
      app_store_badge: config.site.app_store_badge,
      default_og_image: config.site.default_og_image,
      head_tags: extractHeadTags(indexHtml),
      show_play_store: Boolean(facts.store_urls.play_store),
      store: {
        apple_id: facts.app.apple_id,
        provider_token: providerToken,
        play_package: facts.app.play_package,
        ppid: null,
      },
      campaign_token: facts.campaign_tokens.lp,
      website_repo: repo,
    },
    overrides
  );
}

function goldenSite(facts) {
  return {
    mode: 'golden',
    origin: 'https://ieatshealthy.com',
    name: 'iEatz Healthy',
    recipes_path: '/recipes/',
    trailing_slash: false,
    favicon: '../assets/brand/favicon.svg',
    logo_mark_svg: null,
    logo_mark_src: '../assets/brand/logo-mark-green.svg',
    app_store_badge: '../assets/brand/app-store-badge-black.svg',
    default_og_image: null,
    head_tags: '',
    show_play_store: true,
    store: { apple_id: facts.app.apple_id, provider_token: 'PROVIDER_TOKEN', play_package: 'com.ieatz.healthy', ppid: null },
    campaign_token: 'pin-lp',
    website_repo: null,
  };
}

module.exports = { loadJson, productionSite, goldenSite, websiteRepoPath, extractHeadTags, extractLogoMark, PAGES_DIR };
