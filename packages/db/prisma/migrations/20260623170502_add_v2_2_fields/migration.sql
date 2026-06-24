/*
  Warnings:

  - Added the required column `printed_name` to the `electronic_signatures` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "electronic_signatures" ADD COLUMN     "printed_name" TEXT NOT NULL,
ADD COLUMN     "reason_for_signing" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "medications" ADD COLUMN     "administered_by" TEXT,
ADD COLUMN     "outcome" TEXT;

-- AlterTable
ALTER TABLE "protocols" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejected_by" TEXT,
ADD COLUMN     "review_comments" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "batch_sessions" (
    "id" TEXT NOT NULL,
    "lab_id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "material_type" TEXT NOT NULL,
    "supplier" TEXT,
    "received_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "storage_location" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batch_sessions_lab_id_material_type_idx" ON "batch_sessions"("lab_id", "material_type");

-- CreateIndex
CREATE INDEX "batch_sessions_lab_id_expiration_date_idx" ON "batch_sessions"("lab_id", "expiration_date");

-- CreateIndex
CREATE INDEX "breeding_lab_id_idx" ON "breeding"("lab_id");

-- CreateIndex
CREATE INDEX "health_records_animal_id_idx" ON "health_records"("animal_id");

-- CreateIndex
CREATE INDEX "work_sessions_user_id_idx" ON "work_sessions"("user_id");

-- CreateIndex
CREATE INDEX "work_sessions_lab_id_idx" ON "work_sessions"("lab_id");

-- AddForeignKey
ALTER TABLE "batch_sessions" ADD CONSTRAINT "batch_sessions_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
