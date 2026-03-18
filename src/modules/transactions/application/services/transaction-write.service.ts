import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  formatMoney,
  formatRate,
  roundMoney,
  toDecimal,
} from '../../../../common/application/money';
import { Currency, TransactionType } from '../../../../common/domain/enums';
import {
  DomainRuleViolationException,
  ExchangeRateNotConfiguredException,
  getExceptionCode,
  IdempotencyKeyReuseException,
  InsufficientFundsException,
  ResourceNotFoundException,
} from '../../../../common/domain/exceptions';
import { AppLogger } from '../../../../common/infrastructure/logging/app-logger.service';
import {
  RedisCacheKeys,
} from '../../../../common/infrastructure/redis/redis-cache.keys';
import { RedisCacheService } from '../../../../common/infrastructure/redis/redis-cache.service';
import { Account } from '../../../accounts/domain';
import type { AccountRepository } from '../../../accounts/domain';
import { ExchangeRatesService } from '../../../exchange-rates/application/exchange-rates.service';
import { SearchIndexingService } from '../../../search/application/search-indexing.service';
import { Transaction } from '../../domain';
import { TransactionIdempotencyService } from './transaction-idempotency.service';
import type { DepositTransactionInput } from '../inputs/deposit-transaction.input';
import type { TransferTransactionInput } from '../inputs/transfer-transaction.input';
import type { WithdrawTransactionInput } from '../inputs/withdraw-transaction.input';

@Injectable()
export class TransactionWriteService {
  constructor(
    private readonly transactionIdempotencyService: TransactionIdempotencyService,
    private readonly redisCacheService: RedisCacheService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly searchIndexingService: SearchIndexingService,
    private readonly appLogger: AppLogger,
  ) {}

  async deposit(data: DepositTransactionInput): Promise<Transaction> {
    this.appLogger.log('transaction.deposit.started', {
      accountId: data.accountId,
      amount: formatMoney(data.amount),
      idempotencyKey: data.idempotencyKey ?? null,
    });
    let affectedClientIds: string[] = [];
    let affectedAccounts: Account[] = [];
    let didMutate = false;

    try {
      const transaction =
        await this.transactionIdempotencyService.executeIdempotentTransaction(
        {
          operationName: 'deposit',
          lockAccountIds: [data.accountId],
          type: TransactionType.DEPOSIT,
          idempotencyKey: data.idempotencyKey,
        },
        async ({ accountRepository, transactionRepository }) => {
          const existing =
            await this.transactionIdempotencyService.findExistingTransaction(
              transactionRepository,
              data.idempotencyKey,
              TransactionType.DEPOSIT,
            );
          if (existing) {
            this.transactionIdempotencyService.assertDepositMatches(
              existing,
              data,
            );
            return existing;
          }

          const account = await this.requireAccount(
            accountRepository,
            data.accountId,
          );
          const updatedAccount = account.deposit(data.amount);
          await accountRepository.save(updatedAccount);
          affectedClientIds = [updatedAccount.toPrimitives().clientId];
          affectedAccounts = [updatedAccount];

          const savedTransaction = await transactionRepository.save(
            this.buildDepositTransaction(updatedAccount, data),
          );
          didMutate = true;
          return savedTransaction;
        },
        (existing) =>
          this.transactionIdempotencyService.assertDepositMatches(existing, data),
      );

      if (didMutate) {
        await this.invalidateClientAccountsCaches(affectedClientIds);
        await Promise.all([
          ...affectedAccounts.map((account) =>
            this.searchIndexingService.indexAccount(account),
          ),
          this.searchIndexingService.indexTransaction(transaction),
        ]);
        this.logTransactionCompleted('transaction.deposit.completed', transaction);
      } else {
        this.logIdempotentReplay('transaction.deposit.idempotency_reused', transaction);
      }

      return transaction;
    } catch (error) {
      this.logKnownTransactionError(error, {
        transactionType: TransactionType.DEPOSIT,
        accountId: data.accountId,
        attemptedAmount: formatMoney(data.amount),
        idempotencyKey: data.idempotencyKey ?? null,
      });
      throw error;
    }
  }

  async withdraw(data: WithdrawTransactionInput): Promise<Transaction> {
    this.appLogger.log('transaction.withdraw.started', {
      accountId: data.accountId,
      amount: formatMoney(data.amount),
      idempotencyKey: data.idempotencyKey ?? null,
    });
    let affectedClientIds: string[] = [];
    let affectedAccounts: Account[] = [];
    let didMutate = false;

    try {
      const transaction =
        await this.transactionIdempotencyService.executeIdempotentTransaction(
        {
          operationName: 'withdraw',
          lockAccountIds: [data.accountId],
          type: TransactionType.WITHDRAWAL,
          idempotencyKey: data.idempotencyKey,
        },
        async ({ accountRepository, transactionRepository }) => {
          const existing =
            await this.transactionIdempotencyService.findExistingTransaction(
              transactionRepository,
              data.idempotencyKey,
              TransactionType.WITHDRAWAL,
            );
          if (existing) {
            this.transactionIdempotencyService.assertWithdrawalMatches(
              existing,
              data,
            );
            return existing;
          }

          const account = await this.requireAccount(
            accountRepository,
            data.accountId,
          );
          const updatedAccount = account.withdraw(data.amount);
          await accountRepository.save(updatedAccount);
          affectedClientIds = [updatedAccount.toPrimitives().clientId];
          affectedAccounts = [updatedAccount];

          const savedTransaction = await transactionRepository.save(
            this.buildWithdrawalTransaction(updatedAccount, data),
          );
          didMutate = true;
          return savedTransaction;
        },
        (existing) =>
          this.transactionIdempotencyService.assertWithdrawalMatches(
            existing,
            data,
          ),
      );

      if (didMutate) {
        await this.invalidateClientAccountsCaches(affectedClientIds);
        await Promise.all([
          ...affectedAccounts.map((account) =>
            this.searchIndexingService.indexAccount(account),
          ),
          this.searchIndexingService.indexTransaction(transaction),
        ]);
        this.logTransactionCompleted('transaction.withdraw.completed', transaction);
      } else {
        this.logIdempotentReplay(
          'transaction.withdraw.idempotency_reused',
          transaction,
        );
      }

      return transaction;
    } catch (error) {
      this.logKnownTransactionError(error, {
        transactionType: TransactionType.WITHDRAWAL,
        accountId: data.accountId,
        attemptedAmount: formatMoney(data.amount),
        idempotencyKey: data.idempotencyKey ?? null,
      });
      throw error;
    }
  }

  async transfer(data: TransferTransactionInput): Promise<Transaction> {
    if (data.sourceAccountId === data.destinationAccountId) {
      this.appLogger.warn('transaction.transfer.failed', {
        sourceAccountId: data.sourceAccountId,
        destinationAccountId: data.destinationAccountId,
        idempotencyKey: data.idempotencyKey ?? null,
        errorCode: 'DOMAIN_RULE_VIOLATION',
      });
      throw new DomainRuleViolationException(
        'Source and destination accounts must differ.',
      );
    }

    this.appLogger.log('transaction.transfer.started', {
      sourceAccountId: data.sourceAccountId,
      destinationAccountId: data.destinationAccountId,
      amount: formatMoney(data.amount),
      idempotencyKey: data.idempotencyKey ?? null,
    });
    let affectedClientIds: string[] = [];
    let affectedAccounts: Account[] = [];
    let didMutate = false;

    try {
      const transaction =
        await this.transactionIdempotencyService.executeIdempotentTransaction(
        {
          operationName: 'transfer',
          lockAccountIds: [data.sourceAccountId, data.destinationAccountId],
          type: TransactionType.TRANSFER,
          idempotencyKey: data.idempotencyKey,
        },
        async ({
          accountRepository,
          transactionRepository,
        }) => {
          const existing =
            await this.transactionIdempotencyService.findExistingTransaction(
              transactionRepository,
              data.idempotencyKey,
              TransactionType.TRANSFER,
            );
          if (existing) {
            this.transactionIdempotencyService.assertTransferMatches(
              existing,
              data,
            );
            return existing;
          }

          const sourceAccount = await this.requireAccount(
            accountRepository,
            data.sourceAccountId,
          );
          const destinationAccount = await this.requireAccount(
            accountRepository,
            data.destinationAccountId,
          );

          const debitedSource = sourceAccount.withdraw(data.amount);
          const settlement = await this.resolveTransferSettlement(
            sourceAccount.toPrimitives().currency,
            destinationAccount.toPrimitives().currency,
            data.amount,
            data.idempotencyKey ?? null,
          );

          const creditedDestination = destinationAccount.deposit(
            settlement.destinationAmount,
          );
          await accountRepository.save(debitedSource);
          await accountRepository.save(creditedDestination);
          affectedClientIds = [
            sourceAccount.toPrimitives().clientId,
            destinationAccount.toPrimitives().clientId,
          ];
          affectedAccounts = [debitedSource, creditedDestination];

          const savedTransaction = await transactionRepository.save(
            this.buildTransferTransaction({
              sourceAccount: debitedSource,
              destinationAccount: creditedDestination,
              sourceCurrency: sourceAccount.toPrimitives().currency,
              destinationCurrency: destinationAccount.toPrimitives().currency,
              destinationAmount: settlement.destinationAmount,
              exchangeRateUsed: settlement.exchangeRateUsed,
              data,
            }),
          );
          didMutate = true;
          return savedTransaction;
        },
        (existing) =>
          this.transactionIdempotencyService.assertTransferMatches(existing, data),
      );

      if (didMutate) {
        await this.invalidateClientAccountsCaches(affectedClientIds);
        await Promise.all([
          ...affectedAccounts.map((account) =>
            this.searchIndexingService.indexAccount(account),
          ),
          this.searchIndexingService.indexTransaction(transaction),
        ]);
        this.logTransactionCompleted('transaction.transfer.completed', transaction);
      } else {
        this.logIdempotentReplay(
          'transaction.transfer.idempotency_reused',
          transaction,
        );
      }

      return transaction;
    } catch (error) {
      this.logKnownTransactionError(error, {
        transactionType: TransactionType.TRANSFER,
        sourceAccountId: data.sourceAccountId,
        destinationAccountId: data.destinationAccountId,
        attemptedAmount: formatMoney(data.amount),
        idempotencyKey: data.idempotencyKey ?? null,
      });
      throw error;
    }
  }

  private buildDepositTransaction(
    account: Account,
    data: DepositTransactionInput,
  ): Transaction {
    return new Transaction({
      id: randomUUID(),
      type: TransactionType.DEPOSIT,
      sourceAccountId: null,
      destinationAccountId: account.id,
      sourceCurrency: account.toPrimitives().currency,
      destinationCurrency: account.toPrimitives().currency,
      sourceAmount: formatMoney(data.amount),
      destinationAmount: formatMoney(data.amount),
      exchangeRateUsed: null,
      idempotencyKey: data.idempotencyKey ?? null,
      description: this.transactionIdempotencyService.normalizeDescription(
        data.description,
      ),
      createdAt: new Date(),
    });
  }

  private buildWithdrawalTransaction(
    account: Account,
    data: WithdrawTransactionInput,
  ): Transaction {
    return new Transaction({
      id: randomUUID(),
      type: TransactionType.WITHDRAWAL,
      sourceAccountId: account.id,
      destinationAccountId: null,
      sourceCurrency: account.toPrimitives().currency,
      destinationCurrency: null,
      sourceAmount: formatMoney(data.amount),
      destinationAmount: null,
      exchangeRateUsed: null,
      idempotencyKey: data.idempotencyKey ?? null,
      description: this.transactionIdempotencyService.normalizeDescription(
        data.description,
      ),
      createdAt: new Date(),
    });
  }

  private buildTransferTransaction(options: {
    sourceAccount: Account;
    destinationAccount: Account;
    sourceCurrency: Currency;
    destinationCurrency: Currency;
    destinationAmount: string;
    exchangeRateUsed: string | null;
    data: TransferTransactionInput;
  }): Transaction {
    return new Transaction({
      id: randomUUID(),
      type: TransactionType.TRANSFER,
      sourceAccountId: options.sourceAccount.id,
      destinationAccountId: options.destinationAccount.id,
      sourceCurrency: options.sourceCurrency,
      destinationCurrency: options.destinationCurrency,
      sourceAmount: formatMoney(options.data.amount),
      destinationAmount: options.destinationAmount,
      exchangeRateUsed: options.exchangeRateUsed,
      idempotencyKey: options.data.idempotencyKey ?? null,
      description: this.transactionIdempotencyService.normalizeDescription(
        options.data.description,
      ),
      createdAt: new Date(),
    });
  }

  private async requireAccount(
    accountRepository: AccountRepository,
    id: string,
  ) {
    const account = await accountRepository.findById(id);
    if (!account) {
      throw new ResourceNotFoundException(`Account ${id} not found.`);
    }

    return account;
  }

  private async resolveTransferSettlement(
    sourceCurrency: Currency,
    destinationCurrency: Currency,
    amount: string,
    idempotencyKey: string | null,
  ): Promise<{
    destinationAmount: string;
    exchangeRateUsed: string | null;
  }> {
    if (sourceCurrency === destinationCurrency) {
      return {
        destinationAmount: formatMoney(amount),
        exchangeRateUsed: null,
      };
    }

    let exchangeRate;
    try {
      exchangeRate = await this.exchangeRatesService.findCurrent(
        sourceCurrency,
        destinationCurrency,
      );
    } catch (error) {
      if (error instanceof ExchangeRateNotConfiguredException) {
        this.appLogger.warn('transaction.transfer.failed', {
          sourceCurrency,
          destinationCurrency,
          idempotencyKey,
          errorCode: getExceptionCode(error),
        });
      }
      throw error;
    }

    return {
      destinationAmount: formatMoney(
        roundMoney(toDecimal(amount).mul(exchangeRate.rate)),
      ),
      exchangeRateUsed: formatRate(exchangeRate.rate),
    };
  }

  private async invalidateClientAccountsCaches(
    clientIds: string[],
  ): Promise<void> {
    await this.redisCacheService.delMany(
      [...new Set(clientIds)].map((clientId) =>
        RedisCacheKeys.clientAccounts(clientId),
      ),
    );
  }

  private logTransactionCompleted(event: string, transaction: Transaction): void {
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

  private logIdempotentReplay(event: string, transaction: Transaction): void {
    const data = transaction.toPrimitives();
    this.appLogger.warn(event, {
      transactionId: data.id,
      transactionType: data.type,
      sourceAccountId: data.sourceAccountId,
      destinationAccountId: data.destinationAccountId,
      idempotencyKey: data.idempotencyKey,
    });
  }

  private logKnownTransactionError(
    error: unknown,
    data: Record<string, unknown>,
  ): void {
    const eventPrefix = this.getEventPrefix(data['transactionType']);

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

  private getEventPrefix(transactionType: unknown): string {
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
}
