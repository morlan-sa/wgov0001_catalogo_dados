# syntax=docker/dockerfile:1
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# `morlan-access-lib` resolves from the `codeartifact` index (see
# pyproject.toml's [[tool.uv.index]]/[tool.uv.sources]) — AWS CodeArtifact,
# not git+ssh, so no SSH agent/git install is needed. CodeArtifact auth is
# HTTP Basic with username "aws" and a short-lived (~12h) token as the
# password — uv reads both via UV_INDEX_CODEARTIFACT_USERNAME/PASSWORD.
# The token is mounted as a *file* (`--mount=type=secret`, RAM-only, never
# written to an image layer) and read into that env var inline, just for
# this RUN — see compose.yml's `secrets.codeartifact_token` (sourced from
# the CODEARTIFACT_AUTH_TOKEN env var at build time — a token can't live in
# a committed file, it's short-lived).
ENV UV_INDEX_CODEARTIFACT_USERNAME=aws

COPY pyproject.toml uv.lock ./
# `dh-helper-log`/`dh-helper-json`/`dh-helper-fastapi` resolve from the same
# `codeartifact` index as `morlan-access-lib` (see pyproject.toml's
# [tool.uv.sources]) — no local/editable path, so this build has no extra
# context to worry about beyond the token below.
RUN --mount=type=secret,id=codeartifact_token \
    UV_INDEX_CODEARTIFACT_PASSWORD="$(cat /run/secrets/codeartifact_token)" \
    uv sync --frozen --no-dev

# `uv run` re-verifies (and, without this, re-syncs over the network —
# including dev-dependencies, defeating `--no-dev` above) the environment
# against pyproject.toml/uv.lock on every invocation. The image is already
# fully synced; skip that check so the container doesn't need network
# access at startup.
ENV UV_NO_SYNC=1

# CA raiz do AD (Morlan-CA), emissora dos certificados *.aws.morlan.local (Keycloak).
# O bundle do sistema inclui as CAs públicas e esta; truststore (app/main.py) e
# httpx passam a confiar nele.
COPY certs/morlan-ca.pem /usr/local/share/ca-certificates/morlan-ca.crt
RUN update-ca-certificates
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

COPY . .

# Roda como não-root — o chown precisa vir antes do USER e depois de tudo
# que escreve em /app (uv sync, COPY).
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# --proxy-headers --forwarded-allow-ips='*': o container nunca recebe
# tráfego de outra origem além do ALB compartilhado (nunca termina TLS
# próprio, sem IP público — ver CLAUDE.md "Deployment"), então confiar no
# X-Forwarded-For/-Proto dele é seguro. Sem isso, request.url.scheme/
# request.client.host refletem a conexão crua do ALB (HTTP, IP do próprio
# ALB), não o esquema/IP reais do cliente — importa hoje para qualquer rota
# que inspecione o IP do cliente, e para o esquema usado ao montar URLs.
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
