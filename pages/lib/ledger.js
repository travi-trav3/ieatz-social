'use strict';
// Thin adapter over the existing batch ledger. Field names come from
// config.json -> ledger.fields so the real ledger shape (DISCOVERY.md: not in
// git) can be mapped without touching code. This module never creates a
// parallel ledger: it reads a batch file, mutates records in place, writes
// the same file back.

const fs = require('fs');
const path = require('path');
const { PAGES_DIR, readJson, writeJson, getPath, setPath } = require('./util');

function batchPath(config, batch, explicit) {
  if (explicit) return path.resolve(explicit);
  const nn = String(batch).replace(/^batch-/, '');
  const rel = config.ledger.batchFilePattern.replace('{NN}', nn);
  return path.resolve(PAGES_DIR, config.ledger.batchDir, rel);
}

function load(config, batch, explicit) {
  const p = batchPath(config, batch, explicit);
  if (!fs.existsSync(p)) throw new Error(`Ledger not found: ${p}. Set --ledger <path> or fix config.ledger.`);
  const data = readJson(p);
  const posts = config.ledger.postsField ? getPath(data, config.ledger.postsField) : data;
  if (!Array.isArray(posts)) throw new Error(`Ledger ${p} has no array at "${config.ledger.postsField}"`);
  return { path: p, data, posts };
}

function save(ledger) {
  writeJson(ledger.path, ledger.data);
}

function field(config, post, name) {
  const key = config.ledger.fields[name] || name;
  return getPath(post, key);
}
function setField(config, post, name, value) {
  const key = config.ledger.fields[name] || name;
  setPath(post, key, value);
}

function isPinterest(config, post) {
  const ch = String(field(config, post, 'channel') || '').toLowerCase();
  return config.eligibility.pinterestChannels.some((c) => ch.includes(c));
}

// Batch-level page state (arm alternation carried across batches).
function meta(ledger) {
  if (!ledger.data.pages_meta) ledger.data.pages_meta = { lastArm: null };
  return ledger.data.pages_meta;
}

module.exports = { batchPath, load, save, field, setField, isPinterest, meta };
