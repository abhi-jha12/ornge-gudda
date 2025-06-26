# Use Node.js 18 slim image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install system dependencies and curl for health checks
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy the entire application
COPY . .

# Create logs directory and set proper ownership
RUN mkdir -p logs && chown -R node:node /app

# Switch to non-root user (node user already exists)
USER node

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Run the application
CMD ["node", "src/app.js"]