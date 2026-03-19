import type { Client } from '../entities/client.entity';

export interface ClientRepository {
  save(client: Client): Promise<Client>;
  findAll(limit?: number, offset?: number): Promise<Client[]>;
  findPageAfterId(lastId: string | null, limit: number): Promise<Client[]>;
  findById(id: string): Promise<Client | null>;
  findByEmail(email: string): Promise<Client | null>;
  findByDocumentNumber(documentNumber: string): Promise<Client | null>;
  search(term: string): Promise<Client[]>;
}
