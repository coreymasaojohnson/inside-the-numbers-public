import { writable, derived } from 'svelte/store';
import type { ToggleKey } from '$lib/stories';

// Main view toggle
export const currentView = writable<ToggleKey>('Map View');

// Map view state
export const mapCategory = writable<'combined' | 'asian' | 'nhpi'>('combined');
export const mapScope = writable<'county' | 'state'>('county');

// Treemap view state
export const treemapFamily = writable<'combined' | 'asian' | 'nhpi'>('combined');

// Growth view state
export const growthView = writable<'combined' | 'asian' | 'nhpi'>('combined');
export const growthScale = writable<'absolute' | 'indexed'>('absolute');

// Derived reactive properties for TopBar
export const isMap = derived(currentView, ($view) => $view === 'Map View');
export const isTreemap = derived(currentView, ($view) => $view === 'Treemap View');
export const isGrowth = derived(currentView, ($view) => $view === 'Growth Over Time');

// Category labels for Map view
export const categoryLabels = derived(isMap, ($isMap) =>
	$isMap ? ['Combined', 'Asian', 'NHPI'] : undefined
);

export const activeCategoryValue = derived([isMap, mapCategory], ([$isMap, $mapCategory]) =>
	$isMap ? $mapCategory.charAt(0).toUpperCase() + $mapCategory.slice(1) : undefined
);

// Scope labels (different per view)
export const scopeLabels = derived(
	[isMap, isTreemap, isGrowth],
	([$isMap, $isTreemap, $isGrowth]) => {
		if ($isMap) return ['County', 'State'];
		if ($isTreemap || $isGrowth) return ['Combined', 'Asian', 'NHPI'];
		return undefined;
	}
);

export const activeScopeValue = derived(
	[isMap, isTreemap, isGrowth, mapScope, treemapFamily, growthView],
	([$isMap, $isTreemap, $isGrowth, $mapScope, $treemapFamily, $growthView]) => {
		if ($isMap) return $mapScope.charAt(0).toUpperCase() + $mapScope.slice(1);
		if ($isTreemap) return $treemapFamily.charAt(0).toUpperCase() + $treemapFamily.slice(1);
		if ($isGrowth) return $growthView.charAt(0).toUpperCase() + $growthView.slice(1);
		return undefined;
	}
);

// Scale labels for Growth view
export const scaleLabels = derived(isGrowth, ($isGrowth) =>
	$isGrowth ? ['Absolute', 'Indexed'] : undefined
);

export const activeScaleValue = derived([isGrowth, growthScale], ([$isGrowth, $growthScale]) =>
	$isGrowth ? ($growthScale === 'absolute' ? 'Absolute' : 'Indexed') : undefined
);
