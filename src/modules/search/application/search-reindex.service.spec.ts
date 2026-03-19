import { AccountStatus, Currency, TransactionType } from '../../../common/domain/enums';
import { AppLogger } from '../../../common/infrastructure/logging/app-logger.service';
import { Account } from '../../accounts/domain';
import { Client } from '../../clients/domain';
import { Transaction } from '../../transactions/domain';
import { SearchIndexingService } from './search-indexing.service';
import { SearchReindexService } from './search-reindex.service';

describe('SearchReindexService', () => {
  function createSut() {
    const clientRepository = {
      findPageAfterId: jest
        .fn()
        .mockResolvedValueOnce([
          new Client({
            id: 'client-1',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@example.com',
            documentNumber: 'DOC-1',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          }),
        ])
        .mockResolvedValueOnce([]),
    };
    const accountRepository = {
      findPageAfterId: jest
        .fn()
        .mockResolvedValueOnce([
          new Account({
            id: 'account-1',
            accountNumber: 'ACC-001',
            clientId: 'client-1',
            currency: Currency.USD,
            balance: '100.00',
            status: AccountStatus.ACTIVE,
            createdAt: new Date('2026-01-03T00:00:00.000Z'),
            updatedAt: new Date('2026-01-04T00:00:00.000Z'),
          }),
        ])
        .mockResolvedValueOnce([]),
    };
    const transactionRepository = {
      findPageAfterId: jest
        .fn()
        .mockResolvedValueOnce([
          new Transaction({
            id: 'tx-1',
            type: TransactionType.DEPOSIT,
            sourceAccountId: null,
            destinationAccountId: 'account-1',
            sourceCurrency: Currency.USD,
            destinationCurrency: Currency.USD,
            sourceAmount: '25.00',
            destinationAmount: '25.00',
            exchangeRateUsed: null,
            idempotencyKey: 'dep-1',
            description: 'cash-in',
            createdAt: new Date('2026-01-05T00:00:00.000Z'),
          }),
        ])
        .mockResolvedValueOnce([]),
    };
    const searchIndexingService = {
      ensureIndices: jest.fn().mockResolvedValue(undefined),
      recreateIndices: jest.fn().mockResolvedValue(undefined),
      indexClient: jest.fn().mockResolvedValue(undefined),
      indexAccount: jest.fn().mockResolvedValue(undefined),
      indexTransaction: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SearchIndexingService>;
    const appLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<AppLogger>;

    return {
      service: new SearchReindexService(
        clientRepository as never,
        accountRepository as never,
        transactionRepository as never,
        searchIndexingService,
        appLogger,
      ),
      clientRepository,
      accountRepository,
      transactionRepository,
      searchIndexingService,
      appLogger,
    };
  }

  it('debe asegurar índices y reindexar clientes, cuentas y transacciones desde PostgreSQL', async () => {
    const {
      service,
      clientRepository,
      accountRepository,
      transactionRepository,
      searchIndexingService,
      appLogger,
    } = createSut();

    const summary = await service.reindexAll();

    expect(searchIndexingService.recreateIndices).not.toHaveBeenCalled();
    expect(searchIndexingService.ensureIndices).toHaveBeenCalled();
    expect(clientRepository.findPageAfterId).toHaveBeenNthCalledWith(1, null, 200);
    expect(clientRepository.findPageAfterId).toHaveBeenNthCalledWith(
      2,
      'client-1',
      200,
    );
    expect(accountRepository.findPageAfterId).toHaveBeenNthCalledWith(
      1,
      null,
      200,
    );
    expect(accountRepository.findPageAfterId).toHaveBeenNthCalledWith(
      2,
      'account-1',
      200,
    );
    expect(transactionRepository.findPageAfterId).toHaveBeenNthCalledWith(
      1,
      null,
      200,
    );
    expect(transactionRepository.findPageAfterId).toHaveBeenNthCalledWith(
      2,
      'tx-1',
      200,
    );
    expect(searchIndexingService.indexClient).toHaveBeenCalledTimes(1);
    expect(searchIndexingService.indexAccount).toHaveBeenCalledTimes(1);
    expect(searchIndexingService.indexTransaction).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({
      clients: 1,
      accounts: 1,
      transactions: 1,
    });
    expect(appLogger.log).toHaveBeenCalledWith('search.reindex.started');
    expect(appLogger.log).toHaveBeenCalledWith('search.reindex.completed', {
      clients: 1,
      accounts: 1,
      transactions: 1,
    });
  });
});
