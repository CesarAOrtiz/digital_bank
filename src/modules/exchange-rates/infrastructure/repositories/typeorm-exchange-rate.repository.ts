import { Inject, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TYPEORM_DATA_SOURCE } from '../../../../common/infrastructure/database.tokens';
import { Currency } from '../../../../common/domain/enums';
import { ExchangeRate, ExchangeRateRepository } from '../../domain';
import { ExchangeRateOrmEntity } from '../entities/exchange-rate.orm-entity';
import { ExchangeRateOrmMapper } from '../mappers/exchange-rate.orm-mapper';

@Injectable()
export class TypeOrmExchangeRateRepository implements ExchangeRateRepository {
  constructor(@Inject(TYPEORM_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async save(exchangeRate: ExchangeRate): Promise<ExchangeRate> {
    const repository = await this.getRepository();
    return ExchangeRateOrmMapper.toDomain(await repository.save(ExchangeRateOrmMapper.toOrm(exchangeRate)));
  }

  async findAll(): Promise<ExchangeRate[]> {
    const repository = await this.getRepository();
    return (
      await repository.find({
        order: {
          effectiveAt: 'DESC',
        },
      })
    ).map(ExchangeRateOrmMapper.toDomain);
  }

  async findLatest(baseCurrency: Currency, targetCurrency: Currency, effectiveAt: Date): Promise<ExchangeRate | null> {
    const repository = await this.getRepository();
    const entity =
      (await repository
        .createQueryBuilder('exchangeRate')
        .where('exchangeRate.baseCurrency = :baseCurrency', { baseCurrency })
        .andWhere('exchangeRate.targetCurrency = :targetCurrency', { targetCurrency })
        .andWhere('exchangeRate.effectiveAt <= :effectiveAt', { effectiveAt })
        .orderBy('exchangeRate.effectiveAt', 'DESC')
        .getOne()) ?? null;

    return entity ? ExchangeRateOrmMapper.toDomain(entity) : null;
  }

  private async getRepository(): Promise<Repository<ExchangeRateOrmEntity>> {
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }

    return this.dataSource.getRepository(ExchangeRateOrmEntity);
  }
}
