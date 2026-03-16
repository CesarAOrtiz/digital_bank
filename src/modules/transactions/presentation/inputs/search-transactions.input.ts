import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TransactionType } from '../../../../common/domain/enums';

@InputType()
export class SearchTransactionsInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  text?: string;

  @Field(() => TransactionType, { nullable: true })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
