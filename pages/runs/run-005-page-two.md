# Pages run run-005-page-two

Started 2026-09-12T04:55Z. Concept high-protein-dinners-kids from fixtures/page-two.concepts.json; content written in session mode.

## Eligibility

| id | score | eligible | reasons |
|---|---|---|---|
| high-protein-dinners-kids | 75 | true | +35 title promises enumerable content; +20 pillar "Persona Spotlight"; +10 niche has all three axes; +10 query is list-shaped |

## Page

- Generator output needed four fixes before it passed the validator: meta description over 165 characters (twice), bridge body without the axis words, prose over 700 words. Each was a readable validator reason.
- images: hero=none (no confirmed portrait food photo matches the tags), inset=library, lifestyle=library, band=library, final=library, recipes 1 to 4 = none (typographic tiles). Needs photography: hero, recipe-1 to recipe-4.
- validation: object ok (695 prose words), html ok (72902 bytes). Warnings: no APPLE_PROVIDER_TOKEN; recipes have no image so no recipe rich results.
- deploy: main @ a58acd8 (recipes/high-protein-dinners-kids-actually-eat/index.html, recipes/index.html, sitemap.xml). Page one's re-render with the new related link was NOT in this commit: the dry run had already written the link into page one's content, so the backfill considered it done. Fixed in run.js; page one republishes in the next push.
- verify: the run process was killed while lib/verify-live.js polled a proxy 403 as if it were the site (fixed: proxy 403 is now "unreachable" and the run leaves the page deployed). The website repo's Action run 34674319147 polled for 20 minutes and got a 200 whose body had no og:title and no JSON-LD: the site's fallback page, meaning Cloudflare had not deployed a58acd8 within 20 minutes of the push. Re-dispatched after adding a served-page diagnostic.

## Pin

- Creative rendered to posts/pages/high-protein-dinners-kids.png (photo pesto-pasta-bowl.jpg at native resolution in the 1000x930 slot; eyebrow "Family dinner · 25 minutes · one pan, two plates"). Hosted at commit 962df50, HTTP 200. First render carried page one's eyebrow; caught at QA, eyebrow made a required parameter.
- Not scheduled until the page is verified live.

## 05:38Z: deploy not live

Dispatched verify run 34675222284 for both pages: page one LIVE in 1 attempt; page two served `<title>iEatz Healthy | Fridge to Table: AI Recipes</title>` (the homepage, 116754 bytes, server=cloudflare) with HTTP 200 for 20 minutes. Conclusion: Cloudflare Pages has not deployed a58acd8 (or 552b5e5) 40 minutes after the push. Page one's merge on 2026-09-09 did deploy. Cannot inspect Cloudflare from this session (connector not authorized). Page stays `deployed`; pin stays unscheduled; a check-in re-dispatches the verifier.
