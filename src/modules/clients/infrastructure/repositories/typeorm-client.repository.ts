import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TYPEORM_DATA_SOURCE } from '../../../../common/infrastructure/database.tokens';
import { Client, ClientRepository } from '../../domain';
import { ClientOrmEntity } from '../entities/client.orm-entity';
import { ClientOrmMapper } from '../mappers/client.orm-mapper';

@Injectable()
export class TypeOrmClientRepository implements ClientRepository {
  constructor(
    @Inject(TYPEORM_DATA_SOURCE) private readonly dataSource: DataSource,
    @Optional() private readonly entityManager?: EntityManager,
  ) {}

  withManager(entityManager: EntityManager): TypeOrmClientRepository {
    return new TypeOrmClientRepository(this.dataSource, entityManager);
  }

  async save(client: Client): Promise<Client> {
    const repository = await this.getRepository();
    return ClientOrmMapper.toDomain(
      await repository.save(ClientOrmMapper.toOrm(client)),
    );
  }

  async findAll(): Promise<Client[]> {
    const repository = await this.getRepository();
    return (await repository.find()).map(ClientOrmMapper.toDomain);
  }

  async findById(id: string): Promise<Client | null> {
    const repository = await this.getRepository();
    const entity = await repository.findOne({ where: { id } });
    return entity ? ClientOrmMapper.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<Client | null> {
    const repository = await this.getRepository();
    const entity = await repository.findOne({ where: { email } });
    return entity ? ClientOrmMapper.toDomain(entity) : null;
  }

  async findByDocumentNumber(documentNumber: string): Promise<Client | null> {
    const repository = await this.getRepository();
    const entity = await repository.findOne({ where: { documentNumber } });
    return entity ? ClientOrmMapper.toDomain(entity) : null;
  }

  private async getRepository(): Promise<Repository<ClientOrmEntity>> {
    if (this.entityManager) {
      return this.entityManager.getRepository(ClientOrmEntity);
    }

    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }

    return this.dataSource.getRepository(ClientOrmEntity);
  }
}
