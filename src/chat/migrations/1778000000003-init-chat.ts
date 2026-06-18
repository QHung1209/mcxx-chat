import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitChat1778000000003 implements MigrationInterface {
  name = 'InitChat1778000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // chats
    await queryRunner.query(
      `CREATE TABLE "chat__chats" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "type" character varying(20) NOT NULL,
        "name" character varying(255),
        "avatarMediaId" uuid,
        "lastMessageId" uuid,
        CONSTRAINT "PK_chat_chats" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_chat_updatedAt" ON "chat__chats" ("updatedAt")`,
    );

    // members
    await queryRunner.query(
      `CREATE TABLE "chat__members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "chatId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" character varying(20) NOT NULL DEFAULT 'MEMBER',
        "lastSeenMessageId" uuid,
        "hiddenAtMessageId" uuid,
        CONSTRAINT "PK_chat_members" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_member_chatId_userId" ON "chat__members" ("chatId", "userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat__members" ADD CONSTRAINT "FK_member_chat"
        FOREIGN KEY ("chatId") REFERENCES "chat__chats"("id") ON DELETE CASCADE`,
    );

    // messages
    await queryRunner.query(
      `CREATE TABLE "chat__messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "chatId" uuid NOT NULL,
        "senderId" uuid NOT NULL,
        "content" text,
        "type" character varying(20) NOT NULL DEFAULT 'TEXT',
        "replyToMessageId" uuid,
        "forwardFromMessageId" uuid,
        "isPinned" boolean NOT NULL DEFAULT false,
        "hasLink" boolean NOT NULL DEFAULT false,
        "previewData" jsonb,
        "metadata" jsonb,
        "mentionIds" uuid array,
        "mentionAll" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_chat_messages" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_message_chatId_id" ON "chat__messages" ("chatId", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_message_chatId_isPinned" ON "chat__messages" ("chatId", "isPinned") WHERE "isPinned" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat__messages" ADD CONSTRAINT "FK_message_chat"
        FOREIGN KEY ("chatId") REFERENCES "chat__chats"("id") ON DELETE CASCADE`,
    );

    // message media (attachments)
    await queryRunner.query(
      `CREATE TABLE "chat__message_media" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "messageId" uuid NOT NULL,
        "mediaId" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "fileName" character varying(255) NOT NULL,
        "mimeType" character varying(255) NOT NULL,
        "size" bigint NOT NULL,
        "url" character varying(255) NOT NULL,
        "acl" boolean NOT NULL DEFAULT true,
        "order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_chat_message_media" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_message_media_messageId" ON "chat__message_media" ("messageId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat__message_media" ADD CONSTRAINT "FK_message_media_message"
        FOREIGN KEY ("messageId") REFERENCES "chat__messages"("id") ON DELETE CASCADE`,
    );

    // reactions
    await queryRunner.query(
      `CREATE TABLE "chat__reactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "messageId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "emoji" character varying(20) NOT NULL,
        CONSTRAINT "PK_chat_reactions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_reaction_messageId_userId" UNIQUE ("messageId", "userId")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reaction_messageId_userId" ON "chat__reactions" ("messageId", "createdAt")`,
    );

    // poll
    await queryRunner.query(
      `CREATE TABLE "chat__poll" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "messageId" uuid NOT NULL,
        "name" text NOT NULL,
        "type" character varying(20) NOT NULL,
        "closedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_chat_poll" PRIMARY KEY ("id")
      )`,
    );

    // poll option
    await queryRunner.query(
      `CREATE TABLE "chat__poll_option" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "pollId" uuid NOT NULL,
        "content" character varying NOT NULL,
        "order" integer NOT NULL,
        CONSTRAINT "PK_chat_poll_option" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_polloption_pollId" ON "chat__poll_option" ("pollId")`,
    );

    // poll vote
    await queryRunner.query(
      `CREATE TABLE "chat__poll_vote" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "optionId" uuid NOT NULL,
        "pollId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        CONSTRAINT "PK_chat_poll_vote" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pollvote_optionId_userId" ON "chat__poll_vote" ("optionId", "userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat__poll_vote" ADD CONSTRAINT "FK_pollvote_option"
        FOREIGN KEY ("optionId") REFERENCES "chat__poll_option"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "chat__poll_vote"`);
    await queryRunner.query(`DROP TABLE "chat__poll_option"`);
    await queryRunner.query(`DROP TABLE "chat__poll"`);
    await queryRunner.query(`DROP TABLE "chat__reactions"`);
    await queryRunner.query(`DROP TABLE "chat__message_media"`);
    await queryRunner.query(`DROP TABLE "chat__messages"`);
    await queryRunner.query(`DROP TABLE "chat__members"`);
    await queryRunner.query(`DROP TABLE "chat__chats"`);
  }
}
