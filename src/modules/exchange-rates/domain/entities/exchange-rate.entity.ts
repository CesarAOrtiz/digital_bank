import { Currency } from '../../../../common/domain/enums';
import type { ExchangeRateProps } from '../types/exchange-rate.props';

export class ExchangeRate {
  constructor(private readonly props: ExchangeRateProps) {}

  get id(): string {
    return this.props.id;
  }

  get baseCurrency(): Currency {
    return this.props.baseCurrency;
  }

  get targetCurrency(): Currency {
    return this.props.targetCurrency;
  }

  get rate(): string {
    return this.props.rate;
  }

  get effectiveAt(): Date {
    return this.props.effectiveAt;
  }

  toPrimitives(): ExchangeRateProps {
    return { ...this.props };
  }
}
