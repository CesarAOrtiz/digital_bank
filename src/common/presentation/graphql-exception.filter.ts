import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import {
  GqlContextType,
  GqlExceptionFilter,
} from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { AppLogger } from '../infrastructure/logging/app-logger.service';
import { getExceptionCode, getExceptionMessage } from '../domain/exceptions';

@Catch()
export class GraphqlExceptionFilter
  extends BaseExceptionFilter
  implements GqlExceptionFilter
{
  constructor(private readonly appLogger: AppLogger) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType<GqlContextType>() !== 'graphql') {
      super.catch(exception, host);
      return;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const code = getExceptionCode(exception);
    const originalMessage = getExceptionMessage(exception);
    const message =
      status >= 500 ? 'Internal server error' : originalMessage;

    if (status >= 500) {
      this.appLogger.error('graphql.request.failed', exception, {
        errorCode: code,
        httpStatus: status,
        message: originalMessage,
      });
    } else {
      this.appLogger.warn('graphql.request.failed', {
        errorCode: code,
        httpStatus: status,
        message,
      });
    }

    return new GraphQLError(message, {
      extensions: {
        code,
        http: { status },
      },
    });
  }
}
