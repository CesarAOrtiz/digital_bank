import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { Currency, TransactionType } from '../../../../common/domain/enums';

@Entity('transactions')
@Index(['type', 'createdAt'])
export class TransactionOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  @Column({ type: 'uuid', nullable: true })
  sourceAccountId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  destinationAccountId!: string | null;

  @Column({ type: 'enum', enum: Currency })
  sourceCurrency!: Currency;

  @Column({ type: 'enum', enum: Currency, nullable: true })
  destinationCurrency!: Currency | null;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  sourceAmount!: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  destinationAmount!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  exchangeRateUsed!: string | null;

  @Column({ length: 100, nullable: true })
  idempotencyKey!: string | null;

  @Column({ length: 255, nullable: true })
  description!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
