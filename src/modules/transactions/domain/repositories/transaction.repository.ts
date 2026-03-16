import type { TransactionType } from '../../../../common/domain/enums';
import type { Transaction } from '../entities/transaction.entity';
import type { TransactionSearchFilters } from '../types/transaction-search-filters';

export interface TransactionRepository {
  save(transaction: Transaction): Promise<Transaction>;
  findAll(): Promise<Transaction[]>;
  findById(id: string): Promise<Transaction | null>;
  findByIdempotencyKey(
    idempotencyKey: string,
    type: TransactionType,
  ): Promise<Transaction | null>;
  search(filters: TransactionSearchFilters): Promise<Transaction[]>;
}
