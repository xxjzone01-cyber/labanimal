-- AlterTable
ALTER TABLE "animals" ADD COLUMN     "arrival_date" TIMESTAMP(3),
ADD COLUMN     "quarantineStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "quarantine_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "cages" ADD COLUMN     "is_single_housed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "single_housing_reason" TEXT,
ADD COLUMN     "single_housing_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "protocols" ADD COLUMN     "has_humane_endpoints" BOOLEAN,
ADD COLUMN     "has_statistical_justification" BOOLEAN,
ADD COLUMN     "involves_surgery" BOOLEAN,
ADD COLUMN     "survival_surgery" BOOLEAN,
ADD COLUMN     "three_rs_reduction" TEXT,
ADD COLUMN     "three_rs_refinement" TEXT,
ADD COLUMN     "three_rs_replacement" TEXT,
ADD COLUMN     "uses_analgesics" BOOLEAN;

-- CreateTable
CREATE TABLE "animal_identifiers" (
    "id" TEXT NOT NULL,
    "animal_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "death_reports" (
    "id" TEXT NOT NULL,
    "animal_id" TEXT NOT NULL,
    "lab_id" TEXT NOT NULL,
    "date_of_death" TIMESTAMP(3) NOT NULL,
    "cause" TEXT NOT NULL,
    "euthanasia_method_id" TEXT,
    "performed_by" TEXT,
    "necropsy_performed" BOOLEAN NOT NULL DEFAULT false,
    "necropsy_findings" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "death_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medications" (
    "id" TEXT NOT NULL,
    "animal_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "reason" TEXT,
    "prescribed_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lab_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "certification_number" TEXT,
    "issued_by" TEXT,
    "issued_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "document_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electronic_signatures" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "protocol_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "signature_hash" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "notes" TEXT,

    CONSTRAINT "electronic_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrichments" (
    "id" TEXT NOT NULL,
    "cage_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "added_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_date" TIMESTAMP(3),
    "added_by" TEXT,
    "notes" TEXT,

    CONSTRAINT "enrichments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "animal_identifiers_animal_id_type_value_key" ON "animal_identifiers"("animal_id", "type", "value");

-- CreateIndex
CREATE INDEX "death_reports_lab_id_date_of_death_idx" ON "death_reports"("lab_id", "date_of_death");

-- CreateIndex
CREATE INDEX "medications_animal_id_idx" ON "medications"("animal_id");

-- CreateIndex
CREATE INDEX "trainings_user_id_type_idx" ON "trainings"("user_id", "type");

-- CreateIndex
CREATE INDEX "trainings_lab_id_status_idx" ON "trainings"("lab_id", "status");

-- CreateIndex
CREATE INDEX "electronic_signatures_entity_type_entity_id_idx" ON "electronic_signatures"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "electronic_signatures_user_id_idx" ON "electronic_signatures"("user_id");

-- CreateIndex
CREATE INDEX "enrichments_cage_id_idx" ON "enrichments"("cage_id");

-- CreateIndex
CREATE INDEX "animals_lab_id_quarantineStatus_idx" ON "animals"("lab_id", "quarantineStatus");

-- AddForeignKey
ALTER TABLE "animal_identifiers" ADD CONSTRAINT "animal_identifiers_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "death_reports" ADD CONSTRAINT "death_reports_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "death_reports" ADD CONSTRAINT "death_reports_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medications" ADD CONSTRAINT "medications_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_signatures" ADD CONSTRAINT "electronic_signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_signatures" ADD CONSTRAINT "electronic_signatures_protocol_id_fkey" FOREIGN KEY ("protocol_id") REFERENCES "protocols"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrichments" ADD CONSTRAINT "enrichments_cage_id_fkey" FOREIGN KEY ("cage_id") REFERENCES "cages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
