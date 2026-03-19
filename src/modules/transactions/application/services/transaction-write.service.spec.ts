import { Transaction } from '../../domain';
import { DepositUseCase } from '../use-cases/deposit.use-case';
import { TransferUseCase } from '../use-cases/transfer.use-case';
import { TransactionWriteService } from './transaction-write.service';
import { WithdrawUseCase } from '../use-cases/withdraw.use-case';

describe('TransactionWriteService', () => {
  function buildTransaction() {
    return {} as Transaction;
  }

  function createSut() {
    const depositUseCase = {
      execute: jest.fn().mockResolvedValue(buildTransaction()),
    } as unknown as jest.Mocked<DepositUseCase>;
    const withdrawUseCase = {
      execute: jest.fn().mockResolvedValue(buildTransaction()),
    } as unknown as jest.Mocked<WithdrawUseCase>;
    const transferUseCase = {
      execute: jest.fn().mockResolvedValue(buildTransaction()),
    } as unknown as jest.Mocked<TransferUseCase>;

    return {
      service: new TransactionWriteService(
        depositUseCase,
        withdrawUseCase,
        transferUseCase,
      ),
      depositUseCase,
      withdrawUseCase,
      transferUseCase,
    };
  }

  it('debe delegar deposit al caso de uso correspondiente', async () => {
    const { service, depositUseCase } = createSut();
    const input = {
      accountId: 'account-1',
      amount: '25',
      description: 'cash-in',
      idempotencyKey: 'dep-1',
    };

    await service.deposit(input);

    expect(depositUseCase.execute).toHaveBeenCalledWith(input);
  });

  it('debe delegar withdraw al caso de uso correspondiente', async () => {
    const { service, withdrawUseCase } = createSut();
    const input = {
      accountId: 'account-1',
      amount: '25',
      description: 'cash-out',
      idempotencyKey: 'wd-1',
    };

    await service.withdraw(input);

    expect(withdrawUseCase.execute).toHaveBeenCalledWith(input);
  });

  it('debe delegar transfer al caso de uso correspondiente', async () => {
    const { service, transferUseCase } = createSut();
    const input = {
      sourceAccountId: 'account-1',
      destinationAccountId: 'account-2',
      amount: '25',
      description: 'transfer',
      idempotencyKey: 'tr-1',
    };

    await service.transfer(input);

    expect(transferUseCase.execute).toHaveBeenCalledWith(input);
  });
});
