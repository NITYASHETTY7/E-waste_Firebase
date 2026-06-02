import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EmailProcessor } from './email.processor';
import { PdfProcessor } from './pdf.processor';
import { NotificationModule } from '../notifications/notification.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        // Clean Upstash CLI format if present
        let rawUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        if (rawUrl.includes('redis-cli')) {
          const match = rawUrl.match(/redis:\/\/[^\s"]+/);
          if (match) rawUrl = match[0];
        }

        const redisUrl = new URL(rawUrl);
        return {
          redis: {
            host: redisUrl.hostname,
            port: parseInt(redisUrl.port, 10) || 6379,
            password: redisUrl.password,
            username: redisUrl.username,
            tls: rawUrl.includes('upstash') ? {} : undefined, // Upstash requires TLS
            db: 0,
            maxRetriesPerRequest: 3, // <--- CRITICAL: Prevents silent hangs if Redis URL is missing or wrong!
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
    BullModule.registerQueue({
      name: 'pdf',
    }),
    NotificationModule,
    DocumentsModule,
  ],
  providers: [EmailProcessor, PdfProcessor],
})
export class QueueModule {}
