import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Currency, TransactionType } from '../../../../common/domain/enums';

@ObjectType('Transaction')
export class TransactionGraphqlModel {
  @Field(() => ID)
  id!: string;

  @Field(() => TransactionType)
  type!: TransactionType;

  @Field(() => ID, { nullable: true })
  sourceAccountId!: string | null;

  @Field(() => ID, { nullable: true })
  destinationAccountId!: string | null;

  @Field(() => Currency)
  sourceCurrency!: Currency;

  @Field(() => Currency, { nullable: true })
  destinationCurrency!: Currency | null;

  @Field()
  sourceAmount!: string;

  @Field(() => String, { nullable: true })
  destinationAmount!: string | null;

  @Field(() => String, { nullable: true })
  exchangeRateUsed!: string | null;

  @Field(() => String, { nullable: true })
  idempotencyKey!: string | null;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field()
  createdAt!: Date;
}
