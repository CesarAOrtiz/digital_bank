import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { formatMoney } from '../../../../common/application/money';
import { TransactionType } from '../../../../common/domain/enums';
import { Account } from '../../../accounts/domain';
import { Transaction } from '../../domain';
import type { DepositTransactionInput } from '../inputs/deposit-transaction.input';
import { TransactionIdempotencyService } from './transaction-idempotency.service';
import { TransactionMutationSupportService } from './transaction-mutation-support.service';

@Injectable()
export class DepositUseCase {
  constructor(
    private readonly transactionIdempotencyService: TransactionIdempotencyService,
    private readonly support: TransactionMutationSupportService,
  ) {}

  async execute(data: DepositTransactionInput): Promise<Transaction> {
    this.support.logStarted('transaction.deposit.started', {
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

            const account = await this.support.requireAccount(
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
        await this.support.invalidateClientAccountsCaches(affectedClientIds);
        await this.support.syncMutatedResources(affectedAccounts, transaction);
        this.support.logTransactionCompleted(
          'transaction.deposit.completed',
          transaction,
        );
      } else {
        this.support.logIdempotentReplay(
          'transaction.deposit.idempotency_reused',
          transaction,
        );
      }

      return transaction;
    } catch (error) {
      this.support.logKnownTransactionError(error, {
        transactionType: TransactionType.DEPOSIT,
        accountId: data.accountId,
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
}
