import type { RequestHandler } from '@sveltejs/kit';

const mem = new Map<string, { ts: number; payload: any }>();
const TTL = 1000 * 60 * 60; // 1 hour

export const GET: RequestHandler = async ({ url }) => {
	const year = Number(url.searchParams.get('year') ?? 2022);
	const state = url.searchParams.get('state') ?? ''; // '06' or '' for all
	const varName = url.searchParams.get('var') ?? 'B05002_013E';
	const key = `${year}:${state}:${varName}`;

	const cached = mem.get(key);
	if (cached && Date.now() - cached.ts < TTL) {
		return new Response(JSON.stringify(cached.payload), {
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }
		});
	}

	const base = `https://api.census.gov/data/${year}/acs/acs5`;
	const where = state ? `&for=county:*&in=state:${state}` : `&for=county:*`;
	const urlACS = `${base}?get=NAME,${varName}&${where}`;
	const res = await fetch(urlACS);
	if (!res.ok) return new Response('ACS error', { status: 502 });
	const rows: any[][] = await res.json();
	const [header, ...data] = rows;

	// Return a compact array of objects { fips, name, value }
	const idxName = header.indexOf('NAME');
	const idxVar = header.indexOf(varName);
	const idxS = header.indexOf('state');
	const idxC = header.indexOf('county');

	const shaped = data.map((r) => ({
		fips: String(r[idxS]) + String(r[idxC]),
		name: r[idxName],
		value: Number(r[idxVar] ?? 0)
	}));

	mem.set(key, { ts: Date.now(), payload: shaped });

	return new Response(JSON.stringify(shaped), {
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }
	});
};
