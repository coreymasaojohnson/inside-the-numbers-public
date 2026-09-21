<script lang="ts">
  import '../app.css';
  import '$lib/styles/base.css';
  import '$lib/styles/util.css';
  import '$lib/styles/buttons.css';

  // Safer for TS/Vite: returns a URL string
  import faviconUrl from '$lib/assets/favicon.svg?url';

  import FlameMark from '$lib/components/FlameMark.svelte';
  import AppNav from '$lib/components/AppNav.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import { onMount } from 'svelte';
  import type { ToggleKey } from '$lib/stories';
  
  // Import shared stores
  import {
    currentView,
    mapCategory,
    mapScope,
    treemapFamily,
    growthView,
    growthScale,
    isMap,
    isTreemap,
    isGrowth,
    categoryLabels,
    activeCategoryValue,
    scopeLabels,
    activeScopeValue,
    scaleLabels,
    activeScaleValue
  } from '$lib/stores/topBarStores';

  let activeSection = 'pop';
  const onNav = (id: string) => { activeSection = id; };
  
  // Track scroll position for sticky header
  let scrolled = false;
  
  onMount(() => {
    const handleScroll = () => {
      scrolled = window.scrollY > 100; // Show after scrolling 100px
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  });
  
  // TopBar handlers that update stores
  const handleViewChange = (view: string) => {
    currentView.set(view as ToggleKey);
  };
  
  const handleCategoryChange = (value: string) => {
    const internalKey = value.toLowerCase() as 'combined' | 'asian' | 'nhpi';
    if ($isMap) {
      mapCategory.set(internalKey);
    }
  };
  
const handleScopeChange = (value: string) => {
    const internalKey = value.toLowerCase();
    
    // Define valid keys for Treemap/Growth to prevent bad assignment
    const TREEMAP_GROWTH_KEYS = ['combined', 'asian', 'nhpi'];

    if ($isMap) {
      // Still need to cast for type safety within Map view's expectations
      mapScope.set(internalKey as 'county' | 'state');

    } else if ($isTreemap) {
      // Validate key before setting, otherwise default to 'combined'
      if (TREEMAP_GROWTH_KEYS.includes(internalKey)) {
        treemapFamily.set(internalKey as 'combined' | 'asian' | 'nhpi');
      } else {
        // Fallback to a safe default if an invalid value is passed (e.g. 'state' from Map View)
        treemapFamily.set('combined');
      }
    } else if ($isGrowth) {
      // Apply the same validation for Growth view
      if (TREEMAP_GROWTH_KEYS.includes(internalKey)) {
        growthView.set(internalKey as 'combined' | 'asian' | 'nhpi');
      } else {
        growthView.set('combined');
      }
    }
};
  
const handleScaleChange = (value: string) => {
    // Correctly map the external value to the internal store value
    const internalKey = value.toLowerCase() === 'absolute' ? 'absolute' : 'indexed';

    if ($isGrowth) {
      // The store should now accept 'absolute' or 'indexed'
      growthScale.set(internalKey as 'indexed' | 'absolute'); 
    }
  };
</script>

<svelte:head>
  <link
    rel="preload"
    href="/fonts/avenirltstd-heavy-webfont.woff2"
    as="font"
    type="font/woff2"
    crossorigin
  />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet">
  <link rel="icon" href={faviconUrl} />
</svelte:head>

<!-- Compact Sticky Header (appears on scroll) -->
<div class="sticky-header" class:visible={scrolled}>
  <div class="sticky-header-wrapper">
    <div class="sticky-header-brand-row">
      <div class="sticky-brand">
        <FlameMark size={28} color="#fff" />
      </div>
      <div class="sticky-title">Inside the Numbers</div>
    </div>
    <div class="sticky-topbar">
      <TopBar
        views={['Map View', 'Treemap View', 'Growth Over Time']}
        activeView={$currentView}
        onView={handleViewChange}
        categoryLabels={$categoryLabels}
        activeCategory={$activeCategoryValue}
        onCategory={handleCategoryChange}
        scopeLabels={$scopeLabels}
        activeScope={$activeScopeValue}
        onScope={handleScopeChange}
        scaleLabels={$scaleLabels}
        activeScale={$activeScaleValue}
        onScale={handleScaleChange}
      />
    </div>
  </div>
</div>

<!-- Main Header (original, at top) -->
<div class="site-header-wrapper">
  <header class="site-header">
    <div class="brand">
      <FlameMark size={40} color="#fff" />
    </div>
    <div class="site-title-block">
      <div class="title-main">Inside the Numbers</div>
      <div class="title-divider"></div>
      <div class="title-sub">
        how immigration shapes aapi communities
      </div>
    </div>
  </header>
</div>

<div class="main-content">
  <slot />
</div>

<AppNav onNav={onNav} active={activeSection} />

<style>
  /* Compact Sticky Header */
  .sticky-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    display: flex;
    justify-content: center;
    transform: translateY(-100%);
    transition: transform 0.3s ease-in-out;
    background: transparent; /* Let body background show through */
  }
  
  .sticky-header.visible {
    transform: translateY(0);
  }
  
  .sticky-header-wrapper {
    max-width: 1200px;
    width: 100%;
    background: transparent; /* Transparent wrapper */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); /* Shadow only on wrapper */
  }
  
  .sticky-header-brand-row {
    background-color: #9d3f8c;
    padding: 0.5rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .sticky-brand {
    display: flex;
    align-items: center;
  }
  
  .sticky-title {
    font-family: "Avenir LT Std", Avenir, "Helvetica Neue", system-ui, sans-serif;
    font-weight: 900;
    font-size: 1.25rem;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #fff;
    white-space: nowrap;
  }
  
  .sticky-topbar {
    /* TopBar has its own styling */
  }

  /* Original Header Styles */
  .site-header-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
    background: transparent; /* Let body background show through */
}

  .site-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    width: 100%;
    background-color: #9d3f8c;
    color: #fff;
    /*padding: 1.5rem 2rem;*/
    padding: 0.85rem 2rem;
  }

  .brand {
    display: flex;
  }

  .site-title-block {
    text-align: right;
    display: inline-block;
  }

  .title-main {
    font-family: "Avenir LT Std", Avenir, "Helvetica Neue", system-ui, sans-serif;
    font-weight: 900; /* Heavy */
 /*   font-size: clamp(1.70rem, 2.7vw, 2.0rem); */
 /* ~25.6px min → grows → ~38.4px max */
    font-size: clamp(1.6rem, calc(1.2rem + 1.6vw), 2.0rem);
    text-transform: uppercase;
    letter-spacing: 0.09em;
    line-height: 1;
    color: #fff;
    white-space: nowrap;
    width: 100%;
    margin-right: -4px;
  }

  .title-divider {
    width: 100%;
    height: 1px;
    background-color: #fff;
    margin: 0.2rem 0;
    margin-bottom: 0.05rem;
  }

  .title-sub {
    /*font-family: "Crimson Pro", Georgia, "Times New Roman", serif;
    font-weight: 500; /* Medium */
    font-family: Georgia, "Times New Roman", serif; /* Changed font */
    font-weight: 600; /* Reduced to Regular/400 for better contrast */
  /*  font-size: clamp(1.10rem, 1.2vw, 1.10rem); */
  /* ~16px min → grows → ~25.6px max */
    font-size: clamp(1.0rem, calc(0.8rem + 0.9vw), 1.09rem);
    letter-spacing: 0.095em;
    font-variant: small-caps;
    line-height: 1.2;
    color: #fff;
    white-space: nowrap;
    width: 100%;
    margin-top: 0px;
    margin-right: -4px;
  }
/* This is no longer being used 
  .action-word {
    font-style: italic;
    // text-transform: small-caps; is not a standard CSS value. 
    //   We must use font-variant-caps: small-caps; for proper small caps. 
   // font-variant-caps: small-caps; 
    // Optionally, you could use a slightly different font weight 
    //   if the italic/small-caps combo doesn't provide enough emphasis. 
    text-transform: lowercase;
    font-weight: 300; /* Extra Bold, since the subtitle is 700 
  } */
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .sticky-title {
      font-size: 1rem;
    }
    
    .sticky-header-brand-row {
      padding: 0.4rem 1rem;
    }
  }
</style>