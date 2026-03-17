import { Field, ID, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';
import { AmountInput } from './amount.input';

@InputType()
export class TransferInput extends AmountInput {
  @Field(() => ID)
  @IsUUID()
  sourceAccountId!: string;

  @Field(() => ID)
  @IsUUID()
  destinationAccountId!: string;
}
