# cms-infra — single-VM Docker Compose deployment (07-OPS-ARCH)

```
docker-compose.yml           base: nginx, cms-api, cms-worker, postgres, redis, minio, node-exporter
docker-compose.prod.yml      resource limits, log rotation, tuned Postgres
docker-compose.staging.yml   smaller limits, debug logs
.env.example                 canonical env schema (CI keeps it in sync with cms-api/src/config/env.schema.ts)
nginx/                       TLS, security headers, SPA, /api proxy, public-API micro-cache
postgres/init/               creates the restricted `cms_app` runtime role
scripts/                     deploy, rollback, backups, restore, smoke test, secrets, env-sync check
systemd/                     hourly Postgres / daily media backup timers
monitoring/                  Prometheus scrape config + alert rules (§15.3)
runbooks/                    the 10 MVP runbooks (§18.3)
host-bootstrap.sh            one-time VM preparation (§22.1)
```

## First production install (summary)

1. `BASTION_IP=… ./host-bootstrap.sh` (as root on Ubuntu 24.04).
2. Obtain TLS: `certbot certonly --webroot -w /var/www/certbot -d cms.example.com`, copy to `/etc/cms/tls/`.
3. `./scripts/gen-secrets.sh` → fill `/opt/cms/shared/env/.env.production` from `.env.example` (mode 0600).
4. `./scripts/deploy.sh 1.0.0` (as `deploy`). It verifies the cosign signature, runs migrations as the
   schema owner, starts the stack, waits for health, runs smoke tests and rolls back automatically on failure.
5. `./scripts/minio-init.sh` once (bucket, no anonymous access, app credentials).
6. The first Admin is created as an invite for `SEED_ADMIN_EMAIL` (run `docker compose run --rm cms-api node dist/scripts/seed.js`).

Deploy windows, approvals and the 15-minute post-deploy watch (gate G-08) are described in 07-OPS-ARCH §11.
