<script lang="ts">
  import * as d3 from 'd3';
  import { onMount, onDestroy } from 'svelte';
  import { formatNumber } from '$lib/utils';
  import { PALETTE } from '$lib/styles/palettes';

  // ── Props ────────────────────────────────────────────────────────────────
  export let showHeader: boolean = true;
  export let showLegend: boolean = true;
  export let family: 'combined' | 'asian' | 'nhpi' = 'combined';
  export let year: number = 2021;  // IPUMS file year

  const populationTypeLabel = 'Foreign-born';

  // ── Local state ──────────────────────────────────────────────────────────
  let data: { name: string; value: number }[] = [];
  let loading = false;
  let error: string | null = null;

  // ── Internals ────────────────────────────────────────────────────────────
  let container: HTMLDivElement | null = null;
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  let ro: ResizeObserver | null = null;
  let roTimer: number | null = null;

  // Color scales
  const asianColors = d3.scaleOrdinal<string, string>().range(PALETTE.plum);
  const nhpiColors  = d3.scaleOrdinal<string, string>().range(PALETTE.ember);

  // derived total
  $: total = (data ?? []).reduce((s, d) => s + (d.value || 0), 0);

  // ── Color helper ─────────────────────────────────────────────────────────
  function getColor(d: { name: string; value: number }): string {
    const name = d.name.toLowerCase();
    const nhpiKeywords = [
      'hawaiian','samoan','guamanian','chamorro','tongan',
      'fijian','micronesian','polynesian','melanesian','pacific'
    ];
    const isNhpi = nhpiKeywords.some(k => name.includes(k));
    if (family === 'combined') return isNhpi ? nhpiColors(name) : asianColors(name);
    return family === 'asian' ? asianColors(name) : nhpiColors(name);
  }

  // ── Data loader (fetch local IPUMS JSON) ─────────────────────────────────
  async function loadDataForFamily(which: 'combined' | 'asian' | 'nhpi', currentYear: number) {
    loading = true;
    error = null;
    try {
      // For now, only one JSON (combined AANHPI)
      const res = await fetch('/data/derived/aanhpi_treemap_2021.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Optional: subset depending on family
      if (which === 'asian') {
        data = json.filter((d: any) =>
          !/hawaiian|samoan|guamanian|chamorro|tongan|fijian|micronesian|polynesian|melanesian/i.test(d.name)
        );
      } else if (which === 'nhpi') {
        data = json.filter((d: any) =>
          /hawaiian|samoan|guamanian|chamorro|tongan|fijian|micronesian|polynesian|melanesian/i.test(d.name)
        );
      } else {
        data = json;
      }
    } catch (e: any) {
      console.error('Treemap load failed', e);
      error = e.message;
      data = [];
    } finally {
      loading = false;
      if (typeof window !== 'undefined') {
        requestAnimationFrame(render);
      } else {
        render();
      }
    }
  }

  // Prevent double-fetch: track last request
  let lastKey = '';
  $: {
    const key = `${family}:${year}`;
    if (key !== lastKey) {
      lastKey = key;
      loadDataForFamily(family, year);
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  onMount(() => {
    if (container) {
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

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = Math.max(340, Math.round(width * 0.55));

    if (svg) svg.remove();

    const labelText =
      family === 'combined'
        ? `AANHPI ${populationTypeLabel} subgroup composition for ${year}`
        : `${family.toUpperCase()} ${populationTypeLabel} subgroup composition for ${year}`;

    svg = d3
      .select(container)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', width)
      .attr('height', height)
      .style('display', 'block')
      .style('opacity', 0)
      .attr('role', 'img')
      .attr('aria-label', `Treemap showing ${labelText}`);

    if (!data?.length) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', 14)
        .attr('fill', '#6b7280')
        .text(loading ? 'Loading…' : (error ? `Error: ${error}` : 'No data'));
      svg.style('opacity', 1);
      return;
    }

    const root = d3.hierarchy<{ children: typeof data }>({ children: data }).sum((d: any) => d.value);
    d3.treemap<{ children: typeof data }>()
      .tile(d3.treemapSquarify)
      .paddingInner(2)
      .size([width, height])(root as any);

    const leaves = root.leaves();
    const grand = root.value || 1;

    const nodes = svg
      .append('g')
      .attr('class', 'nodes')
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

    nodes
      .append('title')
      .text((d: any) => {
        const pct = ((d.value || 0) / grand) * 100;
        return `${d.data.name}: ${formatNumber(d.data.value)} (${pct.toFixed(1)}%)`;
      });

    const label = nodes.append('g').attr('class', 'label').attr('transform', 'translate(6,6)');

    label.append('text')
      .attr('font-size', 12)
      .attr('font-weight', 700)
      .attr('fill', '#111827')
      .text((d: any) => d.data.name);

    label.append('text')
      .attr('y', 14)
      .attr('font-size', 11)
      .attr('fill', '#374151')
      .text((d: any) => `${Math.round((100 * (d.value || 0)) / grand)}%`);

    nodes.each(function (d: any) {
      const w = d.x1 - d.x0, h = d.y1 - d.y0;
      if (w < 70 || h < 34) d3.select(this).select('.label').style('display', 'none');
    });

    if (showLegend) drawLegend(svg, width);

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) svg.transition().duration(220).style('opacity', 1);
    else svg.style('opacity', 1);
  }

  // ── Legend (unchanged) ──────────────────────────────────────────────────
  function drawLegend(svgSel: typeof svg, width: number) {
    const names = data.map((d) => d.name);
    const color = (name: string) => {
      const item = data.find(d => d.name === name);
      return item ? getColor(item) : '#ccc';
    };

    const pad = 12, colGap = 16, rowGap = 8, sw = 12, fh = 12, right = width - pad;
    const g = svgSel!.append('g').attr('class', 'legend').attr('transform', `translate(${right}, ${pad})`);

    let x = 0, y = 0;
    const items: { name: string; x: number; y: number }[] = [];
    const measure = (text: string) => text.length * 7;
    const maxLine = Math.min(380, Math.max(220, Math.round(width * 0.45)));

    for (const n of names) {
      const wEstimate = sw + 6 + measure(n);
      if (x + wEstimate > maxLine && x !== 0) {
        x = 0;
        y += Math.max(sw, fh) + rowGap;
      }
      items.push({ name: n, x, y });
      x += wEstimate + colGap;
    }

    const legendWidth = Math.min(maxLine, Math.max(...items.map((it) => it.x)) + 80);
    g.attr('transform', `translate(${right - legendWidth}, ${pad})`);

    const typeLabel = `${populationTypeLabel} Subgroups`;
    const titleText =
      family === 'combined' ? `AANHPI ${typeLabel} (${year})` :
      (family === 'asian' ? `Asian ${typeLabel} (${year})` : `NHPI ${typeLabel} (${year})`);

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
  <div class="flex items-center justify-between mb-2">
    <span class="text-xs text-neutral-600">
      {populationTypeLabel} Total: {formatNumber(total)} ({year})
    </span>
  </div>
{/if}

<div bind:this={container} class="w-full min-h-[340px]"></div>

<style>
  :global(.node:hover) rect {
    filter: brightness(0.96);
    transition: filter 120ms ease-in-out;
  }
  :global(.legend text) {
    paint-order: stroke fill;
    stroke: rgba(255, 255, 255, 0.6);
    stroke-width: 0.6px;
  }
</style>
