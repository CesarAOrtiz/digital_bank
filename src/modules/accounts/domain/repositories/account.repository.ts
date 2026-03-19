import type { Account } from '../entities/account.entity';

export interface AccountRepository {
  save(account: Account): Promise<Account>;
  findAll(limit?: number, offset?: number): Promise<Account[]>;
  findPageAfterId(lastId: string | null, limit: number): Promise<Account[]>;
  findById(id: string): Promise<Account | null>;
  findByAccountNumber(accountNumber: string): Promise<Account | null>;
  findByClientId(clientId: string, limit?: number, offset?: number): Promise<Account[]>;
  search(term: string): Promise<Account[]>;
}
