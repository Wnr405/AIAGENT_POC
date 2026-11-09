-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'editor', 'author');
CREATE TYPE "UserStatus" AS ENUM ('invited', 'active', 'deactivated');
CREATE TYPE "ContentType" AS ENUM ('article', 'page');
CREATE TYPE "ContentStatus" AS ENUM ('draft', 'in_review', 'published', 'unpublished', 'archived');
CREATE TYPE "OneTimeTokenPurpose" AS ENUM ('invite', 'password_reset');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "failed_window_started_at" TIMESTAMPTZ(3),
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "replaced_by_id" UUID,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "one_time_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "OneTimeTokenPurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contents" (
    "id" UUID NOT NULL,
    "type" "ContentType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "body" JSONB NOT NULL,
    "status" "ContentStatus" NOT NULL,
    "author_id" UUID NOT NULL,
    "featured_image_id" UUID,
    "social_image_id" UUID,
    "seo_title" VARCHAR(70),
    "seo_description" VARCHAR(160),
    "effective_seo_title" VARCHAR(70) NOT NULL,
    "effective_seo_description" VARCHAR(161) NOT NULL,
    "tags" TEXT[],
    "category" VARCHAR(60),
    "parent_id" UUID,
    "scheduled_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_versions" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "editor_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_media_refs" (
    "content_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    CONSTRAINT "content_media_refs_pkey" PRIMARY KEY ("content_id","media_id")
);

CREATE TABLE "media_items" (
    "id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt_text" VARCHAR(500),
    "caption" VARCHAR(1000),
    "variants" JSONB NOT NULL DEFAULT '{}',
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "media_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "actor_id" UUID,
    "actor_ip" VARCHAR(45),
    "action" VARCHAR(80) NOT NULL,
    "target_type" VARCHAR(40) NOT NULL,
    "target_id" UUID,
    "summary" JSONB NOT NULL,
    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");
CREATE UNIQUE INDEX "one_time_tokens_token_hash_key" ON "one_time_tokens"("token_hash");
CREATE INDEX "one_time_tokens_user_id_purpose_idx" ON "one_time_tokens"("user_id", "purpose");
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");
CREATE INDEX "contents_status_published_at_idx" ON "contents"("status", "published_at" DESC);
CREATE INDEX "contents_author_id_status_idx" ON "contents"("author_id", "status");
CREATE INDEX "contents_scheduled_at_idx" ON "contents"("scheduled_at");
CREATE INDEX "contents_tags_idx" ON "contents" USING GIN ("tags");
CREATE UNIQUE INDEX "contents_type_slug_key" ON "contents"("type", "slug");
CREATE UNIQUE INDEX "content_versions_content_id_version_no_key" ON "content_versions"("content_id", "version_no");
CREATE INDEX "content_media_refs_media_id_idx" ON "content_media_refs"("media_id");
CREATE UNIQUE INDEX "media_items_storage_key_key" ON "media_items"("storage_key");
CREATE INDEX "media_items_uploaded_by_idx" ON "media_items"("uploaded_by");
CREATE INDEX "media_items_created_at_idx" ON "media_items"("created_at" DESC);
CREATE INDEX "audit_events_occurred_at_idx" ON "audit_events"("occurred_at" DESC);
CREATE INDEX "audit_events_actor_id_occurred_at_idx" ON "audit_events"("actor_id", "occurred_at");
CREATE INDEX "audit_events_action_occurred_at_idx" ON "audit_events"("action", "occurred_at");
CREATE INDEX "audit_events_target_type_target_id_idx" ON "audit_events"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contents" ADD CONSTRAINT "contents_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contents" ADD CONSTRAINT "contents_featured_image_id_fkey" FOREIGN KEY ("featured_image_id") REFERENCES "media_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contents" ADD CONSTRAINT "contents_social_image_id_fkey" FOREIGN KEY ("social_image_id") REFERENCES "media_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contents" ADD CONSTRAINT "contents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_media_refs" ADD CONSTRAINT "content_media_refs_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_media_refs" ADD CONSTRAINT "content_media_refs_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── FR-AUDIT-03 / SEC-13: audit log is append-only at the database level ───
CREATE OR REPLACE FUNCTION audit_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only (% blocked)', TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();

CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON "audit_events"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_append_only();
