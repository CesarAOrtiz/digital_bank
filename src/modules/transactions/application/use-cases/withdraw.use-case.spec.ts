import { AccountStatus, Currency, TransactionType } from '../../../../common/domain/enums';
import { InsufficientFundsException } from '../../../../common/domain/exceptions';
import { Account } from '../../../accounts/domain';
import { Transaction } from '../../domain';
import type { FinancialTransactionContext } from '../contracts/financial-transaction-manager.contract';
import { TransactionIdempotencyService } from '../services/transaction-idempotency.service';
import { TransactionMutationSupportService } from '../services/transaction-mutation-support.service';
import { WithdrawUseCase } from './withdraw.use-case';

describe('WithdrawUseCase', () => {
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
      assertWithdrawalMatches: jest.fn(),
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
      service: new WithdrawUseCase(transactionIdempotencyService, support),
      context,
      support,
    };
  }

  it('debe fallar cuando no hay fondos suficientes', async () => {
    const { service, support, context } = createSut();
    support.requireAccount.mockResolvedValue(buildAccount({ balance: '10.00' }));

    await expect(
      service.execute({
        accountId: 'account-1',
        amount: '25',
        description: 'cash-out',
        idempotencyKey: 'wd-1',
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsException);

    expect(context.accountRepository.save).not.toHaveBeenCalled();
    expect(context.transactionRepository.save).not.toHaveBeenCalled();
    expect(support.invalidateClientAccountsCaches).not.toHaveBeenCalled();
    expect(support.logKnownTransactionError).toHaveBeenCalled();
  });

  it('debe invalidar caché y reindexar cuando la operación es exitosa', async () => {
    const { service, support, context } = createSut();
    const account = buildAccount({ balance: '100.00' });
    support.requireAccount.mockResolvedValue(account);
    context.accountRepository.save.mockImplementation(async (saved) => saved);
    context.transactionRepository.save.mockImplementation(async (saved) => saved);

    const result = await service.execute({
      accountId: account.id,
      amount: '40',
      description: 'atm',
      idempotencyKey: 'wd-2',
    });

    const savedAccount = context.accountRepository.save.mock.calls[0][0] as Account;
    const savedTransaction = context.transactionRepository.save.mock.calls[0][0] as Transaction;
    expect(savedAccount.toPrimitives().balance).toBe('60.00');
    expect(result.toPrimitives().type).toBe(TransactionType.WITHDRAWAL);
    expect(savedTransaction.requestFingerprint).toHaveLength(64);
    expect(support.invalidateClientAccountsCaches).toHaveBeenCalledWith(['client-1']);
    expect(support.syncMutatedResources).toHaveBeenCalledWith([savedAccount], result);
    expect(support.logTransactionCompleted).toHaveBeenCalledWith(
      'transaction.withdraw.completed',
      result,
    );
  });
});
