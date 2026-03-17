import { Module } from '@nestjs/common';
import {
  FINANCIAL_TRANSACTION_MANAGER,
  TRANSACTION_REPOSITORY,
} from '../../common/infrastructure/repository.tokens';
import { AccountsModule } from '../accounts/accounts.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { TransactionIdempotencyService } from './application/services/transaction-idempotency.service';
import { TransactionReadService } from './application/services/transaction-read.service';
import { TransactionWriteService } from './application/services/transaction-write.service';
import { TransactionsService } from './application/services/transactions.service';
import { TransactionIdempotencyValidator } from './application/validators/transaction-idempotency.validator';
import { TypeOrmFinancialTransactionManager } from './infrastructure/transaction-management/typeorm-financial-transaction.manager';
import { TypeOrmTransactionRepository } from './infrastructure';
import { TransactionsResolver } from './presentation';

@Module({
  imports: [AccountsModule, ExchangeRatesModule],
  providers: [
    TypeOrmTransactionRepository,
    TransactionIdempotencyValidator,
    TransactionIdempotencyService,
    TransactionReadService,
    TransactionWriteService,
    TransactionsService,
    TransactionsResolver,
    {
      provide: TRANSACTION_REPOSITORY,
      useExisting: TypeOrmTransactionRepository,
    },
    {
      provide: FINANCIAL_TRANSACTION_MANAGER,
      useClass: TypeOrmFinancialTransactionManager,
    },
  ],
  exports: [TransactionsService, TRANSACTION_REPOSITORY],
})
export class TransactionsModule {}
