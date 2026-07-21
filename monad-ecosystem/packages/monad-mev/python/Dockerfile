# Python Engine Dockerfile
# Node 3: FastAPI + Hepar audit + Shadow Markout Gate

FROM python:3.11-slim AS production

WORKDIR /app

# Install uv for fast package management
RUN pip install uv

# Copy requirements
COPY monad-ecosystem/packages/monad-mev/python/requirements.txt ./requirements.txt

# Install dependencies into system Python
RUN uv pip install --system --no-cache-dir -r requirements.txt

# Copy source
COPY monad-ecosystem/packages/monad-mev/python/shadow_markout_api.py ./shadow_markout_api.py

# Non-root user
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')" || exit 1

# Start uvicorn
CMD ["uvicorn", "shadow_markout_api:app", "--host", "0.0.0.0", "--port", "8000"]
