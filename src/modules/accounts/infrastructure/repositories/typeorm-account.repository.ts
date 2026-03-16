import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TYPEORM_DATA_SOURCE } from '../../../../common/infrastructure/database.tokens';
import { Account, AccountRepository } from '../../domain';
import { AccountOrmEntity } from '../entities/account.orm-entity';
import { AccountOrmMapper } from '../mappers/account.orm-mapper';

@Injectable()
export class TypeOrmAccountRepository implements AccountRepository {
  constructor(
    @Inject(TYPEORM_DATA_SOURCE) private readonly dataSource: DataSource,
    @Optional() private readonly entityManager?: EntityManager,
  ) {}

  withManager(entityManager: EntityManager): TypeOrmAccountRepository {
    return new TypeOrmAccountRepository(this.dataSource, entityManager);
  }

  async lockAccounts(accountIds: string[]): Promise<void> {
    const repository = await this.getRepository();
    const uniqueSortedIds = [...new Set(accountIds)].sort((left, right) =>
      left.localeCompare(right),
    );
    for (const id of uniqueSortedIds) {
      await repository
        .createQueryBuilder('account')
        .setLock('pessimistic_write')
        .where('account.id = :id', { id })
        .getOne();
    }
  }

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
    if (this.entityManager) {
      return this.entityManager.getRepository(AccountOrmEntity);
    }

    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }

    return this.dataSource.getRepository(AccountOrmEntity);
  }
}
