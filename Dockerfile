FROM node:20-slim

WORKDIR /app

# Install system dependencies needed by Puppeteer & Prisma
RUN apt-get update -y && apt-get install -y openssl chromium --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Skip Puppeteer's own Chromium download — use the system one above
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy root package files for workspace resolution
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Install ALL dependencies (including devDeps for @nestjs/cli & typescript)
RUN npm ci --include=dev --workspace=apps/api --ignore-scripts

# Copy all source files
COPY . .

# Build the API
RUN npm run build:api

# Expose port (Railway overrides this with $PORT at runtime)
EXPOSE 4000

# Start the compiled app
CMD ["node", "apps/api/dist/src/main"]
