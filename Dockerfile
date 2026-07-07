# Multi-stage production build Dockerfile for Polarith Full-Stack Application
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the client and compile the Express backend
RUN npm run build

# --- Production Runner Stage ---
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package files for installing production-only dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built frontend assets and compiled backend server from the builder
COPY --from=builder /app/dist ./dist

# Expose port 3000 (app's binding port)
EXPOSE 3000

# Start the full-stack server
CMD ["node", "dist/server.cjs"]
