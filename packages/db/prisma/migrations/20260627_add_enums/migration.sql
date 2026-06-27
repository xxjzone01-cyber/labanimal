-- CreateEnum (with all actual values from database)
CREATE TYPE "CageStatus" AS ENUM ('empty', 'occupied', 'cleaning', 'maintenance');
CREATE TYPE "AnimalStatus" AS ENUM ('active', 'allocated', 'used', 'deceased', 'transferred', 'retired');
CREATE TYPE "QuarantineStatus" AS ENUM ('none', 'pending', 'quarantined', 'released', 'extended');
CREATE TYPE "ProtocolStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'expired');
CREATE TYPE "PainCategory" AS ENUM ('B', 'C', 'D', 'E');
CREATE TYPE "RecordType" AS ENUM ('check', 'observation', 'abnormal', 'treatment', 'euthanasia');
CREATE TYPE "TrainingStatus" AS ENUM ('active', 'expired', 'pending_renewal');
CREATE TYPE "TrainingType" AS ENUM ('aalas_lat', 'aalas_latg', 'iacuc_orientation', 'iACUC', 'species_specific', 'surgery', 'euthanasia', 'other');
CREATE TYPE "UserRole" AS ENUM ('pi', 'caretaker', 'researcher', 'admin', 'veterinarian');
CREATE TYPE "IdentifierType" AS ENUM ('ear_tag', 'microchip', 'toe_clip', 'tail_tattoo', 'other');
CREATE TYPE "DeathCause" AS ENUM ('euthanasia', 'natural', 'experimental_endpoint', 'found_dead');
CREATE TYPE "MedicationRoute" AS ENUM ('oral', 'ip', 'iv', 'sc', 'im', 'subcutaneous', 'topical', 'other');
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'cancelled', 'expired', 'suspended');
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'sent', 'paid', 'overdue');
CREATE TYPE "SignatureStatus" AS ENUM ('verified', 'unverified');
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'REPORT_SIGN');
CREATE TYPE "LicenseCheckResult" AS ENUM ('valid', 'expired', 'invalid', 'missing');

-- AlterTable: cages
ALTER TABLE "cages" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "cages" ALTER COLUMN "status" TYPE "CageStatus" USING "status"::"CageStatus";
ALTER TABLE "cages" ALTER COLUMN "status" SET DEFAULT 'empty'::"CageStatus";

-- AlterTable: animals
ALTER TABLE "animals" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "animals" ALTER COLUMN "status" TYPE "AnimalStatus" USING "status"::"AnimalStatus";
ALTER TABLE "animals" ALTER COLUMN "status" SET DEFAULT 'active'::"AnimalStatus";

ALTER TABLE "animals" ALTER COLUMN "quarantineStatus" TYPE "QuarantineStatus" USING "quarantineStatus"::"QuarantineStatus";

-- AlterTable: protocols
ALTER TABLE "protocols" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "protocols" ALTER COLUMN "status" TYPE "ProtocolStatus" USING "status"::"ProtocolStatus";
ALTER TABLE "protocols" ALTER COLUMN "status" SET DEFAULT 'draft'::"ProtocolStatus";

ALTER TABLE "protocols" ALTER COLUMN "pain_category" TYPE "PainCategory" USING "pain_category"::"PainCategory";

-- AlterTable: health_records
ALTER TABLE "health_records" ALTER COLUMN "record_type" TYPE "RecordType" USING "record_type"::"RecordType";

-- AlterTable: trainings
ALTER TABLE "trainings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "trainings" ALTER COLUMN "status" TYPE "TrainingStatus" USING "status"::"TrainingStatus";
ALTER TABLE "trainings" ALTER COLUMN "status" SET DEFAULT 'active'::"TrainingStatus";

ALTER TABLE "trainings" ALTER COLUMN "type" TYPE "TrainingType" USING "type"::"TrainingType";

-- AlterTable: user_labs
ALTER TABLE "user_labs" ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";

-- AlterTable: animal_identifiers
ALTER TABLE "animal_identifiers" ALTER COLUMN "type" TYPE "IdentifierType" USING "type"::"IdentifierType";

-- AlterTable: death_reports
ALTER TABLE "death_reports" ALTER COLUMN "cause" TYPE "DeathCause" USING "cause"::"DeathCause";

-- AlterTable: medications
ALTER TABLE "medications" ALTER COLUMN "route" TYPE "MedicationRoute" USING "route"::"MedicationRoute";

-- AlterTable: subscriptions
ALTER TABLE "subscriptions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "subscriptions" ALTER COLUMN "status" TYPE "SubscriptionStatus" USING "status"::"SubscriptionStatus";
ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'active'::"SubscriptionStatus";

-- AlterTable: invoices
ALTER TABLE "invoices" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "invoices" ALTER COLUMN "status" TYPE "InvoiceStatus" USING "status"::"InvoiceStatus";
ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'sent'::"InvoiceStatus";

-- AlterTable: report_signatures
ALTER TABLE "report_signatures" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "report_signatures" ALTER COLUMN "status" TYPE "SignatureStatus" USING "status"::"SignatureStatus";
ALTER TABLE "report_signatures" ALTER COLUMN "status" SET DEFAULT 'verified'::"SignatureStatus";

-- AlterTable: audit_log
ALTER TABLE "audit_log" ALTER COLUMN "action" TYPE "AuditAction" USING "action"::"AuditAction";

-- AlterTable: license_checks
ALTER TABLE "license_checks" ALTER COLUMN "result" TYPE "LicenseCheckResult" USING "result"::"LicenseCheckResult";
