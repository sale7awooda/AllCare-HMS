# =============================================================
# AllCare HMS — Dockerfile for Fly.io
# Strategy: Copy only the backend + pre-built frontend (backend/public)
# SQLite DB lives on a persistent Fly volume at /data/allcare.db
# =============================================================
FROM node:20-alpine

# Install build tools needed by better-sqlite3 (native module)
RUN apk add --no-cache python3 make g++

# Set working directory to /app (this represents the backend folder)
WORKDIR /app

# Copy backend package files first (for layer caching)
COPY backend/package.json backend/package-lock.json ./

# Install production dependencies only
RUN npm install --production

# Copy backend source code
COPY backend/server.js ./
COPY backend/src/ ./src/

# Copy pre-built frontend assets (already compiled, lives in backend/public/)
COPY backend/public/ ./public/

# Create the /data directory for the SQLite persistent volume mount
RUN mkdir -p /data

# Expose the server port
EXPOSE 3001

# Environment setup (overridden by fly secrets in production)
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/data/allcare.db

# Start the server
CMD ["node", "server.js"]
