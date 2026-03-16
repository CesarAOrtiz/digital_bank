import { Account } from '../../domain';
import { AccountOrmEntity } from '../entities/account.orm-entity';

export class AccountOrmMapper {
  static toDomain(entity: AccountOrmEntity): Account {
    return new Account({ ...entity });
  }

  static toOrm(account: Account): AccountOrmEntity {
    return Object.assign(new AccountOrmEntity(), account.toPrimitives());
  }
}
