# Runbook: High 5xx error rate

## Trigger

`HighErrorRate` (> 5 % 5xx for 5 min).

## Severity

P1

## Detection

Grafana error panel; Sentry issue spike (grouped by request id).

## Immediate actions

1. Was there a deploy in the last hour? If yes → rollback.
2. Check Sentry for the top new issue.

## Investigation

- `docker compose logs cms-api | jq 'select(.level=="error")' | tail`
- Correlate with `X-Request-Id` from a failing request.

## Root cause checklist

- [ ] Regression in release
- [ ] Dependency (DB / Redis / S3) degraded
- [ ] Unexpected traffic pattern

## Fix

Rollback or hotfix (`08-GIT-WORKFLOW §12`).

## Verification

5xx < 1 % for 15 min.

## Post-incident

- Write a blameless post-mortem within 2 business days (P1/P2).
- Add a regression test or alert if one was missing (05-METRICS M-TDD-07).
- Update this runbook with anything that was unclear.
