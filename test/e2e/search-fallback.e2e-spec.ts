import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../../src/common/presentation/graphql.enums';
import { ELASTIC_CLIENT } from '../../src/common/infrastructure/elasticsearch/elasticsearch.tokens';
import { AppLogger } from '../../src/common/infrastructure/logging/app-logger.service';
import { RedisCacheService } from '../../src/common/infrastructure/redis/redis-cache.service';
import {
  ACCOUNT_REPOSITORY,
  CLIENT_REPOSITORY,
  TRANSACTION_REPOSITORY,
} from '../../src/common/infrastructure/repository.tokens';
import { AccountsService } from '../../src/modules/accounts/application/accounts.service';
import { ClientsService } from '../../src/modules/clients/application/clients.service';
import { Client } from '../../src/modules/clients/domain';
import { ClientsResolver } from '../../src/modules/clients/presentation/resolvers/clients.resolver';
import { SearchIndexingService } from '../../src/modules/search/application/search-indexing.service';
import { SearchQueryService } from '../../src/modules/search/application/search-query.service';
import { TransactionsService } from '../../src/modules/transactions/application/services/transactions.service';

describe('Search fallback GraphQL (e2e)', () => {
  let app: INestApplication;
  const elastic = {
    search: jest.fn(),
  };
  const clientRepository = {
    save: jest.fn(),
    findAll: jest.fn(),
    findPageAfterId: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByDocumentNumber: jest.fn(),
    search: jest.fn(),
  };
  const accountRepository = {
    save: jest.fn(),
    findAll: jest.fn(),
    findPageAfterId: jest.fn(),
    findById: jest.fn(),
    findByAccountNumber: jest.fn(),
    findByClientId: jest.fn(),
    search: jest.fn(),
  };
  const transactionRepository = {
    save: jest.fn(),
    findAll: jest.fn(),
    findPageAfterId: jest.fn(),
    findById: jest.fn(),
    findByIdempotencyKey: jest.fn(),
    search: jest.fn(),
  };
  const redisCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delMany: jest.fn(),
    getOrSet: jest.fn(),
  };
  const searchIndexingService = {
    indexClient: jest.fn(),
    indexAccount: jest.fn(),
    indexTransaction: jest.fn(),
    ensureIndices: jest.fn(),
    recreateIndices: jest.fn(),
    onModuleInit: jest.fn(),
  };
  const appLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeAll(async () => {
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
        ClientsService,
        SearchQueryService,
        {
          provide: ELASTIC_CLIENT,
          useValue: elastic,
        },
        {
          provide: CLIENT_REPOSITORY,
          useValue: clientRepository,
        },
        {
          provide: ACCOUNT_REPOSITORY,
          useValue: accountRepository,
        },
        {
          provide: TRANSACTION_REPOSITORY,
          useValue: transactionRepository,
        },
        {
          provide: RedisCacheService,
          useValue: redisCacheService,
        },
        {
          provide: SearchIndexingService,
          useValue: searchIndexingService,
        },
        {
          provide: AppLogger,
          useValue: appLogger,
        },
        {
          provide: AccountsService,
          useValue: {},
        },
        {
          provide: TransactionsService,
          useValue: {},
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searchClients debe responder por GraphQL usando fallback a PostgreSQL cuando Elastic falla', async () => {
    elastic.search.mockRejectedValue(new Error('elastic unavailable'));
    clientRepository.search.mockResolvedValue([
      new Client({
        id: '11111111-1111-4111-8111-111111111111',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        documentNumber: 'DOC-1',
        createdAt: new Date('2026-03-18T00:00:00.000Z'),
        updatedAt: new Date('2026-03-18T01:00:00.000Z'),
      }),
    ]);

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query SearchClientsFallback($term: String!, $pagination: PaginationInput) {
            searchClients(term: $term, pagination: $pagination) {
              id
              firstName
              lastName
              email
              documentNumber
            }
          }
        `,
        variables: {
          term: 'ada',
          pagination: {
            limit: 10,
            offset: 0,
          },
        },
      })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.searchClients).toEqual([
      {
        id: '11111111-1111-4111-8111-111111111111',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        documentNumber: 'DOC-1',
      },
    ]);
    expect(clientRepository.search).toHaveBeenCalledWith('ada');
    expect(appLogger.warn).toHaveBeenCalledWith(
      'search.clients.fallback_to_postgres',
      expect.objectContaining({
        term: 'ada',
        limit: 10,
        offset: 0,
        reason: 'elastic unavailable',
      }),
    );
  });
});
