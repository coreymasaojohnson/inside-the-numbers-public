<script lang="ts">
  import { onMount } from 'svelte';

  export let items: { id: string; label: string; href?: string }[] = [
    { id: 'pop',     label: 'Population' },
    { id: 'mig',     label: 'Migration' },
    { id: 'lang',    label: 'Language' },
    { id: 'econ',    label: 'Economy' },
    { id: 'wellb',   label: 'Well-Being' },
    { id: 'methods', label: 'Appendix' }
  ];
  export let active = 'pop';
  export let onNav: (id: string) => void = () => {};
  export let label = 'Explore';

  let activeIdx = 0;
  $: activeIdx = Math.max(0, items.findIndex(i => i.id === active));

  function go(idx: number) {
    const clamped = Math.min(items.length - 1, Math.max(0, idx));
    if (items[clamped]) onNav(items[clamped].id);
  }
  const goPrev = () => go(activeIdx - 1);
  const goNext = () => go(activeIdx + 1);

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); return; }
      if (e.key === 'Home')       { e.preventDefault(); go(0); return; }
      if (e.key === 'End')        { e.preventDefault(); go(items.length - 1); return; }

      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= Math.min(9, items.length)) {
        e.preventDefault();
        go(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<!-- Sticky wrapper is full-bleed but transparent -->
<nav class="appnav" role="navigation" aria-label="Main sections">
  <div class="site-container">
    <div class="appnav__panel">
      <div class="appnav__bar">
        <span class="appnav__label-inline" aria-hidden="true">{label.toUpperCase()}:</span>
        <ul class="appnav__list">
          {#each items as it, i}
            <li>
              <button
                class="appnav__link {active === it.id ? 'is-active' : ''}"
                aria-current={active === it.id ? 'page' : undefined}
                aria-label={it.label}
                on:click={() => onNav(it.id)}
                
                title={it.id === 'pop' ? it.label : 'Coming soon'} 
                
                data-shortcut={i < 9 ? i + 1 : ''}
                type="button"
              >
                {it.label}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  </div>
</nav>

<style>
:root{
  --amber-5:#E46A25;
  --plum-5:#9d3f8c;
  --plum-6:#742e6a;

  /* fallbacks in case they aren't defined globally */
  --container-max: 1200px;
  --container-pad: 2rem;
}

/* Sticky wrapper shows no surface */
.appnav{
  position: sticky;
  bottom: 0;
  z-index: 40;
  background: transparent;
  padding: 0;
  margin: 0;
}

/* ensure the same width constraint as the rest of the page */
.appnav .site-container{
  max-width: var(--container-max);
  margin-inline: auto;
  /* .site-container elsewhere likely adds padding-inline; that's fine */
}

/* PANEL: bleed to the container edges, then pad inside */
.appnav__panel{
  background: var(--color-bg-alt);
  border-top: 1px solid var(--color-border);
  box-shadow: 0 -1px 0 rgba(0,0,0,0.02);

  /* KEY: cancel whatever side padding .site-container has */
  /* This guarantees visual edge alignment with the white paper above */
  width: calc(100% + 2 * var(--container-pad));
  margin-left: calc(-1 * var(--container-pad));
  margin-right: calc(-1 * var(--container-pad));
  padding: 0.25rem var(--container-pad);
}

/* Row */
.appnav__bar{
  display:flex;
  align-items:center;
  gap:1rem;
  flex-wrap:wrap;
}

/* Label */
.appnav__label-inline{
  flex:0 0 auto;
  white-space:nowrap;
  font-family:"Avenir LT Std", system-ui, sans-serif;
  font-weight:600;
  font-size:.95rem;
  text-transform:uppercase;
  letter-spacing:.05em;
  color:var(--color-text);
  opacity:.6;
}

/* List */
.appnav__list{
  display:flex;
  flex:1 1 auto;
  min-width:0;
  flex-wrap:wrap;
  align-items:center;
  gap:.25rem 1rem;
  list-style:none;
  margin:0;
  padding:0;
}
.appnav__list > li { margin: 0; padding: 0; }

/* Links */
.appnav__link{
  appearance:none;
  background:transparent;
  border:0;
  padding:.25rem .375rem;
  margin:0;
  cursor:pointer;

  font-family:"Avenir LT Std", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  font-weight:800;
  font-size:1.06rem;
  line-height:1.25;
  text-transform:uppercase;
  letter-spacing:.06em;

  color:var(--amber-5);
  border-radius:.25rem;
  transition:color .14s ease;

  --chev:"❯";
  --chev-size:1.05em;
  --chev-space:2.5ch;
  --chev-gap:.4ch;
  --chev-shift:1.2ch;

  position:relative;
  padding-left:calc(.375rem + var(--chev-space) + var(--chev-gap));
}
.appnav__link::before{
  content:var(--chev);
  position:absolute;
  left:.375rem;
  top:50%;
  width:var(--chev-space);
  text-align:center;
  font:900 var(--chev-size)/1 inherit;
  color:currentColor;
  opacity:0;
  transform:translateY(-50%) translateX(calc(-1 * var(--chev-shift)));
  transition:opacity 180ms ease, transform 220ms cubic-bezier(.2,.7,.2,1);
  will-change:transform, opacity;
}
.appnav__link:hover::before,
.appnav__link.is-active::before,
.appnav__link[aria-current="page"]::before{
  opacity:1; transform:translateY(-50%) translateX(0);
}

/* Colors */
.appnav .appnav__link{ color:var(--amber-5); }
.appnav .appnav__link.is-active{ color:var(--plum-6); }
.appnav .appnav__link:hover,
.appnav .appnav__link.is-active:hover{ color:var(--plum-5); }

/* Focus */
.appnav__link:focus-visible{
  outline:2px solid var(--plum-6);
  outline-offset:2px;
}

</style>
