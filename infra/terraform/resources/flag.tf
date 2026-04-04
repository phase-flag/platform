# Resource: phaseflag_flag
#
# Manages a feature flag in Phase Flag.
#
# Example:
#   resource "phaseflag_flag" "new_checkout" {
#     key         = "new-checkout"
#     name        = "New Checkout Flow"
#     flag_type   = "boolean"
#     environment = "production"
#     status      = "active"
#     ...
#   }

resource "phaseflag_flag" "this" {
  # (Required) Unique key for the flag. Must be URL-safe.
  key = var.flag_key

  # (Required) Human-readable name.
  name = var.flag_name

  # (Optional) Description of the flag's purpose.
  description = var.flag_description

  # (Optional) Flag value type: boolean, string, number, json. Default: boolean.
  flag_type = var.flag_type

  # (Optional) Initial status: active, inactive. Default: inactive.
  status = var.flag_status

  # (Optional) Target environment. Default: development.
  environment = var.flag_environment

  # (Optional) Classification: release, experiment, ops_killswitch, permission, migration.
  flag_classification = var.flag_classification

  # (Optional) Whether the flag is permanent (not subject to cleanup).
  is_permanent = var.flag_is_permanent

  # (Optional) Tags for organization.
  tags = var.flag_tags

  # (Optional) Owner user ID.
  owner = var.flag_owner

  # (Optional) Owner team name.
  owner_team = var.flag_owner_team

  # (Optional) Related ticket URL.
  ticket_url = var.flag_ticket_url

  # (Optional) Runbook URL.
  runbook_url = var.flag_runbook_url

  # (Optional) Expiration datetime (RFC3339).
  expires_at = var.flag_expires_at

  # (Optional) Variations — list of {key, name, value}.
  dynamic "variation" {
    for_each = var.flag_variations
    content {
      key   = variation.value.key
      name  = variation.value.name
      value = variation.value.value
    }
  }

  # (Optional) Default variation key.
  default_variation = var.flag_default_variation
}

# --- Variables ---

variable "flag_key" {
  description = "Unique key for the feature flag"
  type        = string
}

variable "flag_name" {
  description = "Human-readable name"
  type        = string
}

variable "flag_description" {
  description = "Description of the flag"
  type        = string
  default     = ""
}

variable "flag_type" {
  description = "Value type: boolean, string, number, json"
  type        = string
  default     = "boolean"
  validation {
    condition     = contains(["boolean", "string", "number", "json"], var.flag_type)
    error_message = "flag_type must be one of: boolean, string, number, json"
  }
}

variable "flag_status" {
  description = "Initial status: active or inactive"
  type        = string
  default     = "inactive"
  validation {
    condition     = contains(["active", "inactive"], var.flag_status)
    error_message = "flag_status must be active or inactive"
  }
}

variable "flag_environment" {
  description = "Target environment"
  type        = string
  default     = "development"
}

variable "flag_classification" {
  description = "Flag classification: release, experiment, ops_killswitch, permission, migration"
  type        = string
  default     = "release"
  validation {
    condition     = contains(["release", "experiment", "ops_killswitch", "permission", "migration"], var.flag_classification)
    error_message = "flag_classification must be one of: release, experiment, ops_killswitch, permission, migration"
  }
}

variable "flag_is_permanent" {
  description = "Whether the flag is permanent"
  type        = bool
  default     = false
}

variable "flag_tags" {
  description = "Tags for organizing flags"
  type        = list(string)
  default     = []
}

variable "flag_owner" {
  description = "Owner user"
  type        = string
  default     = ""
}

variable "flag_owner_team" {
  description = "Owner team"
  type        = string
  default     = ""
}

variable "flag_ticket_url" {
  description = "Related ticket URL"
  type        = string
  default     = ""
}

variable "flag_runbook_url" {
  description = "Runbook URL"
  type        = string
  default     = ""
}

variable "flag_expires_at" {
  description = "Flag expiration date (RFC3339)"
  type        = string
  default     = ""
}

variable "flag_variations" {
  description = "List of flag variations"
  type = list(object({
    key   = string
    name  = string
    value = string
  }))
  default = []
}

variable "flag_default_variation" {
  description = "Default variation key"
  type        = string
  default     = ""
}

# --- Outputs ---

output "flag_id" {
  description = "The ID of the created flag"
  value       = phaseflag_flag.this.id
}

output "flag_key" {
  description = "The key of the created flag"
  value       = phaseflag_flag.this.key
}
