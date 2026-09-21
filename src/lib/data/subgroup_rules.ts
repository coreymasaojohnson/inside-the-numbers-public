/**
 * src/lib/data/subgroup_rules.ts
 * Defines the canonical list of AAPI subgroups and the rules (RegExp) 
 * used to dynamically map Census API variable labels to these groups for any given year.
 * Updated to target the Foreign-born population tables B05006I and B05006K.
 */

// --- TYPES ---

export type AcsFamilyKey = 'asian' | 'nhpi';

export type AcsSubgroupConfig = {
  tableId: string;
  totalVar: string;
  title: string;
  subgroupsRule: CanonicalRule[];
};

export type CanonicalRule = {
  canonical: string;
  /** One or more label tests; a variable matches if ANY regex matches its label. */
  tests: RegExp[];
  /** * Optional: if true, exclude this group from the pool when computing the 
   * catch-all “Other Asian/NHPI” category. Used for explicit catch-all Census lines
   * like "Other East Asian" to prevent double-counting.
   */
  excludeFromOther?: boolean;
};

// --- ASIAN (B05006I) RULES ---

// Labels typically look like: "Estimate!!Total Groups Tallied:!!Chinese, except Taiwanese"
export const ASIAN_CANONICAL_RULES: CanonicalRule[] = [
  // East Asian
  { canonical: 'Chinese (except Taiwanese)', tests: [/^Chinese,?\s*except\s*Taiwanese/i] },
  { canonical: 'Taiwanese',                  tests: [/^Taiwanese$/i] },
  { canonical: 'Korean',                     tests: [/^Korean$/i] },
  { canonical: 'Japanese',                   tests: [/^Japanese$/i] },

  // South Asian
  { canonical: 'Indian',                     tests: [/^Asian\s*Indian$/i] },
  { canonical: 'Pakistani',                  tests: [/^Pakistani$/i] },
  { canonical: 'Bangladeshi',                tests: [/^Bangladeshi$/i] },
  { canonical: 'Nepalese',                   tests: [/^Nepalese$/i] },
  { canonical: 'Sri Lankan',                 tests: [/^Sri\s*Lankan$/i] },
  { canonical: 'Bhutanese',                  tests: [/^Bhutanese$/i] },

  // Southeast Asian
  { canonical: 'Vietnamese',                 tests: [/^Vietnamese$/i] },
  { canonical: 'Filipino',                   tests: [/^Filipino$/i] },
  { canonical: 'Thai',                       tests: [/^Thai$/i] },
  { canonical: 'Indonesian',                 tests: [/^Indonesian$/i] },
  { canonical: 'Malaysian',                  tests: [/^Malaysian$/i] },
  { canonical: 'Burmese',                    tests: [/^Burmese$/i] },
  { canonical: 'Cambodian',                  tests: [/^Cambodian$/i] },
  { canonical: 'Hmong',                      tests: [/^Hmong$/i] },
  { canonical: 'Laotian',                    tests: [/^Laotian$/i] },

  // Explicit Other / Regional Catch-Alls (Must be excluded from computed 'Other Asian')
  { canonical: 'Other East Asian',           tests: [/^Other\s+East\s+Asian$/i], excludeFromOther: true },
  { canonical: 'Other South Asian',          tests: [/^Other\s+South\s+Asian$/i], excludeFromOther: true },
  { canonical: 'Other Southeast Asian',      tests: [/^Other\s+Southeast\s+Asian$/i], excludeFromOther: true },
  { canonical: 'Central Asian',              tests: [/^Central\s+Asian$/i], excludeFromOther: true },
  
  // Minor or less common groups sometimes present
  { canonical: 'Mongolian',                  tests: [/^Mongolian$/i] },
  { canonical: 'Okinawan',                   tests: [/^Okinawan$/i] },
];

/** Computed later as: totalAsianAny − sum(all included that are NOT excludeFromOther) */
export const ASIAN_COMPUTED_OTHER = 'Other Asian';

// --- NHPI (B05006K) RULES ---

export const NHPI_CANONICAL_RULES: CanonicalRule[] = [
  // Polynesian
  { canonical: 'Native Hawaiian',            tests: [/^Native\s+Hawaiian$/i] },
  { canonical: 'Samoan',                     tests: [/^Samoan$/i] },
  { canonical: 'Tongan',                     tests: [/^Tongan$/i] },
  { canonical: 'Other Polynesian',           tests: [/^Other\s+Polynesian$/i], excludeFromOther: true },
  
  // Micronesian
  { canonical: 'Guamanian or Chamorro',      tests: [/^Guamanian\s+or\s+Chamorro$/i] },
  { canonical: 'Marshallese',                tests: [/^Marshallese$/i] },
  { canonical: 'Palauan',                    tests: [/^Palauan$/i] },
  { canonical: 'Micronesian (Other)',        tests: [/^Micronesian.*Other/i], excludeFromOther: true },
  
  // Melanesian
  { canonical: 'Fijian',                     tests: [/^Fijian$/i] },
  { canonical: 'Melanesian (Other)',         tests: [/^Melanesian.*Other/i], excludeFromOther: true },
];

export const NHPI_COMPUTED_OTHER = 'Other NHPI';

// --- CONFIGURATION: Foreign-born Tables (Defined last to use the Rule arrays) ---

/**
 * CRITICAL UPDATE:
 * Switch from Total Population (B02018/B02019) to Foreign-born Population (B05006I/B05006K)
 */
export const ACS_SUBGROUPS_CONFIG: Record<AcsFamilyKey, AcsSubgroupConfig> = {
  // Asian Alone or In Any Combination, Foreign Born
  asian: {
    tableId: 'B05006I', // Updated Census Table ID for Foreign-born Asian
    totalVar: '_001E',  // B05006I_001E is the standard total variable for this table
    title: 'Asian Foreign-Born Population',
    subgroupsRule: ASIAN_CANONICAL_RULES,
  },
  // Native Hawaiian and Other Pacific Islander Alone or In Any Combination, Foreign Born
  nhpi: {
    tableId: 'B05006K', // Updated Census Table ID for Foreign-born NHPI
    totalVar: '_001E',  // B05006K_001E is the standard total variable for this table
    title: 'NHPI Foreign-Born Population',
    subgroupsRule: NHPI_CANONICAL_RULES,
  },
};
