<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';
  import { formatNumber } from '$lib/utils';
  import { PALETTE } from '$lib/styles/palettes';
  import type { SeriesPoint } from 'd3';

  // 💡 IMPORTING REAL DATA FUNCTION (from user request)
  // Assuming the function returns an object containing the time series data,
  // the categorized group lists, and the list of available years.
  import { getAanhpiSubgroupsCombinedTimeSeries } from '$lib/data/acs'; 

  // ── Constants & Configuration ──────────────────────────────────────────
  
  const BASELINE_YEAR = 2010;
  const TOP_N = 8; 

  const HEIGHT = 450;
  const margin = { top: 20, right: 120, bottom: 40, left: 60 }; 

  // Colors are sliced from the palette. Using slice(1) to avoid the very lightest tone.
  const ASIAN_COLORS_SET = PALETTE.plum.slice(1, 1 + TOP_N); 
  const NHPI_COLORS_SET = PALETTE.ember.slice(1, 1 + TOP_N); 
  const ALL_CHART_COLORS = [...ASIAN_COLORS_SET, ...NHPI_COLORS_SET]; 
  
  const BASELINE_COLOR = PALETTE.gray[5];

  // ── Data Structures (Using the old type names for minimal change) ──────────
  type TimeSeriesData = Array<{ year: number; name: string; value: number }>;
  type LineGroupData = { name: string; isAsian: boolean; data: { year: number, value: number, display: number }[] };

  // ── State ────────────────────────────────────────────────────────────────
  
  // 💡 Data state variables (now populated by fetchData)
  let loading = true;
  let dataTimeSeries: TimeSeriesData = [];
  
  let ASIAN_GROUPS: string[] = [];
  let NHPI_GROUPS: string[] = [];
  let YEARS: number[] = [];

  // 💡 Reactive derivation of stack keys
  $: ALL_STACK_KEYS = [...ASIAN_GROUPS, ...NHPI_GROUPS];
  
  // EXPORTED: view is now controlled by the parent (+page.svelte) via TopBar
  export let view: 'combined' | 'asian' | 'nhpi' = 'combined'; 
  
  // measure remains internal as it depends on 'view'
  let measure: 'indexed' | 'count' = 'count'; 

  // BINDING: Card container is the parent element for relative positioning
  let cardContainer: HTMLDivElement; 
  let chartContainer: HTMLDivElement;
  let tooltipContainer: HTMLDivElement; // Reference to the tooltip div

  // State for Tooltip Content
  let tooltipYear: number | null = null;
  let tooltipData: Array<{ name: string, value: number, color: string, isAbsolute: boolean }> = [];
  let tooltipStyle = '';
  
  let ro: ResizeObserver | null = null;
  let roTimer: number | null = null;

  // ── Data Fetching ────────────────────────────────────────────────────────
  async function fetchData() {
    loading = true;
    try {
        // CALLING THE ACTUAL DATA UTILITY
        const { timeSeries, asianGroups, nhpiGroups, years } = await getAanhpiSubgroupsCombinedTimeSeries({ 
            topN: TOP_N, 
            minYear: BASELINE_YEAR 
        });

        // Set state
        dataTimeSeries = timeSeries;
        ASIAN_GROUPS = asianGroups;
        NHPI_GROUPS = nhpiGroups;
        YEARS = years;

    } catch (e) {
        console.error("Error fetching AANHPI time series data:", e);
        // In a real app, you might set an error message state here.
    } finally {
        loading = false;
        // The renderChart function is called after loading to ensure groups/years are set.
        window.setTimeout(renderChart, 10);
    }
  }


  // ── Data Processing for STACKED AREA (Combined View) ──────────────────────
  
  // Prepare data structure for D3's stack layout: array of objects keyed by year/subgroup.
  $: stackData = (() => {
      // Guard against running before data is loaded
      if (!YEARS.length) return []; 
      
      const dataForStack = [];
      d3.rollup(dataTimeSeries, 
          // Value accessor: create an object with {SubgroupName: PopulationValue} for each year
          v => Object.fromEntries(v.map(d => [d.name, d.value])), 
          // Key accessor: group by year
          d => d.year
      ).forEach((values, year) => {
          dataForStack.push({ year, ...values });
      });
      // Sort by year, crucial for time series charts
      return dataForStack.sort((a, b) => a.year - b.year);
  })();

  // Define the stack layout using all subgroup keys
  $: stack = d3.stack<any>()
      .keys(ALL_STACK_KEYS)
      // Use stackOrderNone to keep the order of ALL_STACK_KEYS (Asian groups first, then NHPI)
      .order(d3.stackOrderNone) 
      .offset(d3.stackOffsetNone); 
  
  $: stackedLayers = stack(stackData);


  // ── Data Processing for LINE CHART views ──────────────────────────────────
  
  // Processes data into lines for the Indexed or Subgroup Count views
  // NOTE: This now uses ASIAN_GROUPS and NHPI_GROUPS
  $: lineChartData = processLineData(dataTimeSeries, view, measure);
  
  function processLineData(data: TimeSeriesData, currentView: typeof view, currentMeasure: typeof measure): LineGroupData[] {
    // Only process for line chart views (Indexed or Subgroup Counts)
    if (currentView === 'combined' && currentMeasure === 'count') return []; 
    // Guard against running before groups are defined
    if (!ASIAN_GROUPS.length && !NHPI_GROUPS.length) return [];


    let filteredData = data;
    if (currentView === 'asian') {
      // 💡 Use the loaded ASIAN_GROUPS
      filteredData = data.filter(d => ASIAN_GROUPS.includes(d.name));
    } else if (currentView === 'nhpi') {
      // 💡 Use the loaded NHPI_GROUPS
      filteredData = data.filter(d => NHPI_GROUPS.includes(d.name));
    }
    
    // Group by subgroup name
    const groupedData = Array.from(d3.group(filteredData, d => d.name));

    const lineData = groupedData.map(([name, group]) => {
      const baselinePoint = group.find(d => d.year === BASELINE_YEAR);
      const baselineValue = baselinePoint ? baselinePoint.value : 0;
      
      const dataPoints = group.map(d => {
        let displayValue: number;
        
        if (currentMeasure === 'indexed' && baselineValue > 0) {
          displayValue = (d.value / baselineValue) * 100;
        } else {
          displayValue = d.value;
        }
        
        return {
          year: d.year,
          value: d.value, 
          display: displayValue 
        };
      });

      return {
        name,
        // 💡 Check against the loaded ASIAN_GROUPS
        isAsian: ASIAN_GROUPS.includes(name), 
        data: dataPoints
      };
    });
    
    lineData.sort((a, b) => 
        (b.data[b.data.length - 1]?.display || 0) - (a.data[a.data.length - 1]?.display || 0)
    );
    
    return lineData;
  }
  
  // ── Lifecycle and Resizing ──────────────────────────────────────────
  
  onMount(() => {
    fetchData(); // 💡 Start data fetching on mount
    
    ro = new ResizeObserver(() => {
      if (roTimer) window.clearTimeout(roTimer);
      roTimer = window.setTimeout(renderChart, 120);
    });
    // Check for cardContainer as well to observe the correct parent for width
    if (cardContainer) ro.observe(cardContainer); 
  });

  onDestroy(() => {
    ro?.disconnect();
    if (roTimer) window.clearTimeout(roTimer);
  });

  // Reactive triggers: re-render when view or measure changes
  $: view, renderChart();
  $: measure, renderChart();
  // 💡 Also re-render if the underlying data changes (e.g., after loading)
  $: YEARS, renderChart(); 
  $: dataTimeSeries, renderChart();

  // ── D3 Rendering Logic (Combined) ─────────────────────────────────────────
  
  function renderChart() {
    // 💡 Added check for YEARS array to ensure data is present
    if (loading || !chartContainer || !cardContainer || !YEARS.length) return; 

    // IMPORTANT: When view changes from 'combined' to 'asian'/'nhpi', 
    // we must ensure 'measure' is set to 'indexed' for those views.
    if (view !== 'combined' && measure === 'count') {
        measure = 'indexed';
    }
    // And when view changes back to 'combined', measure must be 'count'.
    if (view === 'combined' && measure === 'indexed') {
        measure = 'count';
    }

    const isStackedArea = view === 'combined' && measure === 'count';
    
    const width = cardContainer.clientWidth - (24 * 2); // Account for parent padding (p-6 = 24px)
    const height = HEIGHT - margin.top - margin.bottom;
    const innerWidth = width - margin.left - margin.right;
    
    d3.select(chartContainer).select('svg').remove();
    
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${HEIGHT}`)
        .attr('width', '100%')
        .attr('height', HEIGHT);
        
    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    // --- 1. Define Scales based on Chart Type ---
    
    const xScale = d3.scaleTime()
        // 💡 Use the loaded YEARS array
        .domain(d3.extent(YEARS, y => new Date(y, 0, 1)) as [Date, Date])
        .range([0, innerWidth]);

    let yMax: number, yMin: number;

    if (isStackedArea) {
      // Stacked Area: Y domain is 0 to total combined population max
      yMin = 0;
      // Calculate max value from the stacked layers
      yMax = d3.max(stackedLayers, layer => d3.max(layer, d => d[1])) || 1;
    } else {
      // Line Chart: Y domain based on subgroup data (indexed or raw count)
      const allValues = lineChartData.flatMap(d => d.data.map(p => p.display));
      yMin = measure === 'indexed' ? 95 : d3.min(allValues) || 0;
      yMax = d3.max(allValues) || 100;
    }
    
    const yScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .nice()
        .range([height, 0]);

    // --- 2. Gridlines ---
    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => '').ticks(5))
        .attr('stroke', '#ccc')
        .attr('stroke-opacity', 0.5);

    // --- 3. Rendering Chart Elements (Switch based on type) ---
    
    // Define the Stack Color Scale
    const stackColorScale = d3.scaleOrdinal<string>()
        .domain(ALL_STACK_KEYS)
        .range(ALL_CHART_COLORS);
        
    // Define the Line Color Scale (same as stack scale for consistency)
    const lineColorScale = d3.scaleOrdinal<string>()
        .domain(ALL_STACK_KEYS)
        .range(ALL_CHART_COLORS);

    if (isStackedArea) {
      // A) STACKED AREA CHART RENDERING
      
      const area = d3.area<SeriesPoint<any>>()
          .x(d => xScale(new Date(d.data.year, 0, 1)))
          .y0(d => yScale(d[0])) 
          .y1(d => yScale(d[1])); 

      g.selectAll('.stacked-area')
          .data(stackedLayers)
          .join('path')
          .attr('class', d => `stacked-area area-${d.key.replace(/\s/g, '-')}`)
          .attr('fill', d => stackColorScale(d.key))
          .attr('opacity', 0.85)
          .attr('d', area)
          .style('pointer-events', 'none'); // Disable direct path interaction for overlay

      // Add a simple legend (using the keys and colors)
      const legendData = ALL_STACK_KEYS.map(key => ({
          key,
          color: stackColorScale(key)
      })).reverse(); // Reverse for typical stacked chart legend order (top area first)

      svg.append('g')
          .attr('transform', `translate(${width - 110}, ${margin.top + 10})`)
          .selectAll('.legend-item')
          .data(legendData)
          .join('g')
          .attr('class', 'legend-item')
          .attr('transform', (d, i) => `translate(0, ${i * 20})`)
          .call(g => g.append('rect')
              .attr('width', 10).attr('height', 10).attr('fill', d => d.color).attr('rx', 2))
          .call(g => g.append('text')
              .attr('x', 15).attr('y', 9).text(d => d.key)
              .style('font-size', '11px').style('fill', '#374151'));

    } else {
      // B) INDEXED/SUBGROUP LINE CHART RENDERING
      
      const line = d3.line<LineGroupData['data'][0]>()
          .x(d => xScale(new Date(d.year, 0, 1)))
          .y(d => yScale(d.display));
          
      // 100 Baseline (for Indexed View)
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

      const lines = g.selectAll('.line-group')
          .data(lineChartData, d => d.name)
          .join('g')
          .attr('class', d => `line-group group-${d.isAsian ? 'asian' : 'nhpi'} group-${d.name.replace(/\s/g, '-')}`);

      lines.append('path')
          .attr('class', 'growth-line')
          .attr('d', d => line(d.data))
          .attr('fill', 'none')
          .attr('stroke', d => lineColorScale(d.name))
          .attr('stroke-width', 2.5)
          .style('pointer-events', 'none'); // Disable direct path interaction for overlay

      lines.append('text')
          .attr('class', 'end-label')
          .datum(d => ({ 
              name: d.name, 
              lastPoint: d.data[d.data.length - 1] 
          }))
          .attr('transform', d => `translate(${innerWidth}, ${yScale(d.lastPoint.display)})`)
          .attr('x', 5)
          .attr('dy', '0.35em')
          .style('font-size', '11px')
          .style('font-weight', 600)
          .style('fill', d => lineColorScale(d.name))
          .text(d => {
              const val = d.lastPoint.display;
              const formatted = measure === 'indexed' ? d3.format('.1f')(val) + '%' : formatNumber(val, { notation: 'compact' });
              return `${d.name} (${formatted})`;
          });
    }

    // --- 4. Axes ---
    g.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%Y')).ticks(d3.timeYear.every(2)));

    const yAxisFormat = isStackedArea || measure === 'count'
        ? d => formatNumber(d as number, { notation: 'compact' })
        : d3.format('.0f');
        
    g.append('g')
        .call(d3.axisLeft(yScale).tickFormat(yAxisFormat));
        
    // Y-Axis Label
    const yAxisText = isStackedArea 
      ? 'Disaggregated Population Count' 
      : (measure === 'count' ? 'Absolute Subgroup Count' : `Indexed Growth (${BASELINE_YEAR}=100)`);
      
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text(yAxisText);

    // ──────────────────────────────────────────
    // 5. INTERACTION (Hover Line and Tooltip)
    // ──────────────────────────────────────────
    
    // Create a bisector function to find the index of the closest year
    const bisectDate = d3.bisector((d: {year: number}) => d.year).right;

    // Focus group for the hover line and circles
    const focus = g.append('g')
        .attr('class', 'focus')
        .style('display', 'none');

    // Hover line
    focus.append('line')
        .attr('class', 'hover-line')
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', PALETTE.gray[6])
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');
        
    // For line charts, we need circles for each line.
    const hoverCircles = focus.selectAll('.hover-circle')
        .data(isStackedArea ? [] : lineChartData)
        .join('circle')
        .attr('class', 'hover-circle')
        .attr('r', 5)
        .attr('fill', d => lineColorScale(d.name))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);
    
    // Add a large overlay rectangle for capturing mouse events
    svg.append('rect')
        .attr('class', 'overlay')
        .attr('width', innerWidth)
        .attr('height', height)
        .attr('transform', `translate(${margin.left}, ${margin.top})`)
        .style('fill', 'none')
        .style('pointer-events', 'all')
        .on('mouseover', mouseover)
        .on('mousemove', mousemove)
        .on('mouseout', mouseout);

    function mouseover() {
        focus.style.display = null;
        tooltipContainer.style.opacity = '1';
    }

    function mouseout() {
        focus.style.display = 'none';
        tooltipContainer.style.opacity = '0';
        tooltipYear = null;
    }

    function mousemove(event: MouseEvent) {
        if (!cardContainer || !tooltipContainer) return;
        
        const cardRect = cardContainer.getBoundingClientRect(); 
        
        // 1. Calculate X position within the SVG's inner area
        const xPos = d3.pointer(event)[0] - margin.left; 
        const xDate = xScale.invert(xPos);

        // Find the closest year
        const dataSet = isStackedArea ? stackData : lineChartData.flatMap(d => d.data);
        if (dataSet.length === 0 || YEARS.length === 0) return; // 💡 Guard against no data
        
        const closestIndex = bisectDate(YEARS.map(y => ({year: y})), xDate.getFullYear(), 1);
        const d0 = YEARS[closestIndex - 1];
        const d1 = YEARS[closestIndex] || d0;
        const closestYear = (xDate.getFullYear() - d0) > (d1 - xDate.getFullYear()) ? d1 : d0;
        const xValue = xScale(new Date(closestYear, 0, 1));
        
        // 2. Move Hover Line
        focus.select('.hover-line').attr('transform', `translate(${xValue}, 0)`);
        
        // 3. Prepare Tooltip Data (Unchanged from before)
        tooltipYear = closestYear;
        const newTooltipData: typeof tooltipData = [];
        
        const totalValue = d3.sum(dataTimeSeries.filter(d => d.year === closestYear), d => d.value);

        if (isStackedArea) {
            const yearData = stackData.find(d => d.year === closestYear);
            if (!yearData) return;
            
            ALL_STACK_KEYS.forEach(key => {
                const value = yearData[key];
                if (value !== undefined) {
                    newTooltipData.push({
                        name: key,
                        value: value,
                        color: stackColorScale(key) as string,
                        isAbsolute: true
                    });
                }
            });
            newTooltipData.sort((a, b) => b.value - a.value);

            tooltipData = newTooltipData; // Reset before unshift
            tooltipData.unshift({ 
                name: 'Total Population', 
                value: totalValue, 
                color: PALETTE.gray[6], 
                isAbsolute: true 
            });

        } else {
            lineChartData.forEach(group => {
                const point = group.data.find(d => d.year === closestYear);
                if (point) {
                    newTooltipData.push({
                        name: group.name,
                        value: point.display,
                        color: lineColorScale(group.name) as string,
                        isAbsolute: measure === 'count'
                    });
                }
            });
            newTooltipData.sort((a, b) => b.value - a.value);
            tooltipData = newTooltipData; // Assign sorted data
            
            // Move hover circles
            focus.selectAll('.hover-circle').attr('transform', (d: LineGroupData) => {
                const point = d.data.find(p => p.year === closestYear);
                return `translate(${xValue}, ${point ? yScale(point.display) : 0})`;
            });
        }
        

        // 4. Position Tooltip (CORRECTED LOGIC)
        const tooltipWidth = tooltipContainer.clientWidth;
        const tooltipHeight = tooltipContainer.clientHeight;
        const offset = 15; // Offset from the cursor

        // Calculate mouse position relative to the top-left corner of the card container
        let left = event.clientX - cardRect.left + offset; 
        let top = event.clientY - cardRect.top + offset;   
        
        // Boundary check: flip left/right
        if (left + tooltipWidth + offset > cardRect.width) {
            left = event.clientX - cardRect.left - tooltipWidth - offset;
        }
        
        // Vertical boundary check: flip top/bottom
        if (top + tooltipHeight > cardRect.height) {
            top = event.clientY - cardRect.top - tooltipHeight - offset;
        }
        
        // Ensure the tooltip isn't completely off the left edge
        if (left < 0) {
            left = 5; 
        }


        tooltipStyle = `transform: translate(${left}px, ${top}px); opacity: 1;`;
    }
  }

</script>

<div 
    bind:this={cardContainer} 
    class="p-6 bg-white rounded-xl shadow-lg relative font-[Inter]"
>
    
    <!-- TOOLTIP Element (External to SVG for HTML styling) -->
    <div 
        bind:this={tooltipContainer}
        class="absolute z-50 p-3 bg-white border border-gray-300 rounded-lg shadow-xl pointer-events-none transition-opacity duration-100 whitespace-nowrap"
        style="{tooltipStyle}; opacity: 0;"
    >
        {#if tooltipYear}
            <div class="font-bold text-gray-800 mb-1 text-sm">{tooltipYear}</div>
            <div class="space-y-1">
                {#each tooltipData as item}
                    <div class="flex items-center text-xs">
                        <span class="w-2 h-2 mr-2 rounded-full" style="background-color: {item.color};"></span>
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
        
        <!-- HEADER ROW: Title removed, scope is now in TopBar -->
        <div class="flex items-center justify-end mb-4 gap-4">
            <!-- Space for title removed -->
        </div>

        <!-- CONTROL ROW: Info and Measure Toggle (Indexed/Count) -->
        <div class="flex items-center justify-between mb-4">
            <span class="text-sm text-neutral-600">
                Data Period: {BASELINE_YEAR}–{YEARS[YEARS.length - 1] ?? '...'}
            </span>
            
            <!-- Hide the toggle if in combined view (only absolute count is applicable) -->
            {#if view !== 'combined'}
                <div class="scope-segment">
                    <button 
                        class="seg-btn"
                        class:active={measure === 'indexed'}
                        aria-pressed={measure === 'indexed'}
                        on:click={() => measure = 'indexed'}
                    >Indexed Growth</button>
                    <button 
                        class="seg-btn"
                        class:active={measure === 'count'}
                        aria-pressed={measure === 'count'}
                        on:click={() => measure = 'count'}
                    >Absolute Count</button>
                </div>
            {/if}
        </div>
    </div>
    <!-- End of accent wrapper -->

    <!-- Chart Container -->
    <div class="w-full">
        <div bind:this={chartContainer} class="w-full min-h-[450px]">
            {#if loading}
                <p class="text-center text-neutral-500 py-24">Loading growth data...</p>
            {:else if dataTimeSeries.length === 0}
                <p class="text-center text-red-500 py-24">Failed to load time series data. Check console for fetch errors.</p>
            {/if}
        </div>
    </div>
</div>

<style>
/* Segmented control styles (retained for the internal Indexed/Count toggle) */
.scope-segment {
  position: relative;
  display: inline-flex;
  border: 1.5px solid var(--scope-accent); 
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 1px rgba(0,0,0,.04); 
  overflow: hidden;
}
.scope-segment::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow:
    inset 0 0 0 0.5px rgba(116, 46, 106, 0.12),
    inset 0 1px 0 rgba(255,255,255,0.7);
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
  box-shadow: inset 1px 0 0 rgba(116, 46, 106, 0.25);
}
.scope-segment .seg-btn:hover {
  background: var(--scope-accent-hover);
}
.scope-segment .seg-btn:focus-visible {
  outline: 0;
  box-shadow: inset 0 0 0 1.5px var(--scope-accent);
}
.scope-segment .seg-btn.active,
.scope-segment .seg-btn[aria-pressed="true"] {
  background: var(--scope-accent-bg); 
  color: var(--scope-accent);
  box-shadow: none;            
  border: 0;                   
}
.scope-segment .seg-btn + .seg-btn {
  box-shadow: inset 1px 0 0 rgba(116, 46, 106, 0.20);
}
</style>
