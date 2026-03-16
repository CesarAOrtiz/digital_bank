import { CreateExchangeRateInput } from './create-exchange-rate.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateExchangeRateInput extends PartialType(CreateExchangeRateInput) {
  @Field(() => Int)
  id: number;
}
