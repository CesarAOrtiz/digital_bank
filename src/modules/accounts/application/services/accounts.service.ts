import { Injectable } from '@nestjs/common';
import { Account } from '../../domain';
import type { CreateAccountInput } from '../inputs/create-account.input';
import { CreateAccountUseCase } from '../use-cases/create-account.use-case';
import { AccountReadService } from './account-read.service';

@Injectable()
export class AccountsService {
  constructor(
    private readonly createAccountUseCase: CreateAccountUseCase,
    private readonly accountReadService: AccountReadService,
  ) {}

  create(data: CreateAccountInput): Promise<Account> {
    return this.createAccountUseCase.execute(data);
  }

  findAll(limit?: number, offset?: number): Promise<Account[]> {
    return this.accountReadService.findAll(limit, offset);
  }

  findByClient(
    clientId: string,
    limit?: number,
    offset?: number,
  ): Promise<Account[]> {
    return this.accountReadService.findByClient(clientId, limit, offset);
  }

  findByAccountNumber(accountNumber: string): Promise<Account> {
    return this.accountReadService.findByAccountNumber(accountNumber);
  }

  search(term: string, limit?: number, offset?: number): Promise<Account[]> {
    return this.accountReadService.search(term, limit, offset);
  }

  findOne(id: string): Promise<Account> {
    return this.accountReadService.findOne(id);
  }
}
