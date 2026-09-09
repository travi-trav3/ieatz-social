# Pages run run-004-page-one-live

Started 2026-09-09T21:44:32.317Z. 

## Concepts considered

| id | score | eligible | exclude | reasons |
|---|---|---|---|---|
| 10min-breakfasts-busy-mornings | 100 | true |  | note: no recipe on the post; recipe dedupe runs at validation; +35 title promises enumerable content; +25 how-to or what-to-make-with; +20 pillar "Ingredient Idea"; +10 niche has all three axes; +10 query is question-shaped or list-shaped; eligible: 100 vs threshold 60 |

## Pages

## Pin destinations

| id | arm | destination | url | CTA copy | fallback |
|---|---|---|---|---|---|
| 10min-breakfasts-busy-mornings | lp | page | https://ieatzhealthy.com/recipes/10-minute-breakfasts-busy-mornings/?utm_source=pinterest&utm_medium=organic&utm_campaign=ingredient-idea&utm_content=10min-breakfasts-busy-mornings | Get all five recipes |  |

## Log

- 10min-breakfasts-busy-mornings: already live at https://ieatzhealthy.com/recipes/10-minute-breakfasts-busy-mornings/, skipping

## Session actions (Buffer and Slack through connectors)

- Buffer post 6aa1bb9ff88b2a75ef099692 flipped from draft to scheduled: Pinterest, board "High protein meals and macro friendly recipes", 2026-09-18 07:40 PDT, destination the page URL with UTMs.
- Slack alert Dr0C0PCQ9Y94 scheduled in #all-ieatz-healthy at the same time.
- Live verification evidence: Travis confirmed the page loads on 2026-09-09. Machine verification (verify-recipes Action) still needs GitHub Actions enabled on travi-trav3/iEatz.
- Bugs fixed on the way: a rerun of the same concept excluded itself as an existing page; the run read page state through a stale reference and re-deployed/re-polled a live page. Both covered by the idempotent rerun above.
