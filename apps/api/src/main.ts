import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';

dotenv.config();

console.log('--- EXECUTING MAIN.TS TOP LEVEL ---');

async function bootstrap() {
  console.log('🔄 Starting EcoLoop API initialization...');
  
  const app = await NestFactory.create(AppModule);
  console.log('✅ NestFactory created successfully (Redis/DB connected)');

  // Prefix all routes with /api
  app.setGlobalPrefix('api');

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : true; // Fallback to allowing all origins if not specified

  // Enable CORS for frontend applications
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Enable class-validator globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 EcoLoop API running on http://0.0.0.0:${port}/api`);
}
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
