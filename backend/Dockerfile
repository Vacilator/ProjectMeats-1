FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
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

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/api/v1/health/ || exit 1

# Start Daphne so the container serves both HTTP and websocket traffic via ASGI.
# Use exec form for proper signal handling
# NOTE: Heavy operations (setup_superuser, seed_tenants, collectstatic) moved to migration job
CMD ["sh", "-c", "python manage.py check && \
    echo \"Django check passed — starting Daphne\" && \
    exec daphne \
      --bind 0.0.0.0 \
      --port 8000 \
      --http-timeout 120 \
      --proxy-headers \
      --access-log - \
      --verbosity 1 \
      projectmeats.asgi:application"]
