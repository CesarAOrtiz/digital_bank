import { Logger } from '@nestjs/common';
import { AppLogger } from './app-logger.service';
import { RequestContextService } from './request-context.service';

describe('AppLogger', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalServiceName = process.env.APP_SERVICE_NAME;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APP_SERVICE_NAME = 'digital-bank-api';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.NODE_ENV = originalEnv;
    process.env.APP_SERVICE_NAME = originalServiceName;
  });

  it('incluye requestId, service y env desde el contexto compartido', () => {
    const requestContextService = new RequestContextService();
    const service = new AppLogger(requestContextService);
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    requestContextService.run('req-123', () => {
      service.log('transaction.deposit.started', {
        accountId: 'account-1',
      });
    });

    const payload = JSON.parse(loggerSpy.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      level: 'info',
      event: 'transaction.deposit.started',
      requestId: 'req-123',
      service: 'digital-bank-api',
      env: 'test',
      accountId: 'account-1',
    });
    expect(typeof payload.timestamp).toBe('string');
  });

  it('genera requestId cuando no existe contexto activo', () => {
    const requestContextService = new RequestContextService();
    const service = new AppLogger(requestContextService);
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    service.log('search.transactions.executed', {
      resultCount: 3,
    });

    const payload = JSON.parse(loggerSpy.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      level: 'info',
      event: 'search.transactions.executed',
      service: 'digital-bank-api',
      env: 'test',
      resultCount: 3,
    });
    expect(typeof payload.requestId).toBe('string');
    expect(payload.requestId).not.toHaveLength(0);
  });
});
