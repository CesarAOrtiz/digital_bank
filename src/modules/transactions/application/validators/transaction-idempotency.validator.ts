import { Injectable } from '@nestjs/common';
import { formatMoney } from '../../../../common/application/money';
import { TransactionType } from '../../../../common/domain/enums';
import { IdempotencyKeyReuseException } from '../../../../common/domain/exceptions';
import { Transaction } from '../../domain';
import type { DepositTransactionInput } from '../inputs/deposit-transaction.input';
import type { TransferTransactionInput } from '../inputs/transfer-transaction.input';
import type { WithdrawTransactionInput } from '../inputs/withdraw-transaction.input';

@Injectable()
export class TransactionIdempotencyValidator {
  assertDepositMatches(
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

  assertWithdrawalMatches(
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

  assertTransferMatches(
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

  normalizeDescription(description?: string | null): string | null {
    return description?.trim() || null;
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
}
