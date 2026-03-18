import { randomUUID } from 'crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AppLogger } from './app-logger.service';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(
    private readonly requestContextService: RequestContextService,
    private readonly appLogger: AppLogger,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId =
      (req.headers['x-request-id'] as string | undefined)?.trim() ||
      randomUUID();
    const startedAt = Date.now();

    req['requestId'] = requestId;
    res.setHeader('x-request-id', requestId);

    this.requestContextService.run(requestId, () => {
      this.appLogger.log('http.request.started', {
        method: req.method,
        path: req.originalUrl || req.url,
      });

      res.on('finish', () => {
        this.requestContextService.run(requestId, () => {
          this.appLogger.log('http.request.completed', {
            method: req.method,
            path: req.originalUrl || req.url,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
          });
        });
      });

      next();
    });
  }
}
