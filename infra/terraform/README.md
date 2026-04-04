# Phase Flag Terraform Provider

Manage Phase Flag resources (flags, segments, environments) as infrastructure-as-code using Terraform.

## Requirements

- Terraform >= 1.5.0
- Phase Flag API instance
- API key with admin permissions

## Installation

```hcl
terraform {
  required_providers {
    phaseflag = {
      source  = "phaseflag/phaseflag"
      version = "~> 0.1"
    }
  }
}
```

## Provider Configuration

```hcl
provider "phaseflag" {
  api_url = "https://phaseflag.example.com"
  api_key = var.phaseflag_api_key
}
```

Or via environment variables:

```bash
export PHASEFLAG_API_URL="https://phaseflag.example.com"
export PHASEFLAG_API_KEY="pf_xxx"
```

## Resources

### phaseflag_flag

Manages a feature flag.

```hcl
resource "phaseflag_flag" "example" {
  key         = "my-feature"
  name        = "My Feature"
  flag_type   = "boolean"
  environment = "production"
  status      = "active"

  variation {
    key   = "on"
    name  = "Enabled"
    value = "true"
  }

  variation {
    key   = "off"
    name  = "Disabled"
    value = "false"
  }

  default_variation = "off"
  tags              = ["team-a", "q1"]
}
```

### phaseflag_segment

Manages a reusable audience segment.

```hcl
resource "phaseflag_segment" "beta" {
  key  = "beta-users"
  name = "Beta Users"

  condition {
    attribute = "beta"
    operator  = "is"
    value     = "true"
  }
}
```

### phaseflag_environment

Manages a deployment environment.

```hcl
resource "phaseflag_environment" "staging" {
  project_id    = "default"
  slug          = "staging"
  name          = "Staging"
  is_production = false
}
```

## Example

See `examples/main.tf` for a complete working example.

## Import

Import existing resources:

```bash
terraform import phaseflag_flag.example my-feature-key
terraform import phaseflag_segment.example my-segment-key
terraform import phaseflag_environment.example env-id
```
