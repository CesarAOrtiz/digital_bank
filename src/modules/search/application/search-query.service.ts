import { Inject, Injectable } from '@nestjs/common';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import {
  AccountStatus,
  Currency,
  TransactionType,
} from '../../../common/domain/enums';
import { ELASTIC_CLIENT } from '../../../common/infrastructure/elasticsearch/elasticsearch.tokens';
import { Account } from '../../accounts/domain';
import { Client } from '../../clients/domain';
import { Transaction, TransactionSearchFilters } from '../../transactions/domain';

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
  ) {}

  async searchClients(term: string): Promise<Client[]> {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) {
      return [];
    }

    const response = await this.elastic.search<ClientSearchDocument>({
      index: CLIENTS_INDEX,
      query: {
        bool: {
          should: [
            {
              multi_match: {
                query: normalizedTerm,
                fields: ['fullName^3', 'firstName^2', 'lastName^2', 'email'],
                type: 'bool_prefix',
              },
            },
            {
              wildcard: {
                'documentNumber': {
                  value: `*${normalizedTerm.toLowerCase()}*`,
                  case_insensitive: true,
                },
              },
            },
            {
              wildcard: {
                'email.keyword': {
                  value: `*${normalizedTerm.toLowerCase()}*`,
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

  async searchAccounts(term: string): Promise<Account[]> {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) {
      return [];
    }

    const response = await this.elastic.search<AccountSearchDocument>({
      index: ACCOUNTS_INDEX,
      query: {
        bool: {
          should: [
            {
              wildcard: {
                accountNumber: {
                  value: `*${normalizedTerm.toLowerCase()}*`,
                  case_insensitive: true,
                },
              },
            },
            {
              wildcard: {
                clientId: {
                  value: `*${normalizedTerm.toLowerCase()}*`,
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

  async searchTransactions(
    filters: TransactionSearchFilters,
  ): Promise<Transaction[]> {
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
            ...(filters.dateFrom ? { gte: filters.dateFrom.toISOString() } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo.toISOString() } : {}),
          },
        },
      });
    }

    const response = await this.elastic.search<TransactionSearchDocument>({
      index: TRANSACTIONS_INDEX,
      query: {
        bool: {
          ...(must.length ? { must } : {}),
          ...(filter.length ? { filter } : {}),
        },
      },
      sort: must.length
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
}
