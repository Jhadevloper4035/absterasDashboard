# EC2 Deployment

This deployment uses one EC2 instance, Docker Compose, and Nginx reverse proxy.

## EC2 Setup

Run this on a fresh Ubuntu EC2 instance as the deploy user, usually `ubuntu`:

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"

sudo mkdir -p /opt/absteras-crm
sudo chown -R "$USER:$USER" /opt/absteras-crm
sudo chmod 750 /opt/absteras-crm
newgrp docker
```

Verify Docker and the app directory:

```sh
docker --version
docker compose version
test -w /opt/absteras-crm
```

Open inbound ports `22`, `80` and `443` in the EC2 security group.

## HTTPS

Create the first certificate on the EC2 host before deploying the HTTPS nginx config:

```sh
sudo apt-get install -y certbot
cd /opt/absteras-crm
docker compose -f docker-compose.prod.yml down
sudo certbot certonly --standalone -d crm.absteras.com
docker compose -f docker-compose.prod.yml up -d
```

Renewals use the same host certificates mounted into the nginx container:

```sh
sudo certbot renew --pre-hook "cd /opt/absteras-crm && docker compose -f docker-compose.prod.yml stop nginx" --post-hook "cd /opt/absteras-crm && docker compose -f docker-compose.prod.yml start nginx"
```

## GitHub Secrets

Add these repository secrets:

```text
DOCKERHUB_USERNAME=your-dockerhub-username
DOCKERHUB_TOKEN=your-dockerhub-access-token
DOCKER_IMAGE_NAMESPACE=your-dockerhub-username-or-org
EC2_HOST=your-ec2-public-ip-or-dns
EC2_USER=ubuntu
EC2_SSH_KEY=private-key-for-ec2-user
EC2_APP_DIR=/opt/absteras-crm
BACKEND_ENV=full production app env contents for root .env
```

`BACKEND_ENV` must include real production values for:

```text
NODE_ENV=production
APP_NAME=Sales CRM API
PORT=4000
AUTH_SECRET=
SETUP_TOKEN=
MONGODB_URI=
CORS_ORIGIN=https://your-domain.com
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
S3_BUCKET=
S3_UPLOAD_PREFIX=uploads
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SMTP_TIMEOUT_MS=5000
TRUST_PROXY=1
```

The workflow appends `BACKEND_IMAGE` and `FRONTEND_IMAGE` automatically during deploy.

Pipeline flow:

1. Run backend tests and syntax checks.
2. Build frontend.
3. Build Docker images for backend and frontend.
4. Push images to Docker Hub.
5. SSH to EC2.
6. Clean stale app source files on EC2.
7. Pull the new images.
8. Stop old containers.
9. Start fresh containers with the pulled images.
10. Clean old Docker images and build cache.

Push to `main` or run the `Deploy EC2` workflow manually.

The deploy cleanup does not remove Docker volumes, so database or uploaded data stored in volumes is not deleted accidentally.

## Backup And Restore

Install MongoDB database tools on the EC2 host, then run:

```sh
scripts/backup-mongodb.sh
```

It reads `MONGODB_URI` from the environment or root `.env` and writes a gzip archive under `backups/`.

Restore only after confirming the target database:

```sh
scripts/restore-mongodb.sh backups/mongodb-YYYYMMDD-HHMMSS.archive.gz
```

## Health Monitoring

Use the healthcheck script from cron, systemd, or your EC2 monitoring agent:

```sh
CRM_HEALTH_URL=https://your-domain.com/health deploy/healthcheck.sh
```

It exits non-zero if the API or MongoDB health check is not OK.

## Smoke Test

After deploy:

```sh
CRM_BASE_URL=https://your-domain.com npm --prefix backend run smoke
```

For authenticated dashboard verification, also set:

```sh
CRM_SMOKE_EMAIL=admin@example.com
CRM_SMOKE_PASSWORD=your-password
```
