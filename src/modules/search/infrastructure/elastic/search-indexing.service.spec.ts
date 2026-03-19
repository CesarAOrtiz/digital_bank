import { Logger } from '@nestjs/common';
import { SearchIndexingService } from './search-indexing.service';

describe('SearchIndexingService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('no debe propagar error si Elastic falla durante el bootstrap', async () => {
    const elastic = {
      indices: {
        exists: jest.fn().mockRejectedValue(new Error('elastic down')),
        create: jest.fn(),
      },
      index: jest.fn(),
    };
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const service = new SearchIndexingService(elastic as never);

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Elasticsearch unavailable during startup. Search bootstrap skipped: elastic down',
      ),
    );
  });
});
