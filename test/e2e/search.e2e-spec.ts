import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AccountStatus, Currency, TransactionType } from '../../src/common/domain/enums';
import { Account } from '../../src/modules/accounts/domain';
import { Client } from '../../src/modules/clients/domain';
import { Transaction } from '../../src/modules/transactions/domain';
import { createGraphqlTestApp } from './graphql-test-app';

describe('Search GraphQL (e2e)', () => {
  let app: INestApplication;
  let clientsService: Awaited<
    ReturnType<typeof createGraphqlTestApp>
  >['clientsService'];
  let accountsService: Awaited<
    ReturnType<typeof createGraphqlTestApp>
  >['accountsService'];
  let transactionsService: Awaited<
    ReturnType<typeof createGraphqlTestApp>
  >['transactionsService'];

  beforeAll(async () => {
    const testApp = await createGraphqlTestApp();
    app = testApp.app;
    clientsService = testApp.clientsService;
    accountsService = testApp.accountsService;
    transactionsService = testApp.transactionsService;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searchClients debe devolver clientes mapeados', async () => {
    clientsService.search.mockResolvedValue([
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
          query SearchClients($term: String!, $pagination: PaginationInput) {
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
            offset: 5,
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
    expect(clientsService.search).toHaveBeenCalledWith('ada', 10, 5);
  });

  it('searchAccounts debe devolver cuentas mapeadas', async () => {
    accountsService.search.mockResolvedValue([
      new Account({
        id: '22222222-2222-4222-8222-222222222222',
        accountNumber: 'ACC-001',
        clientId: '11111111-1111-4111-8111-111111111111',
        currency: Currency.USD,
        balance: '1250.00',
        status: AccountStatus.ACTIVE,
        createdAt: new Date('2026-03-18T00:00:00.000Z'),
        updatedAt: new Date('2026-03-18T01:00:00.000Z'),
      }),
    ]);

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query SearchAccounts($term: String!, $pagination: PaginationInput) {
            searchAccounts(term: $term, pagination: $pagination) {
              id
              accountNumber
              clientId
              currency
              balance
              status
            }
          }
        `,
        variables: {
          term: 'ACC',
          pagination: {
            limit: 15,
            offset: 10,
          },
        },
      })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.searchAccounts).toEqual([
      {
        id: '22222222-2222-4222-8222-222222222222',
        accountNumber: 'ACC-001',
        clientId: '11111111-1111-4111-8111-111111111111',
        currency: 'USD',
        balance: '1250.00',
        status: 'ACTIVE',
      },
    ]);
    expect(accountsService.search).toHaveBeenCalledWith('ACC', 15, 10);
  });

  it('searchTransactions debe devolver transacciones mapeadas', async () => {
    transactionsService.search.mockResolvedValue([
      new Transaction({
        id: '33333333-3333-4333-8333-333333333333',
        type: TransactionType.TRANSFER,
        sourceAccountId: '44444444-4444-4444-8444-444444444444',
        destinationAccountId: '55555555-5555-4555-8555-555555555555',
        sourceCurrency: Currency.USD,
        destinationCurrency: Currency.DOP,
        sourceAmount: '10.00',
        destinationAmount: '605.00',
        exchangeRateUsed: '60.500000',
        idempotencyKey: 'tx-001',
        description: 'international',
        createdAt: new Date('2026-03-18T00:00:00.000Z'),
      }),
    ]);

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query SearchTransactions($filters: SearchTransactionsInput, $pagination: PaginationInput) {
            searchTransactions(filters: $filters, pagination: $pagination) {
              id
              type
              sourceAccountId
              destinationAccountId
              sourceCurrency
              destinationCurrency
              sourceAmount
              destinationAmount
              exchangeRateUsed
              idempotencyKey
              description
            }
          }
        `,
        variables: {
          filters: {
            type: 'TRANSFER',
            sourceAccountId: '44444444-4444-4444-8444-444444444444',
            currency: 'DOP',
            text: 'international',
          },
          pagination: {
            limit: 20,
            offset: 40,
          },
        },
      })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.searchTransactions).toEqual([
      {
        id: '33333333-3333-4333-8333-333333333333',
        type: 'TRANSFER',
        sourceAccountId: '44444444-4444-4444-8444-444444444444',
        destinationAccountId: '55555555-5555-4555-8555-555555555555',
        sourceCurrency: 'USD',
        destinationCurrency: 'DOP',
        sourceAmount: '10.00',
        destinationAmount: '605.00',
        exchangeRateUsed: '60.500000',
        idempotencyKey: 'tx-001',
        description: 'international',
      },
    ]);
    expect(transactionsService.search).toHaveBeenCalledWith(
      {
        type: 'TRANSFER',
        sourceAccountId: '44444444-4444-4444-8444-444444444444',
        currency: 'DOP',
        text: 'international',
      },
      20,
      40,
    );
  });
});
