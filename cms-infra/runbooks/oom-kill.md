# Runbook: Out-of-memory kill

## Trigger

`OutOfMemoryKill` or a container shows `OOMKilled=true`.

## Severity

P1

## Detection

`docker inspect <c> --format '{{.State.OOMKilled}}'`, `dmesg | grep -i oom`

## Immediate actions

Restart the service (`docker compose up -d <svc>`); if repeating, roll back the last release.

## Investigation

Memory graph per container; large media variants (sharp) in the worker? Big CSV exports?

## Root cause checklist

- [ ] Memory leak in release
- [ ] Limits too low in docker-compose.prod.yml
- [ ] Huge image processed by the worker

## Fix

Raise limits temporarily (document in PR), fix leak, add a load test (05-METRICS §9.3).

## Verification

No OOM for 24 h; memory stable.

## Post-incident

- Write a blameless post-mortem within 2 business days (P1/P2).
- Add a regression test or alert if one was missing (05-METRICS M-TDD-07).
- Update this runbook with anything that was unclear.
