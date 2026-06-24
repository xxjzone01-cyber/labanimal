import { GUIDE_STANDARDS, type DensityStandard } from './guide-standards.js';

/**
 * Input for cage density calculation
 */
export interface DensityInput {
  /** Species identifier (mouse, rat, hamster, guinea_pig, rabbit) */
  species: string;
  /** Weight of the heaviest animal in grams */
  weightGrams: number;
  /** Number of animals currently in the cage */
  currentCount: number;
  /** Number of animals attempting to be added (default: 1) */
  addingCount?: number;
  /**
   * IACUC protocol-approved density override.
   * Only set when the protocol explicitly requested a density exemption
   * and it was approved by the full committee (FCR).
   * null = no protocol override.
   */
  protocolApprovedDensity?: number | null;
  /** Is this animal post-surgery (<48h recovery)? */
  isPostSurgery?: boolean;
}

export interface DensityResult {
  /** Whether the operation is allowed */
  allowed: boolean;
  /** Maximum number of animals allowed in this cage */
  maxCount: number;
  /** Current animal count after the proposed addition */
  projectedCount: number;
  /** Source of the density limit */
  source: 'guide_baseline' | 'protocol_override' | 'post_surgery_limit';
  /** Guide baseline (always calculated, regardless of override) */
  guideBaseline: number;
  /** Human-readable reason for the decision */
  reason: string;
}

/**
 * Post-surgery recovery: maximum 1 animal per cage unless
 * IACUC protocol explicitly approves group housing recovery.
 */
const POST_SURGERY_MAX = 1;

/**
 * Calculate the maximum allowed cage density based on Guide standards
 * and IACUC protocol pre-approval.
 *
 * Logic:
 * 1. Look up Guide Table baseline for species + weight
 * 2. If protocol approved density exists and is LOWER than Guide, use it
 * 3. If post-surgery, cap at 1 (unless protocol overrides)
 * 4. Hard lock: never exceed Guide baseline, even with protocol override
 *
 * @throws {Error} if species is unknown
 */
export function calculateMaxDensity(input: DensityInput): DensityResult {
  const { species, weightGrams, currentCount, addingCount = 1 } = input;

  const standards = GUIDE_STANDARDS[species.toLowerCase()];
  if (!standards) {
    throw new Error(
      `Unknown species: "${species}". Supported: ${Object.keys(GUIDE_STANDARDS).join(', ')}`
    );
  }

  if (weightGrams <= 0) {
    throw new Error('Weight must be a positive number');
  }

  // Step 1: Find Guide baseline for this weight
  const guideBaseline = lookupGuideStandard(standards, weightGrams);

  // Step 2: Determine effective max
  let maxCount = guideBaseline;
  let source: DensityResult['source'] = 'guide_baseline';
  let reason = `Guide Table: ${weightGrams}g ${species} → max ${guideBaseline} per cage`;

  // Step 3: Protocol override (only if it LOWERS the density)
  if (input.protocolApprovedDensity != null && input.protocolApprovedDensity > 0) {
    if (input.protocolApprovedDensity < guideBaseline) {
      maxCount = input.protocolApprovedDensity;
      source = 'protocol_override';
      reason = `IACUC protocol density override: max ${maxCount} per protocol approval`;
    }
    // Protocol override CANNOT exceed Guide baseline — this is a hard lock
  }

  // Step 4: Post-surgery override
  if (input.isPostSurgery) {
    maxCount = Math.min(maxCount, POST_SURGERY_MAX);
    if (POST_SURGERY_MAX < guideBaseline) {
      source = 'post_surgery_limit';
      reason = 'Post-surgery recovery: max 1 animal per cage (unless protocol approves group housing)';
    }
  }

  const projectedCount = currentCount + addingCount;

  return {
    allowed: projectedCount <= maxCount,
    maxCount,
    projectedCount,
    source,
    guideBaseline,
    reason,
  };
}

/**
 * Look up the Guide standard for a given weight.
 * Finds the first tier where weight < maxWeight (or the last tier if no upper bound).
 */
function lookupGuideStandard(standards: DensityStandard[], weightGrams: number): number {
  for (const tier of standards) {
    if (tier.maxWeight === null || weightGrams <= tier.maxWeight) {
      return tier.maxPerCage;
    }
  }
  // Fallback: use the last tier (shouldn't happen if standards are well-defined)
  return standards[standards.length - 1].maxPerCage;
}

/**
 * Calculate the Guide baseline density for a species and weight.
 * Does NOT consider protocol overrides or post-surgery.
 * Useful for UI display and reporting.
 */
export function getGuideBaseline(species: string, weightGrams: number): number {
  const standards = GUIDE_STANDARDS[species.toLowerCase()];
  if (!standards) {
    throw new Error(`Unknown species: "${species}"`);
  }
  return lookupGuideStandard(standards, weightGrams);
}

/**
 * Check if a species is supported by the density calculator.
 */
export function isSpeciesSupported(species: string): boolean {
  return species.toLowerCase() in GUIDE_STANDARDS;
}

/**
 * Get all supported species.
 */
export function getSupportedSpecies(): string[] {
  return Object.keys(GUIDE_STANDARDS);
}
