# Output the key of the created flag so it can be referenced by other modules.
output "checkout_flag_key" {
  description = "Key of the new-checkout-flow feature flag."
  value       = phaseflag_flag.new_checkout.key
}

output "checkout_flag_enabled" {
  description = "Whether the new-checkout-flow flag is currently enabled."
  value       = phaseflag_flag.new_checkout.enabled
}

output "beta_segment_key" {
  description = "Key of the beta-users targeting segment."
  value       = phaseflag_segment.beta_users.key
}

output "demo_project_slug" {
  description = "Slug of the demo project."
  value       = phaseflag_project.demo.slug
}
