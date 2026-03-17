import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { formatMoney, roundMoney } from '../../../common/application/money';
import { AccountStatus } from '../../../common/domain/enums';
import {
  DomainRuleViolationException,
  DuplicateResourceException,
  ResourceNotFoundException,
} from '../../../common/domain/exceptions';
import {
  RedisCacheKeys,
  RedisCacheTtl,
} from '../../../common/infrastructure/redis/redis-cache.keys';
import { RedisCacheService } from '../../../common/infrastructure/redis/redis-cache.service';
import {
  ACCOUNT_REPOSITORY,
  CLIENT_REPOSITORY,
} from '../../../common/infrastructure/repository.tokens';
import type { ClientRepository } from '../../clients/domain';
import { Account } from '../domain';
import type { AccountRepository } from '../domain';
import type { CreateAccountInput } from './inputs/create-account.input';

@Injectable()
export class AccountsService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepository,
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async create(data: CreateAccountInput): Promise<Account> {
    if (!(await this.clientRepository.findById(data.clientId))) {
      throw new ResourceNotFoundException(`Client ${data.clientId} not found.`);
    }

    const accountNumber = data.accountNumber.trim();
    if (await this.accountRepository.findByAccountNumber(accountNumber)) {
      throw new DuplicateResourceException(
        `Account number ${accountNumber} already exists.`,
      );
    }

    const initialBalance = roundMoney(data.initialBalance ?? '0');
    if (initialBalance.lt(0)) {
      throw new DomainRuleViolationException(
        'Initial balance cannot be negative.',
      );
    }

    const now = new Date();
    const account = await this.accountRepository.save(
      new Account({
        id: randomUUID(),
        accountNumber,
        clientId: data.clientId,
        currency: data.currency,
        balance: formatMoney(initialBalance),
        status: AccountStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await this.invalidateClientAccountsCache(data.clientId);
    return account;
  }

  findAll(): Promise<Account[]> {
    return this.accountRepository.findAll();
  }

  findByClient(clientId: string): Promise<Account[]> {
    return this.findByClientCached(clientId.trim());
  }

  async findByAccountNumber(accountNumber: string): Promise<Account> {
    const account = await this.accountRepository.findByAccountNumber(
      accountNumber.trim(),
    );
    if (!account) {
      throw new ResourceNotFoundException(
        `Account ${accountNumber} not found.`,
      );
    }
    return account;
  }

  search(term: string): Promise<Account[]> {
    return this.accountRepository.search(term.trim());
  }

  async findOne(id: string): Promise<Account> {
    const account = await this.accountRepository.findById(id);
    if (!account) {
      throw new ResourceNotFoundException(`Account ${id} not found.`);
    }

    return account;
  }

  async invalidateClientAccountsCache(clientId: string): Promise<void> {
    await this.redisCacheService.del(
      RedisCacheKeys.clientAccounts(clientId.trim()),
    );
  }

  private async findByClientCached(clientId: string): Promise<Account[]> {
    const cacheKey = RedisCacheKeys.clientAccounts(clientId);
    const cached = await this.redisCacheService.get<
      Array<ReturnType<Account['toPrimitives']>>
    >(cacheKey);
    if (cached) {
      // Cached balances are read-optimization only and must never drive financial logic.
      return cached.map(
        (account) =>
          new Account({
            ...account,
            createdAt: new Date(account.createdAt),
            updatedAt: new Date(account.updatedAt),
          }),
      );
    }

    const accounts = await this.accountRepository.findByClientId(clientId);
    await this.redisCacheService.set(
      cacheKey,
      accounts.map((account) => account.toPrimitives()),
      RedisCacheTtl.clientAccounts,
    );
    return accounts;
  }
}
