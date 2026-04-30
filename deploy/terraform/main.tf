locals {
  deployment_contract = {
    project_name = var.project_name
    control_plane = {
      workflow          = ".github/workflows/reusable-deploy.yml"
      deployment_method = "runner-driven docker run with immutable environment-sha tags"
      migration_method  = "runner-based docker migration over bastion tunnel with --fake-initial"
    }
    environments = var.environments
    services = {
      backend = {
        container_name = "pm-backend"
        internal_port  = 8000
        env_file       = "/root/projectmeats/backend/.env"
      }
      frontend = {
        container_name      = "pm-frontend"
        internal_port       = 8080
        runtime_config_file = "/opt/pm/frontend/env/env-config.js"
      }
      proxy = {
        host_service       = "nginx"
        host_template      = "deploy/nginx/host-reverse-proxy.conf.template"
        workflow_rendering = ".github/workflows/reusable-deploy.yml"
      }
      backups = {
        retention_root = "/root/projectmeats/db_backups"
        note           = "Local host retention only until GA-02.2 PITR and restore drill work lands."
      }
    }
  }

  manual_vs_codified = {
    codified = [
      "runner-driven migrations",
      "backend/frontend container deploy steps",
      "immutable image tag and digest handling",
      "runtime env and frontend env-config paths",
      "host backup directory convention",
    ]
    manual = [
      "droplet inventory and sizing",
      "cloud-level networking and firewall inventory",
      "backup object-storage / PITR configuration",
      "worker autoscaling strategy",
      "alert routing and escalation ownership",
    ]
  }

  deferred_workstreams = {
    ga_02_2 = "PITR verification, restore drills, and disaster-recovery runbooks"
    ga_02_3 = "Celery worker scaling envelopes, queue priorities, and cache topology hardening"
  }
}
