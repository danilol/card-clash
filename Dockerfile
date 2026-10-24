# The whole card-clash game in one image: the server, which also serves the
# built client, so page, REST and Socket.IO share one origin (story 4.2,
# D26). Render runs this image; Koyeb (the D26 fallback) would run it too.

# Node major is pinned in THREE FROM lines below — keep them in sync with
# each other and with .nvmrc (CI uses .nvmrc via node-version-file).

# --- build: compile engine + server with tsc, the client with vite ---------
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci
COPY packages/engine packages/engine
COPY packages/server packages/server
COPY packages/client packages/client
RUN npm run build

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
# Static files only — the server finds them at ../../client/dist (app.ts).
COPY --from=build /app/packages/client/dist packages/client/dist
# Default port; Render overrides it through the PORT env var (story 4.2, 1d).
EXPOSE 3000
# Config (DATABASE_URL, PORT) comes from runtime env — the image has no .env.
CMD ["node", "packages/server/dist/server.js"]
