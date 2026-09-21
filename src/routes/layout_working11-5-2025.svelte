<script lang="ts">
  import '../app.css';
  import '$lib/styles/base.css';
  import '$lib/styles/util.css';
  import '$lib/styles/buttons.css';

  // Safer for TS/Vite: returns a URL string
  import faviconUrl from '$lib/assets/favicon.svg?url';

  import FlameMark from '$lib/components/FlameMark.svelte';
  import AppNav from '$lib/components/AppNav.svelte';

  let activeSection = 'pop';
  const onNav = (id: string) => { activeSection = id; };
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
  .site-header-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
    background-color: #fae9f4; /* Fallback for browsers */
    background-image: repeating-linear-gradient(
        to bottom,
        #fae9f4,    /* Stripe 1 (Gray) */
        #fae9f4  1px,  /* Stripe 1 ends at 1px */
        #ecb2df 1px,  /* Stripe 2 (Pale Orange) starts at 1px */
        #ecb2df 2px   /* Stripe 2 ends at 2px, and the pattern repeats */
    );
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
    font-size: clamp(1.70rem, 2.7vw, 2.0rem);
    text-transform: uppercase;
    letter-spacing: 0.09em;
    line-height: 1;
    color: #fff;
    white-space: nowrap;
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
    font-size: clamp(1.0rem, 1.2vw, 1.10rem);
    letter-spacing: 0.095em;
    font-variant: small-caps;
    line-height: 1.2;
    color: #fff;
    white-space: nowrap;
    margin-top: 0px;
  }

  .action-word {
    font-style: italic;
    /* text-transform: small-caps; is not a standard CSS value. 
       We must use font-variant-caps: small-caps; for proper small caps. */
   /* font-variant-caps: small-caps; 
    /* Optionally, you could use a slightly different font weight 
       if the italic/small-caps combo doesn't provide enough emphasis. */
    text-transform: lowercase;
    font-weight: 300; /* Extra Bold, since the subtitle is 700 */
  }
</style>