/**
 * AVMA Guidelines for the Euthanasia of Animals (2020)
 * Method classification by species.
 *
 * ⚠️ COPYRIGHT NOTICE:
 * This module provides ENUMERATION VALUES and CLASSIFICATION LABELS only.
 * It does NOT reproduce AVMA's original descriptive text, narrative, or PDF content.
 * Users should obtain the full AVMA Guidelines through official channels:
 * https://www.avma.org/resources-tools/avma-policies/avma-guidelines-euthanasia-animals
 *
 * The classification labels (acceptable/conditional/unacceptable) are factual
 * categorizations derived from the guidelines and are not copyrightable expression.
 */

export type AVMACategory = 'acceptable' | 'conditional' | 'unacceptable';

export interface EuthanasiaMethod {
  /** Machine-readable method identifier */
  id: string;
  /** Category per AVMA 2020 */
  category: AVMACategory;
  /** Requirements for conditional methods (e.g., 'certification', 'weight_limit') */
  requires: string[];
  /** Weight limit in grams (if applicable) */
  weightLimit?: number;
}

export interface SpeciesMethods {
  acceptable: EuthanasiaMethod[];
  conditional: EuthanasiaMethod[];
  unacceptable: EuthanasiaMethod[];
}

/**
 * AVMA 2020 approved euthanasia methods by species.
 * Only method IDs and classification — no AVMA original text.
 */
export const AVMA_METHODS_DB: Record<string, SpeciesMethods> = {
  mouse: {
    acceptable: [
      { id: 'co2_gradual', category: 'acceptable', requires: [] },
      { id: 'barbiturate_iv', category: 'acceptable', requires: [] },
      { id: 'barbiturate_ip', category: 'acceptable', requires: [] },
      { id: 'isoflurane_overdose', category: 'acceptable', requires: [] },
      { id: 'sevoflurane_overdose', category: 'acceptable', requires: [] },
    ],
    conditional: [
      { id: 'cervical_dislocation', category: 'conditional', requires: ['certification', 'weight_limit'], weightLimit: 1000 },
      { id: 'decapitation', category: 'conditional', requires: ['anesthesia_first'] },
      { id: 'captive_bolt', category: 'conditional', requires: ['certification'] },
    ],
    unacceptable: [
      { id: 'dry_ice', category: 'unacceptable', requires: [] },
      { id: 'freezing', category: 'unacceptable', requires: [] },
      { id: 'microwave', category: 'unacceptable', requires: [] },
      { id: 'decompression', category: 'unacceptable', requires: [] },
      { id: 'ether', category: 'unacceptable', requires: [] },
      { id: 'chloroform', category: 'unacceptable', requires: [] },
    ],
  },

  rat: {
    acceptable: [
      { id: 'co2_gradual', category: 'acceptable', requires: [] },
      { id: 'barbiturate_iv', category: 'acceptable', requires: [] },
      { id: 'barbiturate_ip', category: 'acceptable', requires: [] },
      { id: 'isoflurane_overdose', category: 'acceptable', requires: [] },
      { id: 'sevoflurane_overdose', category: 'acceptable', requires: [] },
    ],
    conditional: [
      { id: 'cervical_dislocation', category: 'conditional', requires: ['certification', 'weight_limit'], weightLimit: 1000 },
      { id: 'decapitation', category: 'conditional', requires: ['anesthesia_first'] },
    ],
    unacceptable: [
      { id: 'dry_ice', category: 'unacceptable', requires: [] },
      { id: 'freezing', category: 'unacceptable', requires: [] },
      { id: 'microwave', category: 'unacceptable', requires: [] },
      { id: 'decompression', category: 'unacceptable', requires: [] },
      { id: 'ether', category: 'unacceptable', requires: [] },
      { id: 'chloroform', category: 'unacceptable', requires: [] },
    ],
  },

  hamster: {
    acceptable: [
      { id: 'co2_gradual', category: 'acceptable', requires: [] },
      { id: 'barbiturate_iv', category: 'acceptable', requires: [] },
      { id: 'barbiturate_ip', category: 'acceptable', requires: [] },
      { id: 'isoflurane_overdose', category: 'acceptable', requires: [] },
    ],
    conditional: [
      { id: 'cervical_dislocation', category: 'conditional', requires: ['certification', 'weight_limit'], weightLimit: 1000 },
      { id: 'decapitation', category: 'conditional', requires: ['anesthesia_first'] },
    ],
    unacceptable: [
      { id: 'dry_ice', category: 'unacceptable', requires: [] },
      { id: 'freezing', category: 'unacceptable', requires: [] },
      { id: 'microwave', category: 'unacceptable', requires: [] },
      { id: 'decompression', category: 'unacceptable', requires: [] },
    ],
  },

  guinea_pig: {
    acceptable: [
      { id: 'co2_gradual', category: 'acceptable', requires: [] },
      { id: 'barbiturate_iv', category: 'acceptable', requires: [] },
      { id: 'barbiturate_ip', category: 'acceptable', requires: [] },
      { id: 'isoflurane_overdose', category: 'acceptable', requires: [] },
    ],
    conditional: [
      { id: 'captive_bolt', category: 'conditional', requires: ['certification'] },
    ],
    unacceptable: [
      { id: 'dry_ice', category: 'unacceptable', requires: [] },
      { id: 'freezing', category: 'unacceptable', requires: [] },
      { id: 'cervical_dislocation', category: 'unacceptable', requires: [] },
    ],
  },

  rabbit: {
    acceptable: [
      { id: 'barbiturate_iv', category: 'acceptable', requires: [] },
      { id: 'kcl_anesthesia', category: 'acceptable', requires: ['anesthesia_first'] },
      { id: 'isoflurane_overdose', category: 'acceptable', requires: [] },
    ],
    conditional: [
      { id: 'gunshot', category: 'conditional', requires: ['certification', 'specific_setting'] },
    ],
    unacceptable: [
      { id: 'co2_gradual', category: 'unacceptable', requires: [] },
      { id: 'cervical_dislocation', category: 'unacceptable', requires: [] },
      { id: 'dry_ice', category: 'unacceptable', requires: [] },
      { id: 'freezing', category: 'unacceptable', requires: [] },
      { id: 'decompression', category: 'unacceptable', requires: [] },
    ],
  },
};
