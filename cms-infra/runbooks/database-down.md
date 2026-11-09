# Runbook: Database down

## Trigger

Postgres healthcheck failing; `/readyz` reports `database: down`.

## Severity

P1

## Detection

`docker compose ps postgres` unhealthy; API logs show connection errors.

## Immediate actions

1. `docker compose logs --tail=200 postgres`
2. `df -h /var/lib/cms` — a full disk is the most common cause.
3. Do **not** delete files under `/var/lib/cms/postgres`.

## Investigation

- `docker exec cms-postgres pg_isready`
- Look for `PANIC`, `could not write`, `too many connections` in logs.
- `SELECT count(*) FROM pg_stat_activity;`

## Root cause checklist

- [ ] Disk full
- [ ] Container OOM-killed
- [ ] Too many connections (pool sizes)
- [ ] Data corruption

## Fix

- Disk → `disk-full.md`, then `docker compose up -d postgres`
- Corruption → `restore-from-backup.md`

## Verification

`/readyz` = ok; smoke tests pass; last backup succeeds.

## Post-incident

- Write a blameless post-mortem within 2 business days (P1/P2).
- Add a regression test or alert if one was missing (05-METRICS M-TDD-07).
- Update this runbook with anything that was unclear.
