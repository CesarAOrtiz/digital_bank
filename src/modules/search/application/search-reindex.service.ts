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

    await this.searchIndexingService.recreateIndices();

    const [clients, accounts, transactions] = await Promise.all([
      this.clientRepository.findAll(),
      this.accountRepository.findAll(),
      this.transactionRepository.findAll(),
    ]);

    await Promise.all(clients.map((client) => this.searchIndexingService.indexClient(client)));
    await Promise.all(accounts.map((account) => this.searchIndexingService.indexAccount(account)));
    await Promise.all(
      transactions.map((transaction) =>
        this.searchIndexingService.indexTransaction(transaction),
      ),
    );

    const summary = {
      clients: clients.length,
      accounts: accounts.length,
      transactions: transactions.length,
    } satisfies SearchReindexSummary;

    this.appLogger.log('search.reindex.completed', summary);

    return summary;
  }
}
