import type { Account } from '../entities/account.entity';

export interface AccountRepository {
  save(account: Account): Promise<Account>;
  findAll(): Promise<Account[]>;
  findById(id: string): Promise<Account | null>;
  findByAccountNumber(accountNumber: string): Promise<Account | null>;
  findByClientId(clientId: string): Promise<Account[]>;
  search(term: string): Promise<Account[]>;
}
