output "deployment_contract" {
  description = "Current launch-critical runtime topology captured by the GA-02.1 desired-state scaffold."
  value       = local.deployment_contract
}

output "manual_vs_codified" {
  description = "Explicit split between workflow-codified infrastructure and still-manual concerns."
  value       = local.manual_vs_codified
}

output "deferred_workstreams" {
  description = "Follow-on GA tickets that expand this scaffold into PITR and worker-scaling automation."
  value       = local.deferred_workstreams
}
