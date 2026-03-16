import { Field, ID, ObjectType } from '@nestjs/graphql';
import { AccountStatus, Currency } from '../../../../common/domain/enums';

@ObjectType('Account')
export class AccountGraphqlModel {
  @Field(() => ID)
  id!: string;

  @Field()
  accountNumber!: string;

  @Field()
  clientId!: string;

  @Field(() => Currency)
  currency!: Currency;

  @Field()
  balance!: string;

  @Field(() => AccountStatus)
  status!: AccountStatus;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
