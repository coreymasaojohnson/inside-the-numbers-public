// src/lib/data/acs-subgroups.ts
import {
	ASIAN_CANONICAL_RULES,
	ASIAN_COMPUTED_OTHER,
	NHPI_CANONICAL_RULES,
	NHPI_COMPUTED_OTHER,
	ACS_SUBGROUPS_CONFIG,
	type CanonicalRule,
} from './subgroup_rules';

export type TreemapRow = { name: string; value: number };
export type AcsType = 'acs1' | 'acs5';

// ── Real fetcher with API key (Vite: static access only) ──────────────────
// Vite will replace this at build time. It’s fine in SSR and client builds.
const CENSUS_API_KEY: string | undefined = import.meta.env.VITE_CENSUS_KEY;

async function getJSON<T>(url: string): Promise<T> {
	// append the key ONLY for Census API calls and only if not already present
	const needsKey = /^https:\/\/api\.census\.gov\/data\//.test(url) && !/[?&]key=/.test(url);
	const final =
		needsKey && CENSUS_API_KEY
			? `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(CENSUS_API_KEY)}`
			: url;

	let res: Response;
	try {
		res = await fetch(final);
	} catch (e) {
		throw new Error(`ACS fetch failed: ${String(e)}`);
	}

	const text = await res.text();
	if (!res.ok) throw new Error(`ACS ${res.status}: ${text.slice(0, 200) || '(no body)'}`);

	try {
		return JSON.parse(text) as T;
	} catch (e) {
		throw new Error(`ACS JSON parse error: ${String(e)} :: ${text.slice(0, 160)}`);
	}
}

// ── Utilities ─────────────────────────────────────────────────────────────
function acsBase(year: number, acsType: AcsType = 'acs5') {
	return `https://api.census.gov/data/${year}/acs/${acsType}`;
}

async function getJSONRetry<T>(url: string, tries = 3, delayMs = 300): Promise<T> {
	let lastErr: any;
	for (let i = 0; i < tries; i++) {
		try {
			return await getJSON<T>(url);
		} catch (e: any) {
			lastErr = e;
			if (!/ACS\s5\d\d:/.test(String(e))) break; // only retry 5xx
			await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
		}
	}
	throw lastErr;
}

function cleanLabel(label: string): string {
	const core = label.replace(/^Estimate!!/i, '').replace(/^Total Groups Tallied:!!/i, '');
	const parts = core
		.split('!!')
		.map((s) => s.trim())
		.filter(Boolean);
	return (parts[parts.length - 1] || core).trim();
}

// ── Metadata + Crosswalk ──────────────────────────────────────────────────
type GroupMeta = { variables: Record<string, { label: string; concept: string }> };

async function fetchGroupMeta(year: number, groupId: string, acsType: AcsType): Promise<GroupMeta> {
	return getJSONRetry<GroupMeta>(`${acsBase(year, acsType)}/groups/${groupId}.json`);
}

type VariableMeta = { code: string; label: string };

function discoverEstimateVars(meta: GroupMeta): VariableMeta[] {
	if (!meta || !meta.variables) return [];
	return Object.entries(meta.variables)
		.filter(([code]) => code.endsWith('_E') && !/_001E$/.test(code))
		.map(([code, v]) => ({ code, label: cleanLabel(v.label) }));
}

type CrosswalkEntry = { canonical: string; codes: string[]; excludeFromOther?: boolean };
type BuiltCrosswalk = { entries: CrosswalkEntry[]; totalCode: string };

function buildCrosswalkForYear(
	year: number,
	groupId: string,
	meta: GroupMeta,
	rules: CanonicalRule[],
	computedOtherLabel: string
): BuiltCrosswalk {
	const vars = discoverEstimateVars(meta);
	const entries: CrosswalkEntry[] = [];
	const usedCodes = new Set<string>();

	// 1) explicit rules
	for (const r of rules) {
		const matched = vars
			.filter((v) => r.tests.some((rx) => rx.test(v.label)))
			.map((v) => v.code)
			.filter((code) => !usedCodes.has(code));

		matched.forEach((c) => usedCodes.add(c));
		entries.push({ canonical: r.canonical, codes: matched, excludeFromOther: r.excludeFromOther });
	}

	// 2) total (_001E)
	const totalCode = Object.keys(meta.variables || {}).find((k) => /_001E$/.test(k));
	if (!totalCode) throw new Error(`No _001E total found for ${groupId} ${year}`);

	// 3) computed Other placeholder
	entries.push({ canonical: computedOtherLabel, codes: [], excludeFromOther: true });

	return { entries, totalCode };
}

// ── Data fetch + shaping ──────────────────────────────────────────────────
async function fetchUSValues(
	year: number,
	codes: string[],
	acsType: AcsType
): Promise<Record<string, number>> {
	const base = acsBase(year, acsType);
	const out: Record<string, number> = {};
	const BATCH = 40;

	for (let i = 0; i < codes.length; i += BATCH) {
		const slice = codes.slice(i, i + BATCH);
		const url = `${base}?get=${slice.join(',')}&for=us:1`;
		const rows = await getJSONRetry<any[]>(url);
		const header = rows[0],
			data = rows[1];
		const idx = Object.fromEntries(header.map((h: string, j: number) => [h, j]));
		for (const c of slice) out[c] = +data[idx[c]] || 0;
	}
	return out;
}

async function getSubgroupsCrosswalked_US(
	year: number,
	groupId: string,
	rules: CanonicalRule[],
	computedOtherLabel: string,
	acsType: AcsType
): Promise<TreemapRow[]> {
	const meta = await fetchGroupMeta(year, groupId, acsType);
	const { entries, totalCode } = buildCrosswalkForYear(
		year,
		groupId,
		meta,
		rules,
		computedOtherLabel
	);

	const needed = new Set<string>([totalCode]);
	for (const e of entries) e.codes.forEach((c) => needed.add(c));

	const values = await fetchUSValues(year, Array.from(needed), acsType);
	const total = values[totalCode] || 0;

	const rows: TreemapRow[] = entries
		.filter((e) => e.canonical !== computedOtherLabel)
		.map((e) => ({
			name: e.canonical,
			value: e.codes.reduce((s, c) => s + (values[c] || 0), 0)
		}));

	const includedForOther = entries.filter(
		(e) => !e.excludeFromOther && e.canonical !== computedOtherLabel
	);
	const includedSum = includedForOther.reduce(
		(s, e) => s + e.codes.reduce((t, c) => t + (values[c] || 0), 0),
		0
	);
	const otherVal = Math.max(0, total - includedSum);
	rows.push({ name: computedOtherLabel, value: otherVal });

	rows.sort((a, b) => b.value - a.value);
	return rows;
}

// ── Public fetchers (Foreign-born tables) ──────────────────────────────────
export async function getAsianSubgroups_US(
	year = 2022,
	acsType: AcsType = 'acs5'
): Promise<TreemapRow[]> {
	return getSubgroupsCrosswalked_US(
		year,
		ACS_SUBGROUPS_CONFIG.asian.tableId, // B05006I
		ASIAN_CANONICAL_RULES,
		ASIAN_COMPUTED_OTHER,
		acsType
	);
}

export async function getNhpiSubgroups_US(
	year = 2022,
	acsType: AcsType = 'acs5'
): Promise<TreemapRow[]> {
	return getSubgroupsCrosswalked_US(
		year,
		ACS_SUBGROUPS_CONFIG.nhpi.tableId, // B05006K
		NHPI_CANONICAL_RULES,
		NHPI_COMPUTED_OTHER,
		acsType
	);
}

export async function getAanhpiSubgroupsCombined_US(
	year = 2022,
	acsType: AcsType = 'acs5'
): Promise<TreemapRow[]> {
	const [asian, nhpi] = await Promise.all([
		getAsianSubgroups_US(year, acsType),
		getNhpiSubgroups_US(year, acsType)
	]);
	const combined = [...asian, ...nhpi];
	combined.sort((a, b) => b.value - a.value);
	return combined;
}

// Optional: audit the crosswalk
export async function getSubgroupCrosswalk(year: number, acsType: AcsType = 'acs5') {
	const [metaA, metaN] = await Promise.all([
		fetchGroupMeta(year, ACS_SUBGROUPS_CONFIG.asian.tableId, acsType),
		fetchGroupMeta(year, ACS_SUBGROUPS_CONFIG.nhpi.tableId, acsType)
	]);

	const cwA = buildCrosswalkForYear(
		year,
		ACS_SUBGROUPS_CONFIG.asian.tableId,
		metaA,
		ASIAN_CANONICAL_RULES,
		ASIAN_COMPUTED_OTHER
	);
	const cwN = buildCrosswalkForYear(
		year,
		ACS_SUBGROUPS_CONFIG.nhpi.tableId,
		metaN,
		NHPI_CANONICAL_RULES,
		NHPI_COMPUTED_OTHER
	);

	return {
		year,
		asian: cwA.entries.map((e) => ({
			canonical: e.canonical,
			codes: e.codes,
			excludeFromOther: e.excludeFromOther
		})),
		nhpi: cwN.entries.map((e) => ({
			canonical: e.canonical,
			codes: e.codes,
			excludeFromOther: e.excludeFromOther
		}))
	};
}
