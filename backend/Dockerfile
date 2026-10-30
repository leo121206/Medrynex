# Multi-stage Dockerfile for Medrynx Backend Service
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files and Prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma Client
RUN npm ci
RUN npx prisma generate

# Copy source code and config
COPY tsconfig.json ./
COPY src ./src/
COPY contracts ./contracts/

# Build TypeScript to production JavaScript
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install curl for healthcheck probe
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup -S medrynx && adduser -S medrynx -G medrynx

# Copy package manifests and production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy generated Prisma engine, migration artifacts, and built dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/contracts ./contracts

# Set ownership
RUN chown -R medrynx:medrynx /app

USER medrynx

EXPOSE 5000

# Container liveness check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/v1/health/liveness || exit 1

CMD ["node", "dist/server.js"]
