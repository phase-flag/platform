variable "phaseflag_api_url" {
  description = "Base URL of the Phase Flag API."
  type        = string
  default     = "http://localhost:8000"
}

variable "phaseflag_api_key" {
  description = "API key used to authenticate with the Phase Flag API."
  type        = string
  sensitive   = true
}
