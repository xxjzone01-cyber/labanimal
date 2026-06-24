import { describe, it, expect } from 'vitest';
import {
  classifyPainCategory,
  getAllCategories,
  isValidCategory,
  validateThreeRs,
  validateProtocol,
  isValidStatusTransition,
} from '../src/iacuc/index.js';

// ========== Pain Categories ==========

describe('classifyPainCategory', () => {
  it('classifies B when animal not used in procedure', () => {
    const result = classifyPainCategory({
      usedInProcedure: false,
      causesPain: false,
      painAlleviated: false,
    });
    expect(result.category).toBe('B');
    expect(result.requiresJustification).toBe(false);
    expect(result.requiresVetOversight).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it('classifies C when no pain involved', () => {
    const result = classifyPainCategory({
      usedInProcedure: true,
      causesPain: false,
      painAlleviated: false,
    });
    expect(result.category).toBe('C');
    expect(result.requiresJustification).toBe(false);
    expect(result.requiresVetOversight).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it('classifies D when pain is alleviated', () => {
    const result = classifyPainCategory({
      usedInProcedure: true,
      causesPain: true,
      painAlleviated: true,
    });
    expect(result.category).toBe('D');
    expect(result.requiresJustification).toBe(false);
    expect(result.requiresVetOversight).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('classifies E when pain is not alleviated', () => {
    const result = classifyPainCategory({
      usedInProcedure: true,
      causesPain: true,
      painAlleviated: false,
    });
    expect(result.category).toBe('E');
    expect(result.requiresJustification).toBe(true);
    expect(result.requiresVetOversight).toBe(true);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });
});

describe('getAllCategories', () => {
  it('returns all 4 categories', () => {
    const cats = getAllCategories();
    expect(cats).toHaveLength(4);
    expect(cats.map((c) => c.category)).toEqual(['B', 'C', 'D', 'E']);
  });
});

describe('isValidCategory', () => {
  it('returns true for valid categories', () => {
    expect(isValidCategory('B')).toBe(true);
    expect(isValidCategory('C')).toBe(true);
    expect(isValidCategory('D')).toBe(true);
    expect(isValidCategory('E')).toBe(true);
  });

  it('returns false for invalid categories', () => {
    expect(isValidCategory('A')).toBe(false);
    expect(isValidCategory('F')).toBe(false);
    expect(isValidCategory('')).toBe(false);
  });
});

// ========== Three Rs ==========

describe('validateThreeRs', () => {
  const validInput = {
    requestedAnimalCount: 20,
    hasStatisticalJustification: true,
    alternativesConsidered: true,
    painCategory: 'C' as const,
    usesAnalgesics: false,
    hasHumaneEndpoints: true,
    personnelTrained: true,
  };

  it('passes when all 3Rs are met', () => {
    const result = validateThreeRs(validInput);
    expect(result.compliant).toBe(true);
    expect(result.replacement.met).toBe(true);
    expect(result.reduction.met).toBe(true);
    expect(result.refinement.met).toBe(true);
    expect(result.allIssues).toHaveLength(0);
  });

  it('fails Replacement when alternatives not considered', () => {
    const result = validateThreeRs({
      ...validInput,
      alternativesConsidered: false,
    });
    expect(result.compliant).toBe(false);
    expect(result.replacement.met).toBe(false);
    expect(result.replacement.issues[0]).toContain('Replacement');
  });

  it('fails Reduction when no statistical justification', () => {
    const result = validateThreeRs({
      ...validInput,
      hasStatisticalJustification: false,
    });
    expect(result.compliant).toBe(false);
    expect(result.reduction.met).toBe(false);
    expect(result.reduction.issues[0]).toContain('Reduction');
  });

  it('fails Reduction when animal count is zero', () => {
    const result = validateThreeRs({
      ...validInput,
      requestedAnimalCount: 0,
    });
    expect(result.reduction.met).toBe(false);
  });

  it('fails Refinement for Category D without analgesics', () => {
    const result = validateThreeRs({
      ...validInput,
      painCategory: 'D',
      usesAnalgesics: false,
    });
    expect(result.compliant).toBe(false);
    expect(result.refinement.met).toBe(false);
    expect(result.refinement.issues.some((i) => i.includes('Refinement'))).toBe(true);
  });

  it('fails Refinement for Category E without analgesics', () => {
    const result = validateThreeRs({
      ...validInput,
      painCategory: 'E',
      usesAnalgesics: false,
    });
    expect(result.refinement.met).toBe(false);
  });

  it('passes Refinement for Category D with analgesics', () => {
    const result = validateThreeRs({
      ...validInput,
      painCategory: 'D',
      usesAnalgesics: true,
    });
    expect(result.refinement.met).toBe(true);
  });

  it('fails Refinement without humane endpoints', () => {
    const result = validateThreeRs({
      ...validInput,
      hasHumaneEndpoints: false,
    });
    expect(result.refinement.met).toBe(false);
  });

  it('fails Refinement when personnel not trained', () => {
    const result = validateThreeRs({
      ...validInput,
      personnelTrained: false,
    });
    expect(result.refinement.met).toBe(false);
  });

  it('collects all issues from all 3Rs', () => {
    const result = validateThreeRs({
      requestedAnimalCount: 0,
      hasStatisticalJustification: false,
      alternativesConsidered: false,
      painCategory: 'E',
      usesAnalgesics: false,
      hasHumaneEndpoints: false,
      personnelTrained: false,
    });
    expect(result.allIssues.length).toBeGreaterThanOrEqual(5);
  });
});

// ========== Protocol Validator ==========

describe('validateProtocol', () => {
  const validProtocol = {
    title: 'Effect of Drug X on Mouse Behavior',
    piName: 'Dr. Smith',
    status: 'draft' as const,
    species: ['mouse'],
    animalCounts: { mouse: 20 },
    alternativesConsidered: true,
    hasStatisticalJustification: true,
    painCategory: 'C' as const,
    usesAnalgesics: false,
    hasHumaneEndpoints: true,
    personnelTrained: true,
    involvesSurgery: false,
    survivalSurgery: false,
  };

  it('passes for a well-formed protocol', () => {
    const result = validateProtocol(validProtocol);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('fails when title is missing', () => {
    const result = validateProtocol({ ...validProtocol, title: '' });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('title'))).toBe(true);
  });

  it('fails when PI name is missing', () => {
    const result = validateProtocol({ ...validProtocol, piName: '' });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('Principal Investigator'))).toBe(true);
  });

  it('fails when no species specified', () => {
    const result = validateProtocol({ ...validProtocol, species: [] });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('species'))).toBe(true);
  });

  it('fails when total animal count is zero', () => {
    const result = validateProtocol({ ...validProtocol, animalCounts: { mouse: 0 } });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('animal count'))).toBe(true);
  });

  it('fails when end date is before start date', () => {
    const result = validateProtocol({
      ...validProtocol,
      startDate: '2026-12-01',
      endDate: '2026-01-01',
    });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('end date'))).toBe(true);
  });

  it('warns when protocol duration exceeds 3 years', () => {
    const result = validateProtocol({
      ...validProtocol,
      startDate: '2026-01-01',
      endDate: '2030-01-01',
    });
    expect(result.warnings.some((w) => w.includes('3 years'))).toBe(true);
  });

  it('fails Category E without alternatives justification', () => {
    const result = validateProtocol({
      ...validProtocol,
      painCategory: 'E',
      alternativesConsidered: false,
    });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('Category E'))).toBe(true);
  });

  it('fails Category E with alternatives considered but no explanation', () => {
    const result = validateProtocol({
      ...validProtocol,
      painCategory: 'E',
      alternativesConsidered: true,
      alternativesExplanation: '',
    });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('justification'))).toBe(true);
  });

  it('warns about multiple survival surgeries', () => {
    const result = validateProtocol({
      ...validProtocol,
      survivalSurgery: true,
      survivalSurgeryCount: 2,
    });
    expect(result.warnings.some((w) => w.includes('Multiple major survival'))).toBe(true);
  });

  it('rejects negative animal counts', () => {
    const result = validateProtocol({
      ...validProtocol,
      animalCounts: { mouse: -5 },
    });
    expect(result.valid).toBe(false);
  });
});

describe('isValidStatusTransition', () => {
  it('allows draft → submitted', () => {
    expect(isValidStatusTransition('draft', 'submitted')).toBe(true);
  });

  it('allows submitted → approved', () => {
    expect(isValidStatusTransition('submitted', 'approved')).toBe(true);
  });

  it('allows submitted → rejected', () => {
    expect(isValidStatusTransition('submitted', 'rejected')).toBe(true);
  });

  it('allows approved → expired', () => {
    expect(isValidStatusTransition('approved', 'expired')).toBe(true);
  });

  it('allows rejected → draft (resubmit)', () => {
    expect(isValidStatusTransition('rejected', 'draft')).toBe(true);
  });

  it('allows expired → draft (renew)', () => {
    expect(isValidStatusTransition('expired', 'draft')).toBe(true);
  });

  it('blocks draft → approved (must submit first)', () => {
    expect(isValidStatusTransition('draft', 'approved')).toBe(false);
  });

  it('blocks approved → draft', () => {
    expect(isValidStatusTransition('approved', 'draft')).toBe(false);
  });

  it('blocks expired → approved', () => {
    expect(isValidStatusTransition('expired', 'approved')).toBe(false);
  });
});
