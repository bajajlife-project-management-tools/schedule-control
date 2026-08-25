# ============================================================
# Stage 1: Build React Frontend Client
# ============================================================
FROM node:20-alpine AS client-builder

WORKDIR /app/client

# Copy client dependencies and install
COPY client/package*.json ./
RUN npm ci

# Copy client source and build production bundle
COPY client/ ./
RUN npm run build

# ============================================================
# Stage 2: Production Server
# ============================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/schedule-control.db

# Copy root & server package definitions
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server code
COPY server/ ./server/
COPY demo/ ./demo/

# Copy built frontend assets from client-builder stage
COPY --from=client-builder /app/client/dist ./client/dist

# Create persistent data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

# Healthcheck to ensure server is responsive
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/projects || exit 1

# Start the Schedule Control & Project Governance application
CMD ["node", "server/index.js"]
