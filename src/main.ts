import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`HTTP server listening on http://0.0.0.0:${port}`);
}
bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error('Nest bootstrap failed', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
