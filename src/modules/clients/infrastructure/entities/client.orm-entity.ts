import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('clients')
@Index(['email'], { unique: true })
@Index(['documentNumber'], { unique: true })
export class ClientOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  firstName!: string;

  @Column({ length: 120 })
  lastName!: string;

  @Column({ length: 255 })
  email!: string;

  @Column({ length: 50 })
  documentNumber!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
