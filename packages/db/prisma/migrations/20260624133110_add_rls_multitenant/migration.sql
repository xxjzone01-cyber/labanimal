/*
  Warnings:

  - Made the column `lab_id` on table `electronic_signatures` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "electronic_signatures" ALTER COLUMN "lab_id" SET NOT NULL,
ALTER COLUMN "lab_id" DROP DEFAULT;

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
