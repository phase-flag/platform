# Resource: phaseflag_environment
#
# Manages a deployment environment within a Phase Flag project.

resource "phaseflag_environment" "this" {
  # (Required) Project ID this environment belongs to.
  project_id = var.environment_project_id

  # (Required) URL-safe slug (e.g., "production", "staging", "dev").
  slug = var.environment_slug

  # (Required) Human-readable name.
  name = var.environment_name

  # (Optional) Description.
  description = var.environment_description

  # (Optional) Hex color for UI display.
  color = var.environment_color

  # (Optional) Whether this is a production environment (enables extra protections).
  is_production = var.environment_is_production
}

# --- Variables ---

variable "environment_project_id" {
  description = "Project ID this environment belongs to"
  type        = string
}

variable "environment_slug" {
  description = "URL-safe slug for the environment"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.environment_slug))
    error_message = "Slug must be lowercase alphanumeric with hyphens"
  }
}

variable "environment_name" {
  description = "Human-readable environment name"
  type        = string
}

variable "environment_description" {
  description = "Description of the environment"
  type        = string
  default     = ""
}

variable "environment_color" {
  description = "Hex color for UI (e.g., #22C55E)"
  type        = string
  default     = ""
}

variable "environment_is_production" {
  description = "Whether this is a production environment"
  type        = bool
  default     = false
}

# --- Outputs ---

output "environment_id" {
  description = "The ID of the created environment"
  value       = phaseflag_environment.this.id
}

output "environment_api_key" {
  description = "The API key for this environment"
  value       = phaseflag_environment.this.api_key
  sensitive   = true
}
