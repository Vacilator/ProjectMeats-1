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

output "worker_envelopes" {
  description = "Codified Celery worker envelopes and queue ownership captured by GA-02.3."
  value       = local.worker_envelopes
}

output "queue_saturation_thresholds" {
  description = "Queue backlog and oldest-message thresholds used for GA-02.3 operator guardrails."
  value       = local.queue_saturation_thresholds
}

output "redis_guardrails" {
  description = "Desired-state Redis/Valkey eviction policy and operator diagnostic contract."
  value       = local.redis_guardrails
}
