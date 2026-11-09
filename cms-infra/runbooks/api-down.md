# Runbook: API down

## Trigger

`APIDown` alert, or `/healthz` failing from external monitoring.

## Severity

P1 — response within 15 min.

## Detection

- Alertmanager page
- `curl -fsS https://$SERVER_NAME/healthz` fails
- nginx returns 502/504

## Immediate actions

1. `cd /opt/cms/current && docker compose ps` — is `cms-api` running / healthy?
2. `docker compose logs --tail=200 cms-api`
3. If it crash-loops after a deploy in the last hour → **rollback** (`rollback.md`) first, investigate later.

## Investigation

- `docker inspect cms-api --format '{{.State.ExitCode}} {{.State.OOMKilled}}'`
- Env validation errors appear at startup as `Invalid environment configuration`.
- `curl -s localhost:3000/readyz` inside the network shows which dependency is down.

## Root cause checklist

- [ ] Bad release
- [ ] Invalid / missing env var after a `.env` change
- [ ] Postgres or Redis down (`database-down.md`)
- [ ] OOM (`oom-kill.md`)
- [ ] Disk full (`disk-full.md`)

## Fix

- Bad release → `./scripts/rollback.sh <prev>`
- Env → fix `.env`, `docker compose up -d cms-api`, log it in `CHANGELOG.env.md`
- Dependency → follow its runbook

## Verification

`./scripts/smoke-test.sh https://$SERVER_NAME` passes; error rate back to baseline for 15 min.

## Post-incident

- Write a blameless post-mortem within 2 business days (P1/P2).
- Add a regression test or alert if one was missing (05-METRICS M-TDD-07).
- Update this runbook with anything that was unclear.
