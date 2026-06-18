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

# Install ALL deps including devDeps from root
RUN npm ci --include=dev

# Install nest CLI globally so it's always available regardless of hoisting
RUN npm install -g @nestjs/cli

# Copy all source files
COPY . .

# Build the API — run from apps/api so nest-cli.json is auto-detected
RUN cd apps/api && nest build

# Find where the compiled output actually is
RUN find /app -name "main.js" 2>/dev/null || echo "main.js not found anywhere!"

# Expose port
EXPOSE 4000

# Start the compiled app using absolute path
CMD ["node", "/app/apps/api/dist/src/main"]
