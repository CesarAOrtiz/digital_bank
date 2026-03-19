import { AccountStatus, Currency, TransactionType } from '../../../../common/domain/enums';
import { IdempotencyKeyReuseException } from '../../../../common/domain/exceptions';
import { Account } from '../../../accounts/domain';
import { Transaction } from '../../domain';
import type { FinancialTransactionContext } from '../contracts/financial-transaction-manager.contract';
import { TransactionIdempotencyService } from '../services/transaction-idempotency.service';
import { TransactionMutationSupportService } from '../services/transaction-mutation-support.service';
import { DepositUseCase } from './deposit.use-case';

describe('DepositUseCase', () => {
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
      assertDepositMatches: jest.fn(),
      normalizeDescription: jest
        .fn()
        .mockImplementation((description?: string | null) => description?.trim() || null),
    } as unknown as jest.Mocked<TransactionIdempotencyService>;

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
      service: new DepositUseCase(transactionIdempotencyService, support),
      context,
      transactionIdempotencyService,
      support,
    };
  }

  it('debe crear la transacción y sincronizar recursos mutados', async () => {
    const { service, context, support } = createSut();
    const account = buildAccount();
    support.requireAccount.mockResolvedValue(account);
    context.accountRepository.save.mockImplementation(async (saved) => saved);
    context.transactionRepository.save.mockImplementation(async (saved) => saved);

    const result = await service.execute({
      accountId: account.id,
      amount: '25',
      description: '  cash-in ',
      idempotencyKey: 'dep-1',
    });

    const savedAccount = context.accountRepository.save.mock.calls[0][0] as Account;
    const savedTransaction = context.transactionRepository.save.mock.calls[0][0] as Transaction;
    expect(savedAccount.toPrimitives().balance).toBe('125.00');
    expect(result.toPrimitives().type).toBe(TransactionType.DEPOSIT);
    expect(savedTransaction.requestFingerprint).toHaveLength(64);
    expect(support.invalidateClientAccountsCaches).toHaveBeenCalledWith(['client-1']);
    expect(support.syncMutatedResources).toHaveBeenCalledWith([savedAccount], result);
    expect(support.logTransactionCompleted).toHaveBeenCalledWith(
      'transaction.deposit.completed',
      result,
    );
  });

  it('debe devolver la transacción existente cuando la idempotency key se reutiliza con el mismo payload', async () => {
    const { service, context, transactionIdempotencyService, support } = createSut();
    const existing = buildTransaction();
    transactionIdempotencyService.findExistingTransaction.mockResolvedValue(existing);

    const result = await service.execute({
      accountId: 'account-1',
      amount: '25',
      description: 'cash-in',
      idempotencyKey: 'idem-1',
    });

    expect(result).toBe(existing);
    expect(context.accountRepository.save).not.toHaveBeenCalled();
    expect(context.transactionRepository.save).not.toHaveBeenCalled();
    expect(support.invalidateClientAccountsCaches).not.toHaveBeenCalled();
    expect(support.syncMutatedResources).not.toHaveBeenCalled();
    expect(support.logIdempotentReplay).toHaveBeenCalledWith(
      'transaction.deposit.idempotency_reused',
      existing,
    );
  });

  it('debe fallar cuando se reutiliza la idempotency key con un payload distinto', async () => {
    const { service, transactionIdempotencyService, support } = createSut();
    const existing = buildTransaction({ idempotencyKey: 'idem-2' });
    transactionIdempotencyService.findExistingTransaction.mockResolvedValue(existing);
    transactionIdempotencyService.assertDepositMatches.mockImplementation(() => {
      throw new IdempotencyKeyReuseException();
    });

    await expect(
      service.execute({
        accountId: 'account-1',
        amount: '50',
        description: 'cash-in',
        idempotencyKey: 'idem-2',
      }),
    ).rejects.toBeInstanceOf(IdempotencyKeyReuseException);

    expect(support.logKnownTransactionError).toHaveBeenCalled();
    expect(support.syncMutatedResources).not.toHaveBeenCalled();
  });
});
