import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TerminusModule } from '@nestjs/terminus';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GraphqlExceptionFilter } from './common/presentation/graphql-exception.filter';
import './common/presentation/graphql.enums';
import { DatabaseModule } from './common/infrastructure/database.module';
import { RedisModule } from './common/infrastructure/redis/redis.module';
import { ClientsModule } from './modules/clients/clients.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    TerminusModule,
    ClientsModule,
    AccountsModule,
    TransactionsModule,
    ExchangeRatesModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      graphiql: true,
      // playground: true,
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: GraphqlExceptionFilter,
    },
  ],
})
export class AppModule {}
