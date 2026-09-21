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

  const populationTypeLabel = 'Foreign-born';

  // ── Local state ──────────────────────────────────────────────────────────
  let data: { name: string; value: number }[] = [];
  let loading = false;
  let error: string | null = null;
  let mounted = false; // <-- CRITICAL FIX: New state to track client-side rendering

  // ── Internals ────────────────────────────────────────────────────────────
  let container: HTMLDivElement | null = null;
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  let ro: ResizeObserver | null = null;
  let roRaf = 0; // rAF debounce for ResizeObserver (replaces roTimer)

  // Color scales
  const asianColors = d3.scaleOrdinal<string, string>().range(PALETTE.plum);
  const nhpiColors  = d3.scaleOrdinal<string, string>().range(PALETTE.ember);

  // derived total
  $: total = (data ?? []).reduce((s, d) => s + (d.value || 0), 0);

  // ── NHPI detection helper ───────────────────────────────────────────────
  function isNhpiGroup(name: string): boolean {
    const lower = name.toLowerCase();
    const nhpiKeywords = [
      'hawaiian','samoan','guamanian','chamorro','tongan',
      'fijian','micronesian','polynesian','melanesian',
      'pacific','nhpi','marshallese','palauan','chuuk','chuukese','marshall'
    ];
    return nhpiKeywords.some(k => lower.includes(k));
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
      // CRITICAL: This fetch call is what causes the SSR error if called too early
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
      // If the error is an SSR relative fetch error, this will be caught here
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
    const pad = 12, colGap = 16, rowGap = 8, sw = 12, fh = 12;
    // Simple text width estimate (can be refined but usually sufficient for layout)
    const measure = (text: string) => text.length * 7; 
    const maxLine = width - (2 * pad);

    let x = 0, y = 0;
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
    mounted = true; // <-- CRITICAL FIX: Set mounted flag here
    
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
  });

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    if (!container) return;

    const width = container.clientWidth || 800;
    const treemapHeight = Math.max(340, Math.round(width * 0.55));
    const legendHeight = showLegend ? getLegendHeight(width) : 0;
    // 20px gap is included
    const totalHeight = treemapHeight + legendHeight + (showLegend ? 20 : 0); 

    // ✅ FIX: Pre-allocate height to avoid container collapse (prevents scroll jump)
    (container as HTMLDivElement).style.minHeight = `${totalHeight}px`;

    // ✅ FIX: Create SVG once; reuse it on subsequent renders (no remove/append)
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
        .style('display', 'block')
        .style('opacity', 0); // Start hidden for transition

      // Base groups we can clear without nuking the svg (faster, less layout churn)
      svg.append('g').attr('class', 'nodes');
      svg.append('g').attr('class', 'legend');
    }

    // Always update SVG dimensions
    svg
      .attr('viewBox', `0 0 ${width} ${totalHeight}`)
      .attr('width', width)
      .attr('height', totalHeight);

    // Clear layers instead of re-creating the entire SVG
    svg.select('.nodes').selectAll('*').remove();
    svg.select('.legend').selectAll('*').remove();

    // Empty / loading states
    if (!data?.length) {
      svg
        .select('.nodes')
        .append('text')
        .attr('x', width / 2)
        .attr('y', treemapHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', 14)
        .attr('fill', '#6b7280')
        .text(loading ? 'Loading…' : (error ? `Error: ${error}` : 'No data'));

      // Fade in only the first time to avoid blocking interactivity
      if (Number(svg.style('opacity')) < 1) svg.style('opacity', 1);
      return;
    }

    // Build treemap
    const root = d3.hierarchy<{ children: typeof data }>({ children: data }).sum((d: any) => d.value);
    d3.treemap<{ children: typeof data }>()
      .tile(d3.treemapSquarify)
      .paddingInner(2)
      .size([width, treemapHeight])(root as any);

    const leaves = root.leaves();
    const grand = root.value || 1;

    // Draw Nodes (The core treemap rects)
    const nodes = svg
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

    // Tooltips are now instant because they rely on the <title> tag on the rects
    nodes
      .append('title')
      .text((d: any) => {
        const pct = ((d.value || 0) / grand) * 100;
        return `${d.data.name}: ${formatNumber(d.data.value)} (${pct.toFixed(1)}%)`;
      });

    const label = nodes.append('g').attr('class', 'label').attr('transform', 'translate(6,10)')
      // ✅ FIX: let rects receive hover immediately
      .attr('pointer-events', 'none'); 

    label.append('text')
      .attr('font-size', 12)
      .attr('font-weight', 700)
      .attr('fill', '#111827')
      .text((d: any) => d.data.name);

    label.append('text')
      .attr('y', 14)
      .attr('font-size', 11)
      .attr('fill', '#374151')
      .text((d: any) => `${((100 * (d.value || 0)) / grand).toFixed(1)}%`);

    nodes.each(function (d: any) {
      const w = d.x1 - d.x0, h = d.y1 - d.y0;
      if (w < 70 || h < 34) d3.select(this).select('.label').style('display', 'none');
    });

    // ✅ FIX: Defer legend one frame so nodes are interactive immediately
    if (showLegend) {
      requestAnimationFrame(() => drawLegend(svg!, width, treemapHeight));
    }

    // Fade in only on first paint; keep it snappy
    if (Number(svg.style('opacity')) < 1) {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!reduceMotion) svg.transition().duration(150).style('opacity', 1);
      else svg.style('opacity', 1);
    }
  }

  // ── Legend (positioned below treemap) ───────────────────────────────────
  function drawLegend(svgSel: typeof svg, width: number, treemapHeight: number) {
    const names = data.map((d) => d.name);
    const color = (name: string) => {
      const item = data.find(d => d.name === name);
      return item ? getColor(item) : '#ccc';
    };

    // ... rest of the drawLegend function is unchanged and correct ...
    const pad = 12, colGap = 16, rowGap = 8, sw = 12, fh = 12;
    const g = svgSel!.select('.legend')
      .attr('transform', `translate(${pad}, ${treemapHeight + pad})`)
      .attr('pointer-events', 'none'); // legend shouldn’t block node hovers

    const measure = (text: string) => text.length * 7;
    const maxLine = width - (2 * pad);

    let x = 0, y = 0;
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
      family === 'combined' ? `AANHPI ${typeLabel} (${yearRange})` :
      (family === 'asian' ? `Asian ${typeLabel} (${yearRange})` : `NHPI ${typeLabel} (${yearRange})`);

    g.append('text')
      .attr('x', 0)
      .attr('y', -2)
      .attr('font-size', 14)
      .attr('font-weight', 600)
      .attr('fill', '#374151')
      .text(titleText);

    const rowY = 16;
    const item = g.selectAll('g.legend-item')
      .data(items)
      .join('g')
      .attr('class', 'legend-item')
      .attr('transform', (d) => `translate(${d.x}, ${rowY + d.y})`);

    item.append('rect')
      .attr('width', sw)
      .attr('height', sw)
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('fill', (d) => color(d.name))
      .attr('stroke', '#e5e7eb');

    item.append('text')
      .attr('x', sw + 6)
      .attr('y', sw - 2)
      .attr('font-size', fh)
      .attr('fill', '#4b5563')
      .text((d) => d.name);
  }
</script>

{#if showHeader}
  <!--div class="flex items-center justify-between mb-2"-->
    <!--span class="text-xs text-neutral-600"-->
  <div class="mb-2">  
    <span class="header-label">
      {populationTypeLabel} Total: {formatNumber(total)} ({yearRange})
    </span>
  </div>
{/if}

<div bind:this={container} class="w-full min-h-[340px]"></div>
<div class="source-label site-container--flush">
    Source: U.S. Census Bureau, American Community Survey (ACS), 5-year estimates, and IPUMS USA, University of Minnesota, www.ipums.org
</div>

<style>
  :global(.node:hover) rect {
    filter: brightness(0.96);
    transition: filter 120ms ease-in-out;
  }
  /* Adjusted legend text styling for better contrast on the chart's background */
  :global(.legend text) {
    paint-order: stroke fill;
    stroke: rgba(255, 255, 255, 0.4); /* Slightly softer stroke for legend */
    stroke-width: 0.4px;
  }
</style>