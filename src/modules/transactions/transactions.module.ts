import { Module } from '@nestjs/common';
import {
  FINANCIAL_TRANSACTION_MANAGER,
  TRANSACTION_REPOSITORY,
} from '../../common/infrastructure/repository.tokens';
import { AccountsModule } from '../accounts/accounts.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { TransactionsService } from './application/transactions.service';
import { TypeOrmFinancialTransactionManager } from './infrastructure/transaction-management/typeorm-financial-transaction.manager';
import { TypeOrmTransactionRepository } from './infrastructure';
import { TransactionsResolver } from './presentation';

@Module({
  imports: [AccountsModule, ExchangeRatesModule],
  providers: [
    TypeOrmTransactionRepository,
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
