# Runbook: TLS certificate expiring

## Trigger

`TLSCertExpiringSoon` (< 14 days).

## Severity

P2

## Detection

`echo | openssl s_client -connect $SERVER_NAME:443 2>/dev/null | openssl x509 -noout -enddate`

## Immediate actions

`certbot renew --webroot -w /var/www/certbot` then copy to `/etc/cms/tls` and `docker exec cms-nginx nginx -s reload`.

## Investigation

Why did auto-renew fail? `systemctl status certbot.timer`, port 80 reachable for ACME?

## Root cause checklist

- [ ] certbot timer disabled
- [ ] Port 80 blocked
- [ ] DNS changed

## Fix

Renew, reload nginx, re-enable the timer.

## Verification

New expiry > 60 days; SSL Labs grade A.

## Post-incident

- Write a blameless post-mortem within 2 business days (P1/P2).
- Add a regression test or alert if one was missing (05-METRICS M-TDD-07).
- Update this runbook with anything that was unclear.
