import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule } from './clients/clients.module';
import { AccountsModule } from './accounts/accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ExchangeRatesModule } from './exchange-rates/exchange-rates.module';

@Module({
  imports: [ClientsModule, AccountsModule, TransactionsModule, ExchangeRatesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
