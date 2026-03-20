import { DuplicateClientException } from '../../../../common/domain/exceptions';
import { SearchIndexingService } from '../../../search/infrastructure/elastic/search-indexing.service';
import { ClientCacheService } from '../services/client-cache.service';
import { CreateClientUseCase } from './create-client.use-case';

describe('CreateClientUseCase', () => {
  function createSut() {
    const clientRepository = {
      findByEmail: jest.fn(),
      findByDocumentNumber: jest.fn(),
      save: jest.fn(),
    };
    const clientCacheService = {
      invalidateClientCache: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientCacheService>;
    const searchIndexingService = {
      indexClient: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SearchIndexingService>;

    const service = new CreateClientUseCase(
      clientRepository as never,
      clientCacheService,
      searchIndexingService,
    );

    return {
      service,
      clientRepository,
      clientCacheService,
      searchIndexingService,
    };
  }

  it('debe crear el cliente, invalidar caché e indexarlo', async () => {
    const {
      service,
      clientRepository,
      clientCacheService,
      searchIndexingService,
    } = createSut();
    clientRepository.findByEmail.mockResolvedValue(null);
    clientRepository.findByDocumentNumber.mockResolvedValue(null);
    clientRepository.save.mockImplementation(async (client) => client);

    const result = await service.execute({
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      email: ' ADA@EXAMPLE.COM ',
      documentNumber: ' DOC-1 ',
    });

    expect(result.toPrimitives()).toEqual(
      expect.objectContaining({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        documentNumber: 'DOC-1',
      }),
    );
    expect(clientCacheService.invalidateClientCache).toHaveBeenCalledWith(
      result.id,
    );
    expect(searchIndexingService.indexClient).toHaveBeenCalledWith(result);
  });

  it('debe rechazar emails duplicados', async () => {
    const { service, clientRepository } = createSut();
    clientRepository.findByEmail.mockResolvedValue({ id: 'client-1' });

    await expect(
      service.execute({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        documentNumber: 'DOC-1',
      }),
    ).rejects.toBeInstanceOf(DuplicateClientException);
  });
});
