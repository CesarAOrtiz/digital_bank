import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { Currency } from '../../../../common/domain/enums';

@Entity('exchange_rates')
@Index(['baseCurrency', 'targetCurrency', 'effectiveAt'])
export class ExchangeRateOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: Currency })
  baseCurrency!: Currency;

  @Column({ type: 'enum', enum: Currency })
  targetCurrency!: Currency;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  rate!: string;

  @Column()
  effectiveAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
