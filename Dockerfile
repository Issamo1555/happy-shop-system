# ============================================
# Mums'Home POS - Docker Production Image
# ============================================
# Versions verrouillées pour reproductibilité :
#   Node.js  : 20.19.x (LTS Jod — compatible Vite 7.3+, better-sqlite3 ^12.9)
#   npm      : 10.x (inclus avec Node 20 LTS)
#   Alpine   : 3.20 (stable)
#   Vite     : ^7.3.1
#   React    : ^19.2.0
#   TanStack : ^1.167.14
# ============================================

# ---------- Stage 1: Production dependencies ----------
FROM node:20.19-alpine AS deps
WORKDIR /app

# Build tools required for native modules (better-sqlite3 ^12.9.0)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Stage 2: Build application ----------
FROM node:20.19-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build for production (Docker config — no Cloudflare)
ENV NODE_ENV=production
RUN npx vite build --config vite.config.docker.ts

# ---------- Stage 3: Production runtime ----------
FROM node:20.19-alpine AS runner
WORKDIR /app

# Runtime dependency for better-sqlite3
RUN apk add --no-cache libstdc++

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Create data directory for SQLite persistence
RUN mkdir -p /app/data

# Metadata labels
LABEL maintainer="Parentalité & Co"
LABEL app.name="Mums'Home POS"
LABEL app.version="1.0.1"
LABEL app.node="20.19"
LABEL app.description="Point de vente Mums'Home — Parentalité & Co"

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start the application
CMD ["node", "dist/server/server.js"]
