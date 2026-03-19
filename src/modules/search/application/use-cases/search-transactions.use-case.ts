import { Inject, Injectable } from '@nestjs/common';
import { AppLogger } from '../../../../common/infrastructure/logging/app-logger.service';
import { TRANSACTION_REPOSITORY } from '../../../../common/infrastructure/repository.tokens';
import {
  Transaction,
  type TransactionRepository,
  TransactionSearchFilters,
} from '../../../transactions/domain';
import { SearchExecutionService } from '../services/search-execution.service';
import { TransactionSearchQueryBuilderService } from '../../infrastructure/elastic/builders/transaction-search-query-builder.service';
import { SearchElasticReaderService } from '../../infrastructure/elastic/search-elastic-reader.service';
import { TRANSACTIONS_INDEX } from '../../infrastructure/elastic/search-index.constants';

@Injectable()
export class SearchTransactionsUseCase {
  constructor(
    private readonly searchElasticReaderService: SearchElasticReaderService,
    private readonly searchExecutionService: SearchExecutionService,
    private readonly transactionSearchQueryBuilderService: TransactionSearchQueryBuilderService,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepository,
    private readonly appLogger: AppLogger,
  ) {}

  async execute(
    filters: TransactionSearchFilters,
    limit?: number,
    offset?: number,
  ): Promise<Transaction[]> {
    const startedAt = Date.now();
    const query = this.transactionSearchQueryBuilderService.build(
      filters,
      limit,
      offset,
    );

    const transactions = await this.searchExecutionService.runWithFallback(
      'transactions',
      () => this.searchElasticReaderService.searchTransactions(query),
      async () =>
        this.searchExecutionService.paginateResults(
          await this.transactionRepository.search(filters),
          query.page,
        ),
      query.metadata,
    );

    this.appLogger.log('search.transactions.executed', {
      index: TRANSACTIONS_INDEX,
      filters: query.metadata,
      resultCount: transactions.length,
      durationMs: Date.now() - startedAt,
    });

    return transactions;
  }
}
