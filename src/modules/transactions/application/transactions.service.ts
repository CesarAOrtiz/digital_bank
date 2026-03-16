import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  formatMoney,
  formatRate,
  roundMoney,
  toDecimal,
} from '../../../common/application/money';
import { TransactionType } from '../../../common/domain/enums';
import {
  DomainRuleViolationException,
  ExchangeRateNotConfiguredException,
  IdempotencyKeyReuseException,
  ResourceNotFoundException,
} from '../../../common/domain/exceptions';
import {
  FINANCIAL_TRANSACTION_MANAGER,
  TRANSACTION_REPOSITORY,
} from '../../../common/infrastructure/repository.tokens';
import type { AccountRepository } from '../../accounts/domain';
import { Transaction } from '../domain';
import type {
  TransactionRepository,
  TransactionSearchFilters,
} from '../domain';
import type {
  FinancialTransactionContext,
  FinancialTransactionManager,
} from './contracts/financial-transaction-manager.contract';
import type { DepositTransactionInput } from './inputs/deposit-transaction.input';
import type { TransferTransactionInput } from './inputs/transfer-transaction.input';
import type { WithdrawTransactionInput } from './inputs/withdraw-transaction.input';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepository,
    @Inject(FINANCIAL_TRANSACTION_MANAGER)
    private readonly financialTransactionManager: FinancialTransactionManager,
  ) {}

  async deposit(data: DepositTransactionInput): Promise<Transaction> {
    this.logger.log(`Deposit requested for account ${data.accountId}`);
    return this.executeIdempotentTransaction(
      {
        operationName: 'deposit',
        lockAccountIds: [data.accountId],
        idempotencyKey: data.idempotencyKey,
      },
      async ({ accountRepository, transactionRepository }) => {
        const existing = await this.findByIdempotencyKey(
          transactionRepository,
          data.idempotencyKey,
        );
        if (existing) {
          this.assertDepositMatches(existing, data);
          return existing;
        }

        const account = await this.requireAccount(
          accountRepository,
          data.accountId,
        );
        const updatedAccount = account.deposit(data.amount);
        await accountRepository.save(updatedAccount);

        return transactionRepository.save(
          new Transaction({
            id: randomUUID(),
            type: TransactionType.DEPOSIT,
            sourceAccountId: null,
            destinationAccountId: updatedAccount.id,
            sourceCurrency: updatedAccount.toPrimitives().currency,
            destinationCurrency: updatedAccount.toPrimitives().currency,
            sourceAmount: formatMoney(data.amount),
            destinationAmount: formatMoney(data.amount),
            exchangeRateUsed: null,
            idempotencyKey: data.idempotencyKey ?? null,
            description: this.normalizeDescription(data.description),
            createdAt: new Date(),
          }),
        );
      },
      (existing) => this.assertDepositMatches(existing, data),
    );
  }

  async withdraw(data: WithdrawTransactionInput): Promise<Transaction> {
    this.logger.log(`Withdrawal requested for account ${data.accountId}`);
    return this.executeIdempotentTransaction(
      {
        operationName: 'withdraw',
        lockAccountIds: [data.accountId],
        idempotencyKey: data.idempotencyKey,
      },
      async ({ accountRepository, transactionRepository }) => {
        const existing = await this.findByIdempotencyKey(
          transactionRepository,
          data.idempotencyKey,
        );
        if (existing) {
          this.assertWithdrawalMatches(existing, data);
          return existing;
        }

        const account = await this.requireAccount(
          accountRepository,
          data.accountId,
        );
        const updatedAccount = account.withdraw(data.amount);
        await accountRepository.save(updatedAccount);

        return transactionRepository.save(
          new Transaction({
            id: randomUUID(),
            type: TransactionType.WITHDRAWAL,
            sourceAccountId: updatedAccount.id,
            destinationAccountId: null,
            sourceCurrency: updatedAccount.toPrimitives().currency,
            destinationCurrency: null,
            sourceAmount: formatMoney(data.amount),
            destinationAmount: null,
            exchangeRateUsed: null,
            idempotencyKey: data.idempotencyKey ?? null,
            description: this.normalizeDescription(data.description),
            createdAt: new Date(),
          }),
        );
      },
      (existing) => this.assertWithdrawalMatches(existing, data),
    );
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

    return this.executeIdempotentTransaction(
      {
        operationName: 'transfer',
        lockAccountIds: [data.sourceAccountId, data.destinationAccountId],
        idempotencyKey: data.idempotencyKey,
      },
      async ({
        accountRepository,
        exchangeRateRepository,
        transactionRepository,
      }) => {
        const existing = await this.findByIdempotencyKey(
          transactionRepository,
          data.idempotencyKey,
        );
        if (existing) {
          this.assertTransferMatches(existing, data);
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
        let destinationAmount = formatMoney(data.amount);
        let exchangeRateUsed: string | null = null;

        if (
          sourceAccount.toPrimitives().currency !==
          destinationAccount.toPrimitives().currency
        ) {
          const exchangeRate = await exchangeRateRepository.findLatest(
            sourceAccount.toPrimitives().currency,
            destinationAccount.toPrimitives().currency,
            new Date(),
          );

          if (!exchangeRate) {
            throw new ExchangeRateNotConfiguredException(
              sourceAccount.toPrimitives().currency,
              destinationAccount.toPrimitives().currency,
            );
          }

          destinationAmount = formatMoney(
            roundMoney(toDecimal(data.amount).mul(exchangeRate.rate)),
          );
          exchangeRateUsed = formatRate(exchangeRate.rate);
        }

        const creditedDestination =
          destinationAccount.deposit(destinationAmount);
        await accountRepository.save(debitedSource);
        await accountRepository.save(creditedDestination);

        return transactionRepository.save(
          new Transaction({
            id: randomUUID(),
            type: TransactionType.TRANSFER,
            sourceAccountId: debitedSource.id,
            destinationAccountId: creditedDestination.id,
            sourceCurrency: sourceAccount.toPrimitives().currency,
            destinationCurrency: destinationAccount.toPrimitives().currency,
            sourceAmount: formatMoney(data.amount),
            destinationAmount,
            exchangeRateUsed,
            idempotencyKey: data.idempotencyKey ?? null,
            description: this.normalizeDescription(data.description),
            createdAt: new Date(),
          }),
        );
      },
      (existing) => this.assertTransferMatches(existing, data),
    );
  }

  findAll(): Promise<Transaction[]> {
    return this.transactionRepository.findAll();
  }

  search(filters: TransactionSearchFilters): Promise<Transaction[]> {
    return this.transactionRepository.search(filters);
  }

  async findOne(id: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findById(id);
    if (!transaction) {
      throw new ResourceNotFoundException(`Transaction ${id} not found.`);
    }

    return transaction;
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

  private async findByIdempotencyKey(
    transactionRepository: TransactionRepository,
    idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      return null;
    }

    return transactionRepository.findByIdempotencyKey(idempotencyKey);
  }

  private async executeIdempotentTransaction(
    options: {
      operationName: string;
      lockAccountIds: string[];
      idempotencyKey?: string;
    },
    execute: (context: FinancialTransactionContext) => Promise<Transaction>,
    assertMatches: (existing: Transaction) => void,
  ): Promise<Transaction> {
    try {
      return await this.financialTransactionManager.execute(
        {
          operationName: options.operationName,
          lockAccountIds: options.lockAccountIds,
        },
        execute,
      );
    } catch (error) {
      if (!this.isIdempotencyRace(error, options.idempotencyKey)) {
        throw error;
      }

      const existing = await this.transactionRepository.findByIdempotencyKey(
        options.idempotencyKey!,
      );
      if (!existing) {
        throw error;
      }

      assertMatches(existing);
      return existing;
    }
  }

  private assertDepositMatches(
    transaction: Transaction,
    data: DepositTransactionInput,
  ): void {
    this.assertSingleAccountTransactionMatches(transaction, {
      type: TransactionType.DEPOSIT,
      accountId: data.accountId,
      amount: data.amount,
      description: data.description,
      accountSide: 'destination',
    });
  }

  private assertWithdrawalMatches(
    transaction: Transaction,
    data: WithdrawTransactionInput,
  ): void {
    this.assertSingleAccountTransactionMatches(transaction, {
      type: TransactionType.WITHDRAWAL,
      accountId: data.accountId,
      amount: data.amount,
      description: data.description,
      accountSide: 'source',
    });
  }

  private assertSingleAccountTransactionMatches(
    transaction: Transaction,
    options: {
      type: TransactionType.DEPOSIT | TransactionType.WITHDRAWAL;
      accountId: string;
      amount: string;
      description?: string | null;
      accountSide: 'source' | 'destination';
    },
  ): void {
    const existing = transaction.toPrimitives();
    const normalizedAmount = formatMoney(options.amount);
    const normalizedDescription = this.normalizeDescription(
      options.description,
    );

    const expectedSourceAccountId =
      options.accountSide === 'source' ? options.accountId : null;
    const expectedDestinationAccountId =
      options.accountSide === 'destination' ? options.accountId : null;
    const expectedDestinationAmount =
      options.accountSide === 'destination' ? normalizedAmount : null;

    if (
      existing.type !== options.type ||
      existing.sourceAccountId !== expectedSourceAccountId ||
      existing.destinationAccountId !== expectedDestinationAccountId ||
      existing.sourceAmount !== normalizedAmount ||
      existing.destinationAmount !== expectedDestinationAmount ||
      existing.description !== normalizedDescription
    ) {
      throw new IdempotencyKeyReuseException();
    }
  }

  private assertTransferMatches(
    transaction: Transaction,
    data: TransferTransactionInput,
  ): void {
    const existing = transaction.toPrimitives();
    if (
      existing.type !== TransactionType.TRANSFER ||
      existing.sourceAccountId !== data.sourceAccountId ||
      existing.destinationAccountId !== data.destinationAccountId ||
      existing.sourceAmount !== formatMoney(data.amount) ||
      existing.description !== this.normalizeDescription(data.description)
    ) {
      throw new IdempotencyKeyReuseException();
    }
  }

  private isIdempotencyRace(error: unknown, idempotencyKey?: string): boolean {
    if (!idempotencyKey || typeof error !== 'object' || !error) {
      return false;
    }

    const driverError = (
      error as { driverError?: { code?: string; detail?: string } }
    ).driverError;
    const message = error instanceof Error ? error.message : '';

    return (
      driverError?.code === '23505' &&
      (driverError.detail?.includes('idempotencyKey') ||
        message.includes('idempotencyKey'))
    );
  }

  private normalizeDescription(description?: string | null): string | null {
    return description?.trim() || null;
  }
}
