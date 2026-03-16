import { Test } from '@nestjs/testing';
import { AccountStatus, Currency, TransactionType } from '../../../common/domain/enums';
import {
  ACCOUNT_REPOSITORY,
  EXCHANGE_RATE_REPOSITORY,
  FINANCIAL_TRANSACTION_MANAGER,
  TRANSACTION_REPOSITORY,
} from '../../../common/infrastructure/repository.tokens';
import { Account } from '../../accounts/domain';
import { ExchangeRate } from '../../exchange-rates/domain';
import type {
  FinancialTransactionContext,
  FinancialTransactionManager,
} from './contracts/financial-transaction-manager.contract';
import { Transaction } from '../domain';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  function createTestingContext() {
    const accounts = new Map<string, Account>();
    const transactions = new Map<string, Transaction>();

    const accountRepository = {
      save: jest.fn(async (account: Account) => {
        accounts.set(account.id, account);
        return account;
      }),
      findAll: jest.fn(async () => [...accounts.values()]),
      findById: jest.fn(async (id: string) => accounts.get(id) ?? null),
      findByAccountNumber: jest.fn(async (accountNumber: string) => {
        return [...accounts.values()].find((account) => account.accountNumber === accountNumber) ?? null;
      }),
    };

    const exchangeRateRepository = {
      save: jest.fn(),
      findAll: jest.fn(),
      findLatest: jest.fn(),
    };

    const transactionRepository = {
      save: jest.fn(async (transaction) => {
        transactions.set(transaction.id, transaction);
        return transaction;
      }),
      findAll: jest.fn(async () => [...transactions.values()]),
      findById: jest.fn(async (id: string) => transactions.get(id) ?? null),
      findByIdempotencyKey: jest.fn(async (idempotencyKey: string) => {
        return [...transactions.values()].find((item) => item.toPrimitives().idempotencyKey === idempotencyKey) ?? null;
      }),
      search: jest.fn(async () => [...transactions.values()]),
    };

    const financialTransactionManager: FinancialTransactionManager = {
      execute: jest.fn(async (_options, callback: (context: FinancialTransactionContext) => Promise<unknown>) => {
        return callback({
          accountRepository,
          exchangeRateRepository,
          transactionRepository,
        });
      }),
    };

    return {
      accountRepository,
      exchangeRateRepository,
      transactionRepository,
      financialTransactionManager,
      accounts,
    };
  }

  it('applies the configured exchange rate snapshot on transfer', async () => {
    const context = createTestingContext();
    context.accounts.set(
      'source-account',
      new Account({
        id: 'source-account',
        accountNumber: 'ACC-USD-1',
        clientId: 'client-a',
        currency: Currency.USD,
        balance: '100.00',
        status: AccountStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    context.accounts.set(
      'destination-account',
      new Account({
        id: 'destination-account',
        accountNumber: 'ACC-DOP-1',
        clientId: 'client-b',
        currency: Currency.DOP,
        balance: '0.00',
        status: AccountStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    context.exchangeRateRepository.findLatest.mockResolvedValue(
      new ExchangeRate({
        id: 'rate-1',
        baseCurrency: Currency.USD,
        targetCurrency: Currency.DOP,
        rate: '58.345600',
        effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date(),
      }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: ACCOUNT_REPOSITORY, useValue: context.accountRepository },
        { provide: EXCHANGE_RATE_REPOSITORY, useValue: context.exchangeRateRepository },
        { provide: TRANSACTION_REPOSITORY, useValue: context.transactionRepository },
        { provide: FINANCIAL_TRANSACTION_MANAGER, useValue: context.financialTransactionManager },
      ],
    }).compile();

    const service = moduleRef.get(TransactionsService);
    const transaction = await service.transfer({
      sourceAccountId: 'source-account',
      destinationAccountId: 'destination-account',
      amount: '100.00',
      description: 'Cross currency transfer',
    });

    expect(transaction.toPrimitives().type).toBe(TransactionType.TRANSFER);
    expect(transaction.toPrimitives().destinationAmount).toBe('5834.56');
    expect(transaction.toPrimitives().exchangeRateUsed).toBe('58.345600');
  });

  it('requests a transactional lock on both accounts for transfers', async () => {
    const context = createTestingContext();
    context.accounts.set(
      'b-account',
      new Account({
        id: 'b-account',
        accountNumber: 'ACC-USD-2',
        clientId: 'client-c',
        currency: Currency.USD,
        balance: '200.00',
        status: AccountStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    context.accounts.set(
      'a-account',
      new Account({
        id: 'a-account',
        accountNumber: 'ACC-USD-3',
        clientId: 'client-d',
        currency: Currency.USD,
        balance: '0.00',
        status: AccountStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: ACCOUNT_REPOSITORY, useValue: context.accountRepository },
        { provide: EXCHANGE_RATE_REPOSITORY, useValue: context.exchangeRateRepository },
        { provide: TRANSACTION_REPOSITORY, useValue: context.transactionRepository },
        { provide: FINANCIAL_TRANSACTION_MANAGER, useValue: context.financialTransactionManager },
      ],
    }).compile();

    const service = moduleRef.get(TransactionsService);
    await service.transfer({
      sourceAccountId: 'b-account',
      destinationAccountId: 'a-account',
      amount: '25.00',
      idempotencyKey: 'transfer-1',
    });

    expect(context.financialTransactionManager.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        operationName: 'transfer',
        lockAccountIds: ['b-account', 'a-account'],
      }),
      expect.any(Function),
    );
  });
});
