import { HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common/interfaces';
import { GraphQLError } from 'graphql';
import {
  DomainRuleViolationException,
} from '../domain/exceptions';
import { AppLogger } from '../infrastructure/logging/app-logger.service';
import { GraphqlExceptionFilter } from './graphql-exception.filter';

describe('GraphqlExceptionFilter', () => {
  function createGraphqlHost(): ArgumentsHost {
    return {
      getType: () => 'graphql',
    } as unknown as ArgumentsHost;
  }

  function createSut() {
    const appLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<AppLogger>;

    return {
      filter: new GraphqlExceptionFilter(appLogger),
      appLogger,
    };
  }

  it('mapea errores de dominio a GraphQLError con código y status homogéneos', () => {
    const { filter, appLogger } = createSut();

    const result = filter.catch(
      new DomainRuleViolationException('Invalid transfer payload.'),
      createGraphqlHost(),
    ) as GraphQLError;

    expect(result.message).toBe('Invalid transfer payload.');
    expect(result.extensions).toMatchObject({
      code: 'DOMAIN_RULE_VIOLATION',
      http: { status: HttpStatus.BAD_REQUEST },
    });
    expect(appLogger.warn).toHaveBeenCalledWith('graphql.request.failed', {
      errorCode: 'DOMAIN_RULE_VIOLATION',
      httpStatus: HttpStatus.BAD_REQUEST,
      message: 'Invalid transfer payload.',
    });
    expect(appLogger.error).not.toHaveBeenCalled();
  });

  it('normaliza errores inesperados sin exponer detalles internos al cliente', () => {
    const { filter, appLogger } = createSut();
    const unexpectedError = new Error('database connection timeout');

    const result = filter.catch(
      unexpectedError,
      createGraphqlHost(),
    ) as GraphQLError;

    expect(result.message).toBe('Internal server error');
    expect(result.extensions).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      http: { status: HttpStatus.INTERNAL_SERVER_ERROR },
    });
    expect(appLogger.error).toHaveBeenCalledWith(
      'graphql.request.failed',
      unexpectedError,
      {
        errorCode: 'INTERNAL_SERVER_ERROR',
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'database connection timeout',
      },
    );
    expect(appLogger.warn).not.toHaveBeenCalled();
  });
});
