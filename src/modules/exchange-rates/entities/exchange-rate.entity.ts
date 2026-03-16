import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class ExchangeRate {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
