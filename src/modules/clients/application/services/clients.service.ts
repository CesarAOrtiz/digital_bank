import { Injectable } from '@nestjs/common';
import { Client } from '../../domain';
import type { CreateClientInput } from '../inputs/create-client.input';
import { CreateClientUseCase } from '../use-cases/create-client.use-case';
import { ClientReadService } from './client-read.service';

@Injectable()
export class ClientsService {
  constructor(
    private readonly createClientUseCase: CreateClientUseCase,
    private readonly clientReadService: ClientReadService,
  ) {}

  create(data: CreateClientInput): Promise<Client> {
    return this.createClientUseCase.execute(data);
  }

  findAll(limit?: number, offset?: number): Promise<Client[]> {
    return this.clientReadService.findAll(limit, offset);
  }

  search(term: string, limit?: number, offset?: number): Promise<Client[]> {
    return this.clientReadService.search(term, limit, offset);
  }

  findOne(id: string): Promise<Client> {
    return this.clientReadService.findOne(id);
  }
}
