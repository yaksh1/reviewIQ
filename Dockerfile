# syntax=docker/dockerfile:1

# ---- deps + build stage ----
# Playwright base image: Chromium + all system libs preinstalled.
# Tag MUST match the playwright version in package.json (1.61.1).
FROM mcr.microsoft.com/playwright:v1.61.1-noble AS builder
WORKDIR /app

# Install dependencies (cached unless lockfile changes).
COPY package.json package-lock.json* ./
RUN npm ci

# Build the Next.js standalone output.
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime stage ----
FROM mcr.microsoft.com/playwright:v1.61.1-noble AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# SQLite lives on the mounted volume so it survives redeploys.
ENV DATA_DIR=/data
# Playwright browsers are preinstalled in this base image at this path.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Next standalone output: server + minimal node_modules.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# These packages are in serverExternalPackages, so Next's standalone trace
# excludes them. Copy them in full so they load at runtime.
# better-sqlite3 (native) + its deps:
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
# playwright + playwright-core (drives the bundled Chromium):
COPY --from=builder /app/node_modules/playwright ./node_modules/playwright
COPY --from=builder /app/node_modules/playwright-core ./node_modules/playwright-core

RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "server.js"]
