import { Currency } from '../../../../common/domain/enums';
import type { ExchangeRate } from '../entities/exchange-rate.entity';

export interface ExchangeRateRepository {
  save(exchangeRate: ExchangeRate): Promise<ExchangeRate>;
  findAll(): Promise<ExchangeRate[]>;
  findLatest(baseCurrency: Currency, targetCurrency: Currency, effectiveAt: Date): Promise<ExchangeRate | null>;
}
