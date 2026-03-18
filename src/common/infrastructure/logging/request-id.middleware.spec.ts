import type { NextFunction, Request, Response } from 'express';
import { AppLogger } from './app-logger.service';
import { RequestContextService } from './request-context.service';
import { RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  function createResponse() {
    const handlers = new Map<string, () => void>();

    return {
      statusCode: 200,
      setHeader: jest.fn(),
      on: jest.fn((event: string, handler: () => void) => {
        handlers.set(event, handler);
      }),
      emitFinish: () => handlers.get('finish')?.(),
    } as unknown as Response & { emitFinish: () => void };
  }

  it('genera requestId si no viene en el header', () => {
    const requestContextService = new RequestContextService();
    const appLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<AppLogger>;
    const middleware = new RequestIdMiddleware(requestContextService, appLogger);
    const req = {
      method: 'POST',
      url: '/graphql',
      originalUrl: '/graphql',
      headers: {},
    } as unknown as Request & { requestId?: string };
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    middleware.use(req, res, next);

    expect(req['requestId']).toBeDefined();
    expect(typeof req['requestId']).toBe('string');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req['requestId']);
    expect(next).toHaveBeenCalled();
  });

  it('reutiliza x-request-id si viene en el header', () => {
    const requestContextService = new RequestContextService();
    const appLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<AppLogger>;
    const middleware = new RequestIdMiddleware(requestContextService, appLogger);
    const req = {
      method: 'GET',
      url: '/health',
      originalUrl: '/health',
      headers: { 'x-request-id': 'req-from-client' },
    } as unknown as Request & { requestId?: string };
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    middleware.use(req, res, next);

    expect(req['requestId']).toBe('req-from-client');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'req-from-client');
    expect(next).toHaveBeenCalled();
  });
});
