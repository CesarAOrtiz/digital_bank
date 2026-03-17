import { Field, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { Currency, TransactionType } from '../../../../common/domain/enums';

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

  @Field(() => Currency, { nullable: true })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;
}
