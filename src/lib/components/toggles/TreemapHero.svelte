<script lang="ts">
	import * as d3 from 'd3';
	import { onMount, onDestroy } from 'svelte';
	import { formatNumber } from '$lib/utils';
	import { PALETTE } from '$lib/styles/palettes';

	// ── Props ────────────────────────────────────────────────────────────────
	export let showHeader: boolean = true;
	export let showLegend: boolean = true;
	export let family: 'combined' | 'asian' | 'nhpi' = 'combined';
	export let yearRange: string = '2017-2021'; // 5-year ACS range

	// ── Svelte 5 callback prop for first render completion ────────────────────
	export let onFirstRenderComplete: (() => void) | undefined = undefined;
	let firstRenderDispatched = false;

	const populationTypeLabel = 'Foreign-born';

	// ── Local state ──────────────────────────────────────────────────────────
	let data: { name: string; value: number }[] = [];
	let loading = false;
	let error: string | null = null;
	let mounted = false;
	let initialized = false; // Track first render completion for transitions
	let isRendering = false; // Prevent overlapping renders

	// ── Internals ────────────────────────────────────────────────────────────
	let container: HTMLDivElement | null = null;
	let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
	let ro: ResizeObserver | null = null;
	let roRaf = 0;

	// Color scales
	const asianColors = d3.scaleOrdinal<string, string>().range(PALETTE.plum);
	const nhpiColors = d3.scaleOrdinal<string, string>().range(PALETTE.ember);

	// derived total
	$: total = (data ?? []).reduce((s, d) => s + (d.value || 0), 0);

	// ── NHPI detection helper ───────────────────────────────────────────────
	function isNhpiGroup(name: string): boolean {
		const lower = name.toLowerCase();
		const nhpiKeywords = [
			'hawaiian',
			'samoan',
			'guamanian',
			'chamorro',
			'tongan',
			'fijian',
			'micronesian',
			'polynesian',
			'melanesian',
			'pacific',
			'nhpi',
			'marshallese',
			'palauan',
			'chuuk',
			'chuukese',
			'marshall'
		];
		return nhpiKeywords.some((k) => lower.includes(k));
	}

	// ── Color helper ─────────────────────────────────────────────────────────
	function getColor(d: { name: string; value: number }): string {
		const isNhpi = isNhpiGroup(d.name);
		if (family === 'combined') return isNhpi ? nhpiColors(d.name) : asianColors(d.name);
		return family === 'asian' ? asianColors(d.name) : nhpiColors(d.name);
	}

	// ── Data loader (fetch local IPUMS JSON) ─────────────────────────────────
	async function loadDataForFamily(which: 'combined' | 'asian' | 'nhpi', range: string) {
		loading = true;
		error = null;
		try {
			const fileName = range.replace('-', '_'); // "2017-2021" → "2017_2021"
			const res = await fetch(`/data/derived/aanhpi_treemap_${fileName}.json`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const json = await res.json();

			if (which === 'asian') {
				data = json.filter((d: any) => !isNhpiGroup(d.name));
			} else if (which === 'nhpi') {
				data = json.filter((d: any) => isNhpiGroup(d.name));
			} else {
				data = json;
			}
		} catch (e: any) {
			console.error('Treemap load failed', e);
			error = e.message;
			data = [];
		} finally {
			loading = false;
			// Draw ASAP without causing a scroll jump
			if (typeof window !== 'undefined') requestAnimationFrame(render);
			else render();
		}
	}

	// Prevent double-fetch: track last request
	let lastKey = '';
	$: {
		const key = `${family}:${yearRange}`;
		// CRITICAL FIX: Only call loadDataForFamily if 'mounted' (on the client)
		if (mounted && key !== lastKey) {
			lastKey = key;
			loadDataForFamily(family, yearRange);
		}
	}

	// ── Legend height memo (avoids flicker & layout collapse) ───────────────
	const legendCache = new Map<string, number>();
	function getLegendHeight(width: number): number {
		if (!showLegend) return 0; // Quick exit if legend is disabled
		const key = `${family}|${yearRange}|${Math.round(width)}`;
		const cached = legendCache.get(key);
		if (cached != null) return cached;

		// Use current data for measurement. If data is null/empty, measure with an empty list.
		const names = data.map((d) => d.name);

		// Legend drawing constants
		const pad = 12,
			colGap = 16,
			rowGap = 8,
			sw = 12,
			fh = 12;
		// Simple text width estimate (can be refined but usually sufficient for layout)
		const measure = (text: string) => text.length * 7;
		const maxLine = width - 2 * pad;

		let x = 0,
			y = 0;
		for (const n of names) {
			const wEstimate = sw + 6 + measure(n);
			if (x + wEstimate > maxLine && x !== 0) {
				x = 0;
				y += Math.max(sw, fh) + rowGap;
			}
			x += wEstimate + colGap;
		}
		// Calculate total height: title + rows + padding
		const h = 20 + y + Math.max(sw, fh) + 16;
		legendCache.set(key, h);
		return h;
	}

	// ── Lifecycle ────────────────────────────────────────────────────────────
	onMount(() => {
		mounted = true; // Set mounted flag here

		if (container) {
			// Using rAF debounce is better than timer debounce for ResizeObserver
			ro = new ResizeObserver(() => {
				if (roRaf) cancelAnimationFrame(roRaf);
				roRaf = requestAnimationFrame(() => {
					roRaf = 0;
					render();
				});
			});
			ro.observe(container);
		}

		// Trigger initial load here since the reactive block is now guarded by 'mounted'
		const key = `${family}:${yearRange}`;
		if (key !== lastKey) {
			lastKey = key;
			loadDataForFamily(family, yearRange);
		}
	});

	onDestroy(() => {
		ro?.disconnect();
		if (roRaf) cancelAnimationFrame(roRaf);

		// 🐛 CRITICAL FIX: Interrupt any running D3 transitions (especially the 1000ms cross-fade)
		// and force-remove all SVGs from the container immediately when the component is destroyed.
		if (container) {
			// Select all SVGs inside the container (both old and new during a cross-fade)
			d3.select(container)
				.selectAll('svg')
				.interrupt() // Stop any active D3 transitions on the elements
				.remove(); // Immediately remove them from the DOM

			svg = null; // Clear the main SVG reference
		}
		isRendering = false; // Ensure rendering lock is released
	});

	// ── Render ───────────────────────────────────────────────────────────────
	function render() {
		if (!container) return;
		if (isRendering) {
			console.log('[TreemapHero] render blocked - already rendering');
			return;
		}

		const width = container.clientWidth;

		// Don't render if container isn't visible or has no width yet
		if (!width || width < 100) {
			console.log('[TreemapHero] render skipped - container not visible:', width);
			return;
		}

		console.log('[TreemapHero] render() called - family:', family, 'width:', width);

		// Set isRendering AFTER validation checks
		isRendering = true;

		const treemapHeight = Math.max(340, Math.round(width * 0.55));
		const legendHeight = showLegend ? getLegendHeight(width) : 0;
		const totalHeight = treemapHeight + legendHeight + (showLegend ? 20 : 0);

		// Pre-allocate height to avoid container collapse
		(container as HTMLDivElement).style.minHeight = `${totalHeight}px`;

		const reduceMotion =
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

		const oldSvg = svg;
		const shouldCrossFade = initialized && !reduceMotion && oldSvg && data.length > 0;

		if (shouldCrossFade) {
			// --- Cross-Fade Transition (for internal family toggles) ---
			const labelText =
				family === 'combined'
					? `AANHPI ${populationTypeLabel} subgroup composition for ${yearRange}`
					: `${family.toUpperCase()} ${populationTypeLabel} subgroup composition for ${yearRange}`;

			const newSvg = d3
				.select(container)
				.append('svg')
				.attr('role', 'img')
				.attr('aria-label', `Treemap showing ${labelText}`)
				.style('display', 'block')
				.style('position', 'absolute')
				.style('top', '0')
				.style('left', '0')
				.style('opacity', '0')
				.attr('viewBox', `0 0 ${width} ${totalHeight}`)
				.attr('width', width)
				.attr('height', totalHeight);

			newSvg.append('g').attr('class', 'nodes');
			newSvg.append('g').attr('class', 'legend');

			drawTreemapContents(newSvg, width, treemapHeight, totalHeight);

			// Fade in new, fade out old
			newSvg
				.transition()
				.delay(60)
				.duration(1000)
				.style('opacity', '1')
				.on('end', () => {
					if (oldSvg) {
						oldSvg.remove();
					}
					newSvg.style('position', null).style('top', null).style('left', null);
					(container as HTMLDivElement).style.minHeight = '';
					isRendering = false;
				});

			if (oldSvg) {
				oldSvg.transition().delay(60).duration(1000).style('opacity', '0');
			}

			svg = newSvg;
		} else {
			// --- First render or reduced motion ---
			if (!svg) {
				const labelText =
					family === 'combined'
						? `AANHPI ${populationTypeLabel} subgroup composition for ${yearRange}`
						: `${family.toUpperCase()} ${populationTypeLabel} subgroup composition for ${yearRange}`;

				svg = d3
					.select(container)
					.append('svg')
					.attr('role', 'img')
					.attr('aria-label', `Treemap showing ${labelText}`)
					.style('display', 'block');

				svg.append('g').attr('class', 'nodes');
				svg.append('g').attr('class', 'legend');
			}

			svg
				.attr('viewBox', `0 0 ${width} ${totalHeight}`)
				.attr('width', width)
				.attr('height', totalHeight);

			svg.select('.nodes').selectAll('*').remove();
			svg.select('.legend').selectAll('*').remove();

			drawTreemapContents(svg, width, treemapHeight, totalHeight);

			// Mark as initialized after first render
			if (!initialized) {
				initialized = true;
				// Call callback for initial page load fade-in
				if (!firstRenderDispatched && onFirstRenderComplete) {
					firstRenderDispatched = true;
					setTimeout(() => onFirstRenderComplete(), 100);
				}
			}

			(container as HTMLDivElement).style.minHeight = '';
			isRendering = false;
		}
	}

	// ── Draw treemap contents ────────────────────────────────────────────────
	function drawTreemapContents(
		svgSel: d3.Selection<SVGSVGElement, unknown, null, undefined>,
		width: number,
		treemapHeight: number,
		totalHeight: number
	) {
		// Empty / loading states
		if (!data?.length) {
			svgSel
				.select('.nodes')
				.append('text')
				.attr('x', width / 2)
				.attr('y', treemapHeight / 2)
				.attr('text-anchor', 'middle')
				.attr('font-size', 14)
				.attr('fill', '#6b7280')
				.text(loading ? 'Loading…' : error ? `Error: ${error}` : 'No data');
			return;
		}

		// Build treemap
		const root = d3
			.hierarchy<{ children: typeof data }>({ children: data })
			.sum((d: any) => d.value);
		d3
			.treemap<{ children: typeof data }>()
			.tile(d3.treemapSquarify)
			.paddingInner(2)
			.size([width, treemapHeight])(root as any);

		const leaves = root.leaves();
		const grand = root.value || 1;

		// Draw Nodes
		const nodes = svgSel
			.select('.nodes')
			.selectAll('g.node')
			.data(leaves)
			.join('g')
			.attr('class', 'node')
			.attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

		nodes
			.append('rect')
			.attr('width', (d: any) => Math.max(0, d.x1 - d.x0))
			.attr('height', (d: any) => Math.max(0, d.y1 - d.y0))
			.attr('fill', (d: any) => getColor(d.data))
			.attr('stroke', '#fff')
			.attr('stroke-width', 1);

		nodes.append('title').text((d: any) => {
			const pct = ((d.value || 0) / grand) * 100;
			return `${d.data.name}: ${formatNumber(d.data.value)} (${pct.toFixed(1)}%)`;
		});

		const label = nodes
			.append('g')
			.attr('class', 'label')
			.attr('transform', 'translate(6,10)')
			.attr('pointer-events', 'none');

		label
			.append('text')
			.attr('font-size', 12)
			.attr('font-weight', 700)
			.attr('fill', '#111827')
			.text((d: any) => d.data.name);

		label
			.append('text')
			.attr('y', 14)
			.attr('font-size', 11)
			.attr('fill', '#374151')
			.text((d: any) => `${((100 * (d.value || 0)) / grand).toFixed(1)}%`);

		nodes.each(function (d: any) {
			const w = d.x1 - d.x0,
				h = d.y1 - d.y0;
			if (w < 70 || h < 34) d3.select(this).select('.label').style('display', 'none');
		});

		// Draw legend
		if (showLegend) {
			requestAnimationFrame(() => drawLegend(svgSel, width, treemapHeight));
		}
	} // <-- End of drawTreemapContents

	// ── Legend (positioned below treemap) ───────────────────────────────────
	function drawLegend(
		svgSel: d3.Selection<SVGSVGElement, unknown, null, undefined>,
		width: number,
		treemapHeight: number
	) {
		const names = data.map((d) => d.name);
		const color = (name: string) => {
			const item = data.find((d) => d.name === name);
			return item ? getColor(item) : '#ccc';
		};

		const pad = 12,
			colGap = 16,
			rowGap = 8,
			sw = 12,
			fh = 12;
		const g = svgSel!
			.select('.legend')
			.attr('transform', `translate(${pad}, ${treemapHeight + pad})`)
			.attr('pointer-events', 'none'); // legend shouldn't block node hovers

		const measure = (text: string) => text.length * 7;
		const maxLine = width - 2 * pad;

		let x = 0,
			y = 0;
		const items: { name: string; x: number; y: number }[] = [];
		for (const n of names) {
			const wEstimate = sw + 6 + measure(n);
			if (x + wEstimate > maxLine && x !== 0) {
				x = 0;
				y += Math.max(sw, fh) + rowGap;
			}
			items.push({ name: n, x, y });
			x += wEstimate + colGap;
		}

		const typeLabel = `${populationTypeLabel} Subgroups`;
		const titleText =
			family === 'combined'
				? `AANHPI ${typeLabel} (${yearRange})`
				: family === 'asian'
					? `Asian ${typeLabel} (${yearRange})`
					: `NHPI ${typeLabel} (${yearRange})`;

		g.append('text')
			.attr('x', 0)
			.attr('y', -2)
			.attr('font-size', 14)
			.attr('font-weight', 600)
			.attr('fill', '#374151')
			.text(titleText);

		const rowY = 16;
		const item = g
			.selectAll('g.legend-item')
			.data(items)
			.join('g')
			.attr('class', 'legend-item')
			.attr('transform', (d) => `translate(${d.x}, ${rowY + d.y})`);

		item
			.append('rect')
			.attr('width', sw)
			.attr('height', sw)
			.attr('rx', 2)
			.attr('ry', 2)
			.attr('fill', (d) => color(d.name))
			.attr('stroke', '#e5e7eb');

		item
			.append('text')
			.attr('x', sw + 6)
			.attr('y', sw - 2)
			.attr('font-size', fh)
			.attr('fill', '#4b5563')
			.text((d) => d.name);
	} // <-- End of drawLegend
</script>

{#if showHeader}
	<div class="mb-2">
		<span class="header-label">
			{populationTypeLabel} Total: {formatNumber(total)} (ACS 5-year Estimates, {yearRange})
		</span>
	</div>
{/if}

<div bind:this={container} class="w-full min-h-[340px]" style="position: relative;"></div>
<div class="source-label site-container--flush">
	Source: U.S. Census Bureau, American Community Survey (ACS), 5-year estimates, and IPUMS USA,
	University of Minnesota, www.ipums.org
</div>

<style>
	:global(.node:hover) rect {
		filter: brightness(0.96);
		transition: filter 120ms ease-in-out;
	}
	:global(.legend text) {
		paint-order: stroke fill;
		stroke: rgba(255, 255, 255, 0.4);
		stroke-width: 0.4px;
	}
</style>
