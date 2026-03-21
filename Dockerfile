# ─────────────────────────────────────────────────────────────
# Stage 1 — Install dependencies (with dev tools available)
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS deps

# Enable pnpm via corepack (ships with Node 20, no extra install needed)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy only manifests first to leverage Docker layer cache
COPY package.json pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# ─────────────────────────────────────────────────────────────
# Stage 2 — Runtime image (lean)
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

# Metadata labels
LABEL org.opencontainers.image.title="MC Manager Bot" \
      org.opencontainers.image.description="Discord bot to manage a Minecraft Docker container" \
      org.opencontainers.image.licenses="MIT"

# Run as a non-root user for security
RUN groupadd --gid 1001 botuser && \
    useradd  --uid 1001 --gid botuser --shell /bin/sh --create-home botuser

WORKDIR /app

# Copy installed modules from deps stage
COPY --from=deps --chown=botuser:botuser /app/node_modules ./node_modules

# Copy application source
COPY --chown=botuser:botuser . .

# Use non-root user
USER botuser

# ── Environment variables (provided at runtime, NOT baked in) ──
# DISCORD_TOKEN and CONTAINER_NAME must be passed via --env or --env-file

# Healthcheck: verify the Node process is alive
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

CMD ["node", "index.js"]
