FROM python:3.11-slim

WORKDIR /app

# Install poetry
RUN pip install --no-cache-dir poetry==1.7.1

# Copy dependency files
COPY pyproject.toml ./

# Install dependencies (no dev deps in production)
RUN poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi --without dev --no-root

# Copy application code
COPY phaseflag_api/ ./phaseflag_api/
COPY migrations/ ./migrations/
COPY alembic.ini ./

# Create non-root user and own the workdir
RUN useradd --system --no-create-home --shell /sbin/nologin appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "phaseflag_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
