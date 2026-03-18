import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RequestContextService } from './request-context.service';

@Injectable()
export class AppLogger {
  private readonly logger = new Logger('App');
  private readonly serviceName =
    process.env.APP_SERVICE_NAME?.trim() || 'digital_bank';
  private readonly environment = process.env.NODE_ENV?.trim() || 'development';

  constructor(private readonly requestContextService: RequestContextService) {}

  log(event: string, data: Record<string, unknown> = {}): void {
    this.logger.log(this.serialize('info', event, data));
  }

  warn(event: string, data: Record<string, unknown> = {}): void {
    this.logger.warn(this.serialize('warn', event, data));
  }

  error(
    event: string,
    error: unknown,
    data: Record<string, unknown> = {},
  ): void {
    const payload = {
      ...data,
      error: error instanceof Error ? error.message : String(error),
      errorCode:
        typeof error === 'object' &&
        error &&
        'errorCode' in error &&
        typeof (error as { errorCode?: unknown }).errorCode === 'string'
          ? (error as { errorCode: string }).errorCode
          : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    };

    this.logger.error(this.serialize('error', event, payload));
  }

  private serialize(
    level: 'info' | 'warn' | 'error',
    event: string,
    data: Record<string, unknown>,
  ): string {
    return JSON.stringify({
      level,
      event,
      timestamp: new Date().toISOString(),
      requestId: this.requestContextService.getRequestId() ?? randomUUID(),
      service: this.serviceName,
      env: this.environment,
      ...data,
    });
  }
}
