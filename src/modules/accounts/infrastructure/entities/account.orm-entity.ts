import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountStatus, Currency } from '../../../../common/domain/enums';

@Entity('accounts')
@Index(['accountNumber'], { unique: true })
export class AccountOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ length: 50 })
  accountNumber!: string;

  @Column('uuid')
  clientId!: string;

  @Column({ type: 'enum', enum: Currency })
  currency!: Currency;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  balance!: string;

  @Column({ type: 'enum', enum: AccountStatus })
  status!: AccountStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
