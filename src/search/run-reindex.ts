import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SearchReindexService } from '../modules/search/application/search-reindex.service';

async function run(): Promise<void> {
  const logger = new Logger('SearchReindexRunner');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const reindexService = app.get(SearchReindexService);
    const summary = await reindexService.reindexAll();
    logger.log(
      `Reindexación completada: ${summary.clients} clientes, ${summary.accounts} cuentas, ${summary.transactions} transacciones.`,
    );
  } catch (error) {
    logger.error(
      'La reindexación de Elasticsearch falló.',
      error instanceof Error ? error.stack : String(error),
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

run().catch((error: unknown) => {
  const logger = new Logger('SearchReindexRunner');
  logger.error(
    'No fue posible iniciar el runner de reindexación.',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
