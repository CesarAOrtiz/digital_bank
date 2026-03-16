import { Field, ObjectType } from '@nestjs/graphql';
import { Currency } from '../../../../common/domain/enums';

@ObjectType('ExchangeRate')
export class ExchangeRateGraphqlModel {
  @Field()
  id!: string;

  @Field(() => Currency)
  baseCurrency!: Currency;

  @Field(() => Currency)
  targetCurrency!: Currency;

  @Field()
  rate!: string;

  @Field()
  effectiveAt!: Date;

  @Field()
  createdAt!: Date;
}
