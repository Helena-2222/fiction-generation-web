FROM python:3.9-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Keep dependency installation in a separate layer so source edits rebuild quickly.
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY app ./app
COPY static ./static

EXPOSE 8000

# The compose deployment overrides the worker count for the in-memory task service.
CMD ["gunicorn", "app.main:app", "--workers", "4", "--worker-class", "uvicorn_worker.UvicornWorker", "--bind", "0.0.0.0:8000", "--timeout", "240", "--graceful-timeout", "30", "--keep-alive", "5", "--worker-tmp-dir", "/dev/shm", "--access-logfile", "-", "--error-logfile", "-"]
