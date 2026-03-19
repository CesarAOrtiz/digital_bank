import { Injectable } from '@nestjs/common';
import { Account } from '../../../accounts/domain';
import { Client } from '../../../clients/domain';
import {
  Transaction,
  TransactionSearchFilters,
} from '../../../transactions/domain';
import { SearchAccountsUseCase } from '../use-cases/search-accounts.use-case';
import { SearchClientsUseCase } from '../use-cases/search-clients.use-case';
import { SearchTransactionsUseCase } from '../use-cases/search-transactions.use-case';

@Injectable()
export class SearchQueryService {
  constructor(
    private readonly searchClientsUseCase: SearchClientsUseCase,
    private readonly searchAccountsUseCase: SearchAccountsUseCase,
    private readonly searchTransactionsUseCase: SearchTransactionsUseCase,
  ) {}

  searchClients(term: string, limit?: number, offset?: number): Promise<Client[]> {
    return this.searchClientsUseCase.execute(term, limit, offset);
  }

  searchAccounts(
    term: string,
    limit?: number,
    offset?: number,
  ): Promise<Account[]> {
    return this.searchAccountsUseCase.execute(term, limit, offset);
  }

  searchTransactions(
    filters: TransactionSearchFilters,
    limit?: number,
    offset?: number,
  ): Promise<Transaction[]> {
    return this.searchTransactionsUseCase.execute(filters, limit, offset);
  }
}
