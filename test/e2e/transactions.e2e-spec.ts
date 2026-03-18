import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Currency, TransactionType } from '../../src/common/domain/enums';
import { Transaction } from '../../src/modules/transactions/domain';
import { createGraphqlTestApp } from './graphql-test-app';

describe('Transactions GraphQL (e2e)', () => {
  let app: INestApplication;
  let transactionsService: Awaited<
    ReturnType<typeof createGraphqlTestApp>
  >['transactionsService'];

  beforeAll(async () => {
    const testApp = await createGraphqlTestApp();
    app = testApp.app;
    transactionsService = testApp.transactionsService;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildTransaction(
    overrides: Partial<ReturnType<Transaction['toPrimitives']>> = {},
  ) {
    return new Transaction({
      id: '11111111-1111-4111-8111-111111111111',
      type: TransactionType.DEPOSIT,
      sourceAccountId: null,
      destinationAccountId: '22222222-2222-4222-8222-222222222222',
      sourceCurrency: Currency.USD,
      destinationCurrency: Currency.USD,
      sourceAmount: '100.00',
      destinationAmount: '100.00',
      exchangeRateUsed: null,
      idempotencyKey: 'idem-1',
      description: 'cash-in',
      createdAt: new Date('2026-03-18T00:00:00.000Z'),
      ...overrides,
    });
  }

  it('deposit debe devolver la transacción mapeada', async () => {
    transactionsService.deposit.mockResolvedValue(
      buildTransaction({
        type: TransactionType.DEPOSIT,
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation Deposit($input: DepositInput!) {
            deposit(input: $input) {
              id
              type
              destinationAccountId
              sourceAmount
              destinationAmount
              description
            }
          }
        `,
        variables: {
          input: {
            accountId: '22222222-2222-4222-8222-222222222222',
            amount: '100.00',
            description: 'cash-in',
            idempotencyKey: 'idem-1',
          },
        },
      })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.deposit).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      type: 'DEPOSIT',
      destinationAccountId: '22222222-2222-4222-8222-222222222222',
      sourceAmount: '100.00',
      destinationAmount: '100.00',
      description: 'cash-in',
    });
    expect(transactionsService.deposit).toHaveBeenCalledWith({
      accountId: '22222222-2222-4222-8222-222222222222',
      amount: '100.00',
      description: 'cash-in',
      idempotencyKey: 'idem-1',
    });
  });

  it('withdraw debe devolver la transacción mapeada', async () => {
    transactionsService.withdraw.mockResolvedValue(
      buildTransaction({
        id: '33333333-3333-4333-8333-333333333333',
        type: TransactionType.WITHDRAWAL,
        sourceAccountId: '22222222-2222-4222-8222-222222222222',
        sourceAmount: '40.00',
        destinationAccountId: null,
        destinationCurrency: null,
        destinationAmount: null,
        description: 'atm',
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation Withdraw($input: WithdrawalInput!) {
            withdraw(input: $input) {
              id
              type
              sourceAccountId
              sourceAmount
              destinationAmount
              description
            }
          }
        `,
        variables: {
          input: {
            accountId: '22222222-2222-4222-8222-222222222222',
            amount: '40.00',
            description: 'atm',
            idempotencyKey: 'idem-2',
          },
        },
      })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.withdraw).toEqual({
      id: '33333333-3333-4333-8333-333333333333',
      type: 'WITHDRAWAL',
      sourceAccountId: '22222222-2222-4222-8222-222222222222',
      sourceAmount: '40.00',
      destinationAmount: null,
      description: 'atm',
    });
    expect(transactionsService.withdraw).toHaveBeenCalledWith({
      accountId: '22222222-2222-4222-8222-222222222222',
      amount: '40.00',
      description: 'atm',
      idempotencyKey: 'idem-2',
    });
  });

  it('transfer debe devolver la transacción multi-moneda mapeada', async () => {
    transactionsService.transfer.mockResolvedValue(
      buildTransaction({
        id: '44444444-4444-4444-8444-444444444444',
        type: TransactionType.TRANSFER,
        sourceAccountId: '55555555-5555-4555-8555-555555555555',
        destinationAccountId: '66666666-6666-4666-8666-666666666666',
        sourceCurrency: Currency.USD,
        destinationCurrency: Currency.DOP,
        sourceAmount: '10.00',
        destinationAmount: '605.00',
        exchangeRateUsed: '60.500000',
        description: 'fx transfer',
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation Transfer($input: TransferInput!) {
            transfer(input: $input) {
              id
              type
              sourceAccountId
              destinationAccountId
              sourceCurrency
              destinationCurrency
              sourceAmount
              destinationAmount
              exchangeRateUsed
            }
          }
        `,
        variables: {
          input: {
            sourceAccountId: '55555555-5555-4555-8555-555555555555',
            destinationAccountId: '66666666-6666-4666-8666-666666666666',
            amount: '10.00',
            description: 'fx transfer',
            idempotencyKey: 'idem-3',
          },
        },
      })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.transfer).toEqual({
      id: '44444444-4444-4444-8444-444444444444',
      type: 'TRANSFER',
      sourceAccountId: '55555555-5555-4555-8555-555555555555',
      destinationAccountId: '66666666-6666-4666-8666-666666666666',
      sourceCurrency: 'USD',
      destinationCurrency: 'DOP',
      sourceAmount: '10.00',
      destinationAmount: '605.00',
      exchangeRateUsed: '60.500000',
    });
    expect(transactionsService.transfer).toHaveBeenCalledWith({
      sourceAccountId: '55555555-5555-4555-8555-555555555555',
      destinationAccountId: '66666666-6666-4666-8666-666666666666',
      amount: '10.00',
      description: 'fx transfer',
      idempotencyKey: 'idem-3',
    });
  });
});
