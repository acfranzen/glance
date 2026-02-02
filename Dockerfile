# syntax=docker/dockerfile:1

FROM node:20-slim AS base

# Install dependencies for better-sqlite3 and node-pty
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Development image
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate AUTH_TOKEN if not provided
ENV AUTH_TOKEN=""
ENV DATABASE_PATH="/app/data/glance.db"

EXPOSE 3333

CMD ["sh", "-c", "if [ -z \"$AUTH_TOKEN\" ]; then export AUTH_TOKEN=$(openssl rand -base64 32); echo \"Generated AUTH_TOKEN: $AUTH_TOKEN\"; fi && npm run dev"]

# Production build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build needs AUTH_TOKEN but we use a placeholder
ENV AUTH_TOKEN="build-placeholder"
RUN npm run build || true

# Production image
FROM base AS production
ENV NODE_ENV=production
ENV DATABASE_PATH="/app/data/glance.db"

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./

EXPOSE 3333

CMD ["sh", "-c", "if [ -z \"$AUTH_TOKEN\" ]; then export AUTH_TOKEN=$(openssl rand -base64 32); echo \"Generated AUTH_TOKEN: $AUTH_TOKEN\"; fi && npm run start"]
