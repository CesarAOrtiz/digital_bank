import { Inject, Injectable } from '@nestjs/common';
import { normalizePagination } from '../../../../common/application/pagination';
import { ResourceNotFoundException } from '../../../../common/domain/exceptions';
import { CLIENT_REPOSITORY } from '../../../../common/infrastructure/repository.tokens';
import { SearchQueryService } from '../../../search/application/services/search-query.service';
import { Client } from '../../domain';
import type { ClientRepository } from '../../domain';
import { ClientCacheService } from './client-cache.service';

@Injectable()
export class ClientReadService {
  constructor(
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    private readonly clientCacheService: ClientCacheService,
    private readonly searchQueryService: SearchQueryService,
  ) {}

  findAll(limit?: number, offset?: number): Promise<Client[]> {
    const page = normalizePagination({ limit, offset });
    return this.clientRepository.findAll(page.limit, page.offset);
  }

  search(term: string, limit?: number, offset?: number): Promise<Client[]> {
    const page = normalizePagination({ limit, offset });
    return this.searchQueryService.searchClients(term, page.limit, page.offset);
  }

  findOne(id: string): Promise<Client> {
    return this.clientCacheService.findOne(id.trim(), async (normalizedId) => {
      const client = await this.clientRepository.findById(normalizedId);
      if (!client) {
        throw new ResourceNotFoundException(`Client ${normalizedId} not found.`);
      }

      return client;
    });
  }
}
