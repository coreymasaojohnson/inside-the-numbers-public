// src/lib/data/pums.ts

export type TreemapRow = { name: string; value: number };

/**
 * Load treemap data for AANHPI subgroups
 * Uses the 2017-2021 ACS 5-year data
 */
export async function loadTreemapJSON(
  family: 'combined' | 'asian' | 'nhpi',
  yearRange = '2017_2021'
): Promise<TreemapRow[]> {
  const base = `/data/derived`;
  
  // Use the consolidated treemap file
  const file = `${base}/aanhpi_treemap_${yearRange}.json`;

  const res = await fetch(file);
  if (!res.ok) throw new Error(`Treemap JSON ${file} not found (${res.status}).`);
  
  const data = (await res.json()) as TreemapRow[];
  
  // Filter by family if needed
  if (family === 'asian') {
    return data.filter(d => !isNhpiGroup(d.name));
  } else if (family === 'nhpi') {
    return data.filter(d => isNhpiGroup(d.name));
  }
  
  return data;
}

/**
 * Helper to identify NHPI groups
 */
function isNhpiGroup(name: string): boolean {
  const lower = name.toLowerCase();
  const nhpiKeywords = [
    'hawaiian', 'samoan', 'guamanian', 'chamorro', 'tongan',
    'fijian', 'micronesian', 'polynesian', 'melanesian',
    'pacific', 'nhpi', 'marshallese', 'palauan', 'chuukese',
    'pohnpeian', 'kosraean', 'yapese'
  ];
  return nhpiKeywords.some(k => lower.includes(k));
}

/**
 * Time series data type
 */
type TimeSeriesPoint = { 
  year: number; 
  name: string; 
  value: number;
};

/**
 * Load and process AANHPI time series data for growth visualization
 * Uses non-overlapping 5-year ACS periods: 2009, 2014, 2019
 * 
 * @param opts.topN - Number of top groups to include per family (Asian/NHPI)
 * @param opts.minYear - Minimum year to include (default: 2009)
 */
export async function getAanhpiSubgroupsCombinedTimeSeries(opts: {
  topN: number;
  minYear: number;
}) {
  // Load the merged time series data (2009, 2014, 2019)
  const file = `/data/derived/aanhpi_timeseries_2009_2019.json`;
  
  const res = await fetch(file);
  if (!res.ok) {
    throw new Error(`Time series JSON ${file} not found (${res.status}). Make sure you've run the merge script.`);
  }
  
  const rawData = (await res.json()) as TimeSeriesPoint[];
  
  // Extract unique years and sort
  const allYears = [...new Set(rawData.map(d => d.year))].sort((a, b) => a - b);
  const years = allYears.filter(y => y >= opts.minYear);
  
  if (years.length === 0) {
    console.warn(`No years found >= ${opts.minYear} in time series data`);
    return { timeSeries: [], asianGroups: [], nhpiGroups: [], years: [] };
  }
  
  // Filter to relevant years
  const filteredData = rawData.filter(d => years.includes(d.year));
  
  // Separate Asian and NHPI groups
  const groupsByFamily = new Map<string, { isNhpi: boolean; totalValue: number }>();
  
  filteredData.forEach(d => {
    const isNhpi = isNhpiGroup(d.name);
    const existing = groupsByFamily.get(d.name);
    
    if (existing) {
      existing.totalValue += d.value;
    } else {
      groupsByFamily.set(d.name, { isNhpi, totalValue: d.value });
    }
  });
  
  // Sort groups by total population (sum across all years) and select top N per family
  const asianEntries = Array.from(groupsByFamily.entries())
    .filter(([_, info]) => !info.isNhpi)
    .sort((a, b) => b[1].totalValue - a[1].totalValue)
    .slice(0, opts.topN)
    .map(([name]) => name);
  
  const nhpiEntries = Array.from(groupsByFamily.entries())
    .filter(([_, info]) => info.isNhpi)
    .sort((a, b) => b[1].totalValue - a[1].totalValue)
    .slice(0, opts.topN)
    .map(([name]) => name);
  
  // Create sets for efficient filtering
  const keepNames = new Set<string>([...asianEntries, ...nhpiEntries]);
  
  // Filter time series to only include top N groups
  const timeSeries = filteredData.filter(d => keepNames.has(d.name));
  
  console.log('Time series loaded:', {
    file,
    years,
    totalPoints: timeSeries.length,
    asianGroups: asianEntries.length,
    nhpiGroups: nhpiEntries.length
  });
  
  return {
    timeSeries,
    asianGroups: asianEntries,
    nhpiGroups: nhpiEntries,
    years
  };
}

/**
 * Legacy function name for backwards compatibility
 * @deprecated Use getAanhpiSubgroupsCombinedTimeSeries instead
 */
export const getAanhpiSubgroupsTimeSeries = getAanhpiSubgroupsCombinedTimeSeries;