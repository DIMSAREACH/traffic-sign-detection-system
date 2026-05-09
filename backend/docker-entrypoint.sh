#!/bin/sh
set -e
if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
  python manage.py migrate --noinput
fi
exec gunicorn traffic_system.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-1}" \
  --timeout 120
