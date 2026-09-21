<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as d3 from 'd3';
	import { formatNumber } from '$lib/utils';
	import { PALETTE } from '$lib/styles/palettes';
	import { getAanhpiSubgroupsCombinedTimeSeries } from '$lib/data/pums';

	// ── Config ───────────────────────────────────────────────────────────────
	const BASELINE_YEAR = 2009;
	const TOP_N = 8;
	const HEIGHT = 600;
	const margin = { top: 60, right: 170, bottom: 40, left: 80 };

	const ASIAN_COLORS_SET = PALETTE.plum.slice(1, 1 + TOP_N);
	const NHPI_COLORS_SET = PALETTE.ember.slice(1, 1 + TOP_N);
	const BASELINE_COLOR = PALETTE.gray[5];

	// ── Types ────────────────────────────────────────────────────────────────
	type TimeSeriesData = Array<{ year: number; name: string; value: number }>;
	type LinePoint = { year: number; value: number; display: number };
	type LineGroupData = { name: string; baseline: number; isAsian: boolean; data: LinePoint[] };

	// ── State ────────────────────────────────────────────────────────────────
	export let view: 'combined' | 'asian' | 'nhpi' = 'combined';
	export let measure: 'indexed' | 'absolute' = 'absolute';

	// ── Svelte 5 callback prop for first render completion ────────────────────
	export let onFirstRenderComplete: (() => void) | undefined = undefined;
	let firstRenderDispatched = false;

	let loading = true;
	let dataTimeSeries: TimeSeriesData = [];
	let ASIAN_GROUPS: string[] = [];
	let NHPI_GROUPS: string[] = [];
	let YEARS: number[] = [];

	$: ALL_STACK_KEYS = [...ASIAN_GROUPS, ...NHPI_GROUPS];

	let cardContainer: HTMLDivElement | null = null;
	let chartContainer: HTMLDivElement | null = null;
	let tooltipContainer: HTMLDivElement | null = null;
	let tooltipYear: number | null = null;
	let tooltipData: Array<{ name: string; value: number; color: string; isAbsolute: boolean }> = [];
	let tooltipStyle = 'opacity:0;';
	let ro: ResizeObserver | null = null;
	let roTimer: number | null = null;

	// Transitions
	let currentSvg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
	let isRendering = false;
	let initialized = false;

	// ── Data Fetching ────────────────────────────────────────────────────────
	async function fetchData() {
		loading = true;
		try {
			const { timeSeries, asianGroups, nhpiGroups, years } =
				await getAanhpiSubgroupsCombinedTimeSeries({
					topN: TOP_N,
					minYear: BASELINE_YEAR
				});

			dataTimeSeries = Array.isArray(timeSeries)
				? timeSeries
						.filter((d) => d.name !== 'Other Polynesian' && d.name !== 'Polynesian')
						.map((d) => ({ ...d, value: isNaN(d.value) || !isFinite(d.value) ? 0 : d.value }))
				: [];
			ASIAN_GROUPS = Array.isArray(asianGroups) ? asianGroups : [];
			NHPI_GROUPS = Array.isArray(nhpiGroups)
				? nhpiGroups.filter((g) => g !== 'Other Polynesian' && g !== 'Polynesian')
				: [];
			YEARS = Array.isArray(years) ? years.slice().sort((a, b) => a - b) : [];
		} catch (e) {
			console.error('Error fetching AANHPI time series data:', e);
			dataTimeSeries = [];
			ASIAN_GROUPS = [];
			NHPI_GROUPS = [];
			YEARS = [];
		} finally {
			loading = false;
			if (typeof window !== 'undefined') window.setTimeout(renderChart, 0);
		}
	}

	// ── Stack prep (for absolute/count views) ────────────────────────────────
	$: stackData = (() => {
		if (!YEARS.length || !dataTimeSeries.length) return [];
		const byYear = d3.rollup(
			dataTimeSeries,
			(v) => Object.fromEntries(v.map((d) => [d.name, d.value])),
			(d) => d.year
		);
		const rows: any[] = [];
		byYear.forEach((obj, year) => rows.push({ year, ...obj }));
		return rows.sort((a, b) => a.year - b.year);
	})();

	// ── Line prep (for indexed views) ────────────────────────────────────────
	$: lineChartData = processLineData(dataTimeSeries, view, measure);

	function processLineData(
		data: TimeSeriesData,
		currentView: 'combined' | 'asian' | 'nhpi',
		currentMeasure: 'indexed' | 'absolute'
	): LineGroupData[] {
		if (currentMeasure === 'absolute') return [];
		if (!ASIAN_GROUPS.length && !NHPI_GROUPS.length) return [];

		let filtered = data;
		if (currentView === 'asian') filtered = data.filter((d) => ASIAN_GROUPS.includes(d.name));
		if (currentView === 'nhpi') filtered = data.filter((d) => NHPI_GROUPS.includes(d.name));

		const grouped = Array.from(d3.group(filtered, (d) => d.name));
		const lines: LineGroupData[] = grouped
			.map(([name, grp]) => {
				const baseline = grp.find((d) => d.year === BASELINE_YEAR)?.value ?? 0;
				const points: LinePoint[] = grp
					.slice()
					.sort((a, b) => a.year - b.year)
					.map((d) => ({
						year: d.year,
						value: d.value,
						display: baseline > 0 ? (d.value / baseline) * 100 : d.value
					}));
				return { name, baseline, isAsian: ASIAN_GROUPS.includes(name), data: points };
			})
			.filter((line) => line.baseline > 0);

		lines.sort((a, b) => {
			const av = a.data[a.data.length - 1]?.display ?? 0;
			const bv = b.data[b.data.length - 1]?.display ?? 0;
			return bv - av;
		});

		return lines;
	}

	// ── Lifecycle / Resize ───────────────────────────────────────────────────
	onMount(() => {
		fetchData();
		if (typeof ResizeObserver !== 'undefined') {
			ro = new ResizeObserver(() => {
				if (roTimer) window.clearTimeout(roTimer);
				roTimer = window.setTimeout(renderChart, 120);
			});
			if (cardContainer instanceof Element) ro.observe(cardContainer);
		}
	});

	onDestroy(() => {
		ro?.disconnect();
		if (roTimer) window.clearTimeout(roTimer);
	});

	$: if (initialized && view && measure && YEARS && dataTimeSeries) {
		renderChart();
	}

	// ── Rendering ────────────────────────────────────────────────────────────
	function renderChart() {
		if (loading) return;
		if (!cardContainer || !chartContainer) return;
		if (!YEARS.length) return;
		if (isRendering) {
			console.log('[GrowthHero] render blocked - already rendering');
			return;
		}

		const width = cardContainer.clientWidth;

		if (!width || width < 100) {
			console.log('[GrowthHero] render skipped - container not visible:', width);
			return;
		}

		console.log('[GrowthHero] render() called - view:', view, 'measure:', measure, 'width:', width);
		isRendering = true;

		const isStackedArea = measure === 'absolute';
		const height = HEIGHT - margin.top - margin.bottom;
		const innerWidth = Math.max(100, width - margin.left - margin.right);

		const reduceMotion =
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

		const oldSvg = currentSvg;
		const shouldCrossFade = initialized && !reduceMotion && oldSvg;

		if (shouldCrossFade) {
			const newSvg = d3
				.select(chartContainer)
				.append('svg')
				.attr('viewBox', `0 0 ${width} ${HEIGHT}`)
				.attr('width', '100%')
				.attr('height', HEIGHT)
				.style('position', 'absolute')
				.style('top', '0')
				.style('left', '0')
				.style('opacity', '0');

			drawChartContents(newSvg, width, height, innerWidth, isStackedArea);

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

			currentSvg = newSvg;
		} else {
			d3.select(chartContainer).select('svg').remove();

			const svg = d3
				.select(chartContainer)
				.append('svg')
				.attr('viewBox', `0 0 ${width} ${HEIGHT}`)
				.attr('width', '100%')
				.attr('height', HEIGHT);

			if (!initialized) {
				svg.style('opacity', '0');
			}

			drawChartContents(svg, width, height, innerWidth, isStackedArea);

			if (!initialized) {
				svg.style('opacity', '1');
				initialized = true;
				if (!firstRenderDispatched && onFirstRenderComplete) {
					firstRenderDispatched = true;
					setTimeout(() => onFirstRenderComplete(), 100);
				}
			}

			currentSvg = svg;
			isRendering = false;
		}
	}

	function drawChartContents(
		svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
		width: number,
		height: number,
		innerWidth: number,
		isStackedArea: boolean
	) {
		const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

		const xScale = d3
			.scaleTime()
			.domain(d3.extent(YEARS, (y) => new Date(y, 0, 1)) as [Date, Date])
			.range([0, innerWidth]);

		let yMin: number, yMax: number;
		let keysToUse: string[];
		let stackDataFiltered: any[];

		if (isStackedArea) {
			if (view === 'asian') {
				keysToUse = ASIAN_GROUPS;
				stackDataFiltered = stackData.map((row) => {
					const filtered: any = { year: row.year };
					ASIAN_GROUPS.forEach((k) => {
						filtered[k] = row[k] || 0;
					});
					return filtered;
				});
			} else if (view === 'nhpi') {
				keysToUse = NHPI_GROUPS;
				stackDataFiltered = stackData.map((row) => {
					const filtered: any = { year: row.year };
					NHPI_GROUPS.forEach((k) => {
						filtered[k] = row[k] || 0;
					});
					return filtered;
				});
			} else {
				keysToUse = ALL_STACK_KEYS;
				stackDataFiltered = stackData;
			}

			const finalYearRow = stackDataFiltered[stackDataFiltered.length - 1];
			if (finalYearRow) {
				keysToUse = [...keysToUse].sort((a, b) => {
					const aVal = Number(finalYearRow[a] ?? 0);
					const bVal = Number(finalYearRow[b] ?? 0);
					return bVal - aVal;
				});
			}

			const stack = d3
				.stack<any>()
				.keys(keysToUse)
				.order(d3.stackOrderNone)
				.offset(d3.stackOffsetNone);

			const stackedLayers = stack(stackDataFiltered);

			yMin = 0;
			yMax = d3.max(stackedLayers, (L) => d3.max(L, (d) => d[1])) || 1;

			if (view === 'combined') {
				yMax = Math.max(yMax * 1.1, 13000000);
			} else if (view === 'asian') {
				yMax = Math.min(yMax * 1.05, 9000000);
			}
		} else {
			const all = lineChartData.flatMap((d) => d.data.map((p) => p.display));
			yMin = view === 'asian' ? 85 : 50;
			yMax = d3.max(all) || 110;
		}

		const yScale = d3.scaleLinear().domain([yMin, yMax]).nice().range([height, 0]);

		g.append('g')
			.attr('class', 'grid')
			.call(
				d3
					.axisLeft(yScale)
					.tickSize(-innerWidth)
					.tickFormat(() => '')
					.ticks(5)
			)
			.attr('stroke', '#ccc')
			.attr('stroke-opacity', 0.5);

		const colorScale = d3
			.scaleOrdinal<string>()
			.domain([...ASIAN_GROUPS, ...NHPI_GROUPS])
			.range([...ASIAN_COLORS_SET, ...NHPI_COLORS_SET]);

		if (isStackedArea) {
			if (view === 'asian') {
				keysToUse = ASIAN_GROUPS;
				stackDataFiltered = stackData.map((row) => {
					const filtered: any = { year: row.year };
					ASIAN_GROUPS.forEach((k) => {
						filtered[k] = row[k] || 0;
					});
					return filtered;
				});
			} else if (view === 'nhpi') {
				keysToUse = NHPI_GROUPS;
				stackDataFiltered = stackData.map((row) => {
					const filtered: any = { year: row.year };
					NHPI_GROUPS.forEach((k) => {
						filtered[k] = row[k] || 0;
					});
					return filtered;
				});
			} else {
				keysToUse = ALL_STACK_KEYS;
				stackDataFiltered = stackData;
			}

			const finalYearRow = stackDataFiltered[stackDataFiltered.length - 1];
			if (finalYearRow) {
				keysToUse = [...keysToUse].sort((a, b) => {
					const aVal = Number(finalYearRow[a] ?? 0);
					const bVal = Number(finalYearRow[b] ?? 0);
					return bVal - aVal;
				});
			}

			const stack = d3
				.stack<any>()
				.keys(keysToUse)
				.order(d3.stackOrderNone)
				.offset(d3.stackOffsetNone);

			const stackedLayers = stack(stackDataFiltered);

			const area = d3
				.area<any>()
				.x((d: any) => xScale(new Date(d.data.year, 0, 1)))
				.y0((d: any) => yScale(d[0]))
				.y1((d: any) => yScale(d[1]));

			g.selectAll('.layer')
				.data(stackedLayers)
				.join('path')
				.attr('class', 'layer')
				.attr('fill', (d) => colorScale(d.key) as string)
				.attr('d', area);

			const LABEL_THRESHOLD = view === 'nhpi' ? 40000 : view === 'asian' ? 120000 : 200000;
			const lastYearData = stackDataFiltered[stackDataFiltered.length - 1];
			const smallGroups: Array<{ key: string; value: number; color: string }> = [];
			let topInlineLabelY = Infinity;

			if (lastYearData) {
				const stackedForLabels = stack(stackDataFiltered);
				stackedForLabels.forEach((layer) => {
					const lastPoint = layer[layer.length - 1];
					if (lastPoint) {
						const y0 = lastPoint[0];
						const y1 = lastPoint[1];
						const midY = (y0 + y1) / 2;
						const value = y1 - y0;

						if (value >= LABEL_THRESHOLD) {
							const labelY = yScale(midY);
							topInlineLabelY = Math.min(topInlineLabelY, labelY);

							g.append('text')
								.attr('class', 'end-label-area')
								.attr('x', innerWidth + 5)
								.attr('y', labelY)
								.attr('dy', '0.35em')
								.style('font-size', '10px')
								.style('font-weight', 600)
								.style('fill', colorScale(layer.key) as string)
								.text(`${layer.key} (${formatNumber(value, { notation: 'compact' })})`);
						} else {
							smallGroups.push({
								key: layer.key,
								value: value,
								color: colorScale(layer.key) as string
							});
						}
					}
				});

				if (smallGroups.length > 0) {
					smallGroups.sort((a, b) => a.value - b.value);

					const lineHeight = 14;
					const legendX = innerWidth + 5;
					const titleHeight = 16;
					const legendTotalHeight = titleHeight + smallGroups.length * lineHeight;
					const legendY = topInlineLabelY - legendTotalHeight - 10;

					const legend = g
						.append('g')
						.attr('class', 'small-groups-legend')
						.attr('transform', `translate(${legendX}, ${legendY})`);

					legend
						.append('text')
						.attr('x', 0)
						.attr('y', 0)
						.style('font-size', '10px')
						.style('font-weight', 'bold')
						.style('fill', '#6b7280')
						.text('Smaller Subgroups:');

					smallGroups.forEach((grp, i) => {
						const yPos = titleHeight + i * lineHeight;

						legend
							.append('circle')
							.attr('cx', 5)
							.attr('cy', yPos)
							.attr('r', 4)
							.attr('fill', grp.color);

						legend
							.append('text')
							.attr('x', 14)
							.attr('y', yPos)
							.attr('dy', '0.32em')
							.style('font-size', '9px')
							.style('font-weight', 500)
							.style('fill', '#374151')
							.text(`${grp.key} (${formatNumber(grp.value, { notation: 'compact' })})`);
					});
				}
			}
		} else {
			const line = d3
				.line<LinePoint>()
				.x((d) => xScale(new Date(d.year, 0, 1)))
				.y((d) => yScale(d.display));

			if (view === 'combined' || view === 'asian') {
				g.append('line')
					.attr('x1', 0)
					.attr('x2', innerWidth)
					.attr('y1', yScale(100))
					.attr('y2', yScale(100))
					.attr('stroke', BASELINE_COLOR)
					.attr('stroke-width', 1.5)
					.attr('stroke-dasharray', '4,4')
					.attr('opacity', 0.7);

				g.append('text')
					.attr('x', innerWidth + 5)
					.attr('y', yScale(100))
					.attr('dy', '0.35em')
					.style('font-size', '10px')
					.style('fill', BASELINE_COLOR)
					.style('font-weight', '600')
					.text(`${BASELINE_YEAR} = 100`);
			}

			const group = g
				.selectAll('.line-group')
				.data(lineChartData, (d: any) => d?.name ?? '')
				.join('g')
				.attr(
					'class',
					(d) =>
						`line-group group-${d.isAsian ? 'asian' : 'nhpi'} group-${d.name.replace(/\s/g, '-')}`
				);

			group
				.append('path')
				.attr('class', 'growth-line')
				.attr('fill', 'none')
				.attr('stroke-width', 2.5)
				.attr('stroke', (d) => colorScale(d.name) as string)
				.attr('d', (d) => line(d.data) ?? '');

			group
				.append('text')
				.attr('class', 'end-label')
				.datum((d) => {
					const last = d.data[d.data.length - 1];
					return { name: d.name, last };
				})
				.attr('transform', (d) => {
					const y = d.last ? yScale(d.last.display) : 0;
					return `translate(${innerWidth}, ${y})`;
				})
				.attr('x', 5)
				.attr('dy', '0.35em')
				.style('font-size', '11px')
				.style('font-weight', 600)
				.style('fill', (d) => colorScale(d.name) as string)
				.text((d) => {
					const val = d.last?.display ?? 0;
					return `${d.name} (${d3.format('.1f')(val)}%)`;
				});
		}

		// Axes
		g.append('g')
			.attr('transform', `translate(0, ${height})`)
			.call(
				d3
					.axisBottom(xScale)
					.tickFormat((d) => d3.timeFormat('%Y')(d as Date))
					.tickValues(YEARS.map((y) => new Date(y, 0, 1)))
			);

		const yAxisFormat = isStackedArea
			? (d: any) => formatNumber(Number(d) || 0, { notation: 'compact' })
			: d3.format('.0f');

		g.append('g').call(d3.axisLeft(yScale).tickFormat(yAxisFormat as any));

		const yLabel = isStackedArea
			? view === 'combined'
				? 'Disaggregated Population Count'
				: view === 'asian'
					? 'Asian Subgroup Count'
					: 'NHPI Subgroup Count'
			: `Indexed Growth (${BASELINE_YEAR}=100)`;

		g.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('y', 0 - margin.left + 5)
			.attr('x', 0 - height / 2)
			.attr('dy', '1em')
			.style('text-anchor', 'middle')
			.style('font-size', '12px')
			.style('font-weight', 'bold')
			.text(yLabel);

		// ── Interaction (hover line + tooltip) ────────────────────────────────
		const yearsAsDates = YEARS.map((y) => new Date(y, 0, 1));
		const bisect = d3.bisector((d: Date) => d.getTime()).left;
		const focus = g.append('g').attr('class', 'focus').style('display', 'none');

		focus
			.append('line')
			.attr('class', 'hover-line')
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', PALETTE.gray[6])
			.attr('stroke-width', 1)
			.attr('stroke-dasharray', '3,3');

		const overlay = svg
			.append('rect')
			.attr('class', 'overlay')
			.attr('width', innerWidth)
			.attr('height', height)
			.attr('transform', `translate(${margin.left},${margin.top})`)
			.style('fill', 'none')
			.style('pointer-events', 'all');

		overlay
			.on('mouseover', () => {
				focus.style('display', null);
				tooltipStyle = tooltipStyle.replace(/opacity:\s*0;?/, 'opacity:1;');
			})
			.on('mouseout', () => {
				focus.style('display', 'none');
				tooltipStyle = tooltipStyle.replace(/opacity:\s*1;?/, 'opacity:0;');
				tooltipYear = null;
			})
			.on('mousemove', (event: MouseEvent) => {
				if (!cardContainer || !tooltipContainer) return;

				const [px] = d3.pointer(event);
				const xDate = xScale.invert(px);
				const i = Math.min(
					yearsAsDates.length - 1,
					Math.max(0, bisect(yearsAsDates, xDate.getTime()))
				);
				const d0 = yearsAsDates[Math.max(0, i - 1)];
				const d1 = yearsAsDates[i];
				const closest =
					d1 && xDate.getTime() - d0.getTime() > d1.getTime() - xDate.getTime() ? d1 : d0;
				const closestYear = closest.getFullYear();
				const xValue = xScale(closest);

				focus.select('.hover-line').attr('transform', `translate(${xValue},0)`);
				tooltipYear = closestYear;
				const arr: typeof tooltipData = [];

				if (isStackedArea) {
					const row: any = stackData.find((r: any) => r.year === closestYear) || {};
					let total = 0;
					const keysForTooltip =
						view === 'asian' ? ASIAN_GROUPS : view === 'nhpi' ? NHPI_GROUPS : ALL_STACK_KEYS;

					keysForTooltip.forEach((k) => {
						const v = Number(row[k] ?? 0);
						total += v;
						arr.push({ name: k, value: v, color: colorScale(k) as string, isAbsolute: true });
					});
					arr.sort((a, b) => b.value - a.value);
					tooltipData = [
						{ name: 'Total Population', value: total, color: PALETTE.gray[6], isAbsolute: true },
						...arr
					];
				} else {
					lineChartData.forEach((series) => {
						const pt = series.data.find((p) => p.year === closestYear);
						if (pt) {
							arr.push({
								name: series.name,
								value: pt.display,
								color: colorScale(series.name) as string,
								isAbsolute: false
							});
						}
					});
					arr.sort((a, b) => b.value - a.value);
					tooltipData = arr;
				}

				const rect = cardContainer.getBoundingClientRect();
				const tipW = tooltipContainer.clientWidth || 200;
				const tipH = tooltipContainer.clientHeight || 80;
				const offset = 15;

				let left = event.clientX - rect.left + offset;
				let top = event.clientY - rect.top + offset;

				if (left + tipW + offset > rect.width) left = event.clientX - rect.left - tipW - offset;
				if (top + tipH > rect.height) top = event.clientY - rect.top - tipH - offset;
				if (left < 0) left = 5;

				tooltipStyle = `transform: translate(${left}px, ${top}px); opacity:1;`;
			});
	}
</script>

<div bind:this={cardContainer} class="bg-white relative font-[Inter]">
	<div
		bind:this={tooltipContainer}
		class="absolute z-50 p-3 bg-white border border-gray-300 rounded-lg shadow-xl pointer-events-none transition-opacity duration-100 whitespace-nowrap"
		style={tooltipStyle}
	>
		{#if tooltipYear}
			<div class="font-bold text-gray-800 mb-1 text-sm">{tooltipYear}</div>
			<div class="space-y-1">
				{#each tooltipData as item}
					<div class="flex items-center text-xs">
						<span class="w-2 h-2 mr-2 rounded-full" style={`background-color:${item.color}`}></span>
						<span class="text-gray-600 mr-2">{item.name}:</span>
						<span class="font-medium text-gray-900">
							{#if item.isAbsolute}
								{formatNumber(item.value, { notation: 'compact' })}
							{:else}
								{d3.format('.1f')(item.value)}%
							{/if}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="mb-2">
		<span class="header-label">
			Data Period: {BASELINE_YEAR}–{YEARS[YEARS.length - 1] ?? '…'} (ACS 5-year estimates using 5-year
			intervals)
		</span>
	</div>

	<div class="w-full">
		<div bind:this={chartContainer} class="w-full min-h-[600px]" style="position: relative;">
			{#if loading}
				<p class="text-center text-neutral-500 py-24">Loading growth data...</p>
			{:else if dataTimeSeries.length === 0}
				<p class="text-center text-red-500 py-24">
					Failed to load time series data. Check console for fetch errors.
				</p>
			{/if}
		</div>
	</div>
</div>
<div class="source-label site-container--flush">
	Source: U.S. Census Bureau, American Community Survey (ACS), 5-year estimates, and IPUMS USA,
	University of Minnesota, www.ipums.org
</div>
