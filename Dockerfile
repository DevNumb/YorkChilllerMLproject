FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY api/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy FastAPI application
COPY api/fastapi_app.py app.py

# Create models directory (will be populated at runtime or use defaults)
RUN mkdir -p models

# Expose Hugging Face Spaces default port
EXPOSE 7860

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:7860/health || exit 1

# Run FastAPI with Uvicorn
# Note: Hugging Face Spaces automatically sets host to 0.0.0.0 and port to 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
