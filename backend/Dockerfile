# Render: Web Service → Environment = Docker, Root Directory = backend, Dockerfile path = Dockerfile
# Set DB_*, DJANGO_*, REDIS/CORS, etc. in the Render dashboard (not from copied .env).

FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Runtime libs for Pillow, PyTorch/ultralytics, OpenCV.
# libgl1: ultralytics often pulls opencv-python (non-headless), which links libGL.so.1.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    libjpeg62-turbo \
    zlib1g \
    libgl1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir -r requirements.txt \
  && pip uninstall -y opencv-python 2>/dev/null || true \
  && pip install --no-cache-dir --force-reinstall "opencv-python-headless==4.10.0.84"

COPY . .

RUN chmod +x docker-entrypoint.sh

# Bake admin/static assets into the image (WhiteNoise serves them in production)
ENV DJANGO_SECRET_KEY=collectstatic-build-only-not-used-at-runtime \
    DJANGO_DEBUG=False \
    DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
RUN python manage.py collectstatic --noinput

RUN adduser --disabled-password --gecos "" appuser \
  && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
