import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule } from './modules/clients/clients.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

@Module({
  imports: [
    ClientsModule,
    AccountsModule,
    TransactionsModule,
    ExchangeRatesModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      autoSchemaFile: true,
      sortSchema: true,
      playground: true,
      // graphiql: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
