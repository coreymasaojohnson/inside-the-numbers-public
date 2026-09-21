<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { formatNumber } from '$lib/utils';
  import { PALETTE } from '$lib/styles/palettes';
  import { 
      getAanhpiTotals_US_TimeSeries, 
      // Mocking the new required subgroup fetch functions for future use
      // getAsianSubgroups_US_TimeSeries, 
      // getNhpiSubgroups_US_TimeSeries,
      type AanhpiTotalsRow,
      // type TreemapRow 
  } from '$lib/data/acs';

  // ── Constants ──────────────────────────────────────────────────────────
  
  // Colors for visualization consistency (Plum for Asian, lighter for NHPI for stacked area)
  // Design memo: Asian -> plum-6, NHPI -> plum-4.
  const COLOR_ASIAN = PALETTE.plum[6]; // Darker plum for the top area
  const COLOR_NHPI = PALETTE.plum[4];  // Lighter plum for the bottom area
  
  // Keys to use for the stacked area chart (NHPI first so it's on the bottom)
  const STACK_KEYS: Array<'nhpi' | 'asian'> = ['nhpi', 'asian'];
  
  // ── D3 Configuration ──────────────────────────────────────────────────
  const margin = { top: 20, right: 30, bottom: 40, left: 60 };
  
  // ── State ────────────────────────────────────────────────────────────────
  
  // View state: 'totals', 'asian', 'nhpi' (Default: totals)
  let view: 'totals' | 'asian' | 'nhpi' = 'totals'; 
  
  // Measure state: 'count' or 'percent' (Default: count)
  let measure: 'count' | 'percent' = 'count';

  let tsData: AanhpiTotalsRow[] = []; // Data for the Totals view
  let loading = false;
  let chartContainer: HTMLDivElement;

  // ── Reactive Data ────────────────────────────────────────────────
  
  // Total of the latest year for display
  $: currentYearTotal = tsData.length > 0 ? tsData[tsData.length - 1].aanhpi : 0;
  
  // ── Data Fetch ──────────────────────────────────────────────────────────
  async function loadData() {
    loading = true;
    try {
      if (view === 'totals') {
        // Only fetching totals data for now
        tsData = await getAanhpiTotals_US_TimeSeries();
      } else if (view === 'asian') {
        // TODO: Future implementation for Asian subgroups
        tsData = []; 
        // Example: const result = await getAsianSubgroups_US_TimeSeries();
      } else if (view === 'nhpi') {
        // TODO: Future implementation for NHPI subgroups
        tsData = [];
        // Example: const result = await getNhpiSubgroups_US_TimeSeries();
      }
    } catch (e) {
      console.error('GrowthHero data fetch failed:', e);
      tsData = [];
    } finally {
      loading = false;
      window.setTimeout(renderChart, 10);
    }
  }

  // Reactive trigger: re-load data and re-render chart whenever view or measure changes
  $: view, loadData();
  $: measure, renderChart();

  // ── D3 Rendering ──────────────────────────────────────────────────────────
  
  function renderChart() {
    if (loading || !chartContainer || !tsData.length || view !== 'totals') return;

    // Filter out rows where total is zero (e.g., if data only covers a single year)
    const data = tsData.filter(d => d.aanhpi > 0);
    if (!data.length) return;

    const width = chartContainer.clientWidth;
    const height = 400 - margin.top - margin.bottom;
    const innerWidth = width - margin.left - margin.right;
    
    d3.select(chartContainer).select('svg').remove();

    // 1. D3 Stack Generator
    const stack = d3.stack()
        .keys(STACK_KEYS)
        // Use d3.stackOffsetExpand for % view, d3.stackOffsetNone for Count view
        .offset(measure === 'percent' ? d3.stackOffsetExpand : d3.stackOffsetNone);

    const stackedData = stack(data);

    // 2. Scales
    const xScale = d3.scaleTime()
        .domain(d3.extent(data, d => new Date(d.year, 0, 1)) as [Date, Date])
        .range([0, innerWidth]);

    let yMax: number;
    if (measure === 'percent') {
        // Y-Max is always 1 (100%) for stacked expand
        yMax = 1;
    } else {
        // Y-Max is the maximum of the AANHPI total (which is the top of the stack)
        const totalLine = stackedData.find(d => d.key === 'asian');
        yMax = d3.max(totalLine, d => d[1]) || 1;
    }
    
    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .nice()
        .range([height, 0]);

    // 3. Area Generator
    const area = d3.area<{ data: AanhpiTotalsRow, [0]: number, [1]: number }>()
        .x(d => xScale(new Date(d.data.year, 0, 1)))
        .y0(d => yScale(d[0]))
        .y1(d => yScale(d[1]));
        
    // 4. SVG Setup
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height + margin.top + margin.bottom}`)
        .attr('width', '100%')
        .attr('height', height + margin.top + margin.bottom);
        
    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    // 5. Drawing Areas
    g.selectAll('.area-path')
        .data(stackedData)
        .join('path')
        .attr('class', d => `area-path area-${d.key}`)
        .attr('d', area)
        .attr('fill', d => d.key === 'asian' ? COLOR_ASIAN : COLOR_NHPI)
        .attr('opacity', 0.8)
        .style('stroke', '#fff')
        .style('stroke-width', 0.5);

    // 6. X-Axis (Time)
    g.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%Y')));

    // 7. Y-Axis (Count or Percent)
    const yAxisFormat = measure === 'percent' 
        ? d3.format('.0%') 
        : d => formatNumber(d as number, { notation: 'compact' });
        
    g.append('g')
        .call(d3.axisLeft(yScale).tickFormat(yAxisFormat));

    // 8. Gridlines
    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => '').ticks(5))
        .attr('stroke', '#ccc')
        .attr('stroke-opacity', 0.5);

    // 9. Legend / Labels
    const legendData = [
        { key: 'asian', label: 'Asian', color: COLOR_ASIAN },
        { key: 'nhpi', label: 'NHPI', color: COLOR_NHPI },
    ];

    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width - 150}, ${margin.top - 10})`);
        
    legend.selectAll('rect')
        .data(legendData)
        .join('rect')
        .attr('x', (d, i) => i * 70)
        .attr('y', 0)
        .attr('width', 10)
        .attr('height', 10)
        .attr('fill', d => d.color);

    legend.selectAll('text')
        .data(legendData)
        .join('text')
        .attr('x', (d, i) => i * 70 + 15)
        .attr('y', 9)
        .style('font-size', '10px')
        .text(d => d.label);

    // TODO: Implement Tooltip for sophistication

  }

</script>

<div class="p-6 bg-white rounded-xl shadow-lg">
    <!-- View/Tab Controls -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h2 class="text-xl font-bold text-neutral-800">Population Growth Over Time</h2>
        
        <div class="flex space-x-2 bg-neutral-100 p-1 rounded-lg">
            <button 
                class="px-3 py-1 text-sm font-semibold rounded-md transition-colors"
                class:bg-white={view === 'totals'}
                class:text-plum-700={view === 'totals'}
                class:text-neutral-500={view !== 'totals'}
                on:click={() => view = 'totals'}
            >Totals (AANHPI)</button>
            <button 
                class="px-3 py-1 text-sm font-semibold rounded-md transition-colors"
                class:bg-white={view === 'asian'}
                class:text-plum-700={view === 'asian'}
                class:text-neutral-500={view !== 'asian'}
                on:click={() => view = 'asian'}
            >Asian Subgroups</button>
            <button 
                class="px-3 py-1 text-sm font-semibold rounded-md transition-colors"
                class:bg-white={view === 'nhpi'}
                class:text-plum-700={view === 'nhpi'}
                class:text-neutral-500={view !== 'nhpi'}
                on:click={() => view = 'nhpi'}
            >NHPI Subgroups</button>
        </div>
    </div>

    <!-- Measure Controls (Only visible for Totals view currently) -->
    {#if view === 'totals'}
        <div class="flex items-center justify-between mb-4">
            <span class="text-sm text-neutral-600">
                AANHPI Total Population (National, ACS 1-yr, {tsData.length ? `${tsData[0].year}–${tsData[tsData.length - 1].year}` : '—'}):
            </span>
            <div class="flex space-x-2 bg-neutral-100 p-1 rounded-lg">
                <button 
                    class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
                    class:bg-white={measure === 'count'}
                    class:text-neutral-800={measure === 'count'}
                    class:text-neutral-500={measure !== 'count'}
                    on:click={() => measure = 'count'}
                >Count</button>
                <button 
                    class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
                    class:bg-white={measure === 'percent'}
                    class:text-neutral-800={measure === 'percent'}
                    class:text-neutral-500={measure !== 'percent'}
                    on:click={() => measure = 'percent'}
                >% of AANHPI</button>
            </div>
        </div>
    {/if}

    <!-- Chart Container -->
    <div class="w-full">
        {#if view === 'totals'}
            <div class="mb-2">
                <span class="text-lg text-neutral-800 font-bold">
                    Total Population: {formatNumber(currentYearTotal)}
                </span>
            </div>
            <div bind:this={chartContainer} class="w-full min-h-[400px]">
                {#if loading}
                    <p class="text-center text-neutral-500 py-24">Loading growth data...</p>
                {:else if tsData.length === 0}
                    <p class="text-center text-red-500 py-24">Failed to load growth data or data is unavailable for this time range.</p>
                {/if}
            </div>
        {:else}
            <!-- Placeholder for Subgroup Views -->
            <div class="w-full min-h-[400px] flex items-center justify-center bg-neutral-50 rounded-lg">
                <p class="text-neutral-500 p-8 text-center">
                    Subgroup trend visualization coming soon for the {view === 'asian' ? 'Asian' : 'NHPI'} family.
                </p>
            </div>
        {/if}
    </div>
</div>

<style>
/* Utility classes for Tailwind-like custom colors */
.text-plum-700 { color: #742e6a; } /* plum[6] */
</style>
