import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import type { estypes } from '@elastic/elasticsearch';
import { ELASTIC_CLIENT } from '../../../common/infrastructure/elasticsearch/elasticsearch.tokens';
import { Account } from '../../accounts/domain';
import { Client } from '../../clients/domain';
import { Transaction } from '../../transactions/domain';

const CLIENTS_INDEX = 'clients';
const ACCOUNTS_INDEX = 'accounts';
const TRANSACTIONS_INDEX = 'transactions';

@Injectable()
export class SearchIndexingService implements OnModuleInit {
  private readonly logger = new Logger(SearchIndexingService.name);

  constructor(
    @Inject(ELASTIC_CLIENT) private readonly elastic: ElasticClient,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await Promise.all([
        this.ensureIndex(CLIENTS_INDEX, {
          id: { type: 'keyword' },
          firstName: {
            type: 'text',
            fields: { keyword: { type: 'keyword' } },
          },
          lastName: {
            type: 'text',
            fields: { keyword: { type: 'keyword' } },
          },
          fullName: {
            type: 'text',
            fields: { keyword: { type: 'keyword' } },
          },
          email: {
            type: 'text',
            fields: { keyword: { type: 'keyword' } },
          },
          documentNumber: { type: 'keyword' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
        }),
        this.ensureIndex(ACCOUNTS_INDEX, {
          id: { type: 'keyword' },
          accountNumber: { type: 'keyword' },
          clientId: { type: 'keyword' },
          currency: { type: 'keyword' },
          status: { type: 'keyword' },
          balance: { type: 'scaled_float', scaling_factor: 100 },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
        }),
        this.ensureIndex(TRANSACTIONS_INDEX, {
          id: { type: 'keyword' },
          type: { type: 'keyword' },
          sourceAccountId: { type: 'keyword' },
          destinationAccountId: { type: 'keyword' },
          sourceCurrency: { type: 'keyword' },
          destinationCurrency: { type: 'keyword' },
          sourceAmount: { type: 'scaled_float', scaling_factor: 100 },
          destinationAmount: { type: 'scaled_float', scaling_factor: 100 },
          description: {
            type: 'text',
            fields: { keyword: { type: 'keyword' } },
          },
          exchangeRateUsed: { type: 'keyword' },
          idempotencyKey: { type: 'keyword' },
          createdAt: { type: 'date' },
        }),
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Elastic error';
      this.logger.warn(
        `Elasticsearch unavailable during startup. Search bootstrap skipped: ${message}`,
      );
    }
  }

  async indexClient(client: Client): Promise<void> {
    const data = client.toPrimitives();

    await this.runIndexingTask(
      `index client ${data.id}`,
      this.elastic.index({
        index: CLIENTS_INDEX,
        id: data.id,
        document: {
          id: data.id,
          firstName: data.firstName,
          lastName: data.lastName,
          fullName: `${data.firstName} ${data.lastName}`.trim(),
          email: data.email,
          documentNumber: data.documentNumber,
          createdAt: data.createdAt.toISOString(),
          updatedAt: data.updatedAt.toISOString(),
        },
      }),
    );
  }

  async indexAccount(account: Account): Promise<void> {
    const data = account.toPrimitives();

    await this.runIndexingTask(
      `index account ${data.id}`,
      this.elastic.index({
        index: ACCOUNTS_INDEX,
        id: data.id,
        document: {
          id: data.id,
          accountNumber: data.accountNumber,
          clientId: data.clientId,
          currency: data.currency,
          status: data.status,
          balance: Number(data.balance),
          createdAt: data.createdAt.toISOString(),
          updatedAt: data.updatedAt.toISOString(),
        },
      }),
    );
  }

  async indexTransaction(transaction: Transaction): Promise<void> {
    const data = transaction.toPrimitives();

    await this.runIndexingTask(
      `index transaction ${data.id}`,
      this.elastic.index({
        index: TRANSACTIONS_INDEX,
        id: data.id,
        document: {
          id: data.id,
          type: data.type,
          sourceAccountId: data.sourceAccountId,
          destinationAccountId: data.destinationAccountId,
          sourceCurrency: data.sourceCurrency,
          destinationCurrency: data.destinationCurrency,
          sourceAmount: Number(data.sourceAmount),
          destinationAmount: data.destinationAmount
            ? Number(data.destinationAmount)
            : null,
          exchangeRateUsed: data.exchangeRateUsed,
          description: data.description,
          idempotencyKey: data.idempotencyKey,
          createdAt: data.createdAt.toISOString(),
        },
      }),
    );
  }

  private async ensureIndex(
    index: string,
    properties: Record<string, estypes.MappingProperty>,
  ): Promise<void> {
    const exists = await this.elastic.indices.exists({ index });
    if (exists) {
      return;
    }

    await this.elastic.indices.create({
      index,
      mappings: {
        properties,
      },
    });

    this.logger.log(`Created Elasticsearch index ${index}.`);
  }

  private async runIndexingTask(
    label: string,
    task: Promise<unknown>,
  ): Promise<void> {
    try {
      await task;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Elastic error';
      this.logger.error(`Failed to ${label}: ${message}`);
    }
  }
}
