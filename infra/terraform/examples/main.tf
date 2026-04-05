# Example: Managing Phase Flag resources with Terraform
#
# This example creates a project, a targeting segment, and several feature
# flags using the phaseflag Terraform provider.
#
# Usage:
#   export TF_VAR_phaseflag_api_key="your-api-key"
#   terraform init
#   terraform plan
#   terraform apply

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    phaseflag = {
      source  = "phaseflag/phaseflag"
      version = "~> 0.1"
    }
  }
}

provider "phaseflag" {
  api_url = var.phaseflag_api_url
  api_key = var.phaseflag_api_key
}

# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

resource "phaseflag_project" "demo" {
  name        = "Demo Project"
  slug        = "demo"
  description = "Created and managed by Terraform"
}

# ---------------------------------------------------------------------------
# Segments
# ---------------------------------------------------------------------------

resource "phaseflag_segment" "beta_users" {
  key         = "beta-users"
  name        = "Beta Users"
  description = "Users who have opted into the beta programme"
  project_id  = phaseflag_project.demo.slug

  conditions = jsonencode([
    {
      attribute = "beta_enrolled"
      operator  = "is"
      value     = "true"
    }
  ])
}

resource "phaseflag_segment" "enterprise_accounts" {
  key         = "enterprise-accounts"
  name        = "Enterprise Accounts"
  description = "Customers on the enterprise plan"
  project_id  = phaseflag_project.demo.slug

  conditions = jsonencode([
    {
      attribute = "plan"
      operator  = "one_of"
      value     = "[\"enterprise\", \"business\"]"
    }
  ])
}

# ---------------------------------------------------------------------------
# Feature flags
# ---------------------------------------------------------------------------

resource "phaseflag_flag" "new_checkout" {
  key         = "new-checkout-flow"
  name        = "New Checkout Flow"
  description = "Redesigned checkout experience with fewer steps"
  flag_type   = "boolean"
  enabled     = false
  project_id  = phaseflag_project.demo.slug
  tags        = ["checkout", "q1-2026"]
}

resource "phaseflag_flag" "api_rate_limit" {
  key         = "api-rate-limit"
  name        = "API Rate Limit"
  description = "Configurable rate limit value per tier (requests per minute)"
  flag_type   = "number"
  enabled     = true
  project_id  = phaseflag_project.demo.slug
  tags        = ["infrastructure", "rate-limiting"]
}

resource "phaseflag_flag" "dark_mode" {
  key         = "dark-mode"
  name        = "Dark Mode"
  description = "Enables the dark colour scheme in the dashboard"
  flag_type   = "boolean"
  enabled     = false
  project_id  = phaseflag_project.demo.slug
  tags        = ["ui", "ux"]
}

# ---------------------------------------------------------------------------
# Data source examples
# ---------------------------------------------------------------------------

# Look up a single flag by key (must already exist).
# data "phaseflag_flag" "existing" {
#   key = "some-existing-flag"
# }

# List all flags matching a search term.
# data "phaseflag_flags" "release_flags" {
#   search = "checkout"
# }
