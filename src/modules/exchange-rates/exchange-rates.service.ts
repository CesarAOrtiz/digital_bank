import { Injectable } from '@nestjs/common';
import { CreateExchangeRateInput } from './dto/create-exchange-rate.input';
import { UpdateExchangeRateInput } from './dto/update-exchange-rate.input';

@Injectable()
export class ExchangeRatesService {
  create(createExchangeRateInput: CreateExchangeRateInput) {
    return 'This action adds a new exchangeRate';
  }

  findAll() {
    return `This action returns all exchangeRates`;
  }

  findOne(id: number) {
    return `This action returns a #${id} exchangeRate`;
  }

  update(id: number, updateExchangeRateInput: UpdateExchangeRateInput) {
    return `This action updates a #${id} exchangeRate`;
  }

  remove(id: number) {
    return `This action removes a #${id} exchangeRate`;
  }
}
