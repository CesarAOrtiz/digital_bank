import { Inject, Injectable } from '@nestjs/common';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { NormalizedPagination } from '../../../../common/application/pagination';
import {
  AccountStatus,
  Currency,
  TransactionType,
} from '../../../../common/domain/enums';
import { ELASTIC_CLIENT } from '../../../../common/infrastructure/elasticsearch/elasticsearch.tokens';
import { Account } from '../../../accounts/domain';
import { Client } from '../../../clients/domain';
import { Transaction } from '../../../transactions/domain';
import {
  ACCOUNTS_INDEX,
  CLIENTS_INDEX,
  TRANSACTIONS_INDEX,
} from './search-index.constants';

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
export class SearchElasticReaderService {
  constructor(
    @Inject(ELASTIC_CLIENT) private readonly elastic: ElasticClient,
  ) {}

  async searchClients(term: string, page: NormalizedPagination): Promise<Client[]> {
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
      from: page.offset,
      size: page.limit,
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

  async searchAccounts(
    term: string,
    page: NormalizedPagination,
  ): Promise<Account[]> {
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
      from: page.offset,
      size: page.limit,
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

  async searchTransactions(options: {
    must: object[];
    filter: object[];
    page: NormalizedPagination;
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
      from: options.page.offset,
      size: options.page.limit,
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
