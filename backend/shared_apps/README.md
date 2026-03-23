# Shared Apps

This directory contains Django apps that live in the **public schema** (shared across all tenants).

## Rules
- Models here are **NOT** tenant-isolated (they are shared across all tenants)
- Migrations use **standard Django commands** (shared schema):
  - `python manage.py makemigrations`
  - `python manage.py migrate`
- Examples: tenants, auth/user models, global configurations

## Current Structure
Shared apps are currently in `../apps/tenants/` and Django's built-in apps. This directory is prepared for future migration to the recommended structure per docs/ARCHITECTURE.md.
