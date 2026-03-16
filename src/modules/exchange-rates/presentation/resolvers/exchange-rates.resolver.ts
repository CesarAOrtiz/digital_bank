import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ExchangeRatesService } from '../../application/exchange-rates.service';
import { CreateExchangeRateInput } from '../inputs/create-exchange-rate.input';
import { ExchangeRateGraphqlMapper } from '../mappers/exchange-rate-graphql.mapper';
import { ExchangeRateGraphqlModel } from '../models/exchange-rate.model';

@Resolver(() => ExchangeRateGraphqlModel)
export class ExchangeRatesResolver {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Mutation(() => ExchangeRateGraphqlModel)
  async createExchangeRate(@Args('input') input: CreateExchangeRateInput): Promise<ExchangeRateGraphqlModel> {
    return ExchangeRateGraphqlMapper.toModel(await this.exchangeRatesService.create(input));
  }

  @Query(() => [ExchangeRateGraphqlModel], { name: 'exchangeRates' })
  async findExchangeRates(): Promise<ExchangeRateGraphqlModel[]> {
    return (await this.exchangeRatesService.findAll()).map((rate) => ExchangeRateGraphqlMapper.toModel(rate));
  }
}
