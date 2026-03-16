import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, Length } from 'class-validator';

@InputType()
export class CreateClientInput {
  @Field()
  @IsNotEmpty()
  @Length(1, 120)
  firstName!: string;

  @Field()
  @IsNotEmpty()
  @Length(1, 120)
  lastName!: string;

  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @IsNotEmpty()
  @Length(3, 50)
  documentNumber!: string;
}
