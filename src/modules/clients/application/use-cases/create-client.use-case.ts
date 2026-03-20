import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DuplicateClientException } from '../../../../common/domain/exceptions';
import { CLIENT_REPOSITORY } from '../../../../common/infrastructure/repository.tokens';
import { SearchIndexingService } from '../../../search/infrastructure/elastic/search-indexing.service';
import { Client } from '../../domain';
import type { ClientRepository } from '../../domain';
import type { CreateClientInput } from '../inputs/create-client.input';
import { ClientCacheService } from '../services/client-cache.service';

@Injectable()
export class CreateClientUseCase {
  constructor(
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    private readonly clientCacheService: ClientCacheService,
    private readonly searchIndexingService: SearchIndexingService,
  ) {}

  async execute(data: CreateClientInput): Promise<Client> {
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

    await this.clientCacheService.invalidateClientCache(client.id);
    await this.searchIndexingService.indexClient(client);

    return client;
  }
}
