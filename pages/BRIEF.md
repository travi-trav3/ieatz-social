# Claude Code brief: autonomous Pinterest landing pages
Repo path for this file: `ieatz-social/pages/BRIEF.md`
Date: 2026-09-09. Owner: Travis Enos, Applied Mobile Growth.
Supersedes nothing. Extends `ieatz-content-hub-build-spec.md` (July 2026), `pinterest-page-template-spec-sep-2026.md` (v0.3) and `templates/pinterest-roundup/REVISIONS.md`. Where this brief and those documents disagree, this brief wins, because it is the one written against the finalized design.

> Build note (2026-09-09): this file is the brief as delivered. `DISCOVERY.md` records where the repos differ from what it assumes, and `RUNBOOK-pages.md` is the phase it asks for. Nothing in this file has been edited to match the build.
---
## 0. What you are building, in one paragraph
When the content pipeline runs (weekly scheduled task, or Travis asking for a batch), every Pinterest post in the batch gets scored for whether it earns a landing page. The ones that do get a full page written to the template, images sourced, the page rendered to static HTML, validated, pushed to the iEatsHealthy.com repo, deployed by Cloudflare, confirmed live at its final URL, added to the sitemap and cross-linked into the cluster, and only then does the Pinterest post get scheduled in Buffer with that page as its destination and a "get the recipes" style CTA. Posts that do not earn a page go where they always went (App Store, a CPP, or the homepage). A page failure never blocks a post. Nothing gets scheduled against a URL that has not returned 200.
---
## 1. Inputs you will find waiting
Two files exported from Claude Design, dropped by Travis into `ieatz-social/pages/templates/pinterest-roundup/`:
| File | What it is | How to treat it |
|---|---|---|
| `PinterestRoundup.template.html` | The adaptive template. Slots, optional sections, prop-driven copy. | **Design source of truth for markup and CSS.** You derive the working template from it. You do not hand-edit it. When the design changes, Travis re-exports and you re-derive. |
| `PinterestRoundup.example.html` | The same template fully built out for "5 breakfasts you can make in 10 minutes on a busy morning." | **Golden reference.** The generator, fed that page's content object, must reproduce this file. It is your acceptance test, not an inspiration. |
Plus, already in the project and repo: `REVISIONS.md` (why the order is what it is), the v0.3 template spec (schema, measurement design, uniqueness rules), the content hub build spec (repo split, lead time, ledger, weekly review), and the existing pipeline playbooks under `playbooks/social-content-pipeline/`.
**Read the two exports and the three documents before writing a line of code.** Then read the actual repos. Do not assume file names from this brief; every path below marked (discover) is a best guess to be confirmed against what is there.
---
## 2. Decisions already made. Do not reopen these.
1. **Two repos.** Generator code, content objects, ledger and validators live in `ieatz-social` next to the rest of the pipeline. Rendered pages and their images are written into the **iEatsHealthy.com website repo**, which Cloudflare deploys. The page generator writes to the website repo, never serves from GitHub Pages. Domain authority and campaign attribution both depend on the page living on ieatzhealthy.com.
2. **Pages live at `ieatzhealthy.com/recipes/<slug>/`.** Subdirectory, not subdomain. One page per concept.
3. **Section order is v0.3 advertorial** (hero with pain-led opener carrying the direct answer, then the app module, then the recipes), exposed as `sectionOrder` so the split test can flip it. See `REVISIONS.md` v0.3.1 for the reasoning and the constraint that the direct answer must survive inside the opener.
4. **Full value on the page.** Every recipe complete and free. No gates, no teasers, no email capture, no popups.
5. **The app is pitched on one axis only:** the page is a guess about the reader's kitchen, the app is not. Never "download for more recipes."
6. **Buffer scheduling is `customScheduled` with `dueAt` 7 or more days out.** The lead time is the review window. The weekly review of what is queued is the safeguard. Locked in the hub spec.
7. **Volume cap: 3 pages per week.** Hard cap in code. Slow is the point.
8. **Real app screens only,** from an allowlist. Never generated, never recreated from the design kit on a live page.
9. **No em dashes anywhere in generated output.** Lint fails the page.
10. **Attribution via App Store Connect campaign links** (`pt`, `ct`, `mt=8`) and GA4 events. UTMs are for GA4 only; Apple ignores them.
---
## 3. Decisions Travis has to make. Defaults are set so you are never blocked.
| # | Decision | Default until Travis says otherwise |
|---|---|---|
| A | **Image policy.** Fully autonomous photo sourcing means either the existing photo library, AI-generated food photography, or a stock API. The design system says real food photography only. | Provider order: (1) the categorized photo library in the repo, matched by tags, (2) generated food photography through a configurable provider with a locked prompt template, every generated image flagged `source: generated` in the ledger, (3) a photo-free brand-shell fallback so the page still ships finished. Stock is not in the chain. |
| B | **Review gate on pages.** Pages go live on the domain without a human seeing them. | First 5 pages open a PR on the website repo that Travis merges. After 5 clean merges, flip `pages.requireReview` to false and push direct. |
| C | **Cloudflare deploy mechanism.** Git-connected Pages, or Wrangler direct upload. | Discover from the website repo (section 8). Assume git-connected. |
| D | **Split test on or off at launch.** | On. Eligible posts alternate `lp` and `direct` arms. `lp` arm builds the page, `direct` arm links straight to the store with `ct=pin-direct`. |
| E | **Recipe provenance line in the footer.** | Ship the disclosure ("developed with the iEatz recipe engine and edited by a person"). Only true if the review gate in B is real. If B is turned off, reword the line to drop "edited by a person." |
---
## 4. Repo layout
### `ieatz-social` (discover the existing structure first, then add)
```
pages/
  BRIEF.md                              this file
  config.json                           caps, arms, tokens, provider settings, requireReview
  verified-facts.json                   the only source of claims a page may make (section 6)
  corpus-index.json                     every recipe and query ever published, for uniqueness
  schema/
    page.schema.json                    content object schema (section 5), JSON Schema draft 2020-12
  templates/pinterest-roundup/
    PinterestRoundup.template.html      Claude Design export, read-only
    PinterestRoundup.example.html       Claude Design export, golden reference
    REVISIONS.md
    template.js                         derived working template (section 7)
    partials/                           head tags include, sticky header, bridge, recipe card, etc.
    golden/
      example.content.json              content object that must reproduce the example export
      example.mobile.png                golden screenshots, regenerated only on a deliberate design change
      example.desktop.png
  lib/
    eligibility.js                      rules-as-code page scoring (section 9)
    generate-content.js                 content object authoring (section 10)
    source-images.js                    provider chain (section 11)
    render-page.js                      content object to static HTML
    validate-page.js                    lint, schema, uniqueness, facts, size, links
    deploy-page.js                      write to website repo, commit or PR, trigger deploy
    verify-live.js                      poll final URL, check body not just status
    link-graph.js                       sitemap append, hub index, related-links injection
    cta-router.js                       destination, campaign token, UTMs, CTA copy
    wire-manifest.js                    write page fields into the batch ledger
  run.js                                node pages/run.js --batch batch-NN [--dry-run] [--only <id>]
  runs/                                 one report per run, committed
```
### iEatsHealthy.com website repo (discover first)
```
recipes/
  index.html                            hub index, regenerated on every publish
  <slug>/index.html                     one page per concept
assets/photos/recipes/<slug>/           hero and per-recipe images for that page
sitemap.xml                             appended, never rewritten from scratch
```
Where the site keeps its analytics tags (GA4, Pinterest tag, Meta pixel), find it and read it into the template's head partial at render time. Do not copy tag snippets into the template by hand. The page must carry exactly what the rest of the site carries.
---
## 5. Content object
Extends the pipeline's existing content JSON. The page layer is `page`, the routing is `cta`, and the ledger gets `page_status`. Every unique value on a page is a field. Nothing unique is typed into HTML.
```json
{
  "id": "10min-breakfasts-busy-mornings",
  "pillar": "Ingredient Idea",
  "query_target": "what can I make for breakfast in 10 minutes",
  "niche": { "inventory": "pantry staples", "constraint": "10 minutes, busy morning", "outcome": "breakfast" },
  "page": {
    "create": true,
    "type": "roundup",
    "slug": "10-minute-breakfasts-busy-mornings",
    "sectionOrder": "advertorial",
    "showPlayStore": false,
    "title_tag": "",
    "meta_description": "",
    "h1": "",
    "hero": {
      "opener": "",
      "direct_answer": "",
      "image": { "src": "", "alt": "", "pin_description": "", "source": "library | generated | none" }
    },
    "bridge": {
      "headline": "",
      "body": "",
      "beats": [ { "title": "", "detail": "" } ],
      "app_screens": [ "app-receipt.jpg", "app-oatmeal.jpg" ],
      "proof": { "rating_key": "app_store_rating", "review_key": "review_sixsocks", "stat_key": "recipes_per_day" }
    },
    "jump_list": true,
    "recipes": [
      {
        "anchor": "", "name": "", "time_minutes": 0, "servings": 0, "protein_g": 0,
        "image": { "src": "", "alt": "", "pin_description": "", "source": "" },
        "ingredients": [], "steps": [], "why_it_works": ""
      }
    ],
    "cta_cadence": ["hero", "post_bridge", "post_recipe_3", "final"],
    "supporting_sections": [ { "type": "substitutions | make_ahead | serve_with | common_mistakes | storage | nutrition_note", "heading": "", "body": "" } ],
    "faq": [ { "q": "", "a": "" } ],
    "internal_links": [ { "title": "", "url": "" } ],
    "provenance_line": ""
  },
  "cta": {
    "arm": "lp | direct",
    "destination": "page | app_store | cpp_pantry | cpp_health | cpp_grocery | homepage",
    "url": "",
    "campaign_token": "pin-lp | pin-direct",
    "utm": { "utm_source": "pinterest", "utm_medium": "organic", "utm_campaign": "", "utm_content": "" },
    "pin_cta_copy": ""
  },
  "page_status": {
    "eligibility": { "score": 0, "eligible": true, "reasons": [] },
    "state": "planned | generated | rendered | validated | deployed | live | failed | skipped",
    "url": "",
    "live_verified_at": "",
    "failure": null,
    "fallback_used": false
  }
}
```
Proof values are keys into `verified-facts.json`, not literal strings. The generator cannot invent a rating, a quote or a number because it cannot write one into the object.
Write `page.schema.json` for this and validate every object against it before rendering. A schema failure is a hard stop for that concept, not for the batch.
---
## 6. verified-facts.json
The only source of factual claims a page may make. Populate from the live site and App Store Connect on first run, then Travis maintains it.
```json
{
  "app": { "name": "Fridge to Table: AI Recipes", "apple_id": "6475559706", "provider_token": "SET_ME" },
  "store_urls": {
    "app_store": "https://apps.apple.com/us/app/id6475559706",
    "cpp_pantry": "", "cpp_health": "", "cpp_grocery": "",
    "play_store": null
  },
  "campaign_tokens": { "lp": "pin-lp", "direct": "pin-direct" },
  "proof": {
    "app_store_rating": { "value": "5.0", "verified": "2026-09-09" },
    "review_sixsocks": { "quote": "I haven't had any groceries go to waste the last couple of weeks", "author": "SixSocks, App Store review", "verified": "" },
    "recipes_per_day": { "value": "300+", "label": "recipes generated by iEatz users every day", "verified": "" },
    "waste_stat": { "value": "$1,500", "label": "of groceries thrown out per household, every year", "verified": "" }
  },
  "app_screens_allowlist": [
    "https://ieatzhealthy.com/assets/photos/app-receipt.jpg",
    "https://ieatzhealthy.com/assets/photos/app-oatmeal.jpg",
    "https://ieatzhealthy.com/assets/photos/app-buddha-bowl.jpg"
  ],
  "features_claimable": ["receipt import", "photo of fridge", "calories and macros", "Instacart hand-off", "step by step instructions"],
  "features_never_claim": ["aisle-sorted shopping list", "weekly planner", "in-app Instacart checkout", "goal selector", "weekly calorie tracker"],
  "diets_supported": [],
  "never_say": []
}
```
`diets_supported` is empty on purpose. It is an open item with Korian. Until it is populated, no page targets a diet query and no recipe is labeled with a diet claim. `play_store` stays null until Android releases; `showPlayStore` reads from it.
Any `verified` date older than 90 days makes the validator warn. Older than 180 days, it fails.
---
## 7. Deriving the working template from the export
The Claude Design export is design source, not a template engine. Turn it into one without losing fidelity.
1. Open both exports. Diff them. Every place they differ is a slot. Every section present in the example but optional in the template is a conditional block. Every repeated structure (recipe cards, beats, FAQ items, related links) is a loop.
2. Build `template.js` as a plain function `render(contentObject, siteHead) -> html`. Template literals or a small engine, your call, but no framework and no build step. Output is one self-contained HTML file: inline CSS from the export, self-hosted or Google-loaded fonts exactly as the export does it, no external JS.
3. Partials for anything that appears more than once or changes by prop: `head.js` (meta, OG, canonical, JSON-LD, site tags), `sticky-header.js`, `hero.js`, `bridge.js`, `recipe-card.js` (with the alternating orientation by index), `cta.js`, `supporting.js`, `faq.js`, `related.js`, `footer.js`, `sticky-bar.js`, `measurement.js`.
4. **Every section must render cleanly with its optional content absent.** No hero image, no recipe images, zero related links, one supporting section, `showPlayStore` false. A page with no photos at all has to look finished, not broken. Build the photo-free variant of the hero and the recipe card and screenshot both.
5. The measurement script from the v0.3 example carries over: App Store links built at runtime from `apple_id`, `provider_token`, `campaign_token`; `app_store_click` with `cta_position`; scroll depth; UTMs captured and forwarded to GA4 only.
6. **Golden test, run on every commit that touches `templates/`:** render `golden/example.content.json`, screenshot at 390 and 1280 wide, compare to `example.mobile.png` and `example.desktop.png` at a pixel-diff tolerance you set once (start at 0.5 percent) and never loosen to make a failing test pass. Also diff the visible text content against the export. If the design changes, Travis re-exports, you regenerate the golden set deliberately, and the commit says so.
Write the golden content object by hand from the example export. It is the most important file in the template folder because it proves the extraction was lossless.
---
## 8. Discovering the two repos before you touch them
Do this on the first run and write what you find to `pages/DISCOVERY.md`. Re-run it when anything looks off.
**In `ieatz-social`:** where the batch ledger lives and its exact field names; where the content JSON per post lives; how the render harness is invoked; how `diversity-gate.js` and `contact-sheet.js` read the ledger; how Buffer posts are created and where `boardServiceId` comes from; where the photo library lives and how it is tagged; where the playbooks are. Wire into those. Do not build a parallel ledger.
**In the website repo:** how it deploys. Look for `wrangler.toml` or `wrangler.jsonc`, a `functions/` directory, `_redirects`, `_headers`, a `.github/workflows/` directory, a build command in `package.json`. Then:
- Git-connected Cloudflare Pages (expected): identify the production branch. A push to it triggers the deploy. `deploy-page.js` commits and pushes there, or opens a PR against it when `requireReview` is on.
- Wrangler direct upload: `deploy-page.js` runs `wrangler pages deploy` with a `CLOUDFLARE_API_TOKEN` from the environment. Never commit the token.
Also find: where the existing `/recipes/` pages sit if any exist, the sitemap, the analytics tag snippets, the App Store URL the site currently uses (it is stale, `ai-recipe-generator-by-ieatz`, and should become the `id6475559706` form with `pt`/`ct`/`mt` when you touch it), and whether the site has a shared header or footer include the page should match.
Push access to the website repo comes from whatever token the session already has. If pushes are refused, stop and report. Do not work around it.
---
## 9. Eligibility: which posts earn a page
Rules as code in `eligibility.js`, same discipline as `diversity-gate.js`. Runs after batch planning, before any page work. Writes `page_status.eligibility` on every Pinterest post, eligible or not, with the reasons.
**Hard excludes (score is irrelevant):**
- Not a Pinterest post.
- Pillar is brand, proof, quote, stat or product-feature with no search query behind it.
- `query_target` is empty.
- A page already exists for a query with cosine similarity above 0.85 to this one (`corpus-index.json`). Reuse that page's URL instead. Log it as `skipped: existing_page`.
- Any recipe in the concept duplicates a published recipe (ingredient-set Jaccard above 0.7 with the same primary protein and method).
- The weekly page cap is already met.
- The concept targets a diet not in `diets_supported`.
**Scored signals (each adds, threshold 60 of 100):**
- Title or headline promises enumerable content: a number plus recipes, ideas, meals, dinners, breakfasts, lunches, snacks, lists, swaps, ways. +35
- Title is a how-to or a what-to-make-with. +25
- Pillar is Ingredient Idea or Persona Spotlight. +20
- `niche` has all three axes populated. +10
- Query maps to a real search phrasing (the generator supplies it, the rule checks it is question-shaped or list-shaped). +10
**Score above threshold and no hard exclude: eligible.** Then the arm rule applies (section 12). Only `lp` arm posts proceed to page generation. Log everything. When Travis asks why a post did or did not get a page, the answer has to be in the ledger, not in your memory.
---
## 10. Writing the page
`generate-content.js` produces the full `page` object for an eligible concept. The bar is the uniqueness checklist in the hub spec plus rules 11 to 13 from the template spec. Restated as things the validator checks, because prose rules that are not checked are not rules:
- H1 is question-shaped or list-shaped and matches the pin promise.
- The opener presses the problem the reader is living and lands the direct answer within its first two sentences. The validator checks that `direct_answer` appears verbatim inside `hero.opener`.
- Three to five recipes for a roundup, each with a real ingredient list with quantities, real steps, a time, servings, a protein figure labeled as an estimate, and a one-line "why it works." None duplicates the corpus.
- Bridge copy expresses the one axis and shares no sentence with any published page.
- Two supporting sections, types different from the previous published page.
- Three FAQ pairs phrased the way people search.
- Two to four internal links to live pages, chosen by tag overlap. Page one links to the hub index and the homepage and nothing else; the validator allows that only while the corpus has fewer than three pages.
- 400 to 700 words of useful content outside the recipes. Not padded.
- The utility test as a self-check prompt at the end of generation: would this page help someone even if the app did not exist. If the model answers no, regenerate once, then fail the concept.
- Sentence case headlines, no em dashes, no emoji, nothing from `never_say`, no feature outside `features_claimable`, no number that is not in `verified-facts.json` or inside a recipe.
Alt text describes the dish. Pin descriptions are written for Pinterest search. Both are generated with the recipe, not after.
---
## 11. Sourcing images
`source-images.js` fills every `image` slot with a provider chain and records the provider used.
1. **Library.** Match the recipe's tags against the categorized photo library already in the repo. Respect the existing rule that a hero is not reused within 30 days across any channel. Prefer never-used images. Open the candidate and confirm it matches the dish before accepting it; slugs lie.
2. **Generated.** If no library match, generate through the provider in `config.json` with a locked prompt template: overhead or three-quarter angle, natural window light, the dish exactly as the ingredient list describes it, no hands, no faces, no text, no props that imply a brand. Output the hero at 1500x1000 and every recipe image at 1000x1500. Run a quality check: minimum resolution, no text artifacts detected, subject present. Flag `source: generated`. Keep the alt text honest about what is shown. Cost per page is logged in the run report.
3. **None.** If generation is unavailable or fails the check, the slot is `null` and the template renders the photo-free variant. The page still ships. The run report lists it as needing photography.
Real photography dropped by Travis into `assets/photos/recipes/<slug>/` with the slot name as the filename overrides all three on the next run. That is the manual path and it costs nothing to keep open.
The pin creative itself is unaffected by any of this. The existing render harness still produces the 2:3 pin from the content object exactly as it does today. The page's images and the pin's image can be the same file when the library provided it.
---
## 12. CTA routing and the split test
`cta-router.js` runs on every Pinterest post whether or not it got a page.
**Arm assignment** (only for eligible posts, only while `splitTest.enabled` is true): alternate `lp` and `direct` in eligibility order within the batch, carrying the alternation across batches from the ledger. `lp` builds the page and links to it. `direct` builds nothing and links to the store.
**Destination and URL:**
| Case | Destination | URL | `ct` | Pin CTA copy |
|---|---|---|---|---|
| Eligible, `lp` arm, page live | `page` | `https://ieatzhealthy.com/recipes/<slug>/?utm_source=pinterest&utm_medium=organic&utm_campaign=<pillar>&utm_content=<id>` | (on the page's own buttons) `pin-lp` | Rotated from a list: "Get all five recipes", "Full recipes on the site", "See the whole list", "Recipes and swaps inside" |
| Eligible, `lp` arm, page failed | falls back to the direct rule | | | falls back |
| Eligible, `direct` arm | `app_store` or the matching CPP | `https://apps.apple.com/us/app/id6475559706?pt=<pt>&ct=pin-direct&mt=8` (CPP adds `ppid`) | `pin-direct` | Existing store CTA rotation |
| Not eligible | existing router: CPP if the query maps to a cluster, else homepage | existing | `pin-direct` on store links | existing |
Never the same CTA copy on consecutive posts. That rule already exists for the store CTAs; extend it to the page CTAs.
When `splitTest.enabled` is false, every eligible post is `lp`. Travis flips it after the read at roughly 300 outbound clicks per arm, or if the direct arm is clearly winning earlier.
---
## 13. Deploy, verify, link
Order matters. Each step gates the next.
1. **Render** the page and its assets into a staging folder in the website repo checkout.
2. **Validate** (`validate-page.js`): schema, lint, uniqueness, facts, JSON-LD parses and contains one `CollectionPage` with an `ItemList` of `Recipe` objects whose `@id` fragments match on-page anchors, `FAQPage`, `BreadcrumbList`; OG tags present; every internal link resolves in the repo; HTML under 150 KB before images; no external script hosts beyond fonts. Fail closed.
3. **Deploy** (`deploy-page.js`): commit `recipes/<slug>/index.html`, the images, the updated `sitemap.xml`, the regenerated `recipes/index.html`, and any older pages whose related-links block gained a link to this page (`link-graph.js`, bounded to the two most related). Push to the production branch, or open a PR when `requireReview` is on. Commit message carries the concept id and the run id.
4. **Verify live** (`verify-live.js`): poll `https://ieatzhealthy.com/recipes/<slug>/` every 30 seconds for up to 20 minutes. Success means HTTP 200, the response body contains the page's `og:title`, and the JSON-LD in the live body parses. A 200 that serves the site's 404 page is a failure, which is why the body check exists. On success write `page_status.state = live` and `live_verified_at`. On timeout write `failed` with the reason and continue the batch with the fallback destination.
5. **Only now** does `wire-manifest.js` write the page URL into the Buffer post fields in the ledger, and only now may the existing scheduling step create the Pinterest post with `metadata.pinterest.url` set to it. The existing rule that no post is scheduled against an unverified URL applies to page URLs exactly as it applies to image URLs.
Pages go live before pins by design. The 7-day lead time doubles as an indexing head start.
---
## 14. The run
`node pages/run.js --batch batch-NN` runs everything above for one batch, idempotently, from the ledger. Rerunning skips anything already `live`, retries anything `failed` once, and never creates a second page for the same concept. `--dry-run` does everything except deploy and Buffer. `--only <id>` scopes to one concept.
Where it sits in the pipeline: after batch planning and content generation, before hosting and scheduling. Add it to `RUNBOOK.md` as its own phase. The scheduled weekly task and Travis's "run the batch" request both invoke the runbook, so both pick it up without a separate trigger.
Every run writes `pages/runs/<run-id>.md`: concepts considered, eligibility score and reasons per post, arm, pages built, image provider per slot and cost, validation results, deploy commits, live verification times, fallbacks used, anything needing Travis. Commit it. This is what the weekly review reads.
Extend the existing weekly review view to list pages going live and pins pointing at pages in the next 7 days, next to the posts it already lists.
---
## 15. What must never happen
- A pin scheduled against a page URL that has not returned 200 with the right body.
- A page shipped with a placeholder block, a broken image, or an app screen outside the allowlist.
- A recipe reused across pages, in any wording.
- A number, quote, rating or feature claim that is not in `verified-facts.json`.
- A diet-targeted page while `diets_supported` is empty.
- A Play Store badge while `play_store` is null.
- An em dash.
- More than 3 pages in a week.
- A page failure that blocks the post it belonged to. Fallback, log, continue.
- Loosening the golden-test tolerance to make a failing render pass.
- Editing the Claude Design exports by hand.
- Committing a Cloudflare token, a provider API key, or the App Store provider token into the repo.
---
## 16. Build order and gates
Prove each step by hand before wrapping automation around it. Each gate is binary.
1. **Discovery.** Both repos read, `DISCOVERY.md` written, deploy mechanism confirmed, push access confirmed. Gate: a trivial commit to the website repo deploys and is visible.
2. **Template derivation.** `template.js` and partials built from the export. Gate: the golden test passes on the example content object at both widths, and the photo-free variant screenshots look finished.
3. **Page one by hand.** Render the example content object for real, validate, deploy, verify live at its final URL. Gate: 200 with body check, Google Rich Results Test passes on the live URL, Pinterest Rich Pin validator run and the render type recorded in `REVISIONS.md`. If it renders as a single Recipe Rich Pin, decide with Travis before page two: accept, or suppress with the `pinterest-rich-pin` meta.
4. **Campaign tokens.** `pin-lp` and `pin-direct` created in App Store Connect, `provider_token` set in the environment, links verified to resolve. Gate: a click on the live page reaches the App Store listing with the tokens intact.
5. **Schema, validator, facts, corpus.** Gate: the example object passes; a deliberately broken copy (duplicate recipe, em dash, invented stat, missing direct answer) fails with a readable reason for each.
6. **Eligibility.** Run it against the last three batches' ledgers retroactively. Gate: Travis agrees with the eligible list, or the thresholds get tuned once and re-run.
7. **Generator and image chain.** Gate: two new concepts produce valid objects and sourced images end to end in `--dry-run`.
8. **Deploy, verify, link graph.** Gate: page two goes live through the code path, the hub index and sitemap update, page one's related block gains the link, and page one re-deploys cleanly.
9. **Router and manifest wiring.** Gate: a `--dry-run` batch shows the correct destination, URL, token and CTA copy on every Pinterest post, including a forced page failure that falls back correctly.
10. **First real batch.** Two to three pages, `requireReview` on, PRs merged by Travis, pins scheduled 7+ days out, run report committed, Slack alerts scheduled per the existing SOP.
11. **Scheduled task.** Only after 10 is clean. The weekly Cowork scheduled task invokes the runbook; the runbook includes the pages phase.
Do not skip to 11. The scheduled task is what turns an untested step into an unattended failure.
---
## 17. Definition of done
- A batch run with no human input produces: eligibility decisions on every Pinterest post, live pages for the `lp` arm concepts, correct destinations on every pin, a committed run report, and a ledger that explains all of it.
- The golden test guards the template.
- The validator fails closed on every rule in section 15 that code can check.
- A page failure produces a scheduled pin with the fallback destination and a line in the run report, never a missing post.
- Travis can read one file per run and know what shipped, what did not, and why.
---
## 18. Questions for you to decide:
1. Which image generation provider, and is there an existing key in the environment. Default chain works without one; the page just ships photo-free and flags it.
2. The three CPP URLs with their `ppid` parameters for `verified-facts.json`. The router degrades to `app_store` until they are set.
3. Confirm the review quote and the usage stat are still current before they go into `verified-facts.json` with a verified date.
4. The App Store Connect provider token (`pt`). Environment variable, not the repo.
