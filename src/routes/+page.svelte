<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	import TopBar from '$lib/components/TopBar.svelte';
	import HeroPanel from '$lib/components/HeroPanel.svelte';

	import MapHero from '$lib/components/toggles/MapHero.svelte';
	import TreemapHero from '$lib/components/toggles/TreemapHero.svelte';
	import GrowthHero from '$lib/components/toggles/GrowthHero.svelte';

	import IntroBelow from '$lib/components/IntroBelow.svelte';

	import { currentToggle, readInitialState, syncUrl, type ToggleKey } from '$lib/stories';

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

	const TOGGLES: ToggleKey[] = ['Map View', 'Treemap View', 'Growth Over Time'];

	// Track initial page load fade-ins (staggered: hero first, then IntroBelow)
	let heroLoadComplete = false;
	let introLoadComplete = false;
	let initialRenderAttempted = false;
	// Suppresses the view-container in:fade on initial load so the wrapper's
	// CSS transition is the only fade — prevents a stacked ease-out "jump".
	let viewTransitionsEnabled = false;

	function handleHeroRenderComplete() {
		heroLoadComplete = true;
		viewTransitionsEnabled = true;
		// Fade in IntroBelow 300ms after hero
		setTimeout(() => {
			introLoadComplete = true;
		}, 300);
	}

	// Safety mechanism: Force fade-in after 1 second even if callback doesn't fire
	onMount(() => {
		const safetyTimeout = setTimeout(() => {
			if (!heroLoadComplete) {
				console.log('[+page] Safety timeout: forcing fade-in');
				heroLoadComplete = true;
				setTimeout(() => {
					introLoadComplete = true;
				}, 300);
			}
		}, 1000);

		return () => clearTimeout(safetyTimeout);
	});

	// --- Prepare state for IntroBelow ---
	$: introView = $currentView;

	$: introScope = $isMap
		? `${$mapCategory.charAt(0).toUpperCase() + $mapCategory.slice(1)} - ${$mapScope.charAt(0).toUpperCase() + $mapScope.slice(1)}`
		: $isTreemap
			? $treemapFamily.charAt(0).toUpperCase() + $treemapFamily.slice(1)
			: $isGrowth
				? $growthView.charAt(0).toUpperCase() + $growthView.slice(1)
				: '';

	$: introScale = $isGrowth ? ($growthScale === 'absolute' ? 'Absolute' : 'Indexed') : '';

	// --- Handlers that update stores ---
	const handleCategoryChange = (value: string) => {
		const internalKey = value.toLowerCase() as 'combined' | 'asian' | 'nhpi';
		if ($isMap) {
			mapCategory.set(internalKey);
		}
	};

	const handleScopeChange = (value: string) => {
		const internalKey = value.toLowerCase() as 'combined' | 'asian' | 'nhpi' | 'county' | 'state';

		if ($isMap) {
			mapScope.set(internalKey as 'county' | 'state');
		} else if ($isTreemap) {
			treemapFamily.set(internalKey as 'combined' | 'asian' | 'nhpi');
		} else if ($isGrowth) {
			growthView.set(internalKey as 'combined' | 'asian' | 'nhpi');
		}
	};

	const handleScaleChange = (value: string) => {
		// FIX: Maps external "Absolute" to internal 'absolute'
		const internalKey = value.toLowerCase() === 'absolute' ? 'absolute' : 'indexed';

		if ($isGrowth) {
			// FIX: Casts the new internalKey to the correct union type
			growthScale.set(internalKey as 'indexed' | 'absolute');
		}
	};

	// Sync with currentToggle store from stories
	onMount(async () => {
		// Read and set initial state synchronously
		readInitialState();

		// Ensure currentView is set to a default if not already set
		if (!$currentView || $currentView === '') {
			currentView.set('Map View');
			currentToggle.set('Map View');
		}

		const unsub = currentToggle.subscribe((t) => {
			currentView.set(t);
			syncUrl(t, true);
		});

		return () => unsub();
	});

	const setToggle = (t: ToggleKey) => {
		currentToggle.set(t);
		currentView.set(t);
	};
</script>

<section class="feature-band feature-band--tight">
	<TopBar
		views={TOGGLES}
		activeView={$currentView}
		onView={setToggle}
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

	<main class="site-container site-container--flush mt-2.5">
		<HeroPanel isOpen={true} onToggle={() => {}}>
			<div class="hero-load-wrapper" class:loaded={heroLoadComplete}>
				{#key $currentView}
					<div
						class="view-container"
						in:fade={viewTransitionsEnabled ? { duration: 500, delay: 200 } : { duration: 0 }}
						out:fade={{ duration: 300 }}
					>
						{#if $currentView === 'Map View'}
							<MapHero
								scope={$mapScope}
								category={$mapCategory}
								onFirstRenderComplete={handleHeroRenderComplete}
							/>
						{:else if $currentView === 'Treemap View'}
							<TreemapHero
								family={$treemapFamily}
								palette="plum"
								showHeader={true}
								showLegend={true}
								onFirstRenderComplete={handleHeroRenderComplete}
							/>
						{:else if $currentView === 'Growth Over Time'}
							<GrowthHero
								bind:view={$growthView}
								bind:measure={$growthScale}
								onFirstRenderComplete={handleHeroRenderComplete}
							/>
						{/if}
					</div>
				{/key}
			</div>
		</HeroPanel>
	</main>
</section>

<div class="intro-load-wrapper" class:loaded={introLoadComplete}>
	<IntroBelow activeView={introView} activeScope={introScope} activeScale={introScale} />
</div>

<style>
	/* Container for transitioning views */
	.view-container {
		width: 100%;
		min-height: 550px; /* Prevent layout collapse during transitions */
	}

	/* Initial page load fade-in effect for hero */
	.hero-load-wrapper {
		opacity: 0;
		transition: opacity 0.9s ease-in-out;
	}

	.hero-load-wrapper.loaded {
		opacity: 1;
	}

	/* Staggered fade-in effect for IntroBelow (fades in after hero) */
	.intro-load-wrapper {
		opacity: 0;
		transition: opacity 0.8s ease-out;
	}

	.intro-load-wrapper.loaded {
		opacity: 1;
	}
</style>
