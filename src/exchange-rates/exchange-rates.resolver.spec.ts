import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeRatesResolver } from './exchange-rates.resolver';
import { ExchangeRatesService } from './exchange-rates.service';

describe('ExchangeRatesResolver', () => {
  let resolver: ExchangeRatesResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExchangeRatesResolver, ExchangeRatesService],
    }).compile();

    resolver = module.get<ExchangeRatesResolver>(ExchangeRatesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
