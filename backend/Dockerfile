FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Dual-process defaults (configurable via docker run -e)
ENV GUNICORN_WORKERS=3 \
    GUNICORN_TIMEOUT=120 \
    GUNICORN_MAX_REQUESTS=1000

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    supervisor \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /root/.cache

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn whitenoise \
    && find /usr/local -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true \
    && find /usr/local -type f -name '*.pyc' -delete \
    && rm -rf /root/.cache /tmp/*

COPY backend/ ./

# Copy environment manifest for audit_secrets command
RUN mkdir -p /app/manifests
COPY manifests/env.manifest.json /app/manifests/env.manifest.json
RUN mkdir -p /app/scripts
COPY scripts/infrastructure_diagnostics.py /app/scripts/infrastructure_diagnostics.py

RUN mkdir -p /app/staticfiles /app/media

# supervisord needs to run as root to manage child processes,
# but Gunicorn/Daphne drop privileges where needed.
# The appuser owns app files for safety.
RUN useradd -m appuser && chown -R appuser:appuser /app

EXPOSE 8000 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/api/v1/health/ || exit 1

# Dual-process model:
# - Gunicorn (port 8000): multi-worker HTTP/API — handles all REST, admin, static
# - Daphne  (port 8001): single-process ASGI — handles WebSocket /ws/ only
# supervisord restarts either process if it crashes.
# NOTE: Heavy operations (setup_superuser, seed_tenants, collectstatic) moved to migration job
CMD ["sh", "-c", "python manage.py check && \
    echo 'Django check passed — starting supervisord (Gunicorn + Daphne)' && \
    exec supervisord -c /app/supervisord.conf"]
