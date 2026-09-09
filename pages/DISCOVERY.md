# Discovery: what the two repos actually contain

Written 2026-09-09 on the first run of the pages build, from a remote Claude Code session with both repos cloned. Re-run this when anything looks off. Every path in `BRIEF.md` marked (discover) is resolved here.

## Headline findings, and where the brief is wrong

1. **`ieatz-social` on GitHub is not the pipeline repo the brief describes.** It is the public image host for Buffer (`README.md`: "Rendered post images for Buffer scheduling. Served via GitHub Pages."). It contains `index.html`, `posts/.gitkeep` and 40 rendered PNGs (w25 to w27 batches, 310 MB). There is no ledger, no `diversity-gate.js`, no `contact-sheet.js`, no `playbooks/`, no `render/` harness, no `REVISIONS.md`, no template spec, no content hub spec. Those live in the Cowork project on Travis's Mac, not in git.
   - Consequence: `pages/` is added to this repo as the brief specifies, but every integration point with the ledger is a **field mapping in `config.json` (`ledger.fields`)** coded against the shape documented in the `social-content-pipeline` skill (Phase 7.5: `manifest/<batch>.json` with per-post `id, status, bufferId, channel, dueAt, file, title, alt, text` plus planning-time `pillar, topic, template, surface, heroPhoto, cta`). Confirm the real names on the first local run and fix the mapping, not the code.
   - The retroactive eligibility run (gate 6) cannot happen from a remote session. `fixtures/ledger-w25-w27.json` is a stand-in built from the Pinterest post filenames in `posts/`, labeled as a fixture. It proves the scorer runs; it does not prove the thresholds.
2. **The website repo is `travi-trav3/iEatz`** (this session's primary checkout at `/home/user/iEatz`). Static site: `index.html` (117 KB, all CSS inline), `privacy.html`, `terms.html`, `favicon.svg`, `assets/app-store-badge.png`, `assets/photos/*.jpg` (15 files, flat, untagged). No `recipes/`, no `sitemap.xml`, no `robots.txt`, no OG tags, no JSON-LD.
3. **Deploy mechanism could not be confirmed from here.** No `wrangler.toml`, `wrangler.jsonc`, `functions/`, `_redirects`, `_headers`, `.github/workflows/` or `package.json` exist. That is consistent with git-connected Cloudflare Pages deploying `main` with no build command, which is the assumption `deploy-page.js` codes to. The sandbox's egress policy blocks `ieatzhealthy.com`, `ieatshealthy.com`, `apps.apple.com` and `itunes.apple.com` (proxy returns 403 on CONNECT), so gate 1 ("a trivial commit deploys and is visible") and every `verify-live.js` poll must run from Travis's machine or a Cowork task with network. **Travis: confirm in the Cloudflare dashboard that the Pages project is connected to `travi-trav3/iEatz`, production branch `main`.**
4. **Domain slip in the design exports.** Both Claude Design exports use `ieatshealthy.com` (no z). The brief, `privacy.html` and the Meta pixel comments use `ieatzhealthy.com`. The brief wins; `config.json` sets `site.origin` to `https://ieatzhealthy.com`. The golden test renders against the export's domain on purpose so the fidelity check is exact. When Travis re-exports, fix the domain in the design.
5. **The golden reference violates two of the brief's own rules.** The example export contains four em dashes (the short answer, one ingredient, one method step, one footnote) and renders a Google Play badge while `play_store` is null. `golden/example.content.json` keeps both, because it is a fidelity fixture. The shipping copy of the same page (`content/10-minute-breakfasts-busy-mornings.json`) drops them and passes the validator. Fix both in the design on the next export so the two files converge.
6. **The stale App Store URL is real.** `index.html` links `apps.apple.com/us/app/ai-recipe-generator-by-ieatz/id6475559706` in nine places (line 684 even carries a DEV note saying so). The current listing slug is `fridge-to-table-ai-recipes`. The pages use the `id6475559706` form. `index.html` is not touched by this build; it is a separate, one-line-per-link change for Travis to approve.

7. **GitHub Actions is disabled on the website repo.** `.github/workflows/verify-recipes.yml` is on `main` (ed7e7a8) but the API lists zero workflows and `workflow_dispatch` returns 404. Until Actions is enabled in the repo settings, no machine in this environment can confirm a page is live, and pins for new pages stay Buffer drafts. Enabling it is a one-time setting; after that the Action runs on every push to `main` that touches `recipes/`.

## `ieatz-social` (this repo)

| Item | Found |
|---|---|
| Batch ledger | Not in git. Mapping in `config.json` → `ledger`. Default path `../content/batch-NN/ledger.json` relative to `pages/`. |
| Content JSON per post | Not in git. The pages layer reads and writes the same ledger record; it does not create a parallel one. |
| Render harness | Not in git. The pin creative is untouched by this build. |
| `diversity-gate.js`, `contact-sheet.js` | Not in git. `eligibility.js` follows the same rules-as-code shape so it can sit next to them. |
| Buffer post creation, `boardServiceId` | Not in git. Documented in the skill: `create_post` with `metadata.pinterest = {boardServiceId, title, url}`. `wire-manifest.js` writes `pinterest.url`, `pinterest.title` and `cta` fields onto the ledger record; the existing scheduling step reads them. |
| Photo library | The only photos in git are on the website repo (`assets/photos/`). `photo-library.json` indexes them with tags and a `used` log. Real photography Travis drops into `assets/photos/recipes/<slug>/` overrides every provider. |
| Playbooks | Not in git. `RUNBOOK-pages.md` here is the phase to splice into `playbooks/social-content-pipeline/RUNBOOK.md`. |
| Egress | `raw.githubusercontent.com`, `fonts.googleapis.com`, `fonts.gstatic.com`, npm registry: reachable. Brand domains and Apple: blocked. |

## iEatsHealthy.com website repo (`travi-trav3/iEatz`)

| Item | Found | Used by the pages as |
|---|---|---|
| Production branch | `main` (only branch) | `deploy-page.js` pushes here, or opens a PR from `pages/<slug>` while `requireReview` is on |
| Analytics tags | Meta pixel `766649737085123` (with LDU and an App Store click handler keyed on `data-cta`), Pinterest tag `2613262358522`, GA4 `G-12ZB2TGF7R`. One contiguous block in `index.html` from the "Meta Pixel" comment to `</head>`. | `lib/site-config.js` slices that block at render time into the page head. Every App Store link on a page carries `data-cta` so the site handler labels it. |
| Logo mark | Inline `<svg class="mark" viewBox="0 0 38.25 58.486">` (fridge mark), `currentColor` | Extracted at render time and inlined. The export's `../assets/brand/logo-mark-green.svg` does not exist. |
| Favicon | `/favicon.svg` | Page `<link rel="icon">` |
| App Store badge | `/assets/app-store-badge.png` (180x60) | The export's `app-store-badge-black.svg` does not exist. |
| App screens | `assets/photos/app-receipt.jpg`, `app-oatmeal.jpg`, `app-buddha-bowl.jpg`, `app-chicken.jpg`, `app-toast.jpg` | The allowlist in `verified-facts.json`. |
| Food and kitchen photos | `buddha-bowl, couple-cooking, cooking-window, cutting-board-veg, fridge-organized, fridge-real-mess, meal-prep-spread(?), pesto-pasta-bowl, salmon, spices-spoons, tacos` (see `photo-library.json` for what actually exists; the README lists two files that are not on disk) | Library provider |
| Proof values on the live page | `5.0 on the App Store`; SixSocks review; `300+ Recipes generated daily`; `$1,500 Groceries thrown out per household, every year`; `12min Average cook time` | `verified-facts.json`, verified 2026-09-09 against `index.html` |
| Shared header/footer include | None. Everything is inline in `index.html`. | The page carries its own sticky header and footer from the design. |
| `sitemap.xml`, `robots.txt` | Absent | Created on the first deploy; appended after that, never rewritten. |
| Existing `/recipes/` | Absent | Page one is the first. |

## Session facts that shaped decisions

- Node 22, Playwright Chromium 1194 pre-installed at `/opt/pw-browsers`. `sharp`, `pixelmatch`, `pngjs`, `ajv` and `@anthropic-ai/sdk` installed under `pages/`.
- No image-generation key in the environment (`IMAGE_PROVIDER_API_KEY` unset). The chain runs library → none. `images.generated.enabled` is false in `config.json`.
- No `APPLE_PROVIDER_TOKEN` in the environment. Store links render without `pt`/`ct` (plain `?mt=8`) and the validator warns. A literal `PROVIDER_TOKEN` in output is a validation failure.
- Three CPP links arrived from Travis mid-session with no cluster labels. Stored under `store_urls.cpp_unmapped` until he says which is pantry, health and grocery.
