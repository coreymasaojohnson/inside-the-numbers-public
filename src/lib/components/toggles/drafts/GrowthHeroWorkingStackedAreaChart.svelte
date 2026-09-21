<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';
  import { formatNumber } from '$lib/utils';
  import { PALETTE } from '$lib/styles/palettes';
  import { getAanhpiSubgroupsCombinedTimeSeries } from '$lib/data/pums';

  // ── Config ───────────────────────────────────────────────────────────────
  const BASELINE_YEAR = 2011;
  const TOP_N = 8;
  const HEIGHT = 450;
  const margin = { top: 20, right: 120, bottom: 40, left: 60 };

  const ASIAN_COLORS_SET = PALETTE.plum.slice(1, 1 + TOP_N);
  const NHPI_COLORS_SET = PALETTE.ember.slice(1, 1 + TOP_N);
  const ALL_CHART_COLORS = [...ASIAN_COLORS_SET, ...NHPI_COLORS_SET];
  const BASELINE_COLOR = PALETTE.gray[5];

  // ── Types ────────────────────────────────────────────────────────────────
  type TimeSeriesData = Array<{ year: number; name: string; value: number }>;
  type LinePoint = { year: number; value: number; display: number };
  type LineGroupData = { name: string; isAsian: boolean; data: LinePoint[] };

  // ── State ────────────────────────────────────────────────────────────────
  export let view: 'combined' | 'asian' | 'nhpi' = 'combined';
  let measure: 'indexed' | 'count' = 'count';
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

  // ── Data Fetching ────────────────────────────────────────────────────────
  async function fetchData() {
    loading = true;
    try {
      const { timeSeries, asianGroups, nhpiGroups, years } =
        await getAanhpiSubgroupsCombinedTimeSeries({
          topN: TOP_N,
          minYear: BASELINE_YEAR
        });

      dataTimeSeries = Array.isArray(timeSeries) ? timeSeries : [];
      ASIAN_GROUPS = Array.isArray(asianGroups) ? asianGroups : [];
      NHPI_GROUPS = Array.isArray(nhpiGroups) ? nhpiGroups : [];
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

  // ── Stack prep (combined stacked area) ───────────────────────────────────
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

  $: stack = d3
    .stack<any>()
    .keys(ALL_STACK_KEYS)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  $: stackedLayers = stack(stackData);

  // ── Line prep (asian / nhpi views) ───────────────────────────────────────
  $: lineChartData = processLineData(dataTimeSeries, view, measure);

  function processLineData(
    data: TimeSeriesData,
    currentView: 'combined' | 'asian' | 'nhpi',
    currentMeasure: 'indexed' | 'count'
  ): LineGroupData[] {
    if (currentView === 'combined') return [];
    if (!ASIAN_GROUPS.length && !NHPI_GROUPS.length) return [];

    let filtered = data;
    if (currentView === 'asian') filtered = data.filter((d) => ASIAN_GROUPS.includes(d.name));
    if (currentView === 'nhpi') filtered = data.filter((d) => NHPI_GROUPS.includes(d.name));

    const grouped = Array.from(d3.group(filtered, (d) => d.name));
    const lines: LineGroupData[] = grouped.map(([name, grp]) => {
      const baseline = grp.find((d) => d.year === BASELINE_YEAR)?.value ?? 0;
      const points: LinePoint[] = grp
        .slice()
        .sort((a, b) => a.year - b.year)
        .map((d) => ({
          year: d.year,
          value: d.value,
          display: currentMeasure === 'indexed' && baseline > 0 ? (d.value / baseline) * 100 : d.value
        }));
      return { name, isAsian: ASIAN_GROUPS.includes(name), data: points };
    });

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

  $: view, renderChart();
  $: measure, renderChart();
  $: YEARS, renderChart();
  $: dataTimeSeries, renderChart();

  // ── Rendering ────────────────────────────────────────────────────────────
  function renderChart() {
    if (loading) return;
    if (!cardContainer || !chartContainer) return;
    if (!YEARS.length) return;

    if (view !== 'combined' && measure === 'count') measure = 'indexed';
    if (view === 'combined' && measure === 'indexed') measure = 'count';

    const isStackedArea = view === 'combined' && measure === 'count';
    const width = Math.max(320, cardContainer.clientWidth - 24 * 2);
    const height = HEIGHT - margin.top - margin.bottom;
    const innerWidth = Math.max(100, width - margin.left - margin.right);

    d3.select(chartContainer).select('svg').remove();

    const svg = d3
      .select(chartContainer)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${HEIGHT}`)
      .attr('width', '100%')
      .attr('height', HEIGHT);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleTime()
      .domain(d3.extent(YEARS, (y) => new Date(y, 0, 1)) as [Date, Date])
      .range([0, innerWidth]);

    let yMin: number, yMax: number;

    if (isStackedArea) {
      yMin = 0;
      yMax = d3.max(stackedLayers, (L) => d3.max(L, (d) => d[1])) || 1;
    } else {
      const all = lineChartData.flatMap((d) => d.data.map((p) => p.display));
      yMin = measure === 'indexed' ? 95 : Math.min(0, d3.min(all) ?? 0);
      yMax = d3.max(all) || (measure === 'indexed' ? 110 : 1);
    }

    const yScale = d3.scaleLinear().domain([yMin, yMax]).nice().range([height, 0]);

    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => '').ticks(5))
      .attr('stroke', '#ccc')
      .attr('stroke-opacity', 0.5);

    const colorScale = d3.scaleOrdinal<string>().domain(ALL_STACK_KEYS).range(ALL_CHART_COLORS);

    if (isStackedArea) {
      const area = d3
        .area<any>()
        .x((d) => xScale(new Date(d.data.year, 0, 1)))
        .y0((d) => yScale(d[0]))
        .y1((d) => yScale(d[1]));

      g.selectAll('.stacked-area')
        .data(stackedLayers, (d: any) => d?.key ?? '')
        .join('path')
        .attr('class', (d) => `stacked-area area-${String(d.key).replace(/\s/g, '-')}`)
        .attr('fill', (d) => colorScale(String(d.key)) as string)
        .attr('opacity', 0.85)
        .attr('d', (d: any) => area(d));

      const legendData = ALL_STACK_KEYS.map((k) => ({
        key: k,
        color: colorScale(k) as string
      })).reverse();

      const legend = svg
        .append('g')
        .attr('transform', `translate(${width - 110}, ${margin.top + 10})`);

      const item = legend
        .selectAll('.legend-item')
        .data(legendData, (d: any) => d.key)
        .join('g')
        .attr('class', 'legend-item')
        .attr('transform', (_d, i) => `translate(0, ${i * 20})`);

      item.append('rect').attr('width', 10).attr('height', 10).attr('fill', (d) => d.color).attr('rx', 2);
      item
        .append('text')
        .attr('x', 15)
        .attr('y', 9)
        .text((d) => d.key)
        .style('font-size', '11px')
        .style('fill', '#374151');
    } else {
      const line = d3
        .line<LinePoint>()
        .x((d) => xScale(new Date(d.year, 0, 1)))
        .y((d) => yScale(d.display));

      if (measure === 'indexed' && yScale(100) < height && yScale(100) > 0) {
        g.append('line')
          .attr('x1', 0)
          .attr('y1', yScale(100))
          .attr('x2', innerWidth)
          .attr('y2', yScale(100))
          .attr('stroke', BASELINE_COLOR)
          .attr('stroke-dasharray', '4,4')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.7);

        g.append('text')
          .attr('x', -margin.left + 5)
          .attr('y', yScale(100))
          .attr('dy', '-0.3em')
          .style('font-size', '10px')
          .style('fill', BASELINE_COLOR)
          .text(`${BASELINE_YEAR} Baseline (100)`);
      }

      const group = g
        .selectAll('.line-group')
        .data(lineChartData, (d: any) => d?.name ?? '')
        .join('g')
        .attr('class', (d) => `line-group group-${d.isAsian ? 'asian' : 'nhpi'} group-${d.name.replace(/\s/g, '-')}`);

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
          const formatted = measure === 'indexed' ? d3.format('.1f')(val) + '%' : formatNumber(val, { notation: 'compact' });
          return `${d.name} (${formatted})`;
        });
    }

    g.append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%Y')).ticks(d3.timeYear.every(2)));

    const yAxisFormat = isStackedArea || measure === 'count'
      ? (d: any) => formatNumber(Number(d) || 0, { notation: 'compact' })
      : d3.format('.0f');

    g.append('g').call(d3.axisLeft(yScale).tickFormat(yAxisFormat as any));

    const yLabel = isStackedArea
      ? 'Disaggregated Population Count'
      : measure === 'count'
        ? 'Absolute Subgroup Count'
        : `Indexed Growth (${BASELINE_YEAR}=100)`;

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
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
        const i = Math.min(yearsAsDates.length - 1, Math.max(0, bisect(yearsAsDates, xDate.getTime())));
        const d0 = yearsAsDates[Math.max(0, i - 1)];
        const d1 = yearsAsDates[i];
        const closest = d1 && xDate.getTime() - d0.getTime() > d1.getTime() - xDate.getTime() ? d1 : d0;
        const closestYear = closest.getFullYear();
        const xValue = xScale(closest);

        focus.select('.hover-line').attr('transform', `translate(${xValue},0)`);
        tooltipYear = closestYear;
        const arr: typeof tooltipData = [];

        if (isStackedArea) {
          const row: any = stackData.find((r: any) => r.year === closestYear) || {};
          let total = 0;
          ALL_STACK_KEYS.forEach((k) => {
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
                isAbsolute: measure === 'count'
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

<div bind:this={cardContainer} class="p-6 bg-white rounded-xl shadow-lg relative font-[Inter]">
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
                {formatNumber(item.value, { decimals: 0, notation: 'compact' })}
              {:else}
                {d3.format('.1f')(item.value)}%
              {/if}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div style="--scope-accent: {PALETTE.plum[7]}; --scope-accent-hover: {PALETTE.plum[3]}; --scope-accent-bg: {PALETTE.plum[0]};">
    <div class="flex items-center justify-between mb-4">
      <span class="text-sm text-neutral-600">
        Data Period: {BASELINE_YEAR}–{YEARS[YEARS.length - 1] ?? '…'}
      </span>
      {#if view !== 'combined'}
        <div class="scope-segment">
          <button
            class="seg-btn"
            class:active={measure === 'indexed'}
            aria-pressed={measure === 'indexed'}
            on:click={() => (measure = 'indexed')}
          >
            Indexed Growth
          </button>
          <button
            class="seg-btn"
            class:active={measure === 'count'}
            aria-pressed={measure === 'count'}
            on:click={() => (measure = 'count')}
          >
            Absolute Count
          </button>
        </div>
      {/if}
    </div>
  </div>

  <div class="w-full">
    <div bind:this={chartContainer} class="w-full min-h-[450px]">
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

<style>
  .scope-segment {
    position: relative;
    display: inline-flex;
    border: 1.5px solid var(--scope-accent);
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.04);
    overflow: hidden;
  }
  .scope-segment::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    box-shadow:
      inset 0 0 0 0.5px rgba(116, 46, 106, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }
  .scope-segment .seg-btn {
    appearance: none;
    background: #fff;
    border: 0;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    line-height: 1;
    text-transform: uppercase;
    color: #0f1111;
    cursor: pointer;
    transition: background-color 120ms ease-in-out, color 120ms ease-in-out, box-shadow 120ms ease-in-out;
  }
  .scope-segment .seg-btn + .seg-btn {
    box-shadow: inset 1px 0 0 rgba(116, 46, 106, 0.2);
  }
  .scope-segment .seg-btn:hover {
    background: var(--scope-accent-hover);
  }
  .scope-segment .seg-btn:focus-visible {
    outline: 0;
    box-shadow: inset 0 0 0 1.5px var(--scope-accent);
  }
  .scope-segment .seg-btn.active,
  .scope-segment .seg-btn[aria-pressed='true'] {
    background: var(--scope-accent-bg);
    color: var(--scope-accent);
    box-shadow: none;
    border: 0;
  }
</style>