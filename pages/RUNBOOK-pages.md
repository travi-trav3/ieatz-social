# Runbook phase: Pinterest landing pages

Splice this in as its own phase of `playbooks/social-content-pipeline/RUNBOOK.md`, **after batch planning and content generation, before hosting and scheduling**. The weekly scheduled task and a "run the batch" request both invoke the runbook, so both pick this up without a separate trigger.

## Preconditions

- `cd ieatz-social/pages && npm install` once per machine. Chromium comes from `PW_CHROMIUM` or the Playwright cache; never run `playwright install`.
- The website repo (`travi-trav3/iEatz`) is checked out next to `ieatz-social` (`config.json` → `site.website_repo.path`, or `IEATZ_WEBSITE_REPO=/path`), on `main`, clean.
- Environment: `APPLE_PROVIDER_TOKEN` (campaign links; without it links carry no `pt`/`ct` and the report warns). `ANTHROPIC_API_KEY` only if `generator.mode` is `api`. Never in the repo.
- `config.json` → `ledger` mapping matches the real batch ledger field names (DISCOVERY.md).

## The phase

```
node pages/run.js --batch batch-NN --dry-run     # everything except deploy, verify, wire
node pages/run.js --batch batch-NN               # the real thing
node pages/run.js --batch batch-NN --only <id>   # one concept
```

What one run does, in order, per Pinterest post:

1. **Eligibility** (`lib/eligibility.js`): hard excludes, then the 100-point score, written to `page_status.eligibility` with reasons.
2. **Arms** (`lib/cta-router.js`): eligible posts alternate `lp` / `direct`, carried across batches via `pages_meta.lastArm`. Off when `splitTest.enabled` is false (everything is `lp`).
3. For each `lp` concept not already live:
   - **Content.** The ledger record, or `content/<id>.json`, or the generator. In `generator.mode: session` the run writes `content/<id>.prompt.md` and stops for that concept with `awaiting_session`; the session (you) writes `content/<id>.json` from that prompt and reruns. In `api` mode it calls Claude directly and self-checks utility.
   - **Images** (`lib/source-images.js`): `assets/photos/recipes/<slug>/<slot>.jpg` override → library by tags (confirmed photos only for food, 30-day hero reuse rule, never twice on one page) → generated (off by default) → none. Photo-free slots render finished typographic tiles.
   - **Render + validate** (`lib/validate-page.js`): schema, lint, uniqueness, facts, numbers, JSON-LD, OG, links, hosts, size. Fail closed; the concept fails, the batch continues.
   - **Stage**: `recipes/<slug>/index.html`, regenerated `recipes/index.html`, appended `sitemap.xml`, and any older page whose related block gained the link (max 2).
   - **Deploy** (`lib/deploy-page.js`): commit to `main` and push, or push `pages/<id>` and open a PR while `pages.requireReview` is true. Cloudflare Pages deploys `main` on push.
   - **Verify live** (`lib/verify-live.js`): poll the final URL every 30 s for 20 min; 200 + og:title + parseable JSON-LD. Success → `state: live`. Timeout → `state: failed`, pin falls back.
4. **Route** every Pinterest post (page / app_store / CPP / homepage, token, UTMs, CTA copy, no consecutive repeats).
5. **Wire** the destination into the ledger's Buffer fields. A page URL is written only when `state` is `live`; anything else falls back to the store. The existing scheduling step then creates the pin from the ledger exactly as before.
6. **Report** `pages/runs/<run-id>.md`. Commit it with the ledger.

## The pin

The existing render harness produces the pin creative when it is available. When it is not (a remote session), `lib/pin/render-pin.js` renders the 1000x1500 creative from the page's headline and hero photo with the self-hosted brand fonts; commit it under `posts/pages/<id>.png`, pin the raw.githubusercontent URL to the commit SHA, and curl it for 200 before scheduling. Buffer: `create_post` on the Pinterest channel with `metadata.pinterest = {boardServiceId, title, url}`, `mode: customScheduled`, `dueAt` 7 or more days out, then the Slack alert in #all-ieatz-healthy at `dueAt`.

**A pin whose page has not returned 200 to a machine is created as a Buffer draft** (`saveToDraft: true`) with everything else filled in, and flipped with `edit_post saveToDraft:false` once `page_status.state` is `live`. Record `pin.buffer_post_id` and `pin.status` on the ledger record.

## Live verification without direct network

The website repo carries `.github/workflows/verify-recipes.yml`, which polls each pushed page and records a commit status `recipes/verify-live/<slug>`. A run that cannot reach the domain reads that status and records it with `run.js --assume-live <id> --evidence "<status text>"`. GitHub Actions must be enabled on the website repo for this to work (DISCOVERY.md item 7).

## When requireReview is on (off since 2026-09-09; here for when it is turned back on)

The run stops at `deployed (PR open)` and lists the PR under "Needs Travis". Merge it, wait for Cloudflare, then rerun the same command: the page goes `deployed → live`, the corpus updates, and the pin gets wired. Do not schedule the pin in between; the router will have routed it to the store until the page is verified.

After five clean merges, set `pages.requireReview` to false. The provenance line then switches to the unreviewed wording automatically on new pages (the validator rejects "edited by a person" while the gate is off).

## Weekly review addition

Next to the posts it already lists, the weekly review shows, for the next 7 days:

- pages going live: every ledger record with `page_status.state` in `deployed` or `live` and a `dueAt` in the window, with `page_status.url` and the PR if any;
- pins pointing at pages: every Pinterest post with `cta.destination = page`, with `cta.url` and `cta.copy`;
- pins that fell back: `cta.fallback = true`, with `cta.fallback_reason`.

All three come from the ledger fields the run writes; no separate query.

## Guards you should not work around

- `node pages/test/run-tests.js` runs the golden fidelity test, the pixel goldens, the validator fixtures, eligibility on the stand-in ledger, and the router dry run. Run it before any commit that touches `templates/` or `lib/`.
- The golden PNGs regenerate only with `node pages/test/golden.js --update`, only after a deliberate design re-export, and the commit says so.
- If a push to the website repo is refused, the run reports it and stops. Fix access; do not host the page anywhere else.
