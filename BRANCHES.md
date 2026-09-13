# Branch constitution

Default branch: `main`

Policy: GitHub Flow with a small set of standing program lanes. There is no
`develop` branch. A `release/*` branch is permitted only when a real
versioned release requires a freeze line.

## Standing branches

| Branch | Purpose | Merge into | Green means |
| --- | --- | --- | --- |
| `main` | Production-true, deployed, always releasable trunk | tags/releases | clean audit; required CI, tests, evaluation, build, CodeQL, secret scan, and production invariants pass |
| `lane/verify` | Tests, contracts, CI, evaluation, and reproducibility | `main` | proof becomes stricter without weakening behavior |
| `lane/heal` | Security, broken integrations, stale data, and operational rot | `main` | the previously failing path is reproduced and passes |
| `lane/expand-intelligence` | Complete the stated ingestion, retrieval, connector, and corpus coverage | `main` | sources are attributable, current, and tested |
| `lane/evolve-platform` | Architecture, performance, observability, and developer experience implied by the current product | `main` | behavior is preserved except for documented changes |

A standing lane is an integration boundary, not a work queue. It must be kept
close to `main`, accept only work within its stated purpose, and remain green
under the same applicable checks as `main`. A dormant lane remains documented
until explicitly retired.

## Working branches

Preferred pattern: `work/<lane>/<short-intent>`.

Also allowed: `feat/*`, `fix/*`, `chore/*`, `docs/*`, and `test/*`.

- Cut from the relevant lane, or from `main` when the change is trunk-ready.
- Keep exactly one recoverable intention per branch and pull request.
- Use one worktree per active working branch.
- Merge only by pull request; delete a working branch only after verified merge.
- If blocked, park it with an evidence comment and preserve the branch.
- Never store unrelated WIP, snapshots, secrets, generated telemetry, or
  production data on a standing branch.

## Hotfixes

`hotfix/<short-intent>` starts from `main`, returns to `main` by pull
request, and is then back-ported to every diverged living lane.

## Releases

Use tags and GitHub releases from verified `main`. Create `release/*` only
when the repository has an active freeze process; merge the release result back
to `main` and every affected living lane.

## Retirement

A standing lane is retired only when its purpose is complete or absorbed, and a
pull request updates this file. Branch deletion is never a substitute for an
intention verdict.
