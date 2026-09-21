<script lang="ts">
	export let isOpen = true;
	export let onToggle: () => void = () => {};

	// keep these props if you added them earlier
	export let fullBleed = false; // ← constrained to site-container
	export let flush = true; // ← no vertical padding/chrome
</script>

<section class="hero hero--flush">
	<div class="site-container">
		<slot name="viz" />
		<slot />
	</div>
</section>
