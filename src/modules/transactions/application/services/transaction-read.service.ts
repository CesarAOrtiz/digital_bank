import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../../common/domain/exceptions';
import { TRANSACTION_REPOSITORY } from '../../../../common/infrastructure/repository.tokens';
import { Transaction } from '../../domain';
import type {
  TransactionRepository,
  TransactionSearchFilters,
} from '../../domain';

@Injectable()
export class TransactionReadService {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepository,
  ) {}

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
}
