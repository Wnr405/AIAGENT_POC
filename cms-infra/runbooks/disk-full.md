# Runbook: Data disk full

## Trigger

`DiskAlmostFull` (> 85 %) or `DiskWarn` (> 75 %).

## Severity

P1 at 85 %, P3 at 75 %

## Detection

`df -h /var/lib/cms`

## Immediate actions

1. `du -xh /var/lib/cms --max-depth=2 | sort -h | tail`
2. Safe to remove: old local dumps in `backups/postgres/hourly` **after** confirming they are in restic; `docker system prune` (images only).

## Investigation

Which directory grew? Postgres (bloat / WAL), MinIO (media), backups, logs?

## Root cause checklist

- [ ] Local backup retention not running
- [ ] Media growth (RK-03)
- [ ] Postgres bloat
- [ ] Container logs not rotated

## Fix

Free space as above; grow the disk (cloud console → `resize2fs`); file a capacity ticket (§17).

## Verification

Usage < 70 %; backups succeed.

## Post-incident

- Write a blameless post-mortem within 2 business days (P1/P2).
- Add a regression test or alert if one was missing (05-METRICS M-TDD-07).
- Update this runbook with anything that was unclear.
