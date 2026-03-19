import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransactionRequestFingerprint1774109000000
  implements MigrationInterface
{
  name = 'AddTransactionRequestFingerprint1774109000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "transactions" ADD "requestFingerprint" character varying(64)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "transactions" DROP COLUMN "requestFingerprint"',
    );
  }
}
