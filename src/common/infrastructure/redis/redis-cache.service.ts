import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.tokens';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      await this.ensureConnection();
      const value = await this.redis.get(key);
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn(
        `Redis get failed for key ${key}: ${this.getErrorMessage(error)}`,
      );
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      await this.ensureConnection();
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.set(key, serialized, 'EX', ttlSeconds);
        return;
      }

      await this.redis.set(key, serialized);
    } catch (error) {
      this.logger.warn(
        `Redis set failed for key ${key}: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.ensureConnection();
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(
        `Redis del failed for key ${key}: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async delMany(keys: string[]): Promise<void> {
    const uniqueKeys = [...new Set(keys.filter(Boolean))];
    if (!uniqueKeys.length) {
      return;
    }

    try {
      await this.ensureConnection();
      await this.redis.del(...uniqueKeys);
    } catch (error) {
      this.logger.warn(
        `Redis delMany failed for keys ${uniqueKeys.join(', ')}: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const freshValue = await factory();
    await this.set(key, freshValue, ttlSeconds);
    return freshValue;
  }

  private async ensureConnection(): Promise<void> {
    if (['wait', 'end'].includes(this.redis.status)) {
      await this.redis.connect();
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
