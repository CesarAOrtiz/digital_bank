import { Inject, Injectable } from '@nestjs/common';
import { normalizePagination } from '../../../../common/application/pagination';
import { AppLogger } from '../../../../common/infrastructure/logging/app-logger.service';
import { CLIENT_REPOSITORY } from '../../../../common/infrastructure/repository.tokens';
import type { ClientRepository } from '../../../clients/domain';
import { Client } from '../../../clients/domain';
import { SearchElasticReaderService } from '../../infrastructure/elastic/search-elastic-reader.service';
import { CLIENTS_INDEX } from '../../infrastructure/elastic/search-index.constants';
import { SearchExecutionService } from '../services/search-execution.service';

@Injectable()
export class SearchClientsUseCase {
  constructor(
    private readonly searchElasticReaderService: SearchElasticReaderService,
    private readonly searchExecutionService: SearchExecutionService,
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    private readonly appLogger: AppLogger,
  ) {}

  async execute(term: string, limit?: number, offset?: number): Promise<Client[]> {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) {
      return [];
    }

    const startedAt = Date.now();
    const page = normalizePagination({ limit, offset });
    const metadata = {
      term: normalizedTerm,
      offset: page.offset,
      limit: page.limit,
    };

    const clients = await this.searchExecutionService.runWithFallback(
      'clients',
      () => this.searchElasticReaderService.searchClients(normalizedTerm, page),
      async () =>
        this.searchExecutionService.paginateResults(
          await this.clientRepository.search(normalizedTerm),
          page,
        ),
      metadata,
    );

    this.appLogger.log('search.clients.executed', {
      index: CLIENTS_INDEX,
      ...metadata,
      resultCount: clients.length,
      durationMs: Date.now() - startedAt,
    });

    return clients;
  }
}
