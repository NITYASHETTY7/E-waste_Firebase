import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;

  onModuleInit() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
    });
  }

  onModuleDestroy() {
    this.redis.quit();
  }

  async acquireLock(
    key: string,
    value: string,
    ttlMs: number,
  ): Promise<boolean> {
    const result = await this.redis.set(key, value, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string, value: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, key, value);
    return result === 1;
  }

  async checkAndSetIdempotency(key: string, ttlMs: number): Promise<boolean> {
    const result = await this.redis.set(
      `idempotency:${key}`,
      '1',
      'PX',
      ttlMs,
      'NX',
    );
    return result === 'OK';
  }

  async checkRateLimit(
    key: string,
    limit: number,
    ttlSec: number,
  ): Promise<boolean> {
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, ttlSec);
    }
    return current <= limit;
  }

  // ZSET helpers for leaderboard
  async updateLeaderboard(auctionId: string, vendorId: string, amount: number) {
    await this.redis.zadd(`leaderboard:${auctionId}`, amount, vendorId);
  }

  async getLeaderboard(auctionId: string) {
    return this.redis.zrevrange(
      `leaderboard:${auctionId}`,
      0,
      -1,
      'WITHSCORES',
    );
  }

  async reset() {
    await this.redis.flushdb();
  }
}
