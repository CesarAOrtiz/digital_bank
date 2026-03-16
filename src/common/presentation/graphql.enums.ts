import { registerEnumType } from '@nestjs/graphql';
import { AccountStatus, Currency, TransactionType } from '../domain/enums';

registerEnumType(Currency, { name: 'Currency' });
registerEnumType(AccountStatus, { name: 'AccountStatus' });
registerEnumType(TransactionType, { name: 'TransactionType' });
