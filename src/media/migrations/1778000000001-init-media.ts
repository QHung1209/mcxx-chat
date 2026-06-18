import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitMedia1778000000001 implements MigrationInterface {
  name = 'InitMedia1778000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Hàm sinh UUID v7 (time-ordered) phía DB — dùng làm DEFAULT cho mọi khóa chính.
    // Là backup cho luồng app .insert() (vốn bỏ qua @BeforeInsert). Cần gen_random_uuid() (Postgres 13+).
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid AS $$
        BEGIN
          RETURN encode(
            set_bit(
              set_bit(
                overlay(uuid_send(gen_random_uuid())
                  PLACING substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
                  FROM 1 FOR 6),
                52, 1),
              53, 1),
            'hex')::uuid;
        END
      $$ LANGUAGE plpgsql VOLATILE`,
    );

    await queryRunner.query(
      `CREATE TABLE "medias" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "uploaderId" uuid,
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
    await queryRunner.query(`DROP FUNCTION IF EXISTS uuid_generate_v7()`);
  }
}
