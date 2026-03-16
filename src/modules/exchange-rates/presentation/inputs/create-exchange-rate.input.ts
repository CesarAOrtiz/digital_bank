import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, Matches } from 'class-validator';
import { Currency } from '../../../../common/domain/enums';

@InputType()
export class CreateExchangeRateInput {
  @Field(() => Currency)
  @IsEnum(Currency)
  baseCurrency!: Currency;

  @Field(() => Currency)
  @IsEnum(Currency)
  targetCurrency!: Currency;

  @Field()
  @Matches(/^\d+(\.\d+)?$/)
  rate!: string;

  @Field()
  @Type(() => Date)
  @IsDate()
  effectiveAt!: Date;
}
