# Utiliser une image Node.js stable
FROM node:20-slim AS base

# Installer les dépendances système nécessaires pour better-sqlite3 et mysql2
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste du code
COPY . .

# Définir les variables d'environnement de build
ENV NODE_ENV=production

# Utiliser la config Vite sans Cloudflare pour Docker
RUN cp vite.config.docker.ts vite.config.ts

# Compiler l'application
RUN npm run build

# --- Étape de Production ---
FROM node:20-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copier le build (TanStack Start output est dans dist/)
COPY --from=base /app/dist ./dist
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/public ./public
COPY --from=base /app/server.mjs ./server.mjs

# Dossier pour SQLite (si utilisé en secours)
RUN mkdir -p /app/data

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Lancer l'application via le wrapper Node.js HTTP
CMD ["node", "server.mjs"]
