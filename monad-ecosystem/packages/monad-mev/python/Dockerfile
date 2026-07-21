# Python Engine Dockerfile
# Node 3: FastAPI + Hepar audit + Shadow Markout Gate

FROM python:3.11-slim AS base

WORKDIR /app

# Install uv for fast package management
RUN pip install uv

# Copy requirements
COPY monad-ecosystem/packages/monad-mev/python/requirements.txt ./requirements.txt

# Install dependencies
RUN uv sync --frozen --no-dev

# Copy source
COPY monad-ecosystem/packages/monad-mev/python ./python

# Production image
FROM python:3.11-slim AS production

WORKDIR /app

# Install only production dependencies
COPY --from=base /app/.venv .venv
ENV VIRTUAL_ENV=/app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Copy source code
COPY --from=base /app/python ./python

# Non-root user
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')" || exit 1

# Start uvicorn
CMD ["uvicorn", "python.shadow_markout_api:app", "--host", "0.0.0.0", "--port", "8000"]