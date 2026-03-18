import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface RequestContextStore {
  requestId: string;
}

@Injectable()
export class RequestContextService {
  private readonly asyncLocalStorage =
    new AsyncLocalStorage<RequestContextStore>();

  run<T>(requestId: string, callback: () => T): T {
    return this.asyncLocalStorage.run({ requestId }, callback);
  }

  getRequestId(): string | undefined {
    return this.asyncLocalStorage.getStore()?.requestId;
  }
}
