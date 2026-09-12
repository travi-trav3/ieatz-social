# Pages run run-006-page-two-live

Started 2026-09-12T15:36:38.968Z. 

## Concepts considered

| id | score | eligible | exclude | reasons |
|---|---|---|---|---|
| high-protein-dinners-kids | 75 | true |  | note: no recipe on the post; recipe dedupe runs at validation; +35 title promises enumerable content; +20 pillar "Persona Spotlight"; +10 niche has all three axes; +10 query is question-shaped or list-shaped; eligible: 75 vs threshold 60 |

## Pages

### high-protein-dinners-kids: live
- live: verified 2026-09-12T15:36:38.971Z from external evidence: verify-recipes Action run 34702565073 LIVE in 1 attempt (production branch switched to main at 15:32Z)

## Pin destinations

| id | arm | destination | url | CTA copy | fallback |
|---|---|---|---|---|---|
| high-protein-dinners-kids | lp | page | https://ieatzhealthy.com/recipes/high-protein-dinners-kids-actually-eat/?utm_source=pinterest&utm_medium=organic&utm_campaign=persona-spotlight&utm_content=high-protein-dinners-kids | Get all four recipes |  |

## Log

- high-protein-dinners-kids: marked live from external evidence: verify-recipes Action run 34702565073 LIVE in 1 attempt (production branch switched to main at 15:32Z)

## What happened between 05:38Z and 15:36Z

Cloudflare Pages had been building every push to main as a preview. The project's production branch was `claude/brave-faraday-o5q71u` (a merge of main from 2026-09-09, 4209804), not `main`, so production stayed on the page one deployment while a58acd8 and everything after it landed only on `main.ieatz.pages.dev`. Found by adding a `probe_urls` diagnostic and then a `cf_action` step to the website repo's verify-recipes Action (the Cloudflare connector exposes no Pages tools and the sandbox cannot reach api.cloudflare.com). With the `CLOUDFLARE_API_TOKEN` repo secret in place, run 34702531889 switched the production branch to `main` and created production deployment 008afc95 from 277e2a2. Verify run 34702565073 then found both pages LIVE in one attempt.

## Follow-through

- Page two marked live from that evidence (this run) and persisted to `content/high-protein-dinners-kids.json`.
- Page one republished with the related card pointing at page two: first as d9b1cc2, which was wrong (see below), then as 32b044d.
- Pin scheduled in Buffer: post 6aa57a9d9a7f0553d16da5d7, Pinterest ieatzhealthy, board "School lunch and family dinner ideas", 2026-09-22T16:35:00-07:00, destination the page URL with `utm_campaign=persona-spotlight&utm_content=high-protein-dinners-kids`, image the PNG hosted at commit 962df50 (HTTP 200, 1.78 MB), title "4 high protein dinners kids will actually eat". Description names all four dinners and ends with the rotated CTA "Full recipes on the site."
- Slack alert scheduled in #all-ieatz-healthy: Dr0C1G9S3CTB at 1790120100 (the pin's dueAt).

## Two pipeline bugs found and fixed on the way

1. **Republish re-picked every photo.** `--republish` ran the image sourcing from scratch, and the 30-day reuse rule then refused page one its own hero (cooking-window.jpg) because page two had used that file in a band the same day. d9b1cc2 shipped page one with a photo-free hero. Fix: `sourceImages` takes `keepExisting`; a slot that already carries an image whose file still exists keeps it and gets its original use record back. `--reimage` forces a full re-pick. 32b044d restored the hero.
2. **Pin CTA copy promised five recipes on a four-recipe page.** "Get all five recipes" was a literal in config. Now `Get all {count} recipes`, filled from the page's recipe count; fewer than two recipes falls back to "the". The router also now carries the last CTA copy across batches through `pages_meta.lastCta`, so consecutive pins in different ledgers do not repeat.

Also: the content file is now written whenever a page's live state changes, not only when it is rendered. Before this, `--assume-live` updated the ledger and corpus but left `content/<id>.json` saying `deployed`.

## Still open

- `www.ieatzhealthy.com` returns Cloudflare 525. Pages and pins use the apex only.
- APPLE_PROVIDER_TOKEN, CPP cluster labels, recipe photography: unchanged from run-005.
