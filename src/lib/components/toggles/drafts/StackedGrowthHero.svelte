<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';
  import { PALETTE } from '$lib/styles/palettes';
  import { formatNumber } from '$lib/utils';

  // ── Configuration & Constants ──────────────────────────────────────────
  
  const HEIGHT = 450;
  const margin = { top: 20, right: 10, bottom: 40, left: 60 }; 
  
  // Define colors for the two stacks using the defined palettes
  const ASIAN_COLOR = PALETTE.plum[5]; // Mid-tone plum for Asian
  const NHPI_COLOR = PALETTE.ember[5]; // Mid-tone ember for NHPI

  // ── Data Mocking (In a real app, this would be an API call) ────────────
  type StackDataRow = { year: number; asian: number; nhpi: number; total: number };
  
  const MOCK_YEARS = [2010, 2012, 2014, 2016, 2018, 2020, 2022];
  
  // Mock function to generate growing population data
  function generateMockData(): StackDataRow[] {
    let data: StackDataRow[] = [];
    let asianBase = 15_000_000;
    let nhpiBase = 1_500_000;

    MOCK_YEARS.forEach(year => {
      // Simulate steady, but different, annual growth rates
      const asianPop = Math.round(asianBase * Math.pow(1.025, year - 2010));
      const nhpiPop = Math.round(nhpiBase * Math.pow(1.035, year - 2010));
      
      data.push({
        year,
        asian: asianPop,
        nhpi: nhpiPop,
        total: asianPop + nhpiPop
      });
    });
    return data;
  }
  
  let rawData: StackDataRow[] = generateMockData();
  let loading = false;
  
  // ── D3 Data Prep ──────────────────────────────────────────────────────
  
  const keys = ['asian', 'nhpi'] as const;
  
  // Use d3.stack() to transform the flat data into layers for stacking
  $: stack = d3.stack<StackDataRow>().keys(keys)
    .order(d3.stackOrderReverse) // NHPI (smaller) on top of Asian (larger)
    .offset(d3.stackOffsetNone); 
  
  $: layers = stack(rawData);
  
  // ── Refs and Handlers ────────────────────────────────────────────────
  let chartContainer: HTMLDivElement;
  let ro: ResizeObserver | null = null;
  let roTimer: number | null = null;
  
  // ── Initial mount + resize observer ──────────────────────────────────────
  onMount(() => {
    // Start chart render on mount
    renderChart();
    
    // Setup responsive rendering on resize
    ro = new ResizeObserver(() => {
      if (roTimer) window.clearTimeout(roTimer);
      roTimer = window.setTimeout(renderChart, 120);
    });
    ro.observe(chartContainer);
  });

  onDestroy(() => {
    ro?.disconnect();
    if (roTimer) window.clearTimeout(roTimer);
  });

  // ── Tooltip Management ─────────────────────────────────────────────────
  let tooltip: HTMLDivElement | null = null;

  function ensureTooltip() {
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'stacked-growth-tooltip';
      document.body.appendChild(tooltip);
    }
  }

  function showTooltip(evt: PointerEvent, dataPoint: StackDataRow) {
    ensureTooltip();
    
    // Calculate AANHPI total for percentage context
    const total = dataPoint.total;
    const asianPct = ((dataPoint.asian / total) * 100).toFixed(1);
    const nhpiPct = ((dataPoint.nhpi / total) * 100).toFixed(1);

    tooltip!.style.display = 'block';
    tooltip!.innerHTML = `
        <div class="font-bold text-lg mb-1">Population in ${dataPoint.year}</div>
        <div class="flex justify-between items-center mb-1">
            <span class="text-plum-700 font-semibold mr-2 flex items-center">
                <span class="w-2 h-2 rounded-full mr-2" style="background-color:${ASIAN_COLOR};"></span> Asian:
            </span>
            <span class="font-mono text-sm">${formatNumber(dataPoint.asian)} (${asianPct}%)</span>
        </div>
        <div class="flex justify-between items-center">
            <span class="text-ember-700 font-semibold mr-2 flex items-center">
                <span class="w-2 h-2 rounded-full mr-2" style="background-color:${NHPI_COLOR};"></span> NHPI:
            </span>
            <span class="font-mono text-sm">${formatNumber(dataPoint.nhpi)} (${nhpiPct}%)</span>
        </div>
        <div class="mt-2 pt-2 border-t border-gray-200 flex justify-between">
            <span class="font-bold">AANHPI Total:</span>
            <span class="font-bold text-lg">${formatNumber(total)}</span>
        </div>
    `;
    moveTooltip(evt);
  }

  function moveTooltip(evt: PointerEvent) {
    if (!tooltip) return;
    tooltip.style.left = `${evt.clientX + 12}px`;
    tooltip.style.top  = `${evt.clientY + 12}px`;
  }

  function hideTooltip() { 
    if (tooltip) tooltip.style.display = 'none'; 
  }
  
  // ── D3 Rendering ──────────────────────────────────────────────────────────
  
  function renderChart() {
    if (loading || !chartContainer || !layers.length) return;

    const width = chartContainer.clientWidth;
    const height = HEIGHT - margin.top - margin.bottom;
    const innerWidth = width - margin.left - margin.right;
    
    d3.select(chartContainer).select('svg').remove();
    
    // 1. Scales
    const xScale = d3.scaleTime()
        .domain(d3.extent(MOCK_YEARS, y => new Date(y, 0, 1)) as [Date, Date])
        .range([0, innerWidth]);

    const yMax = d3.max(rawData, d => d.total) || 1;
    
    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .nice()
        .range([height, 0]);

    // 2. Area Generator
    // The key function tells d3.area which value to use for the y0 and y1 bounds
    const area = d3.area<d3.SeriesPoint<StackDataRow>>()
        .x(d => xScale(new Date(d.data.year, 0, 1)))
        .y0(d => yScale(d[0])) // Start of the band
        .y1(d => yScale(d[1])); // End of the band

    // 3. SVG Setup
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${HEIGHT}`)
        .attr('width', '100%')
        .attr('height', HEIGHT);
        
    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    // 4. Drawing Areas
    const colors = { asian: ASIAN_COLOR, nhpi: NHPI_COLOR };
    
    g.selectAll('.stacked-area')
        .data(layers)
        .join('path')
        .attr('class', d => `stacked-area area-${d.key}`)
        .attr('fill', d => colors[d.key as keyof typeof colors])
        .attr('opacity', 0.85)
        .attr('d', area);

    // 5. Gridlines
    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => '').ticks(5))
        .attr('stroke', '#ccc')
        .attr('stroke-opacity', 0.5);

    // 6. Axes
    g.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%Y')).ticks(d3.timeYear.every(2)));

    const yAxisFormat = d => formatNumber(d as number, { notation: 'compact' });
        
    g.append('g')
        .call(d3.axisLeft(yScale).tickFormat(yAxisFormat));
        
    // 7. Interactivity (Tooltips)
    // Create a rect overlay for interaction across the width
    const overlay = g.append('rect')
        .attr('class', 'overlay')
        .attr('width', innerWidth)
        .attr('height', height)
        .attr('fill', 'none')
        .attr('pointer-events', 'all')
        .on('pointerleave', () => hideTooltip());
        
    // Vertical line (cursor)
    const focusLine = g.append('line')
        .attr('stroke', '#111827')
        .attr('stroke-width', 1)
        .attr('opacity', 0)
        .attr('pointer-events', 'none')
        .attr('y1', 0)
        .attr('y2', height);

    // Helper to find the closest data point in time
    const bisect = d3.bisector((d: StackDataRow) => d.year).right;
    
    // Mouse interaction handler
    overlay.on('pointermove', function(event) {
        const [x, y] = d3.pointer(event);
        const date = xScale.invert(x);
        const year = date.getFullYear();

        // Find the index of the closest year in the data
        const i = bisect(rawData, year, 1);
        // Determine which data point is closer (i-1 or i)
        const d0 = rawData[i - 1];
        const d1 = rawData[i];
        
        let dataPoint = d0;
        if (d1) {
            dataPoint = (Math.abs(year - d0.year) < Math.abs(year - d1.year)) ? d0 : d1;
        }

        const xPos = xScale(new Date(dataPoint.year, 0, 1));

        focusLine.attr('transform', `translate(${xPos}, 0)`).attr('opacity', 1);
        
        showTooltip(event, dataPoint);
    });

    // 8. Legend
    const legend = svg.append('g')
        .attr('transform', `translate(${width - 150}, ${margin.top + 10})`);
        
    const legendData = [
        { key: 'Asian', color: ASIAN_COLOR },
        { key: 'NHPI', color: NHPI_COLOR }
    ];

    legend.selectAll('.legend-item')
        .data(legendData)
        .join('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${i * 20})`)
        .call(g => g.append('rect')
            .attr('width', 10).attr('height', 10).attr('fill', d => d.color).attr('rx', 2))
        .call(g => g.append('text')
            .attr('x', 15).attr('y', 9).text(d => d.key)
            .style('font-size', '12px').style('fill', '#374151'));
  }
</script>

<div class="p-6 bg-white rounded-xl shadow-lg">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h2 class="text-xl font-bold text-neutral-800">AANHPI Population Composition Over Time</h2>
        <div class="text-sm text-neutral-600">
            {MOCK_YEARS[0]}–{MOCK_YEARS[MOCK_YEARS.length - 1]}
        </div>
    </div>
    
    <div class="w-full">
        <div bind:this={chartContainer} class="w-full min-h-[450px]">
            {#if loading}
                <p class="text-center text-neutral-500 py-24">Loading data...</p>
            {:else if rawData.length === 0}
                <p class="text-center text-red-500 py-24">Failed to load time series data.</p>
            {/if}
        </div>
    </div>
</div>

<style>
    /* ===== Stacked Growth Tooltip ===== */
    :global(.stacked-growth-tooltip) {
        position: fixed;
        pointer-events: none;
        background: rgba(255, 255, 255, 0.97);
        border: 1px solid #e5e7eb;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 14px;
        color: #111827;
        box-shadow: 0 4px 12px rgba(0, 0, 0, .1);
        z-index: 50;
        display: none;
        min-width: 250px;
    }
</style>
