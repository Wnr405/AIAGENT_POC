#!/usr/bin/env bash
# 07-OPS-ARCH §22.1 — run once as root on a fresh Ubuntu 24.04 LTS VM.
# Usage: BASTION_IP=203.0.113.10 DATA_DISK=/dev/sdb ./host-bootstrap.sh
set -euo pipefail
: "${BASTION_IP:?set BASTION_IP (SSH is only allowed from it)}"
DATA_DISK="${DATA_DISK:-/dev/sdb}"

apt-get update && apt-get upgrade -y
apt-get install -y curl jq git ca-certificates gnupg ufw fail2ban unattended-upgrades restic awscli certbot

# Docker Engine + Compose plugin
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# §16.2 Docker hardening
cat > /etc/docker/daemon.json <<JSON
{ "live-restore": true, "userland-proxy": false, "no-new-privileges": true,
  "log-driver": "json-file", "log-opts": { "max-size": "50m", "max-file": "5" } }
JSON
systemctl restart docker

# cosign for image signature verification
curl -fsSL -o /usr/local/bin/cosign https://github.com/sigstore/cosign/releases/download/v2.4.1/cosign-linux-amd64
chmod +x /usr/local/bin/cosign

# Users (§3.4)
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
usermod -aG docker deploy
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/; s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload ssh || systemctl reload sshd

# Firewall (§5.3)
ufw default deny incoming
ufw default allow outgoing
ufw allow from "${BASTION_IP}" to any port 22 proto tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

# Data disk (§6.2)
if [[ -b "${DATA_DISK}" ]] && ! mount | grep -q /var/lib/cms; then
  mkfs.ext4 -L cmsdata "${DATA_DISK}"
  mkdir -p /var/lib/cms
  echo "LABEL=cmsdata /var/lib/cms ext4 defaults,nofail 0 2" >> /etc/fstab
  mount /var/lib/cms
fi

# Directory layout (§3.5)
mkdir -p /var/lib/cms/{postgres,redis,minio,uploads-staging,backups/{postgres/{hourly,daily},env,audit}}
mkdir -p /opt/cms/{releases,shared/env,shared/secrets} /etc/cms/tls /var/log/cms /var/www/certbot
chown -R deploy:deploy /opt/cms
chown 999:999 /var/lib/cms/redis                  # redis user in the official image
chown 70:70 /var/lib/cms/postgres                 # postgres user in the alpine image
chmod 700 /var/lib/cms/backups
timedatectl set-timezone UTC

# Backups via systemd timers (§13)
install -m 0644 "$(dirname "$0")/systemd/"cms-backup-*.{service,timer} /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now cms-backup-postgres.timer cms-backup-media.timer

echo "Host bootstrap complete. Next: TLS (certbot), .env (scripts/gen-secrets.sh), first deploy. Reboot recommended."
