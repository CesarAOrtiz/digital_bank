import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TYPEORM_DATA_SOURCE } from '../../../common/infrastructure/database.tokens';
import { TypeOrmAccountRepository } from '../../accounts/infrastructure';
import { TypeOrmExchangeRateRepository } from '../../exchange-rates/infrastructure';
import type {
  FinancialTransactionContext,
  FinancialTransactionManager,
  FinancialTransactionOptions,
} from '../application/contracts/financial-transaction-manager.contract';
import { TypeOrmTransactionRepository } from './index';

@Injectable()
export class TypeOrmFinancialTransactionManager implements FinancialTransactionManager {
  private readonly logger = new Logger(TypeOrmFinancialTransactionManager.name);

  constructor(
    @Inject(TYPEORM_DATA_SOURCE) private readonly dataSource: DataSource,
    private readonly accountRepository: TypeOrmAccountRepository,
    private readonly exchangeRateRepository: TypeOrmExchangeRateRepository,
    private readonly transactionRepository: TypeOrmTransactionRepository,
  ) {}

  async execute<T>(
    options: FinancialTransactionOptions,
    callback: (context: FinancialTransactionContext) => Promise<T>,
  ): Promise<T> {
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const accountRepository = this.accountRepository.withManager(
        queryRunner.manager,
      );
      const transactionRepository = this.transactionRepository.withManager(
        queryRunner.manager,
      );
      const exchangeRateRepository = this.exchangeRateRepository.withManager(
        queryRunner.manager,
      );

      await accountRepository.lockAccounts(options.lockAccountIds ?? []);
      this.logger.log(`Begin ${options.operationName}`);

      const result = await callback({
        accountRepository,
        exchangeRateRepository,
        transactionRepository,
      });

      await queryRunner.commitTransaction();
      this.logger.log(`Commit ${options.operationName}`);
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.warn(
        `Rollback ${options.operationName}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
