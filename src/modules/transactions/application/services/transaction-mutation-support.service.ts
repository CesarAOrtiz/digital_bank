import { Injectable } from '@nestjs/common';
import { RedisCacheKeys } from '../../../../common/infrastructure/redis/redis-cache.keys';
import { RedisCacheService } from '../../../../common/infrastructure/redis/redis-cache.service';
import { AppLogger } from '../../../../common/infrastructure/logging/app-logger.service';
import {
  DomainRuleViolationException,
  ExchangeRateNotConfiguredException,
  getExceptionCode,
  IdempotencyKeyReuseException,
  InsufficientFundsException,
  ResourceNotFoundException,
} from '../../../../common/domain/exceptions';
import { TransactionType } from '../../../../common/domain/enums';
import { SearchIndexingService } from '../../../search/infrastructure/elastic/search-indexing.service';
import { Account } from '../../../accounts/domain';
import type { AccountRepository } from '../../../accounts/domain';
import { Transaction } from '../../domain';

@Injectable()
export class TransactionMutationSupportService {
  constructor(
    private readonly redisCacheService: RedisCacheService,
    private readonly searchIndexingService: SearchIndexingService,
    private readonly appLogger: AppLogger,
  ) {}

  async requireAccount(accountRepository: AccountRepository, id: string) {
    const account = await accountRepository.findById(id);
    if (!account) {
      throw new ResourceNotFoundException(`Account ${id} not found.`);
    }

    return account;
  }

  async invalidateClientAccountsCaches(clientIds: string[]): Promise<void> {
    await this.redisCacheService.delMany(
      [...new Set(clientIds)].map((clientId) =>
        RedisCacheKeys.clientAccounts(clientId),
      ),
    );
  }

  async syncMutatedResources(
    accounts: Account[],
    transaction: Transaction,
  ): Promise<void> {
    await Promise.all([
      ...accounts.map((account) => this.searchIndexingService.indexAccount(account)),
      this.searchIndexingService.indexTransaction(transaction),
    ]);
  }

  logStarted(event: string, data: Record<string, unknown>): void {
    this.appLogger.log(event, data);
  }

  logTransactionCompleted(event: string, transaction: Transaction): void {
    const data = transaction.toPrimitives();
    this.appLogger.log(event, {
      transactionId: data.id,
      transactionType: data.type,
      sourceAccountId: data.sourceAccountId,
      destinationAccountId: data.destinationAccountId,
      sourceAmount: data.sourceAmount,
      destinationAmount: data.destinationAmount,
      sourceCurrency: data.sourceCurrency,
      destinationCurrency: data.destinationCurrency,
      exchangeRateUsed: data.exchangeRateUsed,
      idempotencyKey: data.idempotencyKey,
    });
  }

  logIdempotentReplay(event: string, transaction: Transaction): void {
    const data = transaction.toPrimitives();
    this.appLogger.warn(event, {
      transactionId: data.id,
      transactionType: data.type,
      sourceAccountId: data.sourceAccountId,
      destinationAccountId: data.destinationAccountId,
      idempotencyKey: data.idempotencyKey,
    });
  }

  logKnownTransactionError(
    error: unknown,
    data: Record<string, unknown>,
  ): void {
    const eventPrefix = getEventPrefix(data['transactionType']);

    if (error instanceof InsufficientFundsException) {
      this.appLogger.warn(`${eventPrefix}.insufficient_funds`, {
        ...data,
        errorCode: error.errorCode,
      });
      return;
    }

    if (error instanceof IdempotencyKeyReuseException) {
      this.appLogger.warn(`${eventPrefix}.idempotency_reused`, {
        ...data,
        errorCode: getExceptionCode(error),
      });
      return;
    }

    if (
      error instanceof DomainRuleViolationException ||
      error instanceof ResourceNotFoundException ||
      error instanceof ExchangeRateNotConfiguredException
    ) {
      this.appLogger.warn(`${eventPrefix}.failed`, {
        ...data,
        errorCode: getExceptionCode(error),
      });
      return;
    }

    this.appLogger.error(`${eventPrefix}.unexpected_error`, error, data);
  }
}

function getEventPrefix(transactionType: unknown): string {
  switch (transactionType) {
    case TransactionType.DEPOSIT:
      return 'transaction.deposit';
    case TransactionType.WITHDRAWAL:
      return 'transaction.withdraw';
    case TransactionType.TRANSFER:
      return 'transaction.transfer';
    default:
      return 'transaction.operation';
  }
}
