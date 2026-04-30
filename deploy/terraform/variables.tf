variable "project_name" {
  description = "Logical application name used by the desired-state scaffold."
  type        = string
  default     = "projectmeats"
}

variable "container_registry" {
  description = "Primary registry used by the Golden Pipeline."
  type = object({
    digitalocean = string
    ghcr         = string
  })
  default = {
    digitalocean = "registry.digitalocean.com/meatscentral"
    ghcr         = "ghcr.io/meats-central"
  }
}

variable "environments" {
  description = "Launch-critical environment topology captured from the current deployment workflows."
  type = map(object({
    branch                = string
    backend_lane          = string
    frontend_lane         = string
    domain                = string
    backend_bind_address  = string
    frontend_bind_address = string
    backend_host_port     = number
    frontend_host_port    = number
    backend_env_file      = string
    frontend_runtime_file = string
    backup_directory      = string
    host_nginx_site       = string
  }))
  default = {
    development = {
      branch                = "development"
      backend_lane          = "dev-backend"
      frontend_lane         = "dev-frontend"
      domain                = "dev.meatscentral.com"
      backend_bind_address  = "0.0.0.0"
      frontend_bind_address = "127.0.0.1"
      backend_host_port     = 8000
      frontend_host_port    = 8080
      backend_env_file      = "/root/projectmeats/backend/.env"
      frontend_runtime_file = "/opt/pm/frontend/env/env-config.js"
      backup_directory      = "/root/projectmeats/db_backups/development"
      host_nginx_site       = "/etc/nginx/sites-available/projectmeats-development"
    }
    uat = {
      branch                = "uat"
      backend_lane          = "uat-backend"
      frontend_lane         = "uat-frontend"
      domain                = "uat.meatscentral.com"
      backend_bind_address  = "0.0.0.0"
      frontend_bind_address = "127.0.0.1"
      backend_host_port     = 8000
      frontend_host_port    = 8080
      backend_env_file      = "/root/projectmeats/backend/.env"
      frontend_runtime_file = "/opt/pm/frontend/env/env-config.js"
      backup_directory      = "/root/projectmeats/db_backups/uat"
      host_nginx_site       = "/etc/nginx/sites-available/projectmeats-uat"
    }
    production = {
      branch                = "main"
      backend_lane          = "production-backend"
      frontend_lane         = "production-frontend"
      domain                = "meatscentral.com"
      backend_bind_address  = "0.0.0.0"
      frontend_bind_address = "127.0.0.1"
      backend_host_port     = 8000
      frontend_host_port    = 8080
      backend_env_file      = "/root/projectmeats/backend/.env"
      frontend_runtime_file = "/opt/pm/frontend/env/env-config.js"
      backup_directory      = "/root/projectmeats/db_backups/production"
      host_nginx_site       = "/etc/nginx/sites-available/projectmeats-production"
    }
  }
}
