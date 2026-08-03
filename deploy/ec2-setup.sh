#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/opt/absteras-crm}"
UBUNTU_USER="${2:-ubuntu}"

if [[ $EUID -ne 0 ]]; then
  echo "Run this script as root or with sudo."
  exit 1
fi

echo "[1/6] Updating system packages"
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release ufw git

printf '[2/6] Installing Docker Engine and Compose plugin\n'
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

printf '[3/6] Enabling Docker and adding %s to docker group\n' "$UBUNTU_USER"
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker "$UBUNTU_USER"

printf '[4/6] Configuring firewall\n'
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

printf '[5/6] Creating app directory %s\n' "$APP_DIR"
sudo mkdir -p "$APP_DIR"
sudo chown -R "$UBUNTU_USER:$UBUNTU_USER" "$APP_DIR"

printf '[6/6] Adding swap for a small t3.micro instance\n'
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
fi

cat <<EOF
EC2 setup is complete.

Next steps:
1. Copy your production files to $APP_DIR
   - .env
   - docker-compose.prod.yml
   - deploy/nginx.conf
2. From the EC2 host, run:
   cd $APP_DIR
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
3. Verify health:
   curl http://localhost/health

Note: t3.micro is acceptable for low-traffic testing or light usage, but a t3.small or larger is better if you expect heavier traffic or background jobs.
EOF
