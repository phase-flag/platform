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
  # Phase Flag API URL
  # Can also be set via PHASEFLAG_API_URL environment variable
  api_url = var.phaseflag_api_url

  # API key for authentication
  # Can also be set via PHASEFLAG_API_KEY environment variable
  api_key = var.phaseflag_api_key
}

variable "phaseflag_api_url" {
  description = "Phase Flag API base URL"
  type        = string
  default     = "http://localhost:8000"
}

variable "phaseflag_api_key" {
  description = "Phase Flag API key"
  type        = string
  sensitive   = true
}
