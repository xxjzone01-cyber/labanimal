-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "lab_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paypal_subscription_id" TEXT,
    "stripe_subscription_id" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_lab_id_key" ON "subscriptions"("lab_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_animal_identifiers_lab_id" RENAME TO "animal_identifiers_lab_id_idx";

-- RenameIndex
ALTER INDEX "idx_animal_links_lab_id" RENAME TO "animal_links_lab_id_idx";

-- RenameIndex
ALTER INDEX "idx_cages_lab_id" RENAME TO "cages_lab_id_idx";

-- RenameIndex
ALTER INDEX "idx_electronic_signatures_lab_id" RENAME TO "electronic_signatures_lab_id_idx";

-- RenameIndex
ALTER INDEX "idx_enrichments_lab_id" RENAME TO "enrichments_lab_id_idx";

-- RenameIndex
ALTER INDEX "idx_health_records_lab_id" RENAME TO "health_records_lab_id_idx";

-- RenameIndex
ALTER INDEX "idx_medications_lab_id" RENAME TO "medications_lab_id_idx";

-- RenameIndex
ALTER INDEX "idx_racks_lab_id" RENAME TO "racks_lab_id_idx";
