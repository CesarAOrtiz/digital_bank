import type { AccountRepository } from '../../../accounts/domain';
import type { ExchangeRateRepository } from '../../../exchange-rates/domain';
import type { TransactionRepository } from '../../domain';

export interface FinancialTransactionContext {
  accountRepository: AccountRepository;
  exchangeRateRepository: ExchangeRateRepository;
  transactionRepository: TransactionRepository;
}

export interface FinancialTransactionOptions {
  operationName: string;
  lockAccountIds?: string[];
}

export interface FinancialTransactionManager {
  execute<T>(
    options: FinancialTransactionOptions,
    callback: (context: FinancialTransactionContext) => Promise<T>,
  ): Promise<T>;
}
