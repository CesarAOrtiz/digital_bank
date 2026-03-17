import { Injectable } from '@nestjs/common';
import { Transaction } from '../../domain';
import type { TransactionSearchFilters } from '../../domain';
import type { DepositTransactionInput } from '../inputs/deposit-transaction.input';
import type { TransferTransactionInput } from '../inputs/transfer-transaction.input';
import type { WithdrawTransactionInput } from '../inputs/withdraw-transaction.input';
import { TransactionReadService } from './transaction-read.service';
import { TransactionWriteService } from './transaction-write.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactionWriteService: TransactionWriteService,
    private readonly transactionReadService: TransactionReadService,
  ) {}

  deposit(data: DepositTransactionInput): Promise<Transaction> {
    return this.transactionWriteService.deposit(data);
  }

  withdraw(data: WithdrawTransactionInput): Promise<Transaction> {
    return this.transactionWriteService.withdraw(data);
  }

  transfer(data: TransferTransactionInput): Promise<Transaction> {
    return this.transactionWriteService.transfer(data);
  }

  findAll(): Promise<Transaction[]> {
    return this.transactionReadService.findAll();
  }

  search(filters: TransactionSearchFilters): Promise<Transaction[]> {
    return this.transactionReadService.search(filters);
  }

  findOne(id: string): Promise<Transaction> {
    return this.transactionReadService.findOne(id);
  }
}
