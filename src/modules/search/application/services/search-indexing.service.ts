import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import type { estypes } from '@elastic/elasticsearch';
import { ELASTIC_CLIENT } from '../../../../common/infrastructure/elasticsearch/elasticsearch.tokens';
import { Account } from '../../../accounts/domain';
import { Client } from '../../../clients/domain';
import { Transaction } from '../../../transactions/domain';
import {
  ACCOUNTS_INDEX,
  ACCOUNTS_MAPPING,
  CLIENTS_INDEX,
  CLIENTS_MAPPING,
  TRANSACTIONS_INDEX,
  TRANSACTIONS_MAPPING,
} from '../search-index.constants';

@Injectable()
export class SearchIndexingService implements OnModuleInit {
  private readonly logger = new Logger(SearchIndexingService.name);

  constructor(
    @Inject(ELASTIC_CLIENT) private readonly elastic: ElasticClient,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureIndices();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Elastic error';
      this.logger.warn(
        `Elasticsearch unavailable during startup. Search bootstrap skipped: ${message}`,
      );
    }
  }

  async ensureIndices(): Promise<void> {
    await Promise.all([
      this.ensureIndex(CLIENTS_INDEX, CLIENTS_MAPPING),
      this.ensureIndex(ACCOUNTS_INDEX, ACCOUNTS_MAPPING),
      this.ensureIndex(TRANSACTIONS_INDEX, TRANSACTIONS_MAPPING),
    ]);
  }

  async recreateIndices(): Promise<void> {
    await this.deleteIndexIfExists(TRANSACTIONS_INDEX);
    await this.deleteIndexIfExists(ACCOUNTS_INDEX);
    await this.deleteIndexIfExists(CLIENTS_INDEX);
    await this.ensureIndices();
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

  private async deleteIndexIfExists(index: string): Promise<void> {
    const exists = await this.elastic.indices.exists({ index });
    if (!exists) {
      return;
    }

    await this.elastic.indices.delete({ index });
    this.logger.log(`Deleted Elasticsearch index ${index}.`);
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
