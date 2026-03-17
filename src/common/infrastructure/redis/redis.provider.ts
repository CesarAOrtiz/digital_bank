import 'dotenv/config';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.tokens';

export const redisProvider = {
  provide: REDIS_CLIENT,
  useFactory: () => {
    const logger = new Logger('RedisClientProvider');
    const client = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT ?? 6379),
      username: process.env.REDIS_USERNAME || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB ?? 0),
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT ?? 3000),
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });

    client.on('error', (error) => {
      logger.warn(`Redis client error: ${error.message}`);
    });

    logger.log('Redis client configured for lazy initialization.');
    return client;
  },
};
