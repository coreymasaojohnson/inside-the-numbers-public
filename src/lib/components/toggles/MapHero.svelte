<script context="module" lang="ts">
	export type Scope = 'county' | 'state';
	export type Category = 'combined' | 'asian' | 'nhpi';
</script>

<script lang="ts">
	import * as d3 from 'd3';
	import { feature, mesh } from 'topojson-client';
	import { onMount, onDestroy } from 'svelte';

	import {
		getAanhpiForeignBornCached,
		getAanhpiForeignBornByStateCached
	} from '$lib/data/acs';
	import type { CountyFips } from '$lib/data/acs';
	import { PALETTE } from '$lib/styles/palettes';

	// ---- props ----
	export let scope: Scope = 'county';
	export let category: Category = 'combined';

	// ---- Svelte callback prop for first render completion ----
	export let onFirstRenderComplete: (() => void) | undefined = undefined;
	let firstRenderDispatched = false;
	let firstRenderTimeout: ReturnType<typeof setTimeout> | null = null;

	// ---- refs / d3 handles ----
	let container: HTMLDivElement;
	let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
	let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
	let ro: ResizeObserver;
	let runId = 0;
	let isRendering = false;

	// ---- geo ----
	let counties: any[] | null = null;
	let statesFeats: any[] | null = null;
	let stateBorders: any | null = null;

	// ---- data maps ----
	let aapiByFips = new Map<CountyFips, number>();
	let namesByFips = new Map<CountyFips, string>();
	let denomByFips: Map<CountyFips, number> | undefined;
	let breakdownByFips = new Map<CountyFips, { asian: number; nhpi: number }>();

	// ---- colors ----
	const ACTIVE_PALETTE = PALETTE.plum;
	const neutral = 'var(--color-bg-alt, #F5F2EF)';

	// Reactive color scales that adjust based on category AND scope
	$: colorPercent = (() => {
		if (category === 'nhpi') {
			if (scope === 'state') {
				return d3
					.scaleThreshold<number, string>()
					.domain([0.1, 0.3, 0.6, 1, 3, 5])
					.range(ACTIVE_PALETTE);
			} else {
				return d3
					.scaleThreshold<number, string>()
					.domain([0.1, 0.3, 0.6, 1, 5, 15])
					.range(ACTIVE_PALETTE);
			}
		} else if (category === 'asian') {
			if (scope === 'state') {
				return d3
					.scaleThreshold<number, string>()
					.domain([10, 15, 20, 30, 40, 50])
					.range(ACTIVE_PALETTE);
			} else {
				return d3
					.scaleThreshold<number, string>()
					.domain([6, 11, 17, 23, 29, 34])
					.range(ACTIVE_PALETTE);
			}
		} else {
			if (scope === 'state') {
				return d3
					.scaleThreshold<number, string>()
					.domain([10, 15, 20, 30, 40, 50])
					.range(ACTIVE_PALETTE);
			} else {
				return d3
					.scaleThreshold<number, string>()
					.domain([6, 11, 17, 23, 29, 34])
					.range(ACTIVE_PALETTE);
			}
		}
	})();

	$: colorCounts = (() => {
		if (category === 'nhpi') {
			return d3
				.scaleThreshold<number, string>()
				.domain([1, 10, 50, 200, 1_000, 3_000])
				.range(ACTIVE_PALETTE);
		} else {
			return d3
				.scaleThreshold<number, string>()
				.domain([10, 100, 1_000, 5_000, 20_000, 50_000])
				.range(ACTIVE_PALETTE);
		}
	})();

	// ---- utils ----
	function debounce<T extends (...args: any[]) => void>(fn: T, ms = 120) {
		let t: number | undefined;
		return (...args: Parameters<T>) => {
			if (t) clearTimeout(t);
			t = window.setTimeout(() => fn(...args), ms);
		};
	}

	async function loadTopo() {
		const atlas = (await import('us-atlas/counties-10m.json')).default as any;
		counties = (feature(atlas, atlas.objects.counties) as any).features as any[];
		stateBorders = mesh(atlas, atlas.objects.states, (a: any, b: any) => a !== b);
		statesFeats = (feature(atlas, atlas.objects.states) as any).features as any[];
		console.info('[MapHero] topo counties:', counties.length, 'states:', statesFeats.length);
	}

	async function loadDataForScope(s: Scope) {
		if (s === 'state') {
			const { byState, breakdown, names, denomForeignBorn } =
				await getAanhpiForeignBornByStateCached(true);

			aapiByFips = byState as unknown as Map<CountyFips, number>;
			namesByFips = names as unknown as Map<CountyFips, string>;
			denomByFips = denomForeignBorn as unknown as Map<CountyFips, number>;
			breakdownByFips = breakdown as unknown as Map<CountyFips, { asian: number; nhpi: number }>;

			console.info('[MapHero] state data:', byState.size, 'with breakdown:', breakdown.size);
		} else {
			const result = await getAanhpiForeignBornCached({ withDenominator: true });
			const fullResult = result as any;

			aapiByFips = result.byFips;
			namesByFips = result.names;
			denomByFips = result.denomForeignBorn;
			breakdownByFips = fullResult.breakdown || new Map();

			console.info(
				'[MapHero] county data:',
				result.byFips.size,
				'with breakdown:',
				breakdownByFips.size
			);
		}
	}

	function getCategoryDisplayName(): string {
		if (category === 'combined') return 'AANHPI';
		if (category === 'asian') return 'Asian';
		return 'NHPI';
	}

	function drawMapSkeleton(
		width: number,
		height: number
	): d3.Selection<SVGSVGElement, unknown, null, undefined> {
		const isState = scope === 'state';
		const categoryName = getCategoryDisplayName();

		return d3
			.select(container)
			.append('svg')
			.attr('viewBox', `0 0 ${width} ${height}`)
			.attr('width', width)
			.attr('height', height)
			.style('display', 'block')
			.attr('role', 'img')
			.attr(
				'aria-label',
				isState
					? `Choropleth map of ${categoryName} foreign-born share by state`
					: `Choropleth map of ${categoryName} foreign-born share by county`
			);
	}

	function drawMapContents(
		svgEl: d3.Selection<SVGSVGElement, unknown, null, undefined>,
		width: number,
		height: number,
		feats: any[],
		getKey: (d: any) => string
	) {
		const isState = scope === 'state';

		g = svgEl.append('g');

		const projection = d3.geoAlbersUsa().fitSize([width, height], {
			type: 'FeatureCollection',
			features: feats
		});
		const path = d3.geoPath(projection);

		const categoryValues = new Map<CountyFips, number>();
		if (category === 'combined') {
			aapiByFips.forEach((val, key) => categoryValues.set(key, val));
		} else {
			breakdownByFips.forEach((breakdown, key) => {
				const val = category === 'asian' ? breakdown.asian : breakdown.nhpi;
				categoryValues.set(key, val);
			});
		}

		g.append('g')
			.attr('class', isState ? 'states' : 'counties')
			.selectAll('path')
			.data(feats)
			.join('path')
			.attr('d', path as any)
			.style('fill', (d: any) => {
				const k = getKey(d);
				const count = categoryValues.get(k as any);

				if (count == null) return neutral;
				if (count === 0 && (category === 'nhpi' || scope === 'county')) return neutral;

				if (denomByFips) {
					const denom = denomByFips.get(k as any);
					if (denom && denom > 0) {
						const pct = (count / denom) * 100;
						if (pct === 0 && (category === 'nhpi' || scope === 'county')) return neutral;
						return colorPercent(pct);
					}
				}

				return colorCounts(count);
			})
			.style('stroke', '#ffffff')
			.style('stroke-width', 0.5)
			.attr('vector-effect', 'non-scaling-stroke')
			.on('pointerenter', function (event: PointerEvent, d: any) {
				d3.select(this).style('stroke-width', 1);
				showTooltip(event, d, getKey);
			})
			.on('pointermove', (event: PointerEvent) => moveTooltip(event))
			.on('pointerleave', function () {
				d3.select(this).style('stroke-width', 0.5);
				hideTooltip();
			});

		g.append('path')
			.attr('d', path(stateBorders as any) as any)
			.attr('fill', 'none')
			.attr('stroke', '#ffffff')
			.attr('stroke-width', 1)
			.attr('vector-effect', 'non-scaling-stroke')
			.attr('pointer-events', 'none');

		drawLegend(svgEl, width, height, projection);
	}

	function render() {
		if (!container || !counties || !statesFeats || !stateBorders) return;
		if (!initialized && aapiByFips.size === 0) return;
		if (isRendering) {
			console.log('[MapHero] render() blocked - already rendering');
			return;
		}

		const width = container.clientWidth;

		if (!width || width < 100) {
			console.log('[MapHero] render() skipped - container not visible or too small:', width);
			return;
		}

		console.log(
			'[MapHero] render() called - scope:',
			scope,
			'category:',
			category,
			'width:',
			width
		);
		isRendering = true;

		d3.select(container).selectAll('div').remove();
		d3.select(container)
			.selectAll('svg')
			.each(function () {
				if (this !== svg?.node()) {
					d3.select(this).remove();
				}
			});

		const isState = scope === 'state';
		const feats = isState ? statesFeats! : counties!;
		const getKey = (d: any) =>
			isState ? String(d.id).padStart(2, '0') : String(d.id).padStart(5, '0');

		const height = Math.round(width * 0.62);

		const reduceMotion =
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

		container.style.height = `${height}px`;

		const oldSvg = svg;
		const shouldCrossFade = initialized && !reduceMotion && oldSvg;

		if (shouldCrossFade) {
			const newSvg = drawMapSkeleton(width, height);
			newSvg
				.style('position', 'absolute')
				.style('top', '0')
				.style('left', '0')
				.style('opacity', '0');

			drawMapContents(newSvg, width, height, feats, getKey);

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
					isRendering = false;
				});

			if (oldSvg) {
				oldSvg.transition().delay(60).duration(1000).style('opacity', '0');
			}
			svg = newSvg;
		} else {
			if (svg) svg.remove();
			svg = drawMapSkeleton(width, height);

			if (!initialized) {
				svg.style('opacity', '0');
			}

			drawMapContents(svg, width, height, feats, getKey);

			if (!initialized) {
				svg.style('opacity', '1');
			}

			isRendering = false;
		}
	}

	function drawLegend(
		svgEl: d3.Selection<SVGSVGElement, unknown, null, undefined>,
		width: number,
		height: number,
		projection: d3.GeoProjection
	) {
		const boxW = 52,
			boxH = 14,
			gap = 4;
		const titleSize = 16,
			tickSize = 12;

		const usingPercent = !!denomByFips;
		const scale = usingPercent ? colorPercent : colorCounts;

		const categoryName = getCategoryDisplayName();
		const titleText = usingPercent
			? `Foreign-born ${categoryName} as percentage of overall foreign-born population`
			: `Foreign-born ${categoryName} population count`;

		const showZeroBucket = category === 'nhpi' || scope === 'county';
		const swatches = showZeroBucket ? [neutral, ...scale.range()] : scale.range();
		const legendW = swatches.length * boxW + (swatches.length - 1) * gap;

		const lonWI = -92.9,
			latN = 46.8,
			lonNH = -70.6;
		const p1 = projection([lonWI, latN]);
		const p2 = projection([lonNH, latN]);
		let x = width - legendW - 20;
		let y = 10;
		if (p1 && p2) {
			const midX = (p1[0] + p2[0]) / 2;
			x = Math.max(8, Math.min(width - legendW - 8, midX - legendW / 2));
		}
		x -= 35;

		const legend = svgEl!
			.append('g')
			.attr('transform', `translate(${x},${y})`)
			.attr('pointer-events', 'none');

		legend
			.append('text')
			.attr('x', 0)
			.attr('y', 0)
			.attr('font-size', titleSize)
			.attr('font-weight', 600)
			.attr('fill', '#374151')
			.attr('dominant-baseline', 'hanging')
			.text(titleText);

		const swatchY = titleSize + 6;
		const items = legend
			.append('g')
			.attr('transform', `translate(0, ${swatchY})`)
			.selectAll('g.item')
			.data(swatches)
			.join('g')
			.attr('class', 'item')
			.attr('transform', (_d, i) => `translate(${i * (boxW + gap)}, 0)`);

		items
			.append('rect')
			.attr('width', boxW)
			.attr('height', boxH)
			.attr('rx', 2)
			.attr('ry', 2)
			.attr('fill', (d) => d as string)
			.attr('stroke', '#e5e7eb');

		if (usingPercent) {
			if (showZeroBucket) {
				const t = (scale as d3.ScaleThreshold<number, string>).domain();
				items
					.append('text')
					.attr('x', 0)
					.attr('y', boxH + 14)
					.attr('font-size', tickSize)
					.attr('fill', '#4b5563')
					.text((_, i) => {
						if (i === 0) return '0.0%';

						const domainIndex = i - 1;
						const a = domainIndex === 0 ? 0 : t[domainIndex - 1];
						const b = t[domainIndex];

						const pct = (n: number) => (n < 1 ? `${n.toFixed(1)}%` : `${Math.round(n)}%`);

						if (domainIndex === 0) return `>0.0–${pct(b)}`;
						if (b == null) return `${pct(a)}+`;
						return `${pct(a)}–${pct(b)}`;
					});
			} else {
				const t = (scale as d3.ScaleThreshold<number, string>).domain();
				const starts = [0, ...t];
				items
					.append('text')
					.attr('x', 0)
					.attr('y', boxH + 14)
					.attr('font-size', tickSize)
					.attr('fill', '#4b5563')
					.text((_, i) => {
						const a = starts[i],
							b = starts[i + 1];
						const pct = (n: number) => (n < 1 ? `${n.toFixed(1)}%` : `${Math.round(n)}%`);
						return b == null ? `${pct(a)}+` : `${pct(a)}–${pct(b)}`;
					});
			}
		} else {
			if (showZeroBucket) {
				const t = (scale as d3.ScaleThreshold<number, string>).domain();
				const fmt = d3.format(',');
				items
					.append('text')
					.attr('x', 0)
					.attr('y', boxH + 14)
					.attr('font-size', tickSize)
					.attr('fill', '#4b5563')
					.text((_, i) => {
						if (i === 0) return '0';

						const domainIndex = i - 1;
						const a = domainIndex === 0 ? 0 : t[domainIndex - 1];
						const b = t[domainIndex];

						if (domainIndex === 0) return `>0–${fmt(b)}`;
						if (b == null) return `${fmt(a)}+`;
						return `${fmt(a)}–${fmt(b)}`;
					});
			} else {
				const t = (scale as d3.ScaleThreshold<number, string>).domain();
				const starts = [0, ...t];
				const fmt = d3.format(',');
				items
					.append('text')
					.attr('x', 0)
					.attr('y', boxH + 14)
					.attr('font-size', tickSize)
					.attr('fill', '#4b5563')
					.text((_, i) => {
						const a = starts[i],
							b = starts[i + 1];
						return b == null ? `${fmt(a)}+` : `${fmt(a)}–${fmt(b)}`;
					});
			}
		}
	}

	// ---- tooltip ----
	let tooltip: HTMLDivElement | null = null;
	function ensureTooltip() {
		if (!tooltip) {
			tooltip = document.createElement('div');
			tooltip.className = 'map-tooltip';
			document.body.appendChild(tooltip);
		}
	}

	function getValueForCategory(fips: CountyFips): number | undefined {
		if (category === 'combined') {
			return aapiByFips.get(fips);
		}
		const breakdown = breakdownByFips.get(fips);
		if (!breakdown) {
			return undefined;
		}
		const value = category === 'asian' ? breakdown.asian : breakdown.nhpi;
		return value;
	}

	function showTooltip(evt: PointerEvent, d: any, getKey: (d: any) => string) {
		ensureTooltip();
		const k = getKey(d);
		const name = namesByFips.get(k) ?? (scope === 'state' ? `State ${k}` : `FIPS ${k}`);
		const count = getValueForCategory(k as any);

		const categoryName = getCategoryDisplayName();

		let pct: number | undefined;
		if (count != null && denomByFips) {
			const denom = denomByFips.get(k as any);
			if (denom && denom > 0) {
				pct = (count / denom) * 100;
			}
		}

		tooltip!.style.display = 'block';
		tooltip!.innerHTML =
			`<strong>${name}</strong><br>` +
			(count != null ? `${count.toLocaleString()} foreign-born ${categoryName}` : 'No data') +
			(pct != null ? ` (${pct.toFixed(1)}%)` : '');
		moveTooltip(evt);
	}

	function moveTooltip(evt: PointerEvent) {
		if (!tooltip) return;
		tooltip.style.left = `${evt.clientX + 12}px`;
		tooltip.style.top = `${evt.clientY + 12}px`;
	}

	function hideTooltip() {
		if (tooltip) tooltip.style.display = 'none';
	}

	// ---- mount & reactive scope/category handling ----
	let initialized = false;

	onMount(() => {
		let alive = true;
		(async () => {
			try {
				await loadTopo();
				if (!alive) return;

				const debouncedRender = debounce(render, 120);
				ro = new ResizeObserver(() => debouncedRender());
				ro.observe(container);

				const currentRunId = ++runId;
				await loadDataForScope(scope);
				if (!alive) return;

				if (currentRunId === runId) {
					initialized = true;
					render();
					if (!firstRenderDispatched && onFirstRenderComplete) {
						firstRenderDispatched = true;
						firstRenderTimeout = setTimeout(() => onFirstRenderComplete(), 100);
					}
				}
			} catch (err) {
				console.error('[MapHero] init failed:', err);
				if (svg) render();
			}
		})();

		return () => {
			alive = false;
		};
	});

	function handleScopeOrCategoryChange(currentScope: Scope) {
		const currentRunId = ++runId;
		(async () => {
			await loadDataForScope(currentScope);
			if (currentRunId === runId) {
				render();
			}
		})();
	}

	$: if (initialized && (scope !== undefined || category !== undefined) && counties && statesFeats) {
		handleScopeOrCategoryChange(scope);
	}

	onDestroy(() => {
		if (firstRenderTimeout) clearTimeout(firstRenderTimeout);
		ro && ro.disconnect();
		if (svg) svg.remove();
		if (tooltip) tooltip.remove();
	});
</script>

<div bind:this={container} class="w-full min-h-[360px]" style="position: relative;"></div>
<div class="source-label site-container--flush">
	Source: U.S. Census Bureau, American Community Survey (ACS), 5-year estimates
</div>

<style>
	:global(.map-tooltip) {
		position: fixed;
		pointer-events: none;
		background: rgba(255, 255, 255, 0.97);
		border: 1px solid #e5e7eb;
		padding: 6px 8px;
		border-radius: 6px;
		font-size: 12px;
		color: #111827;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
		z-index: 50;
		display: none;
	}
</style>
