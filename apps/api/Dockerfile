FROM node:20-slim

WORKDIR /app

# Install OpenSSL to prevent Prisma SSL hang/warnings
RUN apt-get update -y && apt-get install -y openssl

# Skip Puppeteer Chromium download (uses system chrome or skips PDF gen)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy package files and install ALL deps (including devDeps for @nestjs/cli)
COPY package*.json ./
RUN npm install --include=dev

# Copy source
COPY . .

# Generate Prisma client and compile TypeScript
RUN npx prisma generate && node ./node_modules/@nestjs/cli/bin/nest.js build

# Expose API port
EXPOSE 4000

# Run node directly to bypass Prisma migrate deploy hang
CMD ["sh", "-c", "node dist/main"]
