import { Inject, Injectable } from '@nestjs/common';
import { normalizePagination } from '../../../../common/application/pagination';
import { AppLogger } from '../../../../common/infrastructure/logging/app-logger.service';
import { ACCOUNT_REPOSITORY } from '../../../../common/infrastructure/repository.tokens';
import { Account } from '../../../accounts/domain';
import type { AccountRepository } from '../../../accounts/domain';
import { SearchElasticReaderService } from '../../infrastructure/elastic/search-elastic-reader.service';
import { ACCOUNTS_INDEX } from '../../infrastructure/elastic/search-index.constants';
import { SearchExecutionService } from '../services/search-execution.service';

@Injectable()
export class SearchAccountsUseCase {
  constructor(
    private readonly searchElasticReaderService: SearchElasticReaderService,
    private readonly searchExecutionService: SearchExecutionService,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepository,
    private readonly appLogger: AppLogger,
  ) {}

  async execute(term: string, limit?: number, offset?: number): Promise<Account[]> {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) {
      return [];
    }

    const startedAt = Date.now();
    const page = normalizePagination({ limit, offset });
    const metadata = {
      term: normalizedTerm,
      offset: page.offset,
      limit: page.limit,
    };

    const accounts = await this.searchExecutionService.runWithFallback(
      'accounts',
      () => this.searchElasticReaderService.searchAccounts(normalizedTerm, page),
      async () =>
        this.searchExecutionService.paginateResults(
          await this.accountRepository.search(normalizedTerm),
          page,
        ),
      metadata,
    );

    this.appLogger.log('search.accounts.executed', {
      index: ACCOUNTS_INDEX,
      ...metadata,
      resultCount: accounts.length,
      durationMs: Date.now() - startedAt,
    });

    return accounts;
  }
}
