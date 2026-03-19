import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNT_REPOSITORY,
  CLIENT_REPOSITORY,
  TRANSACTION_REPOSITORY,
} from '../../../common/infrastructure/repository.tokens';
import { AppLogger } from '../../../common/infrastructure/logging/app-logger.service';
import type { AccountRepository } from '../../accounts/domain';
import type { ClientRepository } from '../../clients/domain';
import type { TransactionRepository } from '../../transactions/domain';
import { SearchIndexingService } from './search-indexing.service';

export interface SearchReindexSummary {
  clients: number;
  accounts: number;
  transactions: number;
}

const REINDEX_BATCH_SIZE = 200;

@Injectable()
export class SearchReindexService {
  constructor(
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepository,
    private readonly searchIndexingService: SearchIndexingService,
    private readonly appLogger: AppLogger,
  ) {}

  async reindexAll(): Promise<SearchReindexSummary> {
    this.appLogger.log('search.reindex.started');

    await this.searchIndexingService.ensureIndices();

    const summary = {
      clients: await this.reindexClients(),
      accounts: await this.reindexAccounts(),
      transactions: await this.reindexTransactions(),
    } satisfies SearchReindexSummary;

    this.appLogger.log('search.reindex.completed', summary);

    return summary;
  }

  private async reindexClients(): Promise<number> {
    return this.reindexInBatches(
      (lastId, limit) => this.clientRepository.findPageAfterId(lastId, limit),
      (client) => client.toPrimitives().id,
      (client) => this.searchIndexingService.indexClient(client),
    );
  }

  private async reindexAccounts(): Promise<number> {
    return this.reindexInBatches(
      (lastId, limit) => this.accountRepository.findPageAfterId(lastId, limit),
      (account) => account.toPrimitives().id,
      (account) => this.searchIndexingService.indexAccount(account),
    );
  }

  private async reindexTransactions(): Promise<number> {
    return this.reindexInBatches(
      (lastId, limit) =>
        this.transactionRepository.findPageAfterId(lastId, limit),
      (transaction) => transaction.toPrimitives().id,
      (transaction) => this.searchIndexingService.indexTransaction(transaction),
    );
  }

  private async reindexInBatches<T>(
    fetchBatch: (lastId: string | null, limit: number) => Promise<T[]>,
    getId: (item: T) => string,
    indexOne: (item: T) => Promise<void>,
  ): Promise<number> {
    let total = 0;
    let lastId: string | null = null;

    while (true) {
      const batch = await fetchBatch(lastId, REINDEX_BATCH_SIZE);
      if (!batch.length) {
        break;
      }

      await Promise.all(batch.map((item) => indexOne(item)));
      total += batch.length;
      lastId = getId(batch[batch.length - 1]);
    }

    return total;
  }
}
