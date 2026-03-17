import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import {
  GqlArgumentsHost,
  GqlContextType,
  GqlExceptionFilter,
} from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { getExceptionCode, getExceptionMessage } from '../domain/exceptions';

@Catch()
export class GraphqlExceptionFilter
  extends BaseExceptionFilter
  implements GqlExceptionFilter
{
  private readonly logger = new Logger(GraphqlExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType<GqlContextType>() !== 'graphql') {
      super.catch(exception, host);
      return;
    }

    GqlArgumentsHost.create(host);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const code = getExceptionCode(exception);
    const message = getExceptionMessage(exception);

    if (status >= 500) {
      this.logger.error(
        message,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${code}: ${message}`);
    }

    return new GraphQLError(message, {
      extensions: {
        code,
        http: { status },
      },
    });
  }
}
