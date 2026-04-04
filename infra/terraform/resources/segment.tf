# Resource: phaseflag_segment
#
# Manages a reusable audience segment in Phase Flag.

resource "phaseflag_segment" "this" {
  # (Required) Unique key for the segment.
  key = var.segment_key

  # (Required) Human-readable name.
  name = var.segment_name

  # (Optional) Description of the segment.
  description = var.segment_description

  # (Required) Targeting conditions (AND logic).
  # Each condition: {attribute, operator, value}
  dynamic "condition" {
    for_each = var.segment_conditions
    content {
      attribute = condition.value.attribute
      operator  = condition.value.operator
      value     = condition.value.value
    }
  }
}

# --- Variables ---

variable "segment_key" {
  description = "Unique key for the segment"
  type        = string
}

variable "segment_name" {
  description = "Human-readable segment name"
  type        = string
}

variable "segment_description" {
  description = "Description of the segment"
  type        = string
  default     = ""
}

variable "segment_conditions" {
  description = "Targeting conditions (AND logic)"
  type = list(object({
    attribute = string
    operator  = string
    value     = string
  }))
  default = []
}

# --- Outputs ---

output "segment_id" {
  description = "The ID of the created segment"
  value       = phaseflag_segment.this.id
}

output "segment_key" {
  description = "The key of the created segment"
  value       = phaseflag_segment.this.key
}
