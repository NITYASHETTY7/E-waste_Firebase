FROM node:20-slim

WORKDIR /app

# Install system dependencies needed by Puppeteer & Prisma
RUN apt-get update -y && apt-get install -y openssl chromium --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Skip Puppeteer's own Chromium download — use the system one above
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy ALL package files (root + workspaces)
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# Install ALL deps including devDeps from root (handles workspace hoisting correctly)
RUN npm ci --include=dev

# Copy all source files
COPY . .

# Build the API using node to call nest directly (avoids .bin symlink permission issues)
RUN node node_modules/@nestjs/cli/bin/nest.js build --config apps/api/nest-cli.json

# Expose port
EXPOSE 4000

# Start the compiled app
CMD ["node", "apps/api/dist/src/main"]
