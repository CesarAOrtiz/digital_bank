import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, Matches } from 'class-validator';

@InputType({ isAbstract: true })
export class AmountInput {
  @Field()
  @Matches(/^\d+(\.\d+)?$/)
  amount!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  description?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  idempotencyKey?: string;
}
