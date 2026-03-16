import { DataSourceOptions } from 'typeorm';
import { AccountOrmEntity } from '../modules/accounts/infrastructure';
import { ClientOrmEntity } from '../modules/clients/infrastructure';
import { ExchangeRateOrmEntity } from '../modules/exchange-rates/infrastructure';
import { TransactionOrmEntity } from '../modules/transactions/infrastructure';
import { join } from 'path';

export const ormEntities = [
  ClientOrmEntity,
  AccountOrmEntity,
  ExchangeRateOrmEntity,
  TransactionOrmEntity,
];

export type DatabaseConfigMode =
  | 'development-cli'
  | 'production-cli'
  | 'runtime';

function resolveMigrations(mode: DatabaseConfigMode): string[] {
  if (mode === 'production-cli') {
    return [join('dist', 'migrations', '*.js')];
  }

  if (mode === 'development-cli') {
    return [join('src', 'migrations', '*.ts')];
  }

  return [
    join('src', 'migrations', '*.ts'),
    join('dist', 'migrations', '*.js'),
  ];
}

export function createDatabaseOptions(
  mode: DatabaseConfigMode = 'runtime',
): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: ormEntities,
    migrations: resolveMigrations(mode),
    synchronize: false,
    logging: false,
    ssl: {
      rejectUnauthorized: false,
    },
  };
}
