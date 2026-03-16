import { Field, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';
import { AmountInput } from './amount.input';

@InputType()
export class TransferInput extends AmountInput {
  @Field()
  @IsUUID()
  sourceAccountId!: string;

  @Field()
  @IsUUID()
  destinationAccountId!: string;
}
