'use strict';
const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.resolve(__dirname, '..');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}
function loadConfig() {
  return readJson(path.join(PAGES_DIR, 'config.json'));
}
function loadFacts() {
  return readJson(path.join(PAGES_DIR, 'verified-facts.json'));
}
function loadCorpus() {
  return readJson(path.join(PAGES_DIR, 'corpus-index.json'));
}
function saveCorpus(c) {
  writeJson(path.join(PAGES_DIR, 'corpus-index.json'), c);
}
function loadLibrary() {
  return readJson(path.join(PAGES_DIR, 'photo-library.json'));
}
function saveLibrary(l) {
  writeJson(path.join(PAGES_DIR, 'photo-library.json'), l);
}

const STOP = new Set('a an and are as at be but by for from has have i if in into is it its of on or that the this to was what when where which who will with you your can make made'.split(' '));

function tokenize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w && !STOP.has(w));
}
function significant(s) {
  return tokenize(s).filter((w) => w.length > 3);
}
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size && !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
function cosine(a, b) {
  const tf = (arr) => arr.reduce((m, w) => ((m[w] = (m[w] || 0) + 1), m), {});
  const A = tf(a), B = tf(b);
  let dot = 0, na = 0, nb = 0;
  for (const k in A) { na += A[k] * A[k]; if (B[k]) dot += A[k] * B[k]; }
  for (const k in B) nb += B[k] * B[k];
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}
function sentences(s) {
  return String(s || '').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
}
function wordCount(s) {
  return String(s || '').split(/\s+/).filter(Boolean).length;
}
const EM_DASH = /—/;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

function walkStrings(obj, fn, trail = []) {
  if (typeof obj === 'string') return fn(obj, trail.join('.'));
  if (Array.isArray(obj)) return obj.forEach((v, i) => walkStrings(v, fn, trail.concat(i)));
  if (obj && typeof obj === 'object') for (const k of Object.keys(obj)) if (!k.startsWith('_')) walkStrings(obj[k], fn, trail.concat(k));
}
function getPath(obj, p) {
  return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, p, v) {
  const ks = p.split('.');
  let o = obj;
  for (const k of ks.slice(0, -1)) { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
  o[ks[ks.length - 1]] = v;
}
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function nowIso() {
  return new Date().toISOString();
}
function isoWeek(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
function daysSince(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}
function runId() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

module.exports = { PAGES_DIR, readJson, writeJson, loadConfig, loadFacts, loadCorpus, saveCorpus, loadLibrary, saveLibrary, tokenize, significant, jaccard, cosine, sentences, wordCount, EM_DASH, EMOJI, walkStrings, getPath, setPath, slugify, nowIso, isoWeek, daysSince, runId, STOP };
