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
      "celery queue topology and worker envelope contract",
    ]
    manual = [
      "droplet inventory and sizing",
      "cloud-level networking and firewall inventory",
      "backup object-storage / PITR configuration",
      "worker container rollout automation",
      "alert routing and escalation ownership",
    ]
  }

  worker_envelopes = {
    "pm-worker-realtime" = {
      queues        = ["pm.email", "pm.ops"]
      autoscale_min = 1
      autoscale_max = 4
      command       = "celery -A projectmeats worker -Q pm.email,pm.ops --autoscale=4,1 --prefetch-multiplier=1 --loglevel=info"
    }
    "pm-worker-workforms" = {
      queues        = ["pm.workforms"]
      autoscale_min = 2
      autoscale_max = 4
      command       = "celery -A projectmeats worker -Q pm.workforms --autoscale=4,2 --prefetch-multiplier=1 --loglevel=info"
    }
    "pm-worker-ai" = {
      queues        = ["pm.ai"]
      autoscale_min = 1
      autoscale_max = 2
      command       = "celery -A projectmeats worker -Q pm.ai --autoscale=2,1 --prefetch-multiplier=1 --loglevel=info"
    }
    "pm-worker-etl" = {
      queues      = ["pm.etl"]
      concurrency = 1
      command     = "celery -A projectmeats worker -Q pm.etl --concurrency=1 --prefetch-multiplier=1 --loglevel=info"
    }
    "pm-celery-beat" = {
      queues    = ["pm.ops", "pm.ai"]
      scheduler = "django_celery_beat.schedulers:DatabaseScheduler"
      command   = "celery -A projectmeats beat --scheduler django_celery_beat.schedulers:DatabaseScheduler --loglevel=info"
    }
  }

  queue_saturation_thresholds = {
    "pm.workforms" = {
      warn_backlog            = 20
      critical_backlog        = 50
      critical_oldest_seconds = 300
    }
    "pm.email" = {
      warn_backlog            = 50
      critical_backlog        = 100
      critical_oldest_seconds = 600
    }
    "pm.ai" = {
      warn_backlog            = 5
      critical_backlog        = 10
      critical_oldest_seconds = 900
    }
    "pm.etl" = {
      warn_backlog            = 1
      critical_backlog        = 1
      critical_oldest_seconds = 60
    }
  }

  deferred_workstreams = {
    ga_02_4 = "Redis eviction policy, queue-depth alarms, and broker distress playbooks"
  }
}
