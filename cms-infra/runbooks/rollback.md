# Runbook: Rollback a bad deploy

## Trigger

Smoke tests fail after deploy, G-08 thresholds breached (5xx > 2× baseline, P95 > 1.5×), or a P1 regression.

## Severity

Matches the triggering incident

## Detection

Deploy log; Grafana post-deploy window.

## Immediate actions

`cd /opt/cms/current && ./scripts/rollback.sh` (defaults to the previous release recorded by deploy.sh) or `./scripts/rollback.sh <version>`.

## Investigation

Migrations are backward compatible (07-OPS-ARCH §12.2), so the schema is **not** rolled back. If a migration itself is broken, stop and escalate.

## Root cause checklist

- [ ] Code regression
- [ ] Config / env
- [ ] Migration

## Fix

After rollback, open a `fix/` or `hotfix/` branch with a failing test that reproduces the issue (TDD).

## Verification

Smoke tests pass; metrics at baseline.

## Post-incident

- Write a blameless post-mortem within 2 business days (P1/P2).
- Add a regression test or alert if one was missing (05-METRICS M-TDD-07).
- Update this runbook with anything that was unclear.
