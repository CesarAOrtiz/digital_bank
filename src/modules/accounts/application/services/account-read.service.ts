import { Inject, Injectable } from '@nestjs/common';
import { normalizePagination } from '../../../../common/application/pagination';
import { ResourceNotFoundException } from '../../../../common/domain/exceptions';
import { ACCOUNT_REPOSITORY } from '../../../../common/infrastructure/repository.tokens';
import { SearchQueryService } from '../../../search/application/services/search-query.service';
import { Account } from '../../domain';
import type { AccountRepository } from '../../domain';
import { ClientAccountsCacheService } from './client-accounts-cache.service';

@Injectable()
export class AccountReadService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepository,
    private readonly clientAccountsCacheService: ClientAccountsCacheService,
    private readonly searchQueryService: SearchQueryService,
  ) {}

  findAll(limit?: number, offset?: number): Promise<Account[]> {
    const page = normalizePagination({ limit, offset });
    return this.accountRepository.findAll(page.limit, page.offset);
  }

  findByClient(
    clientId: string,
    limit?: number,
    offset?: number,
  ): Promise<Account[]> {
    const page = normalizePagination({ limit, offset });
    return this.clientAccountsCacheService.findByClient(
      clientId.trim(),
      page.limit,
      page.offset,
      (normalizedClientId) =>
        this.accountRepository.findByClientId(normalizedClientId),
    );
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

  search(term: string, limit?: number, offset?: number): Promise<Account[]> {
    const page = normalizePagination({ limit, offset });
    return this.searchQueryService.searchAccounts(term, page.limit, page.offset);
  }

  async findOne(id: string): Promise<Account> {
    const account = await this.accountRepository.findById(id);
    if (!account) {
      throw new ResourceNotFoundException(`Account ${id} not found.`);
    }

    return account;
  }
}
