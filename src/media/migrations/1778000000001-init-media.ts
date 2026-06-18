import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitMedia1778000000001 implements MigrationInterface {
  name = 'InitMedia1778000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "medias" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "uploaderId" integer,
        "name" character varying(255) NOT NULL,
        "fileName" character varying(255) NOT NULL,
        "disk" character varying(255) NOT NULL,
        "mimeType" character varying(255) NOT NULL,
        "size" bigint NOT NULL,
        "url" character varying(255) NOT NULL,
        "key" character varying(255) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "acl" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_medias" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_media_uploaderId" ON "medias" ("uploaderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_media_uploaderId"`);
    await queryRunner.query(`DROP TABLE "medias"`);
  }
}
