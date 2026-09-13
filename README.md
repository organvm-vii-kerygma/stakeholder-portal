# Stakeholder Portal

Public intelligence interface for ORGANVM repositories and system metadata.

## Local Development

```bash
npm ci
npm run dev
```

## Quality Gates

```bash
npm audit --audit-level=low
npm run lint
npm run typecheck
npm run test
npm run ci:quality-gate
npm run validate-manifest
npm run build
```

## Runtime Flags

- `CHAT_DIAGNOSTICS_ENABLED=1`: include planner/retrieval/provider diagnostics in `/api/chat` SSE metadata payloads.
- `PLATFORM_CONFIG_JSON='{"connectors":{"docs":{"enabled":false}}}'`: structured runtime override for connectors, retention, compliance, and SLO knobs.
- `FEEDBACK_EVENT_LOG_PATH=/absolute/path/feedback-events.ndjson`: override where feedback events are appended.
- `FEEDBACK_PERSIST_DISABLED=1`: disable on-disk feedback event append.
- `INGEST_DEAD_LETTER_PATH=/absolute/path/ingest-dead-letter.ndjson`: override dead-letter log output for connector ingestion cycles.
- `HYBRID_RETRIEVAL_CACHE_TTL_MS=30000`: retrieval cache TTL in milliseconds (`0` disables cache writes).
- `RETENTION_AUDIT_DAYS=90` / `RETENTION_FEEDBACK_DAYS=180`: retention windows consumed by compliance lifecycle utilities.
- `ADMIN_API_TOKEN=...`: token fallback for admin/automation APIs.
- `ADMIN_LOGIN_PASSWORD=...`: password for `/api/admin/session` login flow.
- `ADMIN_SESSION_SECRET=...`: HMAC secret for signed admin session cookies.
- `CRON_SECRET=...`: secret for `/api/cron/maintenance` and `/api/cron/ingest` triggers.
- `CRON_CONNECTOR_IDS=docs,workspace`: default connector set for cron route when query param not supplied.
- `ALERT_WEBHOOK_URL=...`: generic webhook sink for critical alerts.
- `SLACK_WEBHOOK_URL=...`: Slack incoming webhook sink for critical alerts.
- `RESEND_API_KEY=...`, `ALERT_EMAIL_TO=...`, `ALERT_EMAIL_FROM=...`: email sink config for critical alerts.
- `ALERT_SINKS_DISABLED=1`: disable all outbound alert sink dispatch.
- `ALERT_DISPATCH_WARNINGS=1`: enable warning-level outbound dispatch (critical dispatch is always enabled when sinks exist).
- `ALERT_SINK_MAX_RETRIES=2`: retry count for transient outbound sink failures (`429`/`5xx`).
- `ALERT_SINK_RETRY_BASE_MS=250`: base backoff for sink retries (linear, per attempt).
- `ALERT_ROUTING_JSON='{\"critical_channels\":[\"slack\",\"email\"],\"warning_channels\":[\"webhook\"]}'`: override channel escalation rules.

Default feedback event log path (when persistence is enabled):

- `.codex/telemetry/feedback-events.ndjson`

## Manifest Data Policy

- `src/data/manifest.json` is a committed snapshot.
- `npm run generate` refreshes the snapshot from workspace sources.
- `npm run build` runs the TypeScript ingestion worker with
  `--allow-stale-manifest --skip-vector`:
  - regenerates when source registry files are available
  - keeps existing snapshot when running in isolated CI environments

## CI

GitHub Actions workflow at `.github/workflows/ci.yml` runs:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run ci:quality-gate`
6. `npm run build`

## Production activation contract

The canonical source is repository ID `1173179511` at
`organvm-vii-kerygma/stakeholder-portal`, branch `main`. A successful build
from another repository path or an older commit is not a production receipt.

Secret values are never committed. `.env.example` names the runtime contract;
store the production values in Vercel and the scheduled-job values in GitHub:

| Surface | Required names |
| --- | --- |
| Vercel production | `DATABASE_URL`, `GROQ_API_KEY`, `EMBEDDING_API_KEY`, `ADMIN_SESSION_SECRET`, `CRON_SECRET` |
| GitHub Actions secrets | `DATABASE_URL`, `CRON_SECRET` |
| GitHub Actions variables | `DEPLOY_URL` (canonical public URL); optional `MAINTENANCE_CONNECTORS` and `INGESTION_MAX_*` SLO overrides |

Before promotion:

1. Confirm Vercel's Git integration resolves stable repository ID `1173179511`
   to the canonical owner/name and `main`.
2. Pull or inject production environment variables without writing them to git.
3. Run `node --import tsx scripts/validate-env.ts`.
4. Apply migrations with `npm run db:migrate`.
5. Run `npm run generate:incremental` and verify the corpus is non-empty.
6. Deploy the exact verified `main` SHA.
7. Confirm `/api/metrics` reports `stale:false` with a current timestamp.
8. Dispatch both scheduled workflows and retain their successful run/artifact
   receipts.

Production is not current merely because the homepage returns HTTP 200. The
deployment SHA, database freshness, ingestion health, runtime error scan, and
rollback candidate must all be recorded.

## Offline Evaluation

```bash
npm run eval:offline                # run bundled sample
npm run eval:offline -- ./evals.json # run custom dataset
npm run maintenance:run             # run ingestion + retention + alerts scorecard
npm run maintenance:run -- --incremental --connectors inline-admin,docs
npm run maintenance:run -- --incremental --no-alerts
```

## Admin Intelligence API

`/api/admin/intel` provides operations for ingestion orchestration, retention, and eval runs.

- `GET /api/admin/intel?op=metrics`
- `GET /api/admin/intel?op=health`
- `GET /api/admin/intel?op=scorecards&limit=10`
- `POST /api/admin/intel` with action:
  - `run_ingestion_cycle`
  - `run_maintenance_cycle`
  - `apply_retention`
  - `run_eval`
  - `export_subject_data`
  - `delete_subject_data`

Authentication:
- Preferred: authenticated admin session cookie from `/api/admin/session` (`/admin/login` UI).
- Fallback for automation: `x-admin-token: <ADMIN_API_TOKEN>` and `x-portal-role`. <!-- allow-secret -->
- Session-authenticated write operations require `x-admin-csrf` (managed automatically by `/admin/intel` UI).

Admin session endpoints:
- `POST /api/admin/session` (login)
- `GET /api/admin/session` (session status)
- `DELETE /api/admin/session` (logout)

Persistence paths:
- `MAINTENANCE_SCORECARD_PATH` (default `.codex/telemetry/maintenance-scorecards.ndjson`)

## Cron Trigger

`GET /api/cron/maintenance` runs an incremental maintenance cycle automatically.

Auth:
- `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>` <!-- allow-secret -->

Optional query params:
- `since=<ISO timestamp>`
- `connectors=docs,workspace`

Also wired: `.github/workflows/maintenance-cron.yml` (hourly scheduled run of `maintenance:run`).

Concurrency behavior:
- Maintenance runs are single-flight; overlapping triggers share one active run.
