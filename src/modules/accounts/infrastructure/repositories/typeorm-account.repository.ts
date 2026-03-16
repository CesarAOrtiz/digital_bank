import { Inject, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TYPEORM_DATA_SOURCE } from '../../../../common/infrastructure/database.tokens';
import { Account, AccountRepository } from '../../domain';
import { AccountOrmEntity } from '../entities/account.orm-entity';
import { AccountOrmMapper } from '../mappers/account.orm-mapper';

@Injectable()
export class TypeOrmAccountRepository implements AccountRepository {
  constructor(
    @Inject(TYPEORM_DATA_SOURCE) private readonly dataSource: DataSource,
  ) {}

  async save(account: Account): Promise<Account> {
    const repository = await this.getRepository();
    return AccountOrmMapper.toDomain(
      await repository.save(AccountOrmMapper.toOrm(account)),
    );
  }

  async findAll(): Promise<Account[]> {
    const repository = await this.getRepository();
    return (await repository.find()).map(AccountOrmMapper.toDomain);
  }

  async findById(id: string): Promise<Account | null> {
    const repository = await this.getRepository();
    const entity = await repository.findOne({ where: { id } });
    return entity ? AccountOrmMapper.toDomain(entity) : null;
  }

  async findByAccountNumber(accountNumber: string): Promise<Account | null> {
    const repository = await this.getRepository();
    const entity = await repository.findOne({ where: { accountNumber } });
    return entity ? AccountOrmMapper.toDomain(entity) : null;
  }

  private async getRepository(): Promise<Repository<AccountOrmEntity>> {
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }

    return this.dataSource.getRepository(AccountOrmEntity);
  }
}
