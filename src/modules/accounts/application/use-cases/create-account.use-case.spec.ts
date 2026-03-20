import { Currency } from '../../../../common/domain/enums';
import { DuplicateResourceException } from '../../../../common/domain/exceptions';
import { SearchIndexingService } from '../../../search/infrastructure/elastic/search-indexing.service';
import { CreateAccountUseCase } from './create-account.use-case';
import { ClientAccountsCacheService } from '../services/client-accounts-cache.service';

describe('CreateAccountUseCase', () => {
  function createSut() {
    const accountRepository = {
      findByAccountNumber: jest.fn(),
      save: jest.fn(),
    };
    const clientRepository = {
      findById: jest.fn(),
    };
    const clientAccountsCacheService = {
      invalidateClientAccountsCache: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientAccountsCacheService>;
    const searchIndexingService = {
      indexAccount: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SearchIndexingService>;

    const service = new CreateAccountUseCase(
      accountRepository as never,
      clientRepository as never,
      clientAccountsCacheService,
      searchIndexingService,
    );

    return {
      service,
      accountRepository,
      clientRepository,
      clientAccountsCacheService,
      searchIndexingService,
    };
  }

  it('debe crear la cuenta, invalidar caché e indexarla', async () => {
    const {
      service,
      accountRepository,
      clientRepository,
      clientAccountsCacheService,
      searchIndexingService,
    } = createSut();
    clientRepository.findById.mockResolvedValue({ id: 'client-1' });
    accountRepository.findByAccountNumber.mockResolvedValue(null);
    accountRepository.save.mockImplementation(async (account) => account);

    const result = await service.execute({
      clientId: 'client-1',
      accountNumber: ' ACC-001 ',
      currency: Currency.USD,
      initialBalance: '10.25',
    });

    expect(accountRepository.save).toHaveBeenCalledTimes(1);
    expect(result.toPrimitives()).toEqual(
      expect.objectContaining({
        accountNumber: 'ACC-001',
        clientId: 'client-1',
        currency: Currency.USD,
        balance: '10.25',
      }),
    );
    expect(clientAccountsCacheService.invalidateClientAccountsCache).toHaveBeenCalledWith(
      'client-1',
    );
    expect(searchIndexingService.indexAccount).toHaveBeenCalledWith(result);
  });

  it('debe rechazar números de cuenta duplicados', async () => {
    const { service, accountRepository, clientRepository } = createSut();
    clientRepository.findById.mockResolvedValue({ id: 'client-1' });
    accountRepository.findByAccountNumber.mockResolvedValue({ id: 'account-1' });

    await expect(
      service.execute({
        clientId: 'client-1',
        accountNumber: 'ACC-001',
        currency: Currency.USD,
      }),
    ).rejects.toBeInstanceOf(DuplicateResourceException);
  });
});
