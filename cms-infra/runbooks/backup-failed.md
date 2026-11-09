# Runbook: Backup failed or missing

## Trigger

`BackupFailed` / `BackupMissing` (> 90 min since last success).

## Severity

P1 (RPO at risk)

## Detection

`systemctl status cms-backup-postgres.service`, `journalctl -u cms-backup-postgres -n 100`

## Immediate actions

1. Run it by hand: `/opt/cms/current/scripts/backup-postgres.sh manual`
2. If restic/S3 is the problem, keep the local dump and escalate.

## Investigation

- Credentials expired? (`BACKUP_S3_*`)
- `restic snapshots` works?
- Disk full?

## Root cause checklist

- [ ] Off-site credentials rotated without updating `.env`
- [ ] Network egress blocked
- [ ] Disk full

## Fix

Fix cause; run a manual backup; confirm `restic snapshots` shows it.

## Verification

`.last-success` timestamp updated; alert resolves.

## Post-incident

- Write a blameless post-mortem within 2 business days (P1/P2).
- Add a regression test or alert if one was missing (05-METRICS M-TDD-07).
- Update this runbook with anything that was unclear.
