import { Module } from '@nestjs/common';
import { EXCHANGE_RATE_REPOSITORY } from '../../common/infrastructure/repository.tokens';
import { ExchangeRatesService } from './application/exchange-rates.service';
import { TypeOrmExchangeRateRepository } from './infrastructure';
import { ExchangeRatesResolver } from './presentation';

@Module({
  providers: [
    TypeOrmExchangeRateRepository,
    ExchangeRatesService,
    ExchangeRatesResolver,
    {
      provide: EXCHANGE_RATE_REPOSITORY,
      useExisting: TypeOrmExchangeRateRepository,
    },
  ],
  exports: [
    ExchangeRatesService,
    EXCHANGE_RATE_REPOSITORY,
    TypeOrmExchangeRateRepository,
  ],
})
export class ExchangeRatesModule {}
