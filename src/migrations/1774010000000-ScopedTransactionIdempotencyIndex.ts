import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScopedTransactionIdempotencyIndex1774010000000
  implements MigrationInterface
{
  name = 'ScopedTransactionIdempotencyIndex1774010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_8125a3e77946ca3fda7d7b1482"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_503d6ed9a7c6f88f0e5a5df4b7" ON "transactions" ("type", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_503d6ed9a7c6f88f0e5a5df4b7"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8125a3e77946ca3fda7d7b1482" ON "transactions" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`,
    );
  }
}
