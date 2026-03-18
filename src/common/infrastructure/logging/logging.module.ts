import { Global, Module } from '@nestjs/common';
import { AppLogger } from './app-logger.service';
import { RequestContextService } from './request-context.service';
import { RequestIdMiddleware } from './request-id.middleware';

@Global()
@Module({
  providers: [RequestContextService, AppLogger, RequestIdMiddleware],
  exports: [RequestContextService, AppLogger, RequestIdMiddleware],
})
export class LoggingModule {}
