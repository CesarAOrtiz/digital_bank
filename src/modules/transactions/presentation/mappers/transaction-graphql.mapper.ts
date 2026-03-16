import { Transaction } from '../../domain';
import { TransactionGraphqlModel } from '../models/transaction.model';

export class TransactionGraphqlMapper {
  static toModel(transaction: Transaction): TransactionGraphqlModel {
    return Object.assign(new TransactionGraphqlModel(), transaction.toPrimitives());
  }
}
