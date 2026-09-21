import { writable, derived } from 'svelte/store';
export type ToggleKey = 'Map View' | 'Treemap View' | 'Growth Over Time' | 'Composition Over Time';
export const currentToggle = writable<ToggleKey>('Map View');
export const introOpen = writable<boolean>(true);
export const urlState = derived([currentToggle, introOpen], ([$t, $i]) => {
const params = new URLSearchParams(window.location.search);
params.set('t', $t);
params.set('intro', $i ? '1' : '0');
return '?' + params.toString();
});
export function syncUrl(toggle: ToggleKey, intro: boolean) {
const url = new URL(window.location.href);
url.searchParams.set('t', toggle);
url.searchParams.set('intro', intro ? '1' : '0');
history.replaceState({}, '', url);
}
export function readInitialState() {
const params = new URLSearchParams(window.location.search);
const t = (params.get('t') as ToggleKey) || 'Map View';
const intro = params.get('intro') !== '0';
currentToggle.set(t);
introOpen.set(intro);
}