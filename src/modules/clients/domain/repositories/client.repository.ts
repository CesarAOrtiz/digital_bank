import type { Client } from '../entities/client.entity';

export interface ClientRepository {
  save(client: Client): Promise<Client>;
  findAll(): Promise<Client[]>;
  findById(id: string): Promise<Client | null>;
  findByEmail(email: string): Promise<Client | null>;
  findByDocumentNumber(documentNumber: string): Promise<Client | null>;
}
