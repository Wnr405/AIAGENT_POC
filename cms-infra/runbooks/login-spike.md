# Runbook: Login failure spike (security)

## Trigger

`LoginFailureSpike` (> 100 failed logins/min for 5 min).

## Severity

P1 — security incident

## Detection

Audit log: `/api/admin/audit?action=auth.login_failed`; nginx 429 counts.

## Immediate actions

1. Notify Security.
2. Lockout (FR-AUTH-06) and rate limits (SEC-07) are already active — confirm 429s are being served.
3. If one IP range dominates, block it in `ufw` or at the edge.

## Investigation

- Group failures by IP in the audit export (CSV).
- Any `auth.login` successes from the same IPs? → treat as compromise: deactivate affected users, force password reset.

## Root cause checklist

- [ ] Credential stuffing
- [ ] Misconfigured integration

## Fix

Block sources; if compromise suspected: rotate `JWT_SECRET` (logs everyone out) and reset affected passwords.

## Verification

Failure rate back to baseline; no suspicious successes.

## Post-incident

- Write a blameless post-mortem within 2 business days (P1/P2).
- Add a regression test or alert if one was missing (05-METRICS M-TDD-07).
- Update this runbook with anything that was unclear.
