# Gnostic Engine — single-container image.
#
# Deliberately ONE service. This is not the seven-service host-networked
# topology in monad-ecosystem/docker-compose.yml; it is the standalone policy
# engine, runnable by anyone with docker and nothing else.
#
# BUILD CONTEXT IS THE REPO ROOT, not this directory — the engine reads the
# versioned constraint packs from <repo-root>/shared/constraints:
#
#   docker build -f gnostic-engine/Dockerfile -t gnostic-engine .
#   docker run --rm -p 8000:8000 gnostic-engine
#
# LAYOUT CONTRACT (do not "tidy" these paths without changing the source):
#   src/gnostic_engine/constraints/loader.py:26  resolves parents[4] as the
#   repo root, so with the app at /app/src the packs MUST live at
#   /shared/constraints. window_log.py:30 writes to <root>/logs/ttc-window,
#   i.e. /logs — which must exist and be writable by the runtime user.
#   live_state.py:36 resolves parents[3], i.e. /app/logs/events.
#
# Reproducible from uv.lock; runs as a non-root user.

FROM python:3.11-slim

# uv from the official image — no curl|sh in the build.
COPY --from=ghcr.io/astral-sh/uv:0.12.7 /uv /usr/local/bin/uv

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# ── Dependency layer (cached unless the lockfile changes) ────────────────────
COPY gnostic-engine/pyproject.toml gnostic-engine/uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

# ── Application layer ────────────────────────────────────────────────────────
COPY gnostic-engine/src/ ./src/
COPY gnostic-engine/api/ ./api/
COPY gnostic-engine/demo/ ./demo/

# ── Versioned constraint packs (read-only, from the repo root) ───────────────
COPY shared/constraints/ /shared/constraints/

# ── Writable state dirs, then drop privileges ────────────────────────────────
RUN uv sync --frozen --no-dev \
    && useradd --create-home --uid 10001 gnostic \
    && mkdir -p /logs/ttc-window /app/logs/events \
    && chown -R gnostic:gnostic /app /logs \
    && chmod -R a-w /shared/constraints
USER gnostic

ENV PATH="/app/.venv/bin:$PATH" \
    PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/',timeout=4).status==200 else 1)"

CMD ["sh", "-c", "uvicorn api.gnostic_api:app --host 0.0.0.0 --port ${PORT}"]
