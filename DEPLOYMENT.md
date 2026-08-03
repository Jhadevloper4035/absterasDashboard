# Deployment Guide

This document describes how to deploy the Sales CRM application to an EC2 instance using Docker Compose and Nginx.

## 1. Prerequisites

- Ubuntu 22.04 LTS EC2 instance
- Public IPv4 address
- Domain name pointing to the EC2 instance
- Docker Hub account (or another container registry)
- MongoDB Atlas or another MongoDB service
- AWS S3 bucket and access keys for uploads

Recommended instance size:
- `t3.micro` for testing/light usage
- `t3.small` or larger for production traffic

## 2. EC2 Security Group

Allow inbound traffic for:
- `22` (SSH)
- `80` (HTTP)
- `443` (HTTPS)

## 3. Bootstrap the EC2 host

SSH into the instance:

```bash
ssh ubuntu@YOUR_EC2_PUBLIC_IP
```

Run the bootstrap script from the repository:

```bash
sudo apt update
sudo apt install -y git
cd /home/ubuntu
git clone https://github.com/YOUR_GITHUB_USER/dashboard.git
cd dashboard
chmod +x deploy/ec2-setup.sh
sudo ./deploy/ec2-setup.sh /opt/absteras-crm ubuntu
```

## 4. Prepare production environment

Copy the environment template:

```bash
sudo mkdir -p /opt/absteras-crm
sudo chown -R ubuntu:ubuntu /opt/absteras-crm
cp /home/ubuntu/dashboard/.env.production.example /opt/absteras-crm/.env
nano /opt/absteras-crm/.env
```

Set the following values correctly:

```env
NODE_ENV=production
APP_NAME=Sales CRM API
BACKEND_IMAGE=your-dockerhub-namespace/absteras-crm-backend:latest
FRONTEND_IMAGE=your-dockerhub-namespace/absteras-crm-frontend:latest
PORT=4000
HOST=0.0.0.0
TRUST_PROXY=true
AUTH_SECRET=replace-with-a-long-random-secret
SETUP_TOKEN=replace-with-a-long-random-setup-token
MONGODB_URI=your-mongodb-connection-string
CORS_ORIGIN=https://crm.absteras.com
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=your-from-email
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=us-east-1
S3_BUCKET=your-s3-bucket-name
S3_UPLOAD_PREFIX=uploads
```

## 5. Copy deployment files

```bash
cd /opt/absteras-crm
cp /home/ubuntu/dashboard/docker-compose.prod.yml .
cp /home/ubuntu/dashboard/deploy/nginx.conf ./nginx.conf
```

For a custom domain, replace the Nginx config with:

```bash
cp /home/ubuntu/dashboard/deploy/nginx-custom-domain.conf ./nginx.conf
```

Then edit the config if needed to match your domain.

## 6. Start the application

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

## 7. Check health

```bash
curl http://localhost/health
```

## 8. Domain setup

Point your DNS A records to the EC2 public IP:
- `crm.absteras.com`
- `www.crm.absteras.com`

## 9. GitHub Actions deployment (optional)

Add these repository secrets in GitHub:

```text
DOCKERHUB_USERNAME=your-dockerhub-username
DOCKERHUB_TOKEN=your-dockerhub-access-token
DOCKER_IMAGE_NAMESPACE=your-dockerhub-username-or-org
EC2_HOST=your-ec2-public-ip-or-dns
EC2_USER=ubuntu
EC2_SSH_KEY=private-key-for-ec2-user
EC2_APP_DIR=/opt/absteras-crm
BACKEND_ENV=full contents of your production .env file
```

Push to `main` to trigger deployment.
