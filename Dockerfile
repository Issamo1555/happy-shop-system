# ============================================
# Mums'Home POS - Docker Production Image
# ============================================

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ 

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build for production (use Docker-specific config without Cloudflare)
ENV NODE_ENV=production
RUN npx vite build --config vite.config.docker.ts

# Stage 3: Production runtime
FROM node:20-alpine AS runner
WORKDIR /app

# Install only what's needed for better-sqlite3 at runtime
RUN apk add --no-cache libstdc++

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Create data directory for SQLite persistence
RUN mkdir -p /app/data

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start the application
CMD ["node", ".output/server/index.mjs"]
