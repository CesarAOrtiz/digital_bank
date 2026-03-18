import { AccountStatus, Currency, TransactionType } from '../../../../common/domain/enums';
import {
  DomainRuleViolationException,
  ExchangeRateNotConfiguredException,
  IdempotencyKeyReuseException,
  InsufficientFundsException,
} from '../../../../common/domain/exceptions';
import { RedisCacheKeys } from '../../../../common/infrastructure/redis/redis-cache.keys';
import { Account } from '../../../accounts/domain';
import { ExchangeRate } from '../../../exchange-rates/domain';
import { SearchIndexingService } from '../../../search/application/search-indexing.service';
import { Transaction } from '../../domain';
import type { FinancialTransactionContext } from '../contracts/financial-transaction-manager.contract';
import { TransactionIdempotencyService } from './transaction-idempotency.service';
import { TransactionWriteService } from './transaction-write.service';
import { ExchangeRatesService } from '../../../exchange-rates/application/exchange-rates.service';
import { RedisCacheService } from '../../../../common/infrastructure/redis/redis-cache.service';
import { AppLogger } from '../../../../common/infrastructure/logging/app-logger.service';

describe('TransactionWriteService', () => {
  function buildAccount(overrides: Partial<ReturnType<Account['toPrimitives']>> = {}) {
    return new Account({
      id: 'account-1',
      accountNumber: 'ACC-001',
      clientId: 'client-1',
      currency: Currency.USD,
      balance: '100.00',
      status: AccountStatus.ACTIVE,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    });
  }

  function buildTransaction(
    overrides: Partial<ReturnType<Transaction['toPrimitives']>> = {},
  ) {
    return new Transaction({
      id: 'tx-existing',
      type: TransactionType.DEPOSIT,
      sourceAccountId: null,
      destinationAccountId: 'account-1',
      sourceCurrency: Currency.USD,
      destinationCurrency: Currency.USD,
      sourceAmount: '25.00',
      destinationAmount: '25.00',
      exchangeRateUsed: null,
      idempotencyKey: 'idem-1',
      description: 'cash-in',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      ...overrides,
    });
  }

  function buildExchangeRate() {
    return new ExchangeRate({
      id: 'fx-1',
      baseCurrency: Currency.USD,
      targetCurrency: Currency.DOP,
      rate: '60.500000',
      effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  }

  function createContext() {
    const accountRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };
    const transactionRepository = {
      findByIdempotencyKey: jest.fn(),
      save: jest.fn(),
    };

    return {
      accountRepository,
      transactionRepository,
      exchangeRateRepository: {},
    } as unknown as FinancialTransactionContext & {
      accountRepository: {
        findById: jest.Mock;
        save: jest.Mock;
      };
      transactionRepository: {
        findByIdempotencyKey: jest.Mock;
        save: jest.Mock;
      };
    };
  }

  function createSut() {
    const context = createContext();
    const transactionIdempotencyService = {
      executeIdempotentTransaction: jest.fn(
        async (
          _options: unknown,
          callback: (ctx: FinancialTransactionContext) => Promise<Transaction>,
        ) => callback(context),
      ),
      findExistingTransaction: jest.fn().mockResolvedValue(null),
      assertDepositMatches: jest.fn(),
      assertWithdrawalMatches: jest.fn(),
      assertTransferMatches: jest.fn(),
      normalizeDescription: jest
        .fn()
        .mockImplementation((description?: string | null) => description?.trim() || null),
    } as unknown as jest.Mocked<TransactionIdempotencyService>;

    const redisCacheService = {
      delMany: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RedisCacheService>;

    const exchangeRatesService = {
      findCurrent: jest.fn().mockResolvedValue(buildExchangeRate()),
    } as unknown as jest.Mocked<ExchangeRatesService>;

    const searchIndexingService = {
      indexAccount: jest.fn().mockResolvedValue(undefined),
      indexTransaction: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SearchIndexingService>;

    const appLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<AppLogger>;

    const service = new TransactionWriteService(
      transactionIdempotencyService,
      redisCacheService,
      exchangeRatesService,
      searchIndexingService,
      appLogger,
    );

    return {
      service,
      context,
      transactionIdempotencyService,
      redisCacheService,
      exchangeRatesService,
      searchIndexingService,
      appLogger,
    };
  }

  it('deposit debe crear la transacción y reindexar cuenta y transacción', async () => {
    const {
      service,
      context,
      redisCacheService,
      searchIndexingService,
      appLogger,
    } = createSut();
    const account = buildAccount();
    context.accountRepository.findById.mockResolvedValue(account);
    context.accountRepository.save.mockImplementation(async (saved) => saved);
    context.transactionRepository.save.mockImplementation(async (saved) => saved);

    const result = await service.deposit({
      accountId: account.id,
      amount: '25',
      description: '  cash-in ',
      idempotencyKey: 'dep-1',
    });

    const savedAccount = context.accountRepository.save.mock.calls[0][0] as Account;
    const primitives = result.toPrimitives();

    expect(savedAccount.toPrimitives().balance).toBe('125.00');
    expect(primitives.type).toBe(TransactionType.DEPOSIT);
    expect(primitives.destinationAccountId).toBe(account.id);
    expect(primitives.sourceAmount).toBe('25.00');
    expect(primitives.destinationAmount).toBe('25.00');
    expect(primitives.description).toBe('cash-in');
    expect(redisCacheService.delMany).toHaveBeenCalledWith([
      RedisCacheKeys.clientAccounts(account.toPrimitives().clientId),
    ]);
    expect(appLogger.log).toHaveBeenCalledWith('transaction.deposit.started', {
      accountId: account.id,
      amount: '25.00',
      idempotencyKey: 'dep-1',
    });
    expect(appLogger.log).toHaveBeenCalledWith(
      'transaction.deposit.completed',
      expect.objectContaining({
        transactionId: primitives.id,
        transactionType: TransactionType.DEPOSIT,
      }),
    );
    expect(searchIndexingService.indexAccount).toHaveBeenCalledWith(savedAccount);
    expect(searchIndexingService.indexTransaction).toHaveBeenCalledWith(result);
  });

  it('deposit debe devolver la transacción existente cuando se reutiliza la idempotency key con el mismo payload', async () => {
    const {
      service,
      context,
      transactionIdempotencyService,
      redisCacheService,
      searchIndexingService,
    } = createSut();
    const existing = buildTransaction();
    transactionIdempotencyService.findExistingTransaction.mockResolvedValue(existing);

    const result = await service.deposit({
      accountId: 'account-1',
      amount: '25',
      description: 'cash-in',
      idempotencyKey: 'idem-1',
    });

    expect(result).toBe(existing);
    expect(transactionIdempotencyService.assertDepositMatches).toHaveBeenCalledWith(
      existing,
      expect.objectContaining({
        accountId: 'account-1',
        amount: '25',
        idempotencyKey: 'idem-1',
      }),
    );
    expect(context.accountRepository.save).not.toHaveBeenCalled();
    expect(context.transactionRepository.save).not.toHaveBeenCalled();
    expect(redisCacheService.delMany).not.toHaveBeenCalled();
    expect(searchIndexingService.indexAccount).not.toHaveBeenCalled();
    expect(searchIndexingService.indexTransaction).not.toHaveBeenCalled();
  });

  it('withdraw debe fallar cuando no hay fondos suficientes', async () => {
    const {
      service,
      context,
      redisCacheService,
      searchIndexingService,
      appLogger,
    } = createSut();
    context.accountRepository.findById.mockResolvedValue(
      buildAccount({ balance: '10.00' }),
    );

    await expect(
      service.withdraw({
        accountId: 'account-1',
        amount: '25',
        description: 'cash-out',
        idempotencyKey: 'wd-1',
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsException);

    expect(context.accountRepository.save).not.toHaveBeenCalled();
    expect(context.transactionRepository.save).not.toHaveBeenCalled();
    expect(redisCacheService.delMany).not.toHaveBeenCalled();
    expect(appLogger.warn).toHaveBeenCalledWith(
      'transaction.withdraw.insufficient_funds',
      expect.objectContaining({
        transactionType: TransactionType.WITHDRAWAL,
        accountId: 'account-1',
        attemptedAmount: '25.00',
      }),
    );
    expect(searchIndexingService.indexAccount).not.toHaveBeenCalled();
    expect(searchIndexingService.indexTransaction).not.toHaveBeenCalled();
  });

  it('withdraw debe invalidar caché y reindexar cuando la operación es exitosa', async () => {
    const {
      service,
      context,
      redisCacheService,
      searchIndexingService,
    } = createSut();
    const account = buildAccount({ balance: '100.00' });
    context.accountRepository.findById.mockResolvedValue(account);
    context.accountRepository.save.mockImplementation(async (saved) => saved);
    context.transactionRepository.save.mockImplementation(async (saved) => saved);

    const result = await service.withdraw({
      accountId: account.id,
      amount: '40',
      description: 'atm',
      idempotencyKey: 'wd-2',
    });

    const savedAccount = context.accountRepository.save.mock.calls[0][0] as Account;

    expect(savedAccount.toPrimitives().balance).toBe('60.00');
    expect(result.toPrimitives().type).toBe(TransactionType.WITHDRAWAL);
    expect(result.toPrimitives().sourceAccountId).toBe(account.id);
    expect(redisCacheService.delMany).toHaveBeenCalledWith([
      RedisCacheKeys.clientAccounts(account.toPrimitives().clientId),
    ]);
    expect(searchIndexingService.indexAccount).toHaveBeenCalledWith(savedAccount);
    expect(searchIndexingService.indexTransaction).toHaveBeenCalledWith(result);
  });

  it('transfer debe fallar cuando la cuenta origen y destino son la misma', async () => {
    const { service, transactionIdempotencyService, appLogger } = createSut();

    await expect(
      service.transfer({
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-1',
        amount: '10',
        description: 'invalid',
        idempotencyKey: 'tr-1',
      }),
    ).rejects.toBeInstanceOf(DomainRuleViolationException);

    expect(
      transactionIdempotencyService.executeIdempotentTransaction,
    ).not.toHaveBeenCalled();
    expect(appLogger.warn).toHaveBeenCalledWith(
      'transaction.transfer.failed',
      expect.objectContaining({
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-1',
        errorCode: 'DOMAIN_RULE_VIOLATION',
      }),
    );
  });

  it('transfer debe mover fondos en la misma moneda', async () => {
    const {
      service,
      context,
      exchangeRatesService,
      redisCacheService,
      searchIndexingService,
    } = createSut();
    const source = buildAccount({
      id: 'source-1',
      clientId: 'client-a',
      currency: Currency.USD,
      balance: '100.00',
    });
    const destination = buildAccount({
      id: 'dest-1',
      clientId: 'client-b',
      accountNumber: 'ACC-002',
      currency: Currency.USD,
      balance: '20.00',
    });
    context.accountRepository.findById.mockImplementation(async (id: string) => {
      if (id === source.id) {
        return source;
      }
      if (id === destination.id) {
        return destination;
      }
      return null;
    });
    context.accountRepository.save.mockImplementation(async (saved) => saved);
    context.transactionRepository.save.mockImplementation(async (saved) => saved);

    const result = await service.transfer({
      sourceAccountId: source.id,
      destinationAccountId: destination.id,
      amount: '30',
      description: 'internal transfer',
      idempotencyKey: 'tr-2',
    });

    const [debited, credited] = context.accountRepository.save.mock.calls.map(
      ([saved]) => saved as Account,
    );

    expect(debited.toPrimitives().balance).toBe('70.00');
    expect(credited.toPrimitives().balance).toBe('50.00');
    expect(result.toPrimitives().destinationAmount).toBe('30.00');
    expect(result.toPrimitives().exchangeRateUsed).toBeNull();
    expect(exchangeRatesService.findCurrent).not.toHaveBeenCalled();
    expect(redisCacheService.delMany).toHaveBeenCalledWith([
      RedisCacheKeys.clientAccounts('client-a'),
      RedisCacheKeys.clientAccounts('client-b'),
    ]);
    expect(searchIndexingService.indexAccount).toHaveBeenNthCalledWith(1, debited);
    expect(searchIndexingService.indexAccount).toHaveBeenNthCalledWith(2, credited);
    expect(searchIndexingService.indexTransaction).toHaveBeenCalledWith(result);
  });

  it('transfer debe convertir el monto usando la tasa de cambio en transferencias entre monedas distintas', async () => {
    const {
      service,
      context,
      exchangeRatesService,
      searchIndexingService,
    } = createSut();
    const source = buildAccount({
      id: 'source-usd',
      clientId: 'client-a',
      currency: Currency.USD,
      balance: '100.00',
    });
    const destination = buildAccount({
      id: 'dest-dop',
      clientId: 'client-b',
      accountNumber: 'ACC-DOP',
      currency: Currency.DOP,
      balance: '1000.00',
    });
    context.accountRepository.findById.mockImplementation(async (id: string) => {
      if (id === source.id) {
        return source;
      }
      if (id === destination.id) {
        return destination;
      }
      return null;
    });
    context.accountRepository.save.mockImplementation(async (saved) => saved);
    context.transactionRepository.save.mockImplementation(async (saved) => saved);

    const result = await service.transfer({
      sourceAccountId: source.id,
      destinationAccountId: destination.id,
      amount: '10',
      description: 'fx transfer',
      idempotencyKey: 'tr-3',
    });

    const [, credited] = context.accountRepository.save.mock.calls.map(
      ([saved]) => saved as Account,
    );

    expect(exchangeRatesService.findCurrent).toHaveBeenCalledWith(
      Currency.USD,
      Currency.DOP,
    );
    expect(credited.toPrimitives().balance).toBe('1605.00');
    expect(result.toPrimitives().destinationAmount).toBe('605.00');
    expect(result.toPrimitives().exchangeRateUsed).toBe('60.500000');
    expect(searchIndexingService.indexAccount).toHaveBeenCalledTimes(2);
    expect(searchIndexingService.indexTransaction).toHaveBeenCalledWith(result);
  });

  it('transfer debe fallar con un error explícito cuando no existe tasa de cambio', async () => {
    const {
      service,
      context,
      exchangeRatesService,
      redisCacheService,
      searchIndexingService,
      appLogger,
    } = createSut();
    const source = buildAccount({
      id: 'source-usd',
      clientId: 'client-a',
      currency: Currency.USD,
      balance: '100.00',
    });
    const destination = buildAccount({
      id: 'dest-eur',
      clientId: 'client-b',
      accountNumber: 'ACC-EUR',
      currency: Currency.EUR,
      balance: '80.00',
    });
    context.accountRepository.findById.mockImplementation(async (id: string) => {
      if (id === source.id) {
        return source;
      }
      if (id === destination.id) {
        return destination;
      }
      return null;
    });
    exchangeRatesService.findCurrent.mockRejectedValue(
      new ExchangeRateNotConfiguredException(
        Currency.USD,
        Currency.EUR,
      ),
    );

    await expect(
      service.transfer({
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        amount: '10',
        description: 'fx transfer missing rate',
        idempotencyKey: 'tr-4',
      }),
    ).rejects.toBeInstanceOf(ExchangeRateNotConfiguredException);

    expect(appLogger.warn).toHaveBeenCalledWith(
      'transaction.transfer.failed',
      expect.objectContaining({
        transactionType: TransactionType.TRANSFER,
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        attemptedAmount: '10.00',
        errorCode: 'EXCHANGE_RATE_NOT_CONFIGURED',
      }),
    );
    expect(context.accountRepository.save).not.toHaveBeenCalled();
    expect(context.transactionRepository.save).not.toHaveBeenCalled();
    expect(redisCacheService.delMany).not.toHaveBeenCalled();
    expect(searchIndexingService.indexAccount).not.toHaveBeenCalled();
    expect(searchIndexingService.indexTransaction).not.toHaveBeenCalled();
  });

  it('deposit debe fallar cuando se reutiliza la idempotency key con un payload distinto', async () => {
    const {
      service,
      transactionIdempotencyService,
      redisCacheService,
      searchIndexingService,
      appLogger,
    } = createSut();
    const existing = buildTransaction({
      sourceAmount: '25.00',
      destinationAmount: '25.00',
      idempotencyKey: 'idem-2',
    });
    transactionIdempotencyService.findExistingTransaction.mockResolvedValue(existing);
    transactionIdempotencyService.assertDepositMatches.mockImplementation(() => {
      throw new IdempotencyKeyReuseException();
    });

    await expect(
      service.deposit({
        accountId: 'account-1',
        amount: '50',
        description: 'cash-in',
        idempotencyKey: 'idem-2',
      }),
    ).rejects.toBeInstanceOf(IdempotencyKeyReuseException);

    expect(appLogger.warn).toHaveBeenCalledWith(
      'transaction.deposit.idempotency_reused',
      expect.objectContaining({
        transactionType: TransactionType.DEPOSIT,
        accountId: 'account-1',
        attemptedAmount: '50.00',
      }),
    );
    expect(redisCacheService.delMany).not.toHaveBeenCalled();
    expect(searchIndexingService.indexAccount).not.toHaveBeenCalled();
    expect(searchIndexingService.indexTransaction).not.toHaveBeenCalled();
  });
});
