import { describe, it, expect } from 'vitest';
import {
  calculateMaxDensity,
  getGuideBaseline,
  isSpeciesSupported,
  getSupportedSpecies,
} from '../src/density/calculator.js';

describe('calculateMaxDensity', () => {
  // ========== Mouse ==========
  describe('mouse', () => {
    it('allows small mice (<=10g) up to 11 per cage', () => {
      const result = calculateMaxDensity({
        species: 'mouse',
        weightGrams: 8,
        currentCount: 5,
        addingCount: 1,
      });
      expect(result.allowed).toBe(true);
      expect(result.maxCount).toBe(11);
      expect(result.guideBaseline).toBe(11);
      expect(result.source).toBe('guide_baseline');
    });

    it('blocks when adding would exceed limit', () => {
      const result = calculateMaxDensity({
        species: 'mouse',
        weightGrams: 8,
        currentCount: 11,
        addingCount: 1,
      });
      expect(result.allowed).toBe(false);
      expect(result.projectedCount).toBe(12);
    });

    it('uses correct tier for 20g mice (max 5)', () => {
      const result = calculateMaxDensity({
        species: 'mouse',
        weightGrams: 20,
        currentCount: 4,
        addingCount: 1,
      });
      expect(result.allowed).toBe(true);
      expect(result.maxCount).toBe(5);
    });

    it('uses correct tier for 25g mice (max 4)', () => {
      const result = calculateMaxDensity({
        species: 'mouse',
        weightGrams: 25,
        currentCount: 4,
        addingCount: 1,
      });
      expect(result.allowed).toBe(false);
      expect(result.maxCount).toBe(4);
    });

    it('uses last tier for very large mice (>30g, max 2)', () => {
      const result = calculateMaxDensity({
        species: 'mouse',
        weightGrams: 50,
        currentCount: 2,
        addingCount: 1,
      });
      expect(result.allowed).toBe(false);
      expect(result.maxCount).toBe(2);
    });
  });

  // ========== Rat ==========
  describe('rat', () => {
    it('allows small rats (<=100g) up to 8 per cage', () => {
      const result = calculateMaxDensity({
        species: 'rat',
        weightGrams: 80,
        currentCount: 7,
        addingCount: 1,
      });
      expect(result.allowed).toBe(true);
      expect(result.maxCount).toBe(8);
    });

    it('uses correct tier for 250g rats (max 4)', () => {
      const result = calculateMaxDensity({
        species: 'rat',
        weightGrams: 250,
        currentCount: 4,
        addingCount: 1,
      });
      expect(result.allowed).toBe(false);
      expect(result.maxCount).toBe(4);
    });

    it('large rats (>500g) are singly housed', () => {
      const result = calculateMaxDensity({
        species: 'rat',
        weightGrams: 600,
        currentCount: 0,
        addingCount: 1,
      });
      expect(result.allowed).toBe(true);
      expect(result.maxCount).toBe(1);
    });
  });

  // ========== Hamster ==========
  describe('hamster', () => {
    it('allows small hamsters (<=60g) up to 11 per cage', () => {
      const result = calculateMaxDensity({
        species: 'hamster',
        weightGrams: 50,
        currentCount: 10,
        addingCount: 1,
      });
      expect(result.allowed).toBe(true);
      expect(result.maxCount).toBe(11);
    });

    it('uses correct tier for 70g hamsters (max 8)', () => {
      const result = calculateMaxDensity({
        species: 'hamster',
        weightGrams: 70,
        currentCount: 8,
        addingCount: 1,
      });
      expect(result.allowed).toBe(false);
      expect(result.maxCount).toBe(8);
    });
  });

  // ========== Guinea Pig ==========
  describe('guinea_pig', () => {
    it('allows small guinea pigs (<=350g) up to 9 per cage', () => {
      const result = calculateMaxDensity({
        species: 'guinea_pig',
        weightGrams: 300,
        currentCount: 8,
        addingCount: 1,
      });
      expect(result.allowed).toBe(true);
      expect(result.maxCount).toBe(9);
    });

    it('large guinea pigs (>350g) max 5 per cage', () => {
      const result = calculateMaxDensity({
        species: 'guinea_pig',
        weightGrams: 500,
        currentCount: 5,
        addingCount: 1,
      });
      expect(result.allowed).toBe(false);
      expect(result.maxCount).toBe(5);
    });
  });

  // ========== Rabbit ==========
  describe('rabbit', () => {
    it('allows small rabbits (<=2000g) up to 3 per cage', () => {
      const result = calculateMaxDensity({
        species: 'rabbit',
        weightGrams: 1500,
        currentCount: 2,
        addingCount: 1,
      });
      expect(result.allowed).toBe(true);
      expect(result.maxCount).toBe(3);
    });

    it('uses correct tier for 2500g rabbits (max 2)', () => {
      const result = calculateMaxDensity({
        species: 'rabbit',
        weightGrams: 2500,
        currentCount: 2,
        addingCount: 1,
      });
      expect(result.allowed).toBe(false);
      expect(result.maxCount).toBe(2);
    });

    it('large rabbits (>5000g) are singly housed', () => {
      const result = calculateMaxDensity({
        species: 'rabbit',
        weightGrams: 6000,
        currentCount: 0,
        addingCount: 1,
      });
      expect(result.allowed).toBe(true);
      expect(result.maxCount).toBe(1);
    });
  });

  // ========== Protocol Override ==========
  describe('protocol override', () => {
    it('uses protocol override when it LOWERS density', () => {
      const result = calculateMaxDensity({
        species: 'mouse',
        weightGrams: 20, // guide baseline = 5
        currentCount: 2,
        addingCount: 1,
        protocolApprovedDensity: 3,
      });
      expect(result.allowed).toBe(true);
      expect(result.maxCount).toBe(3);
      expect(result.source).toBe('protocol_override');
    });

    it('protocol override CANNOT exceed guide baseline', () => {
      const result = calculateMaxDensity({
        species: 'mouse',
        weightGrams: 20, // guide baseline = 5
        currentCount: 6,
        addingCount: 1,
        protocolApprovedDensity: 10, // trying to exceed guide
      });
      expect(result.allowed).toBe(false);
      expect(result.maxCount).toBe(5); // capped at guide baseline
      expect(result.source).toBe('guide_baseline');
    });

    it('ignores protocol override of 0 or null', () => {
      const result0 = calculateMaxDensity({
        species: 'mouse',
        weightGrams: 20,
        currentCount: 4,
        addingCount: 1,
        protocolApprovedDensity: 0,
      });
      expect(result0.maxCount).toBe(5);

      const resultNull = calculateMaxDensity({
        species: 'mouse',
        weightGrams: 20,
        currentCount: 4,
        addingCount: 1,
        protocolApprovedDensity: null,
      });
      expect(resultNull.maxCount).toBe(5);
    });
  });

  // ========== Post-Surgery ==========
  describe('post-surgery', () => {
    it('caps at 1 animal per cage for post-surgery', () => {
      const result = calculateMaxDensity({
        species: 'mouse',
        weightGrams: 20, // guide baseline = 5
        currentCount: 0,
        addingCount: 1,
        isPostSurgery: true,
      });
      expect(result.allowed).toBe(true);
      expect(result.maxCount).toBe(1);
      expect(result.source).toBe('post_surgery_limit');
    });

    it('blocks adding to post-surgery cage with existing animal', () => {
      const result = calculateMaxDensity({
        species: 'mouse',
        weightGrams: 20,
        currentCount: 1,
        addingCount: 1,
        isPostSurgery: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.maxCount).toBe(1);
    });

    it('post-surgery with singly-housed species stays at 1', () => {
      const result = calculateMaxDensity({
        species: 'rat',
        weightGrams: 600, // guide baseline = 1
        currentCount: 0,
        addingCount: 1,
        isPostSurgery: true,
      });
      expect(result.allowed).toBe(true);
      expect(result.maxCount).toBe(1);
      // source stays guide_baseline since post-surgery limit (1) == guide baseline (1)
      expect(result.source).toBe('guide_baseline');
    });
  });

  // ========== Edge Cases ==========
  describe('edge cases', () => {
    it('defaults addingCount to 1', () => {
      const result = calculateMaxDensity({
        species: 'mouse',
        weightGrams: 10,
        currentCount: 10,
      });
      expect(result.projectedCount).toBe(11);
    });

    it('throws for unknown species', () => {
      expect(() =>
        calculateMaxDensity({
          species: 'cat',
          weightGrams: 100,
          currentCount: 0,
          addingCount: 1,
        })
      ).toThrow('Unknown species: "cat"');
    });

    it('throws for non-positive weight', () => {
      expect(() =>
        calculateMaxDensity({
          species: 'mouse',
          weightGrams: 0,
          currentCount: 0,
          addingCount: 1,
        })
      ).toThrow('Weight must be a positive number');

      expect(() =>
        calculateMaxDensity({
          species: 'mouse',
          weightGrams: -5,
          currentCount: 0,
          addingCount: 1,
        })
      ).toThrow('Weight must be a positive number');
    });

    it('is case-insensitive for species', () => {
      const result = calculateMaxDensity({
        species: 'Mouse',
        weightGrams: 10,
        currentCount: 0,
        addingCount: 1,
      });
      expect(result.maxCount).toBe(11);
    });

    it('weight exactly at boundary uses that tier', () => {
      // maxWeight: 10 → weight 10 should be in first tier
      const result = calculateMaxDensity({
        species: 'mouse',
        weightGrams: 10,
        currentCount: 0,
        addingCount: 1,
      });
      expect(result.maxCount).toBe(11);
    });

    it('weight just above boundary uses next tier', () => {
      // maxWeight: 10 → weight 11 should be in second tier (max 8)
      const result = calculateMaxDensity({
        species: 'mouse',
        weightGrams: 11,
        currentCount: 0,
        addingCount: 1,
      });
      expect(result.maxCount).toBe(8);
    });
  });
});

describe('getGuideBaseline', () => {
  it('returns correct baseline for mouse 15g', () => {
    expect(getGuideBaseline('mouse', 15)).toBe(8);
  });

  it('returns correct baseline for rat 350g', () => {
    expect(getGuideBaseline('rat', 350)).toBe(3);
  });

  it('throws for unknown species', () => {
    expect(() => getGuideBaseline('cat', 100)).toThrow('Unknown species: "cat"');
  });
});

describe('isSpeciesSupported', () => {
  it('returns true for supported species', () => {
    expect(isSpeciesSupported('mouse')).toBe(true);
    expect(isSpeciesSupported('rat')).toBe(true);
    expect(isSpeciesSupported('hamster')).toBe(true);
    expect(isSpeciesSupported('guinea_pig')).toBe(true);
    expect(isSpeciesSupported('rabbit')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isSpeciesSupported('Mouse')).toBe(true);
    expect(isSpeciesSupported('RABBIT')).toBe(true);
  });

  it('returns false for unsupported species', () => {
    expect(isSpeciesSupported('cat')).toBe(false);
    expect(isSpeciesSupported('dog')).toBe(false);
  });
});

describe('getSupportedSpecies', () => {
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
