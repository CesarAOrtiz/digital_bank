import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  DuplicateClientException,
  ResourceNotFoundException,
} from '../../../common/domain/exceptions';
import { CLIENT_REPOSITORY } from '../../../common/infrastructure/repository.tokens';
import { Client } from '../domain';
import type { ClientRepository } from '../domain';
import type { CreateClientInput } from './inputs/create-client.input';

@Injectable()
export class ClientsService {
  constructor(
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
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

    return this.clientRepository.save(
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
  }

  findAll(): Promise<Client[]> {
    return this.clientRepository.findAll();
  }

  search(term: string): Promise<Client[]> {
    return this.clientRepository.search(term.trim());
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.clientRepository.findById(id);
    if (!client) {
      throw new ResourceNotFoundException(`Client ${id} not found.`);
    }

    return client;
  }
}
