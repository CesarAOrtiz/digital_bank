import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1773687350841 implements MigrationInterface {
    name = 'InitialSchema1773687350841'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."accounts_currency_enum" AS ENUM('DOP', 'USD', 'EUR')`);
        await queryRunner.query(`CREATE TYPE "public"."accounts_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'BLOCKED')`);
        await queryRunner.query(`CREATE TABLE "accounts" ("id" uuid NOT NULL, "accountNumber" character varying(50) NOT NULL, "clientId" uuid NOT NULL, "currency" "public"."accounts_currency_enum" NOT NULL, "balance" numeric(18,2) NOT NULL, "status" "public"."accounts_status_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c57d6a982eeaa1d115687b17b6" ON "accounts" ("accountNumber") `);
        await queryRunner.query(`CREATE TABLE "clients" ("id" uuid NOT NULL, "firstName" character varying(120) NOT NULL, "lastName" character varying(120) NOT NULL, "email" character varying(255) NOT NULL, "documentNumber" character varying(50) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f1ab7cf3a5714dbc6bb4e1c28a4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d866e63d1c138ea2de12f4676e" ON "clients" ("documentNumber") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b48860677afe62cd96e1265948" ON "clients" ("email") `);
        await queryRunner.query(`CREATE TYPE "public"."exchange_rates_basecurrency_enum" AS ENUM('DOP', 'USD', 'EUR')`);
        await queryRunner.query(`CREATE TYPE "public"."exchange_rates_targetcurrency_enum" AS ENUM('DOP', 'USD', 'EUR')`);
        await queryRunner.query(`CREATE TABLE "exchange_rates" ("id" uuid NOT NULL, "baseCurrency" "public"."exchange_rates_basecurrency_enum" NOT NULL, "targetCurrency" "public"."exchange_rates_targetcurrency_enum" NOT NULL, "rate" numeric(18,6) NOT NULL, "effectiveAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_33a614bad9e61956079d817ebe2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ef903e3ae8bec27f098a7a9522" ON "exchange_rates" ("baseCurrency", "targetCurrency", "effectiveAt") `);
        await queryRunner.query(`CREATE TYPE "public"."transactions_type_enum" AS ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_sourcecurrency_enum" AS ENUM('DOP', 'USD', 'EUR')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_destinationcurrency_enum" AS ENUM('DOP', 'USD', 'EUR')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL, "type" "public"."transactions_type_enum" NOT NULL, "sourceAccountId" uuid, "destinationAccountId" uuid, "sourceCurrency" "public"."transactions_sourcecurrency_enum" NOT NULL, "destinationCurrency" "public"."transactions_destinationcurrency_enum", "sourceAmount" numeric(18,2) NOT NULL, "destinationAmount" numeric(18,2), "exchangeRateUsed" numeric(18,6), "idempotencyKey" character varying(100), "description" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8125a3e77946ca3fda7d7b1482" ON "transactions" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_f4bab09efce4a0e46784d0ccf4" ON "transactions" ("type", "createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_f4bab09efce4a0e46784d0ccf4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8125a3e77946ca3fda7d7b1482"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_destinationcurrency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_sourcecurrency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ef903e3ae8bec27f098a7a9522"`);
        await queryRunner.query(`DROP TABLE "exchange_rates"`);
        await queryRunner.query(`DROP TYPE "public"."exchange_rates_targetcurrency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."exchange_rates_basecurrency_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b48860677afe62cd96e1265948"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d866e63d1c138ea2de12f4676e"`);
        await queryRunner.query(`DROP TABLE "clients"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c57d6a982eeaa1d115687b17b6"`);
        await queryRunner.query(`DROP TABLE "accounts"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_currency_enum"`);
    }

}
