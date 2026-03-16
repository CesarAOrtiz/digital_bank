import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TYPEORM_DATA_SOURCE } from '../../../../common/infrastructure/database.tokens';
import { TransactionType } from '../../../../common/domain/enums';
import { Transaction } from '../../domain';
import type {
  TransactionRepository,
  TransactionSearchFilters,
} from '../../domain';
import { TransactionOrmEntity } from '../entities/transaction.orm-entity';
import { TransactionOrmMapper } from '../mappers/transaction.orm-mapper';

@Injectable()
export class TypeOrmTransactionRepository implements TransactionRepository {
  constructor(
    @Inject(TYPEORM_DATA_SOURCE) private readonly dataSource: DataSource,
    @Optional() private readonly entityManager?: EntityManager,
  ) {}

  withManager(entityManager: EntityManager): TypeOrmTransactionRepository {
    return new TypeOrmTransactionRepository(this.dataSource, entityManager);
  }

  async save(transaction: Transaction): Promise<Transaction> {
    const repository = await this.getRepository();
    return TransactionOrmMapper.toDomain(
      await repository.save(TransactionOrmMapper.toOrm(transaction)),
    );
  }

  async findAll(): Promise<Transaction[]> {
    const repository = await this.getRepository();
    return (
      await repository.find({
        order: {
          createdAt: 'DESC',
        },
      })
    ).map(TransactionOrmMapper.toDomain);
  }

  async findById(id: string): Promise<Transaction | null> {
    const repository = await this.getRepository();
    const entity = await repository.findOne({ where: { id } });
    return entity ? TransactionOrmMapper.toDomain(entity) : null;
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
    type: TransactionType,
  ): Promise<Transaction | null> {
    const repository = await this.getRepository();
    const entity = await repository.findOne({ where: { idempotencyKey, type } });
    return entity ? TransactionOrmMapper.toDomain(entity) : null;
  }

  async search(filters: TransactionSearchFilters): Promise<Transaction[]> {
    const repository = await this.getRepository();
    const query = repository.createQueryBuilder('transaction');

    if (filters.type) {
      query.andWhere('transaction.type = :type', { type: filters.type });
    }
    if (filters.accountId) {
      query.andWhere(
        '(transaction.sourceAccountId = :accountId OR transaction.destinationAccountId = :accountId)',
        { accountId: filters.accountId },
      );
    }
    if (filters.text) {
      query.andWhere(
        "(LOWER(COALESCE(transaction.description, '')) LIKE :text OR LOWER(COALESCE(transaction.idempotencyKey, '')) LIKE :text OR CAST(transaction.id as text) LIKE :text)",
        { text: `%${filters.text.toLowerCase()}%` },
      );
    }

    return (await query.orderBy('transaction.createdAt', 'DESC').getMany()).map(
      TransactionOrmMapper.toDomain,
    );
  }

  private async getRepository(): Promise<Repository<TransactionOrmEntity>> {
    if (this.entityManager) {
      return this.entityManager.getRepository(TransactionOrmEntity);
    }

    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }

    return this.dataSource.getRepository(TransactionOrmEntity);
  }
}
