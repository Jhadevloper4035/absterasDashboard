# EC2 Deployment

This deployment uses one EC2 instance, Docker Compose, and Nginx reverse proxy.

## EC2 Setup

For a small production or staging deployment on a `t3.micro`, run the bootstrap script:

```sh
chmod +x deploy/ec2-setup.sh
sudo ./deploy/ec2-setup.sh /opt/absteras-crm ubuntu
```

This installs Docker, Docker Compose plugin, enables the firewall, creates the app directory, and adds a small swap file for a low-memory instance.

Open inbound ports `22`, `80`, and `443` in the EC2 security group.

### Manual fallback

If you prefer to install everything yourself:

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release ufw git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo tee /etc/apt/sources.list.d/docker.list > /dev/null <<EOF
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable
EOF
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## GitHub Secrets

The repository already contains a GitHub Actions workflow at [.github/workflows/deploy-ec2.yml](../.github/workflows/deploy-ec2.yml) that builds images, pushes them to Docker Hub, and deploys them to EC2.

### One-click secret checklist

Add these repository secrets in GitHub -> Settings -> Secrets and variables -> Actions:

```text
DOCKERHUB_USERNAME=your-dockerhub-username
DOCKERHUB_TOKEN=your-dockerhub-access-token
DOCKER_IMAGE_NAMESPACE=your-dockerhub-username-or-org
EC2_HOST=your-ec2-public-ip-or-dns
EC2_USER=ubuntu
EC2_SSH_KEY=private-key-for-ec2-user
EC2_APP_DIR=/opt/absteras-crm
BACKEND_ENV=full production env contents for .env
```

### What to put in BACKEND_ENV

Paste the full contents of your production environment file, including:

```text
NODE_ENV=production
APP_NAME=Sales CRM API
PORT=4000
HOST=0.0.0.0
TRUST_PROXY=true
AUTH_SECRET=...
SETUP_TOKEN=...
MONGODB_URI=...
CORS_ORIGIN=https://crm.absteras.com
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET=...
S3_UPLOAD_PREFIX=uploads
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
SMTP_TIMEOUT_MS=5000
```

The workflow will append `BACKEND_IMAGE` and `FRONTEND_IMAGE` automatically during deploy.

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
CORS_ORIGIN=https://crm.absteras.com
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

## EC2 App Startup

Use the production template at [.env.production.example](../.env.production.example) as the base for your EC2 environment file:

```sh
cp .env.production.example .env
nano .env
```

Key production values to set:

```text
AUTH_SECRET=long-random-secret
SETUP_TOKEN=long-random-setup-token
MONGODB_URI=mongodb+srv://...
CORS_ORIGIN=https://crm.absteras.com
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET=...
S3_UPLOAD_PREFIX=uploads
BACKEND_IMAGE=your-dockerhub-namespace/absteras-crm-backend:latest
FRONTEND_IMAGE=your-dockerhub-namespace/absteras-crm-frontend:latest
```


After the instance is ready, copy the deployment files and environment file:

```sh
sudo mkdir -p /opt/absteras-crm
sudo chown -R ubuntu:ubuntu /opt/absteras-crm
cd /opt/absteras-crm
nano .env
```

Then start the app:

```sh
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

Check health:

```sh
curl http://localhost/health
```

## Nginx for a custom domain

For a custom domain, replace the default Nginx config with [deploy/nginx-custom-domain.conf](nginx-custom-domain.conf) and edit the `server_name` value:

```sh
sudo cp deploy/nginx-custom-domain.conf /etc/nginx/conf.d/default.conf
sudo nginx -t
sudo systemctl reload nginx
```

Make sure your DNS points `crm.absteras.com` and `www.crm.absteras.com` to the EC2 public IP.

## t3.micro suitability

A `t3.micro` is fine for:

- small staging traffic
- light internal use
- low-volume demos

It is not ideal when you expect:

- heavy concurrent traffic
- large file uploads
- sustained background jobs
- multiple containers with high memory pressure

For production traffic, `t3.small` or larger is a safer baseline.

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
