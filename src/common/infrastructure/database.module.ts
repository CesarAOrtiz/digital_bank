import 'dotenv/config';
import { Global, Logger, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createDatabaseOptions } from '../../config/database.config';
import { TYPEORM_DATA_SOURCE } from './database.tokens';

@Global()
@Module({
  providers: [
    {
      provide: TYPEORM_DATA_SOURCE,
      useFactory: () => {
        const logger = new Logger('TypeOrmDataSourceProvider');
        const dataSource = new DataSource(createDatabaseOptions());
        logger.log('TypeORM DataSource configured for lazy initialization.');
        return dataSource;
      },
    },
  ],
  exports: [TYPEORM_DATA_SOURCE],
})
export class DatabaseModule {}
