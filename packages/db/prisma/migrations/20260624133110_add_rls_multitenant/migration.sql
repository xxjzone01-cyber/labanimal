-- LabAnimal: Row Level Security (RLS) Multi-Tenant Isolation
-- Ensures each lab can only access its own data.
-- Usage: SET LOCAL app.current_lab = '<lab_id>'; before queries.

-- ============================================================
-- Step 1: Add labId to tables that are indirectly connected
-- ============================================================

-- racks: connected via rooms
ALTER TABLE racks ADD COLUMN IF NOT EXISTS lab_id TEXT;
UPDATE racks SET lab_id = rooms.lab_id FROM rooms WHERE racks.room_id = rooms.id;
ALTER TABLE racks ALTER COLUMN lab_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_racks_lab_id ON racks(lab_id);

-- cages: connected via racks → rooms
ALTER TABLE cages ADD COLUMN IF NOT EXISTS lab_id TEXT;
UPDATE cages SET lab_id = racks.lab_id FROM racks WHERE cages.rack_id = racks.id;
ALTER TABLE cages ALTER COLUMN lab_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cages_lab_id ON cages(lab_id);

-- health_records: connected via animals
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS lab_id TEXT;
UPDATE health_records SET lab_id = animals.lab_id FROM animals WHERE health_records.animal_id = animals.id;
ALTER TABLE health_records ALTER COLUMN lab_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_health_records_lab_id ON health_records(lab_id);

-- medications: connected via animals
ALTER TABLE medications ADD COLUMN IF NOT EXISTS lab_id TEXT;
UPDATE medications SET lab_id = animals.lab_id FROM animals WHERE medications.animal_id = animals.id;
ALTER TABLE medications ALTER COLUMN lab_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_medications_lab_id ON medications(lab_id);

-- animal_identifiers: connected via animals
ALTER TABLE animal_identifiers ADD COLUMN IF NOT EXISTS lab_id TEXT;
UPDATE animal_identifiers SET lab_id = animals.lab_id FROM animals WHERE animal_identifiers.animal_id = animals.id;
ALTER TABLE animal_identifiers ALTER COLUMN lab_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_animal_identifiers_lab_id ON animal_identifiers(lab_id);

-- enrichments: connected via cages → racks → rooms
ALTER TABLE enrichments ADD COLUMN IF NOT EXISTS lab_id TEXT;
UPDATE enrichments SET lab_id = cages.lab_id FROM cages WHERE enrichments.cage_id = cages.id;
ALTER TABLE enrichments ALTER COLUMN lab_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrichments_lab_id ON enrichments(lab_id);

-- electronic_signatures: connected via protocols
ALTER TABLE electronic_signatures ADD COLUMN IF NOT EXISTS lab_id TEXT;
UPDATE electronic_signatures SET lab_id = protocols.lab_id FROM protocols WHERE electronic_signatures.protocol_id = protocols.id;
-- Some signatures may not have protocolId (e.g., health_record signatures)
-- For those, set a default or leave NULL with a permissive policy
ALTER TABLE electronic_signatures ALTER COLUMN lab_id SET DEFAULT 'unknown';
UPDATE electronic_signatures SET lab_id = 'unknown' WHERE lab_id IS NULL;
ALTER TABLE electronic_signatures ALTER COLUMN lab_id SET NOT NULL;
ALTER TABLE electronic_signatures ALTER COLUMN lab_id DROP DEFAULT;
CREATE INDEX IF NOT EXISTS idx_electronic_signatures_lab_id ON electronic_signatures(lab_id);

-- animal_links: connected via animals
ALTER TABLE animal_links ADD COLUMN IF NOT EXISTS lab_id TEXT;
UPDATE animal_links SET lab_id = animals.lab_id FROM animals WHERE animal_links.animal_id = animals.id;
ALTER TABLE animal_links ALTER COLUMN lab_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_animal_links_lab_id ON animal_links(lab_id);

-- ============================================================
-- Step 2: Enable RLS on all tenant-scoped tables
-- ============================================================

ALTER TABLE animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cages ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE breeding ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE death_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE electronic_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_links ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 3: Create RLS policies (using app.current_lab session var)
-- ============================================================

-- Animals
CREATE POLICY tenant_isolation ON animals
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Rooms
CREATE POLICY tenant_isolation ON rooms
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Racks (denormalized lab_id)
CREATE POLICY tenant_isolation ON racks
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Cages (denormalized lab_id)
CREATE POLICY tenant_isolation ON cages
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Protocols
CREATE POLICY tenant_isolation ON protocols
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Breeding
CREATE POLICY tenant_isolation ON breeding
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Health Records (denormalized lab_id)
CREATE POLICY tenant_isolation ON health_records
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Rates
CREATE POLICY tenant_isolation ON rates
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Work Sessions
CREATE POLICY tenant_isolation ON work_sessions
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Audit Log
CREATE POLICY tenant_isolation ON audit_log
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Animal Identifiers (denormalized lab_id)
CREATE POLICY tenant_isolation ON animal_identifiers
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Death Reports
CREATE POLICY tenant_isolation ON death_reports
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Medications (denormalized lab_id)
CREATE POLICY tenant_isolation ON medications
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Trainings
CREATE POLICY tenant_isolation ON trainings
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Electronic Signatures (denormalized lab_id)
CREATE POLICY tenant_isolation ON electronic_signatures
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Enrichments (denormalized lab_id)
CREATE POLICY tenant_isolation ON enrichments
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Batch Sessions
CREATE POLICY tenant_isolation ON batch_sessions
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- Animal Links (denormalized lab_id)
CREATE POLICY tenant_isolation ON animal_links
  USING (lab_id = current_setting('app.current_lab')::TEXT);

-- ============================================================
-- Step 4: Grant permissions (Prisma needs these)
-- ============================================================

-- Prisma connects as the database owner, so it bypasses RLS by default.
-- We need to ensure the policies work for non-superuser roles.
-- For now, the app uses the owner role. If you create a restricted role:
--   CREATE ROLE app_user LOGIN PASSWORD '...';
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
