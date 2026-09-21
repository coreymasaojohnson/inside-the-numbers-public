<script lang="ts">
  import * as d3 from 'd3';
  import { feature, mesh } from 'topojson-client';
  import { onMount, onDestroy } from 'svelte';

  // 💡 UPDATE: Use new AANHPI function names
  import {
    getAanhpiForeignBornCached,
    getAanhpiForeignBornByStateCached,
    computeSharePercent
  } from '$lib/data/acs';
  import type { CountyFips } from '$lib/data/acs';
  import { PALETTE } from '$lib/styles/palettes';

  // ---- props ----
  export type Scope = 'county' | 'state';
  export type Category = 'combined' | 'asian' | 'nhpi';
  
  export let scope: Scope = 'county';          // controlled by parent TopBar
  export let category: Category = 'combined';  // NEW: controlled by parent TopBar

  // ---- refs / d3 handles ----
  let container: HTMLDivElement;
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  let ro: ResizeObserver;
  let runId = 0; // ID for managing concurrent async loads/renders to prevent race conditions

  // ---- geo ----
  let counties: any[] | null = null;
  let statesFeats: any[] | null = null;
  let stateBorders: any | null = null;

  // ---- data maps (reused across scopes) ----
  let aapiByFips = new Map<CountyFips, number>();
  let namesByFips = new Map<CountyFips, string>();
  let denomByFips: Map<CountyFips, number> | undefined;
  
  // NEW: breakdown data for Asian/NHPI disaggregation
  let breakdownByFips = new Map<CountyFips, { asian: number; nhpi: number }>();

  // ---- colors ----
  const ACTIVE_PALETTE = PALETTE.plum;
  const neutral = 'var(--color-bg-alt, #F5F2EF)';
  
  // Reactive color scales that adjust based on category AND scope
  $: colorPercent = (() => {
    if (category === 'nhpi') {
      if (scope === 'state') {
        // State-level NHPI: Most states 0-5%, Hawaii at 9.8%
        // Domain: [0.1, 0.3, 0.6, 1, 2.5, 5] (6 values = 7 buckets)
        // Buckets: 0%, >0-0.1%, 0.1-0.3%, 0.3-0.6%, 0.6-1%, 1-2.5%, 2.5-5%, 5%+
        return d3.scaleThreshold<number, string>()
          .domain([0.1, 0.3, 0.6, 1, 2.5, 5])
          .range(ACTIVE_PALETTE);
      } else {
        // County-level NHPI: Most counties 0-5%, but outliers up to 40%
        // Domain: [0.1, 0.3, 0.6, 1, 2.5, 10] (6 values = 7 buckets)
        // Buckets: 0%, >0-0.1%, 0.1-0.3%, 0.3-0.6%, 0.6-1%, 1-2.5%, 2.5-10%, 10%+
        // This captures 22% and 39% outliers in the 10%+ bucket
        return d3.scaleThreshold<number, string>()
          .domain([0.1, 0.3, 0.6, 1, 2.5, 10])
          .range(ACTIVE_PALETTE);
      }
    } else {
      // Combined and Asian use 0-40% quantize range
      return d3.scaleQuantize<number, string>().domain([0, 40]).range(ACTIVE_PALETTE);
    }
  })();
  
  $: colorCounts = (() => {
    if (category === 'nhpi') {
      // NHPI: Very fine granularity to distinguish zeros from small counts
      return d3.scaleThreshold<number, string>()
        .domain([1, 10, 50, 200, 1_000, 3_000])
        .range(ACTIVE_PALETTE);
    } else {
      // Combined and Asian use higher thresholds
      return d3.scaleThreshold<number, string>()
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
    counties = feature(atlas, atlas.objects.counties).features as any[];
    stateBorders = mesh(atlas, atlas.objects.states, (a: any, b: any) => a !== b);
    statesFeats = (feature(atlas, atlas.objects.states) as any).features as any[];
    console.info('[MapHero] topo counties:', counties.length, 'states:', statesFeats.length);
  }

  async function loadDataForScope(s: Scope) {
    if (s === 'state') {
      // ✅ State-level data now includes breakdown!
      const { byState, breakdown, names, denomForeignBorn } = await getAanhpiForeignBornByStateCached(true);
      
      aapiByFips = byState as unknown as Map<CountyFips, number>;
      namesByFips = names as unknown as Map<CountyFips, string>;
      denomByFips = denomForeignBorn as unknown as Map<CountyFips, number>;
      breakdownByFips = breakdown as unknown as Map<CountyFips, { asian: number; nhpi: number }>;
      
      console.info('[MapHero] state data:', byState.size, 'with breakdown:', breakdown.size);
    } else {
      // County-level data includes breakdown
      const result = await getAanhpiForeignBornCached({ withDenominator: true });
      
      // Cast the result to access breakdown (it's returned but not typed in the interface)
      const fullResult = result as any;
      
      aapiByFips = result.byFips;
      namesByFips = result.names;
      denomByFips = result.denomForeignBorn;
      breakdownByFips = fullResult.breakdown || new Map();
      
      console.info('[MapHero] county data:', result.byFips.size, 'with breakdown:', breakdownByFips.size);
    }
  }

  // NEW: Get category display name
  function getCategoryDisplayName(): string {
    if (category === 'combined') return 'AANHPI';
    if (category === 'asian') return 'Asian';
    return 'NHPI';
  }

  /**
   * Helper to create the base SVG element without contents.
   */
  function drawMapSkeleton(width: number, height: number): d3.Selection<SVGSVGElement, unknown, null, undefined> {
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

  /**
   * Helper to draw all the map features inside the given SVG element.
   */
  function drawMapContents(
      svgEl: d3.Selection<SVGSVGElement, unknown, null, undefined>,
      width: number,
      height: number,
      feats: any[],
      getKey: (d: any) => string
  ) {
    const isState = scope === 'state';
    
    // Update the global 'g' reference
    g = svgEl.append('g'); 

    const projection = d3.geoAlbersUsa().fitSize([width, height], {
        type: 'FeatureCollection',
        features: feats
    });
    const path = d3.geoPath(projection);

    // Create a map of values for the current category
    const categoryValues = new Map<CountyFips, number>();
    if (category === 'combined') {
        aapiByFips.forEach((val, key) => categoryValues.set(key, val));
    } else {
        breakdownByFips.forEach((breakdown, key) => {
            const val = category === 'asian' ? breakdown.asian : breakdown.nhpi;
            categoryValues.set(key, val);
        });
    }

    // polygons
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
            
            // Explicit zero handling for NHPI to show as neutral/gray
            if (category === 'nhpi' && count === 0) return neutral;
            
            // Calculate percentage if denominator is available
            if (denomByFips) {
                const denom = denomByFips.get(k as any);
                if (denom && denom > 0) {
                    const pct = (count / denom) * 100;
                    // Explicit zero percentage handling for NHPI
                    if (category === 'nhpi' && pct === 0) return neutral;
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
        .on('pointermove', (event: PointerEvent, d: any) => moveTooltip(event, d))
        .on('pointerleave', function () {
            d3.select(this).style('stroke-width', 0.5);
            hideTooltip();
        });

    // state borders
    g.append('path')
        .attr('d', path(stateBorders as any) as any)
        .attr('fill', 'none')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('pointer-events', 'none');

    // legend
    drawLegend(svgEl, width, height, projection);
  }

  function render() {
    if (!container || !counties || !statesFeats || !stateBorders) return;

    const isState = scope === 'state';
    const feats = isState ? statesFeats! : counties!;
    const getKey = (d: any) => (isState ? String(d.id).padStart(2, '0') : String(d.id).padStart(5, '0'));

    const width = container.clientWidth || 800;
    const height = Math.round(width * 0.62);

    const reduceMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // 🌟 1. Prevent container collapse by locking height
    container.style.height = `${height}px`;

    const oldSvg = svg;
    svg = null; // Clear primary reference for the new draw.

    // Determine if we should cross-fade
    // Cross-fade if: initialized is true (subsequent render), reduced motion is off, and an old map exists.
    const shouldCrossFade = initialized && !reduceMotion && oldSvg;
    
    if (shouldCrossFade) {
        // --- Cross-Fade Transition ---
        
        // 2. Draw the new SVG immediately, but keep it hidden
        const newSvg = drawMapSkeleton(width, height);
        newSvg.style('opacity', 0);
        
        // 3. Perform the drawing logic on the new SVG
        drawMapContents(newSvg, width, height, feats, getKey);

        // 4. Perform the cross-fade transition
        
        // Fade out the old SVG
        oldSvg
            .transition()
            .duration(180)
            .style('opacity', 0)
            .on('end', () => {
                oldSvg.remove();
            });

        // Fade in the new SVG
        newSvg
            .transition()
            .delay(60) // Short delay for smoother cross-fade start
            .duration(180)
            .style('opacity', 1)
            .on('end', () => {
                // 5. Release the height lock only when the transition is done
                container.style.height = '';
            });

        // Update the main SVG reference
        svg = newSvg;
        return;
    } 
    
    // --- Initial Draw or Non-Fade (Reduced Motion / Resize) ---
    
    // Remove the old one immediately if it exists (for resizes/reduced motion)
    if (oldSvg) {
        oldSvg.remove();
    }
    
    // Draw the new one immediately
    const newSvg = drawMapSkeleton(width, height);
    drawMapContents(newSvg, width, height, feats, getKey);
    svg = newSvg;

    // Fade in only if it's the first time and we want animation
    if (!initialized && !reduceMotion) {
        // Initial fade-in (no fade-out of an old map)
        svg
            .style('opacity', 0)
            .transition()
            .delay(60)
            .duration(180)
            .style('opacity', 1)
            .on('end', () => {
                container.style.height = ''; // Release lock after initial fade-in
            });
    } else {
        // Immediate draw (reduced motion or resize)
        svg.style('opacity', 1);
        container.style.height = ''; // Release lock immediately
    }
  }
// ... (rest of the file content for drawLegend, tooltip helpers, and onMount/onDestroy)

// ... drawLegend, getValueForCategory, tooltip functions (keep them as they were) ...

  function drawLegend(
    svgEl: typeof svg,
    width: number,
    height: number,
    projection: d3.GeoProjection
  ) {
    const boxW = 52, boxH = 14, gap = 6;
    const titleSize = 16, tickSize = 12;

    const usingPercent = !!denomByFips;
    const scale = usingPercent ? colorPercent : colorCounts;
    
    const categoryName = getCategoryDisplayName();
    const titleText = `Foreign-born ${categoryName} as percentage of overall foreign-born population`;

    // For NHPI, add neutral swatch at beginning to represent 0%
    const isNhpiThreshold = category === 'nhpi';
    const swatches = isNhpiThreshold ? [neutral, ...scale.range()] : scale.range();
    const legendW = swatches.length * boxW + (swatches.length - 1) * gap;

    // anchor near the upper Midwest band
    const lonWI = -92.9, latN = 46.8, lonNH = -70.6;
    const p1 = projection([lonWI, latN]);
    const p2 = projection([lonNH, latN]);
    let x = width - legendW - 20;
    let y = 10;
    if (p1 && p2) {
      const midX = (p1[0] + p2[0]) / 2;
      x = Math.max(8, Math.min(width - legendW - 8, midX - legendW / 2));
    }
    x -= 35;

    const legend = svgEl!.append('g').attr('transform', `translate(${x},${y})`).attr('pointer-events', 'none');

    legend.append('text')
      .attr('x', 0).attr('y', 0)
      .attr('font-size', titleSize).attr('font-weight', 600).attr('fill', '#374151')
      .attr('dominant-baseline', 'hanging')
      .text(titleText);

    const swatchY = titleSize + 6;
    const items = legend.append('g')
      .attr('transform', `translate(0, ${swatchY})`)
      .selectAll('g.item')
      .data(swatches)
      .join('g')
      .attr('class', 'item')
      .attr('transform', (_d, i) => `translate(${i * (boxW + gap)}, 0)`);

    items.append('rect')
      .attr('width', boxW).attr('height', boxH)
      .attr('fill', (d) => d as string)
      .attr('stroke', '#e5e7eb');

    if (usingPercent) {
      // Check if this is NHPI (threshold scale) or Combined/Asian (quantize scale)
      if (isNhpiThreshold) {
        // NHPI uses threshold scale for percentages with neutral swatch for 0%
        const t = (scale as d3.ScaleThreshold<number, string>).domain();
        items.append('text')
          .attr('x', 0).attr('y', boxH + 14)
          .attr('font-size', tickSize).attr('fill', '#4b5563')
          .text((_, i) => {
            // First swatch is neutral gray representing 0%
            if (i === 0) return '0.0%';
            
            // Remaining swatches map to threshold buckets
            const domainIndex = i - 1; // Adjust for neutral swatch
            const a = domainIndex === 0 ? 0 : t[domainIndex - 1];
            const b = t[domainIndex];
            
            const pct = (n: number) => n < 1 ? `${n.toFixed(1)}%` : `${Math.round(n)}%`;
            
            // First colored swatch (>0 to first threshold)
            if (domainIndex === 0) return `>0.0–${pct(b)}`;
            
            // Last swatch (no upper bound)
            if (b == null) return `${pct(a)}+`;
            
            // Middle swatches
            return `${pct(a)}–${pct(b)}`;
          });
      } else {
        // Combined/Asian use quantize scale
        const q = scale as d3.ScaleQuantize<number, string>;
        const starts = [q.domain()[0], ...q.thresholds()];
        items.append('text')
          .attr('x', 0).attr('y', boxH + 14)
          .attr('font-size', tickSize).attr('fill', '#4b5563')
          .text((_, i) => {
            const a = starts[i], b = starts[i + 1];
            const pct = (n: number) => `${Math.round(n)}%`;
            return b == null ? `${pct(a)}+` : `${pct(a)}–${pct(b)}`;
          });
      }
    } else {
      // Count scale (when no denominator)
      if (isNhpiThreshold) {
        // NHPI count scale with neutral swatch for 0
        const t = (scale as d3.ScaleThreshold<number, string>).domain();
        const fmt = d3.format(',');
        items.append('text')
          .attr('x', 0).attr('y', boxH + 14)
          .attr('font-size', tickSize).attr('fill', '#4b5563')
          .text((_, i) => {
            // First swatch is neutral gray representing 0
            if (i === 0) return '0';
            
            // Remaining swatches map to threshold buckets
            const domainIndex = i - 1;
            const a = domainIndex === 0 ? 0 : t[domainIndex - 1];
            const b = t[domainIndex];
            
            // First colored swatch (>0 to first threshold)
            if (domainIndex === 0) return `>0–${fmt(b)}`;
            
            // Last swatch (no upper bound)
            if (b == null) return `${fmt(a)}+`;
            
            // Middle swatches
            return `${fmt(a)}–${fmt(b)}`;
          });
      } else {
        // Combined/Asian count scale
        const t = (scale as d3.ScaleThreshold<number, string>).domain();
        const starts = [0, ...t];
        const fmt = d3.format(',');
        items.append('text')
          .attr('x', 0).attr('y', boxH + 14)
          .attr('font-size', tickSize).attr('fill', '#4b5563')
          .text((_, i) => {
            const a = starts[i], b = starts[i + 1];
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
    
    // Calculate percentage if denominator is available
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
    tooltip.style.top  = `${evt.clientY + 12}px`;
  }
  
  function hideTooltip() { 
    if (tooltip) tooltip.style.display = 'none'; 
  }

  // ---- mount & reactive scope/category handling ----
  let initialized = false;

  onMount(async () => {
    let alive = true;
    try {
      await loadTopo();
      if (!alive) return;
      
      const debouncedRender = debounce(render, 120);
      ro = new ResizeObserver(() => debouncedRender());
      ro.observe(container);

      // 🌟 FIX 1: Only load data, then perform the *first* render
      const currentRunId = ++runId;
      await loadDataForScope(scope);
      if (!alive) return;

      // Check against runId before rendering
      if (currentRunId === runId) {
        render(); // first colored draw
      }

      initialized = true; // Set initialized *after* the first render
    } catch (err) {
      console.error('[MapHero] init failed:', err);
      // Fallback: render an empty map on failure
      if (svg) render();
    }
    return () => { alive = false; };
  });

  // react to scope OR category changes after initial mount
  $: if (initialized && (scope || category) && counties && statesFeats) {
    // 1. Increment runId and capture the current run's context
    const currentRunId = ++runId; 
    const scopeAtStart = scope;

    (async () => {
      // 2. Perform the asynchronous data loading
      await loadDataForScope(scopeAtStart);
      
      // 3. Guard the render call: only proceed if this request's ID matches the latest ID
      if (currentRunId === runId) {
        render();
      }
    })();
  }

  onDestroy(() => {
    ro && ro.disconnect();
    if (svg) svg.remove();
    if (tooltip) tooltip.remove();
    // Cleanup: Clear any residual inline height on destroy
    if (container) container.style.height = ''; 
  });
</script>


<div bind:this={container} class="w-full min-h-[360px]"></div>
<div class="source-label site-container--flush">
      Source: U.S. Census Bureau, American Community Survey (ACS), 5-year estimates
  </div>

<style>
  /* ===== Map tooltip ===== */
  :global(.map-tooltip) {
    position: fixed;
    pointer-events: none;
    background: rgba(255, 255, 255, 0.97);
    border: 1px solid #e5e7eb;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 12px;
    color: #111827;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .08);
    z-index: 50;
    display: none;
  }

  /* ===== Scope row (below map) ===== */
  .map-scope-row {
    margin-top: 0.5rem;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  /* Label (serif) */
  .scope-label-strong {
    font-family: var(--font-serif, Georgia, serif);
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: #1f2937;
    font-size: 1rem;
    line-height: 1.1;
  }
  @media (min-width: 1024px) {
    .scope-label-strong { font-size: 1.125rem; }
  }

  /* Segmented control */
  .scope-segment {
    position: relative;
    display: inline-flex;
    border: 1.5px solid var(--scope-accent, #742e6a);
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
    background: var(--scope-accent-hover, #f4d0ea);
  }

  .scope-segment .seg-btn:focus-visible {
    outline: 0;
    box-shadow: inset 0 0 0 1.5px var(--scope-accent, #742e6a);
  }

  .scope-segment .seg-btn.active,
  .scope-segment .seg-btn[aria-pressed="true"] {
    background: var(--scope-accent-bg, #fae9f4);
    color: var(--scope-accent, #742e6a);
    box-shadow: none;
    border: 0;
  }

  .scope-segment .seg-btn + .seg-btn {
    box-shadow: inset 1px 0 0 rgba(116, 46, 106, 0.20);
  }
</style>