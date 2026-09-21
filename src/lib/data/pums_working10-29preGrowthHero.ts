// src/lib/data/pums.ts
export type TreemapRow = { name: string; value: number };

export async function loadTreemapJSON(
  family: 'combined'|'asian'|'nhpi',
  year = 2022
): Promise<TreemapRow[]> {
  const base = `/data/pums`;
  const file =
    family === 'asian'
      ? `${base}/treemap-asian-foreignborn-${year}.json`
      : family === 'nhpi'
      ? `${base}/treemap-nhpi-foreignborn-${year}.json`
      : `${base}/treemap-aanhpi-foreignborn-${year}.json`;

  const res = await fetch(file);
  if (!res.ok) throw new Error(`Treemap JSON ${file} not found (${res.status}).`);
  return (await res.json()) as TreemapRow[];
}

type GrowthJSON = {
  years: number[];
  asianGroups: string[];
  nhpiGroups: string[];
  timeSeries: Array<{ year: number; name: string; value: number }>;
};

// Signature kept to match your GrowthHero expectations.
export async function getAanhpiSubgroupsCombinedTimeSeries(opts: {
  topN: number;
  minYear: number;
}) {
  const file = `/data/pums/growth-aanhpi-foreignborn-2011-2023.json`;
  const res = await fetch(file);
  if (!res.ok) throw new Error(`Growth JSON ${file} not found (${res.status}).`);
  const raw = (await res.json()) as GrowthJSON;

  // Restrict years
  const years = raw.years.filter(y => y >= opts.minYear).sort((a,b)=>a-b);

  // Keep the incoming groups (already curated from your IPUMS processing)
  const asianGroups = raw.asianGroups.slice(0);
  const nhpiGroups  = raw.nhpiGroups.slice(0);

  // Optionally trim to TOP_N per family for rendering/legend sanity.
  const keepAsian = new Set(asianGroups.slice(0, opts.topN));
  const keepNhpi  = new Set(nhpiGroups.slice(0, opts.topN));
  const keepNames = new Set<string>([...keepAsian, ...keepNhpi]);

  const timeSeries = raw.timeSeries
    .filter(d => years.includes(d.year) && keepNames.has(d.name));

  return { timeSeries, asianGroups: [...keepAsian], nhpiGroups: [...keepNhpi], years };
}
