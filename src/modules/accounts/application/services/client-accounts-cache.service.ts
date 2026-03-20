import { Injectable } from '@nestjs/common';
import {
  RedisCacheKeys,
  RedisCacheTtl,
} from '../../../../common/infrastructure/redis/redis-cache.keys';
import { RedisCacheService } from '../../../../common/infrastructure/redis/redis-cache.service';
import { Account } from '../../domain';

@Injectable()
export class ClientAccountsCacheService {
  constructor(private readonly redisCacheService: RedisCacheService) {}

  async findByClient(
    clientId: string,
    limit: number,
    offset: number,
    loadAccounts: (clientId: string) => Promise<Account[]>,
  ): Promise<Account[]> {
    const cacheKey = RedisCacheKeys.clientAccounts(clientId);
    const cached =
      await this.redisCacheService.get<
        Array<ReturnType<Account['toPrimitives']>>
      >(cacheKey);

    if (cached) {
      return cached.slice(offset, offset + limit).map(
        (account) =>
          new Account({
            ...account,
            createdAt: new Date(account.createdAt),
            updatedAt: new Date(account.updatedAt),
          }),
      );
    }

    const accounts = await loadAccounts(clientId);
    await this.redisCacheService.set(
      cacheKey,
      accounts.map((account) => account.toPrimitives()),
      RedisCacheTtl.clientAccounts,
    );

    return accounts.slice(offset, offset + limit);
  }

  invalidateClientAccountsCache(clientId: string): Promise<void> {
    return this.redisCacheService.del(
      RedisCacheKeys.clientAccounts(clientId.trim()),
    );
  }
}
