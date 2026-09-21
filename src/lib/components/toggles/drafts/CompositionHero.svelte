<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';
  import { PALETTE } from '$lib/styles/palettes';
  import { formatNumber } from '$lib/utils';
  import { getAanhpiSubgroupsCombinedTimeSeries } from '$lib/data/pums';

  // ── Props (controlled by TopBar/parent) ─────────────────────────────────
  export let family: 'asian' | 'nhpi' = 'asian';   // <-- parent passes this

  // ── Constants ───────────────────────────────────────────────────────────
  const TOP_N = 10;
  const BASELINE_YEAR = 2009; // first 5-yr block; your data loader will return the list

  const ASIAN_COLORS = PALETTE.plum.slice(0, TOP_N);
  const NHPI_COLORS  = [
    PALETTE.ember[0],  // Lightest
    PALETTE.ember[2],
    PALETTE.ember[3],
    PALETTE.ember[4],
    PALETTE.ember[5],
    PALETTE.ember[6],
    PALETTE.ember[7],
    PALETTE.ember[1],  // Back to light
    '#D84315',         // Fallback: distinct orange-red
    '#BF360C'          // Fallback: darker orange-red
  ];

  // ── State ───────────────────────────────────────────────────────────────
  type Row = { year: number; name: string; value: number };

  let allTimeSeries: Row[] = [];
  let asianGroups: string[] = [];
  let nhpiGroups: string[] = [];
  let years: number[] = [];

  let loading = false;
  let error: string | null = null;

  let container: HTMLDivElement | null = null;
  let ro: ResizeObserver | null = null;
  let roTimer: number | null = null;

  const margin = { top: 6, right: 140, bottom: 42, left: 48 }; // increased right margin for external labels

  // ── Data Fetch ──────────────────────────────────────────────────────────
  async function loadData() {
    loading = true;
    error = null;
    try {
      const { timeSeries, asianGroups: A, nhpiGroups: N, years: Y } =
        await getAanhpiSubgroupsCombinedTimeSeries({ topN: TOP_N, minYear: BASELINE_YEAR });

      allTimeSeries = timeSeries ?? [];
      asianGroups = A ?? [];
      nhpiGroups = N ?? [];
      years = (Y ?? []).slice().sort((a, b) => a - b);
    } catch (e: any) {
      console.error('CompositionHero fetch failed:', e);
      error = e?.message || 'Failed to load data';
      allTimeSeries = [];
      asianGroups = [];
      nhpiGroups = [];
      years = [];
    } finally {
      loading = false;
      if (typeof window !== 'undefined') requestAnimationFrame(render);
      else render();
    }
  }

  // Re-render when family changes
  $: family, render();

  // ── Lifecycle / Resize ──────────────────────────────────────────────────
  onMount(() => {
    loadData();

    if (typeof ResizeObserver !== 'undefined' && container) {
      ro = new ResizeObserver(() => {
        if (roTimer) window.clearTimeout(roTimer);
        roTimer = window.setTimeout(render, 120);
      });
      ro.observe(container);
    }
  });

  onDestroy(() => {
    ro?.disconnect();
    if (roTimer) window.clearTimeout(roTimer);
  });

  // ── Render ──────────────────────────────────────────────────────────────
  function render() {
    if (!container || loading || !years.length) return;

    const activeGroups = family === 'asian' ? asianGroups : nhpiGroups;
    const filtered = allTimeSeries.filter(d => activeGroups.includes(d.name));
    if (!filtered.length) {
      d3.select(container).select('svg').remove();
      return;
    }

    const width = container.clientWidth || 800;
    const height = 520; // increased by ~37% for better visibility of bands and labels
    const innerW = Math.max(200, width - margin.left - margin.right);
    const innerH = Math.max(180, height - margin.top - margin.bottom);

    // Clean previous
    const root = d3.select(container);
    root.select('svg').remove();

    // Prepare stacked (normalized to 100%)
    const keys = Array.from(new Set(filtered.map(d => d.name))).sort();
    const rows = years.map((year) => {
      const row: Record<string, number> & { year: number } = { year } as any;
      keys.forEach(k => {
        row[k] = filtered.find(d => d.year === year && d.name === k)?.value ?? 0;
      });
      return row;
    });

    const stack = d3.stack<any>()
      .keys(keys)
      .order(d3.stackOrderInsideOut)  // Spreads small bands throughout instead of grouping at edges
      .offset(d3.stackOffsetExpand);

    const series = stack(rows);

    const x = d3.scaleTime()
      .domain(d3.extent(years, y => new Date(y, 0, 1)) as [Date, Date])
      .range([0, innerW]);

    const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

    const color = d3.scaleOrdinal<string, string>()
      .domain(keys)
      .range(family === 'asian' ? ASIAN_COLORS : NHPI_COLORS);

    const area = d3.area<d3.SeriesPoint<any>>()
      .x(d => x(new Date(d.data.year, 0, 1)))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]));

    // SVG (no extra padding/border)
    const svg = root.append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('display', 'block')     // no inline gaps
      .style('background', 'transparent'); // ensure no white card look

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Areas
    const paths = g.selectAll('.area-path')
      .data(series, (d: any) => d.key)
      .join('path')
      .attr('class', 'area-path')
      .attr('fill', d => color(d.key))
      .attr('opacity', 0.85)
      .attr('d', area as any);

    // External labels for ALL bands
    const externalGroup = g.selectAll('.external-label-group')
      .data(series)
      .join('g')
      .attr('class', 'external-label-group');

    externalGroup.each(function(d) {
      const group = d3.select(this);
      const midIdx = Math.floor(d.length / 2);
      const y0 = y(d[midIdx][0]);
      const y1 = y(d[midIdx][1]);
      const midY = (y0 + y1) / 2;

      // Leader line from right edge of chart to label
      group.append('line')
        .attr('x1', innerW)
        .attr('y1', midY)
        .attr('x2', innerW + 8)
        .attr('y2', midY)
        .attr('stroke', color(d.key))
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.7);

      // Label text
      group.append('text')
        .attr('x', innerW + 12)
        .attr('y', midY)
        .attr('dominant-baseline', 'middle')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .style('fill', color(d.key))
        .text(d.key);
    });

    // Tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'composition-tooltip')
      .style('position', 'absolute')
      .style('background', 'white')
      .style('border', '1px solid #d1d5db')
      .style('border-radius', '6px')
      .style('padding', '8px 12px')
      .style('font-size', '12px')
      .style('box-shadow', '0 4px 6px rgba(0,0,0,0.1)')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);

    paths
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 1);
        
        // Calculate percentages for each year
        const yearPercentages = years.map(year => {
          const dataPoint = rows.find((r: any) => r.year === year);
          const value = dataPoint ? dataPoint[d.key] : 0;
          const total = keys.reduce((sum, k) => sum + (dataPoint?.[k] || 0), 0);
          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
          return `${year} (${pct}%)`;
        }).join('; ');
        
        const tooltipHTML = `
          <div style="font-weight: 600; margin-bottom: 4px; color: #111827;">${d.key}</div>
          <div style="color: #6b7280; font-size: 11px;">${yearPercentages}</div>
        `;
        
        tooltip.html(tooltipHTML).style('opacity', 1);
      })
      .on('mousemove', function(event) {
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 0.85);
        tooltip.style('opacity', 0);
      });

    // Cleanup tooltip on chart removal
    svg.on('remove', () => tooltip.remove());

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3.axisBottom(x)
          .tickFormat(d3.timeFormat('%Y'))
          .tickValues(years.map(y => new Date(y, 0, 1)))
      );

    g.append('g').call(d3.axisLeft(y).tickFormat(d => d3.format('.0%')(Number(d))));

    // Axis labels (compact)
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 34)
      .attr('text-anchor', 'middle')
      .attr('class', 'axis-note')
      .text('Non-overlapping 5-year ACS periods');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2)
      .attr('y', -margin.left + 14)
      .attr('text-anchor', 'middle')
      .attr('class', 'axis-note')
      .text('Population Share (%)');
  }
</script>

<!-- Header line only (no padded card) -->
<div class="meta-line">
  <span class="meta">
    Non-overlapping 5-year ACS periods: {BASELINE_YEAR}–{years[years.length - 1] || '…'}
  </span>
  <!-- No buttons here; TopBar controls the family prop -->
</div>

<div bind:this={container} class="chart-root">
  {#if loading}
    <p class="loading">Loading composition data…</p>
  {:else if error}
    <p class="error">Error: {error}</p>
  {/if}
</div>

<style>
  .chart-root { width: 100%; min-height: 520px; }
  .meta-line {
    display: flex; align-items: center; justify-content: space-between;
    margin: 0 0 6px 0;
  }
  .meta { font-size: .8rem; color: #64748b; }
  .loading, .error { text-align: center; color: #6b7280; padding: 2rem 0; }
  .axis-note { font-size: 11px; fill: #6b7280; }
</style>