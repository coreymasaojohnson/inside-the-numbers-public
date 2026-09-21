<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { formatNumber } from '$lib/utils';
  import { PALETTE } from '$lib/styles/palettes';
  
  // Updated to use PUMS data
  import { getAanhpiSubgroupsCombinedTimeSeries } from '$lib/data/pums';

  // ── Constants ──────────────────────────────────────────────────────────
  const TOP_N = 10;
  const BASELINE_YEAR = 2009;
  
  // Use distinct color palettes for each family
  const ASIAN_COLORS = PALETTE.plum.slice(0, 10);
  const NHPI_COLORS = PALETTE.ember.slice(0, 10);
  
  // ── State ────────────────────────────────────────────────────────────────
  type Family = 'asian' | 'nhpi';
  let activeFamily: Family = 'asian';
  
  let allTimeSeries: Array<{ year: number; name: string; value: number }> = [];
  let asianGroups: string[] = [];
  let nhpiGroups: string[] = [];
  let years: number[] = [];
  
  let loading = false;
  let chartContainer: HTMLDivElement;
  
  const margin = { top: 20, right: 30, bottom: 50, left: 60 };

  // ── Data Fetch ──────────────────────────────────────────────────────────
  async function loadData() {
    loading = true;
    try {
      const result = await getAanhpiSubgroupsCombinedTimeSeries({ 
        topN: TOP_N, 
        minYear: BASELINE_YEAR 
      });
      
      allTimeSeries = result.timeSeries;
      asianGroups = result.asianGroups;
      nhpiGroups = result.nhpiGroups;
      years = result.years;
      
      console.log('CompositionHero data loaded:', {
        totalPoints: allTimeSeries.length,
        asianGroups: asianGroups.length,
        nhpiGroups: nhpiGroups.length,
        years
      });
    } catch (e) {
      console.error('CompositionHero data fetch failed:', e);
      allTimeSeries = [];
      asianGroups = [];
      nhpiGroups = [];
      years = [];
    } finally {
      loading = false;
      window.setTimeout(renderChart, 10);
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────
  function toggleFamily(family: Family) {
    activeFamily = family;
    renderChart();
  }

  // ── D3 Rendering ──────────────────────────────────────────────────────────
  function renderChart() {
    if (loading || !chartContainer || !allTimeSeries.length) return;

    // Filter data based on active family
    const activeGroups = activeFamily === 'asian' ? asianGroups : nhpiGroups;
    const filteredData = allTimeSeries.filter(d => activeGroups.includes(d.name));
    
    if (!filteredData.length) {
      console.warn('No data for active family:', activeFamily);
      return;
    }

    const width = chartContainer.clientWidth;
    const height = 400 - margin.top - margin.bottom;
    const innerWidth = width - margin.left - margin.right;
    
    // Cleanup previous chart
    d3.select(chartContainer).select('svg').remove();
    
    // 1. Prepare Data for Stacking
    // Extract all unique subgroup names for this family
    const keys = Array.from(new Set(filteredData.map(d => d.name))).sort();
    
    // Transform to format d3.stack expects: one object per year with all subgroups as properties
    const stackedData = years.map(year => {
      const obj: Record<string, number> = { year } as any;
      
      keys.forEach(key => {
        const dataPoint = filteredData.find(d => d.year === year && d.name === key);
        obj[key] = dataPoint ? dataPoint.value : 0;
      });
      
      return obj;
    });

    // 2. D3 Stack generator with expand offset (normalizes to 100%)
    const stack = d3.stack()
        .keys(keys)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetExpand); // This makes it 100% stacked
        
    const series = stack(stackedData);
    
    // 3. Scales and Color
    const xScale = d3.scaleTime()
        .domain(d3.extent(years, y => new Date(y, 0, 1)) as [Date, Date])
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, 1]) // 0 to 1 for normalized (100%) stacked area
        .range([height, 0]);

    const color = d3.scaleOrdinal<string, string>()
        .domain(keys)
        .range(activeFamily === 'asian' ? ASIAN_COLORS : NHPI_COLORS);

    // 4. Area generator
    const area = d3.area<d3.SeriesPoint<Record<string, number>>>()
        .x(d => xScale(new Date(d.data.year, 0, 1)))
        .y0(d => yScale(d[0]))
        .y1(d => yScale(d[1]));

    // 5. SVG Setup
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height + margin.top + margin.bottom}`)
        .attr('width', '100%')
        .attr('height', height + margin.top + margin.bottom);
        
    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    // 6. Render Stacked Areas
    const paths = g.selectAll('.area-path')
        .data(series)
        .join('path')
        .attr('class', 'area-path')
        .attr('fill', d => color(d.key))
        .attr('opacity', 0.85)
        .attr('d', area as any);

    // 7. Add text labels inside bands (for larger bands)
    g.selectAll('.band-label')
        .data(series)
        .join('text')
        .attr('class', 'band-label')
        .attr('x', innerWidth / 2) // Center horizontally
        .attr('y', d => {
          // Find the middle of the band at the center x position
          const midPoint = stackedData[Math.floor(stackedData.length / 2)];
          const y0 = yScale(d[Math.floor(d.length / 2)][0]);
          const y1 = yScale(d[Math.floor(d.length / 2)][1]);
          return (y0 + y1) / 2;
        })
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '11px')
        .style('font-weight', '600')
        .style('fill', '#fff')
        .style('text-shadow', '0 1px 2px rgba(0,0,0,0.4)')
        .style('pointer-events', 'none')
        .style('user-select', 'none')
        .text(d => {
          // Only show label if band is tall enough
          const midPoint = d[Math.floor(d.length / 2)];
          const height = yScale(midPoint[0]) - yScale(midPoint[1]);
          return height > 25 ? d.key : '';
        });

    // 8. Enhanced tooltip on hover
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
        
        // Build tooltip content
        const tooltipHTML = `
          <div style="font-weight: 600; margin-bottom: 4px; color: #111827;">${d.key}</div>
          ${years.map(year => {
            const dataPoint = stackedData.find((dp: any) => dp.year === year);
            const value = dataPoint ? dataPoint[d.key] : 0;
            const total = years.map(y => {
              const dp = stackedData.find((x: any) => x.year === y);
              return keys.reduce((sum, k) => sum + (dp?.[k] || 0), 0);
            }).find((_, i) => years[i] === year) || 1;
            const pct = ((value / total) * 100).toFixed(1);
            return `<div style="color: #6b7280;"><strong>${year}:</strong> ${pct}%</div>`;
          }).join('')}
        `;
        
        tooltip
          .html(tooltipHTML)
          .style('opacity', 1);
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

    // Cleanup function for tooltip
    svg.on('remove', () => tooltip.remove());

    // 9. X-Axis - Show all 3 time points explicitly
    g.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(
          d3.axisBottom(xScale)
            .tickFormat(d3.timeFormat('%Y'))
            .tickValues(years.map(y => new Date(y, 0, 1)))
        );
        
    // X-axis label
    g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', height + 40)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('fill', '#6b7280')
        .text('Non-overlapping 5-year ACS periods');

    // 8. Y-Axis (Percentage)
    g.append('g')
        .call(d3.axisLeft(yScale).tickFormat(d => d3.format('.0%')(d)));
        
    // Y-axis label
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 15)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .style('fill', '#374151')
        .text('Population Share (%)');
        
    // 9. Legend (wrap to multiple rows if needed)
    const legend = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${height + margin.top + margin.bottom - 10})`);
        
    let xOffset = 0;
    let yOffset = 0;
    const maxLineWidth = innerWidth * 0.9;
    
    // Reverse so largest items appear first
    const legendKeys = [...keys].reverse();
    
    legendKeys.forEach((key, i) => {
      const textWidth = key.length * 6 + 25; // Estimate
      
      // Wrap to next line if needed
      if (xOffset + textWidth > maxLineWidth && xOffset > 0) {
        xOffset = 0;
        yOffset += 15;
      }
      
      const item = legend.append('g')
        .attr('transform', `translate(${xOffset}, ${yOffset})`);
        
      item.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .attr('rx', 2)
        .attr('fill', color(key));

      item.append('text')
        .attr('x', 14)
        .attr('y', 9)
        .attr('font-size', 10)
        .attr('fill', '#4b5563')
        .text(key);
        
      xOffset += textWidth;
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────
  onMount(() => {
    loadData(); 
    
    let resizeTimer: number;
    const handleResize = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(renderChart, 120);
    };

    window.addEventListener('resize', handleResize);
    return () => {
        window.removeEventListener('resize', handleResize);
        window.clearTimeout(resizeTimer);
    };
  });
</script>

<div class="p-6 bg-white rounded-xl shadow-lg">
  <div class="flex items-center justify-between mb-4">
    <div>
      <span class="text-xs text-neutral-600">
        Non-overlapping 5-year ACS periods: {BASELINE_YEAR}–{years[years.length - 1] || '2019'}
      </span>
    </div>
    <div class="flex gap-2">
      <button 
        class="family-btn" 
        class:is-active={activeFamily === 'asian'} 
        on:click={() => toggleFamily('asian')}
      >
        Asian Subgroups
      </button>
      <button 
        class="family-btn" 
        class:is-active={activeFamily === 'nhpi'} 
        on:click={() => toggleFamily('nhpi')}
      >
        NHPI Subgroups
      </button>
    </div>
  </div>

  <div bind:this={chartContainer} class="w-full min-h-[400px]">
    {#if loading}
      <p class="text-center text-neutral-500 py-12">Loading composition data...</p>
    {:else if allTimeSeries.length === 0}
      <p class="text-center text-red-500 py-12">Failed to load composition data. Check console.</p>
    {/if}
  </div>
</div>

<style>
  .family-btn {
    appearance: none;
    padding: 6px 12px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
    border: 1.5px solid #e5e7eb;
    background: #fff;
    cursor: pointer;
    color: #6b7280;
    transition: all .15s;
    border-radius: 6px;
  }
  
  .family-btn:hover { 
    background: #f9fafb;
    border-color: #d1d5db;
  }
  
  .family-btn.is-active {
    border-color: #742e6a;
    color: #742e6a;
    background: #fae9f4;
  }
  
  .family-btn:focus-visible {
    outline: 2px solid #742e6a;
    outline-offset: 2px;
  }
</style>