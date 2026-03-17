import { Global, Module } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service';
import { redisProvider } from './redis.provider';
import { REDIS_CLIENT } from './redis.tokens';

@Global()
@Module({
  providers: [redisProvider, RedisCacheService],
  exports: [REDIS_CLIENT, RedisCacheService],
})
export class RedisModule {}
