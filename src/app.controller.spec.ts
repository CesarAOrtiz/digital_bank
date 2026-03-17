import { Test } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  it('returns the aggregated health check response', async () => {
    const expectedHealth = {
      status: 'ok',
      info: {
        postgres: { status: 'up' },
        redis: { status: 'up' },
        elastic: { status: 'up' },
      },
      error: {},
      details: {
        postgres: { status: 'up' },
        redis: { status: 'up' },
        elastic: { status: 'up' },
      },
    };

    const checkPostgres = jest.fn().mockResolvedValue({ postgres: { status: 'up' } });
    const checkRedis = jest.fn().mockResolvedValue({ redis: { status: 'up' } });
    const checkElastic = jest.fn().mockResolvedValue({ elastic: { status: 'up' } });
    const healthCheck = jest.fn().mockResolvedValue(expectedHealth);

    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: healthCheck,
          },
        },
        {
          provide: AppService,
          useValue: {
            checkPostgres,
            checkRedis,
            checkElastic,
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(AppController);
    await expect(controller.getHealth()).resolves.toEqual(expectedHealth);
    expect(healthCheck).toHaveBeenCalledTimes(1);

    const indicators = healthCheck.mock.calls[0][0] as Array<() => Promise<unknown>>;
    await expect(indicators[0]()).resolves.toEqual({ postgres: { status: 'up' } });
    await expect(indicators[1]()).resolves.toEqual({ redis: { status: 'up' } });
    await expect(indicators[2]()).resolves.toEqual({ elastic: { status: 'up' } });

    expect(checkPostgres).toHaveBeenCalledTimes(1);
    expect(checkRedis).toHaveBeenCalledTimes(1);
    expect(checkElastic).toHaveBeenCalledTimes(1);
  });
});
