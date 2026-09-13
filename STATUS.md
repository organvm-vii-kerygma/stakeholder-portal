# Repository status

Evidence cutoff: 2026-09-13 UTC.

## Product truth

Hermeneus is ORGANVM's public intelligence interface, retrieval layer,
dashboard, and operational control plane. The public deployment is
<https://stakeholder-portal-ten.vercel.app>.

The committed manifest reports 95 repositories, 8 organs, and 15 deployment
records. The public `/api/metrics` endpoint is available from Neon-backed
persistent storage, but reports `stale: true` with timestamp
`2026-04-18T12:04:31.637Z`. Repository-side health checks now fail closed;
production linkage, credentials, ingestion, and freshness remain an explicit
administrator boundary in #97.

## Verified on default

| Intention | Receipt |
| --- | --- |
| Secure dependency baseline | #89 → `7bce85e`; zero audit findings and exact-head CI/security checks passed |
| MIT license recovery | #90 → `f0327d2`; recovered alone from the preservation branch |
| Truthful operational checks | #93 → `36f0fe7`; missing configuration and unhealthy/stale ingestion fail closed |
| Branch constitution | #94 → `99d8c7d`; four evidence-derived standing lanes created |
| Compatible dependency group | #91 → `809861b`; 15 updates landed, TypeScript 7 preserved separately in #101 |
| Build-warning family | #96 → `3964a7e`; proxy migration and bounded filesystem tracing pass 270 tests/build |
| Production activation contract | #98 → `52d136f`; exact-SHA, environment, ingestion, freshness, and rollback receipts documented |
| Dependabot review policy | #100 → `cb3389a`; contradictory auto-merge workflow retired, human review retained |
| CodeQL action maintenance | #77 → `2699d43`; CodeQL Action 4.38.0 passed exact-head CI, CodeQL, and secret scan |

No issue, pull-request, branch, or commit history was deleted or force-pushed.

## Active finish lines

| Priority | Intention | Artifact | Finish line |
| --- | --- | --- | --- |
| Wave 0 | Default-branch enforcement | #102 | require CI, CodeQL, secret scan, current branch, and code-owner approval in repository settings |
| Wave 2 | Canonical production and fresh ingestion | #97 / #57 | canonical Git/Vercel linkage, scoped secrets, migration, ingestion, current metrics, health and rollback receipts |
| Wave 4 | TypeScript 7 | #101 | supported ESLint/parser toolchain and the complete verification suite |

## Release boundary

Do not publish the draft first release until #97 proves the deployed SHA is
canonical, production data is current, the authenticated health contract passes,
and a rollback candidate is recorded. The repository-side license, security,
build, and operational-check prerequisites are complete.
