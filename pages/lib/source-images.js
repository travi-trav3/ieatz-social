'use strict';
// Provider chain for every image slot: manual override -> library -> generated
// -> none. Records the provider used and the cost. The page ships either way;
// a null slot renders the photo-free variant.

const fs = require('fs');
const path = require('path');
const U = require('./util');

const SLOT_FILES = {
  hero: 'hero', inset: 'inset', lifestyle: 'lifestyle', band: 'band', final: 'final',
};

function slotList(page, tags = []) {
  const slots = [
    { key: 'hero', get: () => page.hero.image, set: (v) => (page.hero.image = v), tags: (tags || []).concat(page.tags || []), orient: 'portrait', kind: 'food', required: false },
    { key: 'inset', get: () => page.hero.inset_image, set: (v) => (page.hero.inset_image = v), tags: ['fridge', 'mess', 'real'], orient: 'portrait', kind: 'fridge' },
    { key: 'lifestyle', get: () => page.bridge.lifestyle_image, set: (v) => (page.bridge.lifestyle_image = v), tags: ['kitchen', 'people', 'cooking'], orient: 'landscape', kind: 'lifestyle' },
  ];
  (page.interstitials || []).forEach((b, i) => {
    if (b.style === 'photo_band') slots.push({ key: 'band', get: () => b.image, set: (v) => (b.image = v), tags: ['cooking', 'hands', 'pan', 'stove'], orient: 'any', kind: 'lifestyle', index: i });
  });
  slots.push({ key: 'final', get: () => page.final_cta.image, set: (v) => (page.final_cta.image = v), tags: ['fridge', 'stocked', 'open fridge'], orient: 'landscape', kind: 'fridge' });
  page.recipes.forEach((r, i) => {
    slots.push({ key: `recipe-${i + 1}`, get: () => r.image, set: (v) => (r.image = v), tags: U.significant(r.name).concat(r.tags || []), orient: 'portrait', kind: 'food', recipe: r, index: i });
  });
  (page.supporting_sections || []).forEach((s, si) => {
    s.images = s.images || [];
    for (let k = 0; k < 2; k++) {
      slots.push({ key: `supporting-${si + 1}-${k + 1}`, get: () => s.images[k] || null, set: (v) => { if (v) s.images[k] = v; }, tags: U.significant(s.heading).concat(['ingredients']), orient: k === 0 ? 'square' : 'portrait', kind: 'ingredients', optional: true });
    }
  });
  return slots;
}

function manualOverride(slot, page, config, websiteRepo) {
  const dir = path.join(websiteRepo, config.site.website_repo.recipe_photos_dir, page.slug);
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    const f = path.join(dir, `${slot.key}.${ext}`);
    if (fs.existsSync(f)) {
      return { src: `/${config.site.website_repo.recipe_photos_dir}/${page.slug}/${slot.key}.${ext}`, alt: slot.recipe ? slot.recipe.alt : (slot.get() || {}).alt || '', pin_description: slot.recipe ? slot.recipe.pin_description : '', source: 'manual' };
    }
  }
  return null;
}

function fromLibrary(slot, page, config, library, now = new Date()) {
  const reuseMs = config.images.heroReuseDays * 86400000;
  const candidates = library.photos.filter((p) => {
    if (p.reject) return false;
    if (slot.kind && p.kind !== slot.kind && p.also_kind !== slot.kind) return false;
    if ((p.used || []).some((u) => u.page === page.slug && u.slot !== slot.key)) return false; // never twice on one page
    if (slot.orient !== 'any' && slot.orient && p.orientation !== slot.orient && !(slot.orient === 'portrait' && p.orientation === 'square')) return false;
    if (slot.kind === 'food' && !p.confirmed) return false; // slugs lie
    const recent = (p.used || []).some((u) => u.page !== page.slug && now - new Date(u.date) < reuseMs);
    if (recent && (slot.key === 'hero' || slot.kind === 'food')) return false;
    return true;
  });
  const scored = candidates.map((p) => {
    const overlap = slot.tags.filter((t) => p.tags.some((pt) => pt.includes(t) || t.includes(pt))).length;
    return { p, overlap, unused: (p.used || []).length === 0 ? 1 : 0 };
  });
  const need = slot.kind === 'food' ? 2 : 1;
  const best = scored.filter((s) => s.overlap >= need).sort((a, b) => b.overlap - a.overlap || b.unused - a.unused)[0];
  if (!best) return null;
  best.p.used = best.p.used || [];
  if (!best.p.used.some((u) => u.page === page.slug && u.slot === slot.key)) {
    best.p.used.push({ page: page.slug, slot: slot.key, date: now.toISOString().slice(0, 10) });
  }
  const alt = slot.recipe ? slot.recipe.alt : (slot.get() && slot.get().alt) || best.p.alt || best.p.tags.slice(0, 3).join(', ');
  return { src: `${library.base_path}${best.p.file}`, alt, pin_description: slot.recipe ? slot.recipe.pin_description : '', source: 'library', library_id: best.p.id };
}

// Generated provider: a generic HTTP contract so the vendor is a config
// choice. POST {prompt, width, height} -> {url} or {b64}. Off by default.
async function generated(slot, page, config, websiteRepo, report) {
  const g = config.images.generated;
  if (!g.enabled || g.provider === 'none') return null;
  const key = process.env[g.apiKeyEnv];
  if (!key || !g.endpoint) { report.notes.push(`generated: ${g.apiKeyEnv} or endpoint not set`); return null; }
  if (!slot.recipe && slot.key !== 'hero') return null; // only dish shots are generated
  const r = slot.recipe || page.recipes[0];
  const [w, h] = slot.key === 'hero' ? g.sizes.hero : g.sizes.recipe;
  const prompt = g.promptTemplate.replace('{dish}', r.name).replace('{ingredients}', r.ingredients.join(', '));
  const res = await fetch(g.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ prompt, width: w, height: h, model: g.model }) });
  if (!res.ok) { report.notes.push(`generated: provider ${res.status} for ${slot.key}`); return null; }
  const data = await res.json();
  let buf;
  if (data.b64) buf = Buffer.from(data.b64, 'base64');
  else if (data.url) buf = Buffer.from(await (await fetch(data.url)).arrayBuffer());
  else return null;
  const sharp = require('sharp');
  const meta = await sharp(buf).metadata();
  if (meta.width < g.qualityCheck.minWidth || meta.height < g.qualityCheck.minHeight) { report.notes.push(`generated: ${slot.key} below minimum resolution`); return null; }
  const dir = path.join(websiteRepo, config.site.website_repo.recipe_photos_dir, page.slug);
  fs.mkdirSync(dir, { recursive: true });
  const file = `${slot.key}.jpg`;
  await sharp(buf).jpeg({ quality: 86 }).toFile(path.join(dir, file));
  report.cost_usd += g.costPerImageUsd || 0;
  return { src: `/${config.site.website_repo.recipe_photos_dir}/${page.slug}/${file}`, alt: r.alt, pin_description: r.pin_description, source: 'generated', cost_usd: g.costPerImageUsd || 0 };
}

async function sourceImages(obj, ctx) {
  const { config, library, websiteRepo } = ctx;
  const page = obj.page;
  const report = { slots: {}, cost_usd: 0, notes: [], needs_photography: [] };
  // Re-sourcing is a full redo: forget this page's own earlier picks first.
  for (const p of library.photos) p.used = (p.used || []).filter((u) => u.page !== page.slug);
  for (const slot of slotList(page, obj.tags)) {
    let img = manualOverride(slot, page, config, websiteRepo);
    if (!img) img = fromLibrary(slot, page, config, library);
    if (!img) img = await generated(slot, page, config, websiteRepo, report);
    if (img) { slot.set(img); report.slots[slot.key] = img.source; }
    else {
      if (!slot.optional) slot.set(null);
      report.slots[slot.key] = 'none';
      if (slot.kind === 'food') report.needs_photography.push(slot.key);
    }
  }
  obj.page_status = obj.page_status || {};
  obj.page_status.images = report;
  return report;
}

module.exports = { sourceImages, slotList, fromLibrary, manualOverride, SLOT_FILES };
