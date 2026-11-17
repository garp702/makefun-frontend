# makefun-frontend

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/garp702/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/garp702/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, read-only make.fun frontend built from plain static files — no build step, no framework. It reads only make.fun's public API (`GET https://make.fun/api/...`) and renders four surfaces, each on its own hash route:

- `#/` — the board of live bounties: live pot (prize pool plus entry fees paid in), entry fee, a countdown computed from each deadline (a bounty past its deadline counts as closed even while the API still lists it open), and entry counts, with sorting by pot, ending soon, or most entries.
- `#/bounty/<slug>` — a bounty's page: summary, the rewards table with the live pot split per place, dates, status, and its description.
- `#/bounty/<slug>/leaderboard` — the leaderboard, ranked by judge win rate with 90% ranges and match records, paged 50 at a time.
- `#/u/<handle>` — an account's public profile: record, entries and payouts.

Performance choices: API answers are kept in a small in-memory cache and revalidated with their minute-bound ETags (`If-None-Match`, so repeat views often cost a 304); the first load is only the shell, one stylesheet and the board module, and the bounty and profile views load by `import()` when their route is first opened; countdown chips tick in place once a minute with no re-render and no requests.

`main.ts` hands the entry in: it copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `buildDossier` from `vendor/makefun-frontend.ts` (left byte-for-byte as the kit's copy).

## Run it

```sh
node serve.ts            # serves app/ at http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # build the entry output
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
