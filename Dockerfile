FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements-full.txt .
RUN pip install --no-cache-dir -r requirements-full.txt

# Copy application files
COPY . .

ENV PORT=5000
ENV HOST=0.0.0.0
ENV TF_ENABLE_ONEDNN_OPTS=0

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "4", "--timeout", "120", "wsgi:app"]
