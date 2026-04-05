# Terraform Deployment (DigitalOcean)

Provision a production Phase Flag environment on DigitalOcean with Terraform.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) 1.6+
- DigitalOcean account and personal access token
- Domain managed by DigitalOcean DNS

## Quick Start

```bash
git clone https://github.com/phaseflag/phaseflag.git
cd phaseflag/infra/terraform

cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
do_token    = "dop_v1_xxxxxxxxxxxx"
domain      = "yourdomain.com"
region      = "nyc3"
ssh_keys    = ["your-ssh-key-fingerprint"]
```

## Deploy

```bash
terraform init
terraform plan
terraform apply
```

## Outputs

After `apply`:

```bash
terraform output               # show all outputs
terraform output -raw droplet_ip      # server IP
terraform output -raw database_url    # connection string (sensitive)
```

Key outputs:

| Output | Description |
|--------|-------------|
| `droplet_ip` | Public IP of the app server |
| `api_url` | `https://api.yourdomain.com` |
| `dashboard_url` | `https://app.yourdomain.com` |
| `database_url` | PostgreSQL connection string |
| `connection_command` | SSH command |

## Post-Provisioning

```bash
ssh root@$(terraform output -raw droplet_ip)
cloud-init status --wait
cd /opt/phaseflag/infra/docker
docker compose -f docker-compose.selfhosted.yml exec api alembic upgrade head
```

## Key Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `do_token` | DigitalOcean API token | required |
| `domain` | Domain for DNS records | required |
| `region` | DO datacenter region | required |
| `droplet_size` | Droplet size slug | `s-2vcpu-4gb` |
| `db_size` | Managed DB size | `db-s-1vcpu-1gb` |
| `deployment_mode` | `oss`, `saas`, or `enterprise` | `oss` |

## Destroy

```bash
terraform destroy
```

> **Warning**: This permanently deletes all resources including the database. Back up your data first.

## Full Documentation

See [docs.phaseflag.com/deployment/terraform](https://docs.phaseflag.com/deployment/terraform) for remote state configuration, enterprise variables, and multi-region setup.
