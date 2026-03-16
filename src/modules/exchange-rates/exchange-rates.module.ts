import { Module } from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';
import { ExchangeRatesResolver } from './exchange-rates.resolver';

@Module({
  providers: [ExchangeRatesResolver, ExchangeRatesService],
})
export class ExchangeRatesModule {}
