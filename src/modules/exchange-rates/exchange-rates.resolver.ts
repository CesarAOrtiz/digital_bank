import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { ExchangeRatesService } from './exchange-rates.service';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { CreateExchangeRateInput } from './dto/create-exchange-rate.input';
import { UpdateExchangeRateInput } from './dto/update-exchange-rate.input';

@Resolver(() => ExchangeRate)
export class ExchangeRatesResolver {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Mutation(() => ExchangeRate)
  createExchangeRate(@Args('createExchangeRateInput') createExchangeRateInput: CreateExchangeRateInput) {
    return this.exchangeRatesService.create(createExchangeRateInput);
  }

  @Query(() => [ExchangeRate], { name: 'exchangeRates' })
  findAll() {
    return this.exchangeRatesService.findAll();
  }

  @Query(() => ExchangeRate, { name: 'exchangeRate' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.exchangeRatesService.findOne(id);
  }

  @Mutation(() => ExchangeRate)
  updateExchangeRate(@Args('updateExchangeRateInput') updateExchangeRateInput: UpdateExchangeRateInput) {
    return this.exchangeRatesService.update(updateExchangeRateInput.id, updateExchangeRateInput);
  }

  @Mutation(() => ExchangeRate)
  removeExchangeRate(@Args('id', { type: () => Int }) id: number) {
    return this.exchangeRatesService.remove(id);
  }
}
