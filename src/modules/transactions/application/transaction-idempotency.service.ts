import { Inject, Injectable } from '@nestjs/common';
import { TransactionType } from '../../../common/domain/enums';
import {
  FINANCIAL_TRANSACTION_MANAGER,
  TRANSACTION_REPOSITORY,
} from '../../../common/infrastructure/repository.tokens';
import { Transaction } from '../domain';
import type { TransactionRepository } from '../domain';
import type {
  FinancialTransactionContext,
  FinancialTransactionManager,
} from './contracts/financial-transaction-manager.contract';
import type { DepositTransactionInput } from './inputs/deposit-transaction.input';
import type { TransferTransactionInput } from './inputs/transfer-transaction.input';
import type { WithdrawTransactionInput } from './inputs/withdraw-transaction.input';
import { TransactionIdempotencyValidator } from './validators/transaction-idempotency.validator';

interface IdempotentTransactionOptions {
  operationName: string;
  lockAccountIds: string[];
  type: TransactionType;
  idempotencyKey?: string;
}

@Injectable()
export class TransactionIdempotencyService {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepository,
    @Inject(FINANCIAL_TRANSACTION_MANAGER)
    private readonly financialTransactionManager: FinancialTransactionManager,
    private readonly validator: TransactionIdempotencyValidator,
  ) {}

  async findExistingTransaction(
    transactionRepository: TransactionRepository,
    idempotencyKey?: string,
    type?: TransactionType,
  ): Promise<Transaction | null> {
    if (!idempotencyKey || !type) {
      return null;
    }

    return transactionRepository.findByIdempotencyKey(idempotencyKey, type);
  }

  async executeIdempotentTransaction(
    options: IdempotentTransactionOptions,
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
        options.type,
      );
      if (!existing) {
        throw error;
      }

      assertMatches(existing);
      return existing;
    }
  }

  assertDepositMatches(
    transaction: Transaction,
    data: DepositTransactionInput,
  ): void {
    this.validator.assertDepositMatches(transaction, data);
  }

  assertWithdrawalMatches(
    transaction: Transaction,
    data: WithdrawTransactionInput,
  ): void {
    this.validator.assertWithdrawalMatches(transaction, data);
  }

  assertTransferMatches(
    transaction: Transaction,
    data: TransferTransactionInput,
  ): void {
    this.validator.assertTransferMatches(transaction, data);
  }

  normalizeDescription(description?: string | null): string | null {
    return this.validator.normalizeDescription(description);
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
}
