import { Currency } from '../../../../common/domain/enums';
import { ExchangeRateNotConfiguredException } from '../../../../common/domain/exceptions';
import { ExchangeRate } from '../../../exchange-rates/domain';
import { ExchangeRatesService } from '../../../exchange-rates/application/exchange-rates.service';
import { TransferSettlementService } from './transfer-settlement.service';

describe('TransferSettlementService', () => {
  function buildExchangeRate() {
    return new ExchangeRate({
      id: 'fx-1',
      baseCurrency: Currency.USD,
      targetCurrency: Currency.DOP,
      rate: '60.500000',
      effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  }

  function createSut() {
    const exchangeRatesService = {
      findCurrent: jest.fn().mockResolvedValue(buildExchangeRate()),
    } as unknown as jest.Mocked<ExchangeRatesService>;

    return {
      service: new TransferSettlementService(exchangeRatesService),
      exchangeRatesService,
    };
  }

  it('no consulta tasa cuando la transferencia es en la misma moneda', async () => {
    const { service, exchangeRatesService } = createSut();

    const result = await service.calculate(Currency.USD, Currency.USD, '30');

    expect(result).toEqual({
      destinationAmount: '30.00',
      exchangeRateUsed: null,
    });
    expect(exchangeRatesService.findCurrent).not.toHaveBeenCalled();
  });

  it('calcula destinationAmount y exchangeRateUsed cuando la transferencia es multi-moneda', async () => {
    const { service, exchangeRatesService } = createSut();

    const result = await service.calculate(Currency.USD, Currency.DOP, '10');

    expect(result).toEqual({
      destinationAmount: '605.00',
      exchangeRateUsed: '60.500000',
    });
    expect(exchangeRatesService.findCurrent).toHaveBeenCalledWith(
      Currency.USD,
      Currency.DOP,
    );
  });

  it('propaga un error explícito cuando no existe tasa configurada', async () => {
    const { service, exchangeRatesService } = createSut();
    exchangeRatesService.findCurrent.mockRejectedValue(
      new ExchangeRateNotConfiguredException(Currency.USD, Currency.EUR),
    );

    await expect(
      service.calculate(Currency.USD, Currency.EUR, '10'),
    ).rejects.toBeInstanceOf(ExchangeRateNotConfiguredException);
  });
});
