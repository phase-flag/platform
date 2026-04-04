---
title: "Self-Hosted (Production)"
description: "Deploy Phase Flag on your own VPS with Docker Compose, a custom domain, and SSL via nginx."
---

## Prerequisites

- Ubuntu 22.04 LTS VPS (minimum 2 vCPU, 4 GB RAM recommended)
- A domain name pointed to your server's IP (A record: `app.yourdomain.com`, `api.yourdomain.com`)
- Ports 80 and 443 open in your firewall

---

## 1. Install Docker

SSH into your server and install Docker:

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

---

## 2. Clone the Repository

```bash
git clone https://github.com/phaseflag/phaseflag.git /opt/phaseflag
cd /opt/phaseflag
```

---

## 3. Configure Environment Variables

```bash
cp infra/docker/.env.example infra/docker/.env.production
```

Edit `/opt/phaseflag/infra/docker/.env.production`:

```bash
# Deployment mode
PHASEFLAG_DEPLOYMENT_MODE=saas

# Database — use an external managed PostgreSQL for production
PHASEFLAG_DATABASE_URL=postgresql+asyncpg://phaseflag:STRONG_PASSWORD@postgres:5432/phaseflag

# Strong secrets (generate with: openssl rand -hex 32)
PHASEFLAG_JWT_SECRET_KEY=<64-char-random-secret>
PHASEFLAG_API_SECRET_KEY=<64-char-random-secret>

# Your production domain
PHASEFLAG_CORS_ORIGINS=https://app.yourdomain.com,https://portal.yourdomain.com

# Email (optional — for password reset)
PHASEFLAG_SMTP_HOST=smtp.sendgrid.net
PHASEFLAG_SMTP_PORT=587
PHASEFLAG_SMTP_USER=apikey
PHASEFLAG_SMTP_PASSWORD=<sendgrid-api-key>
PHASEFLAG_FROM_EMAIL=noreply@yourdomain.com

PHASEFLAG_LOG_LEVEL=INFO
```

---

## 4. Start the Stack with the Self-Hosted Compose File

```bash
cd /opt/phaseflag/infra/docker
docker compose -f docker-compose.selfhosted.yml --env-file .env.production up -d
```

Run migrations:

```bash
docker compose -f docker-compose.selfhosted.yml exec api alembic upgrade head
```

---

## 5. Configure nginx as a Reverse Proxy

Install nginx and Certbot:

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Create the nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/phaseflag
```

```nginx
# API
server {
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support (for real-time updates)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}

# Dashboard
server {
    server_name app.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable the site and obtain SSL certificates:

```bash
sudo ln -s /etc/nginx/sites-available/phaseflag /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Obtain SSL certs via Let's Encrypt
sudo certbot --nginx -d api.yourdomain.com -d app.yourdomain.com
```

Certbot will automatically modify your nginx config to add HTTPS and redirect HTTP to HTTPS.

---

## 6. Set Up Automatic Certificate Renewal

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Test renewal
sudo certbot renew --dry-run
```

---

## 7. Configure a Systemd Service (Optional)

For automatic startup on boot:

```bash
sudo nano /etc/systemd/system/phaseflag.service
```

```ini
[Unit]
Description=Phase Flag
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/phaseflag/infra/docker
ExecStart=/usr/bin/docker compose -f docker-compose.selfhosted.yml --env-file .env.production up -d
ExecStop=/usr/bin/docker compose -f docker-compose.selfhosted.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable phaseflag
sudo systemctl start phaseflag
```

---

## Relay Proxy

For high-throughput production deployments, run the relay proxy alongside the stack:

The `docker-compose.selfhosted.yml` includes a `relay` service. Set these variables in your `.env.production`:

```bash
PHASEFLAG_RELAY_API_KEY=<relay-api-key-from-dashboard>
RELAY_PORT=8001
```

Configure your SDKs to point to the relay instead of the control plane:

```typescript
const client = new PhaseFlagClient({
  apiKey: "sdk-prod-xxxxxxxxxxxx",
  environment: "production",
  baseUrl: "https://relay.yourdomain.com", // relay domain
});
```

---

## Updating Phase Flag

```bash
cd /opt/phaseflag
git pull origin main

cd infra/docker
docker compose -f docker-compose.selfhosted.yml --env-file .env.production pull
docker compose -f docker-compose.selfhosted.yml --env-file .env.production up -d

# Run any new migrations
docker compose -f docker-compose.selfhosted.yml exec api alembic upgrade head
```

---

## Backup

### Database backup

```bash
docker compose -f docker-compose.selfhosted.yml exec postgres \
  pg_dump -U phaseflag phaseflag | gzip > backup-$(date +%Y%m%d).sql.gz
```

### Restore

```bash
gunzip -c backup-20260404.sql.gz | \
  docker compose -f docker-compose.selfhosted.yml exec -T postgres \
  psql -U phaseflag phaseflag
```
