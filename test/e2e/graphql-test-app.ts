import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import '../../src/common/presentation/graphql.enums';
import { ClientsService } from '../../src/modules/clients/application/clients.service';
import { ClientsResolver } from '../../src/modules/clients/presentation/resolvers/clients.resolver';
import { AccountsService } from '../../src/modules/accounts/application/accounts.service';
import { AccountsResolver } from '../../src/modules/accounts/presentation/resolvers/accounts.resolver';
import { TransactionsService } from '../../src/modules/transactions/application/services/transactions.service';
import { TransactionsResolver } from '../../src/modules/transactions/presentation/resolvers/transactions.resolver';

interface GraphqlTestApp {
  app: INestApplication;
  clientsService: Record<string, jest.Mock>;
  accountsService: Record<string, jest.Mock>;
  transactionsService: Record<string, jest.Mock>;
}

export async function createGraphqlTestApp(): Promise<GraphqlTestApp> {
  const clientsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    search: jest.fn(),
  };
  const accountsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByAccountNumber: jest.fn(),
    findByClient: jest.fn(),
    search: jest.fn(),
  };
  const transactionsService = {
    deposit: jest.fn(),
    withdraw: jest.fn(),
    transfer: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    search: jest.fn(),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [
      GraphQLModule.forRoot<ApolloDriverConfig>({
        driver: ApolloDriver,
        autoSchemaFile: true,
        sortSchema: true,
        graphiql: false,
      }),
    ],
    providers: [
      ClientsResolver,
      AccountsResolver,
      TransactionsResolver,
      {
        provide: ClientsService,
        useValue: clientsService,
      },
      {
        provide: AccountsService,
        useValue: accountsService,
      },
      {
        provide: TransactionsService,
        useValue: transactionsService,
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();

  return {
    app,
    clientsService,
    accountsService,
    transactionsService,
  };
}
