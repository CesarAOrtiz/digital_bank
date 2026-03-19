import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { formatMoney } from '../../../../common/application/money';
import { Currency, TransactionType } from '../../../../common/domain/enums';
import { DomainRuleViolationException } from '../../../../common/domain/exceptions';
import { Account } from '../../../accounts/domain';
import { Transaction } from '../../domain';
import type { FinancialTransactionContext } from '../contracts/financial-transaction-manager.contract';
import type { TransferTransactionInput } from '../inputs/transfer-transaction.input';
import { TransactionIdempotencyService } from '../services/transaction-idempotency.service';
import { TransactionMutationSupportService } from '../services/transaction-mutation-support.service';
import { TransferSettlementService } from '../services/transfer-settlement.service';
import { buildTransferRequestFingerprint } from '../utils/transaction-request-fingerprint';

@Injectable()
export class TransferUseCase {
  constructor(
    private readonly transactionIdempotencyService: TransactionIdempotencyService,
    private readonly transferSettlementService: TransferSettlementService,
    private readonly support: TransactionMutationSupportService,
  ) {}

  async execute(data: TransferTransactionInput): Promise<Transaction> {
    if (data.sourceAccountId === data.destinationAccountId) {
      this.support.logKnownTransactionError(
        new DomainRuleViolationException(
          'Source and destination accounts must differ.',
        ),
        {
          transactionType: TransactionType.TRANSFER,
          sourceAccountId: data.sourceAccountId,
          destinationAccountId: data.destinationAccountId,
          idempotencyKey: data.idempotencyKey ?? null,
        },
      );
      throw new DomainRuleViolationException(
        'Source and destination accounts must differ.',
      );
    }

    this.support.logStarted('transaction.transfer.started', {
      sourceAccountId: data.sourceAccountId,
      destinationAccountId: data.destinationAccountId,
      amount: formatMoney(data.amount),
      idempotencyKey: data.idempotencyKey ?? null,
    });
    let affectedClientIds: string[] = [];
    let affectedAccounts: Account[] = [];
    let didMutate = false;

    try {
      const options = {
        operationName: 'transfer',
        lockAccountIds: [data.sourceAccountId, data.destinationAccountId],
        type: TransactionType.TRANSFER,
        idempotencyKey: data.idempotencyKey,
      };
      const assertMatches = (existing: Transaction) =>
        this.transactionIdempotencyService.assertTransferMatches(existing, data);
      const mutation = async ({
        accountRepository,
        transactionRepository,
      }: FinancialTransactionContext) => {
        const existing =
          await this.transactionIdempotencyService.findExistingTransaction(
            transactionRepository,
            data.idempotencyKey,
            TransactionType.TRANSFER,
          );
        if (existing) {
          assertMatches(existing);
          return existing;
        }

        const sourceAccount = await this.support.requireAccount(
          accountRepository,
          data.sourceAccountId,
        );
        const destinationAccount = await this.support.requireAccount(
          accountRepository,
          data.destinationAccountId,
        );

        const sourceCurrency = sourceAccount.toPrimitives().currency;
        const destinationCurrency = destinationAccount.toPrimitives().currency;
        const debitedSource = sourceAccount.withdraw(data.amount);
        const settlement = await this.transferSettlementService.calculate(
          sourceCurrency,
          destinationCurrency,
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
        affectedAccounts = [debitedSource, creditedDestination];

        const savedTransaction = await transactionRepository.save(
          this.buildTransferTransaction({
            sourceAccount: debitedSource,
            destinationAccount: creditedDestination,
            sourceCurrency,
            destinationCurrency,
            destinationAmount: settlement.destinationAmount,
            exchangeRateUsed: settlement.exchangeRateUsed,
            data,
          }),
        );
        didMutate = true;
        return savedTransaction;
      };

      const transaction =
        await this.transactionIdempotencyService.executeIdempotentTransaction(
          options,
          mutation,
          assertMatches,
        );

      if (didMutate) {
        await this.support.invalidateClientAccountsCaches(affectedClientIds);
        await this.support.syncMutatedResources(affectedAccounts, transaction);
        this.support.logTransactionCompleted(
          'transaction.transfer.completed',
          transaction,
        );
      } else {
        this.support.logIdempotentReplay(
          'transaction.transfer.idempotency_reused',
          transaction,
        );
      }

      return transaction;
    } catch (error) {
      this.support.logKnownTransactionError(error, {
        transactionType: TransactionType.TRANSFER,
        sourceAccountId: data.sourceAccountId,
        destinationAccountId: data.destinationAccountId,
        attemptedAmount: formatMoney(data.amount),
        idempotencyKey: data.idempotencyKey ?? null,
      });
      throw error;
    }
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
      requestFingerprint: buildTransferRequestFingerprint(options.data),
      description: this.transactionIdempotencyService.normalizeDescription(
        options.data.description,
      ),
      createdAt: new Date(),
    });
  }
}
