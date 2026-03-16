import type { Currency } from '../../../../common/domain/enums';

export interface CreateExchangeRateInput {
  baseCurrency: Currency;
  targetCurrency: Currency;
  rate: string;
  effectiveAt: Date;
}
