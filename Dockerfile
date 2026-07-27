# Build stage: compile the TypeScript bundle with Vite.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
# npm install (not ci): the lockfile is authored on Windows and omits the
# Linux-only @emnapi optional deps of the TypeScript native preview, which
# makes strict `npm ci` fail inside the container.
RUN npm install --no-audit --no-fund
COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/
RUN npm run build

# Runtime stage: unprivileged nginx serving the static bundle.
FROM nginxinc/nginx-unprivileged:1.31-alpine
ARG GIT_SHA=dev
LABEL org.opencontainers.image.title="minecraft-adventure" \
      org.opencontainers.image.description="Browser voxel adventure game with a fire-breathing dragon boss" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.revision="${GIT_SHA}"
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
