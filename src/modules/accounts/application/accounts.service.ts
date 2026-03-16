import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { formatMoney, roundMoney } from '../../../common/application/money';
import { AccountStatus } from '../../../common/domain/enums';
import {
  DomainRuleViolationException,
  DuplicateResourceException,
  ResourceNotFoundException,
} from '../../../common/domain/exceptions';
import {
  ACCOUNT_REPOSITORY,
  CLIENT_REPOSITORY,
} from '../../../common/infrastructure/repository.tokens';
import type { ClientRepository } from '../../clients/domain';
import { Account } from '../domain';
import type { AccountRepository } from '../domain';
import type { CreateAccountInput } from './inputs/create-account.input';

@Injectable()
export class AccountsService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepository,
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
  ) {}

  async create(data: CreateAccountInput): Promise<Account> {
    if (!(await this.clientRepository.findById(data.clientId))) {
      throw new ResourceNotFoundException(`Client ${data.clientId} not found.`);
    }

    const accountNumber = data.accountNumber.trim();
    if (await this.accountRepository.findByAccountNumber(accountNumber)) {
      throw new DuplicateResourceException(
        `Account number ${accountNumber} already exists.`,
      );
    }

    const initialBalance = roundMoney(data.initialBalance ?? '0');
    if (initialBalance.lt(0)) {
      throw new DomainRuleViolationException(
        'Initial balance cannot be negative.',
      );
    }

    const now = new Date();
    return this.accountRepository.save(
      new Account({
        id: randomUUID(),
        accountNumber,
        clientId: data.clientId,
        currency: data.currency,
        balance: formatMoney(initialBalance),
        status: AccountStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  findAll(): Promise<Account[]> {
    return this.accountRepository.findAll();
  }

  async findOne(id: string): Promise<Account> {
    const account = await this.accountRepository.findById(id);
    if (!account) {
      throw new ResourceNotFoundException(`Account ${id} not found.`);
    }

    return account;
  }
}
