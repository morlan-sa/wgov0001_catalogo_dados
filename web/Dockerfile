# syntax=docker/dockerfile:1
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
# npm registry auth for the CodeArtifact-hosted @morlan/* packages — matches
# what plataforma-infra's reusable-frontend.yml actually injects at build
# time (needs_codeartifact_npm: true): a build-arg with just the registry
# URL (safe — no credential in it), plus a BuildKit secret carrying only the
# raw token (RAM-only, never written to an image layer, unlike a build-arg).
# See CLAUDE.md's "CodeArtifact auth" section.
ARG NPM_REGISTRY_URL
RUN --mount=type=secret,id=npm_token \
    AUTH="${NPM_REGISTRY_URL#https:}"; AUTH="${AUTH#http:}"; AUTH="${AUTH%/}"; \
    printf 'registry=%s\n%s/:_authToken=%s\nalways-auth=true\n' \
      "$NPM_REGISTRY_URL" "$AUTH" "$(cat /run/secrets/npm_token)" > .npmrc && \
    npm ci

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# Imagem propositalmente feita para não rodar como root — evita ter que
# ajustar porta/permissões manualmente em cima da imagem nginx padrão
# (que escuta na 80, uma porta privilegiada, e cujo master process roda
# como root por padrão). Esta já escuta em 8080 como usuário não-root.
FROM nginxinc/nginx-unprivileged:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
