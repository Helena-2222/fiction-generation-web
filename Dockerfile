# Render deployment - lightweight image
FROM python:3.11-slim

WORKDIR /app

# Install only required system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Render injects $PORT (typically 10000)
ENV PORT=8000
EXPOSE $PORT

CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port $PORT"