/**
 * 3Rs Principle Validation (Russell & Burch, 1959)
 *
 * - Replacement: Use non-animal alternatives when possible
 * - Reduction: Minimize the number of animals used
 * - Refinement: Minimize pain, suffering, and distress
 *
 * Reference: ILAR Guide for the Care and Use of Laboratory Animals (8th ed., 2011)
 */

export interface ThreeRsInput {
  /** Number of animals requested for the study */
  requestedAnimalCount: number;
  /** Statistical justification for sample size (has power analysis or similar) */
  hasStatisticalJustification: boolean;
  /** Whether non-animal alternatives were considered */
  alternativesConsidered: boolean;
  /** Description of why alternatives are not feasible (required if alternatives considered = false) */
  alternativesExplanation?: string;
  /** Pain/distress category (B/C/D/E) */
  painCategory: 'B' | 'C' | 'D' | 'E';
  /** Whether analgesics/anesthetics are used */
  usesAnalgesics: boolean;
  /** Whether humane endpoints are defined */
  hasHumaneEndpoints: boolean;
  /** Whether personnel are trained in the procedures */
  personnelTrained: boolean;
}

export interface ThreeRsResult {
  /** Overall 3R compliance */
  compliant: boolean;
  /** Individual 3R assessments */
  replacement: { met: boolean; issues: string[] };
  reduction: { met: boolean; issues: string[] };
  refinement: { met: boolean; issues: string[] };
  /** All issues combined */
  allIssues: string[];
}

/**
 * Validate a protocol against the 3Rs principles.
 */
export function validateThreeRs(input: ThreeRsInput): ThreeRsResult {
  const replacement = checkReplacement(input);
  const reduction = checkReduction(input);
  const refinement = checkRefinement(input);

  const allIssues = [...replacement.issues, ...reduction.issues, ...refinement.issues];

  return {
    compliant: allIssues.length === 0,
    replacement,
    reduction,
    refinement,
    allIssues,
  };
}

function checkReplacement(input: ThreeRsInput): { met: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!input.alternativesConsidered) {
    issues.push(
      'Replacement: Non-animal alternatives must be considered and documented. Describe literature search for alternatives.',
    );
  }

  return { met: issues.length === 0, issues };
}

function checkReduction(input: ThreeRsInput): { met: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!input.hasStatisticalJustification) {
    issues.push(
      'Reduction: Animal numbers must be justified with statistical analysis (power analysis, sample size calculation).',
    );
  }

  if (input.requestedAnimalCount <= 0) {
    issues.push('Reduction: Requested animal count must be a positive number.');
  }

  return { met: issues.length === 0, issues };
}

function checkRefinement(input: ThreeRsInput): { met: boolean; issues: string[] } {
  const issues: string[] = [];

  if ((input.painCategory === 'D' || input.painCategory === 'E') && !input.usesAnalgesics) {
    issues.push(
      'Refinement: Procedures causing pain (Category D/E) must use appropriate analgesics or anesthetics.',
    );
  }

  if (!input.hasHumaneEndpoints) {
    issues.push(
      'Refinement: Humane endpoints must be defined to minimize suffering. Define criteria for early termination.',
    );
  }

  if (!input.personnelTrained) {
    issues.push('Refinement: All personnel performing procedures must be trained and competent.');
  }

  return { met: issues.length === 0, issues };
}
