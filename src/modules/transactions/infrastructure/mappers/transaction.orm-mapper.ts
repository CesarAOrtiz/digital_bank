import { Transaction } from '../../domain';
import { TransactionOrmEntity } from '../entities/transaction.orm-entity';

export class TransactionOrmMapper {
  static toDomain(entity: TransactionOrmEntity): Transaction {
    return new Transaction({ ...entity });
  }

  static toOrm(transaction: Transaction): TransactionOrmEntity {
    return Object.assign(new TransactionOrmEntity(), {
      ...transaction.toPrimitives(),
      requestFingerprint: transaction.requestFingerprint,
    });
  }
}
