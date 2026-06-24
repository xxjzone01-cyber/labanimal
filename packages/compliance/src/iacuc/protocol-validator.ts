/**
 * IACUC Protocol Validation
 *
 * Validates protocol submissions against common IACUC requirements.
 * Reference: PHS Policy on Humane Care and Use of Laboratory Animals (2015)
 */

import type { USDACategory } from './pain-categories.js';
import { validateThreeRs, type ThreeRsInput } from './three-rs.js';

export interface ProtocolInput {
  /** Protocol title */
  title: string;
  /** Principal Investigator name */
  piName: string;
  /** IACUC protocol number (if assigned) */
  iacucNumber?: string;
  /** Protocol status */
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'expired';
  /** Start date (ISO string) */
  startDate?: string;
  /** End date (ISO string) */
  endDate?: string;
  /** Species involved */
  species: string[];
  /** Number of animals per species */
  animalCounts: Record<string, number>;
  /** Whether non-animal alternatives were considered */
  alternativesConsidered: boolean;
  /** Explanation if alternatives not used */
  alternativesExplanation?: string;
  /** Has statistical justification for animal numbers */
  hasStatisticalJustification: boolean;
  /** Pain/distress category */
  painCategory: USDACategory;
  /** Uses analgesics/anesthetics */
  usesAnalgesics: boolean;
  /** Has humane endpoints defined */
  hasHumaneEndpoints: boolean;
  /** Personnel trained */
  personnelTrained: boolean;
  /** Whether surgical procedures are involved */
  involvesSurgery: boolean;
  /** Whether survival surgery is performed */
  survivalSurgery: boolean;
  /** Number of survival surgeries per animal (if applicable) */
  survivalSurgeryCount?: number;
}

export interface ProtocolValidationResult {
  /** Whether the protocol passes all checks */
  valid: boolean;
  /** Blocking violations (must fix) */
  violations: string[];
  /** Warnings (should address but not blocking) */
  warnings: string[];
  /** 3R compliance details */
  threeRs: ReturnType<typeof validateThreeRs>;
}

/**
 * Validate an IACUC protocol submission.
 */
export function validateProtocol(input: ProtocolInput): ProtocolValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // --- Basic field validation ---
  if (!input.title?.trim()) {
    violations.push('Protocol title is required.');
  }
  if (!input.piName?.trim()) {
    violations.push('Principal Investigator name is required.');
  }
  if (!input.species || input.species.length === 0) {
    violations.push('At least one species must be specified.');
  }

  // --- Animal count validation ---
  const totalAnimals = Object.values(input.animalCounts).reduce((sum, n) => sum + n, 0);
  if (totalAnimals <= 0) {
    violations.push('Total animal count must be greater than zero.');
  }

  for (const [species, count] of Object.entries(input.animalCounts)) {
    if (count < 0) {
      violations.push(`Animal count for ${species} cannot be negative.`);
    }
  }

  // --- Date validation ---
  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (end <= start) {
      violations.push('Protocol end date must be after start date.');
    }
    // Check if protocol duration exceeds typical 3-year approval
    const threeYearsMs = 3 * 365.25 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > threeYearsMs) {
      warnings.push('Protocol duration exceeds 3 years. Most IACUCs limit approval to 3 years.');
    }
  }

  // --- Category E specific requirements ---
  if (input.painCategory === 'E') {
    if (!input.alternativesConsidered) {
      violations.push(
        'Category E protocols must document that non-animal alternatives were considered and explain why they are not feasible.'
      );
    }
    if (input.alternativesConsidered && !input.alternativesExplanation?.trim()) {
      violations.push(
        'Category E protocols must provide a written justification for unalleviated pain/distress.'
      );
    }
  }

  // --- Surgery-specific checks ---
  if (input.survivalSurgery) {
    if (input.survivalSurgeryCount != null && input.survivalSurgeryCount > 1) {
      warnings.push(
        'Multiple major survival surgeries on a single animal require strong scientific justification.'
      );
    }
  }

  // --- 3Rs validation ---
  const threeRsInput: ThreeRsInput = {
    requestedAnimalCount: totalAnimals,
    hasStatisticalJustification: input.hasStatisticalJustification,
    alternativesConsidered: input.alternativesConsidered,
    alternativesExplanation: input.alternativesExplanation,
    painCategory: input.painCategory,
    usesAnalgesics: input.usesAnalgesics,
    hasHumaneEndpoints: input.hasHumaneEndpoints,
    personnelTrained: input.personnelTrained,
  };

  const threeRs = validateThreeRs(threeRsInput);

  // 3R non-compliance becomes violations
  violations.push(...threeRs.allIssues);

  return {
    valid: violations.length === 0,
    violations,
    warnings,
    threeRs,
  };
}

/**
 * Check if a protocol status transition is valid.
 */
export function isValidStatusTransition(
  from: ProtocolInput['status'],
  to: ProtocolInput['status']
): boolean {
  const validTransitions: Record<string, string[]> = {
    draft: ['submitted'],
    submitted: ['approved', 'rejected'],
    approved: ['expired'],
    rejected: ['draft'],
    expired: ['draft'],
  };
  return validTransitions[from]?.includes(to) ?? false;
}
