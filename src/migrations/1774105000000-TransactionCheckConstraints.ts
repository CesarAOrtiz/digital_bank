import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransactionCheckConstraints1774105000000
  implements MigrationInterface
{
  name = 'TransactionCheckConstraints1774105000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "CHK_transactions_source_amount_positive" CHECK ("sourceAmount" > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "CHK_transactions_destination_amount_positive" CHECK ("destinationAmount" IS NULL OR "destinationAmount" > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "CHK_transactions_transfer_distinct_accounts" CHECK ("type" <> 'TRANSFER' OR ("sourceAccountId" IS NOT NULL AND "destinationAccountId" IS NOT NULL AND "sourceAccountId" IS DISTINCT FROM "destinationAccountId"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "CHK_transactions_transfer_distinct_accounts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "CHK_transactions_destination_amount_positive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "CHK_transactions_source_amount_positive"`,
    );
  }
}
