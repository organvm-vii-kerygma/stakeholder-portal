# Repository status

Evidence cutoff: 2026-09-13 UTC.

## Product truth

Hermeneus is the public intelligence interface, retrieval layer, dashboard, and
operational control plane for ORGANVM. The public deployment is
<https://stakeholder-portal-ten.vercel.app>.

The committed manifest currently reports 95 repositories, 8 organs, and 15
deployments. The public portal's last observed index date is 2026-03-21, so the
deployment exists but current production-data freshness is not yet proven.

## Verified on default

- Dependency-security family: PR #89 merged as `7bce85e`; exact-head CI,
  CodeQL, and secret scan passed, with zero known npm-audit findings and
  265 tests.
- MIT license recovery: PR #90 merged as `f0327d2`; exact-head CI, CodeQL,
  and secret scan passed.
- No branch, issue, or pull-request history was deleted.

## Active finish lines

| Priority | Intention | Artifact | Finish line |
| --- | --- | --- | --- |
| Wave 0 | Truthful operational checks | #92 / PR #93 | merge verified fail-closed checks; establish a configured production run |
| Wave 0 | Default-branch enforcement | repository settings | require CI, CodeQL, secret scan, and code-owner review |
| Wave 1 | CodeQL action maintenance | PR #77 | rebase on current `main`; exact-head checks and review pass |
| Wave 1 | Current dependency delta | PR #91 | prove the grouped major toolchain changes or split unsafe members |
| Wave 1 | Activation record | #57 | reconcile the deployed URL with the remaining persistence/freshness gap |
| Wave 2 | Persistent current ingestion | successor issue/branch | reproducible PostgreSQL/pgvector ingestion produces fresh attributable data |
| Wave 4 | Build-warning family | successor issue/branch | remove middleware deprecation and bound filesystem tracing without weakening path security |

## Release boundary

Do not publish the draft first release until the license is detected, operational
checks are truthful, persistent ingestion is configured, and production
freshness has an evidence receipt.
