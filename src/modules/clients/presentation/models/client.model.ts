import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Client')
export class ClientGraphqlModel {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;

  @Field()
  documentNumber!: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
