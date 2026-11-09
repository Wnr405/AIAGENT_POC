# Runbook: Restore from backup

## Trigger

Data loss / corruption, or the quarterly restore drill.

## Severity

P1 (incident) / planned (drill)

## Detection

Corruption errors, accidental mass deletion found in the audit log.

## Immediate actions

1. Decide the target point in time (`restic snapshots`).
2. Announce downtime.

## Investigation

Which tables/rows are affected? Is a partial restore (into a scratch DB, then copy rows) enough?

## Root cause checklist

- [ ] Operator error
- [ ] Application bug
- [ ] Disk corruption

## Fix

`cd /opt/cms/current && ./scripts/restore.sh <snapshot-id>`; for media: `mc mirror` back from the backup bucket.

## Verification

Smoke tests pass; spot-check recent content; record timings in `RESTORE-DRILLS.md` (RTO ≤ 4 h).

## Post-incident

- Write a blameless post-mortem within 2 business days (P1/P2).
- Add a regression test or alert if one was missing (05-METRICS M-TDD-07).
- Update this runbook with anything that was unclear.
