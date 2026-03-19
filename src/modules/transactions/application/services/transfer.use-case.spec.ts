import { AccountStatus, Currency, TransactionType } from '../../../../common/domain/enums';
import {
  DomainRuleViolationException,
  ExchangeRateNotConfiguredException,
} from '../../../../common/domain/exceptions';
import { Account } from '../../../accounts/domain';
import { Transaction } from '../../domain';
import type { FinancialTransactionContext } from '../contracts/financial-transaction-manager.contract';
import { TransactionIdempotencyService } from './transaction-idempotency.service';
import { TransactionMutationSupportService } from './transaction-mutation-support.service';
import { TransferSettlementService } from './transfer-settlement.service';
import { TransferUseCase } from './transfer.use-case';

describe('TransferUseCase', () => {
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
      accountRepository: { findById: jest.Mock; save: jest.Mock };
      transactionRepository: { findByIdempotencyKey: jest.Mock; save: jest.Mock };
    };
  }

  function createSut() {
    const context = createContext();
    const transactionIdempotencyService = {
      executeIdempotentTransaction: jest.fn(
        async (_options: unknown, callback: (ctx: FinancialTransactionContext) => Promise<Transaction>) =>
          callback(context),
      ),
      findExistingTransaction: jest.fn().mockResolvedValue(null),
      assertTransferMatches: jest.fn(),
      normalizeDescription: jest
        .fn()
        .mockImplementation((description?: string | null) => description?.trim() || null),
    } as unknown as jest.Mocked<TransactionIdempotencyService>;

    const transferSettlementService = {
      calculate: jest.fn().mockResolvedValue({
        destinationAmount: '605.00',
        exchangeRateUsed: '60.500000',
      }),
    } as unknown as jest.Mocked<TransferSettlementService>;

    const support = {
      requireAccount: jest.fn(),
      invalidateClientAccountsCaches: jest.fn().mockResolvedValue(undefined),
      syncMutatedResources: jest.fn().mockResolvedValue(undefined),
      logStarted: jest.fn(),
      logTransactionCompleted: jest.fn(),
      logIdempotentReplay: jest.fn(),
      logKnownTransactionError: jest.fn(),
    } as unknown as jest.Mocked<TransactionMutationSupportService>;

    return {
      service: new TransferUseCase(
        transactionIdempotencyService,
        transferSettlementService,
        support,
      ),
      context,
      transferSettlementService,
      support,
      transactionIdempotencyService,
    };
  }

  it('debe fallar cuando la cuenta origen y destino son la misma', async () => {
    const { service, transactionIdempotencyService, support } = createSut();

    await expect(
      service.execute({
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-1',
        amount: '10',
        description: 'invalid',
        idempotencyKey: 'tr-1',
      }),
    ).rejects.toBeInstanceOf(DomainRuleViolationException);

    expect(transactionIdempotencyService.executeIdempotentTransaction).not.toHaveBeenCalled();
    expect(support.logKnownTransactionError).toHaveBeenCalled();
  });

  it('debe mover fondos en la misma moneda', async () => {
    const { service, context, transferSettlementService, support } = createSut();
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
    support.requireAccount
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(destination);
    transferSettlementService.calculate.mockResolvedValue({
      destinationAmount: '30.00',
      exchangeRateUsed: null,
    });
    context.accountRepository.save.mockImplementation(async (saved) => saved);
    context.transactionRepository.save.mockImplementation(async (saved) => saved);

    const result = await service.execute({
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
    expect(transferSettlementService.calculate).toHaveBeenCalledWith(
      Currency.USD,
      Currency.USD,
      '30',
    );
    expect(support.invalidateClientAccountsCaches).toHaveBeenCalledWith([
      'client-a',
      'client-b',
    ]);
    expect(support.syncMutatedResources).toHaveBeenCalledWith([debited, credited], result);
  });

  it('debe convertir el monto usando la tasa de cambio en transferencias entre monedas distintas', async () => {
    const { service, context, transferSettlementService, support } = createSut();
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
    support.requireAccount
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(destination);
    context.accountRepository.save.mockImplementation(async (saved) => saved);
    context.transactionRepository.save.mockImplementation(async (saved) => saved);

    const result = await service.execute({
      sourceAccountId: source.id,
      destinationAccountId: destination.id,
      amount: '10',
      description: 'fx transfer',
      idempotencyKey: 'tr-3',
    });

    const [, credited] = context.accountRepository.save.mock.calls.map(
      ([saved]) => saved as Account,
    );

    expect(transferSettlementService.calculate).toHaveBeenCalledWith(
      Currency.USD,
      Currency.DOP,
      '10',
    );
    expect(credited.toPrimitives().balance).toBe('1605.00');
    expect(result.toPrimitives().destinationAmount).toBe('605.00');
    expect(result.toPrimitives().exchangeRateUsed).toBe('60.500000');
  });

  it('debe fallar con un error explícito cuando no existe tasa de cambio', async () => {
    const { service, support, transferSettlementService, context } = createSut();
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
    support.requireAccount
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(destination);
    transferSettlementService.calculate.mockRejectedValue(
      new ExchangeRateNotConfiguredException(Currency.USD, Currency.EUR),
    );

    await expect(
      service.execute({
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        amount: '10',
        description: 'fx transfer missing rate',
        idempotencyKey: 'tr-4',
      }),
    ).rejects.toBeInstanceOf(ExchangeRateNotConfiguredException);

    expect(support.logKnownTransactionError).toHaveBeenCalled();
    expect(context.accountRepository.save).not.toHaveBeenCalled();
    expect(context.transactionRepository.save).not.toHaveBeenCalled();
    expect(support.syncMutatedResources).not.toHaveBeenCalled();
  });
});
