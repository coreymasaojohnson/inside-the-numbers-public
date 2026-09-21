// scripts/gen-font-css.mjs
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const FONTS_DIR = 'static/fonts';
const OUT_FILE = 'src/lib/styles/fonts.generated.css';

// Map common weight keywords → numeric weight
const WEIGHT_MAP = new Map([
	[/thin/i, 100],
	[/extralight|ultralight/i, 200],
	[/light/i, 300],
	[/book/i, 400], // many “Book” cuts are regular-ish
	[/regular|roman/i, 400],
	[/text/i, 450], // uncommon, but seen in some families
	[/medium/i, 500],
	[/semibold|demibold/i, 600],
	[/bold/i, 700],
	[/extrabold|ultrabold|heavy/i, 800],
	[/black|extrablack|ultrablack/i, 900]
]);

function inferWeight(name) {
	for (const [re, w] of WEIGHT_MAP) if (re.test(name)) return w;
	return 400;
}
function inferStyle(name) {
	if (/(italic|oblique)/i.test(name)) return /oblique/i.test(name) ? 'oblique 10deg' : 'italic';
	return 'normal';
}
function isVariable(name) {
	return /(variable|vf)/i.test(name);
}

// Heuristic: family = filename before first weight/style token or dash
function inferFamily(basename) {
	// Strip extension
	const base = basename.replace(/\.woff2$/i, '');
	// Split tokens by non-letters/digits
	const parts = base.split(/[^A-Za-z0-9]+/).filter(Boolean);

	// Stop at first token that looks like weight/style cue
	const stopIndex = parts.findIndex((p) =>
		/(thin|ultra|extra|light|book|regular|roman|text|medium|semi|demi|bold|heavy|black|italic|oblique|vf|variable)/i.test(
			p
		)
	);
	const famParts = stopIndex === -1 ? parts : parts.slice(0, stopIndex);
	return famParts.length ? famParts.join(' ') : base; // fallback to full base
}

function makeFace({ family, url, weight, style, variable }) {
	if (variable) {
		// sensible default range—adjust per family if you know it
		return `@font-face{
  font-family:"${family}";
  src:url("${url}") format("woff2-variations");
  font-weight: 300 900;
  font-style: ${/oblique/i.test(style) ? 'oblique 0deg 10deg' : 'normal'};
  font-display: swap;
}\n`;
	}
	return `@font-face{
  font-family:"${family}";
  src:url("${url}") format("woff2");
  font-weight:${weight};
  font-style:${style};
  font-display:swap;
}\n`;
}

const files = (await readdir(FONTS_DIR, { withFileTypes: true }))
	.filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.woff2'))
	.map((d) => d.name);

const faces = files.map((name) => {
	const family = inferFamily(name);
	const weight = inferWeight(name);
	const style = inferStyle(name);
	const variable = isVariable(name);
	const url = `/fonts/${name}`;
	return { family, url, weight, style, variable, name };
});

// Group by family and sort for tidy output
const byFamily = faces.reduce((acc, f) => {
	(acc[f.family] ||= []).push(f);
	return acc;
}, {});
for (const fam in byFamily) {
	byFamily[fam].sort((a, b) =>
		a.variable === b.variable ? a.weight - b.weight : a.variable ? -1 : 1
	);
}

let css = `/* AUTO-GENERATED. Edit the generator or post-process as needed. */
:root{
  --font-sans: "Avenir LT Std", system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans", "Helvetica Neue", Helvetica, sans-serif;
}
`;
for (const fam of Object.keys(byFamily).sort()) {
	css += `\n/* ${fam} */\n`;
	for (const f of byFamily[fam]) css += makeFace(f);
	css += `.font-${fam.replace(/\s+/g, '-').toLowerCase()}{font-family:"${fam}", var(--font-sans);}\n`;
}

await writeFile(OUT_FILE, css, 'utf8');
console.log(`Wrote ${OUT_FILE} with ${faces.length} font faces.`);
