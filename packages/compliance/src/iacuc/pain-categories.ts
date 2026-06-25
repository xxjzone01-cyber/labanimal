/**
 * USDA Pain Category Classification
 *
 * Categories per USDA Animal Welfare Act (9 CFR §2.31):
 * - B: Animals bred for research, not used in experiments
 * - C: Animals used in experiments with no pain/distress
 * - D: Animals used in experiments with pain/distress, alleviated by analgesics/anesthetics
 * - E: Animals used in experiments with unalleviated pain/distress (requires justification)
 */

export type USDACategory = 'B' | 'C' | 'D' | 'E';

export interface PainCategoryResult {
  /** USDA category letter */
  category: USDACategory;
  /** Human-readable description */
  description: string;
  /** Whether IACUC justification is required */
  requiresJustification: boolean;
  /** Whether veterinary oversight is required */
  requiresVetOversight: boolean;
  /** Compliance warnings */
  warnings: string[];
}

const CATEGORY_INFO: Record<
  USDACategory,
  { description: string; requiresJustification: boolean; requiresVetOversight: boolean }
> = {
  B: {
    description: 'Animals bred for research but not yet used in experimental procedures',
    requiresJustification: false,
    requiresVetOversight: false,
  },
  C: {
    description: 'Animals used in research, teaching, or testing with no pain or distress',
    requiresJustification: false,
    requiresVetOversight: false,
  },
  D: {
    description:
      'Animals used in research with pain or distress, alleviated by appropriate anesthetics, analgesics, or tranquilizers',
    requiresJustification: false,
    requiresVetOversight: true,
  },
  E: {
    description:
      'Animals used in research with unalleviated pain or distress (requires protocol justification)',
    requiresJustification: true,
    requiresVetOversight: true,
  },
};

/**
 * Determine the USDA pain category for a procedure.
 *
 * @param params - Procedure parameters
 * @returns PainCategoryResult with classification and compliance info
 */
export function classifyPainCategory(params: {
  /** Is the animal used in experimental procedures? */
  usedInProcedure: boolean;
  /** Does the procedure cause pain or distress? */
  causesPain: boolean;
  /** Is pain/distress alleviated with analgesics/anesthetics? */
  painAlleviated: boolean;
}): PainCategoryResult {
  const { usedInProcedure, causesPain, painAlleviated } = params;

  let category: USDACategory;

  if (!usedInProcedure) {
    category = 'B';
  } else if (!causesPain) {
    category = 'C';
  } else if (painAlleviated) {
    category = 'D';
  } else {
    category = 'E';
  }

  const info = CATEGORY_INFO[category];
  const warnings: string[] = [];

  if (category === 'E') {
    warnings.push(
      'Category E requires scientific justification in the IACUC protocol for unalleviated pain/distress',
    );
    warnings.push(
      'Must include description of procedures to minimize pain and scientific justification for why alternatives cannot be used',
    );
  }

  if (category === 'D' || category === 'E') {
    warnings.push('Veterinary oversight required for procedures involving pain or distress');
  }

  return {
    category,
    description: info.description,
    requiresJustification: info.requiresJustification,
    requiresVetOversight: info.requiresVetOversight,
    warnings,
  };
}

/**
 * Get all USDA categories with their descriptions.
 */
export function getAllCategories(): Array<{ category: USDACategory; description: string }> {
  return (Object.keys(CATEGORY_INFO) as USDACategory[]).map((cat) => ({
    category: cat,
    description: CATEGORY_INFO[cat].description,
  }));
}

/**
 * Check if a category string is a valid USDA category.
 */
export function isValidCategory(value: string): value is USDACategory {
  return ['B', 'C', 'D', 'E'].includes(value);
}
