/**
 * Guide for the Care and Use of Laboratory Animals (NRC, 2011)
 * Table 3.1-3.4: Floor Space Recommendations
 *
 * Units: weight in grams, space in square inches per animal
 * Source: Guide p.57-64
 */

export interface DensityStandard {
  /** Weight upper bound in grams (exclusive). null = no upper bound */
  maxWeight: number | null;
  /** Minimum floor space per animal in square inches */
  floorSpacePerAnimal: number;
  /** Maximum animals per standard cage (cage size: 67 sq in / 432 cm²) */
  maxPerCage: number;
}

/**
 * Guide Table 3.1: Mice
 * Standard cage: 67 sq in (432 cm²)
 */
export const MOUSE_STANDARDS: DensityStandard[] = [
  { maxWeight: 10, floorSpacePerAnimal: 6, maxPerCage: 11 },
  { maxWeight: 15, floorSpacePerAnimal: 8, maxPerCage: 8 },
  { maxWeight: 20, floorSpacePerAnimal: 12, maxPerCage: 5 },
  { maxWeight: 25, floorSpacePerAnimal: 15, maxPerCage: 4 },
  { maxWeight: 30, floorSpacePerAnimal: 18, maxPerCage: 3 },
  { maxWeight: null, floorSpacePerAnimal: 24, maxPerCage: 2 },
];

/**
 * Guide Table 3.2: Rats
 * Standard cage: 143 sq in (929 cm²)
 */
export const RAT_STANDARDS: DensityStandard[] = [
  { maxWeight: 100, floorSpacePerAnimal: 17, maxPerCage: 8 },
  { maxWeight: 200, floorSpacePerAnimal: 23, maxPerCage: 6 },
  { maxWeight: 300, floorSpacePerAnimal: 29, maxPerCage: 4 },
  { maxWeight: 400, floorSpacePerAnimal: 40, maxPerCage: 3 },
  { maxWeight: 500, floorSpacePerAnimal: 60, maxPerCage: 2 },
  { maxWeight: null, floorSpacePerAnimal: 70, maxPerCage: 1 },
];

/**
 * Guide Table 3.3: Hamsters
 * Standard cage: 143 sq in (929 cm²)
 */
export const HAMSTER_STANDARDS: DensityStandard[] = [
  { maxWeight: 60, floorSpacePerAnimal: 12, maxPerCage: 11 },
  { maxWeight: 80, floorSpacePerAnimal: 16, maxPerCage: 8 },
  { maxWeight: 100, floorSpacePerAnimal: 19, maxPerCage: 7 },
  { maxWeight: null, floorSpacePerAnimal: 25, maxPerCage: 5 },
];

/**
 * Guide Table 3.4: Guinea Pigs
 * Standard cage: 576 sq in (3,716 cm²)
 */
export const GUINEA_PIG_STANDARDS: DensityStandard[] = [
  { maxWeight: 350, floorSpacePerAnimal: 60, maxPerCage: 9 },
  { maxWeight: null, floorSpacePerAnimal: 100, maxPerCage: 5 },
];

/**
 * Guide Table 3.4: Rabbits
 * Standard cage varies by size
 */
export const RABBIT_STANDARDS: DensityStandard[] = [
  { maxWeight: 2000, floorSpacePerAnimal: 144, maxPerCage: 3 },
  { maxWeight: 3000, floorSpacePerAnimal: 180, maxPerCage: 2 },
  { maxWeight: 4000, floorSpacePerAnimal: 216, maxPerCage: 2 },
  { maxWeight: 5000, floorSpacePerAnimal: 288, maxPerCage: 1 },
  { maxWeight: null, floorSpacePerAnimal: 432, maxPerCage: 1 },
];

/** Species → standards mapping */
export const GUIDE_STANDARDS: Record<string, DensityStandard[]> = {
  mouse: MOUSE_STANDARDS,
  rat: RAT_STANDARDS,
  hamster: HAMSTER_STANDARDS,
  guinea_pig: GUINEA_PIG_STANDARDS,
  rabbit: RABBIT_STANDARDS,
};
