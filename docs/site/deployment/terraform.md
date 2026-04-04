---
title: "Terraform"
description: "Provision Phase Flag infrastructure on DigitalOcean with Terraform."
---

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) 1.6+
- A [DigitalOcean](https://www.digitalocean.com/) account and personal access token
- A domain name registered with DigitalOcean DNS (or the ability to set A records)

---

## 1. Clone the Repository

```bash
git clone https://github.com/phaseflag/phaseflag.git
cd phaseflag/infra/terraform
```

---

## 2. Create a Variables File

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
# DigitalOcean API token
do_token = "dop_v1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Domain — must be managed by DigitalOcean DNS
domain = "yourdomain.com"

# DigitalOcean region
region = "nyc3"

# Droplet size (see: doctl compute size list)
droplet_size = "s-2vcpu-4gb"

# PostgreSQL cluster size
db_size = "db-s-1vcpu-1gb"

# SSH key fingerprints to allow on the droplet
ssh_keys = ["ab:cd:ef:12:34:56:78:90:ab:cd:ef:12:34:56:78:90"]

# Deployment mode
deployment_mode = "saas"
```

---

## 3. Initialize Terraform

```bash
terraform init
```

This downloads the DigitalOcean provider and initializes the backend.

---

## 4. Plan the Deployment

```bash
terraform plan
```

Review the planned resources. Terraform will create:

| Resource | Description |
|----------|-------------|
| `digitalocean_droplet.app` | Ubuntu 22.04 droplet for the application |
| `digitalocean_managed_database.postgres` | Managed PostgreSQL 16 cluster |
| `digitalocean_domain.main` | DNS zone for your domain |
| `digitalocean_record.api` | A record: `api.yourdomain.com` |
| `digitalocean_record.app` | A record: `app.yourdomain.com` |
| `digitalocean_record.relay` | A record: `relay.yourdomain.com` |
| `digitalocean_firewall.app` | Firewall rules (ports 22, 80, 443) |
| `digitalocean_project.phaseflag` | DigitalOcean project to group resources |

---

## 5. Apply the Deployment

```bash
terraform apply
```

Type `yes` when prompted. Provisioning takes 5-10 minutes (mostly waiting for the managed database cluster to initialize).

---

## 6. Capture Outputs

After apply completes, Terraform prints the outputs:

```bash
terraform output
```

```
api_url            = "https://api.yourdomain.com"
dashboard_url      = "https://app.yourdomain.com"
droplet_ip         = "192.0.2.100"
database_host      = "db-phaseflag-do-user-12345-0.g.db.ondigitalocean.com"
database_port      = 25060
database_url       = <sensitive>
connection_command = "ssh root@192.0.2.100"
```

View the sensitive database URL:

```bash
terraform output -raw database_url
```

---

## 7. Post-Provisioning Setup

SSH into the droplet and run the initialization script:

```bash
ssh root@$(terraform output -raw droplet_ip)

# The droplet cloud-init script installs Docker and clones the repo
# Wait for it to complete:
cloud-init status --wait

# Run migrations
cd /opt/phaseflag/infra/docker
docker compose -f docker-compose.selfhosted.yml exec api alembic upgrade head
```

---

## Key Variables Reference

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `do_token` | string | Yes | DigitalOcean personal access token |
| `domain` | string | Yes | Domain managed by DigitalOcean DNS |
| `region` | string | Yes | DigitalOcean datacenter region |
| `droplet_size` | string | No | Droplet size slug (default: `s-2vcpu-4gb`) |
| `db_size` | string | No | Managed DB size (default: `db-s-1vcpu-1gb`) |
| `ssh_keys` | list | Yes | SSH key fingerprints for droplet access |
| `deployment_mode` | string | No | `oss`, `saas`, or `enterprise` (default: `oss`) |
| `enable_relay` | bool | No | Deploy relay proxy (default: `false`) |

---

## Outputs Reference

| Output | Description |
|--------|-------------|
| `droplet_ip` | Public IP of the application server |
| `api_url` | HTTPS URL of the API |
| `dashboard_url` | HTTPS URL of the admin dashboard |
| `database_host` | Hostname of the managed PostgreSQL cluster |
| `database_url` | Full connection string (sensitive) |
| `connection_command` | SSH command to connect to the droplet |

---

## Updating Infrastructure

To change the droplet size or other configuration:

1. Edit `terraform.tfvars`
2. Run `terraform plan` to preview changes
3. Run `terraform apply`

<Note>
  Changing the `droplet_size` will destroy and recreate the droplet. Ensure your data is in the managed database (not local) before resizing.
</Note>

---

## Destroying Infrastructure

```bash
terraform destroy
```

<Warning>
  `terraform destroy` permanently deletes all provisioned resources including the managed database. Back up your data before running this command.
</Warning>

---

## Remote State (Production Recommendation)

For team use, store Terraform state in DigitalOcean Spaces (S3-compatible):

```hcl
# backend.tf
terraform {
  backend "s3" {
    endpoint = "https://nyc3.digitaloceanspaces.com"
    bucket   = "your-tf-state-bucket"
    key      = "phaseflag/terraform.tfstate"
    region   = "us-east-1"  # placeholder for S3 compat

    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    force_path_style            = true
  }
}
```
