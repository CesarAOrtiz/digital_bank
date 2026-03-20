import { Injectable } from '@nestjs/common';
import {
  RedisCacheKeys,
  RedisCacheTtl,
} from '../../../../common/infrastructure/redis/redis-cache.keys';
import { RedisCacheService } from '../../../../common/infrastructure/redis/redis-cache.service';
import { Client } from '../../domain';

@Injectable()
export class ClientCacheService {
  constructor(private readonly redisCacheService: RedisCacheService) {}

  async findOne(
    clientId: string,
    loadClient: (clientId: string) => Promise<Client>,
  ): Promise<Client> {
    const cacheKey = RedisCacheKeys.client(clientId);
    const cached = await this.redisCacheService.get<ReturnType<Client['toPrimitives']>>(
      cacheKey,
    );

    if (cached) {
      return new Client({
        ...cached,
        createdAt: new Date(cached.createdAt),
        updatedAt: new Date(cached.updatedAt),
      });
    }

    const client = await loadClient(clientId);
    await this.redisCacheService.set(
      cacheKey,
      client.toPrimitives(),
      RedisCacheTtl.client,
    );

    return client;
  }

  invalidateClientCache(clientId: string): Promise<void> {
    return this.redisCacheService.del(RedisCacheKeys.client(clientId));
  }
}
