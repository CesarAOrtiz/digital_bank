import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { Currency } from '../../../../common/domain/enums';

@InputType()
export class CreateAccountInput {
  @Field()
  accountNumber!: string;

  @Field()
  @IsUUID()
  clientId!: string;

  @Field(() => Currency)
  @IsEnum(Currency)
  currency!: Currency;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(/^-?\d+(\.\d+)?$/)
  initialBalance?: string;
}
