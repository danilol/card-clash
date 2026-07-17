# Server image for card-clash (engine + server only; the client ships via
# Cloudflare Pages). Both D25 hosts (Cloudflare Containers, Fly.io) consume
# this same image.

# --- build: compile engine + server with tsc -------------------------------
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci
COPY packages/engine packages/engine
COPY packages/server packages/server
RUN npm run build -w @card-clash/engine && npm run build -w @card-clash/server

# --- deps: production node_modules for the server workspace only -----------
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci --omit=dev -w @card-clash/server

# --- runtime ----------------------------------------------------------------
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
# package.json files carry "type": "module" — required for the ESM dist output
COPY --from=deps /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/engine/package.json packages/engine/
COPY --from=build /app/packages/engine/dist packages/engine/dist
COPY --from=build /app/packages/server/package.json packages/server/
COPY --from=build /app/packages/server/dist packages/server/dist
EXPOSE 3000
# Config (DATABASE_URL) comes from runtime env — the image contains no .env.
CMD ["node", "packages/server/dist/server.js"]
