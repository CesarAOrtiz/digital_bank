import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      service: 'digital_bank',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
