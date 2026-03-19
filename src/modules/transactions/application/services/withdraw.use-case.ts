import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { formatMoney } from '../../../../common/application/money';
import { TransactionType } from '../../../../common/domain/enums';
import { Account } from '../../../accounts/domain';
import { Transaction } from '../../domain';
import type { WithdrawTransactionInput } from '../inputs/withdraw-transaction.input';
import { TransactionIdempotencyService } from './transaction-idempotency.service';
import { TransactionMutationSupportService } from './transaction-mutation-support.service';

@Injectable()
export class WithdrawUseCase {
  constructor(
    private readonly transactionIdempotencyService: TransactionIdempotencyService,
    private readonly support: TransactionMutationSupportService,
  ) {}

  async execute(data: WithdrawTransactionInput): Promise<Transaction> {
    this.support.logStarted('transaction.withdraw.started', {
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

            const account = await this.support.requireAccount(
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
        await this.support.invalidateClientAccountsCaches(affectedClientIds);
        await this.support.syncMutatedResources(affectedAccounts, transaction);
        this.support.logTransactionCompleted(
          'transaction.withdraw.completed',
          transaction,
        );
      } else {
        this.support.logIdempotentReplay(
          'transaction.withdraw.idempotency_reused',
          transaction,
        );
      }

      return transaction;
    } catch (error) {
      this.support.logKnownTransactionError(error, {
        transactionType: TransactionType.WITHDRAWAL,
        accountId: data.accountId,
        attemptedAmount: formatMoney(data.amount),
        idempotencyKey: data.idempotencyKey ?? null,
      });
      throw error;
    }
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
}
