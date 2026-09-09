# pages/

Autonomous Pinterest landing pages for `ieatzhealthy.com/recipes/<slug>/`. Read in this order:

1. `BRIEF.md`: what this is and the decisions already made.
2. `DISCOVERY.md`: what the two repos actually contain, and where the brief's assumptions were wrong.
3. `RUNBOOK-pages.md`: the phase, the commands, the review gate.

```
npm install
node test/run-tests.js                       # everything: golden, validator, eligibility, router
node run.js --concepts fixtures/page-one.concepts.json --dry-run
node run.js --batch batch-NN
```

Layout matches `BRIEF.md` section 4, plus:

- `photo-library.json`: the tagged index of the website repo's photos with a usage log.
- `content/<id>.json`: one content object per concept; `content/<id>.prompt.md` while the session is writing it.
- `fixtures/`: the stand-in ledger and the page-one concept list.
- `templates/pinterest-roundup/golden/`: the golden content object, the pixel goldens, the photo-free screenshots, and self-hosted fonts for deterministic renders.
- `.staging/<run-id>/`: rendered trees waiting to be copied into the website repo (gitignored).
