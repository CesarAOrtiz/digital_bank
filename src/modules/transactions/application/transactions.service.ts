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
import type { FinancialTransactionManager } from './contracts/financial-transaction-manager.contract';
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
    return this.financialTransactionManager.execute(
      {
        operationName: 'deposit',
        lockAccountIds: [data.accountId],
      },
      async ({ accountRepository, transactionRepository }) => {
        const existing = await this.findByIdempotencyKey(
          transactionRepository,
          data.idempotencyKey,
        );
        if (existing) {
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
            description: data.description?.trim() || null,
            createdAt: new Date(),
          }),
        );
      },
    );
  }

  async withdraw(data: WithdrawTransactionInput): Promise<Transaction> {
    this.logger.log(`Withdrawal requested for account ${data.accountId}`);
    return this.financialTransactionManager.execute(
      {
        operationName: 'withdraw',
        lockAccountIds: [data.accountId],
      },
      async ({ accountRepository, transactionRepository }) => {
        const existing = await this.findByIdempotencyKey(
          transactionRepository,
          data.idempotencyKey,
        );
        if (existing) {
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
            description: data.description?.trim() || null,
            createdAt: new Date(),
          }),
        );
      },
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

    return this.financialTransactionManager.execute(
      {
        operationName: 'transfer',
        lockAccountIds: [data.sourceAccountId, data.destinationAccountId],
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
            description: data.description?.trim() || null,
            createdAt: new Date(),
          }),
        );
      },
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
}
