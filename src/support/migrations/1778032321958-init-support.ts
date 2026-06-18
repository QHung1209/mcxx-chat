import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSupport1778032321958 implements MigrationInterface {
  name = 'InitTable1778032321958';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "password__resets" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "email" character varying NOT NULL,
        "code" character varying NOT NULL,
        "scope" character varying NOT NULL,
        "try" integer NOT NULL,
        CONSTRAINT "PK_a4e78b423a49475280867e4dd76" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE TABLE "auth__tracking" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "userId" integer NOT NULL,
        "scope" character varying NOT NULL,
        "userAgent" character varying NOT NULL,
        "ip" character varying NOT NULL,
        "type" character varying NOT NULL,
        "location" json NOT NULL,
        "refreshToken" json NOT NULL,
        CONSTRAINT "PK_97888170cc4051fd5e97faf243d" PRIMARY KEY ("id")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "auth__tracking"`);
    await queryRunner.query(`DROP TABLE "password__resets"`);
  }
}
