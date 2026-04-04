# Example: Managing Phase Flag resources with Terraform
#
# This example creates a project structure with environments,
# segments, and feature flags.

terraform {
  required_providers {
    phaseflag = {
      source  = "phaseflag/phaseflag"
      version = "~> 0.1"
    }
  }
}

provider "phaseflag" {
  api_url = "https://api.phaseflag.example.com"
  api_key = var.phaseflag_api_key
}

variable "phaseflag_api_key" {
  type      = string
  sensitive = true
}

# --- Environments ---

resource "phaseflag_environment" "staging" {
  project_id    = "default"
  slug          = "staging"
  name          = "Staging"
  description   = "Pre-production testing environment"
  color         = "#F59E0B"
  is_production = false
}

resource "phaseflag_environment" "production" {
  project_id    = "default"
  slug          = "production"
  name          = "Production"
  description   = "Live production environment"
  color         = "#22C55E"
  is_production = true
}

# --- Segments ---

resource "phaseflag_segment" "beta_users" {
  key         = "beta-users"
  name        = "Beta Users"
  description = "Users opted into the beta program"

  condition {
    attribute = "beta_enrolled"
    operator  = "is"
    value     = "true"
  }
}

resource "phaseflag_segment" "enterprise_accounts" {
  key         = "enterprise-accounts"
  name        = "Enterprise Accounts"
  description = "Users on enterprise plans"

  condition {
    attribute = "plan"
    operator  = "one_of"
    value     = "[\"enterprise\", \"business\"]"
  }
}

# --- Feature Flags ---

resource "phaseflag_flag" "new_checkout" {
  key                 = "new-checkout-flow"
  name                = "New Checkout Flow"
  description         = "Redesigned checkout experience with fewer steps"
  flag_type           = "boolean"
  flag_classification = "release"
  environment         = "production"
  status              = "active"
  owner_team          = "checkout-team"
  ticket_url          = "https://linear.app/example/CHK-123"

  variation {
    key   = "enabled"
    name  = "Enabled"
    value = "true"
  }

  variation {
    key   = "disabled"
    name  = "Disabled"
    value = "false"
  }

  default_variation = "disabled"
  tags              = ["checkout", "q1-2026"]
}

resource "phaseflag_flag" "api_rate_limit" {
  key                 = "api-rate-limit"
  name                = "API Rate Limit"
  description         = "Configurable rate limit per tier"
  flag_type           = "number"
  flag_classification = "ops_killswitch"
  environment         = "production"
  status              = "active"
  is_permanent        = true
  owner_team          = "platform-team"

  variation {
    key   = "default"
    name  = "Default (100 req/min)"
    value = "100"
  }

  variation {
    key   = "reduced"
    name  = "Reduced (50 req/min)"
    value = "50"
  }

  variation {
    key   = "high"
    name  = "High (500 req/min)"
    value = "500"
  }

  default_variation = "default"
  tags              = ["infrastructure", "rate-limiting"]
}

# --- Outputs ---

output "staging_api_key" {
  value     = phaseflag_environment.staging.api_key
  sensitive = true
}

output "production_api_key" {
  value     = phaseflag_environment.production.api_key
  sensitive = true
}
