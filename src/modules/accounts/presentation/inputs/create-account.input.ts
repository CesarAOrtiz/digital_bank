import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { Currency } from '../../../../common/domain/enums';

@InputType()
export class CreateAccountInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  accountNumber!: string;

  @Field(() => ID)
  @IsUUID()
  clientId!: string;

  @Field(() => Currency)
  @IsEnum(Currency)
  currency!: Currency;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(/^\d+(\.\d+)?$/)
  initialBalance?: string;
}
