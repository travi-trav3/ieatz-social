'use strict';
// Content object -> static HTML, written into a staging tree that mirrors the
// website repo. Nothing touches the repo until deploy-page.js copies it.

const fs = require('fs');
const path = require('path');
const U = require('./util');
const tpl = require('../templates/pinterest-roundup/template');

function stagingDir(runId) {
  return path.join(U.PAGES_DIR, '.staging', runId);
}

function pagePath(config, slug) {
  return path.posix.join(config.site.recipes_path.replace(/^\//, ''), slug, 'index.html');
}

function render(obj, site, facts) {
  return tpl.render(obj.page, site, facts);
}

// Writes recipes/<slug>/index.html into staging. Returns the list of
// repo-relative files this page needs committed.
function stage(obj, html, ctx) {
  const { config, runId } = ctx;
  const dir = stagingDir(runId);
  const rel = pagePath(config, obj.page.slug);
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, html);
  return { staging: dir, files: [rel] };
}

module.exports = { render, stage, stagingDir, pagePath };
