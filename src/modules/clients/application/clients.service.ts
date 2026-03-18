import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  DuplicateClientException,
  ResourceNotFoundException,
} from '../../../common/domain/exceptions';
import {
  RedisCacheKeys,
  RedisCacheTtl,
} from '../../../common/infrastructure/redis/redis-cache.keys';
import { RedisCacheService } from '../../../common/infrastructure/redis/redis-cache.service';
import { CLIENT_REPOSITORY } from '../../../common/infrastructure/repository.tokens';
import { Client } from '../domain';
import type { ClientRepository } from '../domain';
import type { CreateClientInput } from './inputs/create-client.input';
import { SearchIndexingService } from '../../search/application/search-indexing.service';
import { SearchQueryService } from '../../search/application/search-query.service';

@Injectable()
export class ClientsService {
  constructor(
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    private readonly redisCacheService: RedisCacheService,
    private readonly searchIndexingService: SearchIndexingService,
    private readonly searchQueryService: SearchQueryService,
  ) {}

  async create(data: CreateClientInput): Promise<Client> {
    const email = data.email.trim().toLowerCase();
    const documentNumber = data.documentNumber.trim();

    if (await this.clientRepository.findByEmail(email)) {
      throw new DuplicateClientException('email', email);
    }

    if (await this.clientRepository.findByDocumentNumber(documentNumber)) {
      throw new DuplicateClientException('documentNumber', documentNumber);
    }

    const now = new Date();

    const client = await this.clientRepository.save(
      new Client({
        id: randomUUID(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email,
        documentNumber,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await this.redisCacheService.del(RedisCacheKeys.client(client.id));
    await this.searchIndexingService.indexClient(client);
    return client;
  }

  findAll(): Promise<Client[]> {
    return this.clientRepository.findAll();
  }

  search(term: string): Promise<Client[]> {
    return this.searchQueryService.searchClients(term);
  }

  async findOne(id: string): Promise<Client> {
    const normalizedId = id.trim();
    const cacheKey = RedisCacheKeys.client(normalizedId);
    const cached = await this.redisCacheService.get<ReturnType<Client['toPrimitives']>>(
      cacheKey,
    );
    if (cached) {
      return new Client({
        ...cached,
        createdAt: new Date(cached.createdAt),
        updatedAt: new Date(cached.updatedAt),
      });
    }

    const client = await this.clientRepository.findById(normalizedId);
    if (!client) {
      throw new ResourceNotFoundException(`Client ${normalizedId} not found.`);
    }

    await this.redisCacheService.set(
      cacheKey,
      client.toPrimitives(),
      RedisCacheTtl.client,
    );
    return client;
  }
}
