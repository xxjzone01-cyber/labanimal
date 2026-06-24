/**
 * PostgreSQL 写入器
 *
 * 使用 Prisma 将迁移数据写入 PostgreSQL。
 * 严格遵循外键依赖顺序，使用 upsert 保证幂等。
 */

import { PrismaClient } from '@prisma/client';
import type { SQLiteData } from '../readers/sqlite.js';
import {
  mapRow,
  mapDate,
  mapBoolean,
  mapEnum,
  mapInt,
  mapFloat,
  mapString,
  ANIMAL_STATUS,
  QUARANTINE_STATUS,
  SEX,
  CAGE_STATUS,
  PROTOCOL_STATUS,
  PAIN_CATEGORY,
  RECORD_TYPE,
  DEATH_CAUSE,
  MED_ROUTE,
  IDENTIFIER_TYPE,
  ENRICHMENT_TYPE,
  TRAINING_TYPE,
  TRAINING_STATUS,
  USER_ROLE,
  SIGNATURE_MEANING,
  ENTITY_TYPE,
  BATCH_MATERIAL_TYPE,
  type FieldMapping,
} from '../mappers/field-mapper.js';

/** 单表迁移结果 */
export interface MigrationResult {
  table: string;
  imported: number;
  skipped: number;
  errors: string[];
}

/** 迁移上下文 */
interface MigrationContext {
  prisma: PrismaClient;
  labId: string;
  /** 源 ID → 目标 ID 映射（用于外键引用） */
  idMap: Map<string, string>;
  dryRun: boolean;
  skipAuditLog: boolean;
}

// ===== 字段映射定义 =====

const labMappings: FieldMapping[] = [
  { source: 'id', target: 'id' },
  { source: 'name', target: 'name', transform: mapString },
  { source: 'institution', target: 'institution', transform: mapString },
  { source: 'address', target: 'address', transform: mapString },
];

const userMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'email', target: 'email', transform: mapString },
  { source: 'name', target: 'name', transform: mapString },
  { source: 'password_hash', target: 'passwordHash', transform: mapString },
  { source: 'passwordHash', target: 'passwordHash', transform: mapString },
  { source: 'avatar_url', target: 'avatarUrl', transform: mapString },
  { source: 'avatarUrl', target: 'avatarUrl', transform: mapString },
];

const userLabMappings: FieldMapping[] = [
  { source: 'user_id', target: 'userId' },
  { source: 'userId', target: 'userId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'role', target: 'role', transform: (v) => mapEnum(v, USER_ROLE, 'researcher') },
];

const roomMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'name', target: 'name', transform: mapString },
  { source: 'location', target: 'location', transform: mapString },
  { source: 'building', target: 'building', transform: mapString },
  { source: 'floor', target: 'floor', transform: mapInt },
  { source: 'capacity', target: 'capacity', transform: mapInt },
  { source: 'temperature_min', target: 'temperatureMin', transform: mapFloat },
  { source: 'temperatureMin', target: 'temperatureMin', transform: mapFloat },
  { source: 'temperature_max', target: 'temperatureMax', transform: mapFloat },
  { source: 'temperatureMax', target: 'temperatureMax', transform: mapFloat },
  { source: 'humidity_min', target: 'humidityMin', transform: mapFloat },
  { source: 'humidityMin', target: 'humidityMin', transform: mapFloat },
  { source: 'humidity_max', target: 'humidityMax', transform: mapFloat },
  { source: 'humidityMax', target: 'humidityMax', transform: mapFloat },
];

const rackMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'room_id', target: 'roomId' },
  { source: 'roomId', target: 'roomId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'name', target: 'name', transform: mapString },
  { source: 'layers', target: 'layers', transform: mapInt },
  { source: 'positions_per_layer', target: 'positionsPerLayer', transform: mapInt },
  { source: 'positionsPerLayer', target: 'positionsPerLayer', transform: mapInt },
];

const cageMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'rack_id', target: 'rackId' },
  { source: 'rackId', target: 'rackId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'position', target: 'position', transform: mapString },
  { source: 'status', target: 'status', transform: (v) => mapEnum(v, CAGE_STATUS, 'empty') },
  { source: 'capacity', target: 'capacity', transform: (v) => mapInt(v) ?? 5 },
  { source: 'is_single_housed', target: 'isSingleHoused', transform: mapBoolean },
  { source: 'isSingleHoused', target: 'isSingleHoused', transform: mapBoolean },
  { source: 'single_housing_reason', target: 'singleHousingReason', transform: mapString },
  { source: 'singleHousingReason', target: 'singleHousingReason', transform: mapString },
  { source: 'single_housing_until', target: 'singleHousingUntil', transform: mapDate },
  { source: 'singleHousingUntil', target: 'singleHousingUntil', transform: mapDate },
  { source: 'last_cleaned', target: 'lastCleaned', transform: mapDate },
  { source: 'lastCleaned', target: 'lastCleaned', transform: mapDate },
  { source: 'next_cleaning', target: 'nextCleaning', transform: mapDate },
  { source: 'nextCleaning', target: 'nextCleaning', transform: mapDate },
];

const protocolMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'title', target: 'title', transform: mapString },
  { source: 'description', target: 'description', transform: mapString },
  { source: 'pi_name', target: 'piName', transform: mapString },
  { source: 'piName', target: 'piName', transform: mapString },
  { source: 'iacuc_number', target: 'iacucNumber', transform: mapString },
  { source: 'iacucNumber', target: 'iacucNumber', transform: mapString },
  { source: 'status', target: 'status', transform: (v) => mapEnum(v, PROTOCOL_STATUS, 'draft') },
  { source: 'pain_category', target: 'painCategory', transform: (v) => mapEnum(v, PAIN_CATEGORY, 'B') },
  { source: 'painCategory', target: 'painCategory', transform: (v) => mapEnum(v, PAIN_CATEGORY, 'B') },
  { source: 'start_date', target: 'startDate', transform: mapDate },
  { source: 'startDate', target: 'startDate', transform: mapDate },
  { source: 'end_date', target: 'endDate', transform: mapDate },
  { source: 'endDate', target: 'endDate', transform: mapDate },
  { source: 'animal_limit', target: 'animalLimit', transform: mapInt },
  { source: 'animalLimit', target: 'animalLimit', transform: mapInt },
  { source: 'three_rs_replacement', target: 'threeRsReplacement', transform: mapString },
  { source: 'threeRsReplacement', target: 'threeRsReplacement', transform: mapString },
  { source: 'three_rs_reduction', target: 'threeRsReduction', transform: mapString },
  { source: 'threeRsReduction', target: 'threeRsReduction', transform: mapString },
  { source: 'three_rs_refinement', target: 'threeRsRefinement', transform: mapString },
  { source: 'threeRsRefinement', target: 'threeRsRefinement', transform: mapString },
  { source: 'has_statistical_justification', target: 'hasStatisticalJustification', transform: mapBoolean },
  { source: 'hasStatisticalJustification', target: 'hasStatisticalJustification', transform: mapBoolean },
  { source: 'involves_surgery', target: 'involvesSurgery', transform: mapBoolean },
  { source: 'involvesSurgery', target: 'involvesSurgery', transform: mapBoolean },
  { source: 'survival_surgery', target: 'survivalSurgery', transform: mapBoolean },
  { source: 'survivalSurgery', target: 'survivalSurgery', transform: mapBoolean },
  { source: 'uses_analgesics', target: 'usesAnalgesics', transform: mapBoolean },
  { source: 'usesAnalgesics', target: 'usesAnalgesics', transform: mapBoolean },
  { source: 'has_humane_endpoints', target: 'hasHumaneEndpoints', transform: mapBoolean },
  { source: 'hasHumaneEndpoints', target: 'hasHumaneEndpoints', transform: mapBoolean },
  { source: 'density_exemption', target: 'densityExemption', transform: mapInt },
  { source: 'densityExemption', target: 'densityExemption', transform: mapInt },
  { source: 'version', target: 'version', transform: (v) => mapInt(v) ?? 1 },
];

const animalMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'internal_id', target: 'internalId', transform: mapString },
  { source: 'internalId', target: 'internalId', transform: mapString },
  { source: 'species', target: 'species', transform: mapString },
  { source: 'strain', target: 'strain', transform: mapString },
  { source: 'genotype', target: 'genotype', transform: mapString },
  { source: 'sex', target: 'sex', transform: (v) => mapEnum(v, SEX, 'unknown') },
  { source: 'date_of_birth', target: 'dateOfBirth', transform: mapDate },
  { source: 'dateOfBirth', target: 'dateOfBirth', transform: mapDate },
  { source: 'arrival_date', target: 'arrivalDate', transform: mapDate },
  { source: 'arrivalDate', target: 'arrivalDate', transform: mapDate },
  { source: 'source', target: 'source', transform: mapString },
  { source: 'cage_id', target: 'cageId' },
  { source: 'cageId', target: 'cageId' },
  { source: 'protocol_id', target: 'protocolId' },
  { source: 'protocolId', target: 'protocolId' },
  { source: 'status', target: 'status', transform: (v) => mapEnum(v, ANIMAL_STATUS, 'active') },
  { source: 'quarantine_status', target: 'quarantineStatus', transform: (v) => mapEnum(v, QUARANTINE_STATUS, 'none') },
  { source: 'quarantineStatus', target: 'quarantineStatus', transform: (v) => mapEnum(v, QUARANTINE_STATUS, 'none') },
  { source: 'quarantine_until', target: 'quarantineUntil', transform: mapDate },
  { source: 'quarantineUntil', target: 'quarantineUntil', transform: mapDate },
  { source: 'notes', target: 'notes', transform: mapString },
];

const healthRecordMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'animal_id', target: 'animalId' },
  { source: 'animalId', target: 'animalId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'record_type', target: 'recordType', transform: (v) => mapEnum(v, RECORD_TYPE, 'check') },
  { source: 'recordType', target: 'recordType', transform: (v) => mapEnum(v, RECORD_TYPE, 'check') },
  { source: 'weight', target: 'weight', transform: mapFloat },
  { source: 'body_condition_score', target: 'bodyConditionScore', transform: mapInt },
  { source: 'bodyConditionScore', target: 'bodyConditionScore', transform: mapInt },
  { source: 'pain_score', target: 'painScore', transform: mapFloat },
  { source: 'painScore', target: 'painScore', transform: mapFloat },
  { source: 'pain_score_type', target: 'painScoreType', transform: mapString },
  { source: 'painScoreType', target: 'painScoreType', transform: mapString },
  { source: 'description', target: 'description', transform: mapString },
  { source: 'treatment', target: 'treatment', transform: mapString },
  { source: 'euthanasia_method_id', target: 'euthanasiaMethodId', transform: mapString },
  { source: 'euthanasiaMethodId', target: 'euthanasiaMethodId', transform: mapString },
  { source: 'recorded_by', target: 'recordedBy' },
  { source: 'recordedBy', target: 'recordedBy' },
  { source: 'recorded_at', target: 'recordedAt', transform: (v) => mapDate(v) ?? new Date() },
  { source: 'recordedAt', target: 'recordedAt', transform: (v) => mapDate(v) ?? new Date() },
];

const deathReportMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'animal_id', target: 'animalId' },
  { source: 'animalId', target: 'animalId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'date_of_death', target: 'dateOfDeath', transform: (v) => mapDate(v) ?? new Date() },
  { source: 'dateOfDeath', target: 'dateOfDeath', transform: (v) => mapDate(v) ?? new Date() },
  { source: 'cause', target: 'cause', transform: (v) => mapEnum(v, DEATH_CAUSE, 'natural') },
  { source: 'euthanasia_method_id', target: 'euthanasiaMethodId', transform: mapString },
  { source: 'euthanasiaMethodId', target: 'euthanasiaMethodId', transform: mapString },
  { source: 'performed_by', target: 'performedBy', transform: mapString },
  { source: 'performedBy', target: 'performedBy', transform: mapString },
  { source: 'necropsy_performed', target: 'necropsyPerformed', transform: mapBoolean },
  { source: 'necropsyPerformed', target: 'necropsyPerformed', transform: mapBoolean },
  { source: 'necropsy_findings', target: 'necropsyFindings', transform: mapString },
  { source: 'necropsyFindings', target: 'necropsyFindings', transform: mapString },
  { source: 'notes', target: 'notes', transform: mapString },
];

const medicationMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'animal_id', target: 'animalId' },
  { source: 'animalId', target: 'animalId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'name', target: 'name', transform: mapString },
  { source: 'dosage', target: 'dosage', transform: mapString },
  { source: 'route', target: 'route', transform: (v) => mapEnum(v, MED_ROUTE, 'other') },
  { source: 'frequency', target: 'frequency', transform: mapString },
  { source: 'start_date', target: 'startDate', transform: (v) => mapDate(v) ?? new Date() },
  { source: 'startDate', target: 'startDate', transform: (v) => mapDate(v) ?? new Date() },
  { source: 'end_date', target: 'endDate', transform: mapDate },
  { source: 'endDate', target: 'endDate', transform: mapDate },
  { source: 'reason', target: 'reason', transform: mapString },
  { source: 'prescribed_by', target: 'prescribedBy', transform: mapString },
  { source: 'prescribedBy', target: 'prescribedBy', transform: mapString },
  { source: 'administered_by', target: 'administeredBy', transform: mapString },
  { source: 'administeredBy', target: 'administeredBy', transform: mapString },
  { source: 'outcome', target: 'outcome', transform: mapString },
  { source: 'notes', target: 'notes', transform: mapString },
];

const animalIdentifierMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'animal_id', target: 'animalId' },
  { source: 'animalId', target: 'animalId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'type', target: 'type', transform: (v) => mapEnum(v, IDENTIFIER_TYPE, 'other') },
  { source: 'value', target: 'value', transform: mapString },
  { source: 'is_primary', target: 'isPrimary', transform: mapBoolean },
  { source: 'isPrimary', target: 'isPrimary', transform: mapBoolean },
  { source: 'notes', target: 'notes', transform: mapString },
];

const animalLinkMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'animal_id', target: 'animalId' },
  { source: 'animalId', target: 'animalId' },
  { source: 'linked_to_id', target: 'linkedToId' },
  { source: 'linkedToId', target: 'linkedToId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'reason', target: 'reason', transform: mapString },
];

const breedingMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'sire_id', target: 'sireId' },
  { source: 'sireId', target: 'sireId' },
  { source: 'dam_id', target: 'damId' },
  { source: 'damId', target: 'damId' },
  { source: 'pair_date', target: 'pairDate', transform: mapDate },
  { source: 'pairDate', target: 'pairDate', transform: mapDate },
  { source: 'litter_date', target: 'litterDate', transform: mapDate },
  { source: 'litterDate', target: 'litterDate', transform: mapDate },
  { source: 'litter_size', target: 'litterSize', transform: mapInt },
  { source: 'litterSize', target: 'litterSize', transform: mapInt },
  { source: 'weaned_count', target: 'weanedCount', transform: mapInt },
  { source: 'weanedCount', target: 'weanedCount', transform: mapInt },
  { source: 'weaning_date', target: 'weaningDate', transform: mapDate },
  { source: 'weaningDate', target: 'weaningDate', transform: mapDate },
  { source: 'notes', target: 'notes', transform: mapString },
];

const enrichmentMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'cage_id', target: 'cageId' },
  { source: 'cageId', target: 'cageId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'type', target: 'type', transform: (v) => mapEnum(v, ENRICHMENT_TYPE, 'other') },
  { source: 'description', target: 'description', transform: mapString },
  { source: 'added_date', target: 'addedDate', transform: (v) => mapDate(v) ?? new Date() },
  { source: 'addedDate', target: 'addedDate', transform: (v) => mapDate(v) ?? new Date() },
  { source: 'removed_date', target: 'removedDate', transform: mapDate },
  { source: 'removedDate', target: 'removedDate', transform: mapDate },
  { source: 'added_by', target: 'addedBy', transform: mapString },
  { source: 'addedBy', target: 'addedBy', transform: mapString },
  { source: 'notes', target: 'notes', transform: mapString },
];

const trainingMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'user_id', target: 'userId' },
  { source: 'userId', target: 'userId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'type', target: 'type', transform: (v) => mapEnum(v, TRAINING_TYPE, 'other') },
  { source: 'certification_number', target: 'certificationNumber', transform: mapString },
  { source: 'certificationNumber', target: 'certificationNumber', transform: mapString },
  { source: 'issued_by', target: 'issuedBy', transform: mapString },
  { source: 'issuedBy', target: 'issuedBy', transform: mapString },
  { source: 'issued_date', target: 'issuedDate', transform: mapDate },
  { source: 'issuedDate', target: 'issuedDate', transform: mapDate },
  { source: 'expiration_date', target: 'expirationDate', transform: mapDate },
  { source: 'expirationDate', target: 'expirationDate', transform: mapDate },
  { source: 'status', target: 'status', transform: (v) => mapEnum(v, TRAINING_STATUS, 'active') },
  { source: 'document_url', target: 'documentUrl', transform: mapString },
  { source: 'documentUrl', target: 'documentUrl', transform: mapString },
  { source: 'notes', target: 'notes', transform: mapString },
];

const rateMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'species', target: 'species', transform: mapString },
  { source: 'daily_rate', target: 'dailyRate', transform: (v) => mapFloat(v) ?? 0 },
  { source: 'dailyRate', target: 'dailyRate', transform: (v) => mapFloat(v) ?? 0 },
  { source: 'cage_rate', target: 'cageRate', transform: mapFloat },
  { source: 'cageRate', target: 'cageRate', transform: mapFloat },
  { source: 'effective_date', target: 'effectiveDate', transform: mapDate },
  { source: 'effectiveDate', target: 'effectiveDate', transform: mapDate },
];

const electronicSignatureMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'user_id', target: 'userId' },
  { source: 'userId', target: 'userId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'protocol_id', target: 'protocolId' },
  { source: 'protocolId', target: 'protocolId' },
  { source: 'entity_type', target: 'entityType', transform: (v) => mapEnum(v, ENTITY_TYPE, 'protocol') },
  { source: 'entityType', target: 'entityType', transform: (v) => mapEnum(v, ENTITY_TYPE, 'protocol') },
  { source: 'entity_id', target: 'entityId' },
  { source: 'entityId', target: 'entityId' },
  { source: 'meaning', target: 'meaning', transform: (v) => mapEnum(v, SIGNATURE_MEANING, 'reviewed') },
  { source: 'printed_name', target: 'printedName', transform: mapString },
  { source: 'printedName', target: 'printedName', transform: mapString },
  { source: 'title', target: 'title', transform: mapString },
  { source: 'reason_for_signing', target: 'reasonForSigning', transform: mapString },
  { source: 'reasonForSigning', target: 'reasonForSigning', transform: mapString },
  { source: 'signature_hash', target: 'signatureHash', transform: mapString },
  { source: 'signatureHash', target: 'signatureHash', transform: mapString },
  { source: 'signed_at', target: 'signedAt', transform: (v) => mapDate(v) ?? new Date() },
  { source: 'signedAt', target: 'signedAt', transform: (v) => mapDate(v) ?? new Date() },
  { source: 'ip_address', target: 'ipAddress', transform: mapString },
  { source: 'ipAddress', target: 'ipAddress', transform: mapString },
  { source: 'notes', target: 'notes', transform: mapString },
];

const batchSessionMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'batch_number', target: 'batchNumber', transform: mapString },
  { source: 'batchNumber', target: 'batchNumber', transform: mapString },
  { source: 'material_type', target: 'materialType', transform: (v) => mapEnum(v, BATCH_MATERIAL_TYPE, 'other') },
  { source: 'materialType', target: 'materialType', transform: (v) => mapEnum(v, BATCH_MATERIAL_TYPE, 'other') },
  { source: 'supplier', target: 'supplier', transform: mapString },
  { source: 'received_date', target: 'receivedDate', transform: mapDate },
  { source: 'receivedDate', target: 'receivedDate', transform: mapDate },
  { source: 'expiration_date', target: 'expirationDate', transform: mapDate },
  { source: 'expirationDate', target: 'expirationDate', transform: mapDate },
  { source: 'quantity', target: 'quantity', transform: mapFloat },
  { source: 'unit', target: 'unit', transform: mapString },
  { source: 'storage_location', target: 'storageLocation', transform: mapString },
  { source: 'storageLocation', target: 'storageLocation', transform: mapString },
  { source: 'notes', target: 'notes', transform: mapString },
];

const workSessionMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'user_id', target: 'userId' },
  { source: 'userId', target: 'userId' },
  { source: 'started_at', target: 'startedAt', transform: (v) => mapDate(v) ?? new Date() },
  { source: 'startedAt', target: 'startedAt', transform: (v) => mapDate(v) ?? new Date() },
  { source: 'ended_at', target: 'endedAt', transform: mapDate },
  { source: 'endedAt', target: 'endedAt', transform: mapDate },
  { source: 'timeout_at', target: 'timeoutAt', transform: (v) => mapDate(v) ?? new Date() },
  { source: 'timeoutAt', target: 'timeoutAt', transform: (v) => mapDate(v) ?? new Date() },
];

const auditLogMappings: FieldMapping[] = [
  { source: 'id', target: 'sourceId' },
  { source: 'lab_id', target: 'labId' },
  { source: 'labId', target: 'labId' },
  { source: 'user_id', target: 'userId' },
  { source: 'userId', target: 'userId' },
  { source: 'action', target: 'action', transform: mapString },
  { source: 'entity_type', target: 'entityType', transform: mapString },
  { source: 'entityType', target: 'entityType', transform: mapString },
  { source: 'entity_id', target: 'entityId' },
  { source: 'entityId', target: 'entityId' },
  { source: 'diff', target: 'diff' },
  { source: 'hash', target: 'hash', transform: mapString },
  { source: 'previous_hash', target: 'previousHash', transform: mapString },
  { source: 'previousHash', target: 'previousHash', transform: mapString },
];

// ===== ID 映射辅助函数 =====

function resolveId(ctx: MigrationContext, sourceId: unknown): string {
  if (!sourceId) return '';
  const sid = String(sourceId);
  return ctx.idMap.get(sid) ?? sid;
}

function resolveOptionalId(ctx: MigrationContext, sourceId: unknown): string | null {
  if (!sourceId) return null;
  return resolveId(ctx, sourceId);
}

// ===== 各表写入函数 =====

async function migrateLabs(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'labs', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, labMappings);
    const sourceId = String(mapped.id);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      // 如果指定了 labId，跳过其他 lab
      if (ctx.labId && sourceId !== ctx.labId) {
        result.skipped++;
        continue;
      }

      const lab = await ctx.prisma.lab.upsert({
        where: { id: ctx.labId },
        update: {
          name: mapped.name as string,
          institution: mapped.institution as string | null,
          address: mapped.address as string | null,
        },
        create: {
          id: ctx.labId,
          name: (mapped.name as string) ?? 'Migrated Lab',
          institution: mapped.institution as string | null,
          address: mapped.address as string | null,
        },
      });
      ctx.idMap.set(sourceId, lab.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`lab ${sourceId}: ${e}`);
    }
  }

  // 如果没有 lab 数据但指定了 labId，确保 lab 存在
  if (rows.length === 0 && ctx.labId && !ctx.dryRun) {
    await ctx.prisma.lab.upsert({
      where: { id: ctx.labId },
      update: {},
      create: { id: ctx.labId, name: 'Migrated Lab' },
    });
  }

  return result;
}

async function migrateUsers(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'users', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, userMappings);
    const sourceId = String(mapped.sourceId);
    const email = mapped.email as string;

    if (!email) {
      result.errors.push(`user ${sourceId}: missing email`);
      continue;
    }

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const user = await ctx.prisma.user.upsert({
        where: { email },
        update: {
          name: (mapped.name as string) ?? 'Unknown',
          passwordHash: mapped.passwordHash as string | null,
          avatarUrl: mapped.avatarUrl as string | null,
        },
        create: {
          email,
          name: (mapped.name as string) ?? 'Unknown',
          passwordHash: mapped.passwordHash as string | null,
          avatarUrl: mapped.avatarUrl as string | null,
        },
      });
      ctx.idMap.set(sourceId, user.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`user ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateUserLabs(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'user_labs', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, userLabMappings);
    const userId = resolveId(ctx, mapped.userId);
    const labId = ctx.labId;

    if (!userId || !labId) {
      result.errors.push(`user_lab: missing userId or labId`);
      continue;
    }

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      await ctx.prisma.userLab.upsert({
        where: { userId_labId: { userId, labId } },
        update: { role: mapped.role as string },
        create: { userId, labId, role: (mapped.role as string) ?? 'researcher' },
      });
      result.imported++;
    } catch (e) {
      result.errors.push(`user_lab ${userId}/${labId}: ${e}`);
    }
  }

  return result;
}

async function migrateProtocols(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'protocols', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, protocolMappings);
    const sourceId = String(mapped.sourceId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const { sourceId: _, labId: _labId, ...data } = mapped;
      const protocol = await ctx.prisma.protocol.create({
        data: {
          ...data as any,
          labId: ctx.labId,
        },
      });
      ctx.idMap.set(sourceId, protocol.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`protocol ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateRooms(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'rooms', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, roomMappings);
    const sourceId = String(mapped.sourceId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const { sourceId: _, labId: _labId, ...data } = mapped;
      const room = await ctx.prisma.room.create({
        data: {
          ...data as any,
          labId: ctx.labId,
        },
      });
      ctx.idMap.set(sourceId, room.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`room ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateRacks(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'racks', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, rackMappings);
    const sourceId = String(mapped.sourceId);
    const roomId = resolveId(ctx, mapped.roomId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const rack = await ctx.prisma.rack.create({
        data: {
          name: mapped.name as string,
          layers: mapped.layers as number | null,
          positionsPerLayer: mapped.positionsPerLayer as number | null,
          labId: ctx.labId,
          roomId,
        },
      });
      ctx.idMap.set(sourceId, rack.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`rack ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateCages(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'cages', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, cageMappings);
    const sourceId = String(mapped.sourceId);
    const rackId = resolveId(ctx, mapped.rackId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const cage = await ctx.prisma.cage.create({
        data: {
          position: mapped.position as string,
          status: mapped.status as string,
          capacity: mapped.capacity as number,
          isSingleHoused: mapped.isSingleHoused as boolean,
          singleHousingReason: mapped.singleHousingReason as string | null,
          singleHousingUntil: mapped.singleHousingUntil as Date | null,
          lastCleaned: mapped.lastCleaned as Date | null,
          nextCleaning: mapped.nextCleaning as Date | null,
          labId: ctx.labId,
          rackId,
        },
      });
      ctx.idMap.set(sourceId, cage.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`cage ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateAnimals(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'animals', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, animalMappings);
    const sourceId = String(mapped.sourceId);
    const cageId = resolveOptionalId(ctx, mapped.cageId);
    const protocolId = resolveOptionalId(ctx, mapped.protocolId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      // Animal 没有 labId+internalId 唯一约束，用 findFirst + create/update
      const internalId = mapped.internalId as string;
      const existing = await ctx.prisma.animal.findFirst({
        where: { labId: ctx.labId, internalId },
        select: { id: true },
      });

      const animalData = {
        species: mapped.species as string,
        strain: mapped.strain as string | null,
        genotype: mapped.genotype as string | null,
        sex: mapped.sex as string,
        dateOfBirth: mapped.dateOfBirth as Date | null,
        arrivalDate: mapped.arrivalDate as Date | null,
        source: mapped.source as string | null,
        status: mapped.status as string,
        quarantineStatus: mapped.quarantineStatus as string,
        quarantineUntil: mapped.quarantineUntil as Date | null,
        notes: mapped.notes as string | null,
        ...(cageId ? { cageId } : {}),
        ...(protocolId ? { protocolId } : {}),
      };

      let animal;
      if (existing) {
        animal = await ctx.prisma.animal.update({
          where: { id: existing.id },
          data: animalData,
        });
      } else {
        animal = await ctx.prisma.animal.create({
          data: {
            ...animalData,
            labId: ctx.labId,
            internalId,
          },
        });
      }
      ctx.idMap.set(sourceId, animal.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`animal ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateHealthRecords(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'health_records', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, healthRecordMappings);
    const sourceId = String(mapped.sourceId);
    const animalId = resolveId(ctx, mapped.animalId);
    const recordedBy = resolveId(ctx, mapped.recordedBy);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const record = await ctx.prisma.healthRecord.create({
        data: {
          animalId,
          labId: ctx.labId,
          recordType: mapped.recordType as string,
          weight: mapped.weight as number | null,
          bodyConditionScore: mapped.bodyConditionScore as number | null,
          painScore: mapped.painScore as number | null,
          painScoreType: mapped.painScoreType as string | null,
          description: mapped.description as string | null,
          treatment: mapped.treatment as string | null,
          euthanasiaMethodId: mapped.euthanasiaMethodId as string | null,
          recordedBy,
          recordedAt: mapped.recordedAt as Date,
        },
      });
      ctx.idMap.set(sourceId, record.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`health_record ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateDeathReports(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'death_reports', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, deathReportMappings);
    const sourceId = String(mapped.sourceId);
    const animalId = resolveId(ctx, mapped.animalId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const report = await ctx.prisma.deathReport.create({
        data: {
          animalId,
          labId: ctx.labId,
          dateOfDeath: mapped.dateOfDeath as Date,
          cause: mapped.cause as string,
          euthanasiaMethodId: mapped.euthanasiaMethodId as string | null,
          performedBy: mapped.performedBy as string | null,
          necropsyPerformed: mapped.necropsyPerformed as boolean,
          necropsyFindings: mapped.necropsyFindings as string | null,
          notes: mapped.notes as string | null,
        },
      });
      ctx.idMap.set(sourceId, report.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`death_report ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateMedications(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'medications', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, medicationMappings);
    const sourceId = String(mapped.sourceId);
    const animalId = resolveId(ctx, mapped.animalId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const med = await ctx.prisma.medication.create({
        data: {
          animalId,
          labId: ctx.labId,
          name: mapped.name as string,
          dosage: mapped.dosage as string,
          route: mapped.route as string,
          frequency: mapped.frequency as string,
          startDate: mapped.startDate as Date,
          endDate: mapped.endDate as Date | null,
          reason: mapped.reason as string | null,
          prescribedBy: mapped.prescribedBy as string | null,
          administeredBy: mapped.administeredBy as string | null,
          outcome: mapped.outcome as string | null,
          notes: mapped.notes as string | null,
        },
      });
      ctx.idMap.set(sourceId, med.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`medication ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateAnimalIdentifiers(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'animal_identifiers', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, animalIdentifierMappings);
    const sourceId = String(mapped.sourceId);
    const animalId = resolveId(ctx, mapped.animalId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      // upsert 基于 animalId_type_value 唯一约束
      const identifier = await ctx.prisma.animalIdentifier.upsert({
        where: {
          animalId_type_value: {
            animalId,
            type: mapped.type as string,
            value: mapped.value as string,
          },
        },
        update: {
          isPrimary: mapped.isPrimary as boolean,
          notes: mapped.notes as string | null,
          labId: ctx.labId,
        },
        create: {
          animalId,
          labId: ctx.labId,
          type: mapped.type as string,
          value: mapped.value as string,
          isPrimary: mapped.isPrimary as boolean,
          notes: mapped.notes as string | null,
        },
      });
      ctx.idMap.set(sourceId, identifier.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`animal_identifier ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateAnimalLinks(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'animal_links', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, animalLinkMappings);
    const sourceId = String(mapped.sourceId);
    const animalId = resolveId(ctx, mapped.animalId);
    const linkedToId = resolveId(ctx, mapped.linkedToId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const link = await ctx.prisma.animalLink.create({
        data: {
          animalId,
          linkedToId,
          labId: ctx.labId,
          reason: mapped.reason as string,
        },
      });
      ctx.idMap.set(sourceId, link.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`animal_link ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateBreedings(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'breeding', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, breedingMappings);
    const sourceId = String(mapped.sourceId);
    const sireId = resolveId(ctx, mapped.sireId);
    const damId = resolveId(ctx, mapped.damId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const breeding = await ctx.prisma.breeding.create({
        data: {
          labId: ctx.labId,
          sireId,
          damId,
          pairDate: mapped.pairDate as Date | null,
          litterDate: mapped.litterDate as Date | null,
          litterSize: mapped.litterSize as number | null,
          weanedCount: mapped.weanedCount as number | null,
          weaningDate: mapped.weaningDate as Date | null,
          notes: mapped.notes as string | null,
        },
      });
      ctx.idMap.set(sourceId, breeding.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`breeding ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateEnrichments(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'enrichments', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, enrichmentMappings);
    const sourceId = String(mapped.sourceId);
    const cageId = resolveId(ctx, mapped.cageId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const enrichment = await ctx.prisma.enrichment.create({
        data: {
          cageId,
          labId: ctx.labId,
          type: mapped.type as string,
          description: mapped.description as string | null,
          addedDate: mapped.addedDate as Date,
          removedDate: mapped.removedDate as Date | null,
          addedBy: mapped.addedBy as string | null,
          notes: mapped.notes as string | null,
        },
      });
      ctx.idMap.set(sourceId, enrichment.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`enrichment ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateTrainings(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'trainings', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, trainingMappings);
    const sourceId = String(mapped.sourceId);
    const userId = resolveId(ctx, mapped.userId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const training = await ctx.prisma.training.create({
        data: {
          userId,
          labId: ctx.labId,
          type: mapped.type as string,
          certificationNumber: mapped.certificationNumber as string | null,
          issuedBy: mapped.issuedBy as string | null,
          issuedDate: mapped.issuedDate as Date | null,
          expirationDate: mapped.expirationDate as Date | null,
          status: mapped.status as string,
          documentUrl: mapped.documentUrl as string | null,
          notes: mapped.notes as string | null,
        },
      });
      ctx.idMap.set(sourceId, training.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`training ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateRates(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'rates', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, rateMappings);
    const sourceId = String(mapped.sourceId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const rate = await ctx.prisma.rate.create({
        data: {
          labId: ctx.labId,
          species: mapped.species as string,
          dailyRate: mapped.dailyRate as number,
          cageRate: mapped.cageRate as number | null,
          effectiveDate: mapped.effectiveDate as Date | null,
        },
      });
      ctx.idMap.set(sourceId, rate.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`rate ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateElectronicSignatures(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'electronic_signatures', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, electronicSignatureMappings);
    const sourceId = String(mapped.sourceId);
    const userId = resolveId(ctx, mapped.userId);
    const protocolId = resolveOptionalId(ctx, mapped.protocolId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const sig = await ctx.prisma.electronicSignature.create({
        data: {
          userId,
          labId: ctx.labId,
          protocolId,
          entityType: mapped.entityType as string,
          entityId: mapped.entityId as string,
          meaning: mapped.meaning as string,
          printedName: mapped.printedName as string,
          title: mapped.title as string | null,
          reasonForSigning: mapped.reasonForSigning as string | null,
          signatureHash: mapped.signatureHash as string,
          signedAt: mapped.signedAt as Date,
          ipAddress: mapped.ipAddress as string | null,
          notes: mapped.notes as string | null,
        },
      });
      ctx.idMap.set(sourceId, sig.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`electronic_signature ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateBatchSessions(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'batch_sessions', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, batchSessionMappings);
    const sourceId = String(mapped.sourceId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const batch = await ctx.prisma.batchSession.create({
        data: {
          labId: ctx.labId,
          batchNumber: mapped.batchNumber as string,
          materialType: mapped.materialType as string,
          supplier: mapped.supplier as string | null,
          receivedDate: mapped.receivedDate as Date | null,
          expirationDate: mapped.expirationDate as Date | null,
          quantity: mapped.quantity as number | null,
          unit: mapped.unit as string | null,
          storageLocation: mapped.storageLocation as string | null,
          notes: mapped.notes as string | null,
        },
      });
      ctx.idMap.set(sourceId, batch.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`batch_session ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateWorkSessions(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'work_sessions', imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const mapped = mapRow(row, workSessionMappings);
    const sourceId = String(mapped.sourceId);
    const userId = resolveId(ctx, mapped.userId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const session = await ctx.prisma.workSession.create({
        data: {
          labId: ctx.labId,
          userId,
          startedAt: mapped.startedAt as Date,
          endedAt: mapped.endedAt as Date | null,
          timeoutAt: mapped.timeoutAt as Date,
        },
      });
      ctx.idMap.set(sourceId, session.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`work_session ${sourceId}: ${e}`);
    }
  }

  return result;
}

async function migrateAuditLogs(ctx: MigrationContext, rows: Record<string, unknown>[]): Promise<MigrationResult> {
  const result: MigrationResult = { table: 'audit_log', imported: 0, skipped: 0, errors: [] };

  if (ctx.skipAuditLog) {
    result.skipped = rows.length;
    return result;
  }

  for (const row of rows) {
    const mapped = mapRow(row, auditLogMappings);
    const sourceId = String(mapped.sourceId);
    const userId = resolveId(ctx, mapped.userId);

    if (ctx.dryRun) {
      result.imported++;
      continue;
    }

    try {
      const log = await ctx.prisma.auditLog.create({
        data: {
          labId: ctx.labId,
          userId,
          action: mapped.action as string,
          entityType: mapped.entityType as string,
          entityId: mapped.entityId as string,
          diff: mapped.diff as any,
          hash: (mapped.hash as string) ?? `migrated-${sourceId}`,
          previousHash: (mapped.previousHash as string) ?? '0',
        },
      });
      ctx.idMap.set(sourceId, log.id);
      result.imported++;
    } catch (e) {
      result.errors.push(`audit_log ${sourceId}: ${e}`);
    }
  }

  return result;
}

/**
 * 执行数据写入 PostgreSQL
 *
 * 严格遵循外键依赖顺序：
 * Lab → User → UserLab → Protocol → Room → Rack → Cage →
 * Animal → AnimalIdentifier → AnimalLink →
 * HealthRecord, DeathReport, Medication →
 * Breeding, Enrichment →
 * Training, Rate, BatchSession →
 * WorkSession, ElectronicSignature, AuditLog
 */
export async function writePostgres(
  data: SQLiteData,
  labId: string,
  options: { dryRun?: boolean; skipAuditLog?: boolean } = {}
): Promise<MigrationResult[]> {
  const prisma = new PrismaClient();
  const ctx: MigrationContext = {
    prisma,
    labId,
    idMap: new Map(),
    dryRun: options.dryRun ?? false,
    skipAuditLog: options.skipAuditLog ?? false,
  };

  const results: MigrationResult[] = [];

  try {
    // 按外键依赖顺序迁移
    results.push(await migrateLabs(ctx, data.labs));
    results.push(await migrateUsers(ctx, data.users));
    results.push(await migrateUserLabs(ctx, data.userLabs));
    results.push(await migrateProtocols(ctx, data.protocols));
    results.push(await migrateRooms(ctx, data.rooms));
    results.push(await migrateRacks(ctx, data.racks));
    results.push(await migrateCages(ctx, data.cages));
    results.push(await migrateAnimals(ctx, data.animals));
    results.push(await migrateAnimalIdentifiers(ctx, data.animalIdentifiers));
    results.push(await migrateAnimalLinks(ctx, data.animalLinks));
    results.push(await migrateHealthRecords(ctx, data.healthRecords));
    results.push(await migrateDeathReports(ctx, data.deathReports));
    results.push(await migrateMedications(ctx, data.medications));
    results.push(await migrateBreedings(ctx, data.breedings));
    results.push(await migrateEnrichments(ctx, data.enrichments));
    results.push(await migrateTrainings(ctx, data.trainings));
    results.push(await migrateRates(ctx, data.rates));
    results.push(await migrateBatchSessions(ctx, data.batchSessions));
    results.push(await migrateWorkSessions(ctx, data.workSessions));
    results.push(await migrateElectronicSignatures(ctx, data.electronicSignatures));
    results.push(await migrateAuditLogs(ctx, data.auditLogs));
  } finally {
    await prisma.$disconnect();
  }

  return results;
}
