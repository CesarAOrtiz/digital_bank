import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Currency } from '../../../../common/domain/enums';
import { ExchangeRatesService } from '../../application/exchange-rates.service';
import { CreateExchangeRateInput } from '../inputs/create-exchange-rate.input';
import { ExchangeRateGraphqlMapper } from '../mappers/exchange-rate-graphql.mapper';
import { ExchangeRateGraphqlModel } from '../models/exchange-rate.model';

@Resolver(() => ExchangeRateGraphqlModel)
export class ExchangeRatesResolver {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Mutation(() => ExchangeRateGraphqlModel)
  async createExchangeRate(
    @Args('input') input: CreateExchangeRateInput,
  ): Promise<ExchangeRateGraphqlModel> {
    const exchangeRate = await this.exchangeRatesService.create(input);
    return ExchangeRateGraphqlMapper.toModel(exchangeRate);
  }

  @Query(() => [ExchangeRateGraphqlModel], { name: 'exchangeRates' })
  async findExchangeRates(): Promise<ExchangeRateGraphqlModel[]> {
    const exchangeRates = await this.exchangeRatesService.findAll();
    return exchangeRates.map(ExchangeRateGraphqlMapper.toModel);
  }

  @Query(() => ExchangeRateGraphqlModel, { name: 'exchangeRate' })
  async findExchangeRate(
    @Args('baseCurrency', { type: () => Currency }) baseCurrency: Currency,
    @Args('targetCurrency', { type: () => Currency }) targetCurrency: Currency,
  ): Promise<ExchangeRateGraphqlModel> {
    const exchangeRate = await this.exchangeRatesService.findCurrent(
      baseCurrency,
      targetCurrency,
    );
    return ExchangeRateGraphqlMapper.toModel(exchangeRate);
  }
}
