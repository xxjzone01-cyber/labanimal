import { AVMA_METHODS_DB, type AVMACategory, type EuthanasiaMethod } from './methods.js';

export interface ValidationInput {
  /** Species identifier */
  species: string;
  /** Euthanasia method ID (e.g., 'co2_gradual', 'barbiturate_iv') */
  methodId: string;
  /** Animal weight in grams (for weight-limit checks) */
  weightGrams?: number;
  /** Whether the performer has required certifications */
  performerCertified?: boolean;
  /** Whether anesthesia was administered first (for methods requiring it) */
  anesthesiaAdministered?: boolean;
}

export interface ValidationResult {
  /** Whether the method is allowed */
  allowed: boolean;
  /** AVMA category of the method */
  category: AVMACategory | 'unknown';
  /** Specific violations found */
  violations: string[];
  /** Suggested alternative methods (acceptable ones) */
  suggestedMethods: string[];
}

/**
 * Validate a euthanasia method against AVMA 2020 guidelines.
 *
 * @throws {Error} if species is unknown
 */
export function validateMethod(input: ValidationInput): ValidationResult {
  const { species, methodId, weightGrams, performerCertified, anesthesiaAdministered } = input;

  const speciesMethods = AVMA_METHODS_DB[species.toLowerCase()];
  if (!speciesMethods) {
    throw new Error(
      `Unknown species: "${species}". Supported: ${Object.keys(AVMA_METHODS_DB).join(', ')}`
    );
  }

  // Find the method in any category
  const allMethods = [
    ...speciesMethods.acceptable,
    ...speciesMethods.conditional,
    ...speciesMethods.unacceptable,
  ];

  const method = allMethods.find((m) => m.id === methodId);

  // Method not found in any category
  if (!method) {
    return {
      allowed: false,
      category: 'unknown',
      violations: [`Unknown euthanasia method: "${methodId}" for species "${species}"`],
      suggestedMethods: speciesMethods.acceptable.map((m) => m.id),
    };
  }

  // Unacceptable — always blocked
  if (method.category === 'unacceptable') {
    return {
      allowed: false,
      category: 'unacceptable',
      violations: [`Method "${methodId}" is not acceptable for ${species} per AVMA 2020`],
      suggestedMethods: speciesMethods.acceptable.map((m) => m.id),
    };
  }

  // Acceptable — always allowed
  if (method.category === 'acceptable') {
    return {
      allowed: true,
      category: 'acceptable',
      violations: [],
      suggestedMethods: [],
    };
  }

  // Conditional — check requirements
  const violations = checkConditionalRequirements(method, {
    weightGrams,
    performerCertified,
    anesthesiaAdministered,
  });

  return {
    allowed: violations.length === 0,
    category: 'conditional',
    violations,
    suggestedMethods: violations.length > 0 ? speciesMethods.acceptable.map((m) => m.id) : [],
  };
}

/**
 * Get all methods for a species, grouped by category.
 */
export function getMethodsForSpecies(species: string) {
  const speciesMethods = AVMA_METHODS_DB[species.toLowerCase()];
  if (!speciesMethods) {
    throw new Error(`Unknown species: "${species}"`);
  }
  return speciesMethods;
}

/**
 * Get all supported species.
 */
export function getSupportedSpecies(): string[] {
  return Object.keys(AVMA_METHODS_DB);
}

/**
 * Check if a species is supported.
 */
export function isSpeciesSupported(species: string): boolean {
  return species.toLowerCase() in AVMA_METHODS_DB;
}

// --- Internal helpers ---

interface ConditionalContext {
  weightGrams?: number;
  performerCertified?: boolean;
  anesthesiaAdministered?: boolean;
}

function checkConditionalRequirements(
  method: EuthanasiaMethod,
  ctx: ConditionalContext
): string[] {
  const violations: string[] = [];

  for (const req of method.requires) {
    switch (req) {
      case 'certification':
        if (!ctx.performerCertified) {
          violations.push(
            `Method "${method.id}" requires performer certification. Upload training certificate.`
          );
        }
        break;

      case 'weight_limit':
        if (method.weightLimit != null && ctx.weightGrams != null) {
          if (ctx.weightGrams > method.weightLimit) {
            violations.push(
              `Method "${method.id}" is only approved for animals <= ${method.weightLimit}g. Current weight: ${ctx.weightGrams}g.`
            );
          }
        }
        break;

      case 'anesthesia_first':
        if (!ctx.anesthesiaAdministered) {
          violations.push(
            `Method "${method.id}" requires prior anesthesia administration.`
          );
        }
        break;

      case 'specific_setting':
        // Informational — no auto-block, but flagged
        violations.push(
          `Method "${method.id}" requires specific setting/justification. Verify with IACUC.`
        );
        break;
    }
  }

  return violations;
}
