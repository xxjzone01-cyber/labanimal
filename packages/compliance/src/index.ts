/**
 * @labanimal/compliance — LabAnimal compliance engine
 *
 * - Cage density calculations (Guide for the Care and Use of Laboratory Animals, NRC 2011)
 * - AVMA euthanasia method validation (AVMA Guidelines 2020)
 * - IACUC protocol validation (USDA pain categories, 3Rs, protocol checks)
 * - Audit logging (diff generator, SHA-256 hash chain)
 * - License JWT signing/verification + report signatures
 *
 * Zero dependencies. Apache-2.0 license.
 */

// Density module
export {
  calculateMaxDensity,
  getGuideBaseline,
  isSpeciesSupported,
  getSupportedSpecies,
  GUIDE_STANDARDS,
  MOUSE_STANDARDS,
  RAT_STANDARDS,
  HAMSTER_STANDARDS,
  GUINEA_PIG_STANDARDS,
  RABBIT_STANDARDS,
} from './density/index.js';
export type { DensityInput, DensityResult, DensityStandard } from './density/index.js';

// AVMA module (isSpeciesSupported/getSupportedSpecies omitted to avoid name collision with density module)
export {
  validateMethod,
  getMethodsForSpecies,
  AVMA_METHODS_DB,
} from './avma/index.js';
export type { ValidationInput, ValidationResult, AVMACategory, EuthanasiaMethod, SpeciesMethods } from './avma/index.js';

// IACUC module
export {
  classifyPainCategory,
  getAllCategories,
  isValidCategory,
  validateThreeRs,
  validateProtocol,
  isValidStatusTransition,
} from './iacuc/index.js';
export type { USDACategory, PainCategoryResult, ThreeRsInput, ThreeRsResult, ProtocolInput, ProtocolValidationResult } from './iacuc/index.js';

// Audit module
export {
  generateDiff,
  summarizeDiff,
  sha256,
  hashAuditEntry,
  verifyAuditEntry,
  GENESIS_HASH,
} from './audit/index.js';
export type { DiffEntry } from './audit/index.js';

// License module
export {
  generateKeyPair,
  isValidPublicKey,
  isValidPrivateKey,
  signLicense,
  verifyLicense,
  signReport,
  verifyReportSignature,
  signReportUnverified,
} from './license/index.js';
export type {
  LicensePayload,
  LicenseVerification,
  ReportSignatureData,
  ReportSignatureVerification,
  KeyPair,
} from './license/index.js';
