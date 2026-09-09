# Pages run run-003-page-one-pin

Started 2026-09-09T20:00Z (session-driven; Buffer and GitHub steps done through connectors because this sandbox cannot reach the domain).

## Page

- 10min-breakfasts-busy-mornings: PR #2 merged to main (4dd1988). Deployed by Cloudflare Pages from main. URL https://ieatzhealthy.com/recipes/10-minute-breakfasts-busy-mornings/
- Live verification: NOT CONFIRMED BY A MACHINE. Direct fetch and web fetch are both egress-blocked here. The verify-recipes Action was added to the website repo (ed7e7a8) but GitHub reports zero workflows and dispatch returns 404, which is what GitHub does when Actions is disabled for the repository.
- Review gate: pages.requireReview set to false. Future pages push straight to main.

## Pin

- Creative: posts/pages/10min-breakfasts-busy-mornings.png (1000x1500, brand fonts verified loaded, hero photo cooking-window.jpg). Hosted on raw.githubusercontent at commit 680d502, HTTP 200, 1.39 MB.
- Buffer: post 6aa1bb9ff88b2a75ef099692 on the ieatzhealthy Pinterest channel, board "High protein meals and macro friendly recipes", customScheduled 2026-09-18 07:40 PDT (9 days out), destination = the page URL with UTMs, CTA copy "Get all five recipes". Saved as a DRAFT because the page URL has not returned 200 to a machine yet. Flip with edit_post saveToDraft:false once verified; then schedule the Slack alert.
- Slack alert: not scheduled (post is a draft). Channel #all-ieatz-healthy (C08U1PJ03U7), post_at = dueAt.

## Needs Travis (one time)

- Enable GitHub Actions on travi-trav3/iEatz (Settings > Actions > Allow all actions). After that every push to main that touches recipes/ verifies itself and records a commit status; the session check-in re-dispatches for page one, marks it live, flips the Buffer draft to scheduled and schedules the Slack alert.
- APPLE_PROVIDER_TOKEN and the CPP cluster labels are still open (run-001).
