# Multi-Stage Production Dockerfile for SmartNeb Backend
# Stage 1: Build & Dependencies
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev
RUN npx prisma generate

# Stage 2: Hardened Production Runtime
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

# Install dumb-init for proper PID 1 signal forwarding (SIGTERM / SIGINT)
RUN apk add --no-cache dumb-init curl

ENV NODE_ENV=production
ENV PORT=5000

# Create unprivileged application user
RUN addgroup -S smartneb && adduser -S smartneb -G smartneb

COPY --chown=smartneb:smartneb package*.json ./
COPY --from=builder --chown=smartneb:smartneb /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=smartneb:smartneb /usr/src/app/prisma ./prisma
COPY --chown=smartneb:smartneb server.js ./
COPY --chown=smartneb:smartneb scripts ./scripts/

USER smartneb

EXPOSE 5000

# Container Healthcheck targeting the /health probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
