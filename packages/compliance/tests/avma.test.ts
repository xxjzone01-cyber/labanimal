import { describe, it, expect } from 'vitest';
import {
  validateMethod,
  getMethodsForSpecies,
  getSupportedSpecies,
  isSpeciesSupported,
} from '../src/avma/validator.js';

describe('validateMethod', () => {
  // ========== Acceptable Methods ==========
  describe('acceptable methods', () => {
    it('allows CO2 for mouse', () => {
      const result = validateMethod({
        species: 'mouse',
        methodId: 'co2_gradual',
      });
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('acceptable');
      expect(result.violations).toHaveLength(0);
      expect(result.suggestedMethods).toHaveLength(0);
    });

    it('allows barbiturate IV for rat', () => {
      const result = validateMethod({
        species: 'rat',
        methodId: 'barbiturate_iv',
      });
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('acceptable');
    });

    it('allows isoflurane overdose for hamster', () => {
      const result = validateMethod({
        species: 'hamster',
        methodId: 'isoflurane_overdose',
      });
      expect(result.allowed).toBe(true);
    });

    it('allows barbiturate IV for rabbit', () => {
      const result = validateMethod({
        species: 'rabbit',
        methodId: 'barbiturate_iv',
      });
      expect(result.allowed).toBe(true);
    });
  });

  // ========== Unacceptable Methods ==========
  describe('unacceptable methods', () => {
    it('blocks dry ice for mouse', () => {
      const result = validateMethod({
        species: 'mouse',
        methodId: 'dry_ice',
      });
      expect(result.allowed).toBe(false);
      expect(result.category).toBe('unacceptable');
      expect(result.violations).toHaveLength(1);
      expect(result.suggestedMethods.length).toBeGreaterThan(0);
    });

    it('blocks freezing for rat', () => {
      const result = validateMethod({
        species: 'rat',
        methodId: 'freezing',
      });
      expect(result.allowed).toBe(false);
      expect(result.category).toBe('unacceptable');
    });

    it('blocks microwave for mouse', () => {
      const result = validateMethod({
        species: 'mouse',
        methodId: 'microwave',
      });
      expect(result.allowed).toBe(false);
    });

    it('blocks CO2 for rabbit (unacceptable for rabbits)', () => {
      const result = validateMethod({
        species: 'rabbit',
        methodId: 'co2_gradual',
      });
      expect(result.allowed).toBe(false);
      expect(result.category).toBe('unacceptable');
    });

    it('suggests acceptable alternatives when blocking', () => {
      const result = validateMethod({
        species: 'mouse',
        methodId: 'dry_ice',
      });
      expect(result.suggestedMethods).toContain('co2_gradual');
      expect(result.suggestedMethods).toContain('barbiturate_iv');
    });
  });

  // ========== Conditional Methods ==========
  describe('conditional methods', () => {
    it('blocks cervical dislocation without certification', () => {
      const result = validateMethod({
        species: 'mouse',
        methodId: 'cervical_dislocation',
        weightGrams: 500,
        performerCertified: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.category).toBe('conditional');
      expect(result.violations.some((v) => v.includes('certification'))).toBe(true);
    });

    it('blocks cervical dislocation when overweight', () => {
      const result = validateMethod({
        species: 'mouse',
        methodId: 'cervical_dislocation',
        weightGrams: 1500,
        performerCertified: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes('1000g'))).toBe(true);
    });

    it('allows cervical dislocation when certified and within weight', () => {
      const result = validateMethod({
        species: 'mouse',
        methodId: 'cervical_dislocation',
        weightGrams: 500,
        performerCertified: true,
      });
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('blocks decapitation without anesthesia', () => {
      const result = validateMethod({
        species: 'mouse',
        methodId: 'decapitation',
        anesthesiaAdministered: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes('anesthesia'))).toBe(true);
    });

    it('allows decapitation with anesthesia', () => {
      const result = validateMethod({
        species: 'mouse',
        methodId: 'decapitation',
        anesthesiaAdministered: true,
      });
      expect(result.allowed).toBe(true);
    });

    it('blocks captive bolt without certification (guinea pig)', () => {
      const result = validateMethod({
        species: 'guinea_pig',
        methodId: 'captive_bolt',
        performerCertified: false,
      });
      expect(result.allowed).toBe(false);
    });

    it('allows captive bolt with certification (guinea pig)', () => {
      const result = validateMethod({
        species: 'guinea_pig',
        methodId: 'captive_bolt',
        performerCertified: true,
      });
      expect(result.allowed).toBe(true);
    });

    it('flags specific_setting for gunshot (rabbit)', () => {
      const result = validateMethod({
        species: 'rabbit',
        methodId: 'gunshot',
        performerCertified: true,
      });
      // specific_setting always generates a violation (informational flag)
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes('IACUC'))).toBe(true);
    });

    it('cervical dislocation is unacceptable for guinea pig', () => {
      const result = validateMethod({
        species: 'guinea_pig',
        methodId: 'cervical_dislocation',
      });
      expect(result.allowed).toBe(false);
      expect(result.category).toBe('unacceptable');
    });

    it('cervical dislocation is unacceptable for rabbit', () => {
      const result = validateMethod({
        species: 'rabbit',
        methodId: 'cervical_dislocation',
      });
      expect(result.allowed).toBe(false);
      expect(result.category).toBe('unacceptable');
    });
  });

  // ========== Unknown Method ==========
  describe('unknown method', () => {
    it('returns unknown category for unrecognized method', () => {
      const result = validateMethod({
        species: 'mouse',
        methodId: 'nonexistent_method',
      });
      expect(result.allowed).toBe(false);
      expect(result.category).toBe('unknown');
      expect(result.violations[0]).toContain('Unknown euthanasia method');
      expect(result.suggestedMethods.length).toBeGreaterThan(0);
    });
  });

  // ========== Unknown Species ==========
  describe('unknown species', () => {
    it('throws for unknown species', () => {
      expect(() =>
        validateMethod({
          species: 'cat',
          methodId: 'co2_gradual',
        })
      ).toThrow('Unknown species: "cat"');
    });
  });

  // ========== Case Insensitivity ==========
  describe('case insensitivity', () => {
    it('handles uppercase species', () => {
      const result = validateMethod({
        species: 'Mouse',
        methodId: 'co2_gradual',
      });
      expect(result.allowed).toBe(true);
    });
  });

  // ========== Multiple Violations ==========
  describe('multiple violations', () => {
    it('reports all violations for conditional method', () => {
      const result = validateMethod({
        species: 'mouse',
        methodId: 'cervical_dislocation',
        weightGrams: 1500,
        performerCertified: false,
      });
      // Should have both certification and weight violations
      expect(result.violations.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('getMethodsForSpecies', () => {
  it('returns methods grouped by category for mouse', () => {
    const methods = getMethodsForSpecies('mouse');
    expect(methods.acceptable.length).toBeGreaterThan(0);
    expect(methods.conditional.length).toBeGreaterThan(0);
    expect(methods.unacceptable.length).toBeGreaterThan(0);
  });

  it('throws for unknown species', () => {
    expect(() => getMethodsForSpecies('cat')).toThrow('Unknown species: "cat"');
  });

  it('is case-insensitive', () => {
    const methods = getMethodsForSpecies('Mouse');
    expect(methods.acceptable.length).toBeGreaterThan(0);
  });
});

describe('getSupportedSpecies (AVMA)', () => {
  it('returns all 5 species', () => {
    const species = getSupportedSpecies();
    expect(species).toHaveLength(5);
    expect(species).toContain('mouse');
    expect(species).toContain('rat');
    expect(species).toContain('hamster');
    expect(species).toContain('guinea_pig');
    expect(species).toContain('rabbit');
  });
});

describe('isSpeciesSupported (AVMA)', () => {
  it('returns true for supported species', () => {
    expect(isSpeciesSupported('mouse')).toBe(true);
    expect(isSpeciesSupported('rabbit')).toBe(true);
  });

  it('returns false for unsupported species', () => {
    expect(isSpeciesSupported('cat')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isSpeciesSupported('Mouse')).toBe(true);
  });
});
