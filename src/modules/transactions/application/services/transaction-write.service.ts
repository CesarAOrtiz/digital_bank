import { Injectable, Logger } from '@nestjs/common';
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
  ResourceNotFoundException,
} from '../../../../common/domain/exceptions';
import {
  RedisCacheKeys,
} from '../../../../common/infrastructure/redis/redis-cache.keys';
import { RedisCacheService } from '../../../../common/infrastructure/redis/redis-cache.service';
import { Account } from '../../../accounts/domain';
import type { AccountRepository } from '../../../accounts/domain';
import type { ExchangeRateRepository } from '../../../exchange-rates/domain';
import { Transaction } from '../../domain';
import { TransactionIdempotencyService } from './transaction-idempotency.service';
import type { DepositTransactionInput } from '../inputs/deposit-transaction.input';
import type { TransferTransactionInput } from '../inputs/transfer-transaction.input';
import type { WithdrawTransactionInput } from '../inputs/withdraw-transaction.input';

@Injectable()
export class TransactionWriteService {
  private readonly logger = new Logger(TransactionWriteService.name);

  constructor(
    private readonly transactionIdempotencyService: TransactionIdempotencyService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async deposit(data: DepositTransactionInput): Promise<Transaction> {
    this.logger.log(`Deposit requested for account ${data.accountId}`);
    let affectedClientIds: string[] = [];
    let didMutate = false;

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
    }

    return transaction;
  }

  async withdraw(data: WithdrawTransactionInput): Promise<Transaction> {
    this.logger.log(`Withdrawal requested for account ${data.accountId}`);
    let affectedClientIds: string[] = [];
    let didMutate = false;

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
    }

    return transaction;
  }

  async transfer(data: TransferTransactionInput): Promise<Transaction> {
    if (data.sourceAccountId === data.destinationAccountId) {
      throw new DomainRuleViolationException(
        'Source and destination accounts must differ.',
      );
    }

    this.logger.log(
      `Transfer requested from ${data.sourceAccountId} to ${data.destinationAccountId}`,
    );
    let affectedClientIds: string[] = [];
    let didMutate = false;

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
        exchangeRateRepository,
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
          exchangeRateRepository,
          sourceAccount.toPrimitives().currency,
          destinationAccount.toPrimitives().currency,
          data.amount,
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
    }

    return transaction;
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
    exchangeRateRepository: ExchangeRateRepository,
    sourceCurrency: Currency,
    destinationCurrency: Currency,
    amount: string,
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

    const exchangeRate = await exchangeRateRepository.findLatest(
      sourceCurrency,
      destinationCurrency,
      new Date(),
    );
    if (!exchangeRate) {
      throw new ExchangeRateNotConfiguredException(
        sourceCurrency,
        destinationCurrency,
      );
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
}
