import { Injectable } from '@nestjs/common';
import {
  formatMoney,
  formatRate,
  roundMoney,
  toDecimal,
} from '../../../../common/application/money';
import { Currency } from '../../../../common/domain/enums';
import { ExchangeRatesService } from '../../../exchange-rates/application/exchange-rates.service';

export interface TransferSettlement {
  destinationAmount: string;
  exchangeRateUsed: string | null;
}

@Injectable()
export class TransferSettlementService {
  constructor(
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async calculate(
    sourceCurrency: Currency,
    destinationCurrency: Currency,
    amount: string,
  ): Promise<TransferSettlement> {
    if (sourceCurrency === destinationCurrency) {
      return {
        destinationAmount: formatMoney(amount),
        exchangeRateUsed: null,
      };
    }

    const exchangeRate = await this.exchangeRatesService.findCurrent(
      sourceCurrency,
      destinationCurrency,
    );

    return {
      destinationAmount: formatMoney(
        roundMoney(toDecimal(amount).mul(exchangeRate.rate)),
      ),
      exchangeRateUsed: formatRate(exchangeRate.rate),
    };
  }
}
