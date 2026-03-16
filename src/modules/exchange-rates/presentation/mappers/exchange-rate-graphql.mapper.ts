import { ExchangeRate } from '../../domain';
import { ExchangeRateGraphqlModel } from '../models/exchange-rate.model';

export class ExchangeRateGraphqlMapper {
  static toModel(exchangeRate: ExchangeRate): ExchangeRateGraphqlModel {
    return Object.assign(new ExchangeRateGraphqlModel(), exchangeRate.toPrimitives());
  }
}
