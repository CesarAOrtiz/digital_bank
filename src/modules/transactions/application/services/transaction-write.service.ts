import { Injectable } from '@nestjs/common';
import { Transaction } from '../../domain';
import type { DepositTransactionInput } from '../inputs/deposit-transaction.input';
import type { TransferTransactionInput } from '../inputs/transfer-transaction.input';
import type { WithdrawTransactionInput } from '../inputs/withdraw-transaction.input';
import { DepositUseCase } from './deposit.use-case';
import { TransferUseCase } from './transfer.use-case';
import { WithdrawUseCase } from './withdraw.use-case';

@Injectable()
export class TransactionWriteService {
  constructor(
    private readonly depositUseCase: DepositUseCase,
    private readonly withdrawUseCase: WithdrawUseCase,
    private readonly transferUseCase: TransferUseCase,
  ) {}

  deposit(data: DepositTransactionInput): Promise<Transaction> {
    return this.depositUseCase.execute(data);
  }

  withdraw(data: WithdrawTransactionInput): Promise<Transaction> {
    return this.withdrawUseCase.execute(data);
  }

  transfer(data: TransferTransactionInput): Promise<Transaction> {
    return this.transferUseCase.execute(data);
  }
}
