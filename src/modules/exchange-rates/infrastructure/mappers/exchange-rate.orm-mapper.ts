import { ExchangeRate } from '../../domain';
import { ExchangeRateOrmEntity } from '../entities/exchange-rate.orm-entity';

export class ExchangeRateOrmMapper {
  static toDomain(entity: ExchangeRateOrmEntity): ExchangeRate {
    return new ExchangeRate({ ...entity });
  }

  static toOrm(exchangeRate: ExchangeRate): ExchangeRateOrmEntity {
    return Object.assign(new ExchangeRateOrmEntity(), exchangeRate.toPrimitives());
  }
}
