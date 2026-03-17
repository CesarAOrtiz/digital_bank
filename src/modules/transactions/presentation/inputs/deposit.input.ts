import { Field, ID, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';
import { AmountInput } from './amount.input';

@InputType()
export class DepositInput extends AmountInput {
  @Field(() => ID)
  @IsUUID()
  accountId!: string;
}
