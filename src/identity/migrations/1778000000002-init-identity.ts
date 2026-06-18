import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitIdentity1778000000002 implements MigrationInterface {
  name = 'InitIdentity1778000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "identity__users" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "email" character varying(255) NOT NULL,
        "name" character varying(255) NOT NULL,
        "googleId" character varying(255),
        "avatarMediaId" integer,
        "password" character varying(255) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_identity_users" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_email" ON "identity__users" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_user_email"`);
    await queryRunner.query(`DROP TABLE "identity__users"`);
  }
}
