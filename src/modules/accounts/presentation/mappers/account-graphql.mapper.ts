import { Account } from '../../domain';
import { AccountGraphqlModel } from '../models/account.model';

export class AccountGraphqlMapper {
  static toModel(account: Account): AccountGraphqlModel {
    return Object.assign(new AccountGraphqlModel(), account.toPrimitives());
  }
}
