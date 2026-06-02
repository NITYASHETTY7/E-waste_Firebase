import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: ['error'],
    });
  }

  async onModuleInit() {
    let retries = 5;
    while (retries > 0) {
      try {
        await this.$connect();
        break;
      } catch (err) {
        retries--;
        console.error(
          `Prisma connection failed, retrying... (${retries} left)`,
          err,
        );
        await new Promise((res) => setTimeout(res, 2000));
      }
    }

    // Middleware to catch connection reset and retry
    (this as any).$use(
      async (params: any, next: (params: any) => Promise<any>) => {
        try {
          return await next(params);
        } catch (error: any) {
          // P1017 is "Server has closed the connection"
          if (
            error.code === 'P1017' ||
            error.message?.includes('closed the connection')
          ) {
            console.warn(
              'DB connection reset detected, attempting reconnect and retry...',
            );
            try {
              await this.$connect();
              return await next(params);
            } catch (retryError) {
              throw retryError;
            }
          }
          throw error;
        }
      },
    );

    // Keepalive ping every 30 seconds to prevent idle timeout
    setInterval(async () => {
      try {
        await this.$queryRaw`SELECT 1`;
      } catch (e) {
        // Attempt to reconnect if heartbeat fails
        this.$connect().catch(() => {});
      }
    }, 30 * 1000);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
