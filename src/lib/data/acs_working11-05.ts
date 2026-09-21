// src/lib/data/acs.ts
// 💡 UPDATED: Includes full implementation for time series subgroup composition, including a combined AANHPI series.

import * as d3 from 'd3';

export type CountyFips = string; // "06037"
export type CountyName = string; // "Los Angeles County, California"

// --- TREEMAP TYPES ---
export type TreemapRow = { name: string; value: number };

// --- TIME SERIES TYPES (FOR CompositionHero.svelte) ---
export type SubgroupRow = { name: string; value: number };
export type SubgroupSeriesRow = {
  year: number;
  groups: SubgroupRow[];
};

export type CombinedTimeSeriesResult = {
  timeSeries: Array<{ year: number; name: string; value: number }>;
  asianGroups: string[];
  nhpiGroups: string[];
  years: number[];
};

export type AanhpiTotalsRow = {
  year: number;
  asian: number;
  nhpi: number;
  aanhpi: number; // Sum of Asian + NHPI
};

// --- CONFIGURATION ---
const ACS_BASE = 'https://api.census.gov/data/2022/acs/acs5';
// API Key (Replace with your actual key or environment variable access)
const CENSUS_API_KEY = '87ae1264f86ef2f7ff8ef894ccf9ee06f25835e4';

const GET_CHUNK_SIZE = 45;
const ONE_DAY = 24 * 60 * 60 * 1000;
// 💡 FIX: Change the start year from 2010 to 2011 (length will now be 12).
// The 2010 ACS data for these detailed race tables is highly unstable or unavailable via the API.
const DEFAULT_GROWTH_YEARS = Array.from({ length: 12 }, (_, i) => 2011 + i); // <-- MODIFIED
// This now covers 2011 through 2022 (assuming current year is 2023 or later).

// Variables for total population (B02018/B02019) in any combination (used in Totals time series)
const ASIAN_TOTAL_VAR = 'B02018_001E'; 
const NHPI_TOTAL_VAR = 'B02019_001E'; 

// --- CACHING & HELPERS ---

type GroupMeta = {
  name: string;
  variables: Record<
    string,
    {
      label: string; 
      concept: string;
      predicateType?: string;
    }
  >;
};

// In-memory caches
const CACHE = new Map<string, any>(); // General cache for Time Series and other
const TREEMAP_MEMO = new Map<'B02018' | 'B02019' | 'B02018_B02019_AANHPI', TreemapRow[]>();
const MEMO = new Map<string, any>(); // For county/state foreign born data
const MEMO_STATE = new Map<string, any>(); 
const METADATA_CACHE = new Map<number, Record<string, string>>(); // Year -> { code: label }

const TREEMAP_COMBINED_KEY = 'B02018_B02019_AANHPI';

function chunk<T>(arr: T[], size = GET_CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Fetch JSON with a friendlier error */
async function getJSON<T>(url: string): Promise<T> {
  const separator = url.includes('?') ? '&' : '?';
  const finalUrl = `${url}${separator}key=${CENSUS_API_KEY}`;
  
  // console.log('Fetching Census URL:', finalUrl); // Uncomment for debugging
  
  let res: Response;
  try {
    // Using native fetch, which is more robust than relying on an external library like jQuery ($)
    res = await fetch(finalUrl); 
  } catch (e) {
    throw new Error(`ACS fetch failed: ${String(e)}`);
  }
  let text = '';
  try {
    text = await res.text();
  } catch {
    // noop
  }
  if (!res.ok) {
    // Include the error body from the Census API in the error message
    const errorBody = text?.slice(0, 200) || '(no body)';
    throw new Error(`ACS ${res.status}: ${errorBody}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`ACS JSON parse error: ${String(e)} ${text?.slice(0, 120)}`);
  }
}

/** Standardizes labels from Census format. */
function friendlyGroupLabel(label: string): string {
  const core = label.replace(/^Estimate!!Total Groups Tallied:!!/i, '');
  const parts = core.split('!!').map(s => s.trim()).filter(Boolean);
  let last = parts[parts.length - 1] || core;
  
  if (last.toLowerCase().includes(', except')) {
    last = last.replace(/,\s*except\s+/i, ' (except ') + ')';
  }
  
  return last;
}

/** Generates the known sequential variable codes for the treemap tables (B02018/B02019). */
function generateRaceSubgroupVariables(
  tableId: 'B02018' | 'B02019',
  totalSubgroups: number,
): string[] {
  const codes: string[] = [];
  // Start at 2 (B0201X_002E) to skip the table total (_001E)
  for (let i = 2; i <= totalSubgroups; i++) {
    const suffix = String(i).padStart(3, '0') + 'E';
    codes.push(`${tableId}_${suffix}`);
  }
  return codes;
}

// Safe localStorage access (SSR guard)
function hasLS() {
  try { return typeof localStorage !== 'undefined'; } catch { return false; }
}

// --- END OF CACHING & HELPERS ---


/* ===================== TREEMAP CODE (B02018/B02019) ===================== */

/** Fetch all disaggregated rows for a "selected groups" table (B02018 or B02019), US total. */
async function fetchSelectedGroupTotalsAnyCombo(groupId: 'B02018' | 'B02019'): Promise<TreemapRow[]> {
  // Use the full 26/12 for the current default ACS5 (2022) for the treemap view.
  const totalSubgroups = groupId === 'B02018' ? 26 : 12; // Asian: 26, NHPI: 12
  const varCodes = generateRaceSubgroupVariables(groupId, totalSubgroups);

  let meta: GroupMeta | undefined = undefined;
  try {
    meta = await getJSON<GroupMeta>(`${ACS_BASE}/groups/${groupId}.json`);
  } catch (e) {
    console.error(`Failed to fetch metadata for ${groupId}.`, e);
  }

  const batches = chunk(varCodes, GET_CHUNK_SIZE);
  const values = new Map<string, number>();

  for (const codes of batches) {
    const url = `${ACS_BASE}?get=${codes.join(',')}&for=us:1`; 
    const rows = await getJSON<any[]>(url);

    if (!Array.isArray(rows) || rows.length < 2) continue;
    const header = rows[0];
    const data = rows[1];
    const idx = Object.fromEntries(header.map((h: string, i: number) => [h, i]));

    for (const code of codes) {
      const j = idx[code];
      const val = Number(data[j]) || 0;
      values.set(code, val);
    }
  }

  const out: TreemapRow[] = varCodes.map((code) => {
    let name = code;
    if (meta?.variables) {
      const label = meta.variables[code]?.label;
      if (label) {
        name = friendlyGroupLabel(label);
      }
    }
    return {
      name: name,
      value: values.get(code) ?? 0
    };
  });

  out.sort((a, b) => b.value - a.value);
  return out;
}

export async function getAanhpiSubgroupsCombined_US(): Promise<TreemapRow[]> {
  if (TREEMAP_MEMO.has(TREEMAP_COMBINED_KEY as any)) return TREEMAP_MEMO.get(TREEMAP_COMBINED_KEY as any)!;

  try {
    const [asianRows, nhpiRows] = await Promise.all([
      fetchSelectedGroupTotalsAnyCombo('B02018'),
      fetchSelectedGroupTotalsAnyCombo('B02019'),
    ]);
    const combined = [...asianRows, ...nhpiRows].sort((a, b) => b.value - a.value);

    if (combined.length > 0) {
      TREEMAP_MEMO.set(TREEMAP_COMBINED_KEY as any, combined);
      return combined;
    }
  } catch (e) {
    console.error('AANHPI Combined treemap fetch failed:', e);
  }
  return [];
}


export async function getAsianSubgroupsAnyCombo_US(): Promise<TreemapRow[]> {
  const table = 'B02018';
  if (TREEMAP_MEMO.has(table)) return TREEMAP_MEMO.get(table)!; 

  try {
    const rows = await fetchSelectedGroupTotalsAnyCombo(table);
    if (rows.length) {
      TREEMAP_MEMO.set(table, rows);
      return rows;
    }
    return []; 
  } catch (e) {
    console.error('B02018 fetch failed:', e);
    return []; 
  }
}

export async function getNhpiSubgroupsAnyCombo_US(): Promise<TreemapRow[]> {
  const table = 'B02019';
  if (TREEMAP_MEMO.has(table)) return TREEMAP_MEMO.get(table)!; 
  
  try {
    const rows = await fetchSelectedGroupTotalsAnyCombo(table);
    if (rows.length) {
      TREEMAP_MEMO.set(table, rows);
      return rows;
    }
  } catch (e) {
    console.error('B02019 fetch failed:', e);
  }
  return [];
}

/* ===================== COMPOSITION TIME SERIES CODE ===================== */

/**
 * Fetches data for B02018 or B02019 for a single year and transforms it to SubgroupSeriesRow[].
 * Uses ACS 1-year data.
 */
async function fetchSubgroupsForYear(
  year: number,
  tableId: 'B02018' | 'B02019',
  topN: number,
  otherLabel: string,
): Promise<SubgroupSeriesRow | null> {
  // NOTE on 2020 Data: The standard 2020 1-year ACS (acs1) dataset is often incomplete or unavailable
  // in the usual API endpoint, leading to 404 errors. We skip it for robustness.
  if (year === 2020) {
    console.warn(`Skipping composition data for ${tableId} in 2020 as 1-year data is unavailable/unreliable.`);
    return null;
  }
  
  // 💡 FIX: Use ACS 5-year (acs5) for the earliest year (2010) as the 1-year table variables are often
  // unavailable or structured differently in the earliest ACS 1-year releases.
  const dataset = (year === 2010) ? 'acs5' : 'acs1';
  const currentACSBase = `https://api.census.gov/data/${year}/acs/${dataset}`; 
  
  // 💡 CRITICAL FIX: The highest variable counts (26/12) were not stable until 2020 or later.
  // Adjusting the breakpoint avoids "unknown variable" (400) errors for 2018/2019.
  let totalSubgroups: number;

  if (year >= 2020) { // <-- CHANGED from 2018 to 2020 to stabilize older years
    // Use the highest counts for recent years (2021, 2022) where the most detail is available.
    totalSubgroups = tableId === 'B02018' ? 26 : 12;
  } else {
    // Use the lower, most stable counts for 2011 through 2019 to avoid "unknown variable" 400 errors.
    // B02018 had 17, B02019 had 8 as the most common stable counts pre-2020.
    totalSubgroups = tableId === 'B02018' ? 17 : 8;
  }

  const varCodes = generateRaceSubgroupVariables(tableId, totalSubgroups);

  if (varCodes.length === 0) return null;

  // 1. Fetch metadata (labels) for the year if not cached
  let names: Record<string, string>;
  if (METADATA_CACHE.has(year)) {
    names = METADATA_CACHE.get(year)!;
  } else {
    try {
      // Use the current year's base for metadata too
      const meta = await getJSON<GroupMeta>(`${currentACSBase}/groups/${tableId}.json`);
      names = Object.fromEntries(
        Object.entries(meta.variables)
              .filter(([code]) => varCodes.includes(code))
              .map(([code, v]) => [code, friendlyGroupLabel(v.label)])
      );
      METADATA_CACHE.set(year, names);
    } catch (e) {
      names = Object.fromEntries(varCodes.map(code => [code, code]));
    }
  }

  // 2. Fetch data (all codes in a single request, since it's US:1)
  try {
    // Only one variable request is needed because we fetch for US:1
    const url = `${currentACSBase}?get=${varCodes.join(',')}&for=us:1`;
    const rows = await getJSON<any[]>(url);

    if (!Array.isArray(rows) || rows.length < 2) return null;

    const header = rows[0];
    const dataRow = rows[1];
    const idx = Object.fromEntries(header.map((h: string, i: number) => [h, i]));

    const rawGroups: SubgroupRow[] = varCodes.map((code) => {
      // Use parseInt to handle strings, and default to 0 if parsing fails (NaN)
      const val = parseInt(dataRow[idx[code]], 10);
      return {
        name: names[code] || code,
        value: isNaN(val) ? 0 : val, // If it's NaN (due to "N" or "-"), use 0
      };
    });

    // 3. Process and group into Top N + Other
    rawGroups.sort((a, b) => b.value - a.value);
    
    const topGroups = rawGroups.slice(0, topN);
    const otherGroups = rawGroups.slice(topN);
    
    const otherValue = d3.sum(otherGroups, d => d.value);

    const finalGroups = [...topGroups];
    // Add "Other" only if there are remaining groups OR if "Other" has a value
    if (otherValue > 0 || topGroups.length < rawGroups.length) {
        finalGroups.push({ name: otherLabel, value: otherValue });
    }

    return { year, groups: finalGroups };

  } catch (e) {
    console.warn(`Skipping composition data for ${tableId} in ${year} due to error.`, e);
    return null;
  }
}

/**
 * Fetches time series data for top Asian and NHPI subgroups, combined into one array per year.
 * The resulting `groups` array for each year will list Asian subgroups first, followed by NHPI subgroups,
 * allowing for specific color/stacking order (Asian at the bottom, NHPI at the top).
 */
export async function getAanhpiSubgroupsCombinedTimeSeries(opts: {
  years?: number[];
  topN: number;
  asianOtherLabel: string;
  nhpiOtherLabel: string;
}): Promise<CombinedTimeSeriesResult> {
  const years = opts.years ?? DEFAULT_GROWTH_YEARS;
  const key = `AANHPISubgroupCombinedTS:${opts.topN}:${opts.asianOtherLabel}:${opts.nhpiOtherLabel}:${years.join('-')}`;
  
  const cached = CACHE.get(key);
  if (cached) return cached as CombinedTimeSeriesResult;

  const yearPromises = years.map(async (year) => {
    try {
      // 1. DEFINE the promises (START THE FETCHES)
      const asianPromise = fetchSubgroupsForYear(year, 'B02018', opts.topN, opts.asianOtherLabel);
      const nhpiPromise = fetchSubgroupsForYear(year, 'B02019', opts.topN, opts.nhpiOtherLabel);
      
      // 2. AWAIT the results from the promises
      const [asianResult, nhpiResult] = await Promise.all([asianPromise, nhpiPromise]);

      if (asianResult && nhpiResult) {
        // Concatenate Asian groups first (bottom stack) then NHPI groups (top stack)
        const combinedGroups: SubgroupRow[] = [
          ...asianResult.groups,
          ...nhpiResult.groups,
        ];
        return { year, groups: combinedGroups } as SubgroupSeriesRow;
      }
    } catch (e) {
      // Catch error for this specific year
      console.warn(`Skipping combined composition data for ${year} due to error.`, e);
    }
    return null; // Return null if any step failed
  });

  const results = (await Promise.all(yearPromises)).filter((r): r is SubgroupSeriesRow => r !== null);
  
  // ----------------------------------------------------
  // --- NEW LOGIC: Assemble the object for the Svelte component ---
  // ----------------------------------------------------
  if (results.length === 0) {
    return { timeSeries: [], asianGroups: [], nhpiGroups: [], years: [] };
  }

  // 1. Flatten into the TimeSeriesData array
  const timeSeries: Array<{ year: number; name: string; value: number }> = results.flatMap(r => 
    r.groups.map(g => ({ year: r.year, name: g.name, value: g.value }))
  );
  
  // 2. Separate Asian and NHPI groups using the latest year's data names.
  const latestGroups = results[results.length - 1].groups; 

  // Use the location of the NHPI 'Other' label as the split point (or the end if not found)
  const splitIndex = latestGroups.findIndex(g => g.name === opts.nhpiOtherLabel);
  
  // Refined split logic:
  const finalAsianNames = [];
  const finalNhpiNames = [];
  
  let isAsian = true;
  for (const group of latestGroups) {
      if (isAsian) {
          finalAsianNames.push(group.name);
          // If we hit the Asian Other label AND NHPI groups exist, stop adding to Asian.
          if (group.name === opts.asianOtherLabel && splitIndex > -1) {
              isAsian = false;
          }
      } else {
          finalNhpiNames.push(group.name);
      }
      // If we hit the NHPI Other label, definitely switch to NHPI
      if (group.name === opts.nhpiOtherLabel) {
           isAsian = false;
           finalNhpiNames.push(group.name); // Ensure the NHPI Other is added
           finalAsianNames.pop(); // Remove it from Asian names if it somehow got in
           break; // Stop iteration (all remaining should be NHPI if B02019 followed B02018)
      }
  }

  // Simple, robust split based on the index:
  const simplerSplitIndex = latestGroups.findIndex(g => g.name === opts.nhpiOtherLabel);
  const asianGroups = latestGroups.slice(0, simplerSplitIndex > -1 ? simplerSplitIndex : latestGroups.length).map(g => g.name);
  const nhpiGroups = latestGroups.slice(simplerSplitIndex > -1 ? simplerSplitIndex : latestGroups.length).map(g => g.name);

  // Since the original design ensured Asian groups were added first, a simple index is reliable.
  const finalResult: CombinedTimeSeriesResult = {
      timeSeries: timeSeries,
      // Use the simplest index split, as the data order is guaranteed
      asianGroups: asianGroups, 
      nhpiGroups: nhpiGroups,
      years: results.map(r => r.year),
  };
  
  if (results.length) CACHE.set(key, finalResult);
  return finalResult; // <-- RETURN THE OBJECT
}
/**
 * EXPORT: Fetches time series data for top Asian subgroups (for CompositionHero.svelte).
 */
export async function getAsianSubgroupsTimeSeries(opts: {
  years?: number[];
  topN: number;
  otherLabel: string;
}): Promise<SubgroupSeriesRow[]> {
  const years = opts.years ?? DEFAULT_GROWTH_YEARS;
  const key = `AsianSubgroupTS:${opts.topN}:${years.join('-')}`;
  
  const cached = CACHE.get(key);
  if (cached) return cached as SubgroupSeriesRow[];

  const promises = years.map(year => fetchSubgroupsForYear(year, 'B02018', opts.topN, opts.otherLabel));
  const results = (await Promise.all(promises)).filter((r): r is SubgroupSeriesRow => r !== null);
  
  if (results.length) CACHE.set(key, results);
  return results;
}

/**
 * EXPORT: Fetches time series data for top NHPI subgroups (for CompositionHero.svelte).
 */
export async function getNhpiSubgroupsTimeSeries(opts: {
  years?: number[];
  topN: number;
  otherLabel: string;
}): Promise<SubgroupSeriesRow[]> {
  const years = opts.years ?? DEFAULT_GROWTH_YEARS;
  const key = `NhpiSubgroupTS:${opts.topN}:${years.join('-')}`;
  
  const cached = CACHE.get(key);
  if (cached) return cached as SubgroupSeriesRow[];

  const promises = years.map(year => fetchSubgroupsForYear(year, 'B02019', opts.topN, opts.otherLabel));
  const results = (await Promise.all(promises)).filter((r): r is SubgroupSeriesRow => r !== null);
  
  if (results.length) CACHE.set(key, results);
  return results;
}
/* ===================== OTHER EXPORTS (Foreign Born / Totals) ===================== */

// 💡 Foreign-born variables for defensive fallback (still needed for foreign-born map view)
const FALLBACK_FOREIGN_VARS: Record<'C05003D' | 'C05003E', string[]> = {
  C05003D: ['C05003D_004E', 'C05003D_007E'], // Asian: Male foreign-born, Female foreign-born
  C05003E: ['C05003E_004E', 'C05003E_007E'], // NHPI:  Male foreign-born, Female foreign-born
};

export type AanhpiForeignBornResult = {
  byFips: Map<CountyFips, number>; 
  breakdown: Map<CountyFips, { asian: number; nhpi: number }>;
  names: Map<CountyFips, CountyName>;
  denomForeignBorn?: Map<CountyFips, number>;
};

type AapiCacheEntry = {
  ts: number;
  byFips: [string, number][];
  names: [string, string][];
  denom?: [string, number][];
};

/**
 * AANHPI foreign-born by county (defensive: auto-discovers the needed variable codes).
 */
export async function fetchAanhpiForeignBornByCountyDefensive(options?: {
  stateFips?: string;         
  withDenominator?: boolean;  
}): Promise<AanhpiForeignBornResult> {
  const { stateFips, withDenominator = true } = options ?? {};
  const asianVars = ['B05003D_005E', 'B05003D_010E', 'B05003D_016E', 'B05003D_021E'];
  const nhpiVars  = ['B05003E_005E', 'B05003E_010E', 'B05003E_016E', 'B05003E_021E'];

  const cols = ['NAME', ...asianVars, ...nhpiVars];
  if (withDenominator) cols.push('B05002_013E'); // total foreign-born (all races)

  const geo = stateFips ? `for=county:*&in=state:${stateFips}` : 'for=county:*';
  const url = `${ACS_BASE}?get=${cols.join(',')}&${geo}`;

  const rows: any[] = await getJSON<any[]>(url);
  const [header, ...data] = rows;
  const idx: Record<string, number> = Object.fromEntries(header.map((h: string, i: number) => [h, i]));

  const byFips = new Map<CountyFips, number>();
  const breakdown = new Map<CountyFips, { asian: number; nhpi: number }>();
  const names = new Map<CountyFips, CountyName>();
  const denomForeignBorn = withDenominator ? new Map<CountyFips, number>() : undefined;

  for (const r of data) {
    const fips = String(r[idx['state']]) + String(r[idx['county']]);
    names.set(fips, String(r[idx['NAME']]));
    const asian = asianVars.reduce((sum, code) => sum + (+r[idx[code]] || 0), 0);
    const nhpi  = nhpiVars .reduce((sum, code) => sum + (+r[idx[code]] || 0), 0);
    const total = asian + nhpi;
    breakdown.set(fips, { asian, nhpi });
    byFips.set(fips, total);
    if (withDenominator && denomForeignBorn) {
      denomForeignBorn.set(fips, +r[idx['B05002_013E']] || 0);
    }
  }
  return { byFips, breakdown, names, denomForeignBorn };
}

export function computeSharePercent(
  numerator: Map<CountyFips, number>,
  denominator: Map<CountyFips, number>,
  fips: CountyFips,
): number | undefined {
  const n = numerator.get(fips);
  const d = denominator.get(fips);
  if (n == null || d == null || d === 0) return undefined;
  return (n / d) * 100;
}

function cacheKey(stateFips?: string, withDenominator?: boolean) {
  return `aanhpiFB:2022:${stateFips ?? 'US'}:${withDenominator ? 'den' : 'noden'}`;
}

function loadFromLocalStorage(key: string): AapiCacheEntry | undefined {
  if (!hasLS()) return;
  const raw = localStorage.getItem(`acs:${key}`);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as AapiCacheEntry;
    if (Date.now() - parsed.ts > ONE_DAY) return; // expired
    return parsed;
  } catch {
    return;
  }
}

function saveToLocalStorage(key: string, entry: AapiCacheEntry) {
  if (!hasLS()) return;
  localStorage.setItem(`acs:${key}`, JSON.stringify(entry));
}

export function clearAapiCache() {
  MEMO.clear();
  if (hasLS()) {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('acs:aanhpiFB:2022:')) localStorage.removeItem(k);
    });
  }
}

export async function getAanhpiForeignBornCached(options?: {
  stateFips?: string;
  withDenominator?: boolean;
}): Promise<{
  byFips: Map<string, number>;
  names: Map<string, string>;
  denomForeignBorn?: Map<string, number>;
}> {
  const { stateFips, withDenominator = true } = options ?? {};
  const key = cacheKey(stateFips, withDenominator);

  // 1) Memory Check
  const mem = MEMO.get(key);
  if (mem && Date.now() - mem.ts <= ONE_DAY) {
    return {
      byFips: new Map(mem.byFips),
      names: new Map(mem.names),
      denomForeignBorn: mem.denom ? new Map(mem.denom) : undefined,
    };
  }

  // 2) LocalStorage Check
  const ls = loadFromLocalStorage(key);
  if (ls) {
    MEMO.set(key, ls);
    return {
      byFips: new Map(ls.byFips),
      names: new Map(ls.names),
      denomForeignBorn: ls.denom ? new Map(ls.denom) : undefined,
    };
  }

  // 3) Fetch + cache
  const { byFips, names, denomForeignBorn } =
    await fetchAanhpiForeignBornByCountyDefensive({ stateFips, withDenominator });

  const entry: AapiCacheEntry = {
    ts: Date.now(),
    byFips: Array.from(byFips.entries()),
    names: Array.from(names.entries()),
    denom: denomForeignBorn ? Array.from(denomForeignBorn.entries()) : undefined,
  };
  MEMO.set(key, entry);
  saveToLocalStorage(key, entry);

  return { byFips, names, denomForeignBorn };
}

export async function fetchAanhpiForeignBornByState(options?: {
  withDenominator?: boolean;
}) {
  const withDenominator = options?.withDenominator ?? true;

  const asianVars = ['B05003D_005E', 'B05003D_010E', 'B05003D_016E', 'B05003D_021E'];
  const nhpiVars  = ['B05003E_005E', 'B05003E_010E', 'B05003E_016E', 'B05003E_021E'];

  const cols = ['NAME', ...asianVars, ...nhpiVars];
  if (withDenominator) cols.push('B05002_013E');

  const url = `${ACS_BASE}?get=${cols.join(',')}&for=state:*`;

  const rows: any[] = await getJSON<any[]>(url);
  const [header, ...data] = rows;
  const idx = Object.fromEntries(header.map((h: string, i: number) => [h, i]));

  const byState = new Map<string, number>();           
  const names   = new Map<string, string>();
  const denom   = withDenominator ? new Map<string, number>() : undefined;

  for (const r of data) {
    const st = String(r[idx['state']]).padStart(2, '0');
    names.set(st, String(r[idx['NAME']]));
    const asian = asianVars.reduce((s, c) => s + (+r[idx[c]] || 0), 0);
    const nhpi  = nhpiVars .reduce((s, c) => s + (+r[idx[c]] || 0), 0);
    byState.set(st, asian + nhpi);
    if (denom) denom.set(st, +r[idx['B05002_013E']] || 0);
  }

  return { byState, names, denomForeignBorn: denom };
}


export async function getAanhpiForeignBornByStateCached(withDenominator = true) {
  const key = `aanhpiFB:2022:STATE:${withDenominator ? 'den' : 'noden'}`;

  const mem = MEMO_STATE.get(key);
  if (mem && Date.now() - mem.ts <= ONE_DAY) {
    return {
      byState: new Map(mem.byFips),
      names:   new Map(mem.names),
      denomForeignBorn: mem.denom ? new Map(mem.denom) : undefined
    };
  }
  
  const ls = (typeof localStorage !== 'undefined') ? localStorage.getItem(`acs:${key}`) : null;
  if (ls) {
    const parsed = JSON.parse(ls) as AapiCacheEntry;
    if (Date.now() - parsed.ts <= ONE_DAY) {
      MEMO_STATE.set(key, parsed);
      return {
        byState: new Map(parsed.byFips),
        names:   new Map(parsed.names),
        denomForeignBorn: parsed.denom ? new Map(parsed.denom) : undefined
      };
    }
  }

  const { byState, names, denomForeignBorn } = await fetchAanhpiForeignBornByState({ withDenominator });
  const entry: AapiCacheEntry = {
    ts: Date.now(),
    byFips: Array.from(byState.entries()),
    names:  Array.from(names.entries()),
    denom:  denomForeignBorn ? Array.from(denomForeignBorn.entries()) : undefined
  };
  MEMO_STATE.set(key, entry);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(`acs:${key}`, JSON.stringify(entry));
  }
  return { byState, names, denomForeignBorn };
}

/**
 * Fetches total Asian and NHPI populations for the US across a time series.
 * Uses ACS 1-year data by default.
 */
export async function getAanhpiTotals_US_TimeSeries(opts?: {
  years?: number[];
  dataset?: 'acs1' | 'acs5'; // Use acs1 for national totals
}): Promise<AanhpiTotalsRow[]> {
  const years = opts?.years ?? DEFAULT_GROWTH_YEARS;
  const dataset = opts?.dataset ?? 'acs1';
  const cacheKey = `AANHPI_TOTALS_TS_${dataset}_${years.join('-')}`; 

  const cached = CACHE.get(cacheKey);
  if (cached) return cached as AanhpiTotalsRow[];

  const variables = [ASIAN_TOTAL_VAR, NHPI_TOTAL_VAR].join(',');

  const yearPromises = years.map(async (year) => {
    try {
      // NOTE: We still skip 2020 1-year data here for robustness, as it's often missing (404).
      if (dataset === 'acs1' && year === 2020) {
        console.warn(`Skipping year ${year} (${dataset}) due to known missing data.`);
        return null;
      }
      
      const currentACSBase = `https://api.census.gov/data/${year}/acs/${dataset}`;
      const url = `${currentACSBase}?get=${variables}&for=us:1`;
      const data = await getJSON<any[]>(url);

      if (data && data.length > 1) {
        const header = data[0];
        const row = data[1];
        
        const asianIdx = header.indexOf(ASIAN_TOTAL_VAR);
        const nhpiIdx = header.indexOf(NHPI_TOTAL_VAR);

        const asianCount = parseInt(row[asianIdx] ?? '0');
        const nhpiCount = parseInt(row[nhpiIdx] ?? '0');

        return {
          year,
          asian: asianCount,
          nhpi: nhpiCount,
          aanhpi: asianCount + nhpiCount,
        } as AanhpiTotalsRow;
      }
    } catch (e) {
      console.warn(`Skipping year ${year} (${dataset}) due to fetch error.`, e);
    }
    return null;
  });

  const allResults = await Promise.all(yearPromises);
  const finalResults = allResults.filter((r): r is AanhpiTotalsRow => r !== null);

  if (finalResults.length > 0) {
    CACHE.set(cacheKey, finalResults);
  }

  return finalResults;
}
