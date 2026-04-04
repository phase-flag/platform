# Self-Hosted Production Deployment

Deploy Phase Flag to your own server with a custom domain and SSL.

## Prerequisites

- Ubuntu 22.04 VPS (2 vCPU / 4 GB RAM minimum)
- A domain name pointed to your server's IP
- Ports 22, 80, 443 open

## Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

## Clone and Configure

```bash
git clone https://github.com/phaseflag/phaseflag.git /opt/phaseflag
cd /opt/phaseflag/infra/docker
cp .env.example .env.production
```

Edit `.env.production`:

```bash
PHASEFLAG_DEPLOYMENT_MODE=saas
PHASEFLAG_DATABASE_URL=postgresql+asyncpg://phaseflag:STRONG_PASSWORD@postgres:5432/phaseflag
PHASEFLAG_JWT_SECRET_KEY=$(openssl rand -hex 32)
PHASEFLAG_API_SECRET_KEY=$(openssl rand -hex 32)
PHASEFLAG_CORS_ORIGINS=https://app.yourdomain.com
```

## Start the Stack

```bash
docker compose -f docker-compose.selfhosted.yml --env-file .env.production up -d
docker compose -f docker-compose.selfhosted.yml exec api alembic upgrade head
```

## Configure nginx + SSL

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/phaseflag`:

```nginx
server {
    server_name api.yourdomain.com;
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;  # required for SSE
    }
}
server {
    server_name app.yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/phaseflag /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.yourdomain.com -d app.yourdomain.com
```

## Update

```bash
cd /opt/phaseflag && git pull origin main
cd infra/docker
docker compose -f docker-compose.selfhosted.yml --env-file .env.production pull
docker compose -f docker-compose.selfhosted.yml --env-file .env.production up -d
docker compose -f docker-compose.selfhosted.yml exec api alembic upgrade head
```

## Full Documentation

See [docs.phaseflag.io/deployment/self-hosted](https://docs.phaseflag.io/deployment/self-hosted) for relay proxy setup, backup procedures, and systemd service configuration.
