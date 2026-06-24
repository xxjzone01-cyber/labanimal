/**
 * License Module — Type Definitions
 *
 * Types for License JWT signing/verification and report signatures.
 */

/** License payload (signed by server, verified by client) */
export interface LicensePayload {
  /** Unique deployment identifier */
  deployId: string;
  /** Maximum number of active animals */
  maxAnimals: number;
  /** Maximum compliance reports per month */
  maxReportsPerMonth: number;
  /** Available compliance modules: ["basic"] or ["basic", "full"] */
  complianceModules: string[];
  /** Issuance time (Unix timestamp, seconds) */
  issuedAt: number;
  /** Expiration time (Unix timestamp, seconds) */
  expiresAt: number;
}

/** Result of License JWT verification */
export interface LicenseVerification {
  valid: boolean;
  payload: LicensePayload | null;
  error?: 'expired' | 'invalid_signature' | 'malformed' | 'algorithm_not_allowed';
}

/** Report signature data (embedded in PDF footer) */
export interface ReportSignatureData {
  /** SHA-256 hash of the report content */
  reportHash: string;
  /** Deployment ID that generated the report */
  deployId: string;
  /** Signature time (Unix timestamp, milliseconds) */
  signedAt: number;
  /** Signature status */
  status: 'verified' | 'unverified';
}

/** Result of report signature verification */
export interface ReportSignatureVerification {
  valid: boolean;
  data: ReportSignatureData | null;
  /** URL for QR code: labanimal.tech/verify?hash=xxx */
  verifyUrl: string;
  error?: 'invalid_signature' | 'tampered' | 'unverified' | 'signature_expired';
}
