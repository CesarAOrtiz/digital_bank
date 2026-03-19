import { Inject, Injectable } from '@nestjs/common';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import {
  AccountStatus,
  Currency,
  TransactionType,
} from '../../../common/domain/enums';
import { ELASTIC_CLIENT } from '../../../common/infrastructure/elasticsearch/elasticsearch.tokens';
import { AppLogger } from '../../../common/infrastructure/logging/app-logger.service';
import {
  ACCOUNT_REPOSITORY,
  CLIENT_REPOSITORY,
  TRANSACTION_REPOSITORY,
} from '../../../common/infrastructure/repository.tokens';
import { Account } from '../../accounts/domain';
import type { AccountRepository } from '../../accounts/domain';
import { Client } from '../../clients/domain';
import type { ClientRepository } from '../../clients/domain';
import {
  Transaction,
  type TransactionRepository,
  TransactionSearchFilters,
} from '../../transactions/domain';

const CLIENTS_INDEX = 'clients';
const ACCOUNTS_INDEX = 'accounts';
const TRANSACTIONS_INDEX = 'transactions';

interface ClientSearchDocument {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  documentNumber: string;
  createdAt: string;
  updatedAt: string;
}

interface AccountSearchDocument {
  id: string;
  accountNumber: string;
  clientId: string;
  currency: string;
  status: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

interface TransactionSearchDocument {
  id: string;
  type: string;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  sourceCurrency: string;
  destinationCurrency: string | null;
  sourceAmount: number;
  destinationAmount: number | null;
  exchangeRateUsed: string | null;
  description: string | null;
  idempotencyKey: string | null;
  createdAt: string;
}

@Injectable()
export class SearchQueryService {
  constructor(
    @Inject(ELASTIC_CLIENT) private readonly elastic: ElasticClient,
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepository,
    private readonly appLogger: AppLogger,
  ) {}

  async searchClients(term: string): Promise<Client[]> {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) {
      return [];
    }
    const startedAt = Date.now();

    const clients = await this.runWithFallback(
      'clients',
      () => this.searchClientsInElastic(normalizedTerm),
      () => this.clientRepository.search(normalizedTerm),
      { term: normalizedTerm },
    );

    this.appLogger.log('search.clients.executed', {
      index: CLIENTS_INDEX,
      term: normalizedTerm,
      resultCount: clients.length,
      durationMs: Date.now() - startedAt,
    });

    return clients;
  }

  async searchAccounts(term: string): Promise<Account[]> {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) {
      return [];
    }
    const startedAt = Date.now();

    const accounts = await this.runWithFallback(
      'accounts',
      () => this.searchAccountsInElastic(normalizedTerm),
      () => this.accountRepository.search(normalizedTerm),
      { term: normalizedTerm },
    );

    this.appLogger.log('search.accounts.executed', {
      index: ACCOUNTS_INDEX,
      term: normalizedTerm,
      resultCount: accounts.length,
      durationMs: Date.now() - startedAt,
    });

    return accounts;
  }

  async searchTransactions(
    filters: TransactionSearchFilters,
  ): Promise<Transaction[]> {
    const startedAt = Date.now();
    const must: object[] = [];
    const filter: object[] = [];

    if (filters.text?.trim()) {
      const normalizedText = filters.text.trim();
      must.push({
        bool: {
          should: [
            {
              match: {
                description: {
                  query: normalizedText,
                  operator: 'and',
                },
              },
            },
            {
              wildcard: {
                idempotencyKey: {
                  value: `*${normalizedText.toLowerCase()}*`,
                  case_insensitive: true,
                },
              },
            },
            {
              wildcard: {
                id: {
                  value: `*${normalizedText.toLowerCase()}*`,
                  case_insensitive: true,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      });
    }

    if (filters.type) {
      filter.push({ term: { type: filters.type } });
    }

    if (filters.sourceAccountId) {
      filter.push({ term: { sourceAccountId: filters.sourceAccountId } });
    }

    if (filters.destinationAccountId) {
      filter.push({
        term: { destinationAccountId: filters.destinationAccountId },
      });
    }

    if (filters.accountId) {
      filter.push({
        bool: {
          should: [
            { term: { sourceAccountId: filters.accountId } },
            { term: { destinationAccountId: filters.accountId } },
          ],
          minimum_should_match: 1,
        },
      });
    }

    if (filters.currency) {
      filter.push({
        bool: {
          should: [
            { term: { sourceCurrency: filters.currency } },
            { term: { destinationCurrency: filters.currency } },
          ],
          minimum_should_match: 1,
        },
      });
    }

    if (filters.dateFrom || filters.dateTo) {
      filter.push({
        range: {
          createdAt: {
            ...(filters.dateFrom
              ? { gte: filters.dateFrom.toISOString() }
              : {}),
            ...(filters.dateTo ? { lte: filters.dateTo.toISOString() } : {}),
          },
        },
      });
    }

    const transactions = await this.runWithFallback(
      'transactions',
      () =>
        this.searchTransactionsInElastic({
          filters,
          must,
          filter,
        }),
      () => this.transactionRepository.search(filters),
      {
        text: filters.text?.trim() || undefined,
        type: filters.type,
        accountId: filters.accountId,
        sourceAccountId: filters.sourceAccountId,
        destinationAccountId: filters.destinationAccountId,
        currency: filters.currency,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
      },
    );

    this.appLogger.log('search.transactions.executed', {
      index: TRANSACTIONS_INDEX,
      filters: {
        text: filters.text?.trim() || undefined,
        type: filters.type,
        accountId: filters.accountId,
        sourceAccountId: filters.sourceAccountId,
        destinationAccountId: filters.destinationAccountId,
        currency: filters.currency,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
      },
      resultCount: transactions.length,
      durationMs: Date.now() - startedAt,
    });

    return transactions;
  }

  private async searchClientsInElastic(term: string): Promise<Client[]> {
    const response = await this.elastic.search<ClientSearchDocument>({
      index: CLIENTS_INDEX,
      query: {
        bool: {
          should: [
            {
              multi_match: {
                query: term,
                fields: ['fullName^3', 'firstName^2', 'lastName^2', 'email'],
                type: 'bool_prefix',
              },
            },
            {
              wildcard: {
                documentNumber: {
                  value: `*${term.toLowerCase()}*`,
                  case_insensitive: true,
                },
              },
            },
            {
              wildcard: {
                'email.keyword': {
                  value: `*${term.toLowerCase()}*`,
                  case_insensitive: true,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      sort: [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }],
      size: 25,
    });

    return response.hits.hits
      .map((hit) => hit._source)
      .filter((doc): doc is ClientSearchDocument => !!doc)
      .map(
        (doc) =>
          new Client({
            id: doc.id,
            firstName: doc.firstName,
            lastName: doc.lastName,
            email: doc.email,
            documentNumber: doc.documentNumber,
            createdAt: new Date(doc.createdAt),
            updatedAt: new Date(doc.updatedAt),
          }),
      );
  }

  private async searchAccountsInElastic(term: string): Promise<Account[]> {
    const response = await this.elastic.search<AccountSearchDocument>({
      index: ACCOUNTS_INDEX,
      query: {
        bool: {
          should: [
            {
              wildcard: {
                accountNumber: {
                  value: `*${term.toLowerCase()}*`,
                  case_insensitive: true,
                },
              },
            },
            {
              wildcard: {
                clientId: {
                  value: `*${term.toLowerCase()}*`,
                  case_insensitive: true,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      sort: [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }],
      size: 25,
    });

    return response.hits.hits
      .map((hit) => hit._source)
      .filter((doc): doc is AccountSearchDocument => !!doc)
      .map(
        (doc) =>
          new Account({
            id: doc.id,
            accountNumber: doc.accountNumber,
            clientId: doc.clientId,
            currency: doc.currency as Currency,
            balance: doc.balance.toFixed(2),
            status: doc.status as AccountStatus,
            createdAt: new Date(doc.createdAt),
            updatedAt: new Date(doc.updatedAt),
          }),
      );
  }

  private async searchTransactionsInElastic(options: {
    filters: TransactionSearchFilters;
    must: object[];
    filter: object[];
  }): Promise<Transaction[]> {
    const response = await this.elastic.search<TransactionSearchDocument>({
      index: TRANSACTIONS_INDEX,
      query: {
        bool: {
          ...(options.must.length ? { must: options.must } : {}),
          ...(options.filter.length ? { filter: options.filter } : {}),
        },
      },
      sort: options.must.length
        ? [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }]
        : [{ createdAt: { order: 'desc' } }],
      size: 50,
    });

    return response.hits.hits
      .map((hit) => hit._source)
      .filter((doc): doc is TransactionSearchDocument => !!doc)
      .map(
        (doc) =>
          new Transaction({
            id: doc.id,
            type: doc.type as TransactionType,
            sourceAccountId: doc.sourceAccountId,
            destinationAccountId: doc.destinationAccountId,
            sourceCurrency: doc.sourceCurrency as Currency,
            destinationCurrency: doc.destinationCurrency as Currency | null,
            sourceAmount: doc.sourceAmount.toFixed(2),
            destinationAmount:
              doc.destinationAmount === null
                ? null
                : doc.destinationAmount.toFixed(2),
            exchangeRateUsed: doc.exchangeRateUsed,
            idempotencyKey: doc.idempotencyKey,
            description: doc.description,
            createdAt: new Date(doc.createdAt),
          }),
      );
  }

  private async runWithFallback<T>(
    scope: 'clients' | 'accounts' | 'transactions',
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    metadata: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Elastic error';
      this.appLogger.warn(`search.${scope}.fallback_to_postgres`, {
        ...metadata,
        reason: message,
      });
      return fallback();
    }
  }
}
