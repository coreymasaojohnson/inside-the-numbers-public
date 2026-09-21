<script lang="ts">
  // View Toggles (Remain Unchanged)
  export let views: string[] = [];
  export let activeView = '';
  export let onView: (v: string) => void = () => {};

  // Category Segmented Control (NEW: for Combined/Asian/NHPI in Map view)
  export let categoryLabels: string[] | undefined = undefined;
  export let activeCategory: string | undefined = undefined;
  export let onCategory: (c: string) => void = () => {};

  // Scope Segmented Control (for County/State in Map view, or other uses)
  export let scopeLabels: string[] | undefined = undefined;
  export let activeScope: string | undefined = undefined;
  export let onScope: (s: string) => void = () => {};
  
  // Scale Segmented Control (Used for Indexed/Absolute in Growth view)
  export let scaleLabels: string[] | undefined = undefined;
  export let activeScale: string | undefined = undefined;
  export let onScale: (s: string) => void = () => {};
  
  // Year Selector (Used for 2011/2022)
  export let yearLabels: (string | number)[] | undefined = undefined;
  export let activeYear: string | number | undefined = undefined;
  export let onYear: (y: string | number) => void = () => {};

  // Helpers
  $: showCategoryControl = categoryLabels && categoryLabels.length > 0;
  $: showScopeControl = scopeLabels && scopeLabels.length > 0;
  $: showScaleControl = scaleLabels && scaleLabels.length > 0;
  $: showYearControl = yearLabels && yearLabels.length > 0;
</script>

<div class="topbar">
  <div class="topbar-inner">
    <nav class="tabs" aria-label="Data view">
      {#each views as v}
        <button
          type="button"
          class="tab {activeView === v ? 'is-active' : ''}"
          aria-pressed={activeView === v}
          on:click={() => onView(v)}
        >{v}</button>
      {/each}
    </nav>

    <!-- Controls Wrapper for right-aligned items -->
    <div class="controls-right">
      
      {#if showCategoryControl}
        <div class="scope" role="group" aria-label="Category">
          <span class="scope-label">Category:</span>
          <div class="seg" role="group" aria-label="Population category">
            {#each categoryLabels as label}
              <button
                type="button"
                class="seg-btn"
                class:is-active={activeCategory?.toLowerCase() === label.toLowerCase()}
                aria-pressed={activeCategory?.toLowerCase() === label.toLowerCase()}
                on:click={() => onCategory(label)} 
              >
                {label}
              </button>
            {/each}
          </div>
        </div>
      {/if}
      
      {#if showScopeControl}
        <div class="scope" role="group" aria-label="Scope">
          <span class="scope-label">Scope:</span>
          <div class="seg" role="group" aria-label="Geographic scope">
            {#each scopeLabels as label}
              <button
                type="button"
                class="seg-btn"
                class:is-active={activeScope?.toLowerCase() === label.toLowerCase()}
                aria-pressed={activeScope?.toLowerCase() === label.toLowerCase()}
                on:click={() => onScope(label)} 
              >
                {label}
              </button>
            {/each}
          </div>
        </div>
      {/if}
      
      {#if showScaleControl}
        <div class="scope" role="group" aria-label="Scale">
          <span class="scope-label">Scale:</span>
          <div class="seg" role="group" aria-label="Measurement scale">
            {#each scaleLabels as label}
              <button
                type="button"
                class="seg-btn"
                class:is-active={activeScale?.toLowerCase() === label.toLowerCase()}
                aria-pressed={activeScale?.toLowerCase() === label.toLowerCase()}
                on:click={() => onScale(label)} 
              >
                {label}
              </button>
            {/each}
          </div>
        </div>
      {/if}
      
      {#if showYearControl}
        <div class="year-select">
          <span class="scope-label">Year:</span>
          <select 
            class="select-field" 
            on:change={(e) => onYear((e.target as HTMLSelectElement).value)} 
            value={activeYear}
            aria-label="Select data year"
          >
            {#each yearLabels as year}
              <option value={year}>{year}</option>
            {/each}
          </select>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
/* Shared control metrics */
:root {
  --ctl-vpad: 6px;
  --ctl-hpad: 12px;
  --ctl-font: 0.85rem;
  --ctl-line: 1;
  --ctl-br: 0;
  --ctl-border-w: 1px;
  --ctl-accent: #742e6a;
  --ctl-border: var(--color-border);
  --scope-accent: var(--ctl-accent);
  --scope-accent-bg: #fae9f4;
  --scope-accent-hover: #f4d0ea;

  --amber-5: #E46A25;
  --plum-6: #742e6a;
}

.topbar {
  background: var(--color-bg-alt);
  border-bottom: 1px solid var(--color-border);
  padding: 0;
}

.topbar-inner {
  max-width: var(--container-max);
  margin: 0 auto;
  padding: 0.25rem 2rem;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: .5rem;
}

.controls-right {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* View tabs */
.tabs { 
  display: flex; 
  flex-wrap: wrap; 
  gap: .5rem; 
}

.tab {
  appearance: none;
  background: #fff;
  border: var(--ctl-border-w) solid var(--ctl-border);
  padding: var(--ctl-vpad) var(--ctl-hpad);
  font-size: var(--ctl-font);
  line-height: var(--ctl-line);
  font-family: "Avenir LT Std", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--amber-5);
  border-radius: var(--ctl-br);
  cursor: pointer;
  transition: background-color .12s, border-color .12s, color .12s;
}

.tab:hover { 
  background: #f7f7f7; 
}

.tab.is-active,
.tab[aria-pressed="true"] {
  border-color: var(--ctl-accent);
  color: var(--plum-6);
  background: #fff;
}

/* Scope and Scale controls */
.scope, .year-select { 
  display: flex; 
  align-items: center; 
  gap: .5rem; 
}

.scope-label {
  font-size: .8rem;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #4b5563;
}

.seg {
  display: inline-flex;
  border: var(--ctl-border-w) solid var(--ctl-border);
  border-radius: var(--ctl-br);
  background: #fff;
  overflow: hidden;
}

.seg-btn {
  appearance: none;
  background: #fff;
  border: 0;
  padding: var(--ctl-vpad) var(--ctl-hpad);
  font-size: var(--ctl-font);
  line-height: var(--ctl-line);
  font-family: "Avenir LT Std", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--amber-5);
  cursor: pointer;
  transition: background-color .12s, color .12s;
}

.seg-btn + .seg-btn { 
  box-shadow: inset 1px 0 0 rgba(0,0,0,.12); 
}

.seg-btn:hover { 
  background: var(--scope-accent-hover); 
}

.seg-btn.is-active,
.seg-btn[aria-pressed="true"] {
  background: var(--scope-accent-bg);
  color: var(--plum-6);
}

/* Select Field (Year Selector) */
.select-field {
  appearance: none;
  background: #fff;
  border: var(--ctl-border-w) solid var(--ctl-border);
  padding: var(--ctl-vpad) calc(var(--ctl-hpad) * 1.5) var(--ctl-vpad) var(--ctl-hpad);
  font-size: var(--ctl-font);
  line-height: var(--ctl-line);
  font-family: "Avenir LT Std", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--plum-6);
  border-radius: var(--ctl-br);
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23742e6a'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 16px;
}

/* Responsive */
@media (max-width: 768px) {
  .topbar-inner {
    grid-template-columns: 1fr;
    padding: 0.25rem 1rem;
  }
  .controls-right {
    justify-content: flex-start;
    gap: 1rem;
    margin-bottom: 0.25rem;
  }
}
</style>