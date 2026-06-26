-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lab_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT 'read',
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_lab_id_idx" ON "api_keys"("lab_id");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
