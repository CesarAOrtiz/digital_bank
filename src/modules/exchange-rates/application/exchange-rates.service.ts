import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { formatRate } from '../../../common/application/money';
import { Currency } from '../../../common/domain/enums';
import {
  DomainRuleViolationException,
  ExchangeRateNotConfiguredException,
} from '../../../common/domain/exceptions';
import {
  RedisCacheKeys,
  RedisCacheTtl,
} from '../../../common/infrastructure/redis/redis-cache.keys';
import { RedisCacheService } from '../../../common/infrastructure/redis/redis-cache.service';
import { EXCHANGE_RATE_REPOSITORY } from '../../../common/infrastructure/repository.tokens';
import { ExchangeRate } from '../domain';
import type { ExchangeRateRepository } from '../domain';
import type { CreateExchangeRateInput } from './inputs/create-exchange-rate.input';

@Injectable()
export class ExchangeRatesService {
  constructor(
    @Inject(EXCHANGE_RATE_REPOSITORY)
    private readonly exchangeRateRepository: ExchangeRateRepository,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async create(data: CreateExchangeRateInput): Promise<ExchangeRate> {
    if (data.baseCurrency === data.targetCurrency) {
      throw new DomainRuleViolationException('Exchange rate base and target currencies must differ.');
    }

    const exchangeRate = await this.exchangeRateRepository.save(
      new ExchangeRate({
        id: randomUUID(),
        baseCurrency: data.baseCurrency,
        targetCurrency: data.targetCurrency,
        rate: formatRate(data.rate),
        effectiveAt: data.effectiveAt,
        createdAt: new Date(),
      }),
    );

    await this.invalidateLatestRateCache(
      data.baseCurrency,
      data.targetCurrency,
    );
    return exchangeRate;
  }

  findAll(): Promise<ExchangeRate[]> {
    return this.exchangeRateRepository.findAll();
  }

  findLatest(baseCurrency: Currency, targetCurrency: Currency, effectiveAt: Date): Promise<ExchangeRate | null> {
    return this.exchangeRateRepository.findLatest(baseCurrency, targetCurrency, effectiveAt);
  }

  async findCurrent(
    baseCurrency: Currency,
    targetCurrency: Currency,
  ): Promise<ExchangeRate> {
    if (baseCurrency === targetCurrency) {
      throw new DomainRuleViolationException(
        'Exchange rate base and target currencies must differ.',
      );
    }

    const cacheKey = RedisCacheKeys.exchangeRate(baseCurrency, targetCurrency);
    const cached = await this.redisCacheService.get<
      ReturnType<ExchangeRate['toPrimitives']>
    >(cacheKey);
    if (cached) {
      return new ExchangeRate({
        ...cached,
        effectiveAt: new Date(cached.effectiveAt),
        createdAt: new Date(cached.createdAt),
      });
    }

    const rate = await this.exchangeRateRepository.findLatest(
      baseCurrency,
      targetCurrency,
      new Date(),
    );

    if (!rate) {
      throw new ExchangeRateNotConfiguredException(baseCurrency, targetCurrency);
    }

    await this.redisCacheService.set(
      cacheKey,
      rate.toPrimitives(),
      RedisCacheTtl.exchangeRate,
    );
    return rate;
  }

  private async invalidateLatestRateCache(
    baseCurrency: Currency,
    targetCurrency: Currency,
  ): Promise<void> {
    await this.redisCacheService.del(
      RedisCacheKeys.exchangeRate(baseCurrency, targetCurrency),
    );
  }
}
