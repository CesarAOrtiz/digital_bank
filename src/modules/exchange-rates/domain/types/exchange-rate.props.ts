import type { Currency } from '../../../../common/domain/enums';

export interface ExchangeRateProps {
  id: string;
  baseCurrency: Currency;
  targetCurrency: Currency;
  rate: string;
  effectiveAt: Date;
  createdAt: Date;
}
