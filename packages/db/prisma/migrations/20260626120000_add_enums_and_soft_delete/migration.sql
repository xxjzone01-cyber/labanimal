-- Add soft delete columns (deletedAt) to core models
-- Enum standardization deferred due to Prisma WASM engine compatibility issues

-- AlterTable: labs - add deletedAt
ALTER TABLE "labs" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- AlterTable: users - add deletedAt
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- AlterTable: animals - add deletedAt
ALTER TABLE "animals" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- AlterTable: protocols - add deletedAt
ALTER TABLE "protocols" ADD COLUMN "deleted_at" TIMESTAMP(3);
